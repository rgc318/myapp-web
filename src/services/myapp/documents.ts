import { callGatewayMethod } from './api-client';
import { compactPayload, readObject, toOptionalNumber } from './api-utils';

export type BusinessDocumentDoctype =
  | 'Delivery Note'
  | 'Sales Invoice'
  | 'Purchase Receipt'
  | 'Purchase Invoice';

export type BusinessDocumentSort = 'latest' | 'oldest' | 'amount_desc' | 'amount_asc';

export type BusinessDocumentListParams = {
  company?: string;
  dateFrom?: string;
  dateTo?: string;
  docstatus?: 'all' | 'draft' | 'submitted' | 'cancelled' | 0 | 1 | 2;
  doctype: BusinessDocumentDoctype;
  limit?: number;
  party?: string;
  searchKey?: string;
  sortBy?: BusinessDocumentSort;
  start?: number;
};

export type BusinessDocumentSummary = {
  amount: number | null;
  businessStatus: string;
  company: string;
  detailPath: string;
  docstatus: number;
  doctype: BusinessDocumentDoctype;
  documentStatus: string;
  dueDate: string;
  isReturn: boolean;
  modified: string;
  name: string;
  outstandingAmount: number | null;
  paidAmount: number | null;
  party: string;
  partyName: string;
  postingDate: string;
  returnAgainst: string;
  totalQty: number | null;
};

export type BusinessDocumentListResult = {
  items: BusinessDocumentSummary[];
  summary: {
    totalCount: number;
    visibleCount: number;
  };
};

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function mapRow(row: Record<string, any>): BusinessDocumentSummary {
  return {
    amount: toOptionalNumber(row.amount),
    businessStatus: text(row.business_status),
    company: text(row.company),
    detailPath: text(row.detail_path),
    docstatus: Number(row.docstatus ?? 0),
    doctype: text(row.doctype) as BusinessDocumentDoctype,
    documentStatus: text(row.document_status),
    dueDate: text(row.due_date),
    isReturn: Boolean(row.is_return),
    modified: text(row.modified),
    name: text(row.name),
    outstandingAmount: toOptionalNumber(row.outstanding_amount),
    paidAmount: toOptionalNumber(row.paid_amount),
    party: text(row.party),
    partyName: text(row.party_name),
    postingDate: text(row.posting_date),
    returnAgainst: text(row.return_against),
    totalQty: toOptionalNumber(row.total_qty),
  };
}

export async function listBusinessDocuments(
  params: BusinessDocumentListParams,
): Promise<BusinessDocumentListResult> {
  const result = await callGatewayMethod<Record<string, any>>(
    'list_business_documents_v1',
    compactPayload({
      company: params.company,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      docstatus: params.docstatus ?? 'submitted',
      doctype: params.doctype,
      limit: params.limit,
      party: params.party,
      search_key: params.searchKey,
      sort_by: params.sortBy ?? 'latest',
      start: params.start,
    }),
  );

  const data = readObject(result.data);
  const rows = Array.isArray(data.items) ? data.items : [];
  const pagination = readObject(data.pagination);
  const summary = readObject(data.summary);
  const visibleCount =
    toOptionalNumber(pagination.total_count) ??
    toOptionalNumber(summary.visible_count) ??
    rows.length;

  return {
    items: rows.map((row) => mapRow(readObject(row))),
    summary: {
      totalCount: toOptionalNumber(summary.total_count) ?? visibleCount,
      visibleCount,
    },
  };
}
