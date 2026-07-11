import { callGatewayMethod, createIdempotencyKey } from './api-client';
import { buildMyAppApiUrl } from './api-base';
import { getMyAppAuthHeaders } from './auth-storage';

export type PrintTemplateOption = {
  allowedRoles: string[];
  category: string;
  description: string | null;
  enabled: boolean;
  key: string;
  label: string;
  managed: boolean;
  orientation: string;
  paperSize: string;
  printFormat: string | null;
  restricted: boolean;
  isDefault: boolean;
  source: string;
  templateHash: string | null;
  templateVersion: string | null;
};

export type PrintSetting = {
  defaultTemplate: string | null;
  doctype: string;
  enabled: boolean;
  metadata: unknown;
  modified: string | null;
  modifiedBy: string | null;
  name: string | null;
};

export type PrintBatchStatus =
  | 'queued'
  | 'processing'
  | 'cancel_requested'
  | 'canceled'
  | 'completed'
  | 'partial_failed'
  | 'failed';

export type PrintBatchDocument = {
  docname: string;
  doctype: string;
  filename?: string | null;
  template?: string | null;
};

export type PrintBatchResult = PrintBatchDocument & {
  error: string | null;
  fileSize: number;
  fileUrl: string | null;
  status: 'success' | 'failed' | 'skipped';
};

export type PrintBatch = {
  batchId: string;
  completedAt: string | null;
  doneCount: number;
  doctypes: string[];
  documentNames: string[];
  enqueueJobId: string | null;
  error: string | null;
  failedCount: number;
  items: PrintBatchDocument[];
  metadata: unknown;
  output: 'pdf';
  progress: number;
  requestedAt: string | null;
  requestedBy: string | null;
  requestId: string | null;
  results: PrintBatchResult[];
  skippedCount: number;
  startedAt: string | null;
  status: PrintBatchStatus;
  successCount: number;
  tableReady: boolean;
  totalCount: number;
};

export type PrintTemplatesData = {
  capabilities: string[];
  defaultTemplate: string | null;
  doctype: string;
  templates: PrintTemplateOption[];
};

export type PrintDoctypeOption = {
  capabilities: string[];
  defaultTemplate: string | null;
  doctype: string;
  label: string;
  module: string;
  templates: PrintTemplateOption[];
};

export type PrintJobRecord = {
  action: string;
  docname: string;
  doctype: string;
  error: string | null;
  fileUrl: string | null;
  filename: string | null;
  jobId: string;
  metadata: unknown;
  output: 'html' | 'pdf';
  printedAt: string | null;
  printedBy: string | null;
  status: string;
  template: Pick<
    PrintTemplateOption,
    'key' | 'label' | 'printFormat' | 'templateHash' | 'templateVersion'
  >;
};

export type PrintPreviewData = {
  availableTemplates: PrintTemplateOption[];
  docname: string;
  doctype: string;
  html: string;
  mimeType: string;
  output: 'html' | 'pdf';
  template: PrintTemplateOption;
  title: string;
};

export type PrintFileData = {
  availableTemplates: PrintTemplateOption[];
  docname: string;
  doctype: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  template: PrintTemplateOption;
  title: string;
};

function mapTemplateOption(value: unknown): PrintTemplateOption | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const key = typeof row.key === 'string' ? row.key : '';
  if (!key) {
    return null;
  }

  return {
    allowedRoles: Array.isArray(row.allowed_roles)
      ? row.allowed_roles.filter(
          (item): item is string => typeof item === 'string',
        )
      : [],
    category: typeof row.category === 'string' ? row.category : 'standard',
    description:
      typeof row.description === 'string' ? row.description : null,
    enabled: row.enabled !== false,
    isDefault: Boolean(row.is_default),
    key,
    label: typeof row.label === 'string' ? row.label : key,
    managed: Boolean(row.managed),
    orientation:
      typeof row.orientation === 'string' ? row.orientation : 'Portrait',
    paperSize: typeof row.paper_size === 'string' ? row.paper_size : 'A4',
    printFormat:
      typeof row.print_format === 'string' ? row.print_format : null,
    restricted: Boolean(row.restricted),
    source: typeof row.source === 'string' ? row.source : 'unknown',
    templateHash:
      typeof row.template_hash === 'string' ? row.template_hash : null,
    templateVersion:
      typeof row.template_version === 'string' ? row.template_version : null,
  };
}

