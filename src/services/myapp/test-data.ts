import { message } from 'antd';
import { callFrappeMethod, MyAppApiError } from './api-client';
import {
  compactPayload,
  readObject,
  toNumber,
  toOptionalText,
  toStringList,
  toText,
} from './api-utils';
import { notifyMutationError } from './mutation';

type TestDataResponse<T> = {
  data?: T;
  message?: string;
  status?: string;
};

export type TestDatasetAction = 'generate' | 'reset' | 'supplement';
export type TestDatasetScale = 'small' | 'medium' | 'large';

export type TestDatasetScenario = {
  dateOffsetDays: number;
  domain: string;
  itemKey: string;
  key: string;
  partialQty: number | null;
  partyKey: string;
  paymentRatio: number | null;
  qty: number;
  rate: number;
  state: string;
  uom: string;
};

export type TestDatasetDefinition = {
  code: string;
  description: string;
  label: string;
  scale: TestDatasetScale;
  version: string;
  items: unknown[];
  customers: unknown[];
  suppliers: unknown[];
  scenarios: TestDatasetScenario[];
};

export type TestDatasetConflict = {
  doctype: string;
  name: string;
};

export type TestDatasetPreview = {
  action: TestDatasetAction;
  activeGeneratedObjectCount: number;
  allowed: boolean;
  baseDate: string;
  blockers: string[];
  company: string;
  confirmationText: string;
  conflicts: TestDatasetConflict[];
  dataset: TestDatasetDefinition;
  expectedCounts: Record<string, number>;
  missingBaselineMasters: TestDatasetConflict[];
  safety: {
    allowedCompanies: string[];
    developerMode: boolean;
    enabled: boolean;
    environmentType: string;
  };
  seed: number;
  scale: TestDatasetScale;
  scenarioCopies: number;
  scenarioInstanceCount: number;
  selectedScenarioKeys: string[];
  unownedConflicts: TestDatasetConflict[];
  warehouse: string;
};

export type TestDatasetRun = {
  action: TestDatasetAction;
  baseDate: string | null;
  company: string;
  completedAt: string | null;
  creation: string | null;
  datasetCode: string;
  datasetVersion: string;
  error: string | null;
  modified: string | null;
  name: string;
  previousRun: string | null;
  progress: {
    current: number;
    message: string | null;
    total: number;
  };
  requestedBy: string;
  result: Record<string, unknown> | null;
  scale: TestDatasetScale;
  scenarioCopies: number;
  scenarioKeys: string[];
  seed: number;
  startedAt: string | null;
  status: string;
  warehouse: string;
};

export type TestDatasetValidation = {
  checks: Array<{
    details: Record<string, unknown>;
    name: string;
    passed: boolean;
  }>;
  passed: boolean;
  status: string;
};

export type CompanyTransactionResetPreview = {
  activeTemplateObjectCount: number;
  allowed: boolean;
  blockers: string[];
  company: string;
  confirmationText: string;
  doctypeCount: number;
  estimatedDocumentReferences: number;
  plan: Array<{
    companyField: string;
    documentCount: number;
    doctype: string;
  }>;
  retainedMasterDoctypes: string[];
  safety: {
    allowedCompanies: string[];
    enabled: boolean;
    environmentType: string;
  };
};

export type CompanyTransactionResetRecord = {
  activeTemplateObjectCount: number;
  company: string;
  creation: string | null;
  error: string | null;
  modified: string | null;
  name: string;
  owner: string;
  progress: { processed: number; total: number };
  status: string;
  taskStatuses: Record<string, string>;
  toDelete: CompanyTransactionResetPreview['plan'];
};

function responseErrorMessage(error: any) {
  const payload = error?.response?.data;
  const candidates = [
    payload?.message?.message,
    payload?.message,
    payload?._server_messages,
    payload?.exception,
    error?.message,
  ];
  return (
    candidates.find(
      (candidate) => typeof candidate === 'string' && candidate.trim(),
    ) || '测试数据请求失败，请检查环境配置。'
  );
}

