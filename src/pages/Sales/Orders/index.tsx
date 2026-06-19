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
import {
  Badge,
  Button,
  Card,
  Dropdown,
  Empty,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd';
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
type StatusViewKey =
  | 'all'
  | 'unfinished'
  | 'delivering'
  | 'paying'
  | 'completed'
  | 'cancelled';
type SalesOrderListFilters = {
  company?: string;
  customer?: string;
  dateRange?: string[];
  riskFilter?: string;
  searchKey?: string;
  sortBy?: string;
  statusFilter?: string;
};

const STATUS_FILTER_LABELS: Record<string, string> = {
  all: '有效订单',
  cancelled: '已作废',
  completed: '已完成',
  delivering: '待发货',
  paying: '待收款',
  unfinished: '未完成',
};

const DEFAULT_LIST_FILTERS: SalesOrderListFilters = {
  riskFilter: 'all',
  sortBy: 'latest',
  statusFilter: 'all',
};

function normalizeListFilters(filtersSource: unknown): SalesOrderListFilters {
  const filters = filtersSource as SalesOrderListFilters;
  const dateRange = Array.isArray(filters.dateRange) ? filters.dateRange : [];
  return {
    company: toOptionalText(filters.company),
    customer: toOptionalText(filters.customer),
    dateRange: dateRange.map((item) => String(item)),
    riskFilter: String(filters.riskFilter ?? DEFAULT_LIST_FILTERS.riskFilter),
    searchKey: toOptionalText(filters.searchKey),
    sortBy: String(filters.sortBy ?? DEFAULT_LIST_FILTERS.sortBy),
    statusFilter: String(
      filters.statusFilter ?? DEFAULT_LIST_FILTERS.statusFilter,
    ),
  };
}

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
    record.canRecordPayment
      ? { key: 'payment' as const, label: '去收款' }
      : null,
  ].filter((item): item is { key: OrderActionKey; label: string } =>
    Boolean(item),
  );
}

function resolveViewTitle(filters: SalesOrderListFilters) {
  if (filters.riskFilter === 'delivery_overdue') {
    return '逾期待发货';
  }
  return STATUS_FILTER_LABELS[filters.statusFilter ?? 'all'] ?? '有效订单';
}

