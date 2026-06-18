import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Area, Column, Pie } from '@ant-design/plots';
import { PageContainer, StatisticCard } from '@ant-design/pro-components';
import { Link, useRequest } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Progress,
  Row,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { RangePickerProps } from 'antd/es/date-picker';
import type { ColumnsType } from 'antd/es/table';
import { createStyles } from 'antd-style';
import dayjs, { type Dayjs } from 'dayjs';
import React, { useMemo, useState } from 'react';
import {
  FALLBACK_COMPANY,
  useWorkspacePreferences,
} from '@/hooks/useWorkspacePreferences';
import { listInventoryStockSummary } from '@/services/myapp/inventory';
import {
  type BusinessReport,
  fetchBusinessReportOverview,
  fetchCashflowReport,
  fetchPurchaseReport,
  fetchReceivablePayableReport,
  fetchSalesReport,
  type PartySummaryRow,
  type ProductSummaryRow,
  type TrendRow,
} from '@/services/myapp/reports';
import { formatCurrencyValue } from '@/utils/myapp-display';

const { RangePicker } = DatePicker;
const DEFAULT_LIMIT = 8;

const useStyles = createStyles(({ token }) => ({
  salesCard: {
    '.ant-tabs-nav': {
      marginBottom: 24,
      paddingLeft: 16,
      paddingRight: 24,
    },
    '.ant-tabs-nav-wrap .ant-tabs-tab': {
      lineHeight: '24px',
      paddingBottom: 14,
      paddingTop: 16,
    },
    '.ant-tabs-extra-content': {
      lineHeight: '55px',
    },
    [`@media screen and (max-width: ${token.screenMD}px)`]: {
      '.ant-tabs-nav': {
        paddingLeft: 16,
        paddingRight: 16,
      },
    },
  },
  salesExtraWrap: {
    alignItems: 'center',
    display: 'flex',
    gap: 24,
    justifyContent: 'flex-end',
    [`@media screen and (max-width: ${token.screenLG}px)`]: {
      gap: 12,
    },
    [`@media screen and (max-width: ${token.screenMD}px)`]: {
      alignItems: 'flex-start',
      flexDirection: 'column',
      lineHeight: 'normal',
      paddingBottom: 12,
    },
  },
  salesQuickRanges: {
    display: 'flex',
    gap: 8,
    whiteSpace: 'nowrap',
    [`@media screen and (max-width: ${token.screenLG}px)`]: {
      display: 'none',
    },
  },
}));

type TimeType = 'today' | 'week' | 'month' | 'year';
type RangePickerValue = RangePickerProps['value'];

type ChartDatum = {
  fullName?: string;
  x: string;
  y: number;
};

type RankingRow = {
  amount: number;
  count?: number;
  key: string;
  name: string;
};

type FocusRow = {
  amount: number;
  key: string;
  name: string;
  status: '应收' | '应付';
  type: string;
};

