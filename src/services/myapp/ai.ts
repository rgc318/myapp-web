import { callGatewayMethod } from './api-client';
import { buildMyAppApiUrl } from './api-base';
import { readObject, toNumber, toStringList } from './api-utils';
import { getMyAppAuthHeaders } from './auth-storage';
import { runGatewayMutation } from './mutation';
import {
  getPurchaseInvoiceDetail,
  getPurchaseOrderDetail,
} from './purchase';
import { getSalesInvoiceDetail, getSalesOrderDetail } from './sales';

export type AiChatRole = 'user' | 'assistant';

export type AiScenario =
  | 'auto'
  | 'general'
  | 'product_search'
  | 'order_query'
  | 'report_summary'
  | 'sales_order_draft'
  | 'purchase_order_draft'
  | 'inventory_adjustment_draft'
  | 'product_setup_draft';

export type AiSelectableModel = {
  capability: string;
  displayName: string;
  lastErrorCode: string | null;
  lastHealthAt: string | null;
  lastHealthStatus: string | null;
  modelAlias: string;
  status: string;
  supportsJsonSchema: boolean;
  supportsStreaming: boolean;
};

export type AiWorkspaceCapabilities = {
  canSelectFixedModel: boolean;
  canViewAdvancedDiagnostics: boolean;
};

export type AiWorkspaceOptions = {
  capabilities: AiWorkspaceCapabilities;
  models: AiSelectableModel[];
};

export type AiDraft = {
  company: string | null;
  conversationId: string | null;
  creation: string | null;
  draftType:
    | 'sales_order'
    | 'purchase_order'
    | 'inventory_adjustment'
    | 'product_setup';
  modified: string | null;
  name: string;
  title: string;
  status: string;
  sourceRun: string | null;
  version: number;
  validation: { readyForHandoff: boolean; errors: string[]; warnings: string[] };
  payload: Record<string, unknown>;
  execution: AiDraftExecution | null;
};

export type AiDraftExecution = {
  executedAt: string | null;
  executedBy: string | null;
  requestId: string | null;
  result: Record<string, unknown>;
  targetDoctype: string | null;
  targetName: string | null;
};

export class AiDraftVersionConflictError extends Error {
  code = 'AI_DRAFT_VERSION_CONFLICT';

  constructor(message = '草稿版本已变化，请对比最新版本后继续。') {
    super(message);
    this.name = 'AiDraftVersionConflictError';
  }
}

export class AiStreamError extends Error {
  code: string;
  conversationId: string | null;
  modelAlias: string | null;
  modelDisplay: string | null;
  providerErrorCode: string | null;
  runId: string | null;

  constructor(
    message: string,
    options: {
      code: string;
      conversationId?: string | null;
      modelAlias?: string | null;
      modelDisplay?: string | null;
      providerErrorCode?: string | null;
      runId?: string | null;
    },
  ) {
    super(message);
    this.name = 'AiStreamError';
    this.code = options.code;
    this.conversationId = options.conversationId ?? null;
    this.modelAlias = options.modelAlias ?? null;
    this.modelDisplay = options.modelDisplay ?? null;
    this.providerErrorCode = options.providerErrorCode ?? null;
    this.runId = options.runId ?? null;
  }
}

export function getAiErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && code.trim() ? code.trim() : null;
}

export function getAiErrorModelDetails(error: unknown): {
  modelAlias: string | null;
  modelDisplay: string | null;
  providerErrorCode: string | null;
} {
  if (!error || typeof error !== 'object') {
    return { modelAlias: null, modelDisplay: null, providerErrorCode: null };
  }
  const candidate = error as {
    data?: unknown;
    modelAlias?: unknown;
    modelDisplay?: unknown;
    providerErrorCode?: unknown;
  };
  const data = readObject(candidate.data);
  const optionalText = (value: unknown) =>
    typeof value === 'string' && value.trim() ? value.trim() : null;
  return {
    modelAlias:
      optionalText(candidate.modelAlias) ?? optionalText(data.model_alias),
    modelDisplay:
      optionalText(candidate.modelDisplay) ?? optionalText(data.model_display),
    providerErrorCode:
      optionalText(candidate.providerErrorCode) ??
      optionalText(data.provider_error_code),
  };
}

export function isAiDraftVersionConflictError(
  error: unknown,
): error is AiDraftVersionConflictError {
  if (error instanceof AiDraftVersionConflictError) return true;
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return (
    candidate.code === 'AI_DRAFT_VERSION_CONFLICT' ||
    (typeof candidate.message === 'string' &&
      candidate.message.includes('草稿版本已变化'))
  );
}

function translateAiDraftMutationError(error: unknown): never {
  if (isAiDraftVersionConflictError(error)) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : undefined;
    throw new AiDraftVersionConflictError(message);
  }
  throw error;
}

export type AiSalesOrderDraft = AiDraft;

export type AiCitation = {
  type: string;
  id: string | null;
  label: string;
  href: string | null;
  data: Record<string, unknown>;
};

export type AiBusinessDocumentType =
  | 'sales_order'
  | 'sales_invoice'
  | 'purchase_order'
  | 'purchase_invoice';

export type AiBusinessDocumentResult = {
  amount: number;
  company: string | null;
  currency: string;
  deliveryDate: string | null;
  documentStatus: string | null;
  dueDate: string | null;
  href: string | null;
  id: string;
  label: string;
  outstandingAmount: number;
  paidAmount: number;
  party: string | null;
  snapshotAt: string | null;
  snapshotSource: 'answer' | 'refresh';
  transactionDate: string | null;
  type: AiBusinessDocumentType;
};

export type AiBusinessResultGroup = {
  availableCount: number | null;
  entity: AiBusinessDocumentType;
  items: AiBusinessDocumentResult[];
  label: string;
  moduleHref: string | null;
  requestedCount: number | null;
  returnedCount: number;
  status: 'success' | 'partial' | 'empty';
  truncated: boolean | null;
};

