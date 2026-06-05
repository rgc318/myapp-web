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
  qty: number | null;
  rate: number | null;
  receivedQty?: number | null;
  uom: string;
  warehouse: string;
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
        qty: toOptionalNumber(item.qty),
        rate: toOptionalNumber(item.rate),
        receivedQty: toOptionalNumber(item.received_qty),
        uom: String(item.uom_display ?? item.uom ?? ''),
        warehouse: String(item.warehouse ?? ''),
      }))
    : [];
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

export async function receivePurchaseOrder(
  orderName: string,
  options: { postingDate?: string; remarks?: string } = {},
) {
  const postingDate = options.postingDate?.trim();
  const remarks = options.remarks?.trim();

  return runGatewayMutation('receive_purchase_order', {
    payload: {
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

export async function createPurchaseOrderInvoice(orderName: string) {
  return runGatewayMutation('create_purchase_invoice', {
    payload: { source_name: orderName },
    successMessage: '采购发票已创建',
  });
}

export async function recordPurchaseOrderPayment(
  orderName: string,
  paidAmount: number,
  options: { modeOfPayment?: string } = {},
) {
  const modeOfPayment = options.modeOfPayment?.trim();

  return runGatewayMutation('record_supplier_payment', {
    payload: {
      ...(modeOfPayment ? { mode_of_payment: modeOfPayment } : {}),
      paid_amount: paidAmount,
      reference_name: orderName,
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
