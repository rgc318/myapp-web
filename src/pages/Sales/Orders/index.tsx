import type {
  ActionType,
  ProColumns,
  ProFormInstance,
} from '@ant-design/pro-components';
import {
  PageContainer,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { Link } from '@umijs/max';
import { Button, Dropdown, Empty, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import React, { useRef, useState } from 'react';
import { RemoteLinkSelect } from '@/components';
import { useWorkspacePreferences } from '@/hooks/useWorkspacePreferences';
import { toOptionalText } from '@/services/myapp/api-utils';
import {
  type SalesOrderSearchSummary,
  type SalesOrderSummary,
  searchSalesOrders,
} from '@/services/myapp/sales';
import { formatCurrencyValue, StatusTag } from '@/utils/myapp-display';

const PAGE_SIZE = 20;
type OrderActionKey = 'delivery' | 'invoice' | 'payment';

function orderDetailPath(record: SalesOrderSummary, action?: OrderActionKey) {
  const basePath = `/sales/orders/${encodeURIComponent(record.name)}`;
  return action ? `${basePath}?action=${action}` : basePath;
}

function orderStatusLabel(record: SalesOrderSummary) {
  if (record.documentStatus === 'cancelled') {
    return '已作废';
  }
  if (record.completionStatus === 'completed') {
    return '已完成';
  }
  if (record.fulfillmentStatus === 'pending') {
    return '待发货';
  }
  if (record.fulfillmentStatus === 'partial') {
    return '部分发货';
  }
  if (record.fulfillmentStatus === 'shipped') {
    return '已发货';
  }
  return undefined;
}

function paymentStatusLabel(record: SalesOrderSummary) {
  if (record.documentStatus === 'cancelled') {
    return '已作废';
  }
  if (record.paymentStatus === 'unpaid') {
    return '未结清';
  }
  if (record.paymentStatus === 'partial') {
    return '部分收款';
  }
  if (record.paymentStatus === 'paid') {
    return '已结清';
  }
  return undefined;
}

function orderActionCandidates(record: SalesOrderSummary) {
  return [
    record.canSubmitDelivery
      ? { key: 'delivery' as const, label: '去发货' }
      : null,
    record.canCreateSalesInvoice
      ? { key: 'invoice' as const, label: '去开票' }
      : null,
    record.canRecordPayment ? { key: 'payment' as const, label: '去收款' } : null,
  ].filter(
    (item): item is { key: OrderActionKey; label: string } => Boolean(item),
  );
}

function buildColumns(defaultCompany: string): ProColumns<SalesOrderSummary>[] {
  return [
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
      ellipsis: true,
      formItemRender: (_, { onChange, value }, form) => (
        <RemoteLinkSelect
          doctype="Customer"
          onChange={(nextValue) => {
            const customer = toOptionalText(nextValue);
            form.setFieldValue?.('customer', customer);
            onChange?.(customer);
          }}
          placeholder="搜索客户"
          style={{ width: '100%' }}
          value={
            toOptionalText(value) ??
            toOptionalText(form.getFieldValue?.('customer'))
          }
        />
      ),
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
      colSize: 2,
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
      title: '交货日期',
      dataIndex: 'deliveryDate',
      search: false,
      width: 120,
      render: (_, record) => record.deliveryDate || '-',
    },
    {
      title: '异常',
      dataIndex: 'riskStatus',
      search: false,
      width: 110,
      render: (_, record) => (
        record.isDeliveryOverdue ? (
          <Tag color="error">逾期 {record.deliveryOverdueDays} 天</Tag>
        ) : (
          '-'
        )
      ),
    },
    {
      title: '状态',
      dataIndex: 'statusFilter',
      valueType: 'select',
      hideInTable: true,
      initialValue: 'unfinished',
      valueEnum: {
        all: { text: '有效订单' },
        unfinished: { text: '未完成' },
        delivering: { text: '待发货' },
        paying: { text: '待收款' },
        completed: { text: '已完成' },
        cancelled: { text: '已作废' },
      },
    },
    {
      title: '异常',
      dataIndex: 'riskFilter',
      valueType: 'select',
      hideInTable: true,
      initialValue: 'all',
      valueEnum: {
        all: { text: '不限' },
        delivery_overdue: { text: '逾期待发货' },
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
      render: (_, record) => (
        <StatusTag
          label={orderStatusLabel(record)}
          value={record.fulfillmentStatus}
        />
      ),
    },
    {
      title: '收款',
      dataIndex: 'paymentStatus',
      search: false,
      width: 100,
      render: (_, record) => (
        <StatusTag
          label={paymentStatusLabel(record)}
          value={record.paymentStatus}
        />
      ),
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
        order_date_desc: { text: '最新订单' },
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
      width: 160,
      render: (_, record) =>
        record.modified
          ? dayjs(record.modified).format('YYYY-MM-DD HH:mm')
          : '-',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 120,
      render: (_, record) => {
        const actionItems = orderActionCandidates(record);
        const primaryAction = actionItems[0];
        const secondaryItems = [
          { key: 'view', label: <Link to={orderDetailPath(record)}>查看</Link> },
          ...actionItems.slice(1).map((item) => ({
            key: item.key,
            label: (
              <Link to={orderDetailPath(record, item.key)}>{item.label}</Link>
            ),
          })),
        ];

        if (!primaryAction) {
          return <Link to={orderDetailPath(record)}>查看</Link>;
        }

        return (
          <Space size={8}>
            <Link to={orderDetailPath(record, primaryAction.key)}>
              {primaryAction.label}
            </Link>
            <Dropdown menu={{ items: secondaryItems }} trigger={['click']}>
              <Button size="small" type="link">
                更多
              </Button>
            </Dropdown>
          </Space>
        );
      },
    },
  ];
}

const SalesOrdersPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const formRef = useRef<ProFormInstance | undefined>(undefined);
  const [summary, setSummary] = useState<SalesOrderSearchSummary>();
  const { defaultCompany } = useWorkspacePreferences();
  const columns = buildColumns(defaultCompany);
  const pendingCount =
    (summary?.deliveryCount ?? 0) + (summary?.paymentCount ?? 0);
  const applyStatusFilter = (
    statusFilter: 'all' | 'unfinished' | 'delivering' | 'paying',
    riskFilter = 'all',
  ) => {
    formRef.current?.setFieldsValue({
      riskFilter,
      sortBy: statusFilter === 'all' ? 'latest' : 'unfinished_first',
      statusFilter,
    });
    void actionRef.current?.reload(true);
  };
  const showAllOrders = () => {
    formRef.current?.setFieldsValue({
      company: undefined,
      customer: undefined,
      dateRange: undefined,
      searchKey: undefined,
      riskFilter: 'all',
      sortBy: 'latest',
      statusFilter: 'all',
    });
    void actionRef.current?.reload(true);
  };

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
        <StatisticCard.Group direction="row">
          <StatisticCard
            onClick={() => applyStatusFilter('unfinished')}
            statistic={{
              description: '发货、收款等仍需处理的订单',
              title: '待处理订单',
              value: summary?.unfinishedCount ?? 0,
            }}
            style={{ cursor: 'pointer' }}
          />
          <StatisticCard
            onClick={() => applyStatusFilter('delivering')}
            statistic={{
              description: '需要继续推进出库履约',
              title: '待发货',
              value: summary?.deliveryCount ?? 0,
            }}
            style={{ cursor: 'pointer' }}
          />
          <StatisticCard
            onClick={() => applyStatusFilter('paying')}
            statistic={{
              description: '已履约或开票后仍待回款',
              title: '待收款',
              value: summary?.paymentCount ?? 0,
            }}
            style={{ cursor: 'pointer' }}
          />
          <StatisticCard
            onClick={() => applyStatusFilter('delivering', 'delivery_overdue')}
            statistic={{
              description: `当前筛选中 ${summary?.visibleCount ?? 0}`,
              title: '逾期待发货',
              value: summary?.deliveryOverdueCount ?? 0,
            }}
            style={{ cursor: 'pointer' }}
          />
        </StatisticCard.Group>

        <ProTable<SalesOrderSummary>
          actionRef={actionRef}
          columns={columns}
          formRef={formRef}
          key={defaultCompany}
          locale={{
            emptyText: (
              <Empty
                description={
                  <Space direction="vertical" size={4}>
                    <Typography.Text>当前筛选条件下暂无订单</Typography.Text>
                    <Typography.Text type="secondary">
                      可以切换到全部状态并清空筛选
                    </Typography.Text>
                  </Space>
                }
              >
                <Button onClick={showAllOrders}>查看全部订单</Button>
              </Empty>
            ),
          }}
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
            const result = await searchSalesOrders({
              company: toOptionalText(params.company),
              customer: toOptionalText(params.customer),
              dateFrom: dateRange[0] ? String(dateRange[0]) : undefined,
              dateTo: dateRange[1] ? String(dateRange[1]) : undefined,
              excludeCancelled: statusFilter !== 'cancelled',
              limit: pageSize,
              riskFilter: params.riskFilter as any,
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
            collapseRender: false,
            defaultCollapsed: false,
            labelWidth: 88,
            span: {
              lg: 8,
              md: 12,
              sm: 12,
              xl: 6,
              xs: 24,
              xxl: 3,
            },
          }}
          toolbar={{
            title: (
              <Space size={8}>
                <span>订单明细</span>
                <Typography.Text type="secondary">
                  待推进 {pendingCount}
                </Typography.Text>
              </Space>
            ),
          }}
        />
      </Space>
    </PageContainer>
  );
};

export default SalesOrdersPage;
