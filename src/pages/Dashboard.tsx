import {
  PageContainer,
  ProCard,
  StatisticCard,
} from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import {
  Alert,
  Button,
  Col,
  Empty,
  Row,
  Skeleton,
  Space,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import { useWorkspacePreferences } from '@/hooks/useWorkspacePreferences';
import { getBusinessReportOverview } from '@/services/myapp/gateway';
import { formatCurrencyValue } from '@/utils/myapp-display';

type BusinessOverview = {
  net_cashflow_total?: number | string | null;
  paid_amount_total?: number | string | null;
  payable_outstanding_total?: number | string | null;
  purchase_amount_total?: number | string | null;
  receivable_outstanding_total?: number | string | null;
  received_amount_total?: number | string | null;
  sales_amount_total?: number | string | null;
};

type BusinessOverviewData = {
  meta?: {
    company?: string | null;
    date_from?: string | null;
    date_to?: string | null;
  };
  overview?: BusinessOverview;
};

function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatDateRange(meta: BusinessOverviewData['meta']) {
  const from = meta?.date_from
    ? dayjs(meta.date_from).format('YYYY-MM-DD')
    : '';
  const to = meta?.date_to ? dayjs(meta.date_to).format('YYYY-MM-DD') : '';

  if (from && to) {
    return `${from} 至 ${to}`;
  }

  return '最近经营周期';
}

const Dashboard: React.FC = () => {
  const { defaultCompany } = useWorkspacePreferences();
  const { data, error, loading, refresh } = useRequest(
    async () => {
      const result = await getBusinessReportOverview({
        company: defaultCompany,
      });
      return result.data as BusinessOverviewData;
    },
    { formatResult: (result) => result, refreshDeps: [defaultCompany] },
  );

  const overviewData = data as BusinessOverviewData | undefined;
  const overview = overviewData?.overview;
  const hasOverview = Boolean(overview);

  return (
    <PageContainer
      title="业务概览"
      extra={[
        <Button key="refresh" loading={loading} onClick={refresh}>
          刷新
        </Button>,
      ]}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <ProCard>
          <Space direction="vertical" size={4}>
            <Typography.Text type="secondary">当前公司</Typography.Text>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {overviewData?.meta?.company || defaultCompany}
            </Typography.Title>
            <Typography.Text type="secondary">
              {formatDateRange(overviewData?.meta)}
            </Typography.Text>
          </Space>
        </ProCard>

        {error && (
          <Alert
            type="error"
            showIcon
            message="经营概览加载失败"
            description={
              error instanceof Error ? error.message : '请稍后刷新重试。'
            }
            action={
              <Button size="small" onClick={refresh}>
                重试
              </Button>
            }
          />
        )}

        {loading && !hasOverview ? (
          <ProCard>
            <Skeleton active paragraph={{ rows: 6 }} />
          </ProCard>
        ) : null}

        {!loading && !error && !hasOverview ? (
          <ProCard>
            <Empty description="暂无经营概览数据" />
          </ProCard>
        ) : null}

        {hasOverview ? (
          <>
            <StatisticCard.Group direction="row">
              <StatisticCard
                statistic={{
                  title: '销售额',
                  value: formatCurrencyValue(overview?.sales_amount_total),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '采购额',
                  value: formatCurrencyValue(overview?.purchase_amount_total),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '净现金流',
                  value: formatCurrencyValue(overview?.net_cashflow_total),
                  valueStyle: {
                    color:
                      toNumber(overview?.net_cashflow_total) >= 0
                        ? '#1677ff'
                        : '#cf1322',
                  },
                }}
              />
            </StatisticCard.Group>

            <Row gutter={[16, 16]}>
              <Col xs={24} lg={12}>
                <ProCard title="收款概览">
                  <StatisticCard
                    statistic={{
                      title: '已收金额',
                      value: formatCurrencyValue(
                        overview?.received_amount_total,
                      ),
                    }}
                  />
                  <StatisticCard
                    statistic={{
                      title: '应收未结',
                      value: formatCurrencyValue(
                        overview?.receivable_outstanding_total,
                      ),
                    }}
                  />
                </ProCard>
              </Col>
              <Col xs={24} lg={12}>
                <ProCard title="付款概览">
                  <StatisticCard
                    statistic={{
                      title: '已付金额',
                      value: formatCurrencyValue(overview?.paid_amount_total),
                    }}
                  />
                  <StatisticCard
                    statistic={{
                      title: '应付未结',
                      value: formatCurrencyValue(
                        overview?.payable_outstanding_total,
                      ),
                    }}
                  />
                </ProCard>
              </Col>
            </Row>
          </>
        ) : null}
      </Space>
    </PageContainer>
  );
};

export default Dashboard;