function mapTemplateList(value: unknown) {
  return Array.isArray(value)
    ? value
        .map(mapTemplateOption)
        .filter((item): item is PrintTemplateOption => Boolean(item))
    : [];
}

function fallbackTemplate(): PrintTemplateOption {
  return {
    allowedRoles: [],
    category: 'standard',
    description: null,
    enabled: true,
    isDefault: false,
    key: 'standard',
    label: '标准模板',
    managed: false,
    orientation: 'Portrait',
    paperSize: 'A4',
    printFormat: null,
    restricted: false,
    source: 'fallback',
    templateHash: null,
    templateVersion: null,
  };
}

function mapPrintSetting(value: unknown): PrintSetting | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const doctype = typeof row.doctype === 'string' ? row.doctype : '';
  if (!doctype) {
    return null;
  }
  return {
    defaultTemplate:
      typeof row.default_template === 'string' ? row.default_template : null,
    doctype,
    enabled: row.enabled !== false,
    metadata: row.metadata ?? null,
    modified: typeof row.modified === 'string' ? row.modified : null,
    modifiedBy:
      typeof row.modified_by === 'string' ? row.modified_by : null,
    name: typeof row.name === 'string' ? row.name : null,
  };
}

function mapBatchDocument(value: unknown): PrintBatchDocument | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const doctype = typeof row.doctype === 'string' ? row.doctype : '';
  const docname =
    typeof row.docname === 'string'
      ? row.docname
      : typeof row.name === 'string'
        ? row.name
        : '';
  if (!doctype || !docname) {
    return null;
  }
  return {
    docname,
    doctype,
    filename: typeof row.filename === 'string' ? row.filename : null,
    template: typeof row.template === 'string' ? row.template : null,
  };
}

