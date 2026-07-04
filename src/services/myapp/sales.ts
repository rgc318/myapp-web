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
  | 'order_date_desc'
  | 'oldest'
  | 'amount_desc'
  | 'amount_asc';

export type SalesOrderRiskFilter =
  | 'all'
  | 'delivery_overdue'
  | 'payment_overdue';

export type SalesOrderSummary = {
  canCancelOrder: boolean;
  canCreateSalesInvoice: boolean;
  canRecordPayment: boolean;
  canSubmitDelivery: boolean;
  name: string;
  customer: string;
  company: string;
  transactionDate: string;
  deliveryDate: string;
  amount: number | null;
  outstandingAmount: number | null;
  documentStatus: string;
  fulfillmentStatus: string;
  paymentStatus: string;
  completionStatus: string;
  isDeliveryOverdue: boolean;
  deliveryOverdueDays: number;
  isPaymentOverdue: boolean;
  paymentOverdueDays: number;
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
  deliveryOverdueCount: number;
  paymentOverdueCount: number;
};

export type SearchSalesOrdersParams = {
  company?: string;
  customer?: string;
  dateFrom?: string;
  dateTo?: string;
  excludeCancelled?: boolean;
  limit?: number;
  searchKey?: string;
  riskFilter?: SalesOrderRiskFilter;
  sortBy?: SalesOrderSort;
  start?: number;
  statusFilter?: SalesOrderStatusFilter;
};

export type ExportSalesOrdersResult = {
  content: string;
  exportedCount: number;
  filename: string;
  limit: number;
  mimeType: string;
  truncated: boolean;
};

export type SalesOrderDetail = SalesOrderSummary & {
  canCancelOrder: boolean;
  cancelSalesOrderHint: string;
  currency: string;
  defaultSalesMode: SalesMode;
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
  timeline: SalesOrderTimelineEvent[];
  items: SalesOrderDetailItem[];
};

export function salesOrderEditDisabledReason(detail: SalesOrderDetail | null) {
  if (!detail) {
    return '未能加载销售订单，不能编辑';
  }
  if (detail.documentStatus === 'cancelled') {
    return '订单已作废，不能编辑';
  }
  if (detail.documentStatus !== 'submitted') {
    return '只有已提交且未进入下游流程的销售订单才能编辑';
  }
  if (detail.completionStatus === 'completed') {
    return '订单已完成并结清，不能直接编辑；如需改错，请先按回退流程处理下游单据';
  }
  if (detail.paymentStatus === 'paid') {
    return '订单已结清，不能直接编辑；如需改错，请先取消客户收款并回退下游单据';
  }
  if (detail.salesInvoices.length) {
    return '订单已存在销售发票，不能直接编辑；请先作废销售发票后再回退修改';
  }
  if (detail.deliveryNotes.length) {
    return '订单已存在销售发货单，不能直接编辑；请先作废发货单后再回退修改';
  }
  return '';
}

export type SalesOrderTimelineEvent = {
  amount: number | null;
  date: string;
  description: string;
  docname: string;
  doctype: string;
  key: string;
  modeOfPayment: string;
  outstandingAmount: number | null;
  referenceNo: string;
  relatedDocname: string;
  relatedDoctype: string;
  status: string;
  title: string;
  type: string;
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
  salesMode: SalesMode;
  specification: string;
  uom: string;
  uomDisplay: string | null;
  warehouse: string;
};

export type SalesOrderActionItem = {
  itemCode?: string;
  price?: number;
  qty: number;
  salesOrderItem?: string;
};

export type QuickCancelSalesOrderResult = {
  cancelledDeliveryNote: string;
  cancelledPaymentEntries: string[];
  cancelledRefundEntries: string[];
  cancelledReturnInvoices: string[];
  cancelledSalesInvoice: string;
  completedSteps: string[];
  orderName: string;
};

export type SalesReturnSourceDoctype = 'Delivery Note' | 'Sales Invoice';

export type SalesReturnSourceContextItem = {
  amount: number | null;
  defaultReturnQty: number | null;
  detailId: string;
  detailSubmitKey: string;
  itemCode: string;
  itemName: string;
  maxReturnableQty: number | null;
  rate: number | null;
  returnedQty: number | null;
  sourceQty: number | null;
  specification: string;
  uom: string;
  uomDisplay: string | null;
  warehouse: string;
};

