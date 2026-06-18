import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import { history, Link } from '@umijs/max';
import { Button, Space, Statistic } from 'antd';
import dayjs from 'dayjs';
import React, { useRef, useState } from 'react';
import { RemoteLinkSelect } from '@/components';
import { useWorkspacePreferences } from '@/hooks/useWorkspacePreferences';
import { toOptionalText } from '@/services/myapp/api-utils';
import {
  type PurchaseOrderSearchSummary,
  type PurchaseOrderSummary,
  searchPurchaseOrders,
} from '@/services/myapp/purchase';
import { formatCurrencyValue, StatusTag } from '@/utils/myapp-display';

const PAGE_SIZE = 20;

function buildColumns(
  defaultCompany: string,
): ProColumns<PurchaseOrderSummary>[] {
  return [
    {
      title: '关键词',
      dataIndex: 'searchKey',
      hideInTable: true,
      fieldProps: {
        allowClear: true,
        placeholder: '订单号 / 供应商 / 公司',
      },
    },
    {
      title: '订单号',
      dataIndex: 'name',
      search: false,
      width: 180,
      render: (_, record) => (
        <Link to={`/purchase/orders/${encodeURIComponent(record.name)}`}>
          {record.name}
        </Link>
      ),
    },
    {
      title: '供应商',
      dataIndex: 'supplierName',
      search: false,
      ellipsis: true,
    },
    {
      title: '公司',
      dataIndex: 'company',
      hideInTable: true,
      initialValue: defaultCompany,
      formItemRender: (_, { onChange, value }, form) => (
        <RemoteLinkSelect
          doctype="Company"
          onChange={(nextValue) => {
            const company = toOptionalText(nextValue);
            form.setFieldValue?.('company', company);
            onChange?.(company);
          }}
          placeholder="搜索公司"
          style={{ width: '100%' }}
          value={
            toOptionalText(value) ??
            toOptionalText(form.getFieldValue?.('company'))
          }
        />
      ),
    },
    {
      title: '订单日期',
      dataIndex: 'dateRange',
      valueType: 'dateRange',
      hideInTable: true,
    },
    {
      title: '订单日期',
      dataIndex: 'transactionDate',
      search: false,
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'statusFilter',
      valueType: 'select',
      hideInTable: true,
      initialValue: 'unfinished',
      valueEnum: {
        all: { text: '全部' },
        unfinished: { text: '未完成' },
        receiving: { text: '待收货' },
        paying: { text: '待付款' },
        completed: { text: '已完成' },
        cancelled: { text: '已作废' },
      },
    },
    {
      title: '单据',
      dataIndex: 'documentStatus',
      search: false,
      width: 100,
      render: (_, record) => <StatusTag value={record.documentStatus} />,
    },
    {
      title: '收货',
      dataIndex: 'receivingStatus',
      search: false,
      width: 100,
      render: (_, record) => <StatusTag value={record.receivingStatus} />,
    },
    {
      title: '付款',
      dataIndex: 'paymentStatus',
      search: false,
      width: 100,
      render: (_, record) => <StatusTag value={record.paymentStatus} />,
    },
    {
      title: '订单金额',
      dataIndex: 'amount',
      align: 'right',
      search: false,
      width: 130,
      render: (_, record) => formatCurrencyValue(record.amount),
    },
    {
      title: '未付金额',
      dataIndex: 'outstandingAmount',
      align: 'right',
      search: false,
      width: 130,
      render: (_, record) => formatCurrencyValue(record.outstandingAmount),
    },
    {
      title: '排序',
      dataIndex: 'sortBy',
      valueType: 'select',
      hideInTable: true,
      initialValue: 'unfinished_first',
      valueEnum: {
        unfinished_first: { text: '未完成优先' },
        latest: { text: '最近更新' },
        order_date_desc: { text: '最新订单' },
        oldest: { text: '最早订单' },
        amount_desc: { text: '金额从高到低' },
        amount_asc: { text: '金额从低到高' },
      },
    },
    {
      title: '最近更新',
      dataIndex: 'modified',
      search: false,
      width: 170,
      render: (_, record) =>
        record.modified
          ? dayjs(record.modified).format('YYYY-MM-DD HH:mm')
          : '-',
    },
  ];
}

const PurchaseOrdersPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [summary, setSummary] = useState<PurchaseOrderSearchSummary>();
  const { defaultCompany } = useWorkspacePreferences();
  const columns = buildColumns(defaultCompany);

  return (
    <PageContainer
      title="采购订单"
      extra={[
        <Button
          key="new"
          onClick={() => history.push('/purchase/orders/new')}
          type="primary"
        >
          新建采购订单
        </Button>,
        <Button key="refresh" onClick={() => actionRef.current?.reload()}>
          刷新
        </Button>,
      ]}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <ProCard split="vertical">
          <ProCard>
            <Statistic title="未完成" value={summary?.unfinishedCount ?? 0} />
          </ProCard>
          <ProCard>
            <Statistic title="待收货" value={summary?.receivingCount ?? 0} />
          </ProCard>
          <ProCard>
            <Statistic title="待付款" value={summary?.paymentCount ?? 0} />
          </ProCard>
          <ProCard>
            <Statistic title="已完成" value={summary?.completedCount ?? 0} />
          </ProCard>
        </ProCard>

        <ProTable<PurchaseOrderSummary>
          actionRef={actionRef}
          columns={columns}
          key={defaultCompany}
          pagination={{
            defaultPageSize: PAGE_SIZE,
            showSizeChanger: false,
          }}
          request={async (params) => {
            const current = Number(params.current ?? 1);
            const pageSize = Number(params.pageSize ?? PAGE_SIZE);
            const dateRange = Array.isArray(params.dateRange)
              ? params.dateRange
              : [];
            const statusFilter = params.statusFilter as any;
            const result = await searchPurchaseOrders({
              company: toOptionalText(params.company),
              dateFrom: dateRange[0] ? String(dateRange[0]) : undefined,
              dateTo: dateRange[1] ? String(dateRange[1]) : undefined,
              excludeCancelled: statusFilter !== 'cancelled',
              limit: pageSize,
              searchKey: String(params.searchKey ?? ''),
              sortBy: params.sortBy as any,
              start: (current - 1) * pageSize,
              statusFilter,
            });

            setSummary(result.summary);

            return {
              data: result.items,
              success: true,
              total: result.summary.visibleCount,
            };
          }}
          rowKey="name"
          search={{
            defaultCollapsed: false,
            labelWidth: 88,
          }}
          toolBarRender={false}
        />
      </Space>
    </PageContainer>
  );
};

export default PurchaseOrdersPage;
