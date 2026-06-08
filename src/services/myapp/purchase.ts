import { callGatewayMethod } from './api-client';
import {
  compactPayload,
  readObject,
  toOptionalNumber,
  toOptionalText,
  toStringList,
} from './api-utils';
import { runGatewayMutation } from './mutation';

export type PurchaseOrderStatusFilter =
  | 'all'
  | 'unfinished'
  | 'receiving'
  | 'paying'
  | 'completed'
  | 'cancelled';

export type PurchaseOrderSort =
  | 'unfinished_first'
  | 'latest'
  | 'oldest'
  | 'amount_desc'
  | 'amount_asc';

export type PurchaseOrderSummary = {
  amount: number | null;
  company: string;
  completionStatus: string;
  documentStatus: string;
  modified: string;
  name: string;
  outstandingAmount: number | null;
  paymentStatus: string;
  receivingStatus: string;
  supplier: string;
  supplierName: string;
  transactionDate: string;
};

export type PurchaseOrderSearchSummary = {
  cancelledCount: number;
  completedCount: number;
  paymentCount: number;
  receivingCount: number;
  totalCount: number;
  unfinishedCount: number;
  visibleCount: number;
};

export type SearchPurchaseOrdersParams = {
  company?: string;
  dateFrom?: string;
  dateTo?: string;
  excludeCancelled?: boolean;
  limit?: number;
  searchKey?: string;
  sortBy?: PurchaseOrderSort;
  start?: number;
  statusFilter?: PurchaseOrderStatusFilter;
  supplier?: string;
};

export type PurchaseDocumentItem = {
  amount: number | null;
  itemCode: string;
  itemName: string;
  purchaseOrderItem: string;
  qty: number | null;
  rate: number | null;
  receivedQty?: number | null;
  uom: string;
  warehouse: string;
};

export type PurchaseOrderActionItem = {
  itemCode?: string;
  price?: number;
  purchaseOrderItem?: string;
  qty: number;
};

export type PurchaseOrderItemInput = {
  itemCode: string;
  price?: number | null;
  qty: number;
  uom?: string | null;
  warehouse?: string | null;
};

export type CreatePurchaseOrderPayload = {
  buyingPriceList?: string;
  company: string;
  currency?: string;
  defaultWarehouse?: string;
  items: PurchaseOrderItemInput[];
  remarks?: string;
  scheduleDate?: string;
  supplier: string;
  supplierRef?: string;
  transactionDate?: string;
};

export type QuickCreatePurchaseOrderPayload = CreatePurchaseOrderPayload & {
  immediateInvoice?: boolean;
  immediatePayment?: boolean;
  immediateReceive?: boolean;
  modeOfPayment?: string;
  paidAmount?: number;
  referenceDate?: string;
  referenceNo?: string;
};

export type QuickCancelPurchaseOrderResult = {
  cancelledPaymentEntries: string[];
  cancelledPurchaseInvoice: string;
  cancelledPurchaseReceipt: string;
  completedSteps: string[];
  orderName: string;
};

export type PurchaseReturnSourceDoctype =
  | 'Purchase Receipt'
  | 'Purchase Invoice';

export type PurchaseReturnSourceContextItem = {
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
  warehouse: string;
};

export type PurchaseReturnSourceContext = {
  canProcessReturn: boolean;
  company: string;
  currency: string;
  documentStatus: string;
  outstandingAmount: number | null;
  partyDisplayName: string;
  partyName: string;
  postingDate: string;
  primaryAmount: number | null;
  sourceDoctype: PurchaseReturnSourceDoctype;
  sourceLabel: string;
  sourceName: string;
  supportsPartialReturn: boolean;
  items: PurchaseReturnSourceContextItem[];
};

export type PurchaseReturnSubmissionResult = {
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
  returnDoctype: PurchaseReturnSourceDoctype;
  sourceDoctype: PurchaseReturnSourceDoctype;
  sourceName: string;
  summary: {
    isPartialReturn: boolean;
    itemCount: number;
    returnAmountEstimate: number | null;
    totalQty: number | null;
  };
};

