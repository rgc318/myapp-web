import { callGatewayMethod } from './api-client';
import {
  compactPayload,
  readObject,
  toNumber,
  toOptionalNumber,
  toOptionalText,
  toStringList,
} from './api-utils';
import { runGatewayMutation } from './mutation';

export type AiAuditEvent = {
  action: string;
  actor: string;
  creation: string | null;
  objectName: string;
  objectType: string;
  priority: string;
  reason: string | null;
};

export type AiGovernanceOverview = {
  policyCounts: Record<string, number>;
  recentAudits: AiAuditEvent[];
  registryCounts: Record<string, number>;
};

export type AiModel = {
  capability: string;
  currency: string | null;
  dataRegion: string | null;
  embeddingDimensions: number | null;
  embeddingSpaceVersion: string | null;
  inputCost: number;
  lastErrorCode: string | null;
  lastHealthAt: string | null;
  lastHealthStatus: string | null;
  modelAlias: string;
  modified: string | null;
  outputCost: number;
  providerFamily: string | null;
  providerModelDisplay: string | null;
  registryVersion: number;
  retentionPolicy: string | null;
  sensitiveDataAllowed: boolean;
  status: string;
  supportsJsonSchema: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
};

export type AiPolicy = {
  approvedAt: string | null;
  approvedBy: string | null;
  budgetAction: string;
  budgetCurrency: string | null;
  capability: string;
  companyScope: string[];
  currentVersion: number;
  dailyBudget: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  environment: string;
  fallbackModelAliases: string[];
  lastValidatedAt: string | null;
  maxCompletionTokens: number;
  maxConcurrency: number;
  modified: string | null;
  monthlyBudget: number;
  owner: string | null;
  policyCode: string;
  policyName: string;
  primaryModelAlias: string;
  publishedAt: string | null;
  publishedVersion: number | null;
  reasoningEffort: string | null;
  requestsPerMinute: number;
  roleScope: string[];
  rolloutPercentage: number;
  rolloutSeed: string | null;
  scenario: string;
  status: string;
  timeoutSeconds: number;
  tokensPerMinute: number;
  validation: Record<string, unknown> | null;
};

export type AiPolicyVersion = {
  approvedAt: string | null;
  approvedBy: string | null;
  changeReason: string | null;
  contentHash: string;
  createdBy: string;
  creation: string | null;
  evaluation: Record<string, unknown> | null;
  policyCode: string;
  publishedAt: string | null;
  publishedBy: string | null;
  rollbackFromVersion: number | null;
  snapshot: Record<string, unknown>;
  status: string;
  validation: Record<string, unknown> | null;
  version: number;
};

export type AiUsageDaily = {
  company: string;
  completionTokens?: number;
  costCurrency: string | null;
  environment: string;
  errorCount: number;
  estimatedCost: number;
  fallbackCount: number;
  firstTokenAvgMs: number | null;
  firstTokenP50Ms: number | null;
  firstTokenP95Ms: number | null;
  latencyAvgMs: number | null;
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
  modelAlias: string;
  negativeFeedbackCount: number;
  policyCode: string;
  policyVersion: number;
  positiveFeedbackCount: number;
  positiveFeedbackRate: number | null;
  requestCount: number;
  scenario: string;
  successCount: number;
  totalTokens: number;
  usageDate: string;
};

export type AiVectorRelease = {
  aliasName: string;
  approvedAt: string | null;
  approvedBy: string | null;
  changeReason: string | null;
  collectionName: string;
  createdBy: string;
  creation: string | null;
  embeddingModel: string;
  environment: string;
  failedCount: number;
  indexVersion: string;
  indexedCount: number;
  modified: string | null;
  previousCollection: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  releaseCode: string;
  rollbackFromRelease: string | null;
  status: string;
  totalItems: number;
  validation: Record<string, unknown> | null;
  vectorSize: number | null;
};

export type AiDataTask = {
  analysis: Record<string, unknown>;
  analyzedAt: string | null;
  analyzedBy: string | null;
  beforeValue: Record<string, unknown>;
  company: string | null;
  creation: string | null;
  evidence: Record<string, unknown>;
  executedAt: string | null;
  executedBy: string | null;
  executionResult: Record<string, unknown> | null;
  modelAlias: string | null;
  modified: string | null;
  name: string;
  policyCode: string | null;
  policyVersion: number | null;
  promptVersion: string | null;
  proposedValue: Record<string, unknown>;
  requestedBy: string | null;
  reviewer: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
  riskLevel: string;
  rollbackAt: string | null;
  rollbackBy: string | null;
  rollbackReason: string | null;
  rollbackResult: Record<string, unknown> | null;
  sourceRun: string | null;
  status: string;
  targetDoctype: string;
  targetName: string;
  taskType: string;
  version: number;
};