function mapPrintBatchResult(value: unknown): PrintBatchResult | null {
  const document = mapBatchDocument(value);
  if (!document || !value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const status =
    row.status === 'success' ||
    row.status === 'failed' ||
    row.status === 'skipped'
      ? row.status
      : 'failed';
  return {
    ...document,
    error: typeof row.error === 'string' ? row.error : null,
    fileSize: typeof row.file_size === 'number' ? row.file_size : 0,
    fileUrl: typeof row.file_url === 'string' ? row.file_url : null,
    status,
  };
}

function mapPrintBatch(value: Record<string, unknown>): PrintBatch {
  const status: PrintBatchStatus =
    value.status === 'processing' ||
    value.status === 'cancel_requested' ||
    value.status === 'canceled' ||
    value.status === 'completed' ||
    value.status === 'partial_failed' ||
    value.status === 'failed'
      ? value.status
      : 'queued';
  return {
    batchId: typeof value.batch_id === 'string' ? value.batch_id : '',
    completedAt:
      typeof value.completed_at === 'string' ? value.completed_at : null,
    doneCount: typeof value.done_count === 'number' ? value.done_count : 0,
    doctypes: Array.isArray(value.doctypes)
      ? value.doctypes.filter((item): item is string => typeof item === 'string')
      : [],
    documentNames: Array.isArray(value.document_names)
      ? value.document_names.filter(
          (item): item is string => typeof item === 'string',
        )
      : [],
    enqueueJobId:
      typeof value.enqueue_job_id === 'string' ? value.enqueue_job_id : null,
    error: typeof value.error === 'string' ? value.error : null,
    failedCount:
      typeof value.failed_count === 'number' ? value.failed_count : 0,
    items: Array.isArray(value.items)
      ? value.items
          .map(mapBatchDocument)
          .filter((item): item is PrintBatchDocument => Boolean(item))
      : [],
    metadata: value.metadata ?? null,
    output: 'pdf',
    progress: typeof value.progress === 'number' ? value.progress : 0,
    requestedAt:
      typeof value.requested_at === 'string' ? value.requested_at : null,
    requestedBy:
      typeof value.requested_by === 'string' ? value.requested_by : null,
    requestId:
      typeof value.request_id === 'string' ? value.request_id : null,
    results: Array.isArray(value.results)
      ? value.results
          .map(mapPrintBatchResult)
          .filter((item): item is PrintBatchResult => Boolean(item))
      : [],
    skippedCount:
      typeof value.skipped_count === 'number' ? value.skipped_count : 0,
    startedAt:
      typeof value.started_at === 'string' ? value.started_at : null,
    status,
    successCount:
      typeof value.success_count === 'number' ? value.success_count : 0,
    tableReady: value.table_ready !== false,
    totalCount: typeof value.total_count === 'number' ? value.total_count : 0,
  };
}

function mapCapabilities(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function mapPrintJob(value: unknown): PrintJobRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const jobId = typeof row.job_id === 'string' ? row.job_id : '';
  if (!jobId) {
    return null;
  }
  const template =
    row.template && typeof row.template === 'object'
      ? (row.template as Record<string, unknown>)
      : {};

  return {
    action: typeof row.action === 'string' ? row.action : 'unknown',
    docname: typeof row.docname === 'string' ? row.docname : '',
    doctype: typeof row.doctype === 'string' ? row.doctype : '',
    error: typeof row.error === 'string' ? row.error : null,
    fileUrl: typeof row.file_url === 'string' ? row.file_url : null,
    filename: typeof row.filename === 'string' ? row.filename : null,
    jobId,
    metadata: row.metadata ?? null,
    output: row.output === 'html' ? 'html' : 'pdf',
    printedAt: typeof row.printed_at === 'string' ? row.printed_at : null,
    printedBy: typeof row.printed_by === 'string' ? row.printed_by : null,
    status: typeof row.status === 'string' ? row.status : 'unknown',
    template: {
      key: typeof template.key === 'string' ? template.key : '',
      label: typeof template.label === 'string' ? template.label : '',
      printFormat:
        typeof template.print_format === 'string'
          ? template.print_format
          : null,
      templateHash:
        typeof template.template_hash === 'string' ? template.template_hash : null,
      templateVersion:
        typeof template.template_version === 'string'
          ? template.template_version
          : null,
    },
  };
}

function mapPrintDoctypeOption(value: unknown): PrintDoctypeOption | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const doctype = typeof row.doctype === 'string' ? row.doctype : '';
  if (!doctype) {
    return null;
  }

  return {
    capabilities: mapCapabilities(row.capabilities),
    defaultTemplate:
      typeof row.default_template === 'string' ? row.default_template : null,
    doctype,
    label: typeof row.label === 'string' ? row.label : doctype,
    module: typeof row.module === 'string' ? row.module : 'unknown',
    templates: mapTemplateList(row.templates),
  };
}

export async function listPrintDoctypes() {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'list_print_doctypes_v1',
    {},
  );
  const data = result.data ?? {};
  return Array.isArray(data.doctypes)
    ? data.doctypes
        .map(mapPrintDoctypeOption)
        .filter((item): item is PrintDoctypeOption => Boolean(item))
    : [];
}

export async function getPrintSettings() {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'get_print_settings_v1',
    {},
  );
  const data = result.data ?? {};
  return {
    settings: Array.isArray(data.settings)
      ? data.settings
          .map(mapPrintSetting)
          .filter((item): item is PrintSetting => Boolean(item))
      : [],
    tableReady: data.table_ready !== false,
  };
}

