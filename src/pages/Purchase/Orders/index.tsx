import type {
  ActionType,
  ProColumns,
  ProFormInstance,
} from '@ant-design/pro-components';
import {
  FooterToolbar,
  PageContainer,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { history, Link } from '@umijs/max';
import {
  Badge,
  Button,
  Card,
  Empty,
  message,
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
  type PurchaseOrderSearchSummary,
  type PurchaseOrderStatusFilter,
  type PurchaseOrderSummary,
  searchPurchaseOrders,
} from '@/services/myapp/purchase';
import { downloadCsv } from '@/utils/csv-export';
import { formatCurrencyValue, StatusTag } from '@/utils/myapp-display';

const PAGE_SIZE = 20;
type StatusViewKey =
  | 'all'
  | 'unfinished'
  | 'receiving'
  | 'paying'
  | 'completed'
  | 'cancelled';
type PurchaseOrderListFilters = {
  company?: string;
  dateRange?: string[];
  searchKey?: string;
  sortBy?: string;
  statusFilter?: string;
  supplier?: string;
};

const STATUS_FILTER_LABELS: Record<string, string> = {
  all: '有效订单',
  cancelled: '已作废',
  completed: '已完成',
  paying: '待付款',
  receiving: '待收货',
  unfinished: '未完成',
};

const DEFAULT_LIST_FILTERS: PurchaseOrderListFilters = {
  sortBy: 'latest',
  statusFilter: 'all',
};

function normalizeListFilters(
  filtersSource: unknown,
): PurchaseOrderListFilters {
  const filters = filtersSource as PurchaseOrderListFilters;
  const dateRange = Array.isArray(filters.dateRange) ? filters.dateRange : [];
  return {
    company: toOptionalText(filters.company),
    dateRange: dateRange.map((item) => String(item)),
    searchKey: toOptionalText(filters.searchKey),
    sortBy: String(filters.sortBy ?? DEFAULT_LIST_FILTERS.sortBy),
    statusFilter: String(
      filters.statusFilter ?? DEFAULT_LIST_FILTERS.statusFilter,
    ),
    supplier: toOptionalText(filters.supplier),
  };
}

function orderDetailPath(record: PurchaseOrderSummary) {
  return `/purchase/orders/${encodeURIComponent(record.name)}`;
}

function receivingStatusLabel(record: PurchaseOrderSummary) {
  if (record.documentStatus === 'cancelled') {
    return '已作废';
  }
  if (record.receivingStatus === 'pending') {
    return '待收货';
  }
  if (record.receivingStatus === 'partial') {
    return '部分收货';
  }
  if (record.receivingStatus === 'received') {
    return '已收货';
  }
  return undefined;
}

function paymentStatusLabel(record: PurchaseOrderSummary) {
  if (record.documentStatus === 'cancelled') {
    return '已作废';
  }
  if (record.paymentStatus === 'unpaid') {
    return '未结清';
  }
  if (record.paymentStatus === 'partial') {
    return '部分付款';
  }
  if (record.paymentStatus === 'paid') {
    return '已结清';
  }
  return undefined;
}

function resolveViewTitle(filters: PurchaseOrderListFilters) {
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

function buildPurchaseOrdersCsvRows(rows: PurchaseOrderSummary[]) {
  return [
    [
      '订单号',
      '供应商',
      '公司',
      '订单日期',
      '订单金额',
      '未付金额',
      '单据状态',
      '收货状态',
      '付款状态',
      '最近更新',
    ],
    ...rows.map((row) => [
      row.name,
      row.supplierName || row.supplier,
      row.company,
      row.transactionDate,
      row.amount ?? '',
      row.outstandingAmount ?? '',
      row.documentStatus,
      row.receivingStatus,
      row.paymentStatus,
      row.modified,
    ]),
  ];
}

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
        <Link to={orderDetailPath(record)}>{record.name}</Link>
      ),
    },
    {
      title: '供应商',
      dataIndex: 'supplier',
      ellipsis: true,
      render: (_, record) => record.supplierName || record.supplier,
      formItemRender: (_, { onChange, value }, form) => (
        <RemoteLinkSelect
          doctype="Supplier"
          onChange={(nextValue) => {
            const supplier = toOptionalText(nextValue);
            form.setFieldValue?.('supplier', supplier);
            onChange?.(supplier);
          }}
          placeholder="搜索供应商"
          style={{ width: '100%' }}
          value={
            toOptionalText(value) ??
            toOptionalText(form.getFieldValue?.('supplier'))
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
      title: '状态',
      dataIndex: 'statusFilter',
      valueType: 'select',
      hideInTable: true,
      initialValue: 'all',
      valueEnum: {
        all: { text: '有效订单' },
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
      render: (_, record) => (
        <StatusTag
          label={receivingStatusLabel(record)}
          value={record.receivingStatus}
        />
      ),
    },
    {
      title: '付款',
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
      width: 170,
      render: (_, record) =>
        record.modified
          ? dayjs(record.modified).format('YYYY-MM-DD HH:mm')
          : '-',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 100,
      render: (_, record) => <Link to={orderDetailPath(record)}>查看</Link>,
    },
  ];
}

const PurchaseOrdersPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const formRef = useRef<ProFormInstance | undefined>(undefined);
  const [messageApi, contextHolder] = message.useMessage();
  const [selectedRows, setSelectedRows] = useState<PurchaseOrderSummary[]>([]);
  const [exporting, setExporting] = useState(false);
  const [summary, setSummary] = useState<PurchaseOrderSearchSummary>();
  const { defaultCompany } = useWorkspacePreferences();
  const [activeFilters, setActiveFilters] = useState<PurchaseOrderListFilters>({
    company: defaultCompany,
    ...DEFAULT_LIST_FILTERS,
  });
  const columns = buildColumns(defaultCompany);
  const pendingCount =
    (summary?.receivingCount ?? 0) + (summary?.paymentCount ?? 0);
  const activeViewTitle = resolveViewTitle(activeFilters);
  const selectedAmount = selectedRows.reduce(
    (total, row) => total + Number(row.amount ?? 0),
    0,
  );
  const selectedOutstandingAmount = selectedRows.reduce(
    (total, row) => total + Number(row.outstandingAmount ?? 0),
    0,
  );
  const copySelectedOrderNames = async () => {
    if (!selectedRows.length) {
      return;
    }
    const text = selectedRows.map((row) => row.name).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      messageApi.success(`已复制 ${selectedRows.length} 个订单号`);
    } catch {
      messageApi.error('复制失败，请检查浏览器剪贴板权限');
    }
  };
  const exportSelectedOrders = () => {
    if (!selectedRows.length) {
      return;
    }
    downloadCsv(
      `purchase-orders-selected-${dayjs().format('YYYYMMDD-HHmmss')}.csv`,
      buildPurchaseOrdersCsvRows(selectedRows),
    );
    messageApi.success(`已导出 ${selectedRows.length} 条订单`);
  };
  const buildCurrentSearchParams = () => ({
    company: activeFilters.company,
    dateFrom: activeFilters.dateRange?.[0],
    dateTo: activeFilters.dateRange?.[1],
    excludeCancelled: activeFilters.statusFilter !== 'cancelled',
    searchKey: activeFilters.searchKey ?? '',
    sortBy: activeFilters.sortBy as any,
    statusFilter: activeFilters.statusFilter as PurchaseOrderStatusFilter,
    supplier: activeFilters.supplier,
  });
  const exportCurrentFilterOrders = async () => {
    setExporting(true);
    try {
      const result = await searchPurchaseOrders({
        ...buildCurrentSearchParams(),
        limit: 1000,
        start: 0,
      });
      downloadCsv(
        `purchase-orders-${dayjs().format('YYYYMMDD-HHmmss')}.csv`,
        buildPurchaseOrdersCsvRows(result.items),
      );
      messageApi.success(
        result.summary.visibleCount > result.items.length
          ? `已导出前 ${result.items.length} 条订单，结果已达到导出上限`
          : `已导出 ${result.items.length} 条订单`,
      );
    } catch (caught) {
      messageApi.error(caught instanceof Error ? caught.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };
  const applyTableFilters = (updates: PurchaseOrderListFilters) => {
    const nextValues = {
      ...(formRef.current?.getFieldsValue?.() ?? {}),
      ...updates,
    };
    formRef.current?.setFieldsValue(nextValues);
    setActiveFilters(normalizeListFilters(nextValues));
    void Promise.resolve().then(() => formRef.current?.submit?.());
  };
  const applyStatusFilter = (statusFilter: StatusViewKey) => {
    applyTableFilters({
      sortBy:
        statusFilter === 'all' ||
        statusFilter === 'completed' ||
        statusFilter === 'cancelled'
          ? 'latest'
          : 'unfinished_first',
      statusFilter,
    });
  };
  const showAllOrders = () => {
    applyTableFilters({
      company: undefined,
      dateRange: undefined,
      searchKey: undefined,
      sortBy: 'latest',
      statusFilter: 'all',
      supplier: undefined,
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
      key: 'receiving',
      label: statusTabLabel(
        'processing',
        '待收货',
        summary?.receivingCount ?? 0,
      ),
    },
    {
      key: 'paying',
      label: statusTabLabel('warning', '待付款', summary?.paymentCount ?? 0),
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
      {contextHolder}
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Card
          size="small"
          styles={{
            body: {
              paddingBlock: 12,
              paddingInline: 16,
            },
          }}
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
          </Space>
        </Card>

        <StatisticCard.Group direction="row">
          <StatisticCard
            statistic={{
              description: '收货、付款等仍需处理的订单',
              status: 'warning',
              title: '未完成',
              value: summary?.unfinishedCount ?? 0,
            }}
          />
          <StatisticCard
            statistic={{
              description: '需要继续推进采购收货',
              status: 'processing',
              title: '待收货',
              value: summary?.receivingCount ?? 0,
            }}
          />
          <StatisticCard
            statistic={{
              description: '已开票后仍待供应商付款',
              status: 'warning',
              title: '待付款',
              value: summary?.paymentCount ?? 0,
            }}
          />
          <StatisticCard
            statistic={{
              description: '收货与付款链路已完成',
              status: 'success',
              title: '已完成',
              value: summary?.completedCount ?? 0,
            }}
          />
          <StatisticCard
            statistic={{
              description: '已取消并退出有效采购链路',
              status: 'default',
              title: '已作废',
              value: summary?.cancelledCount ?? 0,
            }}
          />
        </StatisticCard.Group>

        <ProTable<PurchaseOrderSummary>
          actionRef={actionRef}
          columns={columns}
          formRef={formRef}
          key={defaultCompany}
          locale={{
            emptyText: (
              <Empty
                description={
                  <Space orientation="vertical" size={4}>
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
              supplier: toOptionalText(params.supplier),
            });

            const nextFilters = normalizeListFilters(params);
            setActiveFilters(nextFilters);
            setSummary(result.summary);
            setSelectedRows([]);

            return {
              data: result.items,
              success: true,
              total: result.summary.visibleCount,
            };
          }}
          rowKey="name"
          rowSelection={{
            onChange: (_, rows) => {
              setSelectedRows(rows);
            },
            selectedRowKeys: selectedRows.map((row) => row.name),
          }}
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
          toolBarRender={() => [
            <Button
              key="export-current"
              loading={exporting}
              onClick={() => {
                void exportCurrentFilterOrders();
              }}
            >
              导出当前筛选
            </Button>,
          ]}
        />
        {selectedRows.length > 0 ? (
          <FooterToolbar
            extra={
              <Space size={16} wrap>
                <span>
                  已选 <strong>{selectedRows.length}</strong> 项
                </span>
                <span>订单金额 {formatCurrencyValue(selectedAmount)}</span>
                <span>
                  未付金额 {formatCurrencyValue(selectedOutstandingAmount)}
                </span>
              </Space>
            }
          >
            <Button onClick={copySelectedOrderNames}>复制订单号</Button>
            <Button onClick={exportSelectedOrders} type="primary">
              导出选中 CSV
            </Button>
          </FooterToolbar>
        ) : null}
      </Space>
    </PageContainer>
  );
};

export default PurchaseOrdersPage;
