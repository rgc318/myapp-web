import type { MenuProps } from 'antd';
import {
  Button,
  Drawer,
  Dropdown,
  Empty,
  List,
  message,
  Space,
  Tag,
  Typography,
} from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import {
  downloadPrintFile,
  fetchPrintFile,
  fetchPrintPreview,
  fetchPrintTemplates,
  listPrintJobs,
  openHtmlPreviewWindow,
  type PrintJobRecord,
  type PrintTemplateOption,
  recordPrintJob,
  saveBlobAsFile,
} from '@/services/myapp/printing';

export function PrintDocumentButton({
  disabled,
  docname,
  doctype,
}: {
  disabled?: boolean;
  docname: string;
  doctype: string;
}) {
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [printJobs, setPrintJobs] = useState<PrintJobRecord[]>([]);
  const [templates, setTemplates] = useState<PrintTemplateOption[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);

  useEffect(() => {
    setHistoryOpen(false);
    setPrintJobs([]);
    setTemplates([]);
    setTemplatesLoaded(false);
  }, [docname, doctype]);

  const effectiveTemplates = useMemo(
    () =>
      templates.length
        ? templates
        : [
            {
              category: 'standard',
              description: null,
              enabled: true,
              isDefault: true,
              key: 'standard',
              label: '标准模板',
              managed: false,
              orientation: 'Portrait',
              paperSize: 'A4',
              printFormat: null,
              source: 'fallback',
              templateHash: null,
              templateVersion: null,
            },
          ],
    [templates],
  );

  const loadTemplates = async () => {
    if (templatesLoaded || disabled) {
      return;
    }

    setLoading(true);
    try {
      const result = await fetchPrintTemplates({ doctype });
      setTemplates(result.templates);
      setTemplatesLoaded(true);
    } catch (caught) {
      message.error(
        caught instanceof Error ? caught.message : '获取打印模板失败',
      );
    } finally {
      setLoading(false);
    }
  };

  const runPrintAction = async (
    mode: 'preview' | 'download',
    template: string,
  ) => {
    setLoading(true);
    try {
      if (mode === 'preview') {
        const preview = await fetchPrintPreview({ docname, doctype, template });
        openHtmlPreviewWindow(preview);
        void recordPrintAction({
          action: 'preview',
          output: 'html',
          template: preview.template.key,
        });
        return;
      }

      const file = await fetchPrintFile({ docname, doctype, template });
      const blob = await downloadPrintFile({
        docname,
        doctype,
        filename: file.filename,
        template: file.template.key,
      });
      saveBlobAsFile(blob, file.filename);
      void recordPrintAction({
        action: 'download',
        filename: file.filename,
        output: 'pdf',
        template: file.template.key,
      });
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '打印失败');
    } finally {
      setLoading(false);
    }
  };

  const recordPrintAction = async ({
    action,
    filename,
    output,
    template,
  }: {
    action: 'preview' | 'download';
    filename?: string;
    output: 'html' | 'pdf';
    template: string;
  }) => {
    try {
      await recordPrintJob({
        action,
        docname,
        doctype,
        filename,
        metadata: { client: 'web' },
        output,
        status: 'success',
        template,
      });
    } catch {
      // Printing should not fail just because audit recording failed.
    }
  };

  const loadPrintHistory = async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const result = await listPrintJobs({
        docname,
        doctype,
        limit: 20,
      });
      setPrintJobs(result.jobs);
    } catch (caught) {
      message.error(
        caught instanceof Error ? caught.message : '获取打印历史失败',
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  const menuItems = useMemo<MenuProps['items']>(() => {
    const historyItems: MenuProps['items'] = [
      { type: 'divider' },
      { key: 'history', label: '打印历史' },
    ];

    if (effectiveTemplates.length <= 1) {
      const template = effectiveTemplates[0]?.key ?? 'standard';
      return [
        { key: `preview:${template}`, label: '打印预览' },
        { key: `download:${template}`, label: '下载 PDF' },
        ...historyItems,
      ];
    }

    return [
      ...effectiveTemplates.flatMap((template) => [
        {
          key: `preview:${template.key}`,
          label: renderTemplateMenuLabel('预览', template),
        },
        {
          key: `download:${template.key}`,
          label: renderTemplateMenuLabel('下载 PDF', template),
        },
      ]),
      ...historyItems,
    ];
  }, [effectiveTemplates]);

  return (
    <>
      <Dropdown
        disabled={disabled}
        menu={{
          items: menuItems,
          onClick: ({ key }) => {
            if (key === 'history') {
              void loadPrintHistory();
              return;
            }
            const [mode, template] = String(key).split(':');
            void runPrintAction(
              mode === 'download' ? 'download' : 'preview',
              template || 'standard',
            );
          },
        }}
        onOpenChange={(open) => {
          if (open) {
            void loadTemplates();
          }
        }}
      >
        <Button disabled={disabled} loading={loading}>
          打印
        </Button>
      </Dropdown>
      <Drawer
        destroyOnClose
        onClose={() => setHistoryOpen(false)}
        open={historyOpen}
        title="打印历史"
        width={520}
      >
        <List
          dataSource={printJobs}
          loading={historyLoading}
          locale={{ emptyText: <Empty description="暂无打印历史" /> }}
          renderItem={(job) => (
            <List.Item>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Space wrap>
                  <Tag color={printActionColor(job.action)}>
                    {printActionLabel(job.action)}
                  </Tag>
                  <Tag>{job.output.toUpperCase()}</Tag>
                  <Typography.Text strong>
                    {job.template.label || job.template.key || '默认模板'}
                  </Typography.Text>
                </Space>
                {job.filename ? (
                  <Typography.Text>{job.filename}</Typography.Text>
                ) : null}
                <Typography.Text type="secondary">
                  {[job.printedBy, job.printedAt].filter(Boolean).join(' · ')}
                </Typography.Text>
              </Space>
            </List.Item>
          )}
        />
      </Drawer>
    </>
  );
}

function printActionLabel(action: string) {
  const labels: Record<string, string> = {
    archive: '归档',
    download: '下载',
    preview: '预览',
    print: '打印',
    share: '分享',
  };
  return labels[action] ?? action;
}

function printActionColor(action: string) {
  const colors: Record<string, string> = {
    archive: 'purple',
    download: 'blue',
    preview: 'default',
    print: 'green',
    share: 'cyan',
  };
  return colors[action] ?? 'default';
}

function renderTemplateMenuLabel(
  action: string,
  template: PrintTemplateOption,
) {
  return (
    <Space direction="vertical" size={0}>
      <Space size={6}>
        <span>{`${action} - ${template.label}`}</span>
        <Tag color={printTemplateCategoryColor(template.category)}>
          {printTemplateCategoryLabel(template.category)}
        </Tag>
      </Space>
      {template.description ? (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {template.description}
        </Typography.Text>
      ) : null}
    </Space>
  );
}

function printTemplateCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    external: '对外',
    finance: '财务',
    standard: '标准',
    warehouse: '仓库',
  };
  return labels[category] ?? category;
}

function printTemplateCategoryColor(category: string) {
  const colors: Record<string, string> = {
    external: 'blue',
    finance: 'gold',
    standard: 'default',
    warehouse: 'green',
  };
  return colors[category] ?? 'default';
}