export type AiBusinessResultSet = {
  groups: AiBusinessResultGroup[];
  permissionFiltered: boolean;
  queriedAt: string | null;
  resultType: 'business_documents';
  schemaVersion: string;
  snapshotSource: 'answer' | 'refresh';
  scope: {
    company: string | null;
    dateFrom: string | null;
    dateRange: string | null;
    dateTo: string | null;
    excludeCancelled: boolean;
    limitPerGroup: number | null;
    minAmount: number | null;
    sortBy: string | null;
    statusFilter: string | null;
  };
};

export type AiBusinessDocumentDetail = {
  amount: number | null;
  company: string;
  currency: string;
  date: string;
  documentStatus: string;
  dueOrTargetDate: string;
  href: string | null;
  id: string;
  items: Array<{
    amount: number | null;
    imageUrl?: string | null;
    itemCode: string;
    itemName: string;
    qty: number | null;
    rate: number | null;
    specification?: string | null;
    uom: string;
    uomDisplay: string | null;
    warehouse: string;
  }>;
  outstandingAmount: number | null;
  paidAmount: number | null;
  party: string;
  references: string[];
  remarks: string;
  type: AiBusinessDocumentType;
};

export type AiChatMessage = {
  role: AiChatRole;
  content: string;
  citations?: AiCitation[];
};

export type AiAgentApproval = {
  approvalId: string;
  argumentsSummary: Record<string, unknown>;
  callId: string;
  conversationId: string | null;
  decisionReason: string | null;
  expiresAt: string | null;
  requestedAt: string | null;
  riskLevel: string;
  runId: string;
  runStatus: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  tool: string;
  version: number;
};

export type AiConversation = {
  name: string;
  title: string;
  status: 'active' | 'archived';
  company: string | null;
  messageCount: number;
  pendingDraftCount: number;
  lastMessageAt: string | null;
  creation: string | null;
  modified: string | null;
};

export type AiConversationContext = {
  status: 'active' | 'empty' | 'expired' | 'invalid';
  resetReason: 'expired' | 'invalid_state' | 'user_reset' | null;
  stateVersion: number;
  updatedAt: string | null;
  expiresAt: string | null;
  contextStartSequence: number;
  state: Record<string, unknown>;
};

export type AiConversationMessage = AiChatMessage & {
  name: string;
  sequence: number;
  scenario: AiScenario | null;
  runId: string | null;
  promptVersion: string | null;
  run: AiRunSummary | null;
  feedback: AiPersistedFeedback | null;
  creation: string | null;
};

export type AiConversationMessagePagination = {
  hasMore: boolean;
  limit: number;
  nextBeforeSequence: number | null;
  returnedCount: number;
  total: number;
};

export type AiTokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens: number;
};

export type AiRunSummary = {
  error: string | null;
  errorCode: string | null;
  firstTokenMs: number | null;
  latencyMs: number;
  model: string | null;
  modelAlias: string | null;
  modelDisplay: string | null;
  modelSelection: 'auto' | 'fixed';
  requestedModelAlias: string | null;
  requestedModelDisplay: string | null;
  status: string;
  traceId: string | null;
  usage: AiTokenUsage;
};

export type AiPersistedFeedback = {
  category: string | null;
  comment: string | null;
  rating: 'positive' | 'negative';
};

export type AiEvent = {
  type: string;
  [key: string]: unknown;
};

export type AiChatResult = {
  approval?: AiAgentApproval | null;
  conversationId: string;
  runId: string | null;
  message: AiChatMessage;
  model: string | null;
  modelAlias: string | null;
  modelDisplay: string | null;
  traceId: string | null;
  run: AiRunSummary;
  stream: {
    deltaCount: number;
    streamedChars: number;
  };
  usage: AiTokenUsage;
  warnings: string[];
  events: AiEvent[];
};

function mapAiAgentApproval(value: unknown): AiAgentApproval | null {
  const row = readObject(value);
  const approvalId = typeof row.approval_id === 'string' ? row.approval_id : '';
  if (!approvalId) return null;
  const rawStatus = String(row.status ?? 'pending');
  const status: AiAgentApproval['status'] =
    rawStatus === 'approved' || rawStatus === 'rejected' || rawStatus === 'expired'
      ? rawStatus
      : 'pending';
  return {
    approvalId,
    argumentsSummary: readObject(row.arguments_summary),
    callId: String(row.call_id ?? ''),
    conversationId:
      typeof row.conversation_id === 'string' ? row.conversation_id : null,
    decisionReason:
      typeof row.decision_reason === 'string' ? row.decision_reason : null,
    expiresAt: typeof row.expires_at === 'string' ? row.expires_at : null,
    requestedAt: typeof row.requested_at === 'string' ? row.requested_at : null,
    riskLevel: String(row.risk_level ?? ''),
    runId: String(row.run_id ?? ''),
    runStatus: typeof row.run_status === 'string' ? row.run_status : null,
    status,
    tool: String(row.tool ?? ''),
    version: toNumber(row.version),
  };
}