export type UpdatePurchaseOrderPayload = {
  remarks?: string;
  scheduleDate?: string;
  supplierRef?: string;
  transactionDate?: string;
};

export type UpdatePurchaseOrderItemsPayload = {
  company?: string;
  defaultWarehouse?: string;
  items: PurchaseOrderItemInput[];
  scheduleDate?: string;
};

export type PurchaseCompanyContext = {
  company: string | null;
  currency: string | null;
  warehouse: string | null;
};

export type SupplierPurchaseContext = {
  defaultAddress: {
    addressDisplay: string | null;
    name: string | null;
  } | null;
  defaultContact: {
    displayName: string | null;
    email: string | null;
    name: string | null;
    phone: string | null;
  } | null;
  suggestions: {
    company: string | null;
    currency: string | null;
    warehouse: string | null;
  };
  supplier: {
    defaultCurrency: string | null;
    displayName: string;
    name: string;
  };
};

export type PurchaseOrderDetail = PurchaseOrderSummary & {
  actualPaidAmount: number | null;
  canCancelOrder: boolean;
  canCreateInvoice: boolean;
  canReceive: boolean;
  canRecordPayment: boolean;
  currency: string;
  items: PurchaseDocumentItem[];
  paidAmount: number | null;
  purchaseInvoices: string[];
  purchaseReceipts: string[];
  remarks: string;
  scheduleDate: string;
  supplierAddressDisplay: string;
  supplierContactDisplay: string;
  supplierContactPhone: string;
  supplierRef: string;
};

export type PurchaseReceiptDetail = {
  amount: number | null;
  canCreateInvoice: boolean;
  canCancel: boolean;
  company: string;
  currency: string;
  documentStatus: string;
  items: PurchaseDocumentItem[];
  name: string;
  postingDate: string;
  purchaseInvoices: string[];
  purchaseOrders: string[];
  receivingStatus: string;
  remarks: string;
  supplier: string;
  supplierName: string;
  totalQty: number | null;
};

export type PurchaseInvoiceDetail = {
  amount: number | null;
  canCancel: boolean;
  company: string;
  currency: string;
  documentStatus: string;
  dueDate: string;
  items: PurchaseDocumentItem[];
  latestPaymentEntry: string;
  name: string;
  outstandingAmount: number | null;
  paidAmount: number | null;
  paymentStatus: string;
  postingDate: string;
  purchaseOrders: string[];
  purchaseReceipts: string[];
  remarks: string;
  supplier: string;
  supplierName: string;
};

function mapSummaryRow(row: Record<string, any>): PurchaseOrderSummary {
  const receiving = readObject(row.receiving);
  const payment = readObject(row.payment);
  const completion = readObject(row.completion);

  return {
    amount: toOptionalNumber(row.order_amount_estimate ?? row.grand_total),
    company: String(row.company ?? ''),
    completionStatus: String(completion.status ?? ''),
    documentStatus: String(row.document_status ?? ''),
    modified: String(row.modified ?? ''),
    name: String(row.purchase_order_name ?? row.name ?? ''),
    outstandingAmount: toOptionalNumber(row.outstanding_amount),
    paymentStatus: String(payment.status ?? ''),
    receivingStatus: String(receiving.status ?? ''),
    supplier: String(row.supplier ?? ''),
    supplierName: String(row.supplier_name ?? row.supplier ?? ''),
    transactionDate: String(row.transaction_date ?? ''),
  };
}

function mapItems(value: unknown): PurchaseDocumentItem[] {
  return Array.isArray(value)
    ? value.map((item: Record<string, any>) => ({
        amount: toOptionalNumber(item.amount),
        itemCode: String(item.item_code ?? ''),
        itemName: String(item.item_name ?? item.item_code ?? ''),
        purchaseOrderItem: String(item.purchase_order_item ?? item.name ?? ''),
        qty: toOptionalNumber(item.qty),
        rate: toOptionalNumber(item.rate),
        receivedQty: toOptionalNumber(item.received_qty),
        uom: String(item.uom ?? ''),
        warehouse: String(item.warehouse ?? ''),
      }))
    : [];
}