export type AiDataTaskCreateInput = {
  modelAlias?: string;
  policyCode?: string;
  policyVersion?: number;
  promptVersion?: string;
  proposedValue: Record<string, string>;
  sourceRun?: string;
  targetName: string;
};

const text = (value: unknown) => toOptionalText(value) ?? null;

function mapCounts(value: unknown) {
  return Object.fromEntries(
    Object.entries(readObject(value)).map(([key, count]) => [
      key,
      toNumber(count),
    ]),
  );
}

function mapAudit(value: unknown): AiAuditEvent {
  const row = readObject(value);
  return {
    action: String(row.action ?? ''),
    actor: String(row.actor ?? ''),
    creation: text(row.creation),
    objectName: String(row.object_name ?? ''),
    objectType: String(row.object_type ?? ''),
    priority: String(row.priority ?? 'normal'),
    reason: text(row.reason),
  };
}

export function mapAiModel(value: unknown): AiModel {
  const row = readObject(value);
  return {
    capability: String(row.capability ?? ''),
    currency: text(row.currency),
    dataRegion: text(row.data_region),
    embeddingDimensions: toOptionalNumber(row.embedding_dimensions),
    embeddingSpaceVersion: text(row.embedding_space_version),
    inputCost: toNumber(row.input_cost),
    lastErrorCode: text(row.last_error_code),
    lastHealthAt: text(row.last_health_at),
    lastHealthStatus: text(row.last_health_status),
    modelAlias: String(row.model_alias ?? ''),
    modified: text(row.modified),
    outputCost: toNumber(row.output_cost),
    providerFamily: text(row.provider_family),
    providerModelDisplay: text(row.provider_model_display),
    registryVersion: toNumber(row.registry_version),
    retentionPolicy: text(row.retention_policy),
    sensitiveDataAllowed: Boolean(row.sensitive_data_allowed),
    status: String(row.status ?? ''),
    supportsJsonSchema: Boolean(row.supports_json_schema),
    supportsStreaming: Boolean(row.supports_streaming),
    supportsVision: Boolean(row.supports_vision),
  };
}

export function mapAiPolicy(value: unknown): AiPolicy {
  const row = readObject(value);
  const validation = readObject(row.validation);
  return {
    approvedAt: text(row.approved_at),
    approvedBy: text(row.approved_by),
    budgetAction: String(row.budget_action ?? 'warn'),
    budgetCurrency: text(row.budget_currency),
    capability: String(row.capability ?? ''),
    companyScope: toStringList(row.company_scope),
    currentVersion: toNumber(row.current_version),
    dailyBudget: toNumber(row.daily_budget),
    effectiveFrom: text(row.effective_from),
    effectiveTo: text(row.effective_to),
    environment: String(row.environment ?? ''),
    fallbackModelAliases: toStringList(row.fallback_model_aliases),
    lastValidatedAt: text(row.last_validated_at),
    maxCompletionTokens: toNumber(row.max_completion_tokens),
    maxConcurrency: toNumber(row.max_concurrency),
    modified: text(row.modified),
    monthlyBudget: toNumber(row.monthly_budget),
    owner: text(row.owner),
    policyCode: String(row.policy_code ?? ''),
    policyName: String(row.policy_name ?? ''),
    primaryModelAlias: String(row.primary_model_alias ?? ''),
    publishedAt: text(row.published_at),
    publishedVersion: toOptionalNumber(row.published_version),
    reasoningEffort: text(row.reasoning_effort),
    requestsPerMinute: toNumber(row.requests_per_minute),
    roleScope: toStringList(row.role_scope),
    rolloutPercentage: toNumber(row.rollout_percentage),
    rolloutSeed: text(row.rollout_seed),
    scenario: String(row.scenario ?? ''),
    status: String(row.status ?? ''),
    timeoutSeconds: toNumber(row.timeout_seconds),
    tokensPerMinute: toNumber(row.tokens_per_minute),
    validation: Object.keys(validation).length ? validation : null,
  };
}