export async function setPrintDefaultTemplate(params: {
  doctype: string;
  enabled?: boolean;
  metadata?: Record<string, unknown> | null;
  template: string;
}) {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'set_print_default_template_v1',
    {
      doctype: params.doctype,
      enabled: params.enabled ?? true,
      metadata: params.metadata ?? undefined,
      template: params.template,
    },
  );
  const data = result.data ?? {};
  return {
    defaultTemplate:
      typeof data.default_template === 'string'
        ? data.default_template
        : params.template,
    doctype: typeof data.doctype === 'string' ? data.doctype : params.doctype,
    enabled: data.enabled !== false,
    saved: Boolean(data.saved),
    template: mapTemplateOption(data.template),
  };
}

export async function createPrintBatch(params: {
  documents: PrintBatchDocument[];
  metadata?: Record<string, unknown> | null;
  requestId?: string | null;
  template?: string | null;
}) {
  const requestId =
    params.requestId ?? createIdempotencyKey('web-create-print-batch');
  const result = await callGatewayMethod<Record<string, unknown>>(
    'create_print_batch_v1',
    {
      documents: params.documents.map((item) => ({
        docname: item.docname,
        doctype: item.doctype,
        filename: item.filename ?? undefined,
        template: item.template ?? undefined,
      })),
      metadata: params.metadata ?? undefined,
      output: 'pdf',
      request_id: requestId,
      run_async: 1,
      template: params.template ?? undefined,
    },
  );
  return mapPrintBatch(result.data ?? {});
}

export async function getPrintBatch(batchId: string) {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'get_print_batch_v1',
    { batch_id: batchId },
  );
  return mapPrintBatch(result.data ?? {});
}

export async function listPrintBatches(params: {
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number;
  requestedBy?: string | null;
  start?: number;
  status?: PrintBatchStatus | null;
}) {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'list_print_batches_v1',
    {
      date_from: params.dateFrom ?? undefined,
      date_to: params.dateTo ?? undefined,
      limit: params.limit ?? 20,
      requested_by: params.requestedBy ?? undefined,
      start: params.start ?? 0,
      status: params.status ?? undefined,
    },
  );
  const data = result.data ?? {};
  return {
    batches: Array.isArray(data.batches)
      ? data.batches.map((item) =>
          mapPrintBatch(
            item && typeof item === 'object'
              ? (item as Record<string, unknown>)
              : {},
          ),
        )
      : [],
    tableReady: data.table_ready !== false,
    total: typeof data.total === 'number' ? data.total : 0,
  };
}

export async function cancelPrintBatch(batchId: string) {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'cancel_print_batch_v1',
    { batch_id: batchId },
  );
  const data = result.data ?? {};
  return {
    batchId: typeof data.batch_id === 'string' ? data.batch_id : batchId,
    cancelRequested: Boolean(data.cancel_requested),
    canceled: Boolean(data.canceled),
    status: typeof data.status === 'string' ? data.status : null,
  };
}

export async function retryPrintBatchFailed(batchId: string) {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'retry_print_batch_failed_v1',
    {
      batch_id: batchId,
      metadata: { client: 'web' },
      run_async: 1,
    },
  );
  return {
    batch: mapPrintBatch(result.data ?? {}),
    retryOf:
      typeof result.data?.retry_of === 'string'
        ? result.data.retry_of
        : batchId,
  };
}

export async function fetchPrintTemplates(params: {
  doctype: string;
}): Promise<PrintTemplatesData> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'get_print_templates_v1',
    {
      doctype: params.doctype,
    },
  );
  const data = result.data ?? {};
  const templates = mapTemplateList(data.templates);

  return {
    capabilities: mapCapabilities(data.capabilities),
    defaultTemplate:
      typeof data.default_template === 'string'
        ? data.default_template
        : templates.find((item) => item.isDefault)?.key ?? templates[0]?.key ?? null,
    doctype: typeof data.doctype === 'string' ? data.doctype : params.doctype,
    templates,
  };
}

