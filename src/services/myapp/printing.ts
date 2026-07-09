import { callGatewayMethod } from './api-client';
import { buildMyAppApiUrl } from './api-base';
import { getMyAppAuthHeaders } from './auth-storage';

export type PrintTemplateOption = {
  category: string;
  description: string | null;
  enabled: boolean;
  key: string;
  label: string;
  managed: boolean;
  orientation: string;
  paperSize: string;
  printFormat: string | null;
  isDefault: boolean;
  source: string;
  templateHash: string | null;
  templateVersion: string | null;
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
    source: 'fallback',
    templateHash: null,
    templateVersion: null,
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

  if (!response.ok) {
    throw new Error('下载打印文件失败');
  }

  return response.blob();
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