function mapPolicyVersion(value: unknown): AiPolicyVersion {
  const row = readObject(value);
  const evaluation = readObject(row.evaluation);
  const validation = readObject(row.validation);
  return {
    approvedAt: text(row.approved_at),
    approvedBy: text(row.approved_by),
    changeReason: text(row.change_reason),
    contentHash: String(row.content_hash ?? ''),
    createdBy: String(row.created_by ?? ''),
    creation: text(row.creation),
    evaluation: Object.keys(evaluation).length ? evaluation : null,
    policyCode: String(row.policy_code ?? ''),
    publishedAt: text(row.published_at),
    publishedBy: text(row.published_by),
    rollbackFromVersion: toOptionalNumber(row.rollback_from_version),
    snapshot: readObject(row.snapshot),
    status: String(row.status ?? ''),
    validation: Object.keys(validation).length ? validation : null,
    version: toNumber(row.version),
  };
}

function mapUsage(value: unknown): AiUsageDaily {
  const row = readObject(value);
  return {
    company: String(row.company ?? ''),
    costCurrency: text(row.cost_currency),
    environment: String(row.environment ?? ''),
    errorCount: toNumber(row.error_count),
    estimatedCost: toNumber(row.estimated_cost),
    fallbackCount: toNumber(row.fallback_count),
    firstTokenAvgMs: toOptionalNumber(row.first_token_avg_ms),
    firstTokenP50Ms: toOptionalNumber(row.first_token_p50_ms),
    firstTokenP95Ms: toOptionalNumber(row.first_token_p95_ms),
    latencyAvgMs: toOptionalNumber(row.latency_avg_ms),
    latencyP50Ms: toOptionalNumber(row.latency_p50_ms),
    latencyP95Ms: toOptionalNumber(row.latency_p95_ms),
    modelAlias: String(row.model_alias ?? ''),
    negativeFeedbackCount: toNumber(row.negative_feedback_count),
    policyCode: String(row.policy_code ?? ''),
    policyVersion: toNumber(row.policy_version),
    positiveFeedbackCount: toNumber(row.positive_feedback_count),
    positiveFeedbackRate: toOptionalNumber(row.positive_feedback_rate),
    requestCount: toNumber(row.request_count),
    scenario: String(row.scenario ?? ''),
    successCount: toNumber(row.success_count),
    totalTokens: toNumber(row.total_tokens),
    usageDate: String(row.usage_date ?? ''),
  };
}

function mapVectorRelease(value: unknown): AiVectorRelease {
  const row = readObject(value);
  const validation = readObject(row.validation);
  return {
    aliasName: String(row.alias_name ?? ''),
    approvedAt: text(row.approved_at),
    approvedBy: text(row.approved_by),
    changeReason: text(row.change_reason),
    collectionName: String(row.collection_name ?? ''),
    createdBy: String(row.created_by ?? ''),
    creation: text(row.creation),
    embeddingModel: String(row.embedding_model ?? ''),
    environment: String(row.environment ?? ''),
    failedCount: toNumber(row.failed_count),
    indexVersion: String(row.index_version ?? ''),
    indexedCount: toNumber(row.indexed_count),
    modified: text(row.modified),
    previousCollection: text(row.previous_collection),
    publishedAt: text(row.published_at),
    publishedBy: text(row.published_by),
    releaseCode: String(row.release_code ?? ''),
    rollbackFromRelease: text(row.rollback_from_release),
    status: String(row.status ?? ''),
    totalItems: toNumber(row.total_items),
    validation: Object.keys(validation).length ? validation : null,
    vectorSize: toOptionalNumber(row.vector_size),
  };
}

