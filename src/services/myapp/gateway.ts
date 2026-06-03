import { callGatewayMethod } from './api-client';

export type PaginationParams = {
  page?: number;
  page_size?: number;
};

export type DateRangeParams = {
  from_date?: string;
  to_date?: string;
};

export type CompanyFilterParams = {
  company?: string;
};

export type SearchTextParams = {
  query?: string;
  search_key?: string;
};

export type SalesOrderSearchParams = PaginationParams &
  DateRangeParams &
  CompanyFilterParams & {
    customer?: string;
    delivery_status?: string;
    invoice_status?: string;
    status?: string;
  };

export type PurchaseOrderSearchParams = PaginationParams &
  DateRangeParams &
  CompanyFilterParams & {
    invoice_status?: string;
    receipt_status?: string;
    status?: string;
    supplier?: string;
  };

export type CashflowEntryParams = PaginationParams &
  DateRangeParams &
  CompanyFilterParams & {
    payment_type?: 'Receive' | 'Pay' | 'Internal Transfer' | string;
    party?: string;
    party_type?: string;
  };

export type MasterListParams = PaginationParams &
  SearchTextParams & {
    disabled?: 0 | 1 | boolean;
  };

export async function getBusinessReportOverview(params?: DateRangeParams & CompanyFilterParams) {
  return callGatewayMethod('get_business_report_overview_v1', params);
}

export async function getSalesReport(params?: DateRangeParams & CompanyFilterParams) {
  return callGatewayMethod('get_sales_report_v1', params);
}

export async function getPurchaseReport(params?: DateRangeParams & CompanyFilterParams) {
  return callGatewayMethod('get_purchase_report_v1', params);
}

export async function getReceivablePayableReport(
  params?: DateRangeParams & CompanyFilterParams,
) {
  return callGatewayMethod('get_receivable_payable_report_v1', params);
}

export async function getCashflowReport(params?: DateRangeParams & CompanyFilterParams) {
  return callGatewayMethod('get_cashflow_report_v1', params);
}

export async function listCashflowEntries(params?: CashflowEntryParams) {
  return callGatewayMethod('list_cashflow_entries_v1', params);
}

export async function searchSalesOrders(params?: SalesOrderSearchParams) {
  return callGatewayMethod('search_sales_orders_v2', params);
}

export async function getSalesOrderDetail(name: string) {
  return callGatewayMethod('get_sales_order_detail', { name });
}

export async function getSalesOrderStatusSummary(name: string) {
  return callGatewayMethod('get_sales_order_status_summary', { name });
}

export async function getDeliveryNoteDetail(name: string) {
  return callGatewayMethod('get_delivery_note_detail_v2', { name });
}

export async function getSalesInvoiceDetail(name: string) {
  return callGatewayMethod('get_sales_invoice_detail_v2', { name });
}

export async function searchPurchaseOrders(params?: PurchaseOrderSearchParams) {
  return callGatewayMethod('search_purchase_orders_v2', params);
}

export async function getPurchaseOrderDetail(name: string) {
  return callGatewayMethod('get_purchase_order_detail_v2', { name });
}

export async function getPurchaseOrderStatusSummary(name: string) {
  return callGatewayMethod('get_purchase_order_status_summary', { name });
}

export async function getPurchaseReceiptDetail(name: string) {
  return callGatewayMethod('get_purchase_receipt_detail_v2', { name });
}

export async function getPurchaseInvoiceDetail(name: string) {
  return callGatewayMethod('get_purchase_invoice_detail_v2', { name });
}

export async function listProducts(params?: MasterListParams & CompanyFilterParams) {
  return callGatewayMethod('list_products_v2', params);
}

export async function getProductDetail(itemCode: string, params?: CompanyFilterParams) {
  return callGatewayMethod('get_product_detail_v2', {
    ...params,
    item_code: itemCode,
  });
}

export async function listCustomers(params?: MasterListParams) {
  return callGatewayMethod('list_customers_v2', params);
}

export async function getCustomerDetail(customer: string) {
  return callGatewayMethod('get_customer_detail_v2', { customer });
}

export async function listSuppliers(params?: MasterListParams) {
  return callGatewayMethod('list_suppliers_v2', params);
}

export async function getSupplierDetail(supplier: string) {
  return callGatewayMethod('get_supplier_detail_v2', { supplier });
}

export async function listUoms(params?: MasterListParams) {
  return callGatewayMethod('list_uoms_v2', params);
}

