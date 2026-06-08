import { callGatewayMethod } from '../api-client';
import { listProducts, searchLinkOptions } from '../master-data';
import {
  cancelPurchaseOrder,
  cancelPurchaseInvoice,
  cancelPurchaseReceipt,
  cancelSupplierPaymentEntry,
  createPurchaseOrderV2,
  createPurchaseOrderInvoice,
  getPurchaseCompanyContext,
  getSupplierPurchaseContext,
  quickCreatePurchaseOrderV2,
  receivePurchaseOrder,
  recordPurchaseOrderPayment,
  searchPurchaseOrders,
} from '../purchase';
import { fetchCashflowEntries, fetchSalesReport } from '../reports';
import {
  cancelDeliveryNote,
  cancelSalesOrder,
  cancelSalesPaymentEntry,
  cancelSalesInvoice,
  createSalesOrderV2,
  createSalesOrderInvoice,
  getSalesReturnSourceContext,
  getCustomerSalesContext,
  getSalesOrderDetail,
  quickCancelSalesOrderV2,
  quickCreateSalesOrderV2,
  recordSalesOrderPayment,
  searchSalesOrders,
  submitSalesOrderDelivery,
  submitSalesReturn,
  updateSalesOrderItemsV2,
  updateSalesOrderV2,
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
            delivered_qty: 1,
            item_code: 'SKU-1',
            item_name: 'Camera',
            qty: 2,
            rate: 50,
            sales_order_item: 'SOI-0001',
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
      items: [
        {
          deliveredQty: 1,
          itemCode: 'SKU-1',
          itemName: 'Camera',
          salesOrderItem: 'SOI-0001',
        },
      ],
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
            all_uoms: [
              { conversion_factor: 1, uom: 'Nos', uom_display: '个' },
              { conversion_factor: 12, uom: 'Box', uom_display: '箱' },
            ],
            price: '19.9',
            price_summary: { retail_rate: '22', wholesale_rate: '180' },
            retail_default_uom: 'Nos',
            stock_uom: 'Nos',
            total_qty: '5',
            warehouse_stock_qty: '3',
            wholesale_default_uom: 'Box',
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
      retailDefaultUom: 'Nos',
      totalQty: 5,
      uomConversions: [
        { conversionFactor: 1, uom: 'Nos' },
        { conversionFactor: 12, uom: 'Box' },
      ],
      warehouseStockQty: 3,
      wholesaleDefaultUom: 'Box',
    });
    expect(result.items[0].priceSummary?.wholesaleRate).toBe(180);
    expect(result.total).toBe(8);
    expect(result.hasMore).toBe(true);
  });

  it('maps customer sales context', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        customer: { display_name: 'ACME', name: 'CUST-0001' },
        default_address: {
          address_display: '上海市长宁区',
          name: 'ADDR-0001',
        },
        default_contact: {
          display_name: 'Alice',
          email: 'alice@example.test',
          name: 'CONT-0001',
          phone: '13800000000',
        },
        suggestions: {
          company: 'rgc (Demo)',
          warehouse: 'Stores - RD',
        },
      },
      meta: {},
      raw: {},
    });

    const context = await getCustomerSalesContext('CUST-0001');

    expect(context).toMatchObject({
      defaultAddress: { addressDisplay: '上海市长宁区' },
      defaultContact: { displayName: 'Alice', phone: '13800000000' },
      suggestions: { company: 'rgc (Demo)', warehouse: 'Stores - RD' },
    });
    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'get_customer_sales_context',
      { customer: 'CUST-0001' },
    );
  });

  it('maps supplier purchase context', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        default_address: {
          address_display: '深圳市南山区',
          name: 'ADDR-0002',
        },
        default_contact: {
          display_name: 'Bob',
          mobile_no: '13900000000',
          name: 'CONT-0002',
        },
        suggestions: {
          company: 'rgc (Demo)',
          currency: 'CNY',
          warehouse: 'Stores - RD',
        },
        supplier: {
          default_currency: 'CNY',
          display_name: 'Supplier A',
          name: 'SUP-0001',
        },
      },
      meta: {},
      raw: {},
    });
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        company: 'rgc (Demo)',
        currency: 'CNY',
        warehouse: 'Stores - RD',
      },
      meta: {},
      raw: {},
    });

    const supplierContext = await getSupplierPurchaseContext(
      'SUP-0001',
      'rgc (Demo)',
    );
    const companyContext = await getPurchaseCompanyContext('rgc (Demo)');

    expect(supplierContext).toMatchObject({
      defaultAddress: { addressDisplay: '深圳市南山区' },
      defaultContact: { displayName: 'Bob', phone: '13900000000' },
      suggestions: {
        company: 'rgc (Demo)',
        currency: 'CNY',
        warehouse: 'Stores - RD',
      },
      supplier: { displayName: 'Supplier A', name: 'SUP-0001' },
    });
    expect(companyContext).toEqual({
      company: 'rgc (Demo)',
      currency: 'CNY',
      warehouse: 'Stores - RD',
    });
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      1,
      'get_supplier_purchase_context',
      { company: 'rgc (Demo)', supplier: 'SUP-0001' },
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      2,
      'get_purchase_company_context',
      { company: 'rgc (Demo)' },
    );
  });

  it('maps sales return source context', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        actions: { can_process_return: true, supports_partial_return: true },
        amounts: { outstanding_amount: 20, primary_amount: 100 },
        document_status: 'submitted',
        items: [
          {
            amount: 100,
            default_return_qty: 2,
            detail_id: 'SII-0001',
            detail_submit_key: 'sales_invoice_item',
            item_code: 'SKU-1',
            item_name: 'Camera',
            max_returnable_qty: 2,
            rate: 50,
            source_qty: 2,
            uom: 'Nos',
            warehouse: 'Stores - RD',
          },
        ],
        meta: { company: 'rgc (Demo)', currency: 'CNY' },
        party: { display_name: 'ACME', party_name: 'CUST-0001' },
        source_doctype: 'Sales Invoice',
        source_label: '销售发票',
        source_name: 'SINV-0001',
      },
      meta: {},
      raw: {},
    });

    const context = await getSalesReturnSourceContext(
      'Sales Invoice',
      'SINV-0001',
    );

    expect(context).toMatchObject({
      canProcessReturn: true,
      company: 'rgc (Demo)',
      items: [{ detailId: 'SII-0001', detailSubmitKey: 'sales_invoice_item' }],
      partyDisplayName: 'ACME',
      primaryAmount: 100,
      sourceDoctype: 'Sales Invoice',
    });
    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'get_return_source_context_v2',
      {
        source_doctype: 'Sales Invoice',
        source_name: 'SINV-0001',
      },
    );
  });

  it('maps link options for selectors', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: [
        { description: null, label: 'Cash', value: 'Cash' },
        { description: '微信', label: '微信支付', value: '微信支付' },
      ],
      meta: {},
      raw: {},
    });

    const result = await searchLinkOptions('Mode of Payment', 'Ca');

    expect(result).toEqual([
      { description: null, label: 'Cash', value: 'Cash' },
      { description: '微信', label: '微信支付', value: '微信支付' },
    ]);
    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'search_link_options_v1',
      {
        doctype: 'Mode of Payment',
        extra_fields: [],
        limit: 20,
        query: 'Ca',
      },
    );
  });

  it('runs sales order mutations through gateway', async () => {
    mockedCallGatewayMethod.mockResolvedValue({ data: { name: 'OK' } });

    await submitSalesOrderDelivery('SO-0001', {
      deliveryItems: [
        { itemCode: 'SKU-1', qty: 2, salesOrderItem: 'SOI-0001' },
        { itemCode: 'SKU-2', qty: 0, salesOrderItem: 'SOI-0002' },
      ],
      postingDate: '2026-06-05',
      remarks: '发货备注',
    });
    await createSalesOrderInvoice('SO-0001', {
      invoiceItems: [{ itemCode: 'SKU-1', qty: 1, salesOrderItem: 'SOI-0001' }],
      remarks: '开票备注',
    });
    await recordSalesOrderPayment('SO-0001', 120, { modeOfPayment: 'Bank' });
    await cancelSalesOrder('SO-0001');
    await createSalesOrderV2({
      company: 'rgc (Demo)',
      customer: 'CUST-0001',
      defaultSalesMode: 'wholesale',
      deliveryDate: '2026-06-06',
      items: [
        {
          itemCode: 'SKU-1',
          price: 100,
          qty: 2,
          salesMode: 'wholesale',
          uom: 'Box',
          warehouse: 'Stores - RD',
        },
      ],
      transactionDate: '2026-06-05',
    });
    await quickCreateSalesOrderV2({
      company: 'rgc (Demo)',
      customer: 'CUST-0001',
      forceDelivery: true,
      items: [{ itemCode: 'SKU-1', qty: 1 }],
    });
    await updateSalesOrderV2('SO-0001', {
      customerInfo: { contactDisplayName: 'Alice', contactPhone: '138' },
      defaultSalesMode: 'retail',
      deliveryDate: '2026-06-08',
      remarks: '更新备注',
      shippingInfo: { shippingAddressText: '上海' },
      transactionDate: '2026-06-07',
    });
    await updateSalesOrderItemsV2('SO-0001', {
      company: 'rgc (Demo)',
      defaultWarehouse: 'Stores - RD',
      deliveryDate: '2026-06-08',
      items: [{ itemCode: 'SKU-1', price: 22, qty: 3, salesMode: 'retail' }],
    });
    await quickCancelSalesOrderV2('SO-0001');
    await submitSalesReturn({
      postingDate: '2026-06-09',
      remarks: '客户退货',
      returnItems: [{ qty: 1, sales_invoice_item: 'SII-0001' }],
      sourceDoctype: 'Sales Invoice',
      sourceName: 'SINV-0001',
    });

    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      1,
      'submit_delivery',
      {
        delivery_items: [
          { item_code: 'SKU-1', qty: 2, sales_order_item: 'SOI-0001' },
        ],
        kwargs: { posting_date: '2026-06-05', remarks: '发货备注' },
        order_name: 'SO-0001',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      2,
      'create_sales_invoice',
      {
        invoice_items: [
          { item_code: 'SKU-1', qty: 1, sales_order_item: 'SOI-0001' },
        ],
        kwargs: { remarks: '开票备注' },
        source_name: 'SO-0001',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      3,
      'update_payment_status',
      {
        mode_of_payment: 'Bank',
        paid_amount: 120,
        reference_doctype: 'Sales Order',
        reference_name: 'SO-0001',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      4,
      'cancel_order_v2',
      { order_name: 'SO-0001' },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      5,
      'create_order_v2',
      {
        company: 'rgc (Demo)',
        customer: 'CUST-0001',
        default_sales_mode: 'wholesale',
        delivery_date: '2026-06-06',
        force_delivery: 0,
        items: [
          {
            item_code: 'SKU-1',
            price: 100,
            qty: 2,
            sales_mode: 'wholesale',
            uom: 'Box',
            warehouse: 'Stores - RD',
          },
        ],
        transaction_date: '2026-06-05',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      6,
      'quick_create_order_v2',
      {
        company: 'rgc (Demo)',
        customer: 'CUST-0001',
        force_delivery: 1,
        items: [{ item_code: 'SKU-1', qty: 1 }],
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      7,
      'update_order_v2',
      {
        customer_info: {
          contact_display_name: 'Alice',
          contact_phone: '138',
        },
        default_sales_mode: 'retail',
        delivery_date: '2026-06-08',
        order_name: 'SO-0001',
        remarks: '更新备注',
        shipping_info: { shipping_address_text: '上海' },
        transaction_date: '2026-06-07',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      8,
      'update_order_items_v2',
      {
        company: 'rgc (Demo)',
        default_warehouse: 'Stores - RD',
        delivery_date: '2026-06-08',
        items: [
          {
            item_code: 'SKU-1',
            price: 22,
            qty: 3,
            sales_mode: 'retail',
          },
        ],
        order_name: 'SO-0001',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      9,
      'quick_cancel_order_v2',
      {
        order_name: 'SO-0001',
        rollback_payment: 1,
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      10,
      'process_sales_return',
      {
        posting_date: '2026-06-09',
        remarks: '客户退货',
        return_items: [{ qty: 1, sales_invoice_item: 'SII-0001' }],
        source_doctype: 'Sales Invoice',
        source_name: 'SINV-0001',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
  });

  it('runs purchase order mutations through gateway', async () => {
    mockedCallGatewayMethod.mockResolvedValue({ data: { name: 'OK' } });

    await receivePurchaseOrder('PO-0001', {
      postingDate: '2026-06-05',
      receiptItems: [
        { itemCode: 'SKU-1', purchaseOrderItem: 'POI-0001', qty: 3 },
        { itemCode: 'SKU-2', purchaseOrderItem: 'POI-0002', qty: 0 },
      ],
      remarks: '收货备注',
    });
    await createPurchaseOrderInvoice('PO-0001', {
      invoiceItems: [
        { itemCode: 'SKU-1', purchaseOrderItem: 'POI-0001', qty: 2 },
      ],
      remarks: '采购开票备注',
    });
    await recordPurchaseOrderPayment('PO-0001', 88, {
      modeOfPayment: 'Cash',
    });
    await cancelPurchaseOrder('PO-0001');
    await createPurchaseOrderV2({
      company: 'rgc (Demo)',
      currency: 'CNY',
      defaultWarehouse: 'Stores - RD',
      items: [
        {
          itemCode: 'SKU-1',
          price: 12,
          qty: 3,
          uom: 'Nos',
          warehouse: 'Stores - RD',
        },
      ],
      scheduleDate: '2026-06-06',
      supplier: 'SUP-0001',
      supplierRef: 'SUP-REF-1',
      transactionDate: '2026-06-05',
    });
    await quickCreatePurchaseOrderV2({
      company: 'rgc (Demo)',
      immediateInvoice: true,
      immediateReceive: true,
      items: [{ itemCode: 'SKU-1', qty: 1 }],
      supplier: 'SUP-0001',
    });

    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      1,
      'receive_purchase_order',
      {
        kwargs: { posting_date: '2026-06-05', remarks: '收货备注' },
        order_name: 'PO-0001',
        receipt_items: [
          { item_code: 'SKU-1', purchase_order_item: 'POI-0001', qty: 3 },
        ],
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      2,
      'create_purchase_invoice',
      {
        invoice_items: [
          { item_code: 'SKU-1', purchase_order_item: 'POI-0001', qty: 2 },
        ],
        kwargs: { remarks: '采购开票备注' },
        source_name: 'PO-0001',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      3,
      'record_supplier_payment',
      {
        mode_of_payment: 'Cash',
        paid_amount: 88,
        reference_name: 'PO-0001',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      4,
      'cancel_purchase_order_v2',
      { order_name: 'PO-0001' },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      5,
      'create_purchase_order',
      {
        company: 'rgc (Demo)',
        currency: 'CNY',
        default_warehouse: 'Stores - RD',
        items: [
          {
            item_code: 'SKU-1',
            price: 12,
            qty: 3,
            uom: 'Nos',
            warehouse: 'Stores - RD',
          },
        ],
        schedule_date: '2026-06-06',
        supplier: 'SUP-0001',
        supplier_ref: 'SUP-REF-1',
        transaction_date: '2026-06-05',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      6,
      'quick_create_purchase_order_v2',
      {
        company: 'rgc (Demo)',
        immediate_invoice: 1,
        immediate_payment: 0,
        immediate_receive: 1,
        items: [{ item_code: 'SKU-1', qty: 1 }],
        supplier: 'SUP-0001',
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