function mapChatResult(value: unknown): AiChatResult {
  const data = readObject(value);
  const responseMessage = readObject(data.message);
  const usage = readObject(data.usage);
  const run = readObject(data.run);
  const stream = readObject(data.stream);
  return {
    approval: mapAiAgentApproval(data.approval),
    conversationId: String(data.conversation ?? ''),
    runId: typeof data.run_id === 'string' ? data.run_id : null,
    message: {
      role: 'assistant',
      content: String(responseMessage.content ?? ''),
      citations: Array.isArray(responseMessage.citations)
        ? responseMessage.citations.map(mapCitation)
        : Array.isArray(data.citations)
          ? data.citations.map(mapCitation)
          : [],
    },
    model: typeof data.model === 'string' ? data.model : null,
    modelAlias: typeof data.model_alias === 'string' ? data.model_alias : null,
    modelDisplay:
      typeof data.model_display === 'string' ? data.model_display : null,
    traceId: typeof data.trace_id === 'string' ? data.trace_id : null,
    run: {
      error: typeof run.error === 'string' ? run.error : null,
      errorCode:
        typeof run.error_code === 'string' ? run.error_code : null,
      firstTokenMs:
        run.first_token_ms === null || run.first_token_ms === undefined
          ? null
          : toNumber(run.first_token_ms),
      latencyMs: toNumber(run.latency_ms),
      model: typeof data.model === 'string' ? data.model : null,
      modelAlias:
        typeof data.model_alias === 'string' ? data.model_alias : null,
      modelDisplay:
        typeof data.model_display === 'string' ? data.model_display : null,
      modelSelection: run.model_selection === 'fixed' ? 'fixed' : 'auto',
      requestedModelAlias:
        typeof run.requested_model_alias === 'string'
          ? run.requested_model_alias
          : null,
      requestedModelDisplay:
        typeof run.requested_model_display === 'string'
          ? run.requested_model_display
          : null,
      status: String(run.status ?? 'completed'),
      traceId: typeof data.trace_id === 'string' ? data.trace_id : null,
      usage: {
        promptTokens: toNumber(usage.prompt_tokens),
        completionTokens: toNumber(usage.completion_tokens),
        totalTokens: toNumber(usage.total_tokens),
        reasoningTokens: toNumber(usage.reasoning_tokens),
      },
    },
    stream: {
      deltaCount: toNumber(stream.delta_count),
      streamedChars: toNumber(stream.streamed_chars),
    },
    usage: {
      promptTokens: toNumber(usage.prompt_tokens),
      completionTokens: toNumber(usage.completion_tokens),
      totalTokens: toNumber(usage.total_tokens),
      reasoningTokens: toNumber(usage.reasoning_tokens),
    },
    warnings: toStringList(data.warnings),
    events: Array.isArray(data.events)
      ? data.events.map((event) => readObject(event) as AiEvent)
      : [],
  };
}

export async function listAiAgentApprovals(payload: {
  runId?: string | null;
  status?: AiAgentApproval['status'] | null;
  start?: number;
  limit?: number;
} = {}): Promise<{ items: AiAgentApproval[]; hasMore: boolean }> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'list_ai_agent_approvals_v1',
    {
      ...(payload.runId ? { run_id: payload.runId } : {}),
      ...(payload.status ? { status: payload.status } : {}),
      start: payload.start ?? 0,
      limit: payload.limit ?? 20,
    },
  );
  const data = readObject(result.data);
  return {
    items: Array.isArray(data.items)
      ? data.items.map(mapAiAgentApproval).filter(Boolean) as AiAgentApproval[]
      : [],
    hasMore: Boolean(data.has_more),
  };
}

export async function reviewAiAgentApproval(
  approval: AiAgentApproval,
  decision: 'approved' | 'rejected',
  reason?: string,
): Promise<Record<string, unknown>> {
  const result = await runGatewayMutation<Record<string, unknown>>(
    'review_ai_agent_approval_v1',
    {
      notifyError: false,
      payload: {
        approval_id: approval.approvalId,
        decision,
        expected_version: approval.version,
        ...(reason ? { reason } : {}),
      },
      successMessage:
        decision === 'approved' ? '已批准并恢复 AI Run' : '已拒绝并恢复 AI Run',
    },
  );
  return readObject(result.data);
}

export async function cancelAiRun(
  runId: string,
): Promise<Record<string, unknown>> {
  const result = await runGatewayMutation<Record<string, unknown>>(
    'cancel_ai_run_v1',
    {
      notifyError: false,
      payload: { run_id: runId },
    },
  );
  return readObject(result.data);
}

function mapCitation(value: unknown): AiCitation {
  const row = readObject(value);
  return {
    type: typeof row.type === 'string' ? row.type : 'unknown',
    id: typeof row.id === 'string' ? row.id : null,
    label: typeof row.label === 'string' ? row.label : '',
    href: typeof row.href === 'string' ? row.href : null,
    data: readObject(row.data),
  };
}

const BUSINESS_DOCUMENT_TYPES: AiBusinessDocumentType[] = [
  'sales_order',
  'sales_invoice',
  'purchase_order',
  'purchase_invoice',
];

const BUSINESS_DOCUMENT_LABELS: Record<AiBusinessDocumentType, string> = {
  purchase_invoice: '采购发票',
  purchase_order: '采购订单',
  sales_invoice: '销售发票',
  sales_order: '销售订单',
};

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isBusinessDocumentType(value: unknown): value is AiBusinessDocumentType {
  return BUSINESS_DOCUMENT_TYPES.includes(value as AiBusinessDocumentType);
}