function statusTabLabel(
  status: React.ComponentProps<typeof Badge>['status'],
  label: string,
  count?: number,
) {
  return (
    <Space size={6}>
      <Badge status={status} />
      <span>{label}</span>
      {typeof count === 'number' ? (
        <Typography.Text type="secondary">{count}</Typography.Text>
      ) : null}
    </Space>
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
      render: (_, record) =>
        record.isDeliveryOverdue ? (
          <Tag color="error">逾期 {record.deliveryOverdueDays} 天</Tag>
        ) : (
          '-'
        ),
    },
    {
      title: '状态',
      dataIndex: 'statusFilter',
      valueType: 'select',
      hideInTable: true,
      initialValue: 'all',
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
      initialValue: 'latest',
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
          {
            key: 'view',
            label: <Link to={orderDetailPath(record)}>查看</Link>,
          },
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
  const [activeFilters, setActiveFilters] = useState<SalesOrderListFilters>({
    company: defaultCompany,
    ...DEFAULT_LIST_FILTERS,
  });
  const columns = buildColumns(defaultCompany);
  const pendingCount =
    (summary?.deliveryCount ?? 0) + (summary?.paymentCount ?? 0);
  const activeViewTitle = resolveViewTitle(activeFilters);
  const applyTableFilters = (updates: SalesOrderListFilters) => {
    const nextValues = {
      ...(formRef.current?.getFieldsValue?.() ?? {}),
      ...updates,
    };
    formRef.current?.setFieldsValue(nextValues);
    setActiveFilters(normalizeListFilters(nextValues));
    void Promise.resolve().then(() => formRef.current?.submit?.());
  };
  const applyStatusFilter = (
    statusFilter: StatusViewKey,
    riskFilter = 'all',
  ) => {
    applyTableFilters({
      riskFilter,
      sortBy:
        statusFilter === 'all' ||
        statusFilter === 'completed' ||
        statusFilter === 'cancelled'
          ? 'latest'
          : 'unfinished_first',
      statusFilter,
    });
  };
  const showDeliveryOverdueOrders = () => {
    applyStatusFilter('delivering', 'delivery_overdue');
  };
  const showAllOrders = () => {
    applyTableFilters({
      company: undefined,
      customer: undefined,
      dateRange: undefined,
      searchKey: undefined,
      riskFilter: 'all',
      sortBy: 'latest',
      statusFilter: 'all',
    });
  };
  const statusViewValue = (activeFilters.statusFilter ??
    'all') as StatusViewKey;
  const statusTabItems = [
    {
      key: 'all',
      label: statusTabLabel('default', '全部有效订单'),
    },
    {
      key: 'unfinished',
      label: statusTabLabel('warning', '未完成', summary?.unfinishedCount ?? 0),
    },
    {
      key: 'delivering',
      label: statusTabLabel(
        'processing',
        '待发货',
        summary?.deliveryCount ?? 0,
      ),
    },
    {
      key: 'paying',
      label: statusTabLabel('warning', '待收款', summary?.paymentCount ?? 0),
    },
    {
      key: 'completed',
      label: statusTabLabel('success', '已完成', summary?.completedCount ?? 0),
    },
    {
      key: 'cancelled',
      label: statusTabLabel('default', '已作废', summary?.cancelledCount ?? 0),
    },
  ];

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
        <Card
          styles={{
            body: {
              paddingBlock: 12,
              paddingInline: 16,
            },
          }}
          size="small"
          variant="borderless"
        >
          <Space
            align="center"
            size={16}
            style={{ display: 'flex', width: '100%' }}
            wrap
          >
            <Typography.Text strong style={{ flex: '0 0 auto' }}>
              状态视图
            </Typography.Text>
            <Tabs
              activeKey={statusViewValue}
              items={statusTabItems}
              onChange={(value) => applyStatusFilter(value as StatusViewKey)}
              size="large"
              style={{ flex: '1 1 auto', minWidth: 0 }}
              tabBarStyle={{ margin: 0 }}
            />
            <Button
              danger={activeFilters.riskFilter === 'delivery_overdue'}
              onClick={showDeliveryOverdueOrders}
              style={{ flex: '0 0 auto' }}
              type={
                activeFilters.riskFilter === 'delivery_overdue'
                  ? 'primary'
                  : 'default'
              }
            >
              逾期待发货 {summary?.deliveryOverdueCount ?? 0}
            </Button>
          </Space>
        </Card>

        <StatisticCard.Group direction="row">
          <StatisticCard
            statistic={{
              description: '发货、收款等仍需处理的订单',
              status: 'warning',
              title: '未完成',
              value: summary?.unfinishedCount ?? 0,
            }}
          />
          <StatisticCard
            statistic={{
              description: '需要继续推进出库履约',
              status: 'processing',
              title: '待发货',
              value: summary?.deliveryCount ?? 0,
            }}
          />
          <StatisticCard
            statistic={{
              description: '已履约或开票后仍待回款',
              status: 'warning',
              title: '待收款',
              value: summary?.paymentCount ?? 0,
            }}
          />
          <StatisticCard
            statistic={{
              description: '未完全发货且已超过交货日期',
              status: 'error',
              title: '逾期待发货',
              value: summary?.deliveryOverdueCount ?? 0,
            }}
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
            const nextFilters = normalizeListFilters(params);
            const result = await searchSalesOrders({
              company: nextFilters.company,
              customer: nextFilters.customer,
              dateFrom: dateRange[0] ? String(dateRange[0]) : undefined,
              dateTo: dateRange[1] ? String(dateRange[1]) : undefined,
              excludeCancelled: nextFilters.statusFilter !== 'cancelled',
              limit: pageSize,
              riskFilter: nextFilters.riskFilter as any,
              searchKey: nextFilters.searchKey ?? '',
              sortBy: nextFilters.sortBy as any,
              start: (current - 1) * pageSize,
              statusFilter: nextFilters.statusFilter as any,
            });

            setActiveFilters(nextFilters);
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
          headerTitle={
            <Space size={8} wrap>
              <span>订单明细</span>
              <Tag color="blue">{activeViewTitle}</Tag>
              <Typography.Text type="secondary">
                共 {summary?.visibleCount ?? 0} 条
              </Typography.Text>
              <Typography.Text type="secondary">
                待推进 {pendingCount}
              </Typography.Text>
            </Space>
          }
        />
      </Space>
    </PageContainer>
  );
};

export default SalesOrdersPage;
