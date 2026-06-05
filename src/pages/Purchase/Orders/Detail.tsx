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
  DatePicker,
  Empty,
  Input,
  InputNumber,
  Modal,
  message,
  Skeleton,
  Space,
} from 'antd';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import {
  cancelPurchaseOrder,
  createPurchaseOrderInvoice,
  getPurchaseOrderDetail,
  type PurchaseDocumentItem,
  receivePurchaseOrder,
  recordPurchaseOrderPayment,
} from '@/services/myapp/purchase';
import {
  formatCurrencyCode,
  formatCurrencyValue,
  formatDisplayUom,
  StatusTag,
} from '@/utils/myapp-display';

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
    title: '已收数量',
    dataIndex: 'receivedQty',
    align: 'right' as const,
    width: 110,
  },
  {
    title: '单位',
    dataIndex: 'uom',
    width: 90,
    render: (_: unknown, record: PurchaseDocumentItem) =>
      formatDisplayUom(record.uom),
  },
  {
    title: '单价',
    dataIndex: 'rate',
    align: 'right' as const,
    width: 120,
    render: (_: unknown, record: PurchaseDocumentItem) =>
      formatCurrencyValue(record.rate),
  },
  {
    title: '金额',
    dataIndex: 'amount',
    align: 'right' as const,
    width: 120,
    render: (_: unknown, record: PurchaseDocumentItem) =>
      formatCurrencyValue(record.amount),
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
  const [actionLoading, setActionLoading] = useState<string>();
  const { data, error, loading, refresh } = useRequest(
    () => getPurchaseOrderDetail(orderName),
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

  const confirmReceivePurchaseOrder = () => {
    if (!data) {
      return;
    }

    let postingDate = dayjs().format('YYYY-MM-DD');
    let remarks = '';
    Modal.confirm({
      cancelText: '取消',
      content: (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <DatePicker
            defaultValue={dayjs(postingDate)}
            onChange={(value) => {
              postingDate = value?.format('YYYY-MM-DD') ?? '';
            }}
            style={{ width: '100%' }}
          />
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 4 }}
            onChange={(event) => {
              remarks = event.target.value;
            }}
            placeholder="备注"
          />
        </Space>
      ),
      okText: '创建收货单',
      onOk: async () => {
        setActionLoading('receipt');
        try {
          await receivePurchaseOrder(data.name, {
            postingDate,
            remarks,
          });
          refresh();
        } catch (caught) {
          message.error(caught instanceof Error ? caught.message : '操作失败');
          throw caught;
        } finally {
          setActionLoading(undefined);
        }
      },
      title: `创建采购收货单 ${data.name}`,
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
      okText: '确认付款',
      onOk: async () => {
        if (paymentAmount <= 0 || paymentAmount > outstandingAmount) {
          message.error('付款金额必须大于 0 且不能超过未付金额');
          throw new Error('Invalid payment amount');
        }

        setActionLoading('payment');
        try {
          await recordPurchaseOrderPayment(data.name, paymentAmount, {
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
      title: `记录付款 ${data.name}`,
    });
  };

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
                  value: formatCurrencyValue(data.amount, data.currency),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '已付金额',
                  value: formatCurrencyValue(data.paidAmount, data.currency),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '未付金额',
                  value: formatCurrencyValue(
                    data.outstandingAmount,
                    data.currency,
                  ),
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
                  <ProDescriptions.Item label="币种">
                    {formatCurrencyCode(data.currency)}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="单据状态">
                    <StatusTag value={data.documentStatus} />
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="收货状态">
                    <StatusTag value={data.receivingStatus} />
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="付款状态">
                    <StatusTag value={data.paymentStatus} />
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="完成状态">
                    <StatusTag value={data.completionStatus} />
                  </ProDescriptions.Item>
                </ProDescriptions>
              </ProCard>

              <ProCard title="采购动作">
                <Space wrap>
                  <Button
                    disabled={!data.canReceive}
                    loading={actionLoading === 'receipt'}
                    onClick={confirmReceivePurchaseOrder}
                    type="primary"
                  >
                    创建收货单
                  </Button>
                  <Button
                    disabled={!data.canCreateInvoice}
                    loading={actionLoading === 'invoice'}
                    onClick={() =>
                      runOrderAction('invoice', '创建采购发票？', () =>
                        createPurchaseOrderInvoice(data.name),
                      )
                    }
                  >
                    创建采购发票
                  </Button>
                  <Button
                    disabled={
                      !data.canRecordPayment ||
                      (data.outstandingAmount ?? 0) <= 0
                    }
                    loading={actionLoading === 'payment'}
                    onClick={confirmRecordPayment}
                  >
                    记录付款
                  </Button>
                  <Button
                    danger
                    disabled={!data.canCancelOrder}
                    loading={actionLoading === 'cancel'}
                    onClick={() =>
                      runOrderAction(
                        'cancel',
                        `取消采购订单 ${data.name}？`,
                        () => cancelPurchaseOrder(data.name),
                        true,
                      )
                    }
                  >
                    取消采购订单
                  </Button>
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
                  {docLinks(data.purchaseReceipts, '/purchase/receipts')}
                </ProDescriptions.Item>
                <ProDescriptions.Item label="采购发票">
                  {docLinks(data.purchaseInvoices, '/purchase/invoices')}
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