async function callTestDataMethod<T>(
  methodName: string,
  payload?: Record<string, unknown>,
  method: 'GET' | 'POST' = 'POST',
) {
  try {
    const response = await callFrappeMethod<TestDataResponse<T>>(
      `myapp.api.test_data_api.${methodName}`,
      payload,
      { method },
    );
    if (response?.status && response.status !== 'success') {
      throw new MyAppApiError(
        response.message || '测试数据请求未成功。',
        { data: response.data },
      );
    }
    return response?.data as T;
  } catch (error) {
    if (error instanceof MyAppApiError) throw error;
    throw new MyAppApiError(responseErrorMessage(error));
  }
}

function mapDataset(value: unknown): TestDatasetDefinition {
  const row = readObject(value);
  return {
    code: toText(row.code),
    customers: Array.isArray(row.customers) ? row.customers : [],
    description: toText(row.description),
    items: Array.isArray(row.items) ? row.items : [],
    label: toText(row.label),
    scale: mapScale(row.scale),
    scenarios: Array.isArray(row.scenarios)
      ? row.scenarios.map(mapScenario)
      : [],
    suppliers: Array.isArray(row.suppliers) ? row.suppliers : [],
    version: toText(row.version),
  };
}

function mapScale(value: unknown): TestDatasetScale {
  if (value === 'medium') return 'medium';
  if (value === 'large') return 'large';
  return 'small';
}

function mapScenario(value: unknown): TestDatasetScenario {
  const row = readObject(value);
  return {
    dateOffsetDays: toNumber(row.date_offset_days),
    domain: toText(row.domain),
    itemKey: toText(row.item_key),
    key: toText(row.key),
    partialQty:
      row.partial_qty === null || row.partial_qty === undefined
        ? null
        : toNumber(row.partial_qty),
    partyKey: toText(row.party_key),
    paymentRatio:
      row.payment_ratio === null || row.payment_ratio === undefined
        ? null
        : toNumber(row.payment_ratio),
    qty: toNumber(row.qty),
    rate: toNumber(row.rate),
    state: toText(row.state),
    uom: toText(row.uom),
  };
}

function mapConflict(value: unknown): TestDatasetConflict {
  const row = readObject(value);
  return { doctype: toText(row.doctype), name: toText(row.name) };
}

function mapCounts(value: unknown) {
  return Object.fromEntries(
    Object.entries(readObject(value)).map(([key, count]) => [
      key,
      toNumber(count),
    ]),
  );
}

function mapPreview(value: unknown): TestDatasetPreview {
  const row = readObject(value);
  const safety = readObject(row.safety);
  return {
    action:
      row.action === 'reset'
        ? 'reset'
        : row.action === 'supplement'
          ? 'supplement'
          : 'generate',
    activeGeneratedObjectCount: toNumber(row.active_generated_object_count),
    allowed: Boolean(row.allowed),
    baseDate: toText(row.base_date),
    blockers: toStringList(row.blockers),
    company: toText(row.company),
    confirmationText: toText(row.confirmation_text),
    conflicts: Array.isArray(row.conflicts)
      ? row.conflicts.map(mapConflict)
      : [],
    dataset: mapDataset(row.dataset),
    expectedCounts: mapCounts(row.expected_counts),
    missingBaselineMasters: Array.isArray(row.missing_baseline_masters)
      ? row.missing_baseline_masters.map(mapConflict)
      : [],
    safety: {
      allowedCompanies: toStringList(safety.allowed_companies),
      developerMode: Boolean(safety.developer_mode),
      enabled: Boolean(safety.enabled),
      environmentType: toText(safety.environment_type),
    },
    seed: toNumber(row.seed, 1),
    scale: mapScale(row.scale),
    scenarioCopies: toNumber(row.scenario_copies, 1),
    scenarioInstanceCount: toNumber(row.scenario_instance_count),
    selectedScenarioKeys: toStringList(row.selected_scenario_keys),
    unownedConflicts: Array.isArray(row.unowned_conflicts)
      ? row.unowned_conflicts.map(mapConflict)
      : [],
    warehouse: toText(row.warehouse),
  };
}

