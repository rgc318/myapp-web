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
  Progress,
  Skeleton,
  Space,
} from 'antd';
import React, { useState } from 'react';
import { PaymentModeSelect } from '@/components/PaymentModeSelect';
import { PrintDocumentButton } from '@/components/PrintDocumentButton';
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
  resolveDisplayUom,
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

function isCancelled(status: string) {
  return status === 'cancelled' || status === '已作废';
}

function paymentEntryPath(paymentEntry: string) {
  return `/payments/${encodeURIComponent(paymentEntry)}`;
}

function toPercent(
  value: number | null | undefined,
  total: number | null | undefined,
) {
  const totalValue = Number(total ?? 0);
  if (!Number.isFinite(totalValue) || totalValue <= 0) {
    return 0;
  }
  return Math.min(Math.round((Number(value ?? 0) / totalValue) * 100), 100);
}

function paymentStatusHint(data: {
  documentStatus: string;
  latestPaymentEntry: string;
  outstandingAmount: number | null;
}) {
  if (isCancelled(data.documentStatus)) {
    return '当前采购发票已经作废，仅作为历史单据查看。后续处理应返回仍然有效的采购订单或收货单。';
  }
  if ((data.outstandingAmount ?? 0) > 0) {
    return '当前采购发票仍有未付金额，可继续登记付款；如果需要回改单据，请先确认是否要同步回退付款登记。';
  }
  if (data.latestPaymentEntry) {
    return '当前采购发票已经结清。若需要回退开票结果，应先确认是否要回退关联付款，再作废采购发票。';
  }
  return '当前采购发票没有未付金额，可继续打印留档或返回来源单据核对业务链路。';
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
      resolveDisplayUom(record.uom, record.uomDisplay),
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
      formatResult: (result) => result,
      refreshDeps: [invoiceName],
    },
  );
  const cancelled = data ? isCancelled(data.documentStatus) : false;
  const hasOutstanding = (data?.outstandingAmount ?? 0) > 0;

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
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
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
        <PrintDocumentButton
          disabled={!invoiceName}
          docname={invoiceName}
          doctype="Purchase Invoice"
          key="print"
        />,
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
          disabled={cancelled || !hasOutstanding}
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
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
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
                chart={
                  <Progress
                    percent={toPercent(data.paidAmount, data.amount)}
                    size="small"
                    status={hasOutstanding ? 'active' : 'success'}
                  />
                }
                statistic={{
                  title: '付款进度',
                  value: `${toPercent(data.paidAmount, data.amount)}%`,
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
              <ProCard colSpan="65%">
                <Space
                  orientation="vertical"
                  size={16}
                  style={{ width: '100%' }}
                >
                  <ProTable<PurchaseDocumentItem>
                    columns={itemColumns}
                    dataSource={data.items}
                    headerTitle="商品明细"
                    pagination={false}
                    rowKey={(record) =>
                      `${record.itemCode}-${record.warehouse}`
                    }
                    search={false}
                    toolBarRender={false}
                  />

                  <ProCard title={cancelled ? '历史单据说明' : '流程承接'}>
                    <Alert
                      action={
                        cancelled && data.purchaseOrders[0] ? (
                          <Button size="small">
                            <Link
                              to={`/purchase/orders/${encodeURIComponent(
                                data.purchaseOrders[0],
                              )}`}
                            >
                              返回订单
                            </Link>
                          </Button>
                        ) : hasOutstanding ? (
                          <Button
                            onClick={confirmRecordPayment}
                            size="small"
                            type="primary"
                          >
                            记录付款
                          </Button>
                        ) : data.purchaseReceipts[0] ? (
                          <Button size="small">
                            <Link
                              to={`/purchase/receipts/${encodeURIComponent(
                                data.purchaseReceipts[0],
                              )}`}
                            >
                              查看收货单
                            </Link>
                          </Button>
                        ) : null
                      }
                      description={paymentStatusHint(data)}
                      message={cancelled ? '这是一张历史发票' : '当前结算状态'}
                      showIcon
                      type={
                        cancelled
                          ? 'warning'
                          : hasOutstanding
                            ? 'info'
                            : 'success'
                      }
                    />
                  </ProCard>
                </Space>
              </ProCard>

              <ProCard colSpan="35%">
                <Space
                  orientation="vertical"
                  size={16}
                  style={{ width: '100%' }}
                >
                  <ProCard title="基本信息">
                    <ProDescriptions column={1} dataSource={data}>
                      <ProDescriptions.Item
                        label="供应商"
                        dataIndex="supplierName"
                      />
                      <ProDescriptions.Item label="公司" dataIndex="company" />
                      <ProDescriptions.Item
                        label="过账日期"
                        dataIndex="postingDate"
                      />
                      <ProDescriptions.Item
                        label="到期日期"
                        dataIndex="dueDate"
                      />
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

                  <ProCard title="关联单据">
                    <ProDescriptions column={1}>
                      <ProDescriptions.Item label="采购订单">
                        {docLinks(data.purchaseOrders, '/purchase/orders')}
                      </ProDescriptions.Item>
                      <ProDescriptions.Item label="采购收货单">
                        {docLinks(data.purchaseReceipts, '/purchase/receipts')}
                      </ProDescriptions.Item>
                    </ProDescriptions>
                  </ProCard>

                  <ProCard title="付款信息">
                    <ProDescriptions column={1} dataSource={data}>
                      <ProDescriptions.Item
                        label="已付金额"
                        dataIndex="paidAmount"
                        render={(_, record) =>
                          formatCurrencyValue(
                            record.paidAmount,
                            record.currency,
                          )
                        }
                      />
                      <ProDescriptions.Item
                        label="未付金额"
                        dataIndex="outstandingAmount"
                        render={(_, record) =>
                          formatCurrencyValue(
                            record.outstandingAmount,
                            record.currency,
                          )
                        }
                      />
                      <ProDescriptions.Item label="最近付款">
                        {data.latestPaymentEntry ? (
                          <Link to={paymentEntryPath(data.latestPaymentEntry)}>
                            {data.latestPaymentEntry}
                          </Link>
                        ) : (
                          '无'
                        )}
                      </ProDescriptions.Item>
                      <ProDescriptions.Item label="备注">
                        {data.remarks || '无'}
                      </ProDescriptions.Item>
                    </ProDescriptions>
                  </ProCard>

                  {!cancelled && (data.canCancel || data.latestPaymentEntry) ? (
                    <ProCard title="回退处理">
                      <Alert
                        action={
                          <Space>
                            {data.latestPaymentEntry ? (
                              <Button
                                danger
                                loading={paymentCancelLoading}
                                onClick={confirmCancelPayment}
                                size="small"
                              >
                                回退付款
                              </Button>
                            ) : null}
                            {data.canCancel ? (
                              <Button
                                danger
                                loading={cancelLoading}
                                onClick={confirmCancel}
                                size="small"
                              >
                                作废采购发票
                              </Button>
                            ) : null}
                          </Space>
                        }
                        description={
                          data.latestPaymentEntry
                            ? '这张发票已经有关联付款。若只是付款登记有误，可单独回退付款；若采购金额或开票结果有问题，应先核对付款，再作废发票。'
                            : '如需修改采购订单或重走开票流程，可以先作废当前采购发票，再回到收货或订单页面继续处理。'
                        }
                        message="发票回退前请确认付款状态"
                        showIcon
                        type="warning"
                      />
                    </ProCard>
                  ) : null}
                </Space>
              </ProCard>
            </ProCard>
          </>
        ) : null}
      </Space>
    </PageContainer>
  );
};

export default PurchaseInvoiceDetailPage;
