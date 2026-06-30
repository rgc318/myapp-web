import type { BusinessDocumentDoctype } from './documents';
import { listBusinessDocuments } from './documents';
import { runGatewayMutation } from './mutation';
import { compactPayload, readObject, toNumber, toOptionalText } from './api-utils';

export const PENDING_CONFIRMATION_DOCTYPES: BusinessDocumentDoctype[] = [
  'Delivery Note',
  'Sales Invoice',
  'Purchase Receipt',
  'Purchase Invoice',
];

export type PendingConfirmationDoctype = BusinessDocumentDoctype | 'all';

export type PendingConfirmationListParams = {
  company?: string;
  doctype?: PendingConfirmationDoctype;
  limit?: number;
  searchKey?: string;
  start?: number;
};

export type PendingConfirmationItem = {
  amount: number | null;
  businessStatus: string;
  company: string;
  detailPath: string;
  docstatus: number;
  doctype: BusinessDocumentDoctype;
  documentStatus: string;
  modified: string;
  name: string;
  party: string;
  partyName: string;
  postingDate: string;
};

export type PendingConfirmationListResult = {
  items: PendingConfirmationItem[];
  total: number;
};

export type ConfirmPendingDocumentPayload = {
  action?: string;
  docname: string;
  doctype: BusinessDocumentDoctype;
  submitOnConfirm?: boolean;
  updates?: Record<string, unknown>;
};

export type ConfirmPendingDocumentResult = {
  docname: string;
  docstatus: number;
  doctype: string;
  message: string;
  workflowState: string;
};

function buildDetailPath(doctype: BusinessDocumentDoctype, basePath: string, name: string) {
  if (basePath) {
    return `${basePath}/${encodeURIComponent(name)}`;
  }
  if (doctype === 'Delivery Note') {
    return `/sales/delivery-notes/${encodeURIComponent(name)}`;
  }
  if (doctype === 'Sales Invoice') {
    return `/sales/invoices/${encodeURIComponent(name)}`;
  }
  if (doctype === 'Purchase Receipt') {
    return `/purchase/receipts/${encodeURIComponent(name)}`;
  }
  return `/purchase/invoices/${encodeURIComponent(name)}`;
}

function mapPendingItem(item: Awaited<ReturnType<typeof listBusinessDocuments>>['items'][number]) {
  return {
    amount: item.amount,
    businessStatus: item.businessStatus,
    company: item.company,
    detailPath: buildDetailPath(item.doctype, item.detailPath, item.name),
    docstatus: item.docstatus,
    doctype: item.doctype,
    documentStatus: item.documentStatus,
    modified: item.modified,
    name: item.name,
    party: item.party,
    partyName: item.partyName,
    postingDate: item.postingDate,
  };
}

function compareByModifiedDesc(a: PendingConfirmationItem, b: PendingConfirmationItem) {
  return String(b.modified || '').localeCompare(String(a.modified || ''));
}

function resolveDoctypes(doctype: PendingConfirmationDoctype | undefined) {
  return doctype && doctype !== 'all' ? [doctype] : PENDING_CONFIRMATION_DOCTYPES;
}

export async function listPendingConfirmations(
  params: PendingConfirmationListParams = {},
): Promise<PendingConfirmationListResult> {
  const doctypes = resolveDoctypes(params.doctype);
  const limit = params.limit ?? 20;
  const start = params.start ?? 0;

  if (doctypes.length === 1) {
    const result = await listBusinessDocuments({
      company: params.company,
      docstatus: 'draft',
      doctype: doctypes[0],
      limit,
      searchKey: params.searchKey,
      sortBy: 'latest',
      start,
    });
    return {
      items: result.items.map(mapPendingItem),
      total: result.summary.visibleCount,
    };
  }

  const results = await Promise.all(
    doctypes.map((doctype) =>
      listBusinessDocuments({
        company: params.company,
        docstatus: 'draft',
        doctype,
        limit,
        searchKey: params.searchKey,
        sortBy: 'latest',
        start: 0,
      }),
    ),
  );
  const allItems = results
    .flatMap((result) => result.items.map(mapPendingItem))
    .sort(compareByModifiedDesc);

  return {
    items: allItems.slice(start, start + limit),
    total: results.reduce((total, result) => total + result.summary.visibleCount, 0),
  };
}

function mapConfirmResult(raw: unknown): ConfirmPendingDocumentResult {
  const row = readObject(raw);
  return {
    docname: String(row.docname ?? ''),
    docstatus: toNumber(row.docstatus),
    doctype: String(row.doctype ?? ''),
    message: String(row.message ?? ''),
    workflowState: String(row.workflow_state ?? ''),
  };
}

export async function confirmPendingDocument(
  payload: ConfirmPendingDocumentPayload,
) {
  return runGatewayMutation<ConfirmPendingDocumentResult>(
    'confirm_pending_document',
    {
      payload: compactPayload({
        action: toOptionalText(payload.action),
        docname: payload.docname,
        doctype: payload.doctype,
        submit_on_confirm: payload.submitOnConfirm === false ? 0 : 1,
        updates: payload.updates,
      }),
      successMessage: '单据已确认',
      transform: mapConfirmResult,
    },
  );
}
