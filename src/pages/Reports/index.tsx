import type { ProColumns } from '@ant-design/pro-components';
import {
  PageContainer,
  ProCard,
  ProForm,
  ProFormDateRangePicker,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { Alert, Button, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import PageState from '@/components/PageState';
import { RemoteLinkSelect } from '@/components/RemoteLinkSelect';
import { toOptionalText } from '@/services/myapp/api-utils';
import {
  type BusinessReport,
  type CashflowTrendRow,
  fetchBusinessReportOverview,
  type PartySummaryRow,
  type ProductSummaryRow,
  type TrendRow,
} from '@/services/myapp/reports';
import { formatCurrencyValue } from '@/utils/myapp-display';

const DEFAULT_LIMIT = 8;

type ReportFilters = {
  company?: string;
  dateRange?: string[];
};

function currentMonthRange() {
  return [
    dayjs().startOf('month').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD'),
  ];
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function formatMetric(value: number | null | undefined, visible: boolean) {
  return visible ? formatCurrencyValue(value ?? 0) : '无查看权限';
}

function normalizeFilters(values: ReportFilters) {
  const dateRange = Array.isArray(values.dateRange)
    ? values.dateRange
    : currentMonthRange();

  return {
    company: toOptionalText(values.company),
    dateFrom: dateRange[0],
    dateTo: dateRange[1],
    limit: DEFAULT_LIMIT,
  };
}

const partyColumns: ProColumns<PartySummaryRow>[] = [
  {
    title: '往来方',
    dataIndex: 'name',
    ellipsis: true,
  },
  {
    title: '单数',
    dataIndex: 'count',
    align: 'right',
    width: 80,
  },
  {
    title: '总金额',
    dataIndex: 'totalAmount',
    align: 'right',
    width: 120,
    render: (_, record) =>
      formatCurrencyValue(record.totalAmount ?? record.amount),
  },
  {
    title: '未结',
    dataIndex: 'outstandingAmount',
    align: 'right',
    width: 120,
    render: (_, record) => formatCurrencyValue(record.outstandingAmount),
  },
];

const productColumns: ProColumns<ProductSummaryRow>[] = [
  {
    title: '商品',
    dataIndex: 'itemName',
    ellipsis: true,
  },
  {
    title: '数量',
    dataIndex: 'qty',
    align: 'right',
    width: 100,
    render: (_, record) => formatNumber(record.qty),
  },
  {
    title: '金额',
    dataIndex: 'amount',
    align: 'right',
    width: 120,
    render: (_, record) => formatCurrencyValue(record.amount),
  },
];

const trendColumns: ProColumns<TrendRow>[] = [
  {
    title: '日期',
    dataIndex: 'trendDate',
    width: 120,
  },
  {
    title: '单数',
    dataIndex: 'count',
    align: 'right',
    width: 80,
  },
  {
    title: '金额',
    dataIndex: 'amount',
    align: 'right',
    width: 140,
    render: (_, record) => formatCurrencyValue(record.amount),
  },
];

const cashflowTrendColumns: ProColumns<CashflowTrendRow>[] = [
  {
    title: '日期',
    dataIndex: 'trendDate',
    width: 120,
  },
  {
    title: '流入',
    dataIndex: 'inAmount',
    align: 'right',
    width: 120,
    render: (_, record) => formatCurrencyValue(record.inAmount),
  },
  {
    title: '流出',
    dataIndex: 'outAmount',
    align: 'right',
    width: 120,
    render: (_, record) => formatCurrencyValue(record.outAmount),
  },
];

function MiniTable<T extends Record<string, any>>({
  columns,
  dataSource,
  rowKey,
}: {
  columns: ProColumns<T>[];
  dataSource: T[];
  rowKey: keyof T | ((record: T) => string);
}) {
  return (
    <ProTable<T>
      columns={columns}
      dataSource={dataSource}
      pagination={false}
      rowKey={rowKey as any}
      search={false}
      size="small"
      toolBarRender={false}
    />
  );
}

const ReportsPage: React.FC = () => {
  const [filters, setFilters] = useState<ReportFilters>({
    dateRange: currentMonthRange(),
  });
  const requestFilters = useMemo(() => normalizeFilters(filters), [filters]);
  const { data, error, loading, refresh } = useRequest(
    () => fetchBusinessReportOverview(requestFilters),
    {
      formatResult: (result) => result,
      refreshDeps: [
        requestFilters.company,
        requestFilters.dateFrom,
        requestFilters.dateTo,
      ],
    },
  );

  const report = data as BusinessReport | undefined;
  const overview = report?.overview;
  const meta = report?.meta;
  const visibility = report?.visibility;
  const companyLabel = meta?.company || requestFilters.company || '全部公司';

  return (
    <PageContainer
      title="经营报表"
      extra={[
        <Button key="refresh" loading={loading} onClick={refresh}>
          刷新
        </Button>,
      ]}
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <ProCard>
          <ProForm<ReportFilters>
            initialValues={filters}
            layout="inline"
            onFinish={async (values) => {
              setFilters({
                ...values,
                company: toOptionalText(values.company) ?? undefined,
              });
            }}
            submitter={{
              searchConfig: {
                submitText: '查询',
              },
              render: (_, doms) => doms[1],
            }}
          >
            <ProForm.Item label="公司" name="company">
              <RemoteLinkSelect
                doctype="Company"
                placeholder="搜索公司"
                style={{ width: 328 }}
              />
            </ProForm.Item>
            <ProFormDateRangePicker label="日期" name="dateRange" />
          </ProForm>
        </ProCard>

        <PageState
          empty={!loading && !error && !report}
          emptyDescription="暂无报表数据"
          error={error}
          errorMessage="经营报表加载失败"
          loading={loading && !report}
          onRetry={refresh}
        />

        {report ? (
          <>
            <ProCard>
              <Space orientation="vertical" size={4}>
                <Typography.Text type="secondary">统计范围</Typography.Text>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {companyLabel}
                </Typography.Title>
                <Typography.Text type="secondary">
                  {meta?.dateFrom || requestFilters.dateFrom} 至{' '}
                  {meta?.dateTo || requestFilters.dateTo}
                </Typography.Text>
              </Space>
            </ProCard>

            {visibility && Object.values(visibility).some((value) => !value) ? (
              <Alert
                showIcon
                type="info"
                title="当前报表按角色权限分区展示"
                description="无权限的业务指标不会查询，也不会用 0 冒充真实数据；其他有权限的指标仍可正常查看。"
              />
            ) : null}

            <StatisticCard.Group direction="row">
              <StatisticCard
                statistic={{
                  title: '销售额',
                  value: formatMetric(
                    overview?.salesAmountTotal,
                    visibility?.sales ?? true,
                  ),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '采购额',
                  value: formatMetric(
                    overview?.purchaseAmountTotal,
                    visibility?.purchase ?? true,
                  ),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '净现金流',
                  value: formatMetric(
                    overview?.netCashflowTotal,
                    visibility?.cashflow ?? true,
                  ),
                  valueStyle: {
                    color:
                      visibility?.cashflow === false
                        ? undefined
                        : (overview?.netCashflowTotal ?? 0) >= 0
                          ? '#1677ff'
                          : '#cf1322',
                  },
                }}
              />
            </StatisticCard.Group>

            <StatisticCard.Group direction="row">
              <StatisticCard
                statistic={{
                  title: '已收金额',
                  value: formatMetric(
                    overview?.receivedAmountTotal,
                    visibility?.cashflow ?? true,
                  ),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '应收未结',
                  value: formatMetric(
                    overview?.receivableOutstandingTotal,
                    visibility?.receivable ?? true,
                  ),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '已付金额',
                  value: formatMetric(
                    overview?.paidAmountTotal,
                    visibility?.cashflow ?? true,
                  ),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '应付未结',
                  value: formatMetric(
                    overview?.payableOutstandingTotal,
                    visibility?.payable ?? true,
                  ),
                }}
              />
            </StatisticCard.Group>

            <ProCard gutter={[16, 16]} wrap>
              <ProCard colSpan={{ xs: 24, xl: 12 }} title="销售客户排行">
                {visibility?.sales === false ? (
                  <Typography.Text type="secondary">
                    当前角色无销售数据查看权限
                  </Typography.Text>
                ) : (
                  <MiniTable
                    columns={partyColumns}
                    dataSource={report.tables.salesSummary}
                    rowKey="name"
                  />
                )}
              </ProCard>
              <ProCard colSpan={{ xs: 24, xl: 12 }} title="采购供应商排行">
                {visibility?.purchase === false ? (
                  <Typography.Text type="secondary">
                    当前角色无采购数据查看权限
                  </Typography.Text>
                ) : (
                  <MiniTable
                    columns={partyColumns}
                    dataSource={report.tables.purchaseSummary}
                    rowKey="name"
                  />
                )}
              </ProCard>
              <ProCard colSpan={{ xs: 24, xl: 12 }} title="应收明细">
                {visibility?.receivable === false ? (
                  <Typography.Text type="secondary">
                    当前角色无应收数据查看权限
                  </Typography.Text>
                ) : (
                  <MiniTable
                    columns={partyColumns}
                    dataSource={report.tables.receivableSummary}
                    rowKey="name"
                  />
                )}
              </ProCard>
              <ProCard colSpan={{ xs: 24, xl: 12 }} title="应付明细">
                {visibility?.payable === false ? (
                  <Typography.Text type="secondary">
                    当前角色无应付数据查看权限
                  </Typography.Text>
                ) : (
                  <MiniTable
                    columns={partyColumns}
                    dataSource={report.tables.payableSummary}
                    rowKey="name"
                  />
                )}
              </ProCard>
            </ProCard>

            <ProCard gutter={[16, 16]} wrap>
              <ProCard colSpan={{ xs: 24, xl: 12 }} title="销售商品排行">
                {visibility?.sales === false ? (
                  <Typography.Text type="secondary">
                    当前角色无销售数据查看权限
                  </Typography.Text>
                ) : (
                  <MiniTable
                    columns={productColumns}
                    dataSource={report.tables.salesProductSummary}
                    rowKey="itemKey"
                  />
                )}
              </ProCard>
              <ProCard colSpan={{ xs: 24, xl: 12 }} title="采购商品排行">
                {visibility?.purchase === false ? (
                  <Typography.Text type="secondary">
                    当前角色无采购数据查看权限
                  </Typography.Text>
                ) : (
                  <MiniTable
                    columns={productColumns}
                    dataSource={report.tables.purchaseProductSummary}
                    rowKey="itemKey"
                  />
                )}
              </ProCard>
            </ProCard>

            <ProCard gutter={[16, 16]} wrap>
              <ProCard colSpan={{ xs: 24, xl: 8 }} title="销售趋势">
                {visibility?.sales === false ? (
                  <Typography.Text type="secondary">
                    当前角色无销售数据查看权限
                  </Typography.Text>
                ) : (
                  <MiniTable
                    columns={trendColumns}
                    dataSource={report.tables.salesTrend}
                    rowKey="trendDate"
                  />
                )}
              </ProCard>
              <ProCard colSpan={{ xs: 24, xl: 8 }} title="采购趋势">
                {visibility?.purchase === false ? (
                  <Typography.Text type="secondary">
                    当前角色无采购数据查看权限
                  </Typography.Text>
                ) : (
                  <MiniTable
                    columns={trendColumns}
                    dataSource={report.tables.purchaseTrend}
                    rowKey="trendDate"
                  />
                )}
              </ProCard>
              <ProCard colSpan={{ xs: 24, xl: 8 }} title="资金趋势">
                {visibility?.cashflow === false ? (
                  <Typography.Text type="secondary">
                    当前角色无资金数据查看权限
                  </Typography.Text>
                ) : (
                  <MiniTable
                    columns={cashflowTrendColumns}
                    dataSource={report.tables.cashflowTrend}
                    rowKey="trendDate"
                  />
                )}
              </ProCard>
            </ProCard>
          </>
        ) : null}
      </Space>
    </PageContainer>
  );
};

export default ReportsPage;