export type SalesReturnSourceContext = {
  canProcessReturn: boolean;
  company: string;
  currency: string;
  documentStatus: string;
  outstandingAmount: number | null;
  partyDisplayName: string;
  partyName: string;
  postingDate: string;
  primaryAmount: number | null;
  sourceDoctype: SalesReturnSourceDoctype;
  sourceLabel: string;
  sourceName: string;
  supportsPartialReturn: boolean;
  items: SalesReturnSourceContextItem[];
};

export type SalesReturnSubmissionResult = {
  businessType: string;
  documentStatus: string;
  message: string;
  nextActions: {
    canBackToSource: boolean;
    canViewReturnDocument: boolean;
    suggestedNextAction: string;
  };
  references: Record<string, string[]>;
  returnDocument: string;
  returnDoctype: SalesReturnSourceDoctype;
  sourceDoctype: SalesReturnSourceDoctype;
  sourceName: string;
  summary: {
    isPartialReturn: boolean;
    itemCount: number;
    returnAmountEstimate: number | null;
    totalQty: number | null;
  };
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
  cancelDeliveryNoteHint: string;
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
  actualPaidAmount: number | null;
  canCancelSalesInvoice: boolean;
  canRecordPayment: boolean;
  cancelSalesInvoiceHint: string;
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
  latestUnallocatedAmount: number | null;
  name: string;
  outstandingAmount: number | null;
  paidAmount: number | null;
  paymentEntries: SalesInvoicePaymentEntry[];
  paymentStatus: string;
  postingDate: string;
  receivableAmount: number | null;
  remarks: string;
  returnInvoices: string[];
  recordPaymentHint: string;
  salesOrders: string[];
  totalWriteoffAmount: number | null;
};

export type SalesInvoicePaymentEntry = {
  actualPaidAmount: number | null;
  allocatedAmount: number | null;
  latestUnallocatedAmount: number | null;
  modeOfPayment: string;
  paymentEntry: string;
  postingDate: string;
  referenceDate: string;
  referenceNo: string;
  writeoffAmount: number | null;
};

export type CustomerRefundResult = {
  modeOfPayment: string;
  paymentEntry: string;
  refundableAmountBeforeRefund: number | null;
  referenceDate: string;
  referenceNo: string;
  refundAmount: number | null;
  returnInvoice: string;
  sourceInvoice: string;
};

export type CustomerRefundInvoiceSnapshot = {
  company: string;
  currency: string;
  customer: string;
  customerName: string;
  docstatus: number;
  documentStatus: string;
  grandTotal: number | null;
  isReturn: boolean;
  name: string;
  outstandingAmount: number | null;
  postingDate: string;
  returnAgainst: string;
};