export function resolveAiBusinessResultSet(
  citations: AiCitation[] = [],
): AiBusinessResultSet | null {
  const resultSetCitation = citations.find(
    (citation) => citation.type === 'business_result_set',
  );
  const resultSetData = readObject(resultSetCitation?.data);
  const scope = readObject(resultSetData.scope);
  const documentRows = citations
    .filter((citation) => isBusinessDocumentType(citation.type))
    .map<AiBusinessDocumentResult>((citation) => ({
      amount: toNumber(citation.data.amount),
      company: optionalText(citation.data.company),
      currency: optionalText(citation.data.currency) ?? 'CNY',
      deliveryDate: optionalText(citation.data.delivery_date),
      documentStatus: optionalText(citation.data.document_status),
      dueDate: optionalText(citation.data.due_date),
      href: citation.href,
      id: citation.id ?? citation.label,
      label: citation.label,
      outstandingAmount: toNumber(citation.data.outstanding_amount),
      paidAmount: toNumber(citation.data.paid_amount),
      party: optionalText(citation.data.party),
      snapshotAt: optionalText(resultSetData.queried_at),
      snapshotSource:
        resultSetData.snapshot_source === 'refresh' ? 'refresh' : 'answer',
      transactionDate: optionalText(citation.data.transaction_date),
      type: citation.type as AiBusinessDocumentType,
    }));

  if (!resultSetCitation && !documentRows.length) {
    return null;
  }

  const groupMetadata = Array.isArray(resultSetData.groups)
    ? resultSetData.groups.map((group) => readObject(group))
    : [];
  const groupTypes = groupMetadata.length
    ? groupMetadata
        .map((group) => group.entity)
        .filter(isBusinessDocumentType)
    : BUSINESS_DOCUMENT_TYPES.filter((type) =>
        documentRows.some((row) => row.type === type),
      );

  const groups = groupTypes.map<AiBusinessResultGroup>((entity) => {
    const metadata =
      groupMetadata.find((group) => group.entity === entity) ?? {};
    const items = documentRows.filter((row) => row.type === entity);
    const requestedCount =
      metadata.requested_count === null ||
      metadata.requested_count === undefined
        ? null
        : toNumber(metadata.requested_count);
    const statusValue = optionalText(metadata.status);
    const status =
      statusValue === 'empty' || statusValue === 'partial'
        ? statusValue
        : items.length === 0
          ? 'empty'
          : requestedCount !== null && items.length < requestedCount
            ? 'partial'
            : 'success';
    const availableCount =
      metadata.available_count === null ||
      metadata.available_count === undefined
        ? null
        : toNumber(metadata.available_count);
    return {
      availableCount,
      entity,
      items,
      label: optionalText(metadata.label) ?? BUSINESS_DOCUMENT_LABELS[entity],
      moduleHref: optionalText(metadata.module_href),
      requestedCount,
      returnedCount: items.length,
      status,
      truncated:
        typeof metadata.truncated === 'boolean' ? metadata.truncated : null,
    };
  });

  return {
    groups,
    permissionFiltered: Boolean(resultSetData.permission_filtered),
    queriedAt: optionalText(resultSetData.queried_at),
    resultType: 'business_documents',
    schemaVersion:
      optionalText(resultSetData.schema_version) ?? 'business-result-set-v0',
    scope: {
      company: optionalText(scope.company),
      dateFrom: optionalText(scope.date_from),
      dateRange: optionalText(scope.date_range),
      dateTo: optionalText(scope.date_to),
      excludeCancelled:
        typeof scope.exclude_cancelled === 'boolean'
          ? scope.exclude_cancelled
          : true,
      limitPerGroup:
        scope.limit_per_group === null || scope.limit_per_group === undefined
          ? null
          : toNumber(scope.limit_per_group),
      minAmount:
        scope.min_amount === null || scope.min_amount === undefined
          ? null
          : toNumber(scope.min_amount),
      sortBy: optionalText(scope.sort_by),
      statusFilter: optionalText(scope.status_filter),
    },
    snapshotSource:
      resultSetData.snapshot_source === 'refresh' ? 'refresh' : 'answer',
  };
}

function serializeAiBusinessResultSet(resultSet: AiBusinessResultSet) {
  return {
    groups: resultSet.groups.map((group) => ({
      entity: group.entity,
      requested_count: group.requestedCount,
    })),
    result_type: resultSet.resultType,
    schema_version: resultSet.schemaVersion,
    scope: {
      company: resultSet.scope.company,
      date_from: resultSet.scope.dateFrom,
      date_range: resultSet.scope.dateRange,
      date_to: resultSet.scope.dateTo,
      exclude_cancelled: resultSet.scope.excludeCancelled,
      limit_per_group: resultSet.scope.limitPerGroup,
      min_amount: resultSet.scope.minAmount,
      sort_by: resultSet.scope.sortBy,
      status_filter: resultSet.scope.statusFilter,
    },
  };
}

export async function refreshAiBusinessResult(
  resultSet: AiBusinessResultSet,
): Promise<{ citations: AiCitation[]; resultSet: AiBusinessResultSet }> {
  const response = await callGatewayMethod<Record<string, unknown>>(
    'refresh_ai_business_result_v1',
    { result_set: serializeAiBusinessResultSet(resultSet) },
  );
  const data = readObject(response.data);
  const citations = Array.isArray(data.citations)
    ? data.citations.map(mapCitation)
    : [];
  const refreshed = resolveAiBusinessResultSet(citations);
  if (!refreshed) {
    throw new Error('刷新结果缺少结构化业务数据。');
  }
  return { citations, resultSet: refreshed };
}

export async function getAiBusinessDocumentDetail(
  document: AiBusinessDocumentResult,
): Promise<AiBusinessDocumentDetail | null> {
  if (document.type === 'sales_order') {
    const detail = await getSalesOrderDetail(document.id);
    if (!detail) return null;
    return {
      amount: detail.amount,
      company: detail.company,
      currency: detail.currency,
      date: detail.transactionDate,
      documentStatus: detail.documentStatus,
      dueOrTargetDate: detail.deliveryDate,
      href: document.href,
      id: detail.name,
      items: detail.items,
      outstandingAmount: detail.outstandingAmount,
      paidAmount: detail.paidAmount,
      party: detail.customer,
      references: [...detail.deliveryNotes, ...detail.salesInvoices],
      remarks: detail.remarks,
      type: document.type,
    };
  }
  if (document.type === 'sales_invoice') {
    const detail = await getSalesInvoiceDetail(document.id);
    if (!detail) return null;
    return {
      amount: detail.grandTotal,
      company: detail.company,
      currency: detail.currency,
      date: detail.postingDate,
      documentStatus: detail.documentStatus,
      dueOrTargetDate: detail.dueDate,
      href: document.href,
      id: detail.name,
      items: detail.items,
      outstandingAmount: detail.outstandingAmount,
      paidAmount: detail.paidAmount,
      party: document.party ?? '',
      references: [...detail.salesOrders, ...detail.deliveryNotes],
      remarks: detail.remarks,
      type: document.type,
    };
  }
  if (document.type === 'purchase_order') {
    const detail = await getPurchaseOrderDetail(document.id);
    if (!detail) return null;
    return {
      amount: detail.amount,
      company: detail.company,
      currency: detail.currency,
      date: detail.transactionDate,
      documentStatus: detail.documentStatus,
      dueOrTargetDate: detail.scheduleDate,
      href: document.href,
      id: detail.name,
      items: detail.items,
      outstandingAmount: detail.outstandingAmount,
      paidAmount: detail.paidAmount,
      party: detail.supplierName || detail.supplier,
      references: [...detail.purchaseReceipts, ...detail.purchaseInvoices],
      remarks: detail.remarks,
      type: document.type,
    };
  }
  const detail = await getPurchaseInvoiceDetail(document.id);
  if (!detail) return null;
  return {
    amount: detail.amount,
    company: detail.company,
    currency: detail.currency,
    date: detail.postingDate,
    documentStatus: detail.documentStatus,
    dueOrTargetDate: detail.dueDate,
    href: document.href,
    id: detail.name,
    items: detail.items,
    outstandingAmount: detail.outstandingAmount,
    paidAmount: detail.paidAmount,
    party: detail.supplierName || detail.supplier,
    references: [...detail.purchaseOrders, ...detail.purchaseReceipts],
    remarks: detail.remarks,
    type: document.type,
  };
}

