import {
  PageContainer,
  ProCard,
  ProDescriptions,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { history, Link, useParams, useRequest } from '@umijs/max';
import {
  Alert,
  Button,
  Empty,
  InputNumber,
  Modal,
  message,
  Skeleton,
  Space,
} from 'antd';
import React, { useState } from 'react';
import { PaymentModeSelect } from '@/components/PaymentModeSelect';
import {
  cancelPurchaseInvoice,
  cancelSupplierPaymentEntry,
  getPurchaseInvoiceDetail,
  type PurchaseDocumentItem,
  recordSupplierPayment,
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

const PurchaseInvoiceDetailPage: React.FC = () => {
  const params = useParams();
  const invoiceName = decodeURIComponent(String(params.name ?? ''));
  const [cancelLoading, setCancelLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentCancelLoading, setPaymentCancelLoading] = useState(false);
  const { data, error, loading, refresh } = useRequest(
    () => getPurchaseInvoiceDetail(invoiceName),
    {
      refreshDeps: [invoiceName],
    },
  );

  const confirmCancel = () => {
    Modal.confirm({
      cancelText: '取消',
      okText: '确认取消',
      okType: 'danger',
      onOk: async () => {
        setCancelLoading(true);
        try {
          await cancelPurchaseInvoice(invoiceName);
          refresh();
        } catch (caught) {
          message.error(caught instanceof Error ? caught.message : '操作失败');
          throw caught;
        } finally {
          setCancelLoading(false);
        }
      },
      title: '取消采购发票？',
    });
  };

  const confirmCancelPayment = () => {
    if (!data?.latestPaymentEntry) {
      return;
    }
    Modal.confirm({
      cancelText: '取消',
      okText: '确认取消',
      okType: 'danger',
      onOk: async () => {
        setPaymentCancelLoading(true);
        try {
          await cancelSupplierPaymentEntry(data.latestPaymentEntry);
          refresh();
        } catch (caught) {
          message.error(caught instanceof Error ? caught.message : '操作失败');
          throw caught;
        } finally {
          setPaymentCancelLoading(false);
        }
      },
      title: `取消付款 ${data.latestPaymentEntry}？`,
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
          <PaymentModeSelect
            onChange={(value) => {
              modeOfPayment = value;
            }}
          />
        </Space>
      ),
      okText: '确认付款',
      onOk: async () => {
        if (paymentAmount <= 0 || paymentAmount > outstandingAmount) {
          message.error('付款金额必须大于 0 且不能超过未付金额');
          throw new Error('Invalid payment amount');
        }

        setPaymentLoading(true);
        try {
          await recordSupplierPayment(invoiceName, paymentAmount, {
            modeOfPayment,
          });
          refresh();
        } catch (caught) {
          message.error(caught instanceof Error ? caught.message : '操作失败');
          throw caught;
        } finally {
          setPaymentLoading(false);
        }
      },
      title: `记录付款 ${invoiceName}`,
    });
  };

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
        data?.documentStatus !== 'cancelled' ? (
          <Button
            key="return"
            onClick={() => {
              const params = new URLSearchParams({
                sourceDoctype: 'Purchase Invoice',
                sourceName: invoiceName,
              });
              history.push(`/purchase/returns/new?${params.toString()}`);
            }}
          >
            采购退货
          </Button>
        ) : null,
        <Button
          disabled={
            data?.documentStatus === 'cancelled' ||
            (data?.outstandingAmount ?? 0) <= 0
          }
          key="payment"
          loading={paymentLoading}
          onClick={confirmRecordPayment}
          type="primary"
        >
          记录付款
        </Button>,
        <Button
          danger
          disabled={!data?.canCancel}
          key="cancel"
          loading={cancelLoading}
          onClick={confirmCancel}
        >
          取消采购发票
        </Button>,
        <Button
          danger
          disabled={!data?.latestPaymentEntry}
          key="cancel-payment"
          loading={paymentCancelLoading}
          onClick={confirmCancelPayment}
        >
          取消最近付款
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
                    label="过账日期"
                    dataIndex="postingDate"
                  />
                  <ProDescriptions.Item label="到期日期" dataIndex="dueDate" />
                  <ProDescriptions.Item label="币种">
                    {formatCurrencyCode(data.currency)}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="单据状态">
                    <StatusTag value={data.documentStatus} />
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="付款状态">
                    <StatusTag value={data.paymentStatus} />
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