export type CustomerRefundContext = {
  actions: {
    canCreateRefund: boolean;
    createRefundHint: string;
  };
  entries: SalesInvoicePaymentEntry[];
  refund: {
    currency: string;
    refundableAmount: number | null;
    refundedAmount: number | null;
    returnAmount: number | null;
    status: string;
    suggestedRefundAmount: number | null;
  };
  returnInvoice: CustomerRefundInvoiceSnapshot | null;
  sourceInvoice: CustomerRefundInvoiceSnapshot | null;
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

function normalizeDocumentText(value: unknown) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(p|div)\b[^>]*>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<\/div\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
      const normalized = String(entity).toLowerCase();
      if (normalized.startsWith('#x')) {
        return String.fromCodePoint(Number.parseInt(normalized.slice(2), 16));
      }
      if (normalized.startsWith('#')) {
        return String.fromCodePoint(Number.parseInt(normalized.slice(1), 10));
      }
      const namedEntities: Record<string, string> = {
        amp: '&',
        apos: "'",
        gt: '>',
        lt: '<',
        nbsp: ' ',
        quot: '"',
      };
      return namedEntities[normalized] ?? match;
    })
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeOptionalText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeSummaryRow(row: Record<string, any>): SalesOrderSummary {
  const fulfillment = row.fulfillment ?? {};
  const payment = row.payment ?? {};
  const completion = row.completion ?? {};
  const actions = row.actions ?? {};
  const risk = row.risk ?? {};

  return {
    canCancelOrder: Boolean(actions.can_cancel_sales_order),
    canCreateSalesInvoice: Boolean(actions.can_create_sales_invoice),
    canRecordPayment: Boolean(actions.can_record_payment),
    canSubmitDelivery: Boolean(actions.can_submit_delivery),
    name: String(row.order_name ?? row.name ?? ''),
    customer: String(row.customer_name ?? row.customer ?? ''),
    company: String(row.company ?? ''),
    transactionDate: String(row.transaction_date ?? ''),
    deliveryDate: String(row.delivery_date ?? ''),
    amount: toNumber(row.order_amount_estimate ?? row.grand_total),
    outstandingAmount: toNumber(row.outstanding_amount),
    documentStatus: String(row.document_status ?? ''),
    fulfillmentStatus: String(fulfillment.status ?? ''),
    paymentStatus: String(payment.status ?? ''),
    completionStatus: String(completion.status ?? ''),
    isDeliveryOverdue: Boolean(risk.is_delivery_overdue),
    deliveryOverdueDays: Number(risk.delivery_overdue_days ?? 0),
    isPaymentOverdue: Boolean(risk.is_payment_overdue),
    paymentOverdueDays: Number(risk.payment_overdue_days ?? 0),
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
        salesMode: item.sales_mode === 'retail' ? 'retail' : 'wholesale',
        specification: String(item.specification ?? ''),
        uom: String(item.uom ?? ''),
        uomDisplay:
          typeof item.uom_display === 'string' ? item.uom_display : null,
        warehouse: String(item.warehouse ?? ''),
      }))
    : [];
}

function normalizeSalesOrderTimeline(value: unknown): SalesOrderTimelineEvent[] {
  return Array.isArray(value)
    ? value
        .map((event) => {
          const row = readObject(event);
          const key = String(
            row.key ?? `${row.type ?? 'event'}:${row.docname ?? ''}`,
          );
          if (!key) {
            return null;
          }
          return {
            amount: toNumber(row.amount),
            date: String(row.date ?? row.datetime ?? ''),
            description: String(row.description ?? ''),
            docname: String(row.docname ?? ''),
            doctype: String(row.doctype ?? ''),
            key,
            modeOfPayment: String(row.mode_of_payment ?? ''),
            outstandingAmount: toNumber(row.outstanding_amount),
            referenceNo: String(row.reference_no ?? ''),
            relatedDocname: String(row.related_docname ?? ''),
            relatedDoctype: String(row.related_doctype ?? ''),
            status: String(row.status ?? ''),
            title: String(row.title ?? ''),
            type: String(row.type ?? ''),
          } satisfies SalesOrderTimelineEvent;
        })
        .filter(
          (
            event: SalesOrderTimelineEvent | null,
          ): event is SalesOrderTimelineEvent => Boolean(event),
        )
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

function normalizeReferences(value: unknown) {
  return Object.entries(readObject(value)).reduce<Record<string, string[]>>(
    (acc, [key, rowValue]) => {
      acc[key] = toStringList(rowValue);
      return acc;
    },
    {},
  );
}

function normalizeSalesInvoicePaymentEntries(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((entry) => {
          const row = readObject(entry);
          const paymentEntry = String(row.payment_entry ?? '').trim();
          if (
            !paymentEntry ||
            paymentEntry === '收款单' ||
            paymentEntry === 'Payment Entry'
          ) {
            return null;
          }
          return {
            actualPaidAmount: toNumber(row.actual_paid_amount),
            allocatedAmount: toNumber(row.allocated_amount),
            latestUnallocatedAmount: toNumber(row.unallocated_amount),
            modeOfPayment: String(row.mode_of_payment ?? ''),
            paymentEntry,
            postingDate: String(row.posting_date ?? ''),
            referenceDate: String(row.reference_date ?? ''),
            referenceNo: String(row.reference_no ?? ''),
            writeoffAmount: toNumber(row.writeoff_amount),
          } satisfies SalesInvoicePaymentEntry;
        })
        .filter(
          (
            entry: SalesInvoicePaymentEntry | null,
          ): entry is SalesInvoicePaymentEntry => Boolean(entry),
        )
    : [];
}

function normalizeRefundInvoiceSnapshot(
  value: unknown,
): CustomerRefundInvoiceSnapshot | null {
  const row = readObject(value);
  const name = String(row.name ?? '');
  if (!name) {
    return null;
  }

  return {
    company: String(row.company ?? ''),
    currency: String(row.currency ?? 'CNY'),
    customer: String(row.customer ?? ''),
    customerName: String(row.customer_name ?? row.customer ?? ''),
    docstatus: Number(row.docstatus ?? 0),
    documentStatus: String(row.document_status ?? ''),
    grandTotal: toNumber(row.grand_total),
    isReturn: Boolean(row.is_return),
    name,
    outstandingAmount: toNumber(row.outstanding_amount),
    postingDate: String(row.posting_date ?? ''),
    returnAgainst: String(row.return_against ?? ''),
  };
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
      risk_filter: params.riskFilter ?? 'all',
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
      deliveryOverdueCount: Number(summary.delivery_overdue_count ?? 0),
      paymentOverdueCount: Number(summary.payment_overdue_count ?? 0),
    } satisfies SalesOrderSearchSummary,
  };
}