export function mapAiDraft(value: unknown): AiDraft {
  const row = readObject(value);
  const validation = readObject(row.validation);
  const execution = readObject(row.execution);
  return {
    company: typeof row.company === 'string' ? row.company : null,
    conversationId:
      typeof row.conversation === 'string' ? row.conversation : null,
    creation: typeof row.creation === 'string' ? row.creation : null,
    draftType:
      row.draft_type === 'product_setup'
        ? 'product_setup'
        : row.draft_type === 'purchase_order'
        ? 'purchase_order'
        : row.draft_type === 'inventory_adjustment'
          ? 'inventory_adjustment'
          : 'sales_order',
    modified: typeof row.modified === 'string' ? row.modified : null,
    name: String(row.name ?? ''),
    title: String(row.title ?? '销售订单草稿'),
    status: String(row.status ?? 'draft'),
    sourceRun: typeof row.source_run === 'string' ? row.source_run : null,
    version: toNumber(row.version, 1),
    payload: readObject(row.payload),
    execution: row.execution
      ? {
          executedAt:
            typeof execution.executed_at === 'string'
              ? execution.executed_at
              : null,
          executedBy:
            typeof execution.executed_by === 'string'
              ? execution.executed_by
              : null,
          requestId:
            typeof execution.request_id === 'string'
              ? execution.request_id
              : null,
          result: readObject(execution.result),
          targetDoctype:
            typeof execution.target_doctype === 'string'
              ? execution.target_doctype
              : null,
          targetName:
            typeof execution.target_name === 'string'
              ? execution.target_name
              : null,
        }
      : null,
    validation: {
      readyForHandoff: Boolean(validation.ready_for_handoff),
      errors: toStringList(validation.errors),
      warnings: toStringList(validation.warnings),
    },
  };
}

export function resolveAiDraftCitation(citation: AiCitation): AiDraft | null {
  if (citation.type !== 'ai_draft') return null;
  const draft = mapAiDraft({
    ...citation.data,
    name: citation.data.name ?? citation.id,
    title: citation.data.title ?? citation.label,
  });
  return draft.name ? draft : null;
}

export async function getAiDraft(draftId: string): Promise<AiDraft> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'get_ai_draft_v1',
    { draft_id: draftId },
  );
  return mapAiDraft(result.data);
}

export async function listAiDrafts(params: {
  current?: number;
  draftType?: AiDraft['draftType'];
  pageSize?: number;
  status?: 'draft' | 'executed' | 'handed_off' | 'discarded' | 'all';
} = {}): Promise<{ items: AiDraft[]; total: number }> {
  const pageSize = params.pageSize ?? 20;
  const start = Math.max(0, ((params.current ?? 1) - 1) * pageSize);
  const result = await callGatewayMethod<Record<string, unknown>>(
    'list_ai_drafts_v1',
    {
      draft_type: params.draftType,
      limit: pageSize,
      start,
      status: params.status ?? 'draft',
    },
  );
  const data = readObject(result.data);
  return {
    items: Array.isArray(data.items)
      ? data.items.map(mapAiDraft)
      : [],
    total: toNumber(readObject(data.pagination).total),
  };
}

function mapConversation(value: unknown): AiConversation {
  const row = readObject(value);
  return {
    name: String(row.name ?? ''),
    title: String(row.title ?? '新会话'),
    status: row.status === 'archived' ? 'archived' : 'active',
    company: typeof row.company === 'string' ? row.company : null,
    messageCount: toNumber(row.message_count),
    pendingDraftCount: toNumber(row.pending_draft_count),
    lastMessageAt:
      typeof row.last_message_at === 'string' ? row.last_message_at : null,
    creation: typeof row.creation === 'string' ? row.creation : null,
    modified: typeof row.modified === 'string' ? row.modified : null,
  };
}

function mapConversationContext(value: unknown): AiConversationContext {
  const row = readObject(value);
  const status = String(row.status ?? 'empty');
  return {
    status:
      status === 'active' ||
      status === 'expired' ||
      status === 'invalid'
        ? status
        : 'empty',
    resetReason:
      row.reset_reason === 'expired' ||
      row.reset_reason === 'invalid_state' ||
      row.reset_reason === 'user_reset'
        ? row.reset_reason
        : null,
    stateVersion: toNumber(row.version),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
    expiresAt: typeof row.expires_at === 'string' ? row.expires_at : null,
    contextStartSequence: Math.max(
      1,
      toNumber(row.context_start_sequence) || 1,
    ),
    state: readObject(row.state),
  };
}

