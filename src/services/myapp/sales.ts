import { callGatewayMethod } from './api-client';
import { compactPayload, readObject } from './api-utils';
import { runGatewayMutation } from './mutation';
import type { SalesMode } from '@/utils/sales-order-editor';

export type SalesOrderStatusFilter =
  | 'all'
  | 'unfinished'
  | 'delivering'
  | 'paying'
  | 'completed'
  | 'cancelled';

export type SalesOrderSort =
  | 'unfinished_first'
  | 'latest'
  | 'oldest'
  | 'amount_desc'
  | 'amount_asc';

export type SalesOrderSummary = {
  name: string;
  customer: string;
  company: string;
  transactionDate: string;
  amount: number | null;
  outstandingAmount: number | null;
  documentStatus: string;
  fulfillmentStatus: string;
  paymentStatus: string;
  completionStatus: string;
  modified: string;
};

export type SalesOrderSearchSummary = {
  totalCount: number;
  visibleCount: number;
  unfinishedCount: number;
  deliveryCount: number;
  paymentCount: number;
  completedCount: number;
  cancelledCount: number;
};

export type SearchSalesOrdersParams = {
  company?: string;
  customer?: string;
  dateFrom?: string;
  dateTo?: string;
  excludeCancelled?: boolean;
  limit?: number;
  searchKey?: string;
  sortBy?: SalesOrderSort;
  start?: number;
  statusFilter?: SalesOrderStatusFilter;
};

export type SalesOrderDetail = SalesOrderSummary & {
  canCancelOrder: boolean;
  currency: string;
  deliveryDate: string;
  remarks: string;
  contactDisplay: string;
  contactPhone: string;
  addressDisplay: string;
  paidAmount: number | null;
  receivableAmount: number | null;
  canCreateSalesInvoice: boolean;
  canRecordPayment: boolean;
  canSubmitDelivery: boolean;
  deliveryNotes: string[];
  salesInvoices: string[];
  items: SalesOrderDetailItem[];
};

export type SalesOrderDetailItem = {
  amount: number | null;
  deliveredQty: number | null;
  imageUrl?: string;
  itemCode: string;
  itemName: string;
  qty: number | null;
  rate: number | null;
  salesOrderItem: string;
  uom: string;
  warehouse: string;
};

export type SalesOrderActionItem = {
  itemCode?: string;
  price?: number;
  qty: number;
  salesOrderItem?: string;
};

export type SalesOrderItemInput = {
  itemCode: string;
  price?: number | null;
  qty: number;
  salesMode?: SalesMode;
  uom?: string | null;
  warehouse?: string | null;
};

export type CreateSalesOrderPayload = {
  company: string;
  customer: string;
  customerInfo?: {
    contactDisplayName?: string;
    contactEmail?: string;
    contactPhone?: string;
  };
  defaultSalesMode?: SalesMode;
  deliveryDate?: string;
  forceDelivery?: boolean;
  items: SalesOrderItemInput[];
  remarks?: string;
  shippingInfo?: {
    receiverName?: string;
    receiverPhone?: string;
    shippingAddressName?: string;
    shippingAddressText?: string;
  };
  transactionDate?: string;
};

export type CustomerSalesContext = {
  customer: {
    defaultCurrency: string | null;
    displayName: string;
    name: string;
  };
  defaultAddress: {
    addressDisplay: string | null;
    name: string;
  } | null;
  defaultContact: {
    displayName: string;
    email: string | null;
    name: string;
    phone: string | null;
  } | null;
  suggestions: {
    company: string | null;
    warehouse: string | null;
  };
};

export type DeliveryNoteDetail = {
  addressDisplay: string;
  canCancelDeliveryNote: boolean;
  company: string;
  contactDisplay: string;
  contactPhone: string;
  currency: string;
  documentStatus: string;
  grandTotal: number | null;
  items: SalesOrderDetailItem[];
  name: string;
  postingDate: string;
  postingTime: string;
  remarks: string;
  salesInvoices: string[];
  salesOrders: string[];
  totalQty: number | null;
};