export async function exportSalesOrders(
  params: Omit<SearchSalesOrdersParams, 'start'> = {},
) {
  const result = await callGatewayMethod<Record<string, any>>(
    'export_sales_orders_v2',
    {
      search_key: normalizeOptionalText(params.searchKey),
      customer: normalizeOptionalText(params.customer),
      company: normalizeOptionalText(params.company),
      date_from: normalizeOptionalText(params.dateFrom),
      date_to: normalizeOptionalText(params.dateTo),
      status_filter: params.statusFilter ?? 'all',
      exclude_cancelled:
        params.excludeCancelled === undefined
          ? 1
          : params.excludeCancelled
            ? 1
            : 0,
      sort_by: params.sortBy ?? 'latest',
      risk_filter: params.riskFilter ?? 'all',
      limit: params.limit,
    },
  );
  const data = result.data ?? {};

  return {
    content: String(data.content ?? ''),
    exportedCount: Number(data.exported_count ?? 0),
    filename: String(data.filename ?? 'sales-orders.csv'),
    limit: Number(data.limit ?? 0),
    mimeType: String(data.mime_type ?? 'text/csv;charset=utf-8'),
    truncated: Boolean(data.truncated),
  } satisfies ExportSalesOrdersResult;
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
    order_name: data.order_name ?? orderName,
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
    defaultSalesMode:
      data.meta?.default_sales_mode === 'retail' ? 'retail' : 'wholesale',
    deliveryDate: String(data.meta?.delivery_date ?? ''),
    remarks: String(data.meta?.remarks ?? ''),
    contactDisplay: String(
      shipping.contact_display ?? shipping.contact_person ?? '',
    ),
    contactPhone: String(shipping.contact_phone ?? ''),
    addressDisplay: normalizeDocumentText(shipping.shipping_address_text),
    paidAmount: toNumber(amounts.paid_amount),
    receivableAmount: toNumber(amounts.receivable_amount),
    canCancelOrder: Boolean(actions.can_cancel_sales_order),
    cancelSalesOrderHint: String(actions.cancel_sales_order_hint ?? ''),
    canCreateSalesInvoice: Boolean(actions.can_create_sales_invoice),
    canRecordPayment: Boolean(actions.can_record_payment),
    canSubmitDelivery: Boolean(actions.can_submit_delivery),
    deliveryNotes: toStringList(references.delivery_notes),
    salesInvoices: toStringList(references.sales_invoices),
    timeline: normalizeSalesOrderTimeline(data.timeline),
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

export async function updateSalesOrderV2(
  orderName: string,
  payload: Omit<CreateSalesOrderPayload, 'company' | 'customer' | 'items'>,
) {
  return runGatewayMutation<{ order?: string }>('update_order_v2', {
    payload: compactPayload({
      order_name: orderName,
      customer_info: payload.customerInfo
        ? compactPayload({
            contact_display_name: payload.customerInfo.contactDisplayName,
            contact_email: payload.customerInfo.contactEmail,
            contact_phone: payload.customerInfo.contactPhone,
          })
        : undefined,
      default_sales_mode: payload.defaultSalesMode,
      delivery_date: payload.deliveryDate,
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
    }),
    successMessage: '销售订单已更新',
  });
}

export async function updateSalesOrderItemsV2(
  orderName: string,
  payload: Pick<CreateSalesOrderPayload, 'company' | 'deliveryDate' | 'items'> & {
    defaultWarehouse?: string;
  },
) {
  return runGatewayMutation<{ order?: string; source_order?: string }>(
    'update_order_items_v2',
    {
      payload: compactPayload({
        company: payload.company,
        default_warehouse: payload.defaultWarehouse,
        delivery_date: payload.deliveryDate,
        items: normalizeSalesOrderItems(payload.items),
        order_name: orderName,
      }),
      successMessage: '销售订单商品明细已更新',
    },
  );
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
    addressDisplay: normalizeDocumentText(shipping.shipping_address_text),
    canCancelDeliveryNote: Boolean(actions.can_cancel_delivery_note),
    cancelDeliveryNoteHint: String(actions.cancel_delivery_note_hint ?? ''),
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
    addressDisplay: normalizeDocumentText(shipping.shipping_address_text),
    canCancelSalesInvoice: Boolean(actions.can_cancel_sales_invoice),
    canRecordPayment: Boolean(actions.can_record_payment),
    cancelSalesInvoiceHint: String(actions.cancel_sales_invoice_hint ?? ''),
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
    actualPaidAmount: toNumber(payment.actual_paid_amount),
    latestPaymentEntry: String(
      payment.latest_payment_entry ?? references.latest_payment_entry ?? '',
    ),
    latestUnallocatedAmount: toNumber(payment.latest_unallocated_amount),
    name: String(data.sales_invoice_name ?? salesInvoiceName),
    outstandingAmount: toNumber(amounts.outstanding_amount),
    paidAmount: toNumber(amounts.paid_amount),
    paymentEntries: normalizeSalesInvoicePaymentEntries(payment.entries),
    paymentStatus: String(payment.status ?? ''),
    postingDate: String(meta.posting_date ?? ''),
    receivableAmount: toNumber(amounts.receivable_amount),
    remarks: String(meta.remarks ?? ''),
    returnInvoices: toStringList(references.return_invoices),
    recordPaymentHint: String(actions.record_payment_hint ?? ''),
    salesOrders: toStringList(references.sales_orders),
    totalWriteoffAmount: toNumber(payment.total_writeoff_amount),
  };
}