function mapConversationMessage(value: unknown): AiConversationMessage {
  const row = readObject(value);
  return {
    name: String(row.name ?? ''),
    sequence: toNumber(row.sequence),
    role: row.role === 'assistant' ? 'assistant' : 'user',
    content: String(row.content ?? ''),
    scenario:
      typeof row.scenario === 'string' ? (row.scenario as AiScenario) : null,
    runId: typeof row.run_id === 'string' ? row.run_id : null,
    citations: Array.isArray(row.citations)
      ? row.citations.map(mapCitation)
      : [],
    promptVersion:
      typeof row.prompt_version === 'string' ? row.prompt_version : null,
    run: (() => {
      const run = readObject(row.run);
      if (!Object.keys(run).length) return null;
      const usage = readObject(run.usage);
      return {
        error: typeof run.error === 'string' ? run.error : null,
        errorCode:
          typeof run.error_code === 'string' ? run.error_code : null,
        firstTokenMs:
          run.first_token_ms === null || run.first_token_ms === undefined
            ? null
            : toNumber(run.first_token_ms),
        latencyMs: toNumber(run.latency_ms),
        model: typeof run.model === 'string' ? run.model : null,
        modelAlias:
          typeof run.model_alias === 'string' ? run.model_alias : null,
        modelDisplay:
          typeof run.model_display === 'string' ? run.model_display : null,
        modelSelection: run.model_selection === 'fixed' ? 'fixed' : 'auto',
        requestedModelAlias:
          typeof run.requested_model_alias === 'string'
            ? run.requested_model_alias
            : null,
        requestedModelDisplay:
          typeof run.requested_model_display === 'string'
            ? run.requested_model_display
            : null,
        status: String(run.status ?? ''),
        traceId: typeof run.trace_id === 'string' ? run.trace_id : null,
        usage: {
          promptTokens: toNumber(usage.prompt_tokens),
          completionTokens: toNumber(usage.completion_tokens),
          totalTokens: toNumber(usage.total_tokens),
          reasoningTokens: toNumber(usage.reasoning_tokens),
        },
      };
    })(),
    feedback: (() => {
      const feedback = readObject(row.feedback);
      if (
        feedback.rating !== 'positive' &&
        feedback.rating !== 'negative'
      ) {
        return null;
      }
      return {
        category:
          typeof feedback.category === 'string' ? feedback.category : null,
        comment: typeof feedback.comment === 'string' ? feedback.comment : null,
        rating: feedback.rating,
      };
    })(),
    creation: typeof row.creation === 'string' ? row.creation : null,
  };
}

export async function listAiSelectableModels(): Promise<AiWorkspaceOptions> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'list_ai_selectable_models_v1',
  );
  const data = readObject(result.data);
  const capabilities = readObject(data.capabilities);
  return {
    capabilities: {
      canSelectFixedModel: Boolean(capabilities.can_select_fixed_model),
      canViewAdvancedDiagnostics: Boolean(
        capabilities.can_view_advanced_diagnostics,
      ),
    },
    models: Array.isArray(data.items)
      ? data.items.map((value) => {
        const row = readObject(value);
        return {
          capability: String(row.capability ?? ''),
          displayName: String(row.display_name ?? row.model_alias ?? ''),
          lastErrorCode:
            typeof row.last_error_code === 'string'
              ? row.last_error_code
              : null,
          lastHealthAt:
            typeof row.last_health_at === 'string'
              ? row.last_health_at
              : null,
          lastHealthStatus:
            typeof row.last_health_status === 'string'
              ? row.last_health_status
              : null,
          modelAlias: String(row.model_alias ?? ''),
          status: String(row.status ?? ''),
          supportsJsonSchema: Boolean(row.supports_json_schema),
          supportsStreaming: Boolean(row.supports_streaming),
        };
      })
      : [],
  };
}

export async function listAiConversations(params?: {
  status?: 'active' | 'archived' | 'all';
  search?: string;
  start?: number;
  limit?: number;
}): Promise<{
  items: AiConversation[];
  pendingDraftTotal: number;
  total: number;
}> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'list_ai_conversations_v1',
    {
      status: params?.status ?? 'active',
      ...(params?.search?.trim() ? { search: params.search.trim() } : {}),
      start: params?.start ?? 0,
      limit: params?.limit ?? 50,
    },
  );
  const data = readObject(result.data);
  const pagination = readObject(data.pagination);
  return {
    items: Array.isArray(data.items) ? data.items.map(mapConversation) : [],
    pendingDraftTotal: toNumber(data.pending_draft_total),
    total: toNumber(pagination.total),
  };
}

export async function renameAiConversation(
  conversationId: string,
  title: string,
): Promise<AiConversation> {
  const result = await runGatewayMutation<AiConversation>(
    'rename_ai_conversation_v1',
    {
      payload: { conversation_id: conversationId, title },
      transform: mapConversation,
    },
  );
  return result.data;
}

export async function createAiConversation(payload: {
  title?: string;
  company?: string | null;
}): Promise<AiConversation> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'create_ai_conversation_v1',
    {
      ...(payload.title ? { title: payload.title } : {}),
      ...(payload.company ? { company: payload.company } : {}),
    },
  );
  return mapConversation(result.data);
}

export async function getAiConversation(
  conversationId: string,
  params?: { beforeSequence?: number | null; limit?: number },
): Promise<{
  conversation: AiConversation;
  context?: AiConversationContext;
  messages: AiConversationMessage[];
  pagination: AiConversationMessagePagination;
}> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'get_ai_conversation_v1',
    {
      conversation_id: conversationId,
      limit: params?.limit ?? 40,
      ...(params?.beforeSequence
        ? { before_sequence: params.beforeSequence }
        : {}),
    },
  );
  const data = readObject(result.data);
  const conversation = mapConversation(data.conversation);
  const pagination = readObject(data.pagination);
  const messages = Array.isArray(data.messages)
    ? data.messages.map(mapConversationMessage)
    : [];
  return {
    conversation,
    context: mapConversationContext(data.context),
    messages,
    pagination: {
      hasMore: Boolean(pagination.has_more),
      limit: toNumber(pagination.limit) || params?.limit || 40,
      nextBeforeSequence:
        pagination.next_before_sequence === null ||
        pagination.next_before_sequence === undefined
          ? null
          : toNumber(pagination.next_before_sequence),
      returnedCount:
        toNumber(pagination.returned_count) || messages.length,
      total: toNumber(pagination.total) || conversation.messageCount,
    },
  };
}

export async function resetAiConversationContext(
  conversationId: string,
): Promise<AiConversationContext> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'reset_ai_conversation_context_v1',
    { conversation_id: conversationId },
  );
  return mapConversationContext(result.data);
}

export async function archiveAiConversation(
  conversationId: string,
): Promise<AiConversation> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'archive_ai_conversation_v1',
    { conversation_id: conversationId },
  );
  return mapConversation(result.data);
}

export async function submitAiFeedback(payload: {
  runId: string;
  rating: 'positive' | 'negative';
  category?: 'helpful' | 'incorrect' | 'incomplete' | 'unsafe' | 'other';
  comment?: string;
}): Promise<void> {
  await callGatewayMethod('submit_ai_feedback_v1', {
    run_id: payload.runId,
    rating: payload.rating,
    ...(payload.category ? { category: payload.category } : {}),
    ...(payload.comment ? { comment: payload.comment } : {}),
  });
}

