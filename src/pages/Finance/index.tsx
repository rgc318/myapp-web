import type { ProColumns } from '@ant-design/pro-components';
import {
  PageContainer,
  ProCard,
  ProForm,
  ProFormDateRangePicker,
  ProFormText,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { Button, Segmented, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import PageState from '@/components/PageState';
import {
  type BusinessReport,
  fetchReceivablePayableReport,
  type PartySummaryRow,
} from '@/services/myapp/reports';
import { formatCurrencyValue } from '@/utils/myapp-display';

const DEFAULT_COMPANY = 'rgc (Demo)';
const DEFAULT_LIMIT = 50;

type FinanceMode = 'receivable' | 'payable';

type FinanceFilters = {
  company?: string;
  dateRange?: string[];
};

function currentMonthRange() {
  return [
    dayjs().startOf('month').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD'),
  ];
}

function normalizeFilters(values: FinanceFilters) {
  const dateRange = Array.isArray(values.dateRange)
    ? values.dateRange
    : currentMonthRange();

  return {
    company: values.company?.trim() || DEFAULT_COMPANY,
    dateFrom: dateRange[0],
    dateTo: dateRange[1],
    limit: DEFAULT_LIMIT,
  };
}

function sumRows(
  rows: PartySummaryRow[],
  key: 'outstandingAmount' | 'totalAmount',
) {
  return rows.reduce((total, row) => total + (row[key] ?? row.amount ?? 0), 0);
}

const columns: ProColumns<PartySummaryRow>[] = [
  {
    title: '往来方',
    dataIndex: 'name',
    ellipsis: true,
  },
  {
    title: '单据数',
    dataIndex: 'count',
    align: 'right',
    width: 100,
  },
  {
    title: '总金额',
    dataIndex: 'totalAmount',
    align: 'right',
    width: 140,
    render: (_, record) =>
      formatCurrencyValue(record.totalAmount ?? record.amount),
  },
  {
    title: '已结金额',
    dataIndex: 'paidAmount',
    align: 'right',
    width: 140,
    render: (_, record) => formatCurrencyValue(record.paidAmount),
  },
  {
    title: '未结金额',
    dataIndex: 'outstandingAmount',
    align: 'right',
    width: 140,
    render: (_, record) => formatCurrencyValue(record.outstandingAmount),
  },
];

const FinancePage: React.FC = () => {
  const [mode, setMode] = useState<FinanceMode>('receivable');
  const [filters, setFilters] = useState<FinanceFilters>({
    company: DEFAULT_COMPANY,
    dateRange: currentMonthRange(),
  });
  const requestFilters = useMemo(() => normalizeFilters(filters), [filters]);
  const { data, error, loading, refresh } = useRequest(
    () => fetchReceivablePayableReport(requestFilters),
    {
      refreshDeps: [
        requestFilters.company,
        requestFilters.dateFrom,
        requestFilters.dateTo,
      ],
    },
  );

  const report = data as BusinessReport | undefined;
  const rows =
    mode === 'receivable'
      ? (report?.tables.receivableSummary ?? [])
      : (report?.tables.payableSummary ?? []);
  const totalAmount = sumRows(rows, 'totalAmount');
  const outstandingAmount = sumRows(rows, 'outstandingAmount');
  const meta = report?.meta;

  return (
    <PageContainer
      title="财务查询"
      extra={[
        <Button key="refresh" loading={loading} onClick={refresh}>
          刷新
        </Button>,
      ]}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <ProCard>
          <ProForm<FinanceFilters>
            initialValues={filters}
            layout="inline"
            onFinish={async (values) => {
              setFilters(values);
            }}
            submitter={{
              searchConfig: {
                submitText: '查询',
              },
              render: (_, doms) => doms[1],
            }}
          >
            <ProFormText
              fieldProps={{ allowClear: true }}
              label="公司"
              name="company"
              placeholder="公司"
              width="md"
            />
            <ProFormDateRangePicker label="日期" name="dateRange" />
          </ProForm>
        </ProCard>

        <PageState
          empty={!loading && !error && !report}
          emptyDescription="暂无财务数据"
          error={error}
          errorMessage="财务查询加载失败"
          loading={loading && !report}
          onRetry={refresh}
        />

        {report ? (
          <>
            <ProCard>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Space align="center" wrap>
                  <Segmented
                    onChange={(value) => setMode(value as FinanceMode)}
                    options={[
                      { label: '客户应收', value: 'receivable' },
                      { label: '供应商应付', value: 'payable' },
                    ]}
                    value={mode}
                  />
                  <Typography.Text type="secondary">
                    {meta?.company || requestFilters.company}，
                    {meta?.dateFrom || requestFilters.dateFrom} 至{' '}
                    {meta?.dateTo || requestFilters.dateTo}
                  </Typography.Text>
                </Space>
              </Space>
            </ProCard>

            <StatisticCard.Group direction="row">
              <StatisticCard
                statistic={{
                  title: mode === 'receivable' ? '应收总额' : '应付总额',
                  value: formatCurrencyValue(totalAmount),
                }}
              />
              <StatisticCard
                statistic={{
                  title: mode === 'receivable' ? '应收未结' : '应付未结',
                  value: formatCurrencyValue(outstandingAmount),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '往来方数量',
                  value: rows.length,
                }}
              />
            </StatisticCard.Group>

            <ProTable<PartySummaryRow>
              columns={columns}
              dataSource={rows}
              pagination={{
                defaultPageSize: 20,
                showSizeChanger: false,
              }}
              rowKey="name"
              search={false}
              toolBarRender={false}
            />
          </>
        ) : null}
      </Space>
    </PageContainer>
  );
};

export default FinancePage;