export async function recordPrintJob(params: {
  action: 'preview' | 'download' | 'print' | 'share' | 'archive';
  docname: string;
  doctype: string;
  error?: string | null;
  filename?: string | null;
  fileUrl?: string | null;
  metadata?: Record<string, unknown> | string | null;
  output: 'html' | 'pdf';
  status?: 'success' | 'failed' | 'skipped';
  template?: string | null;
}) {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'record_print_job_v1',
    {
      action: params.action,
      docname: params.docname,
      doctype: params.doctype,
      error: params.error ?? undefined,
      file_url: params.fileUrl ?? undefined,
      filename: params.filename ?? undefined,
      metadata: params.metadata ?? undefined,
      output: params.output,
      status: params.status ?? 'success',
      template: params.template ?? undefined,
    },
  );
  const data = result.data ?? {};
  return {
    docname: typeof data.docname === 'string' ? data.docname : params.docname,
    doctype: typeof data.doctype === 'string' ? data.doctype : params.doctype,
    jobId: typeof data.job_id === 'string' ? data.job_id : null,
    printedAt:
      typeof data.printed_at === 'string' ? data.printed_at : null,
    printedBy:
      typeof data.printed_by === 'string' ? data.printed_by : null,
    recorded: Boolean(data.recorded),
    reason: typeof data.reason === 'string' ? data.reason : null,
  };
}

export async function listPrintJobs(params: {
  action?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  docname: string;
  doctype: string;
  limit?: number;
  template?: string | null;
  user?: string | null;
}) {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'list_print_jobs_v1',
    {
      action: params.action ?? undefined,
      date_from: params.dateFrom ?? undefined,
      date_to: params.dateTo ?? undefined,
      docname: params.docname,
      doctype: params.doctype,
      limit: params.limit ?? 20,
      template: params.template ?? undefined,
      user: params.user ?? undefined,
    },
  );
  const data = result.data ?? {};
  return {
    count: typeof data.count === 'number' ? data.count : 0,
    jobs: Array.isArray(data.jobs)
      ? data.jobs
          .map(mapPrintJob)
          .filter((item): item is PrintJobRecord => Boolean(item))
      : [],
    tableReady: data.table_ready !== false,
  };
}

export async function listPrintJobsGlobal(params: {
  action?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  docname?: string | null;
  doctype?: string | null;
  limit?: number;
  start?: number;
  status?: string | null;
  template?: string | null;
  user?: string | null;
}) {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'list_print_jobs_v2',
    {
      action: params.action ?? undefined,
      date_from: params.dateFrom ?? undefined,
      date_to: params.dateTo ?? undefined,
      docname: params.docname ?? undefined,
      doctype: params.doctype ?? undefined,
      limit: params.limit ?? 20,
      start: params.start ?? 0,
      status: params.status ?? undefined,
      template: params.template ?? undefined,
      user: params.user ?? undefined,
    },
  );
  const data = result.data ?? {};
  return {
    jobs: Array.isArray(data.jobs)
      ? data.jobs
          .map(mapPrintJob)
          .filter((item): item is PrintJobRecord => Boolean(item))
      : [],
    tableReady: data.table_ready !== false,
    total: typeof data.total === 'number' ? data.total : 0,
  };
}

export async function fetchPrintPreview(params: {
  doctype: string;
  docname: string;
  template?: string | null;
}) {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'get_print_preview_v1',
    {
      doctype: params.doctype,
      docname: params.docname,
      output: 'html',
      template: params.template ?? undefined,
    },
  );
  const data = result.data ?? {};

  return {
    availableTemplates: mapTemplateList(data.available_templates),
    docname: typeof data.docname === 'string' ? data.docname : params.docname,
    doctype: typeof data.doctype === 'string' ? data.doctype : params.doctype,
    html: typeof data.html === 'string' ? data.html : '',
    mimeType:
      typeof data.mime_type === 'string' ? data.mime_type : 'text/html',
    output: data.output === 'pdf' ? 'pdf' : 'html',
    template: mapTemplateOption(data.template) ?? fallbackTemplate(),
    title:
      typeof data.title === 'string'
        ? data.title
        : `${params.doctype} ${params.docname}`,
  } satisfies PrintPreviewData;
}