export type SalesInvoiceDetail = {
  addressDisplay: string;
  canCancelSalesInvoice: boolean;
  company: string;
  contactDisplay: string;
  contactPhone: string;
  currency: string;
  deliveryNotes: string[];
  documentStatus: string;
  dueDate: string;
  grandTotal: number | null;
  items: SalesOrderDetailItem[];
  latestPaymentEntry: string;
  name: string;
  outstandingAmount: number | null;
  paidAmount: number | null;
  paymentStatus: string;
  postingDate: string;
  receivableAmount: number | null;
  remarks: string;
  salesOrders: string[];
};

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toStringList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? '')).filter(Boolean)
    : [];
}

function normalizeOptionalText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeSummaryRow(row: Record<string, any>): SalesOrderSummary {
  const fulfillment = row.fulfillment ?? {};
  const payment = row.payment ?? {};
  const completion = row.completion ?? {};

  return {
    name: String(row.order_name ?? row.name ?? ''),
    customer: String(row.customer_name ?? row.customer ?? ''),
    company: String(row.company ?? ''),
    transactionDate: String(row.transaction_date ?? ''),
    amount: toNumber(row.order_amount_estimate ?? row.grand_total),
    outstandingAmount: toNumber(row.outstanding_amount),
    documentStatus: String(row.document_status ?? ''),
    fulfillmentStatus: String(fulfillment.status ?? ''),
    paymentStatus: String(payment.status ?? ''),
    completionStatus: String(completion.status ?? ''),
    modified: String(row.modified ?? ''),
  };
}

function normalizeItems(value: unknown): SalesOrderDetailItem[] {
  return Array.isArray(value)
    ? value.map((item: Record<string, any>) => ({
        amount: toNumber(item.amount),
        deliveredQty: toNumber(item.delivered_qty),
        imageUrl: String(item.image ?? item.image_url ?? item.item_image ?? ''),
        itemCode: String(item.item_code ?? ''),
        itemName: String(item.item_name ?? item.item_code ?? ''),
        qty: toNumber(item.qty),
        rate: toNumber(item.rate),
        salesOrderItem: String(item.sales_order_item ?? item.name ?? ''),
        uom: String(item.uom_display ?? item.uom ?? ''),
        warehouse: String(item.warehouse ?? ''),
      }))
    : [];
}

function normalizeSalesActionItems(items: SalesOrderActionItem[] | undefined) {
  return items
    ?.filter((item) => item.qty > 0)
    .map((item) => ({
      ...(item.itemCode ? { item_code: item.itemCode } : {}),
      ...(item.price !== undefined ? { price: item.price } : {}),
      qty: item.qty,
      ...(item.salesOrderItem
        ? { sales_order_item: item.salesOrderItem }
        : {}),
    }));
}

function normalizeSalesOrderItems(items: SalesOrderItemInput[]) {
  return items
    .filter((item) => item.itemCode && item.qty > 0)
    .map((item) =>
      compactPayload({
        item_code: item.itemCode,
        price: item.price ?? undefined,
        qty: item.qty,
        sales_mode: item.salesMode,
        uom: item.uom ?? undefined,
        warehouse: item.warehouse ?? undefined,
      }),
    );
}

function buildCreateSalesOrderPayload(payload: CreateSalesOrderPayload) {
  return compactPayload({
    company: payload.company,
    customer: payload.customer,
    customer_info: payload.customerInfo
      ? compactPayload({
          contact_display_name: payload.customerInfo.contactDisplayName,
          contact_email: payload.customerInfo.contactEmail,
          contact_phone: payload.customerInfo.contactPhone,
        })
      : undefined,
    default_sales_mode: payload.defaultSalesMode,
    delivery_date: payload.deliveryDate,
    force_delivery: payload.forceDelivery ? 1 : 0,
    items: normalizeSalesOrderItems(payload.items),
    remarks: payload.remarks,
    shipping_info: payload.shippingInfo
      ? compactPayload({
          receiver_name: payload.shippingInfo.receiverName,
          receiver_phone: payload.shippingInfo.receiverPhone,
          shipping_address_name: payload.shippingInfo.shippingAddressName,
          shipping_address_text: payload.shippingInfo.shippingAddressText,
        })
      : undefined,
    transaction_date: payload.transactionDate,
  });
}