export async function sendAiChatMessage(payload: {
  content: string;
  conversationId?: string | null;
  scenario?: AiScenario;
  company?: string | null;
  modelAlias?: string | null;
}): Promise<AiChatResult> {
  const result = await callGatewayMethod<Record<string, unknown>>('chat_ai_v1', {
    content: payload.content,
    scenario: payload.scenario ?? 'auto',
    ...(payload.conversationId
      ? { conversation_id: payload.conversationId }
      : {}),
    ...(payload.company ? { company: payload.company } : {}),
    ...(payload.modelAlias ? { model_alias: payload.modelAlias } : {}),
  });
  return mapChatResult(result.data);
}

export async function generateAiSalesOrderDraft(payload: {
  content: string;
  conversationId?: string | null;
  company: string;
  modelAlias?: string | null;
}): Promise<AiChatResult & { draft: AiSalesOrderDraft }> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'generate_ai_sales_order_draft_v1',
    {
      content: payload.content,
      company: payload.company,
      ...(payload.modelAlias ? { model_alias: payload.modelAlias } : {}),
      ...(payload.conversationId
        ? { conversation_id: payload.conversationId }
        : {}),
    },
  );
  const data = readObject(result.data);
  return { ...mapChatResult(data), draft: mapAiDraft(data.draft) };
}

export async function generateAiPurchaseOrderDraft(payload: {
  content: string;
  conversationId?: string | null;
  company: string;
  modelAlias?: string | null;
}): Promise<AiChatResult & { draft: AiSalesOrderDraft }> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'generate_ai_purchase_order_draft_v1',
    {
      content: payload.content,
      company: payload.company,
      ...(payload.modelAlias ? { model_alias: payload.modelAlias } : {}),
      ...(payload.conversationId ? { conversation_id: payload.conversationId } : {}),
    },
  );
  const data = readObject(result.data);
  return { ...mapChatResult(data), draft: mapAiDraft(data.draft) };
}

export async function generateAiInventoryAdjustmentDraft(payload: {
  content: string;
  conversationId?: string | null;
  company: string;
  modelAlias?: string | null;
}): Promise<AiChatResult & { draft: AiSalesOrderDraft }> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'generate_ai_inventory_adjustment_draft_v1',
    {
      content: payload.content,
      company: payload.company,
      ...(payload.modelAlias ? { model_alias: payload.modelAlias } : {}),
      ...(payload.conversationId
        ? { conversation_id: payload.conversationId }
        : {}),
    },
  );
  const data = readObject(result.data);
  return { ...mapChatResult(data), draft: mapAiDraft(data.draft) };
}

export async function resolveAiScenario(content: string): Promise<AiScenario> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'resolve_ai_scenario_v1',
    { content },
  );
  const scenario = String(readObject(result.data).scenario ?? 'general');
  return scenario as AiScenario;
}

export async function generateAiProductSetupDraft(payload: {
  content: string;
  conversationId?: string | null;
  company: string;
  modelAlias?: string | null;
}): Promise<AiChatResult & { draft: AiSalesOrderDraft }> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'generate_ai_product_setup_draft_v1',
    {
      content: payload.content,
      company: payload.company,
      ...(payload.modelAlias ? { model_alias: payload.modelAlias } : {}),
      ...(payload.conversationId
        ? { conversation_id: payload.conversationId }
        : {}),
    },
  );
  const data = readObject(result.data);
  return { ...mapChatResult(data), draft: mapAiDraft(data.draft) };
}

export async function prepareAiDraftHandoff(
  draftId: string,
): Promise<{ draftType: string; payload: Record<string, unknown> }> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'prepare_ai_draft_handoff_v1',
    { draft_id: draftId },
  );
  const data = readObject(result.data);
  return { draftType: String(data.draft_type ?? ''), payload: readObject(data.payload) };
}

export async function discardAiDraft(draftId: string): Promise<void> {
  await callGatewayMethod('discard_ai_draft_v1', { draft_id: draftId });
}

export async function executeAiDraft(
  draftId: string,
  expectedVersion: number,
): Promise<{ draft: AiDraft; execution: AiDraftExecution; replayed: boolean }> {
  const result = await runGatewayMutation<Record<string, unknown>>(
      'execute_ai_draft_v1',
      {
        idempotencyKey: `web-execute-ai-draft-${draftId}-v${expectedVersion}`,
        notifyError: false,
        payload: {
          confirmed: 1,
          draft_id: draftId,
          expected_version: expectedVersion,
        },
        successMessage: 'AI 草稿已执行',
      },
    ).catch(translateAiDraftMutationError);
  const data = readObject(result.data);
  const execution = readObject(data.execution);
  return {
    draft: mapAiDraft(data.draft),
    execution: {
      executedAt:
        typeof execution.executed_at === 'string'
          ? execution.executed_at
          : null,
      executedBy:
        typeof execution.executed_by === 'string'
          ? execution.executed_by
          : null,
      requestId:
        typeof execution.request_id === 'string'
          ? execution.request_id
          : null,
      result: readObject(execution.result),
      targetDoctype:
        typeof execution.target_doctype === 'string'
          ? execution.target_doctype
          : null,
      targetName:
        typeof execution.target_name === 'string'
          ? execution.target_name
          : null,
    },
    replayed: Boolean(data.replayed),
  };
}

export async function updateAiDraft(
  draftId: string,
  expectedVersion: number,
  payload: Record<string, unknown>,
): Promise<AiDraft> {
  const result = await runGatewayMutation<Record<string, unknown>>(
      'update_ai_draft_v1',
      {
        notifyError: false,
        payload: {
          draft_id: draftId,
          expected_version: expectedVersion,
          payload,
        },
      },
    ).catch(translateAiDraftMutationError);
  return mapAiDraft(result.data);
}

