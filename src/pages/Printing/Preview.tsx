import { PageContainer } from '@ant-design/pro-components';
import { useLocation, useRequest } from '@umijs/max';
import { Alert, Button, Card, message, Select, Space, Spin } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import {
  downloadPrintFile,
  fetchPrintFile,
  fetchPrintPreview,
  recordPrintJob,
  saveBlobAsFile,
} from '@/services/myapp/printing';

const PrintPreviewPage: React.FC = () => {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const doctype = query.get('doctype') ?? '';
  const docname = query.get('docname') ?? '';
  const initialTemplate = query.get('template');
  const [template, setTemplate] = useState<string | null>(initialTemplate);
  const [actionLoading, setActionLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const recordedPreviewKey = useRef<string | null>(null);
  const [messageApi, messageContext] = message.useMessage();

  const { data, error, loading, refresh } = useRequest(
    () => fetchPrintPreview({ docname, doctype, template }),
    {
      formatResult: (result) => result,
      ready: Boolean(doctype && docname),
      refreshDeps: [doctype, docname, template],
    },
  );

  useEffect(() => {
    if (!data) {
      return;
    }
    const previewKey = `${data.doctype}:${data.docname}:${data.template.key}`;
    if (recordedPreviewKey.current === previewKey) {
      return;
    }
    recordedPreviewKey.current = previewKey;
    void recordPrintJob({
      action: 'preview',
      docname: data.docname,
      doctype: data.doctype,
      metadata: { client: 'web', source_page: 'printing_preview' },
      output: 'html',
      status: 'success',
      template: data.template.key,
    }).catch(() => undefined);
  }, [data]);

  const printDocument = async () => {
    if (!data) {
      return;
    }
    iframeRef.current?.contentWindow?.focus();
    iframeRef.current?.contentWindow?.print();
    void recordPrintJob({
      action: 'print',
      docname: data.docname,
      doctype: data.doctype,
      metadata: {
        client: 'web',
        source_page: 'printing_preview',
        semantics: 'print_dialog_opened',
      },
      output: 'html',
      status: 'success',
      template: data.template.key,
    }).catch(() => undefined);
  };

  const downloadPdf = async () => {
    if (!data) {
      return;
    }
    setActionLoading(true);
    try {
      const file = await fetchPrintFile({
        docname: data.docname,
        doctype: data.doctype,
        template: data.template.key,
      });
      const blob = await downloadPrintFile({
        docname: data.docname,
        doctype: data.doctype,
        filename: file.filename,
        template: file.template.key,
      });
      saveBlobAsFile(blob, file.filename);
      void recordPrintJob({
        action: 'download',
        docname: data.docname,
        doctype: data.doctype,
        filename: file.filename,
        metadata: { client: 'web', source_page: 'printing_preview' },
        output: 'pdf',
        status: 'success',
        template: file.template.key,
      }).catch(() => undefined);
    } catch (caught) {
      messageApi.error(caught instanceof Error ? caught.message : '下载失败');
    } finally {
      setActionLoading(false);
    }
  };

  if (!doctype || !docname) {
    return (
      <PageContainer title="打印预览">
        <Alert showIcon type="error" title="缺少单据类型或单据号" />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={data?.title ?? '打印预览'}
      extra={[
        <Select
          key="template"
          loading={loading}
          onChange={(value) => setTemplate(value)}
          options={(data?.availableTemplates ?? []).map((item) => ({
            label: `${item.label} · ${item.paperSize}`,
            value: item.key,
          }))}
          placeholder="使用默认模板"
          style={{ minWidth: 220 }}
          value={data?.template.key ?? template ?? undefined}
        />,
        <Button key="refresh" onClick={refresh}>
          刷新
        </Button>,
        <Button
          key="download"
          loading={actionLoading}
          onClick={() => void downloadPdf()}
        >
          下载 PDF
        </Button>,
        <Button key="print" type="primary" onClick={() => void printDocument()}>
          系统打印
        </Button>,
      ]}
    >
      {messageContext}
      {error ? (
        <Alert
          action={<Button onClick={refresh}>重试</Button>}
          description={error.message}
          showIcon
          type="error"
          title="打印预览加载失败"
        />
      ) : null}
      {loading && !data ? (
        <Card style={{ textAlign: 'center' }}>
          <Space orientation="vertical">
            <Spin size="large" />
            <span>正在生成打印预览</span>
          </Space>
        </Card>
      ) : null}
      {data ? (
        <Card styles={{ body: { padding: 0 } }}>
          <iframe
            ref={iframeRef}
            sandbox="allow-modals allow-same-origin"
            srcDoc={data.html}
            style={{ border: 0, height: 'calc(100vh - 190px)', width: '100%' }}
            title={data.title}
          />
        </Card>
      ) : null}
    </PageContainer>
  );
};

export default PrintPreviewPage;
