import { callGatewayMethod } from '../api-client';
import { listProducts } from '../master-data';
import {
  cancelPurchaseInvoice,
  cancelPurchaseReceipt,
  cancelSupplierPaymentEntry,
  createPurchaseOrderInvoice,
  receivePurchaseOrder,
  recordPurchaseOrderPayment,
  searchPurchaseOrders,
} from '../purchase';
import { fetchCashflowEntries, fetchSalesReport } from '../reports';
import {
  cancelDeliveryNote,
  cancelSalesPaymentEntry,
  cancelSalesInvoice,
  createSalesOrderInvoice,
  getSalesOrderDetail,
  recordSalesOrderPayment,
  searchSalesOrders,
  submitSalesOrderDelivery,
} from '../sales';

jest.mock('../api-client', () => ({
  callGatewayMethod: jest.fn(),
  createIdempotencyKey: jest.fn(() => 'web-test-key'),
}));

jest.mock('../api-base', () => ({
  getMyAppApiBaseUrl: jest.fn(() => 'http://api.example.test'),
}));

const mockedCallGatewayMethod = callGatewayMethod as unknown as jest.Mock;

describe('myapp domain services', () => {
  beforeEach(() => {
    mockedCallGatewayMethod.mockReset();
  });

  it('maps sales order search rows', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        items: [
          {
            company: 'rgc (Demo)',
            customer_name: 'ACME',
            document_status: 'submitted',
            fulfillment: { status: 'pending' },
            modified: '2026-06-04 10:00:00',
            order_amount_estimate: '120.5',
            order_name: 'SO-0001',
            outstanding_amount: '20.5',
            payment: { status: 'unpaid' },
            transaction_date: '2026-06-04',
          },
        ],
        pagination: { has_more: true, total_count: 30 },
        summary: { total_count: 31, visible_count: 1, unfinished_count: 1 },
      },
      meta: {},
      raw: {},
    });

    const result = await searchSalesOrders({ searchKey: 'SO-0001' });

    expect(result.items[0]).toMatchObject({
      amount: 120.5,
      customer: 'ACME',
      name: 'SO-0001',
      outstandingAmount: 20.5,
      paymentStatus: 'unpaid',
    });
    expect(result.summary.totalCount).toBe(31);
    expect(result.summary.visibleCount).toBe(30);
    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'search_sales_orders_v2',
      expect.objectContaining({ search_key: 'SO-0001' }),
    );
  });

  it('maps sales order detail rows and references', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        actions: { can_create_sales_invoice: true, can_submit_delivery: true },
        amounts: {
          order_amount_estimate: 100,
          outstanding_amount: 30,
          paid_amount: 70,
        },
        customer: { display_name: 'ACME', name: 'CUST-0001' },
        document_status: 'submitted',
        fulfillment: { status: 'pending' },
        items: [
          {
            amount: 100,
            item_code: 'SKU-1',
            item_name: 'Camera',
            qty: 2,
            rate: 50,
            uom: 'Nos',
            warehouse: 'Stores - RD',
          },
        ],
        meta: {
          company: 'rgc (Demo)',
          currency: 'CNY',
          transaction_date: '2026-06-04',
        },
        order_name: 'SO-0001',
        references: {
          delivery_notes: ['DN-0001'],
          sales_invoices: ['SI-0001'],
        },
        shipping: {
          contact_display: 'Alice',
          contact_phone: '13800000000',
          shipping_address_text: 'Shanghai',
        },
      },
      meta: {},
      raw: {},
    });

    const detail = await getSalesOrderDetail('SO-0001');

    expect(detail).toMatchObject({
      addressDisplay: 'Shanghai',
      canCreateSalesInvoice: true,
      canSubmitDelivery: true,
      customer: 'ACME',
      deliveryNotes: ['DN-0001'],
      items: [{ itemCode: 'SKU-1', itemName: 'Camera' }],
      paidAmount: 70,
      salesInvoices: ['SI-0001'],
    });
  });

  it('maps purchase order search rows', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        items: [
          {
            company: 'rgc (Demo)',
            document_status: 'submitted',
            order_amount_estimate: '88',
            outstanding_amount: '8',
            payment: { status: 'unpaid' },
            purchase_order_name: 'PO-0001',
            receiving: { status: 'pending' },
            supplier_name: 'Supplier A',
            transaction_date: '2026-06-04',
          },
        ],
        pagination: { has_more: false, total_count: 24 },
        summary: { receiving_count: 1, total_count: 25, visible_count: 1 },
      },
      meta: {},
      raw: {},
    });

    const result = await searchPurchaseOrders({ searchKey: 'PO-0001' });

    expect(result.items[0]).toMatchObject({
      amount: 88,
      name: 'PO-0001',
      outstandingAmount: 8,
      receivingStatus: 'pending',
      supplierName: 'Supplier A',
    });
    expect(result.summary.receivingCount).toBe(1);
    expect(result.summary.totalCount).toBe(25);
    expect(result.summary.visibleCount).toBe(24);
  });

  it('maps report and cashflow envelopes', async () => {
    mockedCallGatewayMethod
      .mockResolvedValueOnce({
        data: {
          meta: { company: 'rgc (Demo)', date_from: '2026-06-01', limit: 8 },
          overview: { sales_amount_total: '100' },
          tables: {
            sales_summary: [{ amount: '100', count: 2, name: 'ACME' }],
            sales_trend: [{ amount: '100', count: 2, trend_date: '2026-06-04' }],
          },
        },
        meta: {},
        raw: {},
      })
      .mockResolvedValueOnce({
        data: {
          pagination: { has_more: true, total_count: 30 },
          rows: [
            {
              amount: '12',
              direction: 'out',
              mode_of_payment: 'Cash',
              name: 'PE-0001',
              party: 'Supplier A',
              party_type: 'Supplier',
              posting_date: '2026-06-04',
            },
          ],
        },
        meta: {},
        raw: {},
      });

    const salesReport = await fetchSalesReport();
    const cashflow = await fetchCashflowEntries();

    expect(salesReport.overview.salesAmountTotal).toBe(100);
    expect(salesReport.tables.salesSummary[0]).toMatchObject({
      amount: 100,
      count: 2,
      name: 'ACME',
    });
    expect(cashflow.items[0]).toMatchObject({
      amount: 12,
      direction: 'out',
      name: 'PE-0001',
    });
    expect(cashflow.total).toBe(30);
    expect(cashflow.hasMore).toBe(true);
  });

  it('maps product list media and totals', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        data: [
          {
            brand: 'Brand',
            image: '/files/item.png',
            item_code: 'SKU-1',
            item_name: 'Camera',
            price: '19.9',
            stock_uom: 'Nos',
            total_qty: '5',
          },
        ],
        meta: { has_more: false, total: 1 },
        pagination: { has_more: true, total_count: 8 },
      },
      meta: {},
      raw: {},
    });

    const result = await listProducts({ searchKey: 'Camera' });

    expect(result.items[0]).toMatchObject({
      imageUrl: 'http://api.example.test/files/item.png',
      itemCode: 'SKU-1',
      itemName: 'Camera',
      price: 19.9,
      totalQty: 5,
    });
    expect(result.total).toBe(8);
    expect(result.hasMore).toBe(true);
  });

  it('runs sales order mutations through gateway', async () => {
    mockedCallGatewayMethod.mockResolvedValue({ data: { name: 'OK' } });

    await submitSalesOrderDelivery('SO-0001');
    await createSalesOrderInvoice('SO-0001');
    await recordSalesOrderPayment('SO-0001', 120);

    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      1,
      'submit_delivery',
      { order_name: 'SO-0001' },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      2,
      'create_sales_invoice',
      { source_name: 'SO-0001' },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      3,
      'update_payment_status',
      {
        paid_amount: 120,
        reference_doctype: 'Sales Order',
        reference_name: 'SO-0001',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
  });

  it('runs purchase order mutations through gateway', async () => {
    mockedCallGatewayMethod.mockResolvedValue({ data: { name: 'OK' } });

    await receivePurchaseOrder('PO-0001');
    await createPurchaseOrderInvoice('PO-0001');
    await recordPurchaseOrderPayment('PO-0001', 88);

    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      1,
      'receive_purchase_order',
      { order_name: 'PO-0001' },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      2,
      'create_purchase_invoice',
      { source_name: 'PO-0001' },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      3,
      'record_supplier_payment',
      {
        paid_amount: 88,
        reference_name: 'PO-0001',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
  });

  it('runs sales downstream cancel mutations through gateway', async () => {
    mockedCallGatewayMethod.mockResolvedValue({ data: { name: 'OK' } });

    await cancelDeliveryNote('DN-0001');
    await cancelSalesInvoice('SI-0001');
    await cancelSalesPaymentEntry('PE-0001');

    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      1,
      'cancel_delivery_note',
      { delivery_note_name: 'DN-0001' },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      2,
      'cancel_sales_invoice',
      { sales_invoice_name: 'SI-0001' },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      3,
      'cancel_payment_entry',
      { payment_entry_name: 'PE-0001' },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
  });

  it('runs purchase downstream cancel mutations through gateway', async () => {
    mockedCallGatewayMethod.mockResolvedValue({ data: { name: 'OK' } });

    await cancelPurchaseReceipt('PR-0001');
    await cancelPurchaseInvoice('PI-0001');
    await cancelSupplierPaymentEntry('PE-0002');

    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      1,
      'cancel_purchase_receipt_v2',
      { receipt_name: 'PR-0001' },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      2,
      'cancel_purchase_invoice_v2',
      { invoice_name: 'PI-0001' },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      3,
      'cancel_supplier_payment',
      { payment_entry_name: 'PE-0002' },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
  });
});