export function mapAiDataTask(value: unknown): AiDataTask {
  const row = readObject(value);
  const executionResult = readObject(row.execution_result);
  const rollbackResult = readObject(row.rollback_result);
  return {
    analysis: readObject(row.analysis),
    analyzedAt: text(row.analyzed_at),
    analyzedBy: text(row.analyzed_by),
    beforeValue: readObject(row.before_value),
    company: text(row.company),
    creation: text(row.creation),
    evidence: readObject(row.evidence),
    executedAt: text(row.executed_at),
    executedBy: text(row.executed_by),
    executionResult: Object.keys(executionResult).length ? executionResult : null,
    modelAlias: text(row.model_alias),
    modified: text(row.modified),
    name: String(row.name ?? ''),
    policyCode: text(row.policy_code),
    policyVersion: toOptionalNumber(row.policy_version),
    promptVersion: text(row.prompt_version),
    proposedValue: readObject(row.proposed_value),
    requestedBy: text(row.requested_by),
    reviewer: text(row.reviewer),
    reviewedAt: text(row.reviewed_at),
    reviewReason: text(row.review_reason),
    riskLevel: String(row.risk_level ?? ''),
    rollbackAt: text(row.rollback_at),
    rollbackBy: text(row.rollback_by),
    rollbackReason: text(row.rollback_reason),
    rollbackResult: Object.keys(rollbackResult).length ? rollbackResult : null,
    sourceRun: text(row.source_run),
    status: String(row.status ?? ''),
    targetDoctype: String(row.target_doctype ?? ''),
    targetName: String(row.target_name ?? ''),
    taskType: String(row.task_type ?? ''),
    version: toNumber(row.version, 1),
  };
}

export async function getAiGovernanceOverview() {
  const result = await callGatewayMethod<unknown>(
    'get_ai_model_governance_overview_v1',
  );
  const row = readObject(result.data);
  return {
    policyCounts: mapCounts(row.policy_counts),
    recentAudits: Array.isArray(row.recent_audits)
      ? row.recent_audits.map(mapAudit)
      : [],
    registryCounts: mapCounts(row.registry_counts),
  } satisfies AiGovernanceOverview;
}

export async function listAiModels(params: {
  capability?: string;
  current?: number;
  pageSize?: number;
  search?: string;
  status?: string;
} = {}) {
  const start = Math.max(0, ((params.current ?? 1) - 1) * (params.pageSize ?? 20));
  const result = await callGatewayMethod<unknown>(
    'list_ai_models_v1',
    compactPayload({
      capability: params.capability,
      limit: params.pageSize ?? 20,
      search: params.search,
      start,
      status: params.status,
    }),
  );
  const payload = readObject(result.data);
  return {
    items: Array.isArray(payload.items) ? payload.items.map(mapAiModel) : [],
    total: toNumber(readObject(payload.pagination).total),
  };
}

export async function syncAiModels() {
  return runGatewayMutation('sync_ai_model_registry_v1', {
    successMessage: '模型注册表已同步',
  });
}

export async function updateAiModel(
  modelAlias: string,
  payload: {
    currency?: string;
    dataRegion?: string;
    inputCost?: number;
    outputCost?: number;
    retentionPolicy?: string;
    sensitiveDataAllowed?: boolean;
    status?: string;
  },
  reason: string,
) {
  return runGatewayMutation('update_ai_model_registry_v1', {
    payload: {
      model_alias: modelAlias,
      payload: compactPayload({
        currency: payload.currency,
        data_region: payload.dataRegion,
        input_cost: payload.inputCost,
        output_cost: payload.outputCost,
        retention_policy: payload.retentionPolicy,
        sensitive_data_allowed:
          payload.sensitiveDataAllowed === undefined
            ? undefined
            : payload.sensitiveDataAllowed
              ? 1
              : 0,
        status: payload.status,
      }),
      reason,
    },
    successMessage: '模型治理元数据已更新',
  });
}

export async function listAiPolicies(params: {
  current?: number;
  pageSize?: number;
  search?: string;
  status?: string;
} = {}) {
  const start = Math.max(0, ((params.current ?? 1) - 1) * (params.pageSize ?? 20));
  const result = await callGatewayMethod<unknown>(
    'list_ai_model_policies_v1',
    compactPayload({
      limit: params.pageSize ?? 20,
      search: params.search,
      start,
      status: params.status,
    }),
  );
  const payload = readObject(result.data);
  return {
    items: Array.isArray(payload.items) ? payload.items.map(mapAiPolicy) : [],
    total: toNumber(readObject(payload.pagination).total),
  };
}

export async function getAiPolicy(policyCode: string) {
  const result = await callGatewayMethod<unknown>('get_ai_model_policy_v1', {
    policy_code: policyCode,
  });
  const payload = readObject(result.data);
  return {
    policy: mapAiPolicy(payload.policy),
    versions: Array.isArray(payload.versions)
      ? payload.versions.map(mapPolicyVersion)
      : [],
  };
}

export type AiPolicyDraftInput = Omit<
  AiPolicy,
  | 'approvedAt'
  | 'approvedBy'
  | 'currentVersion'
  | 'lastValidatedAt'
  | 'modified'
  | 'owner'
  | 'publishedAt'
  | 'publishedVersion'
  | 'status'
  | 'validation'