function normalizePurchaseActionItems(
  items: PurchaseOrderActionItem[] | undefined,
) {
  return items
    ?.filter((item) => item.qty > 0)
    .map((item) => ({
      ...(item.itemCode ? { item_code: item.itemCode } : {}),
      ...(item.price !== undefined ? { price: item.price } : {}),
      ...(item.purchaseOrderItem
        ? { purchase_order_item: item.purchaseOrderItem }
        : {}),
      qty: item.qty,
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

function normalizePurchaseOrderItems(items: PurchaseOrderItemInput[]) {
  return items
    .filter((item) => item.itemCode && item.qty > 0)
    .map((item) =>
      compactPayload({
        item_code: item.itemCode,
        price: item.price ?? undefined,
        qty: item.qty,
        uom: item.uom ?? undefined,
        warehouse: item.warehouse ?? undefined,
      }),
    );
}

function buildPurchaseOrderPayload(payload: CreatePurchaseOrderPayload) {
  return compactPayload({
    buying_price_list: payload.buyingPriceList,
    company: payload.company,
    currency: payload.currency,
    default_warehouse: payload.defaultWarehouse,
    items: normalizePurchaseOrderItems(payload.items),
    remarks: payload.remarks,
    schedule_date: payload.scheduleDate,
    supplier: payload.supplier,
    supplier_ref: payload.supplierRef,
    transaction_date: payload.transactionDate,
  });
}

export async function searchPurchaseOrders(
  params: SearchPurchaseOrdersParams = {},
) {
  const result = await callGatewayMethod<Record<string, any>>(
    'search_purchase_orders_v2',
    compactPayload({
      company: toOptionalText(params.company),
      date_from: toOptionalText(params.dateFrom),
      date_to: toOptionalText(params.dateTo),
      exclude_cancelled:
        params.excludeCancelled === undefined ? 1 : params.excludeCancelled ? 1 : 0,
      limit: params.limit,
      search_key: toOptionalText(params.searchKey),
      sort_by: params.sortBy ?? 'unfinished_first',
      start: params.start,
      status_filter: params.statusFilter ?? 'unfinished',
      supplier: toOptionalText(params.supplier),
    }),
  );

  const data = result.data ?? {};
  const rows = Array.isArray(data.items) ? data.items : [];
  const pagination = readObject(data.pagination);
  const summary = readObject(data.summary);
  const visibleCount = toOptionalNumber(
    pagination.total_count ?? summary.visible_count,
  ) ?? rows.length;

  return {
    items: rows.map((row) => mapSummaryRow(row)),
    summary: {
      cancelledCount: Number(summary.cancelled_count ?? 0),
      completedCount: Number(summary.completed_count ?? 0),
      paymentCount: Number(summary.payment_count ?? 0),
      receivingCount: Number(summary.receiving_count ?? 0),
      totalCount: Number(summary.total_count ?? 0),
      unfinishedCount: Number(summary.unfinished_count ?? 0),
      visibleCount,
    } satisfies PurchaseOrderSearchSummary,
  };
}

export async function getPurchaseOrderDetail(
  orderName: string,
): Promise<PurchaseOrderDetail | null> {
  const result = await callGatewayMethod<Record<string, any>>(
    'get_purchase_order_detail_v2',
    { order_name: orderName },
  );
  const data = result.data;
  if (!data || typeof data !== 'object') {
    return null;
  }

  const supplier = readObject(data.supplier);
  const address = readObject(data.address);
  const amounts = readObject(data.amounts);
  const actions = readObject(data.actions);
  const payment = readObject(data.payment);
  const references = readObject(data.references);
  const meta = readObject(data.meta);
  const summary = mapSummaryRow({
    ...data,
    company: meta.company,
    order_amount_estimate: amounts.order_amount_estimate,
    outstanding_amount: amounts.outstanding_amount,
    purchase_order_name: data.purchase_order_name,
    supplier: supplier.name,
    supplier_name: supplier.display_name,
    transaction_date: meta.transaction_date,
  });

  return {
    ...summary,
    actualPaidAmount: toOptionalNumber(payment.actual_paid_amount),
    canCancelOrder: Boolean(actions.can_cancel_purchase_order),
    canCreateInvoice: Boolean(actions.can_create_purchase_invoice),
    canReceive: Boolean(actions.can_receive_purchase_order),
    canRecordPayment: Boolean(actions.can_record_supplier_payment),
    currency: String(meta.currency ?? 'CNY'),
    items: mapItems(data.items),
    paidAmount: toOptionalNumber(amounts.paid_amount),
    purchaseInvoices: toStringList(references.purchase_invoices),
    purchaseReceipts: toStringList(references.purchase_receipts),
    remarks: String(meta.remarks ?? ''),
    scheduleDate: String(meta.schedule_date ?? ''),
    supplierAddressDisplay: String(
      address.supplier_address_text ?? address.address_display ?? '',
    ),
    supplierContactDisplay: String(
      supplier.contact_display_name ?? supplier.contact_person ?? '',
    ),
    supplierContactPhone: String(supplier.contact_phone ?? ''),
    supplierRef: String(meta.supplier_ref ?? ''),
  };
}

export async function getPurchaseCompanyContext(
  company?: string,
): Promise<PurchaseCompanyContext | null> {
  const result = await callGatewayMethod<Record<string, any>>(
    'get_purchase_company_context',
    compactPayload({ company: toOptionalText(company) }),
  );
  const data = result.data;
  if (!data || typeof data !== 'object') {
    return null;
  }
  return {
    company: typeof data.company === 'string' ? data.company : null,
    currency: typeof data.currency === 'string' ? data.currency : null,
    warehouse: typeof data.warehouse === 'string' ? data.warehouse : null,
  };
}

export async function getSupplierPurchaseContext(
  supplier: string,
  company?: string,
): Promise<SupplierPurchaseContext | null> {
  const result = await callGatewayMethod<Record<string, any>>(
    'get_supplier_purchase_context',
    compactPayload({
      company: toOptionalText(company),
      supplier,
    }),
  );
  const data = result.data;
  if (!data || typeof data !== 'object') {
    return null;
  }

  const supplierRow = readObject(data.supplier);
  const defaultContact = readObject(data.default_contact);
  const defaultAddress = readObject(data.default_address);
  const suggestions = readObject(data.suggestions);

  return {
    defaultAddress: defaultAddress.name
      ? {
          addressDisplay:
            typeof defaultAddress.address_display === 'string'
              ? defaultAddress.address_display
              : null,
          name:
            typeof defaultAddress.name === 'string' ? defaultAddress.name : null,
        }
      : null,
    defaultContact: defaultContact.name
      ? {
          displayName:
            typeof defaultContact.display_name === 'string'
              ? defaultContact.display_name
              : null,
          email:
            typeof defaultContact.email === 'string'
              ? defaultContact.email
              : null,
          name:
            typeof defaultContact.name === 'string' ? defaultContact.name : null,
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
      currency:
        typeof suggestions.currency === 'string' ? suggestions.currency : null,
      warehouse:
        typeof suggestions.warehouse === 'string'
          ? suggestions.warehouse
          : null,
    },
    supplier: {
      defaultCurrency:
        typeof supplierRow.default_currency === 'string'
          ? supplierRow.default_currency
          : null,
      displayName: String(
        supplierRow.display_name ?? supplierRow.name ?? supplier,
      ),
      name: String(supplierRow.name ?? supplier),
    },
  };
}

export async function getPurchaseReceiptDetail(
  receiptName: string,
): Promise<PurchaseReceiptDetail | null> {
  const result = await callGatewayMethod<Record<string, any>>(
    'get_purchase_receipt_detail_v2',
    { receipt_name: receiptName },
  );
  const data = result.data;
  if (!data || typeof data !== 'object') {
    return null;
  }

  const supplier = readObject(data.supplier);
  const amounts = readObject(data.amounts);
  const receiving = readObject(data.receiving);
  const actions = readObject(data.actions);
  const references = readObject(data.references);
  const meta = readObject(data.meta);

  return {
    amount: toOptionalNumber(amounts.receipt_amount_estimate),
    canCancel: Boolean(actions.can_cancel_purchase_receipt),
    canCreateInvoice: Boolean(actions.can_create_purchase_invoice),
    company: String(meta.company ?? ''),
    currency: String(meta.currency ?? 'CNY'),
    documentStatus: String(data.document_status ?? ''),
    items: mapItems(data.items),
    name: String(data.purchase_receipt_name ?? receiptName),
    postingDate: String(meta.posting_date ?? ''),
    purchaseInvoices: toStringList(references.purchase_invoices),
    purchaseOrders: toStringList(references.purchase_orders),
    receivingStatus: String(receiving.status ?? ''),
    remarks: String(meta.remarks ?? ''),
    supplier: String(supplier.name ?? ''),
    supplierName: String(supplier.display_name ?? supplier.name ?? ''),
    totalQty: toOptionalNumber(receiving.total_qty),
  };
}

export async function getPurchaseInvoiceDetail(
  invoiceName: string,
): Promise<PurchaseInvoiceDetail | null> {
  const result = await callGatewayMethod<Record<string, any>>(
    'get_purchase_invoice_detail_v2',
    { invoice_name: invoiceName },
  );
  const data = result.data;
  if (!data || typeof data !== 'object') {
    return null;
  }

  const supplier = readObject(data.supplier);
  const amounts = readObject(data.amounts);
  const payment = readObject(data.payment);
  const actions = readObject(data.actions);
  const references = readObject(data.references);
  const meta = readObject(data.meta);

  return {
    amount: toOptionalNumber(amounts.invoice_amount_estimate),
    canCancel: Boolean(actions.can_cancel_purchase_invoice),
    company: String(meta.company ?? ''),
    currency: String(meta.currency ?? 'CNY'),
    documentStatus: String(data.document_status ?? ''),
    dueDate: String(meta.due_date ?? ''),
    items: mapItems(data.items),
    latestPaymentEntry: String(references.latest_payment_entry ?? ''),
    name: String(data.purchase_invoice_name ?? invoiceName),
    outstandingAmount: toOptionalNumber(amounts.outstanding_amount),
    paidAmount: toOptionalNumber(amounts.paid_amount),
    paymentStatus: String(payment.status ?? ''),
    postingDate: String(meta.posting_date ?? ''),
    purchaseOrders: toStringList(references.purchase_orders),
    purchaseReceipts: toStringList(references.purchase_receipts),
    remarks: String(meta.remarks ?? ''),
    supplier: String(supplier.name ?? ''),
    supplierName: String(supplier.display_name ?? supplier.name ?? ''),
  };
}

export async function getPurchaseReturnSourceContext(
  sourceDoctype: PurchaseReturnSourceDoctype,
  sourceName: string,
): Promise<PurchaseReturnSourceContext | null> {
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
    outstandingAmount: toOptionalNumber(amounts.outstanding_amount),
    partyDisplayName: String(
      party.display_name ?? party.party_name ?? data.party_name ?? '',
    ),
    partyName: String(party.party_name ?? ''),
    postingDate: String(meta.posting_date ?? meta.transaction_date ?? ''),
    primaryAmount: toOptionalNumber(amounts.primary_amount),
    sourceDoctype: String(
      data.source_doctype ?? sourceDoctype,
    ) as PurchaseReturnSourceDoctype,
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
          amount: toOptionalNumber(item.amount),
          defaultReturnQty: toOptionalNumber(item.default_return_qty),
          detailId,
          detailSubmitKey,
          itemCode: String(item.item_code ?? ''),
          itemName: String(item.item_name ?? item.item_code ?? ''),
          maxReturnableQty: toOptionalNumber(item.max_returnable_qty),
          rate: toOptionalNumber(item.rate),
          returnedQty: toOptionalNumber(item.returned_qty),
          sourceQty: toOptionalNumber(item.source_qty),
          specification: String(
            item.specification ?? item.custom_specification ?? '',
          ),
          uom: String(item.uom ?? ''),
          warehouse: String(item.warehouse ?? ''),
        } satisfies PurchaseReturnSourceContextItem;
      })
      .filter(
        (
          item: PurchaseReturnSourceContextItem | null,
        ): item is PurchaseReturnSourceContextItem => Boolean(item),
      ),
  };
}

