import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import { Link } from '@umijs/max';
import { Button, Space, Statistic } from 'antd';
import dayjs from 'dayjs';
import React, { useRef, useState } from 'react';
import {
  type SalesOrderSearchSummary,
  type SalesOrderSummary,
  searchSalesOrders,
} from '@/services/myapp/sales';
import { formatCurrencyValue, StatusTag } from '@/utils/myapp-display';

const DEFAULT_COMPANY = 'rgc (Demo)';
const PAGE_SIZE = 20;

const columns: ProColumns<SalesOrderSummary>[] = [
  {
    title: '关键词',
    dataIndex: 'searchKey',
    hideInTable: true,
    fieldProps: {
      allowClear: true,
      placeholder: '订单号 / 客户 / 公司',
    },
  },
  {
    title: '订单号',
    dataIndex: 'name',
    search: false,
    width: 180,
    render: (_, record) => (
      <Link to={`/sales/orders/${encodeURIComponent(record.name)}`}>
        {record.name}
      </Link>
    ),
  },
  {
    title: '客户',
    dataIndex: 'customer',
    search: false,
    ellipsis: true,
  },
  {
    title: '公司',
    dataIndex: 'company',
    hideInTable: true,
    initialValue: DEFAULT_COMPANY,
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
      delivering: { text: '待发货' },
      paying: { text: '待收款' },
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
    title: '履约',
    dataIndex: 'fulfillmentStatus',
    search: false,
    width: 100,
    render: (_, record) => <StatusTag value={record.fulfillmentStatus} />,
  },
  {
    title: '收款',
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
    title: '未收金额',
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
      record.modified ? dayjs(record.modified).format('YYYY-MM-DD HH:mm') : '-',
  },
];

const SalesOrdersPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [summary, setSummary] = useState<SalesOrderSearchSummary>();

  return (
    <PageContainer
      title="销售订单"
      extra={[
        <Link key="new" to="/sales/orders/new">
          <Button type="primary">新建订单</Button>
        </Link>,
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
            <Statistic title="待发货" value={summary?.deliveryCount ?? 0} />
          </ProCard>
          <ProCard>
            <Statistic title="待收款" value={summary?.paymentCount ?? 0} />
          </ProCard>
          <ProCard>
            <Statistic title="已完成" value={summary?.completedCount ?? 0} />
          </ProCard>
        </ProCard>

        <ProTable<SalesOrderSummary>
          actionRef={actionRef}
          columns={columns}
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
            const result = await searchSalesOrders({
              company: String(params.company ?? DEFAULT_COMPANY),
              dateFrom: dateRange[0] ? String(dateRange[0]) : undefined,
              dateTo: dateRange[1] ? String(dateRange[1]) : undefined,
              limit: pageSize,
              searchKey: String(params.searchKey ?? ''),
              sortBy: params.sortBy as any,
              start: (current - 1) * pageSize,
              statusFilter: params.statusFilter as any,
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

export default SalesOrdersPage;
