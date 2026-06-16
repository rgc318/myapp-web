import { callGatewayMethod } from './api-client';
import { buildMyAppApiUrl } from './api-base';
import { getMyAppAuthHeaders } from './auth-storage';

export type PrintTemplateOption = {
  key: string;
  label: string;
  printFormat: string | null;
  isDefault: boolean;
  source: string;
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
    isDefault: Boolean(row.is_default),
    key,
    label: typeof row.label === 'string' ? row.label : key,
    printFormat:
      typeof row.print_format === 'string' ? row.print_format : null,
    source: typeof row.source === 'string' ? row.source : 'unknown',
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
    isDefault: false,
    key: 'standard',
    label: '标准模板',
    printFormat: null,
    source: 'fallback',
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
