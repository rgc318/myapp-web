import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Drawer,
  message,
  Progress,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import {
  cancelPrintBatch,
  downloadPrintBatchArchive,
  downloadPrintBatchMergedPdf,
  getPrintBatch,
  listPrintBatches,
  type PrintBatch,
  type PrintBatchResult,
  type PrintBatchStatus,
  retryPrintBatchFailed,
  saveBlobAsFile,
} from '@/services/myapp/printing';

const FINAL_STATUSES: PrintBatchStatus[] = [
  'canceled',
  'completed',
  'partial_failed',
  'failed',
];

const PrintBatchesPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [batch, setBatch] = useState<PrintBatch | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [messageApi, messageContext] = message.useMessage();

  const loadBatch = async (batchId: string) => {
    setDetailLoading(true);
    try {
      setBatch(await getPrintBatch(batchId));
    } catch (caught) {
      messageApi.error(
        caught instanceof Error ? caught.message : '获取打印批次失败',
      );
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedBatchId) {
      setBatch(null);
      return;
    }
    void loadBatch(selectedBatchId);
  }, [selectedBatchId]);

  useEffect(() => {
    if (!selectedBatchId || !batch || FINAL_STATUSES.includes(batch.status)) {
      return;
    }
    const timer = window.setTimeout(
      () => {
        void loadBatch(selectedBatchId);
        actionRef.current?.reload();
      },
      document.visibilityState === 'visible' ? 2000 : 5000,
    );
    return () => window.clearTimeout(timer);
  }, [batch?.status, selectedBatchId]);

  const runBatchAction = async (
    action: 'cancel' | 'retry' | 'download' | 'merge',
  ) => {
    if (!batch) {
      return;
    }
    setDetailLoading(true);
    try {
      if (action === 'cancel') {
        await cancelPrintBatch(batch.batchId);
        await loadBatch(batch.batchId);
      } else if (action === 'retry') {
        const result = await retryPrintBatchFailed(batch.batchId);
        setSelectedBatchId(result.batch.batchId);
        messageApi.success(`已创建重试批次 ${result.batch.batchId}`);
      } else if (action === 'download') {
        const blob = await downloadPrintBatchArchive({
          batchId: batch.batchId,
        });
        saveBlobAsFile(blob, `${batch.batchId}.zip`);
      } else {
        const blob = await downloadPrintBatchMergedPdf({
          batchId: batch.batchId,
        });
        saveBlobAsFile(blob, `${batch.batchId}-merged.pdf`);
      }
      actionRef.current?.reload();
    } catch (caught) {
      messageApi.error(caught instanceof Error ? caught.message : '操作失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const columns: ProColumns<PrintBatch>[] = [
    {
      title: '批次号',
      dataIndex: 'batchId',
      search: false,
      width: 240,
      render: (_, row) => (
        <Button onClick={() => setSelectedBatchId(row.batchId)} type="link">
          {row.batchId}
        </Button>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      width: 120,
      valueEnum: batchStatusValueEnum(),
      render: (_, row) => <BatchStatusTag status={row.status} />,
    },
    {
      title: '日期范围',
      dataIndex: 'dateRange',
      valueType: 'dateRange',
      hideInTable: true,
    },
    {
      title: '申请人',
      dataIndex: 'requestedBy',
      width: 190,
    },
    {
      title: '单据类型',
      dataIndex: 'doctypes',
      search: false,
      width: 180,
      render: (_, row) => row.doctypes.join('、') || '-',
    },
    {
      title: '进度',
      dataIndex: 'progress',
      search: false,
      width: 210,
      render: (_, row) => (
        <Progress percent={Math.round(row.progress * 100)} size="small" />
      ),
    },
    {
      title: '结果',
      search: false,
      width: 210,
      render: (_, row) => (
        <Space size={4} wrap>
          <Tag>共 {row.totalCount}</Tag>
          <Tag color="success">成功 {row.successCount}</Tag>
          {row.failedCount ? (
            <Tag color="error">失败 {row.failedCount}</Tag>
          ) : null}
          {row.skippedCount ? <Tag>跳过 {row.skippedCount}</Tag> : null}
        </Space>
      ),
    },
    {
      title: '申请时间',
      dataIndex: 'requestedAt',
      search: false,
      width: 180,
    },
  ];

  return (
    <PageContainer
      title="批量打印任务"
      extra={[
        <Button key="refresh" onClick={() => actionRef.current?.reload()}>
          刷新
        </Button>,
      ]}
    >
      {messageContext}
      <ProTable<PrintBatch>
        actionRef={actionRef}
        columns={columns}
        pagination={{ defaultPageSize: 20, showSizeChanger: false }}
        request={async (params) => {
          const pageSize = Number(params.pageSize ?? 20);
          const current = Number(params.current ?? 1);
          const dateRange = Array.isArray(params.dateRange)
            ? params.dateRange
            : [];
          const result = await listPrintBatches({
            dateFrom: dateRange[0] ? String(dateRange[0]) : undefined,
            dateTo: dateRange[1] ? String(dateRange[1]) : undefined,
            limit: pageSize,
            requestedBy:
              typeof params.requestedBy === 'string'
                ? params.requestedBy
                : undefined,
            start: (current - 1) * pageSize,
            status: params.status as PrintBatchStatus | undefined,
          });
          return {
            data: result.batches,
            success: result.tableReady,
            total: result.total,
          };
        }}
        rowKey="batchId"
        search={{ defaultCollapsed: false, labelWidth: 88 }}
      />
      <Drawer
        destroyOnClose
        extra={
          batch ? (
            <Space wrap>
              <Button onClick={() => void loadBatch(batch.batchId)}>
                刷新
              </Button>
              {!FINAL_STATUSES.includes(batch.status) ? (
                <Button
                  danger
                  loading={detailLoading}
                  onClick={() => void runBatchAction('cancel')}
                >
                  取消任务
                </Button>
              ) : null}
              {batch.failedCount ? (
                <Button
                  loading={detailLoading}
                  onClick={() => void runBatchAction('retry')}
                >
                  重试失败项
                </Button>
              ) : null}
              {batch.successCount ? (
                <>
                  <Button
                    loading={detailLoading}
                    onClick={() => void runBatchAction('merge')}
                  >
                    合并 PDF
                  </Button>
                  <Button
                    loading={detailLoading}
                    onClick={() => void runBatchAction('download')}
                    type="primary"
                  >
                    下载 ZIP
                  </Button>
                </>
              ) : null}
            </Space>
          ) : null
        }
        loading={detailLoading}
        onClose={() => setSelectedBatchId(null)}
        open={Boolean(selectedBatchId)}
        title={batch ? `打印批次 ${batch.batchId}` : '打印批次'}
        width={900}
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
              <BatchStatusTag status={batch.status} />
              <Progress
                percent={Math.round(batch.progress * 100)}
                style={{ minWidth: 560 }}
              />
            </Space>
            {batch.error ? (
              <Alert showIcon type="error" title={batch.error} />
            ) : null}
            <Typography.Text type="secondary">
              {[batch.requestedBy, batch.requestedAt]
                .filter(Boolean)
                .join(' · ')}
            </Typography.Text>
            <ProTable<PrintBatchResult>
              columns={[
                { title: '单据类型', dataIndex: 'doctype', width: 160 },
                { title: '单据号', dataIndex: 'docname', width: 200 },
                {
                  title: '状态',
                  dataIndex: 'status',
                  width: 100,
                  render: (_, row) => (
                    <Tag
                      color={
                        row.status === 'success'
                          ? 'success'
                          : row.status === 'failed'
                            ? 'error'
                            : 'default'
                      }
                    >
                      {row.status === 'success'
                        ? '成功'
                        : row.status === 'failed'
                          ? '失败'
                          : '跳过'}
                    </Tag>
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
    </PageContainer>
  );
};

function BatchStatusTag({ status }: { status: PrintBatchStatus }) {
  const values = batchStatusValueEnum();
  const value = values[status];
  const colors: Record<PrintBatchStatus, string> = {
    cancel_requested: 'warning',
    canceled: 'default',
    completed: 'success',
    failed: 'error',
    partial_failed: 'warning',
    processing: 'processing',
    queued: 'blue',
  };
  return <Tag color={colors[status]}>{value.text}</Tag>;
}

function batchStatusValueEnum() {
  return {
    cancel_requested: { status: 'Warning', text: '取消中' },
    canceled: { status: 'Default', text: '已取消' },
    completed: { status: 'Success', text: '已完成' },
    failed: { status: 'Error', text: '失败' },
    partial_failed: { status: 'Warning', text: '部分失败' },
    processing: { status: 'Processing', text: '处理中' },
    queued: { status: 'Processing', text: '排队中' },
  } as const;
}

export default PrintBatchesPage;