function normalizeCustomerSalesContext(
  data: Record<string, any>,
): CustomerSalesContext {
  const customer = data.customer ?? {};
  const defaultContact = data.default_contact;
  const defaultAddress = data.default_address;
  const suggestions = data.suggestions ?? {};

  return {
    customer: {
      defaultCurrency:
        typeof customer.default_currency === 'string'
          ? customer.default_currency
          : null,
      displayName: String(customer.display_name ?? customer.name ?? ''),
      name: String(customer.name ?? ''),
    },
    defaultAddress: defaultAddress
      ? {
          addressDisplay:
            typeof defaultAddress.address_display === 'string'
              ? defaultAddress.address_display
              : null,
          name: String(defaultAddress.name ?? ''),
        }
      : null,
    defaultContact: defaultContact
      ? {
          displayName: String(
            defaultContact.display_name ??
              defaultContact.full_name ??
              defaultContact.name ??
              '',
          ),
          email:
            typeof defaultContact.email === 'string'
              ? defaultContact.email
              : null,
          name: String(defaultContact.name ?? ''),
          phone:
            typeof defaultContact.phone === 'string'
              ? defaultContact.phone
              : typeof defaultContact.mobile_no === 'string'
                ? defaultContact.mobile_no
                : null,
        }
      : null,
    suggestions: {
      company:
        typeof suggestions.company === 'string' ? suggestions.company : null,
      warehouse:
        typeof suggestions.warehouse === 'string'
          ? suggestions.warehouse
          : null,
    },
  };
}

export async function searchSalesOrders(params: SearchSalesOrdersParams = {}) {
  const result = await callGatewayMethod<Record<string, any>>(
    'search_sales_orders_v2',
    {
      search_key: normalizeOptionalText(params.searchKey),
      customer: normalizeOptionalText(params.customer),
      company: normalizeOptionalText(params.company),
      date_from: normalizeOptionalText(params.dateFrom),
      date_to: normalizeOptionalText(params.dateTo),
      status_filter: params.statusFilter ?? 'unfinished',
      exclude_cancelled:
        params.excludeCancelled === undefined
          ? 1
          : params.excludeCancelled
            ? 1
            : 0,
      sort_by: params.sortBy ?? 'unfinished_first',
      limit: params.limit,
      start: params.start,
    },
  );

  const data = result.data ?? {};
  const rows = Array.isArray(data.items) ? data.items : [];
  const pagination = readObject(data.pagination);
  const summary = readObject(data.summary);
  const visibleCount =
    toNumber(pagination.total_count ?? summary.visible_count) ?? rows.length;

  return {
    items: rows.map((row) => normalizeSummaryRow(row)),
    summary: {
      totalCount: Number(summary.total_count ?? 0),
      visibleCount,
      unfinishedCount: Number(summary.unfinished_count ?? 0),
      deliveryCount: Number(summary.delivery_count ?? 0),
      paymentCount: Number(summary.payment_count ?? 0),
      completedCount: Number(summary.completed_count ?? 0),
      cancelledCount: Number(summary.cancelled_count ?? 0),
    } satisfies SalesOrderSearchSummary,
  };
}

