import { Line } from '@ant-design/plots';
import { ProCard, StatisticCard } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { Col, Row, Space } from 'antd';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import { getAiUsage } from '@/services/myapp/ai-governance';

export default function UsageAnalytics() {
  const { data = [], loading } = useRequest(
    () =>
      getAiUsage({
        dateFrom: dayjs().subtract(29, 'day').format('YYYY-MM-DD'),
        dateTo: dayjs().format('YYYY-MM-DD'),
      }),
    { formatResult: (result) => result },
  );

  const summary = useMemo(() => {
    const requestCount = data.reduce((sum, row) => sum + row.requestCount, 0);
    const successCount = data.reduce((sum, row) => sum + row.successCount, 0);
    const estimatedCost = data.reduce((sum, row) => sum + row.estimatedCost, 0);
    const latencyP95 = data.reduce(
      (max, row) => Math.max(max, row.latencyP95Ms ?? 0),
      0,
    );
    return {
      costCurrency: data.find((row) => row.costCurrency)?.costCurrency ?? '-',
      estimatedCost,
      latencyP95,
      requestCount,
      successRate: requestCount ? (successCount / requestCount) * 100 : 0,
    };
  }, [data]);

  const trend = useMemo(() => {
    const grouped = new Map<
      string,
      { cost: number; errors: number; requests: number }
    >();
    data.forEach((row) => {
      const current = grouped.get(row.usageDate) ?? {
        cost: 0,
        errors: 0,
        requests: 0,
      };
      current.cost += row.estimatedCost;
      current.errors += row.errorCount;
      current.requests += row.requestCount;
      grouped.set(row.usageDate, current);
    });
    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap(([date, value]) => [
        { date, metric: '请求数', value: value.requests },
        { date, metric: '错误数', value: value.errors },
      ]);
  }, [data]);

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col lg={6} sm={12} xs={24}>
          <StatisticCard
            loading={loading}
            statistic={{ title: '近 30 日请求', value: summary.requestCount }}
          />
        </Col>
        <Col lg={6} sm={12} xs={24}>
          <StatisticCard
            loading={loading}
            statistic={{
              suffix: '%',
              title: '成功率',
              value: summary.successRate,
              precision: 2,
            }}
          />
        </Col>
        <Col lg={6} sm={12} xs={24}>
          <StatisticCard
            loading={loading}
            statistic={{
              description: summary.costCurrency,
              precision: 4,
              title: '估算成本',
              value: summary.estimatedCost,
            }}
          />
        </Col>
        <Col lg={6} sm={12} xs={24}>
          <StatisticCard
            loading={loading}
            statistic={{
              suffix: 'ms',
              title: '最大 p95 延迟',
              value: summary.latencyP95,
            }}
          />
        </Col>
      </Row>
      <ProCard title="请求与错误趋势" variant="outlined">
        <Line
          axis={{ y: { title: '次数' } }}
          colorField="metric"
          data={trend}
          height={280}
          xField="date"
          yField="value"
        />
      </ProCard>
    </Space>
  );
}
