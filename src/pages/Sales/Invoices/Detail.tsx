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
  Modal,
  message,
  Progress,
  Skeleton,
  Space,
} from 'antd';
import React, { useState } from 'react';
import { PrintDocumentButton } from '@/components/PrintDocumentButton';
import {
  cancelSalesInvoice,
  cancelSalesPaymentEntry,
  getSalesInvoiceDetail,
  type SalesInvoicePaymentEntry,
  type SalesOrderDetailItem,
} from '@/services/myapp/sales';
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
  latestUnallocatedAmount: number | null;
  outstandingAmount: number | null;
  totalWriteoffAmount: number | null;
}) {
  if (isCancelled(data.documentStatus)) {
    return '当前发票已经作废，仅作为历史单据查看。后续业务处理应返回仍然有效的订单或发货单。';
  }
  if ((data.outstandingAmount ?? 0) > 0) {
    return '当前发票仍有未收金额，可继续登记收款；如果需要回改单据，请先确认是否要同步回退收款登记。';
  }
  if ((data.totalWriteoffAmount ?? 0) > 0) {
    return '当前发票已通过差额核销结清。若需要回退开票结果，应先核对核销原因和关联收款，再处理发票作废。';
  }
  if ((data.latestUnallocatedAmount ?? 0) > 0) {
    return '当前发票已结清，最近一次收款存在多收保留金额。后续退款或转抵其他应收需要按财务流程单独核对。';
  }
  if (data.latestPaymentEntry) {
    return '当前发票已经结清。若需要回退开票结果，应先确认是否要回退关联收款，再作废发票。';
  }
  return '当前发票没有未收金额，可继续打印留档或返回来源单据核对业务链路。';
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
    render: (_: unknown, record: SalesOrderDetailItem) =>
      resolveDisplayUom(record.uom, record.uomDisplay),
  },
  {
    title: '单价',
    dataIndex: 'rate',
    align: 'right' as const,
    width: 120,
    render: (_: unknown, record: SalesOrderDetailItem) =>
      formatCurrencyValue(record.rate),
  },
  {
    title: '金额',
    dataIndex: 'amount',
    align: 'right' as const,
    width: 120,
    render: (_: unknown, record: SalesOrderDetailItem) =>
      formatCurrencyValue(record.amount),
  },
  {
    title: '仓库',
    dataIndex: 'warehouse',
    ellipsis: true,
    width: 180,
  },
];

const paymentEntryColumns = [
  {
    title: '收款单',
    dataIndex: 'paymentEntry',
    width: 180,
    render: (_: unknown, record: SalesInvoicePaymentEntry) =>
      record.paymentEntry ? (
        <Link to={paymentEntryPath(record.paymentEntry)}>
          {record.paymentEntry}
        </Link>
      ) : (
        '-'
      ),
  },
  {
    title: '收款日期',
    dataIndex: 'postingDate',
    width: 110,
  },
  {
    title: '付款方式',
    dataIndex: 'modeOfPayment',
    width: 120,
    render: (_: unknown, record: SalesInvoicePaymentEntry) =>
      record.modeOfPayment || '-',
  },
  {
    title: '核销金额',
    dataIndex: 'allocatedAmount',
    align: 'right' as const,
    width: 120,
    render: (_: unknown, record: SalesInvoicePaymentEntry) =>
      formatCurrencyValue(record.allocatedAmount),
  },
  {
    title: '实收金额',
    dataIndex: 'actualPaidAmount',
    align: 'right' as const,
    width: 120,
    render: (_: unknown, record: SalesInvoicePaymentEntry) =>
      formatCurrencyValue(record.actualPaidAmount),
  },
  {
    title: '差额核销',
    dataIndex: 'writeoffAmount',
    align: 'right' as const,
    width: 120,
    render: (_: unknown, record: SalesInvoicePaymentEntry) =>
      formatCurrencyValue(record.writeoffAmount),
  },
  {
    title: '多收保留',
    dataIndex: 'latestUnallocatedAmount',
    align: 'right' as const,
    width: 120,
    render: (_: unknown, record: SalesInvoicePaymentEntry) =>
      formatCurrencyValue(record.latestUnallocatedAmount),
  },
  {
    title: '参考号',
    dataIndex: 'referenceNo',
    ellipsis: true,
    width: 160,
    render: (_: unknown, record: SalesInvoicePaymentEntry) =>
      record.referenceNo || '-',
  },
];

