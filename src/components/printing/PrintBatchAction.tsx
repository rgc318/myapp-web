import { ProCard, ProTable } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Drawer,
  Modal,
  message,
  Progress,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import {
  cancelPrintBatch,
  createPrintBatch,
  downloadPrintBatchArchive,
  fetchPrintTemplates,
  getPrintBatch,
  type PrintBatch,
  type PrintBatchDocument,
  type PrintBatchResult,
  type PrintBatchStatus,
  type PrintTemplateOption,
  retryPrintBatchFailed,
  saveBlobAsFile,
} from '@/services/myapp/printing';

const FINAL_STATUSES: PrintBatchStatus[] = [
  'canceled',
  'completed',
  'partial_failed',
  'failed',
];

export function PrintBatchAction({
  documents,
  sourcePage,
}: {
  documents: PrintBatchDocument[];
  sourcePage: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [templates, setTemplates] = useState<PrintTemplateOption[]>([]);
  const [template, setTemplate] = useState<string | null>(null);
  const [batch, setBatch] = useState<PrintBatch | null>(null);
  const [messageApi, messageContext] = message.useMessage();
  const doctype = documents[0]?.doctype ?? '';
  const invalidSelection = useMemo(
    () => documents.some((item) => item.doctype !== doctype),
    [doctype, documents],
  );

  const openCreateModal = async () => {
    if (!documents.length || invalidSelection) {
      messageApi.error('批量打印必须选择同一种单据类型');
      return;
    }
    if (documents.length > 100) {
      messageApi.error('单个打印批次最多支持 100 张单据');
      return;
    }
    setModalOpen(true);
    setLoading(true);
    try {
      const result = await fetchPrintTemplates({ doctype });
      setTemplates(result.templates);
      setTemplate(result.defaultTemplate);
    } catch (caught) {
      messageApi.error(
        caught instanceof Error ? caught.message : '获取打印模板失败',
      );
    } finally {
      setLoading(false);
    }
  };

  const createBatch = async () => {
    setLoading(true);
    try {
      const result = await createPrintBatch({
        documents,
        metadata: {
          client: 'web',
          source_page: sourcePage,
        },
        template,
      });
      if (!result.tableReady || !result.batchId) {
        throw new Error('打印批次表尚未准备，请先执行站点迁移');
      }
      setBatch(result);
      setModalOpen(false);
      setDrawerOpen(true);
      messageApi.success(`打印批次 ${result.batchId} 已创建`);
    } catch (caught) {
      messageApi.error(
        caught instanceof Error ? caught.message : '创建打印批次失败',
      );
    } finally {
      setLoading(false);
    }
  };

  const refreshBatch = async () => {
    if (!batch?.batchId) {
      return;
    }
    try {
      setBatch(await getPrintBatch(batch.batchId));
    } catch (caught) {
      messageApi.error(
        caught instanceof Error ? caught.message : '刷新打印批次失败',
      );
    }
  };

  useEffect(() => {
    if (
      !drawerOpen ||
      !batch?.batchId ||
      FINAL_STATUSES.includes(batch.status)
    ) {
      return;
    }
    const timer = window.setTimeout(
      () => {
        void refreshBatch();
      },
      document.visibilityState === 'visible' ? 2000 : 5000,
    );
    return () => window.clearTimeout(timer);
  }, [batch?.batchId, batch?.status, drawerOpen]);

  const cancelBatch = async () => {
    if (!batch) {
      return;
    }
    setActionLoading(true);
    try {
      await cancelPrintBatch(batch.batchId);
      await refreshBatch();
    } catch (caught) {
      messageApi.error(caught instanceof Error ? caught.message : '取消失败');
    } finally {
      setActionLoading(false);
    }
  };

  const retryFailed = async () => {
    if (!batch) {
      return;
    }
    setActionLoading(true);
    try {
      const result = await retryPrintBatchFailed(batch.batchId);
      setBatch(result.batch);
      messageApi.success(`已创建重试批次 ${result.batch.batchId}`);
    } catch (caught) {
      messageApi.error(caught instanceof Error ? caught.message : '重试失败');
    } finally {
      setActionLoading(false);
    }
  };

  const downloadArchive = async () => {
    if (!batch) {
      return;
    }
    setActionLoading(true);
    try {
      const blob = await downloadPrintBatchArchive({ batchId: batch.batchId });
      saveBlobAsFile(blob, `${batch.batchId}.zip`);
    } catch (caught) {
      messageApi.error(caught instanceof Error ? caught.message : '下载失败');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      {messageContext}
      <Button onClick={() => void openCreateModal()} type="primary">
        批量打印
      </Button>
      <Modal
        confirmLoading={loading}
        onCancel={() => setModalOpen(false)}
        onOk={() => void createBatch()}
        open={modalOpen}
        okButtonProps={{ disabled: loading || !documents.length }}
        title="创建批量打印任务"
      >
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            showIcon
            type="info"
            title={`已选择 ${documents.length} 张 ${doctype}`}
            description="任务将在后台逐张生成并归档 PDF，完成后可下载 ZIP。"
          />
          <Select
            allowClear
            loading={loading}
            onChange={(value) => setTemplate(value ?? null)}
            options={templates.map((item) => ({
              label: `${item.label} · ${item.paperSize} · ${templateCategoryLabel(item.category)}`,
              value: item.key,
            }))}
            placeholder="使用后端默认模板"
            style={{ width: '100%' }}
            value={template ?? undefined}
          />
          <Typography.Text type="secondary">
            批量打印最多支持 100 张单据。部分失败不会阻断成功文件下载。
          </Typography.Text>
        </Space>
      </Modal>
      <Drawer
        destroyOnClose
        extra={
          <Space wrap>
            <Button onClick={() => void refreshBatch()}>刷新</Button>
            {batch && !FINAL_STATUSES.includes(batch.status) ? (
              <Button
                danger
                loading={actionLoading}
                onClick={() => void cancelBatch()}
              >
                取消任务
              </Button>
            ) : null}
            {batch?.failedCount ? (
              <Button
                loading={actionLoading}
                onClick={() => void retryFailed()}
              >
                重试失败项
              </Button>
            ) : null}
            {batch?.successCount ? (
              <Button
                loading={actionLoading}
                onClick={() => void downloadArchive()}
                type="primary"
              >
                下载 ZIP
              </Button>
            ) : null}
          </Space>
        }
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        title={batch ? `打印批次 ${batch.batchId}` : '打印批次'}
        width={880}
      >
        {batch ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <ProCard split="vertical">
              <ProCard>
                <Statistic title="总数" value={batch.totalCount} />
              </ProCard>
              <ProCard>
                <Statistic title="成功" value={batch.successCount} />
              </ProCard>
              <ProCard>
                <Statistic title="失败" value={batch.failedCount} />
              </ProCard>
              <ProCard>
                <Statistic title="跳过" value={batch.skippedCount} />
              </ProCard>
            </ProCard>
            <Space style={{ width: '100%' }}>
              <PrintBatchStatusTag status={batch.status} />
              <Progress
                percent={Math.round(batch.progress * 100)}
                status={batch.status === 'failed' ? 'exception' : undefined}
                style={{ minWidth: 520 }}
              />
            </Space>
            {batch.error ? (
              <Alert showIcon type="error" title={batch.error} />
            ) : null}
            <ProTable<PrintBatchResult>
              columns={[
                { title: '单据类型', dataIndex: 'doctype', width: 150 },
                { title: '单据号', dataIndex: 'docname', width: 190 },
                {
                  title: '状态',
                  dataIndex: 'status',
                  width: 100,
                  render: (_, row) => (
                    <PrintResultStatusTag status={row.status} />
                  ),
                },
                { title: '文件名', dataIndex: 'filename', ellipsis: true },
                { title: '失败原因', dataIndex: 'error', ellipsis: true },
              ]}
              dataSource={batch.results}
              pagination={false}
              rowKey={(row) => `${row.doctype}:${row.docname}`}
              search={false}
              toolBarRender={false}
            />
          </Space>
        ) : null}
      </Drawer>
    </>
  );
}

function PrintBatchStatusTag({ status }: { status: PrintBatchStatus }) {
  const values: Record<PrintBatchStatus, { color: string; label: string }> = {
    cancel_requested: { color: 'warning', label: '取消中' },
    canceled: { color: 'default', label: '已取消' },
    completed: { color: 'success', label: '已完成' },
    failed: { color: 'error', label: '失败' },
    partial_failed: { color: 'warning', label: '部分失败' },
    processing: { color: 'processing', label: '处理中' },
    queued: { color: 'blue', label: '排队中' },
  };
  const value = values[status];
  return <Tag color={value.color}>{value.label}</Tag>;
}

function PrintResultStatusTag({
  status,
}: {
  status: PrintBatchResult['status'];
}) {
  const values = {
    failed: { color: 'error', label: '失败' },
    skipped: { color: 'default', label: '跳过' },
    success: { color: 'success', label: '成功' },
  } as const;
  const value = values[status];
  return <Tag color={value.color}>{value.label}</Tag>;
}

function templateCategoryLabel(category: string) {
  return (
    {
      external: '对外',
      finance: '财务',
      standard: '标准',
      warehouse: '仓库',
    }[category] ?? category
  );
}