>;

export async function saveAiPolicyDraft(
  policy: AiPolicyDraftInput,
  reason: string,
) {
  return runGatewayMutation('save_ai_model_policy_draft_v1', {
    payload: {
      payload: {
        budget_action: policy.budgetAction,
        budget_currency: policy.budgetCurrency,
        capability: policy.capability,
        company_scope: policy.companyScope,
        daily_budget: policy.dailyBudget,
        effective_from: policy.effectiveFrom,
        effective_to: policy.effectiveTo,
        environment: policy.environment,
        fallback_model_aliases: policy.fallbackModelAliases,
        max_completion_tokens: policy.maxCompletionTokens,
        max_concurrency: policy.maxConcurrency,
        monthly_budget: policy.monthlyBudget,
        policy_code: policy.policyCode,
        policy_name: policy.policyName,
        primary_model_alias: policy.primaryModelAlias,
        reasoning_effort: policy.reasoningEffort,
        requests_per_minute: policy.requestsPerMinute,
        role_scope: policy.roleScope,
        rollout_percentage: policy.rolloutPercentage,
        rollout_seed: policy.rolloutSeed,
        scenario: policy.scenario,
        timeout_seconds: policy.timeoutSeconds,
        tokens_per_minute: policy.tokensPerMinute,
      },
      reason,
    },
    successMessage: '策略草稿已保存',
  });
}

async function policyAction(
  method: string,
  policyCode: string,
  reason?: string,
  extra?: Record<string, unknown>,
) {
  return runGatewayMutation(method, {
    payload: compactPayload({
      policy_code: policyCode,
      reason,
      ...extra,
    }),
  });
}

export const validateAiPolicy = (policyCode: string) =>
  policyAction('validate_ai_model_policy_v1', policyCode);
export const approveAiPolicy = (policyCode: string, reason: string) =>
  policyAction('approve_ai_model_policy_v1', policyCode, reason);
export const publishAiPolicy = (policyCode: string, reason: string) =>
  policyAction('publish_ai_model_policy_v1', policyCode, reason);
export const rollbackAiPolicy = (
  policyCode: string,
  targetVersion: number,
  reason: string,
) =>
  policyAction('rollback_ai_model_policy_v1', policyCode, reason, {
    target_version: targetVersion,
  });

export async function getAiUsage(params: {
  company?: string;
  dateFrom?: string;
  dateTo?: string;
  environment?: string;
} = {}) {
  const result = await callGatewayMethod<unknown>(
    'get_ai_model_usage_summary_v1',
    compactPayload({
      company: params.company,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      environment: params.environment,
    }),
  );
  const payload = readObject(result.data);
  return Array.isArray(payload.items) ? payload.items.map(mapUsage) : [];
}

export async function listAiVectorReleases(params: {
  current?: number;
  pageSize?: number;
} = {}) {
  const start = Math.max(0, ((params.current ?? 1) - 1) * (params.pageSize ?? 20));
  const result = await callGatewayMethod<unknown>('list_ai_vector_releases_v1', {
    limit: params.pageSize ?? 20,
    start,
  });
  const payload = readObject(result.data);
  return {
    items: Array.isArray(payload.items)
      ? payload.items.map(mapVectorRelease)
      : [],
    total: toNumber(readObject(payload.pagination).total),
  };
}

export async function getAiVectorRelease(releaseCode: string) {
  const result = await callGatewayMethod<unknown>('get_ai_vector_release_v1', {
    release_code: releaseCode,
  });
  const payload = readObject(result.data);
  return {
    failures: Array.isArray(payload.failures) ? payload.failures : [],
    provider: readObject(payload.provider),
    release: mapVectorRelease(payload.release),
  };
}

export async function createAiVectorRelease(
  payload: {
    aliasName: string;
    collectionName: string;
    embeddingModel: string;
    environment: string;
    indexVersion: string;
    releaseCode: string;
  },
  reason: string,
) {
  return runGatewayMutation('create_ai_vector_release_v1', {
    payload: {
      payload: {
        alias_name: payload.aliasName,
        collection_name: payload.collectionName,
        embedding_model: payload.embeddingModel,
        environment: payload.environment,
        index_version: payload.indexVersion,
        release_code: payload.releaseCode,
      },
      reason,
    },
    successMessage: 'Embedding 候选版本已开始构建',
  });
}