function nullableText(value: unknown) {
  return toOptionalText(value) ?? null;
}

function mapRun(value: unknown): TestDatasetRun {
  const row = readObject(value);
  const result = row.result;
  const progress = readObject(row.progress);
  return {
    action:
      row.action === 'reset'
        ? 'reset'
        : row.action === 'supplement'
          ? 'supplement'
          : 'generate',
    baseDate: nullableText(row.base_date),
    company: toText(row.company),
    completedAt: nullableText(row.completed_at),
    creation: nullableText(row.creation),
    datasetCode: toText(row.dataset_code),
    datasetVersion: toText(row.dataset_version),
    error: nullableText(row.error),
    modified: nullableText(row.modified),
    name: toText(row.name),
    previousRun: nullableText(row.previous_run),
    progress: {
      current: toNumber(progress.current),
      message: nullableText(progress.message),
      total: toNumber(progress.total),
    },
    requestedBy: toText(row.requested_by),
    result:
      result && typeof result === 'object'
        ? (result as Record<string, unknown>)
        : null,
    scale: mapScale(row.scale),
    scenarioCopies: toNumber(row.scenario_copies, 1),
    scenarioKeys: toStringList(row.scenario_keys),
    seed: toNumber(row.seed, 1),
    startedAt: nullableText(row.started_at),
    status: toText(row.status),
    warehouse: toText(row.warehouse),
  };
}

function mapValidation(value: unknown): TestDatasetValidation {
  const row = readObject(value);
  return {
    checks: Array.isArray(row.checks)
      ? row.checks.map((item) => {
          const check = readObject(item);
          return {
            details: readObject(check.details),
            name: toText(check.name),
            passed: Boolean(check.passed),
          };
        })
      : [],
    passed: Boolean(row.passed),
    status: toText(row.status),
  };
}

function mapCompanyResetPlan(value: unknown) {
  const row = readObject(value);
  return {
    companyField: toText(row.company_field),
    documentCount: toNumber(row.document_count),
    doctype: toText(row.doctype),
  };
}

function mapCompanyResetPreview(
  value: unknown,
): CompanyTransactionResetPreview {
  const row = readObject(value);
  const safety = readObject(row.safety);
  return {
    activeTemplateObjectCount: toNumber(row.active_template_object_count),
    allowed: Boolean(row.allowed),
    blockers: toStringList(row.blockers),
    company: toText(row.company),
    confirmationText: toText(row.confirmation_text),
    doctypeCount: toNumber(row.doctype_count),
    estimatedDocumentReferences: toNumber(
      row.estimated_document_references,
    ),
    plan: Array.isArray(row.plan) ? row.plan.map(mapCompanyResetPlan) : [],
    retainedMasterDoctypes: toStringList(row.retained_master_doctypes),
    safety: {
      allowedCompanies: toStringList(safety.allowed_companies),
      enabled: Boolean(safety.enabled),
      environmentType: toText(safety.environment_type),
    },
  };
}

function mapCompanyResetRecord(
  value: unknown,
): CompanyTransactionResetRecord {
  const row = readObject(value);
  const progress = readObject(row.progress);
  return {
    activeTemplateObjectCount: toNumber(row.active_template_object_count),
    company: toText(row.company),
    creation: nullableText(row.creation),
    error: nullableText(row.error),
    modified: nullableText(row.modified),
    name: toText(row.name),
    owner: toText(row.owner),
    progress: {
      processed: toNumber(progress.processed),
      total: toNumber(progress.total),
    },
    status: toText(row.status),
    taskStatuses: Object.fromEntries(
      Object.entries(readObject(row.task_statuses)).map(([key, status]) => [
        key,
        toText(status),
      ]),
    ),
    toDelete: Array.isArray(row.to_delete)
      ? row.to_delete.map(mapCompanyResetPlan)
      : [],
  };
}

export async function listTestDatasets() {
  const payload = readObject(
    await callTestDataMethod<unknown>('list_test_datasets_v1'),
  );
  return Array.isArray(payload.items) ? payload.items.map(mapDataset) : [];
}