export async function receivePurchaseOrder(
  orderName: string,
  options: {
    postingDate?: string;
    receiptItems?: PurchaseOrderActionItem[];
    remarks?: string;
  } = {},
) {
  const postingDate = options.postingDate?.trim();
  const receiptItems = normalizePurchaseActionItems(options.receiptItems);
  const remarks = options.remarks?.trim();

  return runGatewayMutation('receive_purchase_order', {
    payload: {
      ...(receiptItems?.length ? { receipt_items: receiptItems } : {}),
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
    successMessage: '采购收货单已创建',
  });
}

export async function createPurchaseOrderV2(
  payload: CreatePurchaseOrderPayload,
) {
  return runGatewayMutation<{ purchase_order?: string }>('create_purchase_order', {
    payload: buildPurchaseOrderPayload(payload),
    successMessage: '采购订单已创建',
  });
}

export async function quickCreatePurchaseOrderV2(
  payload: QuickCreatePurchaseOrderPayload,
) {
  return runGatewayMutation<{
    completed_steps?: string[];
    payment_entry?: string;
    purchase_invoice?: string;
    purchase_order?: string;
    purchase_receipt?: string;
  }>('quick_create_purchase_order_v2', {
    payload: compactPayload({
      ...buildPurchaseOrderPayload(payload),
      immediate_invoice: payload.immediateInvoice === false ? 0 : 1,
      immediate_payment: payload.immediatePayment ? 1 : 0,
      immediate_receive: payload.immediateReceive === false ? 0 : 1,
      mode_of_payment: payload.modeOfPayment,
      paid_amount: payload.paidAmount,
      reference_date: payload.referenceDate,
      reference_no: payload.referenceNo,
    }),
    successMessage: '采购订单已快捷创建',
  });
}

export async function updatePurchaseOrderV2(
  orderName: string,
  payload: UpdatePurchaseOrderPayload,
) {
  return runGatewayMutation<{ purchase_order?: string }>(
    'update_purchase_order_v2',
    {
      payload: compactPayload({
        order_name: orderName,
        remarks: payload.remarks,
        schedule_date: payload.scheduleDate,
        supplier_ref: payload.supplierRef,
        transaction_date: payload.transactionDate,
      }),
      successMessage: '采购订单已更新',
    },
  );
}

export async function updatePurchaseOrderItemsV2(
  orderName: string,
  payload: UpdatePurchaseOrderItemsPayload,
) {
  return runGatewayMutation<{
    items?: PurchaseDocumentItem[];
    purchase_order?: string;
    source_purchase_order?: string;
  }>('update_purchase_order_items_v2', {
    payload: compactPayload({
      company: payload.company,
      default_warehouse: payload.defaultWarehouse,
      items: normalizePurchaseOrderItems(payload.items),
      order_name: orderName,
      schedule_date: payload.scheduleDate,
    }),
    successMessage: '采购订单明细已更新',
    transform: (data) => {
      const row = readObject(data);
      return {
        items: mapItems(row.items),
        purchase_order:
          typeof row.purchase_order === 'string' ? row.purchase_order : '',
        source_purchase_order:
          typeof row.source_purchase_order === 'string'
            ? row.source_purchase_order
            : '',
      };
    },
  });
}

export async function createPurchaseOrderInvoice(
  orderName: string,
  options: { invoiceItems?: PurchaseOrderActionItem[]; remarks?: string } = {},
) {
  const invoiceItems = normalizePurchaseActionItems(options.invoiceItems);
  const remarks = options.remarks?.trim();

  return runGatewayMutation('create_purchase_invoice', {
    payload: {
      ...(invoiceItems?.length ? { invoice_items: invoiceItems } : {}),
      ...(remarks ? { kwargs: { remarks } } : {}),
      source_name: orderName,
    },
    successMessage: '采购发票已创建',
  });
}

export async function createPurchaseInvoiceFromReceipt(
  receiptName: string,
  options: { dueDate?: string; remarks?: string } = {},
) {
  return runGatewayMutation<{ purchase_invoice?: string }>(
    'create_purchase_invoice_from_receipt',
    {
      payload: compactPayload({
        due_date: options.dueDate,
        receipt_name: receiptName,
        remarks: options.remarks,
      }),
      successMessage: '采购发票已创建',
    },
  );
}

export async function recordSupplierPayment(
  referenceName: string,
  paidAmount: number,
  options: { modeOfPayment?: string } = {},
) {
  const modeOfPayment = options.modeOfPayment?.trim();

  return runGatewayMutation('record_supplier_payment', {
    payload: {
      ...(modeOfPayment ? { mode_of_payment: modeOfPayment } : {}),
      paid_amount: paidAmount,
      reference_name: referenceName,
    },
    successMessage: '采购付款已记录',
  });
}

export async function cancelPurchaseOrder(orderName: string) {
  return runGatewayMutation('cancel_purchase_order_v2', {
    payload: { order_name: orderName },
    successMessage: '采购订单已取消',
  });
}

export async function quickCancelPurchaseOrderV2(
  orderName: string,
  options: { rollbackPayment?: boolean } = {},
) {
  return runGatewayMutation<QuickCancelPurchaseOrderResult>(
    'quick_cancel_purchase_order_v2',
    {
      payload: {
        order_name: orderName,
        rollback_payment: options.rollbackPayment === false ? 0 : 1,
      },
      successMessage: '采购订单下游单据已快捷回退',
      transform: (data) => {
        const row = readObject(data);
        return {
          cancelledPaymentEntries: toStringList(
            row.cancelled_payment_entries,
          ),
          cancelledPurchaseInvoice:
            typeof row.cancelled_purchase_invoice === 'string'
              ? row.cancelled_purchase_invoice
              : '',
          cancelledPurchaseReceipt:
            typeof row.cancelled_purchase_receipt === 'string'
              ? row.cancelled_purchase_receipt
              : '',
          completedSteps: toStringList(row.completed_steps),
          orderName: String(row.purchase_order ?? orderName),
        };
      },
    },
  );
}

export async function submitPurchaseReturn(payload: {
  postingDate?: string;
  remarks?: string;
  returnItems: Record<string, unknown>[];
  sourceDoctype: PurchaseReturnSourceDoctype;
  sourceName: string;
}) {
  return runGatewayMutation<PurchaseReturnSubmissionResult>(
    'process_purchase_return',
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
      successMessage: '采购退货单已创建',
      transform: (data) => {
        const row = readObject(data);
        const nextActions = readObject(row.next_actions);
        const summary = readObject(row.summary);
        return {
          businessType: String(row.business_type ?? 'purchase'),
          documentStatus: String(row.document_status ?? ''),
          message: String(row.message ?? '采购退货单已创建。'),
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
          ) as PurchaseReturnSourceDoctype,
          sourceDoctype: String(
            row.source_doctype ?? payload.sourceDoctype,
          ) as PurchaseReturnSourceDoctype,
          sourceName: String(row.source_name ?? payload.sourceName),
          summary: {
            isPartialReturn: Boolean(summary.is_partial_return),
            itemCount: Number(summary.item_count ?? 0),
            returnAmountEstimate: toOptionalNumber(
              summary.return_amount_estimate,
            ),
            totalQty: toOptionalNumber(summary.total_qty),
          },
        };
      },
    },
  );
}

export async function cancelPurchaseReceipt(receiptName: string) {
  return runGatewayMutation('cancel_purchase_receipt_v2', {
    payload: { receipt_name: receiptName },
    successMessage: '采购收货单已取消',
  });
}

export async function cancelPurchaseInvoice(invoiceName: string) {
  return runGatewayMutation('cancel_purchase_invoice_v2', {
    payload: { invoice_name: invoiceName },
    successMessage: '采购发票已取消',
  });
}

export async function cancelSupplierPaymentEntry(paymentEntryName: string) {
  return runGatewayMutation('cancel_supplier_payment', {
    payload: { payment_entry_name: paymentEntryName },
    successMessage: '采购付款已取消',
  });
}