const vectorReleaseAction = (
  method: string,
  releaseCode: string,
  reason?: string,
) =>
  runGatewayMutation(method, {
    payload: compactPayload({
      reason,
      release_code: method === 'rollback_ai_vector_release_v1' ? undefined : releaseCode,
      target_release_code:
        method === 'rollback_ai_vector_release_v1' ? releaseCode : undefined,
    }),
  });

export const retryAiVectorRelease = (releaseCode: string) =>
  vectorReleaseAction('retry_ai_vector_release_v1', releaseCode);
export const validateAiVectorRelease = (releaseCode: string) =>
  vectorReleaseAction('validate_ai_vector_release_v1', releaseCode);
export const approveAiVectorRelease = (releaseCode: string, reason: string) =>
  vectorReleaseAction('approve_ai_vector_release_v1', releaseCode, reason);
export const publishAiVectorRelease = (releaseCode: string, reason: string) =>
  vectorReleaseAction('publish_ai_vector_release_v1', releaseCode, reason);
export const rollbackAiVectorRelease = (releaseCode: string, reason: string) =>
  vectorReleaseAction('rollback_ai_vector_release_v1', releaseCode, reason);

export async function listAiDataTasks(params: {
  current?: number;
  pageSize?: number;
  riskLevel?: string;
  status?: string;
  taskType?: string;
} = {}) {
  const start = Math.max(
    0,
    ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
  );
  const result = await callGatewayMethod<unknown>(
    'list_ai_data_tasks_v1',
    compactPayload({
      limit: params.pageSize ?? 20,
      risk_level: params.riskLevel,
      start,
      status: params.status,
      task_type: params.taskType,
    }),
  );
  const payload = readObject(result.data);
  return {
    items: Array.isArray(payload.tasks)
      ? payload.tasks.map(mapAiDataTask)
      : [],
    total: toNumber(payload.total),
  };
}

export async function getAiDataTask(taskName: string) {
  const result = await callGatewayMethod<unknown>('get_ai_data_task_v1', {
    task_name: taskName,
  });
  return mapAiDataTask(readObject(result.data).task);
}

export async function analyzeAiProductData(
  itemCodes: string[] = [],
  limit = 50,
) {
  return runGatewayMutation<{
    createdOrReused: number;
    tasks: AiDataTask[];
  }>('analyze_ai_product_data_v1', {
    payload: { item_codes: itemCodes, limit },
    successMessage: '商品资料完整性扫描已完成',
    transform: (value) => {
      const payload = readObject(value);
      return {
        createdOrReused: toNumber(payload.created_or_reused),
        tasks: Array.isArray(payload.tasks)
          ? payload.tasks.map(mapAiDataTask)
          : [],
      };
    },
  });
}

export async function createAiDataTask(
  input: AiDataTaskCreateInput,
  reason: string,
) {
  return runGatewayMutation<AiDataTask>('create_ai_data_task_v1', {
    payload: {
      payload: compactPayload({
        model_alias: input.modelAlias,
        policy_code: input.policyCode,
        policy_version: input.policyVersion,
        prompt_version: input.promptVersion,
        proposed_value: input.proposedValue,
        source_run: input.sourceRun,
        target_name: input.targetName,
      }),
      reason,
    },
    successMessage: '数据治理建议已创建并进入审批',
    transform: (value) => mapAiDataTask(readObject(value).task),
  });
}

export async function reviewAiDataTask(
  taskName: string,
  action: 'approve' | 'reject',
  reason: string,
) {
  return runGatewayMutation<AiDataTask>('review_ai_data_task_v1', {
    payload: { action, reason, task_name: taskName },
    successMessage: action === 'approve' ? '任务已审批通过' : '任务已驳回',
    transform: (value) => mapAiDataTask(readObject(value).task),
  });
}

export async function executeAiDataTask(taskName: string) {
  return runGatewayMutation<AiDataTask>('execute_ai_data_task_v1', {
    payload: { task_name: taskName },
    successMessage: '已通过正式商品服务执行数据变更',
    transform: (value) => mapAiDataTask(readObject(value).task),
  });
}

export async function rollbackAiDataTask(taskName: string, reason: string) {
  return runGatewayMutation<AiDataTask>('rollback_ai_data_task_v1', {
    payload: { reason, task_name: taskName },
    successMessage: '数据治理变更已安全回滚',
    transform: (value) => mapAiDataTask(readObject(value).task),
  });
}
