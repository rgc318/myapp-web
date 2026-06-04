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
  getPurchaseOrderDetail,
  type PurchaseDocumentItem,
} from '@/services/myapp/purchase';

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value ?? 0);
}

function statusTag(value: string) {
  return value ? <Tag color="blue">{value}</Tag> : <Tag>未知</Tag>;
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
    title: '已收数量',
    dataIndex: 'receivedQty',
    align: 'right' as const,
    width: 110,
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
    render: (_: unknown, record: PurchaseDocumentItem) =>
      `¥${formatCurrency(record.rate)}`,
  },
  {
    title: '金额',
    dataIndex: 'amount',
    align: 'right' as const,
    width: 120,
    render: (_: unknown, record: PurchaseDocumentItem) =>
      `¥${formatCurrency(record.amount)}`,
  },
  {
    title: '仓库',
    dataIndex: 'warehouse',
    ellipsis: true,
    width: 180,
  },
];

const PurchaseOrderDetailPage: React.FC = () => {
  const params = useParams();
  const orderName = decodeURIComponent(String(params.name ?? ''));
  const { data, error, loading, refresh } = useRequest(
    () => getPurchaseOrderDetail(orderName),
    {
      refreshDeps: [orderName],
    },
  );

  return (
    <PageContainer
      title={orderName || '采购订单详情'}
      extra={[
        <Button key="back">
          <Link to="/purchase/orders">返回列表</Link>
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
            message="采购订单详情加载失败"
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
            <Empty description="未找到采购订单" />
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
                  title: '已付金额',
                  value: formatCurrency(data.paidAmount),
                  prefix: '¥',
                }}
              />
              <StatisticCard
                statistic={{
                  title: '未付金额',
                  value: formatCurrency(data.outstandingAmount),
                  prefix: '¥',
                }}
              />
            </StatisticCard.Group>

            <ProCard split="vertical">
              <ProCard title="基本信息">
                <ProDescriptions column={2} dataSource={data}>
                  <ProDescriptions.Item
                    label="供应商"
                    dataIndex="supplierName"
                  />
                  <ProDescriptions.Item label="公司" dataIndex="company" />
                  <ProDescriptions.Item
                    label="订单日期"
                    dataIndex="transactionDate"
                  />
                  <ProDescriptions.Item
                    label="要求到货日期"
                    dataIndex="scheduleDate"
                  />
                  <ProDescriptions.Item
                    label="供应商单号"
                    dataIndex="supplierRef"
                  />
                  <ProDescriptions.Item label="币种" dataIndex="currency" />
                  <ProDescriptions.Item label="单据状态">
                    {statusTag(data.documentStatus)}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="收货状态">
                    {statusTag(data.receivingStatus)}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="付款状态">
                    {statusTag(data.paymentStatus)}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="完成状态">
                    {statusTag(data.completionStatus)}
                  </ProDescriptions.Item>
                </ProDescriptions>
              </ProCard>

              <ProCard title="采购动作">
                <Space direction="vertical" size={8}>
                  <Typography.Text>
                    可收货：{data.canReceive ? '是' : '否'}
                  </Typography.Text>
                  <Typography.Text>
                    可开票：{data.canCreateInvoice ? '是' : '否'}
                  </Typography.Text>
                  <Typography.Text>
                    可付款：{data.canRecordPayment ? '是' : '否'}
                  </Typography.Text>
                </Space>
              </ProCard>
            </ProCard>

            <ProCard title="供应商信息">
              <ProDescriptions column={2} dataSource={data}>
                <ProDescriptions.Item
                  label="联系人"
                  dataIndex="supplierContactDisplay"
                />
                <ProDescriptions.Item
                  label="联系电话"
                  dataIndex="supplierContactPhone"
                />
                <ProDescriptions.Item
                  label="供应商地址"
                  dataIndex="supplierAddressDisplay"
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
                <ProDescriptions.Item label="采购收货单">
                  {data.purchaseReceipts.length
                    ? data.purchaseReceipts.join('、')
                    : '无'}
                </ProDescriptions.Item>
                <ProDescriptions.Item label="采购发票">
                  {data.purchaseInvoices.length
                    ? data.purchaseInvoices.join('、')
                    : '无'}
                </ProDescriptions.Item>
              </ProDescriptions>
            </ProCard>

            <ProTable<PurchaseDocumentItem>
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

export default PurchaseOrderDetailPage;
