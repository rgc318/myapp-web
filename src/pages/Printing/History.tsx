import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Link, useRequest } from '@umijs/max';
import { Button, Tag, Typography } from 'antd';
import React, { useMemo, useRef } from 'react';
import {
  listPrintDoctypes,
  listPrintJobsGlobal,
  type PrintJobRecord,
} from '@/services/myapp/printing';

const PrintHistoryPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const { data: doctypes = [] } = useRequest(listPrintDoctypes, {
    formatResult: (result) => result,
  });

  const columns = useMemo<ProColumns<PrintJobRecord>[]>(
    () => [
      {
        title: '单据类型',
        dataIndex: 'doctype',
        valueType: 'select',
        width: 170,
        fieldProps: {
          options: doctypes.map((item) => ({
            label: item.label,
            value: item.doctype,
          })),
        },
      },
      {
        title: '单据号',
        dataIndex: 'docname',
        width: 210,
        render: (_, row) => {
          const path = documentPath(row.doctype, row.docname);
          return path ? <Link to={path}>{row.docname}</Link> : row.docname;
        },
      },
      {
        title: '动作',
        dataIndex: 'action',
        valueType: 'select',
        width: 100,
        valueEnum: {
          archive: { text: '归档' },
          download: { text: '下载' },
          preview: { text: '预览' },
          print: { text: '打印' },
          share: { text: '分享' },
        },
        render: (_, row) => <PrintActionTag action={row.action} />,
      },
      {
        title: '状态',
        dataIndex: 'status',
        valueType: 'select',
        width: 100,
        valueEnum: {
          failed: { status: 'Error', text: '失败' },
          skipped: { status: 'Default', text: '跳过' },
          success: { status: 'Success', text: '成功' },
        },
      },
      {
        title: '模板',
        dataIndex: 'templateKey',
        width: 170,
        render: (_, row) => row.template.label || row.template.key || '-',
      },
      {
        title: '日期范围',
        dataIndex: 'dateRange',
        valueType: 'dateRange',
        hideInTable: true,
      },
      {
        title: '操作人',
        dataIndex: 'user',
        hideInTable: true,
      },
      {
        title: '操作人',
        dataIndex: 'printedBy',
        search: false,
        width: 190,
      },
      {
        title: '操作时间',
        dataIndex: 'printedAt',
        search: false,
        width: 180,
      },
      {
        title: '文件',
        dataIndex: 'filename',
        search: false,
        ellipsis: true,
        render: (_, row) => row.filename ?? '-',
      },
      {
        title: '错误',
        dataIndex: 'error',
        search: false,
        ellipsis: true,
        render: (_, row) =>
          row.error ? (
            <Typography.Text type="danger">{row.error}</Typography.Text>
          ) : (
            '-'
          ),
      },
      {
        title: '操作',
        valueType: 'option',
        width: 100,
        render: (_, row) => [
          <Button
            key="preview"
            onClick={() => {
              const params = new URLSearchParams({
                docname: row.docname,
                doctype: row.doctype,
              });
              if (row.template.key) {
                params.set('template', row.template.key);
              }
              window.open(
                `/printing/preview?${params.toString()}`,
                '_blank',
                'noopener,noreferrer',
              );
            }}
            type="link"
          >
            补打
          </Button>,
        ],
      },
    ],
    [doctypes],
  );

  return (
    <PageContainer
      title="打印历史"
      extra={[
        <Button key="refresh" onClick={() => actionRef.current?.reload()}>
          刷新
        </Button>,
      ]}
    >
      <ProTable<PrintJobRecord>
        actionRef={actionRef}
        columns={columns}
        pagination={{ defaultPageSize: 20, showSizeChanger: false }}
        request={async (params) => {
          const pageSize = Number(params.pageSize ?? 20);
          const current = Number(params.current ?? 1);
          const dateRange = Array.isArray(params.dateRange)
            ? params.dateRange
            : [];
          const result = await listPrintJobsGlobal({
            action:
              typeof params.action === 'string' ? params.action : undefined,
            dateFrom: dateRange[0] ? String(dateRange[0]) : undefined,
            dateTo: dateRange[1] ? String(dateRange[1]) : undefined,
            docname:
              typeof params.docname === 'string' ? params.docname : undefined,
            doctype:
              typeof params.doctype === 'string' ? params.doctype : undefined,
            limit: pageSize,
            start: (current - 1) * pageSize,
            status:
              typeof params.status === 'string' ? params.status : undefined,
            template:
              typeof params.templateKey === 'string'
                ? params.templateKey
                : undefined,
            user: typeof params.user === 'string' ? params.user : undefined,
          });
          return {
            data: result.jobs,
            success: result.tableReady,
            total: result.total,
          };
        }}
        rowKey="jobId"
        search={{ defaultCollapsed: false, labelWidth: 88 }}
        scroll={{ x: 1500 }}
      />
    </PageContainer>
  );
};

function PrintActionTag({ action }: { action: string }) {
  const values: Record<string, { color: string; label: string }> = {
    archive: { color: 'purple', label: '归档' },
    download: { color: 'blue', label: '下载' },
    preview: { color: 'default', label: '预览' },
    print: { color: 'green', label: '打印' },
    share: { color: 'cyan', label: '分享' },
  };
  const value = values[action] ?? { color: 'default', label: action };
  return <Tag color={value.color}>{value.label}</Tag>;
}

function documentPath(doctype: string, docname: string) {
  const basePaths: Record<string, string> = {
    'Delivery Note': '/sales/delivery-notes',
    'Purchase Invoice': '/purchase/invoices',
    'Purchase Order': '/purchase/orders',
    'Purchase Receipt': '/purchase/receipts',
    'Sales Invoice': '/sales/invoices',
    'Sales Order': '/sales/orders',
  };
  const basePath = basePaths[doctype];
  return basePath ? `${basePath}/${encodeURIComponent(docname)}` : null;
}

export default PrintHistoryPage;