export async function submitSalesOrderDelivery(
  orderName: string,
  options: {
    deliveryItems?: SalesOrderActionItem[];
    forceDelivery?: boolean;
    postingDate?: string;
    remarks?: string;
  } = {},
) {
  const deliveryItems = normalizeSalesActionItems(options.deliveryItems);
  const forceDelivery = Boolean(options.forceDelivery);
  const postingDate = options.postingDate?.trim();
  const remarks = options.remarks?.trim();
  const kwargs = {
    ...(forceDelivery ? { force_delivery: 1 } : {}),
    ...(postingDate ? { posting_date: postingDate } : {}),
    ...(remarks ? { remarks } : {}),
  };

  return runGatewayMutation('submit_delivery', {
    payload: {
      ...(deliveryItems?.length ? { delivery_items: deliveryItems } : {}),
      ...(Object.keys(kwargs).length ? { kwargs } : {}),
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
  referenceName: string,
  paidAmount: number,
  options: {
    modeOfPayment?: string;
    referenceDate?: string;
    referenceDoctype?: string;
    referenceNo?: string;
    settlementMode?: 'partial' | 'writeoff';
    writeoffReason?: string;
  } = {},
) {
  const modeOfPayment = options.modeOfPayment?.trim();
  const referenceDate = options.referenceDate?.trim();
  const referenceNo = options.referenceNo?.trim();
  const writeoffReason = options.writeoffReason?.trim();

  return runGatewayMutation('update_payment_status', {
    payload: {
      ...(modeOfPayment ? { mode_of_payment: modeOfPayment } : {}),
      paid_amount: paidAmount,
      ...(referenceDate ? { reference_date: referenceDate } : {}),
      reference_doctype: options.referenceDoctype ?? 'Sales Order',
      reference_name: referenceName,
      ...(referenceNo ? { reference_no: referenceNo } : {}),
      ...(options.settlementMode
        ? { settlement_mode: options.settlementMode }
        : {}),
      ...(writeoffReason ? { writeoff_reason: writeoffReason } : {}),
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

export async function quickCancelSalesOrderV2(
  orderName: string,
  options: { rollbackPayment?: boolean } = {},
) {
  return runGatewayMutation<QuickCancelSalesOrderResult>(
    'quick_cancel_order_v2',
    {
      payload: {
        order_name: orderName,
        rollback_payment: options.rollbackPayment ? 1 : 0,
      },
      successMessage: '销售订单下游单据已快捷回退',
      transform: (data) => {
        const row = readObject(data);
        return {
          cancelledDeliveryNote:
            typeof row.cancelled_delivery_note === 'string'
              ? row.cancelled_delivery_note
              : '',
          cancelledPaymentEntries: toStringList(row.cancelled_payment_entries),
          cancelledRefundEntries: toStringList(row.cancelled_refund_entries),
          cancelledReturnInvoices: toStringList(row.cancelled_return_invoices),
          cancelledSalesInvoice:
            typeof row.cancelled_sales_invoice === 'string'
              ? row.cancelled_sales_invoice
              : '',
          completedSteps: toStringList(row.completed_steps),
          orderName: String(row.order ?? orderName),
        };
      },
    },
  );
}

export async function getSalesReturnSourceContext(
  sourceDoctype: SalesReturnSourceDoctype,
  sourceName: string,
): Promise<SalesReturnSourceContext | null> {
  const result = await callGatewayMethod<Record<string, any>>(
    'get_return_source_context_v2',
    {
      source_doctype: sourceDoctype,
      source_name: sourceName,
    },
  );
  const data = result.data;
  if (!data || typeof data !== 'object') {
    return null;
  }

  const actions = readObject(data.actions);
  const amounts = readObject(data.amounts);
  const meta = readObject(data.meta);
  const party = readObject(data.party);
  const items = Array.isArray(data.items) ? data.items : [];

  return {
    canProcessReturn: Boolean(actions.can_process_return),
    company: String(meta.company ?? ''),
    currency: String(meta.currency ?? 'CNY'),
    documentStatus: String(data.document_status ?? ''),
    outstandingAmount: toNumber(amounts.outstanding_amount),
    partyDisplayName: String(
      party.display_name ?? party.party_name ?? data.party_name ?? '',
    ),
    partyName: String(party.party_name ?? ''),
    postingDate: String(meta.posting_date ?? meta.transaction_date ?? ''),
    primaryAmount: toNumber(amounts.primary_amount),
    sourceDoctype: String(data.source_doctype ?? sourceDoctype) as SalesReturnSourceDoctype,
    sourceLabel: String(data.source_label ?? sourceDoctype),
    sourceName: String(data.source_name ?? sourceName),
    supportsPartialReturn: Boolean(actions.supports_partial_return),
    items: items
      .map((item: Record<string, unknown>) => {
        const detailId = String(item.detail_id ?? '');
        const detailSubmitKey = String(item.detail_submit_key ?? '');
        if (!detailId || !detailSubmitKey) {
          return null;
        }
        return {
          amount: toNumber(item.amount),
          defaultReturnQty: toNumber(item.default_return_qty),
          detailId,
          detailSubmitKey,
          itemCode: String(item.item_code ?? ''),
          itemName: String(item.item_name ?? item.item_code ?? ''),
          maxReturnableQty: toNumber(item.max_returnable_qty),
          rate: toNumber(item.rate),
          returnedQty: toNumber(item.returned_qty),
          sourceQty: toNumber(item.source_qty),
          specification: String(item.specification ?? ''),
          uom: String(item.uom ?? ''),
          uomDisplay:
            typeof item.uom_display === 'string' ? item.uom_display : null,
          warehouse: String(item.warehouse ?? ''),
        } satisfies SalesReturnSourceContextItem;
      })
      .filter(
        (item: SalesReturnSourceContextItem | null): item is SalesReturnSourceContextItem =>
          Boolean(item),
      ),
  };
}

export async function submitSalesReturn(payload: {
  postingDate?: string;
  remarks?: string;
  returnItems: Record<string, unknown>[];
  sourceDoctype: SalesReturnSourceDoctype;
  sourceName: string;
}) {
  return runGatewayMutation<SalesReturnSubmissionResult>(
    'process_sales_return',
    {
      payload: compactPayload({
        posting_date: payload.postingDate,
        remarks: payload.remarks,
        return_items: payload.returnItems.length
          ? payload.returnItems
          : undefined,
        source_doctype: payload.sourceDoctype,
        source_name: payload.sourceName,
      }),
      successMessage: '销售退货单已创建',
      transform: (data) => {
        const row = readObject(data);
        const nextActions = readObject(row.next_actions);
        const summary = readObject(row.summary);
        return {
          businessType: String(row.business_type ?? 'sales'),
          documentStatus: String(row.document_status ?? ''),
          message: String(row.message ?? '销售退货单已创建。'),
          nextActions: {
            canBackToSource: Boolean(nextActions.can_back_to_source),
            canViewReturnDocument: Boolean(
              nextActions.can_view_return_document,
            ),
            suggestedNextAction: String(
              nextActions.suggested_next_action ?? '',
            ),
          },
          references: normalizeReferences(row.references),
          returnDocument: String(row.return_document ?? ''),
          returnDoctype: String(
            row.return_doctype ?? payload.sourceDoctype,
          ) as SalesReturnSourceDoctype,
          sourceDoctype: String(
            row.source_doctype ?? payload.sourceDoctype,
          ) as SalesReturnSourceDoctype,
          sourceName: String(row.source_name ?? payload.sourceName),
          summary: {
            isPartialReturn: Boolean(summary.is_partial_return),
            itemCount: Number(summary.item_count ?? 0),
            returnAmountEstimate: toNumber(summary.return_amount_estimate),
            totalQty: toNumber(summary.total_qty),
          },
        };
      },
    },
  );
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

export async function getCustomerRefundContext(
  returnInvoiceName: string,
): Promise<CustomerRefundContext | null> {
  const result = await callGatewayMethod<Record<string, any>>(
    'get_customer_refund_context_v1',
    { return_invoice_name: returnInvoiceName },
  );
  const data = result.data;

  if (!data || typeof data !== 'object') {
    return null;
  }

  const refund = readObject(data.refund);
  const actions = readObject(data.actions);

  return {
    actions: {
      canCreateRefund: Boolean(actions.can_create_refund),
      createRefundHint: String(actions.create_refund_hint ?? ''),
    },
    entries: normalizeSalesInvoicePaymentEntries(data.entries),
    refund: {
      currency: String(refund.currency ?? 'CNY'),
      refundableAmount: toNumber(refund.refundable_amount),
      refundedAmount: toNumber(refund.refunded_amount),
      returnAmount: toNumber(refund.return_amount),
      status: String(refund.status ?? ''),
      suggestedRefundAmount: toNumber(refund.suggested_refund_amount),
    },
    returnInvoice: normalizeRefundInvoiceSnapshot(data.return_invoice),
    sourceInvoice: normalizeRefundInvoiceSnapshot(data.source_invoice),
  };
}

export async function createCustomerRefund(
  returnInvoiceName: string,
  refundAmount: number,
  options: {
    modeOfPayment?: string;
    referenceDate?: string;
    referenceNo?: string;
    remarks?: string;
  } = {},
) {
  return runGatewayMutation<CustomerRefundResult>('create_customer_refund', {
    payload: compactPayload({
      mode_of_payment: options.modeOfPayment,
      reference_date: options.referenceDate,
      reference_no: options.referenceNo,
      refund_amount: refundAmount,
      remarks: options.remarks,
      return_invoice_name: returnInvoiceName,
    }),
    successMessage: '客户退款已登记',
    transform: (data) => {
      const row = readObject(data);
      return {
        modeOfPayment: String(row.mode_of_payment ?? ''),
        paymentEntry: String(row.payment_entry ?? ''),
        refundableAmountBeforeRefund: toNumber(
          row.refundable_amount_before_refund,
        ),
        referenceDate: String(row.reference_date ?? ''),
        referenceNo: String(row.reference_no ?? ''),
        refundAmount: toNumber(row.refund_amount),
        returnInvoice: String(row.return_invoice ?? returnInvoiceName),
        sourceInvoice: String(row.source_invoice ?? ''),
      };
    },
  });
}