export async function fetchPrintFile(params: {
  doctype: string;
  docname: string;
  template?: string | null;
  filename?: string | null;
}) {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'get_print_file_v1',
    {
      archive: 0,
      doctype: params.doctype,
      docname: params.docname,
      filename: params.filename ?? undefined,
      template: params.template ?? undefined,
    },
  );
  const data = result.data ?? {};

  return {
    availableTemplates: mapTemplateList(data.available_templates),
    docname: typeof data.docname === 'string' ? data.docname : params.docname,
    doctype: typeof data.doctype === 'string' ? data.doctype : params.doctype,
    filename:
      typeof data.filename === 'string' ? data.filename : `${params.docname}.pdf`,
    fileSize: typeof data.file_size === 'number' ? data.file_size : 0,
    mimeType:
      typeof data.mime_type === 'string'
        ? data.mime_type
        : 'application/pdf',
    template: mapTemplateOption(data.template) ?? fallbackTemplate(),
    title:
      typeof data.title === 'string'
        ? data.title
        : `${params.doctype} ${params.docname}`,
  } satisfies PrintFileData;
}

export async function downloadPrintFile(params: {
  doctype: string;
  docname: string;
  template?: string | null;
  filename?: string | null;
}) {
  const response = await fetch(
    buildMyAppApiUrl('/api/method/myapp.api.gateway.download_print_file_v1'),
    {
      body: JSON.stringify({
        doctype: params.doctype,
        docname: params.docname,
        filename: params.filename ?? undefined,
        template: params.template ?? undefined,
      }),
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(getMyAppAuthHeaders() ?? {}),
      },
      method: 'POST',
    },
  );

  return readDownloadResponse(response, '下载打印文件失败');
}

export async function downloadPrintBatchArchive(params: {
  batchId: string;
  filename?: string | null;
}) {
  const response = await fetch(
    buildMyAppApiUrl(
      '/api/method/myapp.api.gateway.download_print_batch_archive_v1',
    ),
    {
      body: JSON.stringify({
        batch_id: params.batchId,
        filename: params.filename ?? undefined,
      }),
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(getMyAppAuthHeaders() ?? {}),
      },
      method: 'POST',
    },
  );
  return readDownloadResponse(response, '下载批量打印 ZIP 失败');
}

export async function downloadPrintBatchMergedPdf(params: {
  batchId: string;
  filename?: string | null;
}) {
  const response = await fetch(
    buildMyAppApiUrl(
      '/api/method/myapp.api.gateway.download_print_batch_merged_pdf_v1',
    ),
    {
      body: JSON.stringify({
        batch_id: params.batchId,
        filename: params.filename ?? undefined,
      }),
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(getMyAppAuthHeaders() ?? {}),
      },
      method: 'POST',
    },
  );
  return readDownloadResponse(response, '下载合并 PDF 失败');
}

export function openHtmlPreviewWindow(preview: PrintPreviewData) {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) {
    throw new Error('浏览器阻止了打印预览窗口');
  }
  printWindow.document.open();
  printWindow.document.write(preview.html);
  printWindow.document.close();
}

export function saveBlobAsFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.replace(/[\\/]/g, '-');
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function readDownloadResponse(response: Response, fallback: string) {
  if (response.ok) {
    return response.blob();
  }
  try {
    const payload = (await response.json()) as Record<string, unknown>;
    const messageValue =
      typeof payload.message === 'string'
        ? payload.message
        : payload.message && typeof payload.message === 'object'
          ? (payload.message as Record<string, unknown>).message
          : null;
    throw new Error(typeof messageValue === 'string' ? messageValue : fallback);
  } catch (caught) {
    if (caught instanceof Error && caught.message !== 'Unexpected end of JSON input') {
      throw caught;
    }
    throw new Error(fallback);
  }
}