function getTimeDistance(type: TimeType): [Dayjs, Dayjs] {
  const now = dayjs();
  switch (type) {
    case 'today':
      return [now.startOf('day'), now.endOf('day')];
    case 'week':
      return [now.startOf('week'), now.endOf('week')];
    case 'month':
      return [now.startOf('month'), now.endOf('month')];
    default:
      return [now.startOf('year'), now.endOf('year')];
  }
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function formatCompactNumber(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  const absAmount = Math.abs(amount);

  if (absAmount >= 100000000) {
    return `${formatNumber(amount / 100000000)}亿`;
  }

  if (absAmount >= 10000) {
    return `${formatNumber(amount / 10000)}万`;
  }

  return formatNumber(amount);
}

function formatCompactCurrency(value: number | null | undefined) {
  return `${formatCompactNumber(value)}元`;
}

function percent(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function getRangeUnit(dateFrom?: string, dateTo?: string): 'day' | 'month' {
  const start = dateFrom ? dayjs(dateFrom) : dayjs().startOf('year');
  const end = dateTo ? dayjs(dateTo) : dayjs().endOf('year');
  return end.diff(start, 'day') > 62 ? 'month' : 'day';
}

function toDashboardTrendData(
  rows: TrendRow[],
  dateFrom?: string,
  dateTo?: string,
): ChartDatum[] {
  const unit = getRangeUnit(dateFrom, dateTo);
  const start = (dateFrom ? dayjs(dateFrom) : dayjs().startOf('year')).startOf(
    unit,
  );
  const end = (dateTo ? dayjs(dateTo) : dayjs().endOf('year')).startOf(unit);
  const format = unit === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD';
  const labelFormat = unit === 'month' ? 'M月' : 'MM-DD';
  const amountMap = new Map<string, number>();

  rows.forEach((row) => {
    const key = dayjs(row.trendDate).startOf(unit).format(format);
    amountMap.set(key, (amountMap.get(key) ?? 0) + row.amount);
  });

  const chartRows: ChartDatum[] = [];
  let cursor = start;
  while (cursor.isBefore(end) || cursor.isSame(end)) {
    const key = cursor.format(format);
    chartRows.push({
      fullName: key,
      x: cursor.format(labelFormat),
      y: amountMap.get(key) ?? 0,
    });
    cursor = cursor.add(1, unit);
  }

  return chartRows;
}

function toMiniTrendData(rows: ChartDatum[]) {
  return rows.filter((row) => row.y > 0).length ? rows : rows.slice(-6);
}

function toRankingRows(rows: PartySummaryRow[]): RankingRow[] {
  return rows
    .map((row) => ({
      amount: row.totalAmount ?? row.amount ?? row.outstandingAmount ?? 0,
      count: row.count,
      key: row.name,
      name: row.name,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function buildFocusRows(
  receivableRows: PartySummaryRow[],
  payableRows: PartySummaryRow[],
): FocusRow[] {
  return [
    ...receivableRows.map((row) => ({
      amount: row.outstandingAmount ?? row.totalAmount ?? row.amount ?? 0,
      key: `receivable-${row.name}`,
      name: row.name,
      status: '应收' as const,
      type: '客户',
    })),
    ...payableRows.map((row) => ({
      amount: row.outstandingAmount ?? row.totalAmount ?? row.amount ?? 0,
      key: `payable-${row.name}`,
      name: row.name,
      status: '应付' as const,
      type: '供应商',
    })),
  ]
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
}

function buildProductPieData(rows: ProductSummaryRow[]) {
  const sortedRows = [...rows]
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const topRows = sortedRows.slice(0, 5).map((row) => ({
    fullName: row.itemName,
    x: row.itemName,
    y: row.amount,
  }));
  const otherTotal = sortedRows
    .slice(5)
    .reduce((sum, row) => sum + row.amount, 0);

  return otherTotal > 0
    ? [...topRows, { fullName: '其他商品', x: '其他', y: otherTotal }]
    : topRows;
}

function TrendText({
  children,
  flag,
}: {
  children: React.ReactNode;
  flag: 'up' | 'down';
}) {
  const color = flag === 'up' ? '#f5222d' : '#52c41a';
  return (
    <Space size={4}>
      <Typography.Text type="secondary">{children}</Typography.Text>
      {flag === 'up' ? (
        <ArrowUpOutlined style={{ color }} />
      ) : (
        <ArrowDownOutlined style={{ color }} />
      )}
    </Space>
  );
}

function RankingList({ rows, title }: { rows: RankingRow[]; title: string }) {
  if (!rows.length) {
    return (
      <Empty description="暂无排行数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
    );
  }

  return (
    <div style={{ padding: '0 24px 24px 48px' }}>
      <Typography.Title level={5}>{title}</Typography.Title>
      <ul style={{ listStyle: 'none', margin: '25px 0 0', padding: 0 }}>
        {rows.slice(0, 7).map((item, index) => (
          <li
            key={item.key}
            style={{
              alignItems: 'center',
              display: 'flex',
              marginTop: 16,
            }}
          >
            <span
              style={{
                background: index < 3 ? '#314659' : '#f0f2f5',
                borderRadius: 20,
                color: index < 3 ? '#fff' : '#8c8c8c',
                display: 'inline-block',
                fontSize: 12,
                fontWeight: 600,
                height: 20,
                lineHeight: '20px',
                marginRight: 16,
                textAlign: 'center',
                width: 20,
              }}
            >
              {index + 1}
            </span>
            <Typography.Text ellipsis style={{ flex: 1, marginRight: 8 }}>
              {item.name}
            </Typography.Text>
            <span>{formatCompactCurrency(item.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const focusColumns: ColumnsType<FocusRow> = [
  {
    title: '类型',
    dataIndex: 'type',
    width: 80,
  },
  {
    title: '对象',
    dataIndex: 'name',
    ellipsis: true,
  },
  {
    title: '状态',
    dataIndex: 'status',
    width: 90,
    render: (value) => (
      <Tag color={value === '应收' ? 'red' : 'orange'}>{String(value)}</Tag>
    ),
  },
  {
    title: '金额',
    dataIndex: 'amount',
    align: 'right',
    width: 140,
    render: (value) => formatCurrencyValue(Number(value ?? 0)),
  },
];

const Dashboard: React.FC = () => {
  const { styles } = useStyles();
  const { defaultCompany } = useWorkspacePreferences();
  const [activeTab, setActiveTab] = useState('sales');
  const [rangePickerValue, setRangePickerValue] = useState<RangePickerValue>(
    getTimeDistance('year'),
  );

  const dateFrom = rangePickerValue?.[0]?.format('YYYY-MM-DD');
  const dateTo = rangePickerValue?.[1]?.format('YYYY-MM-DD');
  const company =
    defaultCompany && defaultCompany !== FALLBACK_COMPANY
      ? defaultCompany
      : undefined;

  const { data, error, loading, refresh } = useRequest(
    async () => {
      const filter = {
        company,
        dateFrom,
        dateTo,
        limit: DEFAULT_LIMIT,
      };
      const [
        overviewReport,
        salesReport,
        purchaseReport,
        receivablePayableReport,
        cashflowReport,
      ] = await Promise.all([
        fetchBusinessReportOverview(filter),
        fetchSalesReport(filter),
        fetchPurchaseReport(filter),
        fetchReceivablePayableReport(filter),
        fetchCashflowReport(filter),
      ]);

      return {
        meta: overviewReport.meta,
        overview: overviewReport.overview,
        tables: {
          ...overviewReport.tables,
          salesSummary: salesReport.tables.salesSummary,
          salesTrend: salesReport.tables.salesTrend,
          salesTrendHourly: salesReport.tables.salesTrendHourly,
          salesProductSummary: salesReport.tables.salesProductSummary,
          purchaseSummary: purchaseReport.tables.purchaseSummary,
          purchaseTrend: purchaseReport.tables.purchaseTrend,
          purchaseTrendHourly: purchaseReport.tables.purchaseTrendHourly,
          purchaseProductSummary: purchaseReport.tables.purchaseProductSummary,
          receivableSummary: receivablePayableReport.tables.receivableSummary,
          payableSummary: receivablePayableReport.tables.payableSummary,
          cashflowTrend: cashflowReport.trend,
        },
      } satisfies BusinessReport;
    },
    {
      formatResult: (result) => result,
      refreshDeps: [company, dateFrom, dateTo],
    },
  );

  const {
    data: inventoryData,
    loading: inventoryLoading,
    refresh: refreshInventory,
  } = useRequest(
    () =>
      listInventoryStockSummary({
        company,
        lowStockThreshold: 10,
        page: 1,
        pageSize: 5,
        stockStatus: 'all',
      }),
    {
      formatResult: (result) => result,
      refreshDeps: [company],
    },
  );

  const report = data as BusinessReport | undefined;
  const overview = report?.overview;
  const tables = report?.tables;
  const stockSummary = inventoryData?.summary;
  const salesChartData = toDashboardTrendData(
    tables?.salesTrend ?? [],
    dateFrom,
    dateTo,
  );
  const purchaseChartData = toDashboardTrendData(
    tables?.purchaseTrend ?? [],
    dateFrom,
    dateTo,
  );
  const mainChartData =
    activeTab === 'sales' ? salesChartData : purchaseChartData;
  const mainRankingRows = useMemo(
    () =>
      activeTab === 'sales'
        ? toRankingRows(tables?.salesSummary ?? [])
        : toRankingRows(tables?.purchaseSummary ?? []),
    [activeTab, tables?.purchaseSummary, tables?.salesSummary],
  );
  const focusRows = useMemo(
    () =>
      buildFocusRows(
        tables?.receivableSummary ?? [],
        tables?.payableSummary ?? [],
      ),
    [tables?.payableSummary, tables?.receivableSummary],
  );
  const pieData = buildProductPieData(tables?.salesProductSummary ?? []);
  const salesOrderCount = (tables?.salesTrend ?? []).reduce(
    (sum, row) => sum + row.count,
    0,
  );
  const purchaseOrderCount = (tables?.purchaseTrend ?? []).reduce(
    (sum, row) => sum + row.count,
    0,
  );
  const cashflowData = toDashboardTrendData(
    tables?.cashflowTrend.map((row) => ({
      amount: Math.abs(row.inAmount - row.outAmount),
      count: row.count,
      trendDate: row.trendDate,
    })) ?? [],
    dateFrom,
    dateTo,
  );
  const collectionRate = percent(
    overview?.receivedAmountTotal ?? 0,
    (overview?.receivedAmountTotal ?? 0) +
      (overview?.receivableOutstandingTotal ?? 0),
  );

  const selectDate = (type: TimeType) => {
    setRangePickerValue(getTimeDistance(type));
  };
  const isActive = (type: TimeType) => {
    if (!rangePickerValue?.[0] || !rangePickerValue?.[1]) {
      return false;
    }
    const value = getTimeDistance(type);
    return (
      rangePickerValue[0].isSame(value[0], 'day') &&
      rangePickerValue[1].isSame(value[1], 'day')
    );
  };

  return (
    <PageContainer
      title="经营概览"
      extra={[
        <Button
          icon={<ReloadOutlined />}
          key="refresh"
          loading={loading || inventoryLoading}
          onClick={() => {
            refresh();
            refreshInventory();
          }}
        >
          刷新
        </Button>,
      ]}
    >
      <Space orientation="vertical" size={24} style={{ width: '100%' }}>
        {error && (
          <Alert
            action={
              <Button size="small" onClick={refresh}>
                重试
              </Button>
            }
            description={
              error instanceof Error ? error.message : '请稍后刷新重试。'
            }
            message="运营数据加载失败"
            showIcon
            type="error"
          />
        )}

        <Row gutter={24}>
          <Col
            lg={12}
            md={12}
            sm={12}
            style={{ marginBottom: 24 }}
            xl={6}
            xs={24}
          >
            <StatisticCard
              chart={
                <Area
                  axis={false}
                  data={toMiniTrendData(salesChartData)}
                  height={46}
                  padding={-20}
                  shapeField="smooth"
                  style={{
                    fill: 'linear-gradient(-90deg, white 0%, #975FE4 100%)',
                    fillOpacity: 0.6,
                  }}
                  xField="x"
                  yField="y"
                />
              }
              footer={
                <Space size={16}>
                  <TrendText flag="up">
                    订单 {formatNumber(salesOrderCount)}
                  </TrendText>
                  <Typography.Text type="secondary">
                    区间 {dateFrom} - {dateTo}
                  </Typography.Text>
                </Space>
              }
              loading={loading && !report}
              statistic={{
                prefix: '¥',
                title: (
                  <Space size={6}>
                    总销售额
                    <Tooltip title="已提交销售订单金额">
                      <InfoCircleOutlined />
                    </Tooltip>
                  </Space>
                ),
                value: formatNumber(overview?.salesAmountTotal),
              }}
              variant="borderless"
            />
          </Col>
          <Col
            lg={12}
            md={12}
            sm={12}
            style={{ marginBottom: 24 }}
            xl={6}
            xs={24}
          >
            <StatisticCard
              chart={
                <Area
                  axis={false}
                  data={toMiniTrendData(purchaseChartData)}
                  height={46}
                  padding={-20}
                  shapeField="smooth"
                  style={{
                    fill: 'linear-gradient(-90deg, white 0%, #13C2C2 100%)',
                    fillOpacity: 0.5,
                  }}
                  xField="x"
                  yField="y"
                />
              }
              footer={
                <Typography.Text type="secondary">
                  采购单数 {formatNumber(purchaseOrderCount)}
                </Typography.Text>
              }
              loading={loading && !report}
              statistic={{
                title: (
                  <Space size={6}>
                    采购金额
                    <Tooltip title="已提交采购订单金额">
                      <InfoCircleOutlined />
                    </Tooltip>
                  </Space>
                ),
                value: formatCompactCurrency(overview?.purchaseAmountTotal),
              }}
              variant="borderless"
            />
          </Col>
          <Col
            lg={12}
            md={12}
            sm={12}
            style={{ marginBottom: 24 }}
            xl={6}
            xs={24}
          >
            <StatisticCard
              chart={
                <Column
                  axis={false}
                  data={toMiniTrendData(cashflowData)}
                  height={46}
                  padding={-20}
                  scale={{ x: { paddingInner: 0.4 } }}
                  xField="x"
                  yField="y"
                />
              }
              footer={
                <Space size={12}>
                  <Typography.Text type="secondary">
                    收 {formatCurrencyValue(overview?.receivedAmountTotal)}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    付 {formatCurrencyValue(overview?.paidAmountTotal)}
                  </Typography.Text>
                </Space>
              }
              loading={loading && !report}
              statistic={{
                prefix:
                  (overview?.netCashflowTotal ?? 0) >= 0 ? (
                    <ArrowUpOutlined />
                  ) : (
                    <ArrowDownOutlined />
                  ),
                title: '净现金流',
                value: formatCompactCurrency(overview?.netCashflowTotal),
                styles: {
                  content: {
                    color:
                      (overview?.netCashflowTotal ?? 0) >= 0
                        ? '#1677ff'
                        : '#cf1322',
                  },
                },
              }}
              variant="borderless"
            />
          </Col>
          <Col
            lg={12}
            md={12}
            sm={12}
            style={{ marginBottom: 24 }}
            xl={6}
            xs={24}
          >
            <StatisticCard
              chart={
                <Progress
                  percent={collectionRate}
                  strokeColor={{ from: '#108ee9', to: '#87d068' }}
                />
              }
              footer={
                <Typography.Text type="secondary">
                  库存资产 {formatCurrencyValue(stockSummary?.stockValueTotal)}
                </Typography.Text>
              }
              loading={
                (loading && !report) || (inventoryLoading && !inventoryData)
              }
              statistic={{
                suffix: '%',
                title: '收款达成率',
                value: collectionRate,
              }}
              variant="borderless"
            />
          </Col>
        </Row>

        <Card
          loading={loading && !report}
          styles={{ body: { padding: loading && !report ? 24 : 0 } }}
          variant="borderless"
        >
          <Tabs
            activeKey={activeTab}
            className={styles.salesCard}
            items={[
              {
                key: 'sales',
                label: '销售额',
                children: (
                  <Row>
                    <Col lg={12} md={12} sm={24} xl={16} xs={24}>
                      <div style={{ padding: '0 0 32px 32px' }}>
                        <Column
                          axis={{
                            x: { title: false },
                            y: {
                              gridLineDash: null,
                              gridStroke: '#ccc',
                              labelFormatter: (value: number) =>
                                formatCompactNumber(value),
                              title: false,
                            },
                          }}
                          data={mainChartData}
                          height={300}
                          paddingBottom={12}
                          scale={{ x: { paddingInner: 0.4 } }}
                          tooltip={{
                            channel: 'y',
                            name: '销售额',
                            valueFormatter: (value: number) =>
                              formatCurrencyValue(value),
                          }}
                          xField="x"
                          yField="y"
                        />
                      </div>
                    </Col>
                    <Col lg={12} md={12} sm={24} xl={8} xs={24}>
                      <RankingList
                        rows={mainRankingRows}
                        title="客户销售额排名"
                      />
                    </Col>
                  </Row>
                ),
              },
              {
                key: 'purchase',
                label: '采购额',
                children: (
                  <Row>
                    <Col lg={12} md={12} sm={24} xl={16} xs={24}>
                      <div style={{ padding: '0 0 32px 32px' }}>
                        <Column
                          axis={{
                            x: { title: false },
                            y: {
                              labelFormatter: (value: number) =>
                                formatCompactNumber(value),
                              title: false,
                            },
                          }}
                          data={mainChartData}
                          height={300}
                          paddingBottom={12}
                          scale={{ x: { paddingInner: 0.4 } }}
                          tooltip={{
                            channel: 'y',
                            name: '采购额',
                            valueFormatter: (value: number) =>
                              formatCurrencyValue(value),
                          }}
                          xField="x"
                          yField="y"
                        />
                      </div>
                    </Col>
                    <Col lg={12} md={12} sm={24} xl={8} xs={24}>
                      <RankingList
                        rows={mainRankingRows}
                        title="供应商采购额排名"
                      />
                    </Col>
                  </Row>
                ),
              },
            ]}
            onChange={setActiveTab}
            size="large"
            tabBarExtraContent={
              <div className={styles.salesExtraWrap}>
                <div className={styles.salesQuickRanges}>
                  {(['today', 'week', 'month', 'year'] as TimeType[]).map(
                    (type) => (
                      <Button
                        key={type}
                        onClick={() => selectDate(type)}
                        type={isActive(type) ? 'link' : 'text'}
                      >
                        {
                          {
                            today: '今日',
                            week: '本周',
                            month: '本月',
                            year: '本年',
                          }[type]
                        }
                      </Button>
                    ),
                  )}
                </div>
                <RangePicker
                  onChange={setRangePickerValue}
                  style={{ width: 256 }}
                  value={rangePickerValue}
                  variant="filled"
                />
              </div>
            }
          />
        </Card>

        <Row gutter={24}>
          <Col
            lg={24}
            md={24}
            sm={24}
            style={{ marginBottom: 24 }}
            xl={12}
            xs={24}
          >
            <Card
              extra={<Link to="/finance">查看全部</Link>}
              loading={loading && !report}
              style={{ height: '100%' }}
              title="经营关注事项"
              variant="borderless"
            >
              <Row gutter={68}>
                <Col sm={12} style={{ marginBottom: 24 }} xs={24}>
                  <Typography.Text type="secondary">应收未结</Typography.Text>
                  <Typography.Title level={4} style={{ margin: '8px 0 0' }}>
                    {formatCurrencyValue(overview?.receivableOutstandingTotal)}
                  </Typography.Title>
                  <Area
                    axis={false}
                    data={toMiniTrendData(salesChartData)}
                    height={45}
                    padding={-12}
                    shapeField="smooth"
                    style={{
                      fill: 'linear-gradient(-90deg, white 0%, #6294FA 100%)',
                      fillOpacity: 0.4,
                    }}
                    xField="x"
                    yField="y"
                  />
                </Col>
                <Col sm={12} style={{ marginBottom: 24 }} xs={24}>
                  <Typography.Text type="secondary">库存预警</Typography.Text>
                  <Typography.Title level={4} style={{ margin: '8px 0 0' }}>
                    {(stockSummary?.negativeCount ?? 0) +
                      (stockSummary?.outOfStockCount ?? 0)}
                  </Typography.Title>
                  <Area
                    axis={false}
                    data={toMiniTrendData(purchaseChartData)}
                    height={45}
                    padding={-12}
                    shapeField="smooth"
                    style={{
                      fill: 'linear-gradient(-90deg, white 0%, #6294FA 100%)',
                      fillOpacity: 0.4,
                    }}
                    xField="x"
                    yField="y"
                  />
                </Col>
              </Row>
              <Table<FocusRow>
                columns={focusColumns}
                dataSource={focusRows}
                locale={{ emptyText: '暂无关注事项' }}
                pagination={{ pageSize: 5, style: { marginBottom: 0 } }}
                rowKey="key"
                size="small"
              />
            </Card>
          </Col>
          <Col
            lg={24}
            md={24}
            sm={24}
            style={{ marginBottom: 24 }}
            xl={12}
            xs={24}
          >
            <Card
              loading={loading && !report}
              style={{ height: '100%' }}
              title="销售额类别占比"
              variant="borderless"
            >
              {pieData.length ? (
                <>
                  <Typography.Text>销售额</Typography.Text>
                  <Pie
                    height={340}
                    radius={0.8}
                    innerRadius={0.5}
                    angleField="y"
                    colorField="x"
                    data={pieData}
                    legend={false}
                    label={{
                      position: 'spider',
                      text: (item: ChartDatum) =>
                        `${item.x}: ${formatCompactNumber(item.y)}`,
                    }}
                    tooltip={{
                      valueFormatter: (value: number) =>
                        formatCurrencyValue(value),
                    }}
                  />
                </>
              ) : (
                <Empty description="暂无占比数据" />
              )}
            </Card>
          </Col>
        </Row>
      </Space>
    </PageContainer>
  );
};

export default Dashboard;