export async function getSalesOrderDetail(
  orderName: string,
): Promise<SalesOrderDetail | null> {
  const result = await callGatewayMethod<Record<string, any>>(
    'get_sales_order_detail',
    { order_name: orderName },
  );
  const data = result.data;

  if (!data || typeof data !== 'object') {
    return null;
  }

  const summary = normalizeSummaryRow({
    ...data,
    order_name: data.order_name,
    customer: data.customer?.name,
    customer_name: data.customer?.display_name,
    company: data.meta?.company,
    transaction_date: data.meta?.transaction_date,
    order_amount_estimate: data.amounts?.order_amount_estimate,
    outstanding_amount: data.amounts?.outstanding_amount,
  });
  const shipping = data.shipping ?? {};
  const amounts = data.amounts ?? {};
  const actions = data.actions ?? {};
  const references = data.references ?? {};

  return {
    ...summary,
    currency: String(data.meta?.currency ?? 'CNY'),
    deliveryDate: String(data.meta?.delivery_date ?? ''),
    remarks: String(data.meta?.remarks ?? ''),
    contactDisplay: String(
      shipping.contact_display ?? shipping.contact_person ?? '',
    ),
    contactPhone: String(shipping.contact_phone ?? ''),
    addressDisplay: String(shipping.shipping_address_text ?? ''),
    paidAmount: toNumber(amounts.paid_amount),
    receivableAmount: toNumber(amounts.receivable_amount),
    canCancelOrder: Boolean(actions.can_cancel_sales_order),
    canCreateSalesInvoice: Boolean(actions.can_create_sales_invoice),
    canRecordPayment: Boolean(actions.can_record_payment),
    canSubmitDelivery: Boolean(actions.can_submit_delivery),
    deliveryNotes: toStringList(references.delivery_notes),
    salesInvoices: toStringList(references.sales_invoices),
    items: normalizeItems(data.items),
  };
}

export async function getCustomerSalesContext(customer: string) {
  const result = await callGatewayMethod<Record<string, any>>(
    'get_customer_sales_context',
    { customer },
  );
  return normalizeCustomerSalesContext(readObject(result.data));
}

export async function createSalesOrderV2(payload: CreateSalesOrderPayload) {
  return runGatewayMutation<{ order?: string }>('create_order_v2', {
    payload: buildCreateSalesOrderPayload(payload),
    successMessage: '销售订单已创建',
  });
}

export async function quickCreateSalesOrderV2(payload: CreateSalesOrderPayload) {
  return runGatewayMutation<{
    delivery_note?: string;
    force_delivery?: boolean;
    order?: string;
    sales_invoice?: string;
  }>('quick_create_order_v2', {
    payload: buildCreateSalesOrderPayload(payload),
    successMessage: '销售订单已快捷创建',
  });
}

export async function getDeliveryNoteDetail(
  deliveryNoteName: string,
): Promise<DeliveryNoteDetail | null> {
  const result = await callGatewayMethod<Record<string, any>>(
    'get_delivery_note_detail_v2',
    { delivery_note_name: deliveryNoteName },
  );
  const data = result.data;

  if (!data || typeof data !== 'object') {
    return null;
  }

  const shipping = data.shipping ?? {};
  const meta = data.meta ?? {};
  const amounts = data.amounts ?? {};
  const fulfillment = data.fulfillment ?? {};
  const actions = data.actions ?? {};
  const references = data.references ?? {};

  return {
    addressDisplay: String(shipping.shipping_address_text ?? ''),
    canCancelDeliveryNote: Boolean(actions.can_cancel_delivery_note),
    company: String(meta.company ?? ''),
    contactDisplay: String(
      shipping.contact_display ?? shipping.contact_person ?? '',
    ),
    contactPhone: String(shipping.contact_phone ?? ''),
    currency: String(meta.currency ?? 'CNY'),
    documentStatus: String(data.document_status ?? ''),
    grandTotal: toNumber(amounts.delivery_amount_estimate),
    items: normalizeItems(data.items),
    name: String(data.delivery_note_name ?? deliveryNoteName),
    postingDate: String(meta.posting_date ?? ''),
    postingTime: String(meta.posting_time ?? ''),
    remarks: String(meta.remarks ?? ''),
    salesInvoices: toStringList(references.sales_invoices),
    salesOrders: toStringList(references.sales_orders),
    totalQty: toNumber(fulfillment.total_qty),
  };
}