const SalesInvoiceDetailPage: React.FC = () => {
  const params = useParams();
  const invoiceName = decodeURIComponent(String(params.name ?? ''));
  const [cancelLoading, setCancelLoading] = useState(false);
  const [paymentCancelLoading, setPaymentCancelLoading] = useState(false);
  const { data, error, loading, refresh } = useRequest(
    () => getSalesInvoiceDetail(invoiceName),
    {
      formatResult: (result) => result,
      refreshDeps: [invoiceName],
    },
  );
  const cancelled = data ? isCancelled(data.documentStatus) : false;
  const sourceOrder = data?.salesOrders[0] ?? '';
  const linkedDeliveryNote = data?.deliveryNotes[0] ?? '';
  const hasOutstanding = (data?.outstandingAmount ?? 0) > 0;

  const confirmCancel = () => {
    if (!data) {
      return;
    }
    Modal.confirm({
      cancelText: '取消',
      content: (
        <Alert
          description={
            data.latestPaymentEntry
              ? `当前发票已关联收款单 ${data.latestPaymentEntry}。为避免出现发票已作废但收款仍挂在结算链路中的状态，本次会先回退最近收款，再作废销售发票。`
              : data.cancelSalesInvoiceHint ||
                '作废后，这张发票将从订单结算链路中移除。如需重新开票，请回到来源订单或发货链路继续处理。'
          }
          title="作废销售发票会影响结算链路"
          showIcon
          type="warning"
        />
      ),
      okText: data.latestPaymentEntry ? '回退收款并作废发票' : '确认作废',
      okType: 'danger',
      onOk: async () => {
        setCancelLoading(true);
        try {
          if (data.latestPaymentEntry) {
            await cancelSalesPaymentEntry(data.latestPaymentEntry);
          }
          await cancelSalesInvoice(invoiceName);
          refresh();
        } catch (caught) {
          message.error(caught instanceof Error ? caught.message : '操作失败');
          throw caught;
        } finally {
          setCancelLoading(false);
        }
      },
      title: data.latestPaymentEntry
        ? '先回退收款，再作废销售发票？'
        : '作废销售发票？',
      width: 560,
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
          await cancelSalesPaymentEntry(data.latestPaymentEntry);
          refresh();
        } catch (caught) {
          message.error(caught instanceof Error ? caught.message : '操作失败');
          throw caught;
        } finally {
          setPaymentCancelLoading(false);
        }
      },
      title: `取消收款 ${data.latestPaymentEntry}？`,
    });
  };

  return (
    <PageContainer
      title={invoiceName || '销售发票详情'}
      extra={[
        <Button key="back">
          <Link to="/sales/orders">返回销售订单</Link>
        </Button>,
        <Button key="refresh" loading={loading} onClick={refresh}>
          刷新
        </Button>,
        <PrintDocumentButton
          disabled={!invoiceName}
          docname={invoiceName}
          doctype="Sales Invoice"
          key="print"
        />,
        sourceOrder && hasOutstanding && !cancelled ? (
          <Button key="payment" type="primary">
            <Link
              to={`/sales/orders/${encodeURIComponent(sourceOrder)}?action=payment`}
            >
              前往收款
            </Link>
          </Button>
        ) : null,
        <Button key="return">
          <Link
            to={`/sales/returns/new?sourceDoctype=${encodeURIComponent('Sales Invoice')}&sourceName=${encodeURIComponent(invoiceName)}`}
          >
            创建退货
          </Link>
        </Button>,
        <Button
          danger
          disabled={!data?.canCancelSalesInvoice}
          key="cancel"
          loading={cancelLoading}
          onClick={confirmCancel}
        >
          取消销售发票
        </Button>,
        <Button
          danger
          disabled={!data?.latestPaymentEntry}
          key="cancel-payment"
          loading={paymentCancelLoading}
          onClick={confirmCancelPayment}
        >
          取消最近收款
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
            title="销售发票详情加载失败"
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
            <Empty description="未找到销售发票" />
          </ProCard>
        ) : null}

        {data ? (
          <>
            <StatisticCard.Group direction="row">
              <StatisticCard
                statistic={{
                  title: '发票金额',
                  value: formatCurrencyValue(data.grandTotal, data.currency),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '实收金额',
                  value: formatCurrencyValue(
                    data.actualPaidAmount ?? data.paidAmount,
                    data.currency,
                  ),
                }}
              />
              <StatisticCard
                chart={
                  <Progress
                    percent={toPercent(
                      data.actualPaidAmount ?? data.paidAmount,
                      data.receivableAmount || data.grandTotal,
                    )}
                    size="small"
                    status={hasOutstanding ? 'active' : 'success'}
                  />
                }
                statistic={{
                  title: '收款进度',
                  value: `${toPercent(
                    data.actualPaidAmount ?? data.paidAmount,
                    data.receivableAmount || data.grandTotal,
                  )}%`,
                }}
              />
              {(data.totalWriteoffAmount ?? 0) > 0 ? (
                <StatisticCard
                  statistic={{
                    title: '核销金额',
                    value: formatCurrencyValue(
                      data.totalWriteoffAmount,
                      data.currency,
                    ),
                  }}
                />
              ) : null}
              <StatisticCard
                statistic={{
                  title: '未收金额',
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
                  <ProTable<SalesInvoicePaymentEntry>
                    columns={paymentEntryColumns}
                    dataSource={data.paymentEntries}
                    headerTitle="收款历史"
                    pagination={false}
                    rowKey="paymentEntry"
                    scroll={{ x: 1050 }}
                    search={false}
                    toolBarRender={false}
                  />

                  <ProTable<SalesOrderDetailItem>
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
                        cancelled ? (
                          sourceOrder ? (
                            <Button size="small">
                              <Link
                                to={`/sales/orders/${encodeURIComponent(sourceOrder)}`}
                              >
                                返回订单
                              </Link>
                            </Button>
                          ) : null
                        ) : hasOutstanding && sourceOrder ? (
                          <Button size="small" type="primary">
                            <Link
                              to={`/sales/orders/${encodeURIComponent(
                                sourceOrder,
                              )}?action=payment`}
                            >
                              前往收款
                            </Link>
                          </Button>
                        ) : linkedDeliveryNote ? (
                          <Button size="small">
                            <Link
                              to={`/sales/delivery-notes/${encodeURIComponent(
                                linkedDeliveryNote,
                              )}`}
                            >
                              查看发货单
                            </Link>
                          </Button>
                        ) : null
                      }
                      description={paymentStatusHint(data)}
                      title={cancelled ? '这是一张历史发票' : '当前结算状态'}
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
                      <ProDescriptions.Item label="收款状态">
                        <StatusTag value={data.paymentStatus} />
                      </ProDescriptions.Item>
                      <ProDescriptions.Item label="可取消">
                        {data.canCancelSalesInvoice ? '是' : '否'}
                      </ProDescriptions.Item>
                    </ProDescriptions>
                  </ProCard>

                  <ProCard title="关联单据">
                    <ProDescriptions column={1}>
                      <ProDescriptions.Item label="销售订单">
                        {docLinks(data.salesOrders, '/sales/orders')}
                      </ProDescriptions.Item>
                      <ProDescriptions.Item label="发货单">
                        {docLinks(data.deliveryNotes, '/sales/delivery-notes')}
                      </ProDescriptions.Item>
                    </ProDescriptions>
                  </ProCard>

                  <ProCard title="收款信息">
                    <ProDescriptions column={1} dataSource={data}>
                      <ProDescriptions.Item
                        label="应收金额"
                        dataIndex="receivableAmount"
                        render={(_, record) =>
                          formatCurrencyValue(
                            record.receivableAmount,
                            record.currency,
                          )
                        }
                      />
                      <ProDescriptions.Item
                        label="实收金额"
                        dataIndex="actualPaidAmount"
                        render={(_, record) =>
                          formatCurrencyValue(
                            record.actualPaidAmount ?? record.paidAmount,
                            record.currency,
                          )
                        }
                      />
                      <ProDescriptions.Item
                        label="核销金额"
                        dataIndex="totalWriteoffAmount"
                        render={(_, record) =>
                          formatCurrencyValue(
                            record.totalWriteoffAmount,
                            record.currency,
                          )
                        }
                      />
                      <ProDescriptions.Item
                        label="最近多收保留"
                        dataIndex="latestUnallocatedAmount"
                        render={(_, record) =>
                          formatCurrencyValue(
                            record.latestUnallocatedAmount,
                            record.currency,
                          )
                        }
                      />
                      <ProDescriptions.Item label="最近收款">
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

                  {!cancelled &&
                  (data.canCancelSalesInvoice ||
                    data.cancelSalesInvoiceHint ||
                    data.latestPaymentEntry) ? (
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
                                回退收款
                              </Button>
                            ) : null}
                            {data.canCancelSalesInvoice ? (
                              <Button
                                danger
                                loading={cancelLoading}
                                onClick={confirmCancel}
                                size="small"
                              >
                                {data.latestPaymentEntry
                                  ? '回退收款并作废发票'
                                  : '作废销售发票'}
                              </Button>
                            ) : null}
                          </Space>
                        }
                        description={
                          data.latestPaymentEntry
                            ? '这张发票已经有关联收款。若只是收款登记有误，可单独回退收款；若订单金额或开票结果有问题，应先回退收款，再作废发票。'
                            : data.cancelSalesInvoiceHint ||
                              '如需修改订单或重走开票流程，可以先作废当前销售发票，再回到发货或订单页面继续处理。'
                        }
                        title="发票回退前请确认收款状态"
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

export default SalesInvoiceDetailPage;