export async function listAiDraftVersions(
  draftId: string,
): Promise<Record<string, unknown>[]> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'list_ai_draft_versions_v1',
    { draft_id: draftId },
  );
  const data = readObject(result.data);
  return Array.isArray(data.items) ? data.items.map(readObject) : [];
}

export async function restoreAiDraftVersion(
  draftId: string,
  version: number,
  expectedVersion: number,
): Promise<Record<string, unknown>> {
  const result = await runGatewayMutation<Record<string, unknown>>(
    'restore_ai_draft_version_v1',
    {
      idempotencyKey: `web-restore-ai-draft-${draftId}-v${expectedVersion}-from-v${version}`,
      payload: {
        draft_id: draftId,
        expected_version: expectedVersion,
        version,
      },
    },
  );
  return readObject(result.data);
}

export async function streamAiChatMessage(
  payload: {
    content: string;
    conversationId?: string | null;
    scenario?: AiScenario;
    company?: string | null;
    modelAlias?: string | null;
    retryRunId?: string | null;
  },
  onEvent: (event: AiEvent) => void,
  signal?: AbortSignal,
): Promise<AiChatResult> {
  let response: Response;
  try {
    response = await fetch(
      buildMyAppApiUrl(
        '/api/method/myapp.api.gateway.stream_ai_message_v1',
      ),
      {
        method: 'POST',
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
          ...(getMyAppAuthHeaders() ?? {}),
        },
        body: JSON.stringify({
          content: payload.content,
          scenario: payload.scenario ?? 'auto',
          ...(payload.conversationId
            ? { conversation_id: payload.conversationId }
            : {}),
          ...(payload.company ? { company: payload.company } : {}),
          ...(payload.modelAlias ? { model_alias: payload.modelAlias } : {}),
          ...(payload.retryRunId ? { retry_run_id: payload.retryRunId } : {}),
        }),
        signal,
      },
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new AiStreamError('网络连接失败，请检查网络后重试。', {
      code: 'AI_NETWORK_ERROR',
    });
  }
  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    const outer = readObject(body);
    const envelope = readObject(outer.message ?? outer);
    const fallbackCode =
      ({
        401: 'AUTHENTICATION_REQUIRED',
        403: 'PERMISSION_DENIED',
        409: 'AI_PROMPT_VERSION_MISMATCH',
        422: 'VALIDATION_ERROR',
        429: 'AI_REQUEST_RATE_LIMITED',
      } as Record<number, string>)[response.status] ??
      'AI_SERVICE_UNAVAILABLE';
    throw new AiStreamError(
      typeof envelope.message === 'string'
        ? envelope.message
        : `AI 流式请求失败（HTTP ${response.status}）`,
      {
        code:
          typeof envelope.code === 'string'
            ? envelope.code
            : fallbackCode,
        modelAlias:
          typeof readObject(envelope.data).model_alias === 'string'
            ? String(readObject(envelope.data).model_alias)
            : null,
        modelDisplay:
          typeof readObject(envelope.data).model_display === 'string'
            ? String(readObject(envelope.data).model_display)
            : null,
        providerErrorCode:
          typeof readObject(envelope.data).provider_error_code === 'string'
            ? String(readObject(envelope.data).provider_error_code)
            : null,
      },
    );
  }
  if (!response.body) {
    throw new AiStreamError('当前浏览器不支持 AI 流式响应。', {
      code: 'AI_BROWSER_STREAM_UNSUPPORTED',
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed: AiEvent | null = null;
  let waitingApproval: AiEvent | null = null;

  const consumeBlock = (block: string) => {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('');
    if (!data) {
      return;
    }
    let event: AiEvent;
    try {
      event = readObject(JSON.parse(data)) as AiEvent;
    } catch {
      throw new AiStreamError('AI 流式响应格式异常，请稍后重试。', {
        code: 'AI_STREAM_PROTOCOL_ERROR',
      });
    }
    onEvent(event);
    if (event.type === 'error') {
      throw new AiStreamError(
        String(event.message ?? 'AI 流式服务调用失败'),
        {
          code: String(event.code ?? 'AI_STREAM_FAILED'),
          conversationId:
            typeof event.conversation === 'string'
              ? event.conversation
              : null,
          modelAlias:
            typeof event.model_alias === 'string' ? event.model_alias : null,
          modelDisplay:
            typeof event.model_display === 'string'
              ? event.model_display
              : null,
          providerErrorCode:
            typeof event.provider_error_code === 'string'
              ? event.provider_error_code
              : null,
          runId: typeof event.run_id === 'string' ? event.run_id : null,
        },
      );
    }
    if (event.type === 'completed') {
      completed = event;
    }
    if (event.type === 'waiting_approval') {
      waitingApproval = event;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? '';
    blocks.forEach(consumeBlock);
    if (done) {
      break;
    }
  }
  if (buffer.trim()) {
    consumeBlock(buffer);
  }
  const waitingEvent = waitingApproval as AiEvent | null;
  if (!completed && waitingEvent) {
    const approval = mapAiAgentApproval(waitingEvent.approval);
    return {
      approval,
      conversationId: String(waitingEvent.conversation ?? ''),
      runId:
        typeof waitingEvent.run_id === 'string'
          ? waitingEvent.run_id
          : approval?.runId ?? null,
      message: {
        role: 'assistant',
        content: '该工具调用需要人工审批后才能继续。',
        citations: [],
      },
      model: null,
      modelAlias: null,
      modelDisplay: null,
      traceId: null,
      run: {
        error: null,
        errorCode: null,
        firstTokenMs: null,
        latencyMs: toNumber(waitingEvent.latency_ms),
        model: null,
        modelAlias: null,
        modelDisplay: null,
        modelSelection: 'auto',
        requestedModelAlias: null,
        requestedModelDisplay: null,
        status: 'waiting_approval',
        traceId: null,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          reasoningTokens: 0,
        },
      },
      stream: { deltaCount: 0, streamedChars: 0 },
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        reasoningTokens: 0,
      },
      warnings: [],
      events: [],
    };
  }
  if (!completed) {
    throw new AiStreamError('AI 流式响应未正常完成。', {
      code: 'AI_STREAM_INCOMPLETE',
    });
  }
  return mapChatResult(completed);
}