export async function previewTestDataset(input: {
  action: TestDatasetAction;
  baseDate?: string;
  company: string;
  datasetCode: string;
  seed?: number;
  scale?: TestDatasetScale;
  scenarioKeys?: string[];
  warehouse: string;
}) {
  return mapPreview(
    await callTestDataMethod(
      'preview_test_dataset_v1',
      compactPayload({
        action: input.action,
        base_date: input.baseDate,
        company: input.company,
        dataset_code: input.datasetCode,
        seed: input.seed ?? 1,
        scale: input.scale ?? 'small',
        scenario_keys: input.scenarioKeys,
        warehouse: input.warehouse,
      }),
    ),
  );
}

export async function requestTestDatasetRun(input: {
  action: TestDatasetAction;
  baseDate?: string;
  company: string;
  confirmationText: string;
  datasetCode: string;
  seed?: number;
  scale?: TestDatasetScale;
  scenarioKeys?: string[];
  warehouse: string;
}) {
  try {
    const payload = readObject(
      await callTestDataMethod('request_test_dataset_run_v1', compactPayload({
        action: input.action,
        base_date: input.baseDate,
        company: input.company,
        confirmation_text: input.confirmationText,
        dataset_code: input.datasetCode,
        seed: input.seed ?? 1,
        scale: input.scale ?? 'small',
        scenario_keys: input.scenarioKeys,
        warehouse: input.warehouse,
      })),
    );
    message.success('测试数据任务已创建');
    return {
      preview: mapPreview(payload.preview),
      queued: Boolean(payload.queued),
      runName: toText(payload.run_name),
    };
  } catch (error) {
    notifyMutationError(error);
    throw error;
  }
}

export async function getTestDatasetRun(runName: string) {
  return mapRun(
    await callTestDataMethod('get_test_dataset_run_v1', {
      run_name: runName,
    }),
  );
}

export async function listTestDatasetRuns(params: {
  current?: number;
  pageSize?: number;
} = {}) {
  const pageSize = params.pageSize ?? 20;
  const start = Math.max(0, ((params.current ?? 1) - 1) * pageSize);
  const payload = readObject(
    await callTestDataMethod<unknown>('list_test_dataset_runs_v1', {
      limit: pageSize,
      start,
    }),
  );
  const items = Array.isArray(payload.items) ? payload.items.map(mapRun) : [];
  return { items, total: toNumber(payload.total, items.length) };
}

export async function validateTestDataset(
  company: string,
  datasetCode: string,
) {
  try {
    const payload = readObject(
      await callTestDataMethod('validate_test_dataset_v1', {
        company,
        dataset_code: datasetCode,
      }),
    );
    const validation = mapValidation(payload.validation);
    if (validation.passed) message.success('测试数据完整性验证通过');
    return { run: mapRun(payload.run), validation };
  } catch (error) {
    notifyMutationError(error);
    throw error;
  }
}

export async function previewCompanyTransactionReset(company: string) {
  return mapCompanyResetPreview(
    await callTestDataMethod('preview_company_transaction_reset_v1', {
      company,
    }),
  );
}

export async function requestCompanyTransactionReset(input: {
  acknowledgeIrreversible: boolean;
  company: string;
  confirmationText: string;
}) {
  const payload = readObject(
    await callTestDataMethod(
      'request_company_transaction_reset_v1',
      {
        acknowledge_irreversible: input.acknowledgeIrreversible ? 1 : 0,
        company: input.company,
        confirmation_text: input.confirmationText,
      },
      'POST',
    ),
  );
  message.success('公司级交易重置任务已创建');
  return {
    preview: mapCompanyResetPreview(payload.preview),
    record: mapCompanyResetRecord(payload.record),
  };
}

export async function getCompanyTransactionReset(recordName: string) {
  return mapCompanyResetRecord(
    await callTestDataMethod('get_company_transaction_reset_v1', {
      record_name: recordName,
    }),
  );
}
