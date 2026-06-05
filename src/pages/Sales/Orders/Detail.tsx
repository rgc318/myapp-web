import {
  PageContainer,
  ProCard,
  ProDescriptions,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { Link, useParams, useRequest } from '@umijs/max';
import {
  Alert,
  Button,
  Empty,
  Input,
  InputNumber,
  Modal,
  message,
  Skeleton,
  Space,
  Tag,
} from 'antd';
import React, { useState } from 'react';
import {
  cancelSalesOrder,
  createSalesOrderInvoice,
  getSalesOrderDetail,
  recordSalesOrderPayment,
  type SalesOrderDetailItem,
  submitSalesOrderDelivery,
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
  const [actionLoading, setActionLoading] = useState<string>();
  const { data, error, loading, refresh } = useRequest(
    () => getSalesOrderDetail(orderName),
    {
      refreshDeps: [orderName],
    },
  );

  const runOrderAction = (
    key: string,
    title: string,
    action: () => Promise<unknown>,
    danger = false,
  ) => {
    Modal.confirm({
      cancelText: '取消',
      okText: '确认',
      okType: danger ? 'danger' : 'primary',
      onOk: async () => {
        setActionLoading(key);
        try {
          await action();
          refresh();
        } catch (caught) {
          message.error(caught instanceof Error ? caught.message : '操作失败');
          throw caught;
        } finally {
          setActionLoading(undefined);
        }
      },
      title,
    });
  };

  const confirmRecordPayment = () => {
    if (!data) {
      return;
    }

    const outstandingAmount = data.outstandingAmount ?? 0;
    let paymentAmount = outstandingAmount;
    let modeOfPayment = '';
    Modal.confirm({
      cancelText: '取消',
      content: (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <InputNumber
            autoFocus
            controls={false}
            defaultValue={outstandingAmount}
            max={outstandingAmount}
            min={0.01}
            onChange={(value) => {
              paymentAmount = Number(value ?? 0);
            }}
            precision={2}
            prefix="¥"
            style={{ width: '100%' }}
          />
          <Input
            allowClear
            onChange={(event) => {
              modeOfPayment = event.target.value;
            }}
            placeholder="付款方式，留空使用后端默认"
          />
        </Space>
      ),
      okText: '确认收款',
      onOk: async () => {
        if (paymentAmount <= 0 || paymentAmount > outstandingAmount) {
          message.error('收款金额必须大于 0 且不能超过未收金额');
          throw new Error('Invalid payment amount');
        }

        setActionLoading('payment');
        try {
          await recordSalesOrderPayment(data.name, paymentAmount, {
            modeOfPayment,
          });
          refresh();
        } catch (caught) {
          message.error(caught instanceof Error ? caught.message : '操作失败');
          throw caught;
        } finally {
          setActionLoading(undefined);
        }
      },
      title: `记录收款 ${data.name}`,
    });
  };

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
                <Space wrap>
                  <Button
                    disabled={!data.canSubmitDelivery}
                    loading={actionLoading === 'delivery'}
                    onClick={() =>
                      runOrderAction('delivery', '创建销售发货单？', () =>
                        submitSalesOrderDelivery(data.name),
                      )
                    }
                    type="primary"
                  >
                    创建发货单
                  </Button>
                  <Button
                    disabled={!data.canCreateSalesInvoice}
                    loading={actionLoading === 'invoice'}
                    onClick={() =>
                      runOrderAction('invoice', '创建销售发票？', () =>
                        createSalesOrderInvoice(data.name),
                      )
                    }
                  >
                    创建销售发票
                  </Button>
                  <Button
                    disabled={
                      !data.canRecordPayment ||
                      (data.outstandingAmount ?? 0) <= 0
                    }
                    loading={actionLoading === 'payment'}
                    onClick={confirmRecordPayment}
                  >
                    记录收款
                  </Button>
                  <Button
                    danger
                    disabled={!data.canCancelOrder}
                    loading={actionLoading === 'cancel'}
                    onClick={() =>
                      runOrderAction(
                        'cancel',
                        `取消销售订单 ${data.name}？`,
                        () => cancelSalesOrder(data.name),
                        true,
                      )
                    }
                  >
                    取消销售订单
                  </Button>
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
