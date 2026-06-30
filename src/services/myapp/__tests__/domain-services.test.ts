import { callGatewayMethod } from '../api-client';
import {
  adjustInventoryStock,
  listInventoryStockSummary,
  transferInventoryStock,
} from '../inventory';
import { listBusinessDocuments } from '../documents';
import {
  confirmPendingDocument,
  listPendingConfirmations,
} from '../pending-confirmations';
import {
  addProductBarcode,
  bulkSetProductsDisabled,
  bulkUpdateProducts,
  createCustomer,
  createProduct,
  createSupplier,
  createUom,
  deleteProductBarcode,
  getProductDetail,
  listProducts,
  listUoms,
  listWarehouses,
  searchProducts,
  searchLinkOptions,
  setPrimaryProductBarcode,
  setCustomerDisabled,
  setProductDisabled,
  setSupplierDisabled,
  setUomDisabled,
  updateCustomer,
  updateProduct,
  updateSupplier,
  updateUom,
  createWarehouse,
  setWarehouseDisabled,
  updateWarehouse,
} from '../master-data';
import {
  deleteItemImage,
  replaceItemImage,
  uploadItemImage,
} from '../media';
import {
  cancelPurchaseOrder,
  cancelPurchaseInvoice,
  cancelPurchaseReceipt,
  cancelSupplierPaymentEntry,
  createPurchaseInvoiceFromReceipt,
  createPurchaseOrderV2,
  createPurchaseOrderInvoice,
  getPurchaseCompanyContext,
  getPurchaseReturnSourceContext,
  getSupplierPurchaseContext,
  quickCancelPurchaseOrderV2,
  quickCreatePurchaseOrderV2,
  receivePurchaseOrder,
  recordSupplierPayment,
  searchPurchaseOrders,
  submitPurchaseReturn,
  updatePurchaseOrderItemsV2,
  updatePurchaseOrderV2,
} from '../purchase';
import {
  fetchPrintFile,
  fetchPrintPreview,
} from '../printing';
import {
  fetchCashflowEntries,
  fetchSalesReport,
  getPaymentEntryDetail,
} from '../reports';
import {
  cancelDeliveryNote,
  cancelSalesOrder,
  cancelSalesPaymentEntry,
  cancelSalesInvoice,
  createCustomerRefund,
  createSalesOrderV2,
  createSalesOrderInvoice,
  exportSalesOrders,
  getCustomerRefundContext,
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
import {
  getCurrentUserWorkspacePreferences,
  updateCurrentUserWorkspacePreferences,
} from '../workspace';

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

  it('maps business document list rows', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        items: [
          {
            amount: 120,
            business_status: 'Paid',
            company: 'rgc (Demo)',
            detail_path: '/sales/invoices',
            docstatus: 1,
            doctype: 'Sales Invoice',
            document_status: 'Submitted',
            due_date: '2026-06-08',
            is_return: 0,
            modified: '2026-06-01 10:00:00',
            name: 'SI-0001',
            outstanding_amount: 0,
            paid_amount: 120,
            party: 'CUST-0001',
            party_name: '客户 A',
            posting_date: '2026-06-01',
            return_against: null,
          },
        ],
        pagination: { total_count: 1 },
        summary: { total_count: 1, visible_count: 1 },
      },
    });

    const result = await listBusinessDocuments({
      company: 'rgc (Demo)',
      docstatus: 'submitted',
      doctype: 'Sales Invoice',
      limit: 20,
      searchKey: 'SI',
      start: 0,
    });

    expect(result.items[0]).toMatchObject({
      amount: 120,
      businessStatus: 'Paid',
      detailPath: '/sales/invoices',
      documentStatus: 'Submitted',
      isReturn: false,
      name: 'SI-0001',
      partyName: '客户 A',
    });
    expect(result.summary.visibleCount).toBe(1);
    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'list_business_documents_v1',
      {
        company: 'rgc (Demo)',
        docstatus: 'submitted',
        doctype: 'Sales Invoice',
        limit: 20,
        search_key: 'SI',
        sort_by: 'latest',
        start: 0,
      },
    );
  });

  it('lists pending confirmations from draft business documents', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        items: [
          {
            amount: 88,
            business_status: 'Draft',
            company: 'rgc (Demo)',
            detail_path: '/sales/invoices',
            docstatus: 0,
            doctype: 'Sales Invoice',
            document_status: 'Draft',
            modified: '2026-06-02 10:00:00',
            name: 'SI-DRAFT-1',
            party: 'CUST-0001',
            party_name: '客户 A',
            posting_date: '2026-06-02',
          },
        ],
        pagination: { total_count: 1 },
        summary: { visible_count: 1 },
      },
    });

    const result = await listPendingConfirmations({
      company: 'rgc (Demo)',
      doctype: 'Sales Invoice',
      limit: 20,
      searchKey: 'DRAFT',
    });

    expect(result.items[0]).toMatchObject({
      detailPath: '/sales/invoices/SI-DRAFT-1',
      docstatus: 0,
      doctype: 'Sales Invoice',
      name: 'SI-DRAFT-1',
    });
    expect(result.total).toBe(1);
    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'list_business_documents_v1',
      {
        company: 'rgc (Demo)',
        docstatus: 'draft',
        doctype: 'Sales Invoice',
        limit: 20,
        search_key: 'DRAFT',
        sort_by: 'latest',
        start: 0,
      },
    );
  });

  it('confirms pending document through gateway mutation', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        docname: 'SI-DRAFT-1',
        docstatus: 1,
        doctype: 'Sales Invoice',
        message: 'ok',
        workflow_state: 'Submitted',
      },
      meta: {},
      raw: {},
    });

    const result = await confirmPendingDocument({
      docname: 'SI-DRAFT-1',
      doctype: 'Sales Invoice',
    });

    expect(result.data).toMatchObject({
      docname: 'SI-DRAFT-1',
      docstatus: 1,
      doctype: 'Sales Invoice',
      workflowState: 'Submitted',
    });
    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'confirm_pending_document',
      {
        docname: 'SI-DRAFT-1',
        doctype: 'Sales Invoice',
        submit_on_confirm: 1,
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
  });

  it('maps sales order search rows', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        items: [
          {
            actions: {
              can_create_sales_invoice: true,
              can_record_payment: true,
              can_submit_delivery: true,
            },
            company: 'rgc (Demo)',
            customer_name: 'ACME',
            delivery_date: '2026-06-08',
            document_status: 'submitted',
            fulfillment: { status: 'pending' },
            modified: '2026-06-04 10:00:00',
            order_amount_estimate: '120.5',
            order_name: 'SO-0001',
            outstanding_amount: '20.5',
            payment: { status: 'unpaid' },
            risk: {
              delivery_overdue_days: 2,
              is_delivery_overdue: true,
              is_payment_overdue: true,
              payment_overdue_days: 5,
            },
            transaction_date: '2026-06-04',
          },
        ],
        pagination: { has_more: true, total_count: 30 },
        summary: {
          delivery_overdue_count: 1,
          payment_overdue_count: 2,
          total_count: 31,
          visible_count: 1,
          unfinished_count: 1,
        },
      },
      meta: {},
      raw: {},
    });

    const result = await searchSalesOrders({ searchKey: 'SO-0001' });

    expect(result.items[0]).toMatchObject({
      amount: 120.5,
      canCreateSalesInvoice: true,
      canRecordPayment: true,
      canSubmitDelivery: true,
      customer: 'ACME',
      deliveryDate: '2026-06-08',
      deliveryOverdueDays: 2,
      isDeliveryOverdue: true,
      isPaymentOverdue: true,
      name: 'SO-0001',
      outstandingAmount: 20.5,
      paymentOverdueDays: 5,
      paymentStatus: 'unpaid',
    });
    expect(result.summary.totalCount).toBe(31);
    expect(result.summary.visibleCount).toBe(30);
    expect(result.summary.deliveryOverdueCount).toBe(1);
    expect(result.summary.paymentOverdueCount).toBe(2);
    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'search_sales_orders_v2',
      expect.objectContaining({ search_key: 'SO-0001' }),
    );
  });

  it('passes customer filter to sales order search', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        items: [],
        pagination: { total_count: 0 },
        summary: {},
      },
      meta: {},
      raw: {},
    });

    await searchSalesOrders({ customer: 'ACME' });

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'search_sales_orders_v2',
      expect.objectContaining({ customer: 'ACME' }),
    );
  });

  it('passes risk filter to sales order search', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        items: [],
        pagination: { total_count: 0 },
        summary: {},
      },
      meta: {},
      raw: {},
    });

    await searchSalesOrders({ riskFilter: 'delivery_overdue' });

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'search_sales_orders_v2',
      expect.objectContaining({ risk_filter: 'delivery_overdue' }),
    );
  });

  it('passes payment overdue risk filter to sales order search', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        items: [],
        pagination: { total_count: 0 },
        summary: {},
      },
      meta: {},
      raw: {},
    });

    await searchSalesOrders({ riskFilter: 'payment_overdue' });

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'search_sales_orders_v2',
      expect.objectContaining({ risk_filter: 'payment_overdue' }),
    );
  });

  it('exports sales orders with current filters', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        content: '订单号\nSO-0001',
        exported_count: 1,
        filename: 'sales-orders.csv',
        limit: 1000,
        mime_type: 'text/csv;charset=utf-8',
        truncated: false,
      },
      meta: {},
      raw: {},
    });

    const result = await exportSalesOrders({
      company: 'rgc (Demo)',
      limit: 1000,
      riskFilter: 'payment_overdue',
      sortBy: 'latest',
      statusFilter: 'paying',
    });

    expect(result).toMatchObject({
      exportedCount: 1,
      filename: 'sales-orders.csv',
      truncated: false,
    });
    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'export_sales_orders_v2',
      expect.objectContaining({
        company: 'rgc (Demo)',
        limit: 1000,
        risk_filter: 'payment_overdue',
        sort_by: 'latest',
        status_filter: 'paying',
      }),
    );
  });

  it('passes cancelled visibility when searching cancelled sales orders', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        items: [],
        pagination: { total_count: 0 },
        summary: {},
      },
      meta: {},
      raw: {},
    });

    await searchSalesOrders({
      excludeCancelled: false,
      statusFilter: 'cancelled',
    });

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'search_sales_orders_v2',
      expect.objectContaining({
        exclude_cancelled: 0,
        status_filter: 'cancelled',
      }),
    );
  });

  it('passes newest order sorting to sales order search', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        items: [],
        pagination: { total_count: 0 },
        summary: {},
      },
      meta: {},
      raw: {},
    });

    await searchSalesOrders({ sortBy: 'order_date_desc' });

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'search_sales_orders_v2',
      expect.objectContaining({ sort_by: 'order_date_desc' }),
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
        timeline: [
          {
            amount: 100,
            date: '2026-06-04',
            docname: 'SO-0001',
            doctype: 'Sales Order',
            key: 'sales_order:SO-0001',
            status: 'submitted',
            title: '销售订单',
            type: 'sales_order',
          },
        ],
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
      timeline: [{ docname: 'SO-0001', type: 'sales_order' }],
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

  it('passes cancelled visibility when searching cancelled purchase orders', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        items: [],
        pagination: { total_count: 0 },
        summary: {},
      },
      meta: {},
      raw: {},
    });

    await searchPurchaseOrders({
      excludeCancelled: false,
      statusFilter: 'cancelled',
    });

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'search_purchase_orders_v2',
      expect.objectContaining({
        exclude_cancelled: 0,
        status_filter: 'cancelled',
      }),
    );
  });

  it('passes newest order sorting to purchase order search', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        items: [],
        pagination: { total_count: 0 },
        summary: {},
      },
      meta: {},
      raw: {},
    });

    await searchPurchaseOrders({ sortBy: 'order_date_desc' });

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'search_purchase_orders_v2',
      expect.objectContaining({ sort_by: 'order_date_desc' }),
    );
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

  it('passes cashflow search key to gateway', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        pagination: { total_count: 0 },
        rows: [],
      },
      meta: {},
      raw: {},
    });

    await fetchCashflowEntries({ searchKey: 'PE-0001' });

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'list_cashflow_entries_v1',
      expect.objectContaining({ search_key: 'PE-0001' }),
    );
  });

  it('maps payment entry detail for fund traceability', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        actions: { can_cancel: true, cancel_hint: '' },
        amount: '120',
        business_type: 'customer_receipt',
        company: 'rgc (Demo)',
        currency: 'CNY',
        direction: 'in',
        docstatus: 1,
        document_status: 'submitted',
        mode_of_payment: 'Bank',
        name: 'PE-0001',
        party: 'CUST-0001',
        party_name: '客户 A',
        party_type: 'Customer',
        references: [
          {
            allocated_amount: '120',
            is_return: 0,
            reference_doctype: 'Sales Invoice',
            reference_name: 'SI-0001',
            total_amount: '120',
          },
        ],
        links: {
          sales_invoices: ['SI-0001'],
        },
      },
      meta: {},
      raw: {},
    });

    const detail = await getPaymentEntryDetail('PE-0001');

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'get_payment_entry_detail_v1',
      { payment_entry_name: 'PE-0001' },
    );
    expect(detail).toMatchObject({
      amount: 120,
      businessType: 'customer_receipt',
      direction: 'in',
      name: 'PE-0001',
      partyName: '客户 A',
    });
    expect(detail.references[0]).toMatchObject({
      allocatedAmount: 120,
      referenceDoctype: 'Sales Invoice',
      referenceName: 'SI-0001',
    });
    expect(detail.links.salesInvoices).toEqual(['SI-0001']);
    expect(detail.actions.canCancel).toBe(true);
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
            price_summary: {
              buying_prices: [
                {
                  currency: 'CNY',
                  price_list: 'Standard Buying',
                  rate: '11',
                },
              ],
              retail_rate: '22',
              selling_prices: [
                {
                  currency: 'CNY',
                  price_list: 'Standard Selling',
                  rate: '19.9',
                },
                {
                  currency: 'CNY',
                  price_list: 'Wholesale',
                  rate: '180',
                },
              ],
              wholesale_rate: '180',
            },
            retail_default_uom: 'Nos',
            stock_uom: 'Nos',
            total_qty: '5',
            warehouse_stock_details: [
              { company: 'rgc (Demo)', qty: '3', warehouse: 'Stores - RD' },
            ],
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

    const result = await listProducts({
      brand: 'Brand',
      inStockOnly: true,
      itemGroup: 'Products',
      searchKey: 'Camera',
    });

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
      warehouseStockDetails: [
        { company: 'rgc (Demo)', qty: 3, warehouse: 'Stores - RD' },
      ],
      warehouseStockQty: 3,
      wholesaleDefaultUom: 'Box',
    });
    expect(result.items[0].priceSummary?.wholesaleRate).toBe(180);
    expect(result.items[0].priceSummary?.sellingPrices).toEqual([
      { currency: 'CNY', priceList: 'Standard Selling', rate: 19.9 },
      { currency: 'CNY', priceList: 'Wholesale', rate: 180 },
    ]);
    expect(result.items[0].priceSummary?.buyingPrices).toEqual([
      { currency: 'CNY', priceList: 'Standard Buying', rate: 11 },
    ]);
    expect(result.total).toBe(8);
    expect(result.hasMore).toBe(true);
    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'list_products_v2',
      expect.objectContaining({
        brand: 'Brand',
        in_stock_only: 1,
        item_group: 'Products',
        search_key: 'Camera',
      }),
    );
  });

  it('searches products with business context', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        items: [
          {
            is_purchase_item: 1,
            is_sales_item: 0,
            item_code: 'SKU-1',
            item_group: 'Products',
            item_name: 'Camera',
            nickname: 'Camera Alias',
            stock_uom: 'Nos',
          },
        ],
        meta: { total: 1 },
      },
      meta: {},
      raw: {},
    });

    const result = await searchProducts({
      brand: 'Brand A',
      company: 'rgc (Demo)',
      inStockOnly: true,
      itemGroup: 'Products',
      itemContext: 'purchase',
      searchKey: 'Camera',
      warehouse: 'Stores - RD',
    });

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'search_product_v2',
      expect.objectContaining({
        brand: 'Brand A',
        company: 'rgc (Demo)',
        in_stock_only: 1,
        item_group: 'Products',
        item_context: 'purchase',
        search_key: 'Camera',
        warehouse: 'Stores - RD',
      }),
    );
    expect(result.items[0]).toMatchObject({
      isPurchaseItem: true,
      isSalesItem: false,
      itemCode: 'SKU-1',
      nickname: 'Camera Alias',
    });
  });

  it('maps product detail barcodes', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        barcode: 'BAR-001',
        barcodes: [
          { barcode: 'BAR-001', idx: 1, is_primary: 1, name: 'ROW-1' },
          { barcode: 'BAR-002', idx: 2, is_primary: 0, name: 'ROW-2' },
        ],
        item_code: 'SKU-1',
        item_name: 'Camera',
        stock_uom: 'Nos',
      },
      meta: {},
      raw: {},
    });

    const result = await getProductDetail('SKU-1');

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'get_product_detail_v2',
      { item_code: 'SKU-1' },
    );
    expect(result?.barcodes).toEqual([
      { barcode: 'BAR-001', idx: 1, isPrimary: true, name: 'ROW-1' },
      { barcode: 'BAR-002', idx: 2, isPrimary: false, name: 'ROW-2' },
    ]);
  });

  it('maps inventory stock summary rows', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        rows: [
          {
            actual_qty: '4',
            company: 'rgc (Demo)',
            item_code: 'SKU-1',
            item_name: 'Camera',
            projected_qty: '6',
            reserved_qty: '1',
            stock_uom: 'Nos',
            stock_value: '80',
            valuation_rate: '20',
            warehouse: 'Stores - RD',
          },
        ],
        summary: {
          actual_qty_total: '4',
          negative_count: 0,
          out_of_stock_count: 0,
          projected_qty_total: '6',
          reserved_qty_total: '1',
          stock_value_total: '80',
        },
        pagination: { has_more: false, total_count: 1 },
      },
      meta: {},
      raw: {},
    });

    const result = await listInventoryStockSummary({
      company: 'rgc (Demo)',
      lowStockThreshold: 5,
      stockStatus: 'low_stock',
    });

    expect(result.items[0]).toMatchObject({
      actualQty: 4,
      itemCode: 'SKU-1',
      projectedQty: 6,
      reservedQty: 1,
      stockValue: 80,
      valuationRate: 20,
      warehouse: 'Stores - RD',
    });
    expect(result.summary.actualQtyTotal).toBe(4);
    expect(result.total).toBe(1);
    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'list_inventory_stock_summary_v1',
      {
        company: 'rgc (Demo)',
        low_stock_threshold: 5,
        page: 1,
        page_size: 20,
        stock_status: 'low_stock',
      },
    );
  });

  it('runs inventory stock adjustment through inventory reconciliation gateway', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        conversion_factor: 6,
        input_qty: 2,
        input_uom: 'Box',
        item_code: 'SKU-1',
        item_name: '测试商品',
        stock_entry: 'MAT-STE-0001',
        stock_uom: 'Nos',
        target_stock_qty: 12,
      },
      meta: {},
      raw: {},
    });

    await adjustInventoryStock({
      company: 'rgc (Demo)',
      itemCode: 'SKU-1',
      postingDate: '2026-06-15',
      remarks: 'cycle count',
      targetQty: 12,
      uom: 'Box',
      valuationRate: 8.5,
      warehouse: 'Stores - RD',
    });

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'reconcile_inventory_stock_v1',
      {
        item_code: 'SKU-1',
        posting_date: '2026-06-15',
        remarks: 'cycle count',
        target_qty: 12,
        uom: 'Box',
        valuation_rate: 8.5,
        warehouse: 'Stores - RD',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
  });

  it('runs inventory transfer through inventory transfer gateway', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        conversion_factor: 6,
        input_qty: 1,
        input_uom: 'Box',
        item_code: 'SKU-1',
        item_name: '测试商品',
        source_warehouse: 'Stores - RD',
        stock_entry: 'MAT-STE-0002',
        stock_qty: 6,
        stock_uom: 'Nos',
        target_warehouse: 'Transit - RD',
      },
      meta: {},
      raw: {},
    });

    await transferInventoryStock({
      itemCode: 'SKU-1',
      postingDate: '2026-06-16',
      qty: 1,
      remarks: 'move to transit',
      sourceWarehouse: 'Stores - RD',
      targetWarehouse: 'Transit - RD',
      uom: 'Box',
    });

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'transfer_inventory_stock_v1',
      {
        item_code: 'SKU-1',
        posting_date: '2026-06-16',
        qty: 1,
        remarks: 'move to transit',
        source_warehouse: 'Stores - RD',
        target_warehouse: 'Transit - RD',
        uom: 'Box',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
  });

  it('maps print preview and file metadata', async () => {
    mockedCallGatewayMethod
      .mockResolvedValueOnce({
        data: {
          available_templates: [
            {
              is_default: true,
              key: 'standard',
              label: '标准模板',
              print_format: 'myapp Sales Order Standard',
              source: 'managed',
            },
          ],
          docname: 'SO-0001',
          doctype: 'Sales Order',
          html: '<html>ok</html>',
          mime_type: 'text/html',
          output: 'html',
          template: {
            is_default: true,
            key: 'standard',
            label: '标准模板',
            print_format: 'myapp Sales Order Standard',
            source: 'managed',
          },
          title: 'Sales Order SO-0001',
        },
      })
      .mockResolvedValueOnce({
        data: {
          available_templates: [],
          docname: 'SO-0001',
          doctype: 'Sales Order',
          filename: 'SO-0001.pdf',
          file_size: 2048,
          mime_type: 'application/pdf',
          template: {
            key: 'standard',
            label: '标准模板',
          },
          title: 'Sales Order SO-0001',
        },
      });

    const preview = await fetchPrintPreview({
      docname: 'SO-0001',
      doctype: 'Sales Order',
    });
    const file = await fetchPrintFile({
      docname: 'SO-0001',
      doctype: 'Sales Order',
    });

    expect(preview.html).toBe('<html>ok</html>');
    expect(preview.template.printFormat).toBe('myapp Sales Order Standard');
    expect(preview.availableTemplates[0].isDefault).toBe(true);
    expect(file.filename).toBe('SO-0001.pdf');
    expect(file.fileSize).toBe(2048);
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      1,
      'get_print_preview_v1',
      {
        doctype: 'Sales Order',
        docname: 'SO-0001',
        output: 'html',
      },
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      2,
      'get_print_file_v1',
      {
        archive: 0,
        doctype: 'Sales Order',
        docname: 'SO-0001',
      },
    );
  });

  it('runs item image mutations through gateway', async () => {
    mockedCallGatewayMethod
      .mockResolvedValueOnce({
        data: {
          attached_to_doctype: null,
          attached_to_name: null,
          file_id: 'FILE-001',
          file_name: 'item.png',
          file_url: '/files/item.png',
          is_private: 0,
          storage_provider: 'frappe',
        },
      })
      .mockResolvedValueOnce({
        data: {
          attached_to_doctype: 'Item',
          attached_to_name: 'ITEM-001',
          file_id: 'FILE-002',
          file_name: 'item-new.png',
          file_url: '/files/item-new.png',
          is_private: 0,
          storage_provider: 'frappe',
        },
      })
      .mockResolvedValueOnce({
        data: {
          deleted: true,
          item_code: 'ITEM-001',
          previous_file_url: '/files/item-new.png',
          reason: null,
        },
      });

    const uploaded = await uploadItemImage({
      contentType: 'image/png',
      fileContentBase64: 'abc123',
      filename: 'item.png',
    });
    const replaced = await replaceItemImage({
      contentType: 'image/png',
      fileContentBase64: 'def456',
      filename: 'item-new.png',
      itemCode: 'ITEM-001',
    });
    const deleted = await deleteItemImage('ITEM-001');

    expect(uploaded).toMatchObject({
      fileId: 'FILE-001',
      fileUrl: '/files/item.png',
      previewUrl: 'http://api.example.test/files/item.png',
    });
    expect(replaced.attachedToName).toBe('ITEM-001');
    expect(deleted.deleted).toBe(true);
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      1,
      'upload_item_image',
      {
        content_type: 'image/png',
        file_content_base64: 'abc123',
        filename: 'item.png',
        is_private: 0,
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      2,
      'replace_item_image',
      {
        content_type: 'image/png',
        file_content_base64: 'def456',
        filename: 'item-new.png',
        is_private: 0,
        item_code: 'ITEM-001',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      3,
      'delete_item_image',
      { item_code: 'ITEM-001' },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
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
            uom_display: '件',
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
      items: [
        {
          detailId: 'SII-0001',
          detailSubmitKey: 'sales_invoice_item',
          uomDisplay: '件',
        },
      ],
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

  it('maps purchase return source context', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        actions: { can_process_return: true, supports_partial_return: true },
        amounts: { outstanding_amount: 0, primary_amount: 88 },
        document_status: 'submitted',
        items: [
          {
            amount: 88,
            default_return_qty: 2,
            detail_id: 'PRI-0001',
            detail_submit_key: 'purchase_receipt_item',
            item_code: 'SKU-1',
            item_name: 'Camera',
            max_returnable_qty: 2,
            rate: 44,
            source_qty: 2,
            uom: 'Nos',
            uom_display: '件',
            warehouse: 'Stores - RD',
          },
        ],
        meta: { company: 'rgc (Demo)', currency: 'CNY' },
        party: { display_name: 'Supplier A', party_name: 'SUP-0001' },
        source_doctype: 'Purchase Receipt',
        source_label: '采购收货单',
        source_name: 'PREC-0001',
      },
      meta: {},
      raw: {},
    });

    const context = await getPurchaseReturnSourceContext(
      'Purchase Receipt',
      'PREC-0001',
    );

    expect(context).toMatchObject({
      canProcessReturn: true,
      company: 'rgc (Demo)',
      items: [
        {
          detailId: 'PRI-0001',
          detailSubmitKey: 'purchase_receipt_item',
          maxReturnableQty: 2,
          uomDisplay: '件',
        },
      ],
      partyDisplayName: 'Supplier A',
      primaryAmount: 88,
      sourceDoctype: 'Purchase Receipt',
    });
    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'get_return_source_context_v2',
      {
        source_doctype: 'Purchase Receipt',
        source_name: 'PREC-0001',
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
        filters: {},
        limit: 20,
        query: 'Ca',
      },
    );
  });

  it('passes whitelisted link option filters', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: [{ description: 'rgc (Demo)', label: 'Stores - RD', value: 'Stores - RD' }],
      meta: {},
      raw: {},
    });

    await searchLinkOptions('Warehouse', '', ['company'], 20, {
      company: 'rgc (Demo)',
    });

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'search_link_options_v1',
      {
        doctype: 'Warehouse',
        extra_fields: ['company'],
        filters: { company: 'rgc (Demo)' },
        limit: 20,
      },
    );
  });

  it('maps workspace preferences and updates them through gateway', async () => {
    mockedCallGatewayMethod
      .mockResolvedValueOnce({
        data: {
          default_company: 'rgc (Demo)',
          default_warehouse: 'Stores - RD',
          user: 'demo@example.com',
        },
      })
      .mockResolvedValueOnce({
        data: {
          default_company: 'rgc (Demo)',
          default_warehouse: 'Stores - RD',
          user: 'demo@example.com',
        },
      });

    const preferences = await getCurrentUserWorkspacePreferences();
    const updated = await updateCurrentUserWorkspacePreferences({
      defaultCompany: 'rgc (Demo)',
      defaultWarehouse: 'Stores - RD',
    });

    expect(preferences).toEqual({
      defaultCompany: 'rgc (Demo)',
      defaultWarehouse: 'Stores - RD',
      user: 'demo@example.com',
    });
    expect(updated.data.defaultWarehouse).toBe('Stores - RD');
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      1,
      'get_current_user_workspace_preferences_v1',
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      2,
      'update_current_user_workspace_preferences_v1',
      {
        default_company: 'rgc (Demo)',
        default_warehouse: 'Stores - RD',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
  });

  it('maps uom rows using backend enabled display fields', async () => {
    mockedCallGatewayMethod.mockResolvedValueOnce({
      data: {
        data: [
          {
            description: '整箱包装单位',
            display_name: '箱',
            enabled: '1',
            must_be_whole_number: '0',
            name: 'Box',
            symbol: '箱',
            uom_name: 'Box',
          },
        ],
        pagination: { has_more: false, total_count: 1 },
      },
      meta: {},
      raw: {},
    });

    const result = await listUoms({ enabled: 1, searchKey: 'Box' });

    expect(result.items[0]).toMatchObject({
      description: '整箱包装单位',
      disabled: false,
      displayName: '箱',
      enabled: true,
      mustBeWholeNumber: false,
      name: 'Box',
      symbol: '箱',
      uomName: 'Box',
    });
    expect(mockedCallGatewayMethod).toHaveBeenCalledWith('list_uoms_v2', {
      enabled: 1,
      limit: 80,
      search_key: 'Box',
      start: 0,
    });
  });

  it('runs uom mutations through gateway with enabled fields', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: { display_name: '箱', enabled: 1, name: 'Box', uom_name: 'Box' },
    });

    await createUom({
      description: '整箱包装单位',
      enabled: true,
      mustBeWholeNumber: true,
      symbol: '箱',
      uomName: 'Box',
    });
    await updateUom('Box', {
      description: '',
      enabled: false,
      mustBeWholeNumber: false,
      symbol: '',
    });
    await setUomDisabled('Box', true);

    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      1,
      'create_uom_v2',
      {
        description: '整箱包装单位',
        enabled: 1,
        must_be_whole_number: 1,
        symbol: '箱',
        uom_name: 'Box',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      2,
      'update_uom_v2',
      {
        description: '',
        enabled: 0,
        must_be_whole_number: 0,
        symbol: '',
        uom: 'Box',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      3,
      'disable_uom_v2',
      { disabled: 1, uom: 'Box' },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
  });

  it('maps warehouse list rows and runs warehouse mutations through gateway', async () => {
    mockedCallGatewayMethod
      .mockResolvedValueOnce({
        data: [
          {
            account: 'Stock In Hand - RD',
            address_line_1: 'A1',
            city: 'Shanghai',
            company: 'rgc (Demo)',
            customer: 'CUST-0001',
            default_in_transit_warehouse: 'Transit - RD',
            disabled: 0,
            email_id: 'store@example.test',
            is_group: 0,
            is_rejected_warehouse: 1,
            modified: '2026-06-30 10:00:00',
            mobile_no: '13800000000',
            name: 'Stores - RD',
            parent_warehouse: 'All Warehouses - RD',
            phone_no: '021-12345678',
            warehouse_type: 'Stores',
            warehouse_name: 'Stores',
          },
        ],
        meta: { total_count: 1 },
      })
      .mockResolvedValue({
        data: {
          company: 'rgc (Demo)',
          disabled: 0,
          is_group: 0,
          name: 'Stores - RD',
          warehouse_name: 'Stores',
        },
      });

    const result = await listWarehouses({
      company: 'rgc (Demo)',
      disabled: 0,
      isGroup: 0,
      limit: 20,
      searchKey: 'Stores',
      start: 0,
    });
    await createWarehouse({
      account: 'Stock In Hand - RD',
      addressLine1: 'A1',
      city: 'Shanghai',
      company: 'rgc (Demo)',
      customer: 'CUST-0001',
      defaultInTransitWarehouse: 'Transit - RD',
      disabled: false,
      emailId: 'store@example.test',
      isGroup: false,
      isRejectedWarehouse: true,
      mobileNo: '13800000000',
      parentWarehouse: 'All Warehouses - RD',
      phoneNo: '021-12345678',
      warehouseType: 'Stores',
      warehouseName: 'Stores',
    });
    await updateWarehouse('Stores - RD', {
      account: '',
      addressLine1: '',
      customer: '',
      defaultInTransitWarehouse: '',
      disabled: false,
      emailId: '',
      isRejectedWarehouse: false,
      mobileNo: '',
      parentWarehouse: '',
      phoneNo: '',
      warehouseName: 'Main Stores',
      warehouseType: '',
    });
    await setWarehouseDisabled('Stores - RD', true);

    expect(result.items[0]).toMatchObject({
      account: 'Stock In Hand - RD',
      addressLine1: 'A1',
      city: 'Shanghai',
      company: 'rgc (Demo)',
      customer: 'CUST-0001',
      defaultInTransitWarehouse: 'Transit - RD',
      disabled: false,
      emailId: 'store@example.test',
      isGroup: false,
      isRejectedWarehouse: true,
      mobileNo: '13800000000',
      name: 'Stores - RD',
      parentWarehouse: 'All Warehouses - RD',
      phoneNo: '021-12345678',
      warehouseType: 'Stores',
      warehouseName: 'Stores',
    });
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      1,
      'list_warehouses_v2',
      {
        company: 'rgc (Demo)',
        disabled: 0,
        is_group: 0,
        limit: 20,
        search_key: 'Stores',
        start: 0,
      },
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      2,
      'create_warehouse_v2',
      {
        account: 'Stock In Hand - RD',
        address_line_1: 'A1',
        city: 'Shanghai',
        company: 'rgc (Demo)',
        customer: 'CUST-0001',
        default_in_transit_warehouse: 'Transit - RD',
        disabled: 0,
        email_id: 'store@example.test',
        is_group: 0,
        is_rejected_warehouse: 1,
        mobile_no: '13800000000',
        parent_warehouse: 'All Warehouses - RD',
        phone_no: '021-12345678',
        warehouse_type: 'Stores',
        warehouse_name: 'Stores',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      3,
      'update_warehouse_v2',
      {
        account: '',
        address_line_1: '',
        customer: '',
        default_in_transit_warehouse: '',
        disabled: 0,
        email_id: '',
        is_rejected_warehouse: 0,
        mobile_no: '',
        parent_warehouse: '',
        phone_no: '',
        warehouse: 'Stores - RD',
        warehouse_name: 'Main Stores',
        warehouse_type: '',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      4,
      'disable_warehouse_v2',
      { disabled: 1, warehouse: 'Stores - RD' },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
  });

  it('runs customer mutations through gateway', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: { customer_name: 'ACME', name: 'ACME' },
    });

    await createCustomer({
      defaultCurrency: 'CNY',
      email: 'buyer@example.test',
      group: 'Commercial',
      mobileNo: '13800000000',
      name: 'ACME',
      remarks: '重点客户',
      type: 'Company',
    });
    await updateCustomer('ACME', {
      defaultCurrency: '',
      disabled: false,
      email: '',
      group: '',
      mobileNo: '',
      name: 'ACME Trading',
      remarks: '',
      type: 'Company',
    });
    await setCustomerDisabled('ACME', true);

    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      1,
      'create_customer_v2',
      {
        customer_group: 'Commercial',
        customer_name: 'ACME',
        customer_type: 'Company',
        contact_email: 'buyer@example.test',
        contact_phone: '13800000000',
        default_currency: 'CNY',
        disabled: 0,
        remarks: '重点客户',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      2,
      'update_customer_v2',
      {
        customer: 'ACME',
        customer_group: '',
        customer_name: 'ACME Trading',
        customer_type: 'Company',
        contact_email: '',
        contact_phone: '',
        default_currency: '',
        disabled: 0,
        remarks: '',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      3,
      'disable_customer_v2',
      { customer: 'ACME', disabled: 1 },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
  });

  it('runs supplier mutations through gateway', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: { name: 'SUP-001', supplier_name: 'Best Supply' },
    });

    await createSupplier({
      defaultCurrency: 'CNY',
      email: 'seller@example.test',
      group: 'All Supplier Groups',
      mobileNo: '13900000000',
      name: 'Best Supply',
      remarks: '常用供应商',
      type: 'Company',
    });
    await updateSupplier('SUP-001', {
      defaultCurrency: '',
      disabled: false,
      email: '',
      group: '',
      mobileNo: '',
      name: 'Best Supply Ltd',
      remarks: '',
      type: 'Company',
    });
    await setSupplierDisabled('SUP-001', false);

    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      1,
      'create_supplier_v2',
      {
        default_currency: 'CNY',
        disabled: 0,
        contact_email: 'seller@example.test',
        contact_phone: '13900000000',
        email_id: 'seller@example.test',
        mobile_no: '13900000000',
        remarks: '常用供应商',
        supplier_group: 'All Supplier Groups',
        supplier_name: 'Best Supply',
        supplier_type: 'Company',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      2,
      'update_supplier_v2',
      {
        default_currency: '',
        disabled: 0,
        contact_email: '',
        contact_phone: '',
        email_id: '',
        mobile_no: '',
        remarks: '',
        supplier: 'SUP-001',
        supplier_group: '',
        supplier_name: 'Best Supply Ltd',
        supplier_type: 'Company',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      3,
      'disable_supplier_v2',
      { disabled: 0, supplier: 'SUP-001' },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
  });

  it('runs product mutations through gateway', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: { item_code: 'ITEM-001', item_name: '新品', stock_uom: 'Nos' },
    });

    await createProduct({
      barcode: 'BAR-001',
      brand: 'Brand A',
      currency: 'CNY',
      description: '商品描述',
      image: '/files/new-item.png',
      itemCode: 'ITEM-001',
      itemGroup: 'All Item Groups',
      itemName: '新品',
      retailDefaultUom: 'Nos',
      retailRate: 14,
      standardBuyingRate: 8,
      standardSellingRate: 12,
      stockUom: 'Nos',
      valuationRate: 7,
      wholesaleDefaultUom: 'Box',
      wholesaleRate: 10,
    });
    await updateProduct('ITEM-001', {
      barcode: '',
      brand: '',
      currency: 'CNY',
      description: '',
      disabled: false,
      itemGroup: '',
      itemName: '新品2',
      retailDefaultUom: 'Nos',
      retailRate: 15,
      standardBuyingRate: 9,
      standardSellingRate: 13,
      stockUom: 'Nos',
      valuationRate: 8,
      wholesaleDefaultUom: 'Box',
      wholesaleRate: 11,
    });
    await setProductDisabled('ITEM-001', true);

    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      1,
      'create_product_v2',
      {
        barcode: 'BAR-001',
        brand: 'Brand A',
        buying_prices: [
          { currency: 'CNY', price_list: 'Standard Buying', rate: 8 },
        ],
        currency: 'CNY',
        description: '商品描述',
        image: '/files/new-item.png',
        item_code: 'ITEM-001',
        item_group: 'All Item Groups',
        item_name: '新品',
        retail_default_uom: 'Nos',
        selling_prices: [
          { currency: 'CNY', price_list: 'Standard Selling', rate: 12 },
          { currency: 'CNY', price_list: 'Wholesale', rate: 10 },
          { currency: 'CNY', price_list: 'Retail', rate: 14 },
        ],
        standard_rate: 12,
        stock_uom: 'Nos',
        uom_conversions: [{ conversion_factor: 1, uom: 'Nos' }],
        valuation_rate: 7,
        wholesale_default_uom: 'Box',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      2,
      'update_product_v2',
      {
        barcode: '',
        brand: '',
        buying_prices: [
          { currency: 'CNY', price_list: 'Standard Buying', rate: 9 },
        ],
        currency: 'CNY',
        description: '',
        disabled: 0,
        item_code: 'ITEM-001',
        item_group: '',
        item_name: '新品2',
        retail_default_uom: 'Nos',
        selling_prices: [
          { currency: 'CNY', price_list: 'Standard Selling', rate: 13 },
          { currency: 'CNY', price_list: 'Wholesale', rate: 11 },
          { currency: 'CNY', price_list: 'Retail', rate: 15 },
        ],
        standard_rate: 13,
        stock_uom: 'Nos',
        uom_conversions: [{ conversion_factor: 1, uom: 'Nos' }],
        valuation_rate: 8,
        wholesale_default_uom: 'Box',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      3,
      'disable_product_v2',
      { disabled: 1, item_code: 'ITEM-001' },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
  });

  it('updates products with partial payloads', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: { item_code: 'ITEM-001', item_name: '新品', stock_uom: 'Nos' },
    });

    await updateProduct('ITEM-001', {
      brand: 'Brand B',
      itemGroup: 'Products',
    });

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'update_product_v2',
      {
        brand: 'Brand B',
        item_code: 'ITEM-001',
        item_group: 'Products',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
  });

  it('runs bulk product updates through existing gateway methods', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: { item_code: 'ITEM-001', item_name: '新品', stock_uom: 'Nos' },
    });

    await bulkUpdateProducts(['ITEM-001', 'ITEM-002'], { brand: 'Brand B' });
    await bulkSetProductsDisabled(['ITEM-001', 'ITEM-002'], true);

    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      1,
      'update_product_v2',
      { brand: 'Brand B', item_code: 'ITEM-001' },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      2,
      'update_product_v2',
      { brand: 'Brand B', item_code: 'ITEM-002' },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      3,
      'disable_product_v2',
      { disabled: 1, item_code: 'ITEM-001' },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      4,
      'disable_product_v2',
      { disabled: 1, item_code: 'ITEM-002' },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
  });

  it('runs product barcode mutations through gateway', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: { item_code: 'ITEM-001', item_name: '新品', stock_uom: 'Nos' },
    });

    await addProductBarcode('ITEM-001', 'BAR-002', { setPrimary: true });
    await setPrimaryProductBarcode('ITEM-001', 'BAR-002');
    await deleteProductBarcode('ITEM-001', 'BAR-002');

    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      1,
      'add_product_barcode_v2',
      { barcode: 'BAR-002', item_code: 'ITEM-001', set_primary: 1 },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      2,
      'set_primary_product_barcode_v2',
      { barcode: 'BAR-002', item_code: 'ITEM-001' },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      3,
      'delete_product_barcode_v2',
      { barcode: 'BAR-002', item_code: 'ITEM-001' },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
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

  it('passes force delivery flag when submitting a sales order delivery', async () => {
    mockedCallGatewayMethod.mockResolvedValue({ data: { name: 'OK' } });

    await submitSalesOrderDelivery('SO-0001', { forceDelivery: true });

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'submit_delivery',
      {
        kwargs: { force_delivery: 1 },
        order_name: 'SO-0001',
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
    await createPurchaseInvoiceFromReceipt('PR-0001', {
      dueDate: '2026-06-10',
      remarks: '收货转发票',
    });
    await recordSupplierPayment('PI-0001', 66, {
      modeOfPayment: 'Bank',
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
    await updatePurchaseOrderV2('PO-0001', {
      remarks: '更新采购备注',
      scheduleDate: '2026-06-08',
      supplierRef: 'SUP-REF-2',
      transactionDate: '2026-06-07',
    });
    await updatePurchaseOrderItemsV2('PO-0001', {
      company: 'rgc (Demo)',
      defaultWarehouse: 'Stores - RD',
      items: [{ itemCode: 'SKU-1', price: 13, qty: 4, uom: 'Nos' }],
      scheduleDate: '2026-06-08',
    });
    await quickCancelPurchaseOrderV2('PO-0001');
    await submitPurchaseReturn({
      postingDate: '2026-06-09',
      remarks: '采购退货',
      returnItems: [{ purchase_receipt_item: 'PRI-0001', qty: 1 }],
      sourceDoctype: 'Purchase Receipt',
      sourceName: 'PREC-0001',
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
      'create_purchase_invoice_from_receipt',
      {
        due_date: '2026-06-10',
        receipt_name: 'PR-0001',
        remarks: '收货转发票',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      4,
      'record_supplier_payment',
      {
        mode_of_payment: 'Bank',
        paid_amount: 66,
        reference_name: 'PI-0001',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      5,
      'cancel_purchase_order_v2',
      { order_name: 'PO-0001' },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      6,
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
      7,
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
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      8,
      'update_purchase_order_v2',
      {
        order_name: 'PO-0001',
        remarks: '更新采购备注',
        schedule_date: '2026-06-08',
        supplier_ref: 'SUP-REF-2',
        transaction_date: '2026-06-07',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      9,
      'update_purchase_order_items_v2',
      {
        company: 'rgc (Demo)',
        default_warehouse: 'Stores - RD',
        items: [{ item_code: 'SKU-1', price: 13, qty: 4, uom: 'Nos' }],
        order_name: 'PO-0001',
        schedule_date: '2026-06-08',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      10,
      'quick_cancel_purchase_order_v2',
      {
        order_name: 'PO-0001',
        rollback_payment: 1,
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      11,
      'process_purchase_return',
      {
        posting_date: '2026-06-09',
        remarks: '采购退货',
        return_items: [{ purchase_receipt_item: 'PRI-0001', qty: 1 }],
        source_doctype: 'Purchase Receipt',
        source_name: 'PREC-0001',
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

  it('records sales payment against a selected sales invoice', async () => {
    mockedCallGatewayMethod.mockResolvedValue({ data: { name: 'PE-0001' } });

    await recordSalesOrderPayment('SI-0001', 88, {
      modeOfPayment: 'Bank',
      referenceDate: '2026-06-20',
      referenceDoctype: 'Sales Invoice',
      referenceNo: 'BANK-001',
      settlementMode: 'writeoff',
      writeoffReason: 'Web 端差额核销结清',
    });

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'update_payment_status',
      {
        mode_of_payment: 'Bank',
        paid_amount: 88,
        reference_date: '2026-06-20',
        reference_doctype: 'Sales Invoice',
        reference_name: 'SI-0001',
        reference_no: 'BANK-001',
        settlement_mode: 'writeoff',
        writeoff_reason: 'Web 端差额核销结清',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
  });

  it('creates customer refund against a return sales invoice', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: {
        mode_of_payment: 'Bank',
        payment_entry: 'PE-REF-0001',
        refundable_amount_before_refund: 100,
        reference_date: '2026-06-21',
        reference_no: 'REF-001',
        refund_amount: 80,
        return_invoice: 'SI-RET-0001',
        source_invoice: 'SI-0001',
      },
    });

    const result = await createCustomerRefund('SI-RET-0001', 80, {
      modeOfPayment: 'Bank',
      referenceDate: '2026-06-21',
      referenceNo: 'REF-001',
      remarks: '客户退货退款',
    });

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'create_customer_refund',
      {
        mode_of_payment: 'Bank',
        reference_date: '2026-06-21',
        reference_no: 'REF-001',
        refund_amount: 80,
        remarks: '客户退货退款',
        return_invoice_name: 'SI-RET-0001',
      },
      expect.objectContaining({ idempotencyKey: 'web-test-key' }),
    );
    expect(result.data.paymentEntry).toBe('PE-REF-0001');
    expect(result.data.returnInvoice).toBe('SI-RET-0001');
  });

  it('loads customer refund context from gateway', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: {
        actions: {
          can_create_refund: true,
          create_refund_hint: '',
        },
        entries: [
          {
            allocated_amount: 60,
            mode_of_payment: 'Bank',
            payment_entry: 'PE-REF-0001',
            posting_date: '2026-06-22',
            reference_no: 'REF-001',
          },
        ],
        refund: {
          currency: 'CNY',
          refundable_amount: 40,
          refunded_amount: 60,
          return_amount: 100,
          status: 'partial_refunded',
          suggested_refund_amount: 40,
        },
        return_invoice: {
          company: 'Test Company',
          currency: 'CNY',
          customer: 'CUST-0001',
          customer_name: 'Test Customer',
          docstatus: 1,
          document_status: 'submitted',
          grand_total: -100,
          is_return: true,
          name: 'SI-RET-0001',
          outstanding_amount: -40,
          return_against: 'SI-0001',
        },
        source_invoice: {
          name: 'SI-0001',
          document_status: 'submitted',
        },
      },
    });

    const result = await getCustomerRefundContext('SI-RET-0001');

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'get_customer_refund_context_v1',
      { return_invoice_name: 'SI-RET-0001' },
    );
    expect(result?.refund.refundableAmount).toBe(40);
    expect(result?.refund.refundedAmount).toBe(60);
    expect(result?.entries[0].paymentEntry).toBe('PE-REF-0001');
    expect(result?.returnInvoice?.name).toBe('SI-RET-0001');
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
