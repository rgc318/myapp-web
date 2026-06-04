import {
  PageContainer,
  ProCard,
  ProDescriptions,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { Link, useParams, useRequest } from '@umijs/max';
import { Alert, Button, Empty, Skeleton, Space, Tag } from 'antd';
import React from 'react';
import {
  getPurchaseInvoiceDetail,
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

const PurchaseInvoiceDetailPage: React.FC = () => {
  const params = useParams();
  const invoiceName = decodeURIComponent(String(params.name ?? ''));
  const { data, error, loading, refresh } = useRequest(
    () => getPurchaseInvoiceDetail(invoiceName),
    {
      refreshDeps: [invoiceName],
    },
  );

  return (
    <PageContainer
      title={invoiceName || '采购发票详情'}
      extra={[
        <Button key="back">
          <Link to="/purchase/orders">返回采购订单</Link>
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
            message="采购发票详情加载失败"
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
            <Empty description="未找到采购发票" />
          </ProCard>
        ) : null}

        {data ? (
          <>
            <StatisticCard.Group direction="row">
              <StatisticCard
                statistic={{
                  title: '发票金额',
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
                    label="过账日期"
                    dataIndex="postingDate"
                  />
                  <ProDescriptions.Item label="到期日期" dataIndex="dueDate" />
                  <ProDescriptions.Item label="币种" dataIndex="currency" />
                  <ProDescriptions.Item label="单据状态">
                    {statusTag(data.documentStatus)}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="付款状态">
                    {statusTag(data.paymentStatus)}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="可取消">
                    {data.canCancel ? '是' : '否'}
                  </ProDescriptions.Item>
                </ProDescriptions>
              </ProCard>

              <ProCard title="付款信息">
                <ProDescriptions column={1} dataSource={data}>
                  <ProDescriptions.Item
                    label="最近付款"
                    dataIndex="latestPaymentEntry"
                  />
                  <ProDescriptions.Item label="备注" dataIndex="remarks" />
                </ProDescriptions>
              </ProCard>
            </ProCard>

            <ProCard title="关联单据">
              <ProDescriptions column={2}>
                <ProDescriptions.Item label="采购订单">
                  {docLinks(data.purchaseOrders, '/purchase/orders')}
                </ProDescriptions.Item>
                <ProDescriptions.Item label="采购收货单">
                  {docLinks(data.purchaseReceipts, '/purchase/receipts')}
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

export default PurchaseInvoiceDetailPage;