export async function getSalesInvoiceDetail(
  salesInvoiceName: string,
): Promise<SalesInvoiceDetail | null> {
  const result = await callGatewayMethod<Record<string, any>>(
    'get_sales_invoice_detail_v2',
    { sales_invoice_name: salesInvoiceName },
  );
  const data = result.data;

  if (!data || typeof data !== 'object') {
    return null;
  }

  const shipping = data.shipping ?? {};
  const meta = data.meta ?? {};
  const amounts = data.amounts ?? {};
  const payment = data.payment ?? {};
  const actions = data.actions ?? {};
  const references = data.references ?? {};

  return {
    addressDisplay: String(shipping.shipping_address_text ?? ''),
    canCancelSalesInvoice: Boolean(actions.can_cancel_sales_invoice),
    company: String(meta.company ?? ''),
    contactDisplay: String(
      shipping.contact_display ?? shipping.contact_person ?? '',
    ),
    contactPhone: String(shipping.contact_phone ?? ''),
    currency: String(meta.currency ?? 'CNY'),
    deliveryNotes: toStringList(references.delivery_notes),
    documentStatus: String(data.document_status ?? ''),
    dueDate: String(meta.due_date ?? ''),
    grandTotal: toNumber(amounts.invoice_amount_estimate),
    items: normalizeItems(data.items),
    latestPaymentEntry: String(
      payment.latest_payment_entry ?? references.latest_payment_entry ?? '',
    ),
    name: String(data.sales_invoice_name ?? salesInvoiceName),
    outstandingAmount: toNumber(amounts.outstanding_amount),
    paidAmount: toNumber(amounts.paid_amount),
    paymentStatus: String(payment.status ?? ''),
    postingDate: String(meta.posting_date ?? ''),
    receivableAmount: toNumber(amounts.receivable_amount),
    remarks: String(meta.remarks ?? ''),
    salesOrders: toStringList(references.sales_orders),
  };
}

export async function submitSalesOrderDelivery(
  orderName: string,
  options: {
    deliveryItems?: SalesOrderActionItem[];
    postingDate?: string;
    remarks?: string;
  } = {},
) {
  const deliveryItems = normalizeSalesActionItems(options.deliveryItems);
  const postingDate = options.postingDate?.trim();
  const remarks = options.remarks?.trim();

  return runGatewayMutation('submit_delivery', {
    payload: {
      ...(deliveryItems?.length ? { delivery_items: deliveryItems } : {}),
      ...(postingDate || remarks
        ? {
            kwargs: {
              ...(postingDate ? { posting_date: postingDate } : {}),
              ...(remarks ? { remarks } : {}),
            },
          }
        : {}),
      order_name: orderName,
    },
    successMessage: '销售发货单已创建',
  });
}

export async function createSalesOrderInvoice(
  orderName: string,
  options: { invoiceItems?: SalesOrderActionItem[]; remarks?: string } = {},
) {
  const invoiceItems = normalizeSalesActionItems(options.invoiceItems);
  const remarks = options.remarks?.trim();

  return runGatewayMutation('create_sales_invoice', {
    payload: {
      ...(invoiceItems?.length ? { invoice_items: invoiceItems } : {}),
      ...(remarks ? { kwargs: { remarks } } : {}),
      source_name: orderName,
    },
    successMessage: '销售发票已创建',
  });
}

export async function recordSalesOrderPayment(
  orderName: string,
  paidAmount: number,
  options: { modeOfPayment?: string } = {},
) {
  const modeOfPayment = options.modeOfPayment?.trim();

  return runGatewayMutation('update_payment_status', {
    payload: {
      ...(modeOfPayment ? { mode_of_payment: modeOfPayment } : {}),
      paid_amount: paidAmount,
      reference_doctype: 'Sales Order',
      reference_name: orderName,
    },
    successMessage: '销售收款已记录',
  });
}

export async function cancelSalesOrder(orderName: string) {
  return runGatewayMutation('cancel_order_v2', {
    payload: { order_name: orderName },
    successMessage: '销售订单已取消',
  });
}

export async function cancelDeliveryNote(deliveryNoteName: string) {
  return runGatewayMutation('cancel_delivery_note', {
    payload: { delivery_note_name: deliveryNoteName },
    successMessage: '销售发货单已取消',
  });
}

export async function cancelSalesInvoice(salesInvoiceName: string) {
  return runGatewayMutation('cancel_sales_invoice', {
    payload: { sales_invoice_name: salesInvoiceName },
    successMessage: '销售发票已取消',
  });
}

export async function cancelSalesPaymentEntry(paymentEntryName: string) {
  return runGatewayMutation('cancel_payment_entry', {
    payload: { payment_entry_name: paymentEntryName },
    successMessage: '销售收款已取消',
  });
}
