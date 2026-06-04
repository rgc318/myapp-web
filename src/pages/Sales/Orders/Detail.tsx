import {
  PageContainer,
  ProCard,
  ProDescriptions,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { Link, useParams, useRequest } from '@umijs/max';
import { Alert, Button, Empty, Skeleton, Space, Tag, Typography } from 'antd';
import React from 'react';
import {
  getSalesOrderDetail,
  type SalesOrderDetailItem,
} from '@/services/myapp/sales';

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value ?? 0);
}

function statusTag(value: string) {
  return value ? <Tag color="blue">{value}</Tag> : <Tag>未知</Tag>;
}

function docLinks(values: string[], basePath: string) {
  return values.length
    ? values.map((name, index) => (
        <React.Fragment key={name}>
          {index > 0 ? '、' : null}
          <Link to={`${basePath}/${encodeURIComponent(name)}`}>{name}</Link>
        </React.Fragment>
      ))
    : '无';
}

const itemColumns = [
  {
    title: '商品编码',
    dataIndex: 'itemCode',
    width: 160,
  },
  {
    title: '商品名称',
    dataIndex: 'itemName',
    ellipsis: true,
  },
  {
    title: '数量',
    dataIndex: 'qty',
    align: 'right' as const,
    width: 100,
  },
  {
    title: '单位',
    dataIndex: 'uom',
    width: 90,
  },
  {
    title: '单价',
    dataIndex: 'rate',
    align: 'right' as const,
    width: 120,
    render: (_: unknown, record: SalesOrderDetailItem) =>
      `¥${formatCurrency(record.rate)}`,
  },
  {
    title: '金额',
    dataIndex: 'amount',
    align: 'right' as const,
    width: 120,
    render: (_: unknown, record: SalesOrderDetailItem) =>
      `¥${formatCurrency(record.amount)}`,
  },
  {
    title: '仓库',
    dataIndex: 'warehouse',
    ellipsis: true,
    width: 180,
  },
];

const SalesOrderDetailPage: React.FC = () => {
  const params = useParams();
  const orderName = decodeURIComponent(String(params.name ?? ''));
  const { data, error, loading, refresh } = useRequest(
    () => getSalesOrderDetail(orderName),
    {
      refreshDeps: [orderName],
    },
  );

  return (
    <PageContainer
      title={orderName || '销售订单详情'}
      extra={[
        <Button key="back">
          <Link to="/sales/orders">返回列表</Link>
        </Button>,
        <Button key="refresh" loading={loading} onClick={refresh}>
          刷新
        </Button>,
      ]}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {error && (
          <Alert
            action={
              <Button size="small" onClick={refresh}>
                重试
              </Button>
            }
            description={
              error instanceof Error ? error.message : '请稍后重试。'
            }
            message="销售订单详情加载失败"
            showIcon
            type="error"
          />
        )}

        {loading && !data ? (
          <ProCard>
            <Skeleton active paragraph={{ rows: 8 }} />
          </ProCard>
        ) : null}

        {!loading && !error && !data ? (
          <ProCard>
            <Empty description="未找到销售订单" />
          </ProCard>
        ) : null}

        {data ? (
          <>
            <StatisticCard.Group direction="row">
              <StatisticCard
                statistic={{
                  title: '订单金额',
                  value: formatCurrency(data.amount),
                  prefix: '¥',
                }}
              />
              <StatisticCard
                statistic={{
                  title: '已收金额',
                  value: formatCurrency(data.paidAmount),
                  prefix: '¥',
                }}
              />
              <StatisticCard
                statistic={{
                  title: '未收金额',
                  value: formatCurrency(data.outstandingAmount),
                  prefix: '¥',
                }}
              />
            </StatisticCard.Group>

            <ProCard split="vertical">
              <ProCard title="基本信息">
                <ProDescriptions column={2} dataSource={data}>
                  <ProDescriptions.Item label="客户" dataIndex="customer" />
                  <ProDescriptions.Item label="公司" dataIndex="company" />
                  <ProDescriptions.Item
                    label="订单日期"
                    dataIndex="transactionDate"
                  />
                  <ProDescriptions.Item
                    label="交货日期"
                    dataIndex="deliveryDate"
                  />
                  <ProDescriptions.Item label="单据状态">
                    {statusTag(data.documentStatus)}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="履约状态">
                    {statusTag(data.fulfillmentStatus)}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="收款状态">
                    {statusTag(data.paymentStatus)}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="完成状态">
                    {statusTag(data.completionStatus)}
                  </ProDescriptions.Item>
                </ProDescriptions>
              </ProCard>

              <ProCard title="履约动作">
                <Space direction="vertical" size={8}>
                  <Typography.Text>
                    可发货：{data.canSubmitDelivery ? '是' : '否'}
                  </Typography.Text>
                  <Typography.Text>
                    可开票：{data.canCreateSalesInvoice ? '是' : '否'}
                  </Typography.Text>
                  <Typography.Text>
                    可收款：{data.canRecordPayment ? '是' : '否'}
                  </Typography.Text>
                </Space>
              </ProCard>
            </ProCard>

            <ProCard title="收货信息">
              <ProDescriptions column={2} dataSource={data}>
                <ProDescriptions.Item
                  label="联系人"
                  dataIndex="contactDisplay"
                />
                <ProDescriptions.Item
                  label="联系电话"
                  dataIndex="contactPhone"
                />
                <ProDescriptions.Item
                  label="收货地址"
                  dataIndex="addressDisplay"
                  span={2}
                />
                <ProDescriptions.Item
                  label="备注"
                  dataIndex="remarks"
                  span={2}
                />
              </ProDescriptions>
            </ProCard>

            <ProCard title="关联单据">
              <ProDescriptions column={2}>
                <ProDescriptions.Item label="发货单">
                  {docLinks(data.deliveryNotes, '/sales/delivery-notes')}
                </ProDescriptions.Item>
                <ProDescriptions.Item label="销售发票">
                  {docLinks(data.salesInvoices, '/sales/invoices')}
                </ProDescriptions.Item>
              </ProDescriptions>
            </ProCard>

            <ProTable<SalesOrderDetailItem>
              columns={itemColumns}
              dataSource={data.items}
              pagination={false}
              rowKey={(record) => `${record.itemCode}-${record.warehouse}`}
              search={false}
              toolBarRender={false}
            />
          </>
        ) : null}
      </Space>
    </PageContainer>
  );
};

export default SalesOrderDetailPage;
