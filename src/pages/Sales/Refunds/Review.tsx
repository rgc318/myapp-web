import {
  PageContainer,
  ProCard,
  ProDescriptions,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { history, useLocation, useRequest } from '@umijs/max';
import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Progress,
  Skeleton,
  Space,
  Typography,
} from 'antd';
import React, { useEffect, useState } from 'react';
import { RemoteLinkSelect } from '@/components';
import { PaymentModeSelect } from '@/components/PaymentModeSelect';
import {
  type CustomerRefundResult,
  cancelSalesPaymentEntry,
  createCustomerRefund,
  getCustomerRefundContext,
  getSalesInvoiceDetail,
  type SalesInvoicePaymentEntry,
} from '@/services/myapp/sales';
import { formatCurrencyValue, StatusTag } from '@/utils/myapp-display';

type FormValues = {
  invoiceName: string;
  returnInvoiceName?: string;
};

type RefundFormValues = {
  modeOfPayment?: string;
  referenceDate?: string;
  referenceNo?: string;
  refundAmount?: number;
  remarks?: string;
};

function invoicePath(name: string) {
  return `/sales/invoices/${encodeURIComponent(name)}`;
}

function isCancelled(status: string) {
  return status === 'cancelled' || status === '已作废';
}

function refundReviewTone(data: {
  documentStatus: string;
  latestPaymentEntry: string;
  latestUnallocatedAmount: number | null;
  outstandingAmount: number | null;
  paidAmount: number | null;
  totalWriteoffAmount: number | null;
}) {
  if (isCancelled(data.documentStatus)) {
    return {
      description:
        '来源发票已经作废，通常不再从这里取消原客户收款。请回到来源订单或财务流水核对实际状态。',
      message: '来源发票已作废',
      type: 'warning' as const,
    };
  }
  if (!data.latestPaymentEntry && (data.paidAmount ?? 0) <= 0) {
    return {
      description:
        '来源发票没有可取消的原客户收款，退货后通常只需要按退货发票登记客户退款。',
      message: '暂无可取消的原收款',
      type: 'info' as const,
    };
  }
  if (data.latestPaymentEntry) {
    if ((data.latestUnallocatedAmount ?? 0) > 0) {
      return {
        description:
          '来源发票最近客户收款存在多收保留金额。退货后请优先核对该未分配金额是否应退回客户，或按财务流程转抵其他应收。',
        message: '存在多收保留金额',
        type: 'warning' as const,
      };
    }
    if ((data.totalWriteoffAmount ?? 0) > 0) {
      return {
        description:
          '来源发票包含差额核销。退货后请同时核对原客户收款和核销原因，避免重复退款或遗漏核销处理。',
        message: '存在核销结清金额',
        type: 'warning' as const,
      };
    }
    return {
      description:
        '来源发票存在客户收款。退货后通常应基于退货发票登记客户退款；只有需要撤销原收款凭证时，才取消原客户收款。',
      message: '需要核对客户退款',
      type: 'warning' as const,
    };
  }
  if ((data.outstandingAmount ?? 0) > 0) {
    return {
      description:
        '来源发票仍有未收金额。退货后优先核对应收余额是否已经正确冲减，再决定是否需要额外财务处理。',
      message: '来源发票仍未结清',
      type: 'info' as const,
    };
  }
  return {
    description:
      '当前未发现可直接取消的原客户收款。请结合退货单、来源发票和财务凭证完成线下核对。',
    message: '请完成财务核对',
    type: 'info' as const,
  };
}

const paymentEntryColumns = [
  {
    title: '收款单',
    dataIndex: 'paymentEntry',
    width: 180,
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

const refundEntryColumns = paymentEntryColumns.map((column) => {
  if (column.dataIndex === 'paymentEntry') {
    return { ...column, title: '退款单' };
  }
  if (column.dataIndex === 'postingDate') {
    return { ...column, title: '退款日期' };
  }
  if (column.dataIndex === 'modeOfPayment') {
    return { ...column, title: '退款方式' };
  }
  if (column.dataIndex === 'allocatedAmount') {
    return { ...column, title: '退款金额' };
  }
  return column;
});

function refundStatusText(status?: string) {
  if (status === 'refunded') {
    return '退款已完成';
  }
  if (status === 'partial_refunded') {
    return '部分退款';
  }
  if (status === 'not_refunded') {
    return '待退款';
  }
  return '不可退款';
}

function toPositiveAmount(value?: number | null) {
  return Math.max(Number(value ?? 0), 0);
}

const SalesRefundReviewPage: React.FC = () => {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const [form] = Form.useForm<FormValues>();
  const [refundForm] = Form.useForm<RefundFormValues>();
  const [invoiceName, setInvoiceName] = useState(
    query.get('sourceInvoice') ?? '',
  );
  const [returnInvoiceName, setReturnInvoiceName] = useState(
    query.get('returnInvoice') ?? '',
  );
  const [cancelLoading, setCancelLoading] = useState(false);
  const [refundLoading, setRefundLoading] = useState(false);
  const [lastRefundResult, setLastRefundResult] =
    useState<CustomerRefundResult | null>(null);

  const { data, error, loading, refresh } = useRequest(
    () =>
      invoiceName ? getSalesInvoiceDetail(invoiceName) : Promise.resolve(null),
    {
      formatResult: (result) => result,
      refreshDeps: [invoiceName],
    },
  );

  const {
    data: refundContext,
    error: refundContextError,
    loading: refundContextLoading,
    refresh: refreshRefundContext,
  } = useRequest(
    () =>
      returnInvoiceName
        ? getCustomerRefundContext(returnInvoiceName)
        : Promise.resolve(null),
    {
      formatResult: (result) => result,
      onSuccess: (nextContext) => {
        const suggestedAmount =
          nextContext?.refund.suggestedRefundAmount ??
          nextContext?.refund.refundableAmount ??
          0;
        if (suggestedAmount > 0 && !refundForm.getFieldValue('refundAmount')) {
          refundForm.setFieldValue('refundAmount', suggestedAmount);
        }
      },
      refreshDeps: [returnInvoiceName],
    },
  );

  useEffect(() => {
    if (invoiceName) {
      return;
    }
    const sourceInvoiceName =
      refundContext?.sourceInvoice?.name ??
      refundContext?.returnInvoice?.returnAgainst ??
      '';
    if (!sourceInvoiceName) {
      return;
    }
    setInvoiceName(sourceInvoiceName);
    form.setFieldValue('invoiceName', sourceInvoiceName);
  }, [form, invoiceName, refundContext]);

  const loadInvoice = async () => {
    const values = await form.validateFields([
      'invoiceName',
      'returnInvoiceName',
    ]);
    setInvoiceName(values.invoiceName);
    setReturnInvoiceName(values.returnInvoiceName ?? '');
    setLastRefundResult(null);
    refundForm.resetFields(['refundAmount']);
  };

  const confirmCreateRefund = async () => {
    const values = await refundForm.validateFields([
      'refundAmount',
      'modeOfPayment',
      'referenceNo',
      'referenceDate',
      'remarks',
    ]);
    const refundAmount = Number(values.refundAmount ?? 0);
    const refundableAmount = refundContext?.refund.refundableAmount ?? 0;

    if (!returnInvoiceName) {
      message.warning('请选择退货发票');
      return;
    }
    if (refundAmount <= 0) {
      message.warning('退款金额必须大于 0');
      return;
    }
    if (refundableAmount > 0 && refundAmount > refundableAmount) {
      message.warning('退款金额不能大于当前可退金额');
      return;
    }

    setRefundLoading(true);
    try {
      const result = await createCustomerRefund(
        returnInvoiceName,
        refundAmount,
        {
          modeOfPayment: values.modeOfPayment,
          referenceDate: values.referenceDate,
          referenceNo: values.referenceNo,
          remarks: values.remarks,
        },
      );
      setLastRefundResult(result.data);
      message.success(
        result.data.paymentEntry
          ? `客户退款已登记：${result.data.paymentEntry}`
          : '客户退款已登记',
      );
      refresh();
      refreshRefundContext();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '退款登记失败');
    } finally {
      setRefundLoading(false);
    }
  };

  const refundableAmount = toPositiveAmount(
    refundContext?.refund.refundableAmount,
  );
  const refundedAmount = toPositiveAmount(refundContext?.refund.refundedAmount);
  const returnAmount = toPositiveAmount(refundContext?.refund.returnAmount);
  const refundProgress =
    returnAmount > 0
      ? Math.min(Math.round((refundedAmount / returnAmount) * 100), 100)
      : 0;
  const isRefundCompleted =
    refundContext?.refund.status === 'refunded' || refundableAmount <= 0;

  const confirmCancelPayment = () => {
    if (!data?.latestPaymentEntry) {
      message.warning('当前发票没有可取消的原客户收款');
      return;
    }

    Modal.confirm({
      cancelText: '取消',
      content:
        '这会作废来源发票最近一笔原客户收款凭证。若本次已经按退货发票登记客户退款，通常不需要再取消原收款。',
      okText: '取消原客户收款',
      okType: 'danger',
      onOk: async () => {
        setCancelLoading(true);
        try {
          await cancelSalesPaymentEntry(data.latestPaymentEntry);
          refresh();
        } catch (caught) {
          message.error(caught instanceof Error ? caught.message : '操作失败');
          throw caught;
        } finally {
          setCancelLoading(false);
        }
      },
      title: `取消原客户收款 ${data.latestPaymentEntry}？`,
      width: 620,
    });
  };

  return (
    <PageContainer
      title="销售退款核对"
      extra={[
        <Button key="orders" onClick={() => history.push('/sales/orders')}>
          返回销售订单
        </Button>,
      ]}
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          message="本页用于退货后核对来源发票收款状态，并基于已提交的退货发票登记客户退款。取消原客户收款仅用于需要撤销原收款凭证的场景。"
          showIcon
          type="info"
        />

        <ProCard>
          <Form<FormValues>
            form={form}
            initialValues={{
              invoiceName,
              returnInvoiceName,
            }}
            layout="vertical"
          >
            <div
              style={{
                display: 'grid',
                gap: 16,
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              }}
            >
              <Form.Item
                label="来源销售发票"
                name="invoiceName"
                rules={[{ required: true, message: '请选择来源销售发票' }]}
              >
                <RemoteLinkSelect
                  doctype="Sales Invoice"
                  extraFields={['customer', 'company']}
                  placeholder="搜索来源销售发票"
                />
              </Form.Item>
              <Form.Item label="退货发票" name="returnInvoiceName">
                <RemoteLinkSelect
                  doctype="Sales Invoice"
                  extraFields={['customer', 'company']}
                  placeholder="可选，选择退货发票"
                />
              </Form.Item>
            </div>
            <Space>
              <Button
                loading={loading}
                onClick={() => void loadInvoice()}
                type="primary"
              >
                读取发票
              </Button>
              {invoiceName ? (
                <Button onClick={() => history.push(invoicePath(invoiceName))}>
                  查看来源发票
                </Button>
              ) : null}
              {returnInvoiceName ? (
                <Button
                  onClick={() => history.push(invoicePath(returnInvoiceName))}
                >
                  查看退货发票
                </Button>
              ) : null}
            </Space>
          </Form>
        </ProCard>

        {error ? (
          <Alert
            action={
              <Button size="small" onClick={refresh}>
                重试
              </Button>
            }
            description={
              error instanceof Error ? error.message : '请稍后重试。'
            }
            message="销售发票加载失败"
            showIcon
            type="error"
          />
        ) : null}

        {refundContextError ? (
          <Alert
            action={
              <Button size="small" onClick={refreshRefundContext}>
                重试
              </Button>
            }
            description={
              refundContextError instanceof Error
                ? refundContextError.message
                : '请稍后重试。'
            }
            message="退款上下文加载失败"
            showIcon
            type="error"
          />
        ) : null}

        {loading && invoiceName ? (
          <ProCard>
            <Skeleton active paragraph={{ rows: 6 }} />
          </ProCard>
        ) : null}

        {!loading && invoiceName && !data && !error ? (
          <ProCard>
            <Empty description="未找到销售发票" />
          </ProCard>
        ) : null}

        {data ? (
          <>
            <StatisticCard.Group direction="row">
              <StatisticCard
                statistic={{
                  title: '应收金额',
                  value: formatCurrencyValue(
                    data.receivableAmount,
                    data.currency,
                  ),
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
              {(data.latestUnallocatedAmount ?? 0) > 0 ? (
                <StatisticCard
                  statistic={{
                    title: '最近多收保留',
                    value: formatCurrencyValue(
                      data.latestUnallocatedAmount,
                      data.currency,
                    ),
                  }}
                />
              ) : null}
              <StatisticCard
                statistic={{
                  title: '当前未收',
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
                  <ProCard
                    extra={
                      returnInvoiceName ? (
                        <Button
                          onClick={() =>
                            history.push(invoicePath(returnInvoiceName))
                          }
                        >
                          查看退货发票
                        </Button>
                      ) : null
                    }
                    title="登记客户退款"
                  >
                    {returnInvoiceName ? (
                      <Form<RefundFormValues>
                        form={refundForm}
                        initialValues={{
                          referenceDate: new Date().toISOString().slice(0, 10),
                        }}
                        layout="vertical"
                      >
                        <Space
                          orientation="vertical"
                          size={16}
                          style={{ width: '100%' }}
                        >
                          {lastRefundResult ? (
                            <Alert
                              action={
                                lastRefundResult.paymentEntry ? (
                                  <Button
                                    size="small"
                                    onClick={() =>
                                      history.push(
                                        `/payments/${encodeURIComponent(lastRefundResult.paymentEntry)}`,
                                      )
                                    }
                                  >
                                    查看收付款流水
                                  </Button>
                                ) : undefined
                              }
                              description={
                                lastRefundResult.paymentEntry
                                  ? `本次退款单 ${lastRefundResult.paymentEntry} 已创建，退款金额 ${formatCurrencyValue(
                                      lastRefundResult.refundAmount,
                                      refundContext?.refund.currency ??
                                        data.currency,
                                    )}。`
                                  : '本次客户退款已登记。'
                              }
                              message="本次退款登记成功"
                              showIcon
                              type="success"
                            />
                          ) : null}
                          <StatisticCard.Group direction="row">
                            <StatisticCard
                              statistic={{
                                title: '退货发票金额',
                                value: formatCurrencyValue(
                                  refundContext?.refund.returnAmount,
                                  refundContext?.refund.currency ??
                                    data.currency,
                                ),
                              }}
                            />
                            <StatisticCard
                              statistic={{
                                title: '已退金额',
                                value: formatCurrencyValue(
                                  refundContext?.refund.refundedAmount,
                                  refundContext?.refund.currency ??
                                    data.currency,
                                ),
                              }}
                            />
                            <StatisticCard
                              statistic={{
                                title: '当前可退金额',
                                value: formatCurrencyValue(
                                  refundContext?.refund.refundableAmount,
                                  refundContext?.refund.currency ??
                                    data.currency,
                                ),
                              }}
                            />
                            <StatisticCard
                              statistic={{
                                title: '退货发票状态',
                                value: refundStatusText(
                                  refundContext?.refund.status,
                                ),
                              }}
                            />
                          </StatisticCard.Group>
                          <ProCard
                            size="small"
                            title="退款进度"
                            bodyStyle={{ paddingBlock: 16 }}
                          >
                            <Progress
                              percent={refundProgress}
                              status={isRefundCompleted ? 'success' : 'active'}
                            />
                            <Typography.Text type="secondary">
                              已退{' '}
                              {formatCurrencyValue(
                                refundedAmount,
                                refundContext?.refund.currency ?? data.currency,
                              )}
                              ，剩余可退{' '}
                              {formatCurrencyValue(
                                refundableAmount,
                                refundContext?.refund.currency ?? data.currency,
                              )}
                            </Typography.Text>
                          </ProCard>
                          {isRefundCompleted ? (
                            <Alert
                              message="退款已完成"
                              description="当前退货发票没有剩余可退金额，不能继续登记客户退款。"
                              showIcon
                              type="success"
                            />
                          ) : null}
                          <div
                            style={{
                              display: 'grid',
                              gap: 16,
                              gridTemplateColumns:
                                'repeat(auto-fit, minmax(220px, 1fr))',
                            }}
                          >
                            <Form.Item
                              label="退款金额"
                              name="refundAmount"
                              rules={[
                                { required: true, message: '请输入退款金额' },
                                {
                                  validator: (_, value) => {
                                    const nextValue = Number(value ?? 0);
                                    if (nextValue <= 0) {
                                      return Promise.reject(
                                        new Error('退款金额必须大于 0'),
                                      );
                                    }
                                    if (
                                      refundableAmount > 0 &&
                                      nextValue > refundableAmount
                                    ) {
                                      return Promise.reject(
                                        new Error(
                                          '退款金额不能大于当前可退金额',
                                        ),
                                      );
                                    }
                                    return Promise.resolve();
                                  },
                                },
                              ]}
                            >
                              <InputNumber
                                min={0}
                                precision={2}
                                style={{ width: '100%' }}
                              />
                            </Form.Item>
                            <Form.Item label="退款方式" name="modeOfPayment">
                              <PaymentModeSelect
                                onChange={(value) =>
                                  refundForm.setFieldValue(
                                    'modeOfPayment',
                                    value,
                                  )
                                }
                              />
                            </Form.Item>
                            <Form.Item label="参考号" name="referenceNo">
                              <Input placeholder="银行流水号或退款凭证号" />
                            </Form.Item>
                            <Form.Item
                              label="参考日期"
                              name="referenceDate"
                              rules={[
                                {
                                  pattern: /^\d{4}-\d{2}-\d{2}$/,
                                  message: '日期格式应为 YYYY-MM-DD',
                                },
                              ]}
                            >
                              <Input placeholder="YYYY-MM-DD" />
                            </Form.Item>
                            <Form.Item label="备注" name="remarks">
                              <Input.TextArea
                                autoSize={{ minRows: 1, maxRows: 3 }}
                                placeholder="填写退款原因或凭证说明"
                              />
                            </Form.Item>
                          </div>
                          <Alert
                            message={
                              refundContext?.actions.createRefundHint ||
                              '退款登记会创建正式 Payment Entry，并核销当前退货发票的可退余额。'
                            }
                            showIcon
                            type={
                              refundContext?.actions.canCreateRefund
                                ? 'success'
                                : 'warning'
                            }
                          />
                          <Button
                            disabled={
                              refundContextLoading ||
                              isRefundCompleted ||
                              !refundContext?.actions.canCreateRefund
                            }
                            loading={refundLoading}
                            onClick={() => void confirmCreateRefund()}
                            type="primary"
                          >
                            登记客户退款
                          </Button>
                          <ProTable<SalesInvoicePaymentEntry>
                            columns={refundEntryColumns}
                            dataSource={refundContext?.entries ?? []}
                            headerTitle="客户退款历史"
                            pagination={false}
                            rowKey="paymentEntry"
                            scroll={{ x: 1050 }}
                            search={false}
                            toolBarRender={false}
                          />
                        </Space>
                      </Form>
                    ) : (
                      <Empty description="请选择退货发票后登记客户退款" />
                    )}
                  </ProCard>

                  <ProTable<SalesInvoicePaymentEntry>
                    columns={paymentEntryColumns}
                    dataSource={data.paymentEntries}
                    headerTitle="来源发票收款历史"
                    pagination={false}
                    rowKey="paymentEntry"
                    scroll={{ x: 1050 }}
                    search={false}
                    toolBarRender={false}
                  />
                </Space>
              </ProCard>

              <ProCard colSpan="35%">
                <Space
                  orientation="vertical"
                  size={16}
                  style={{ width: '100%' }}
                >
                  <ProCard title="处理建议">
                    <Alert
                      description={refundReviewTone(data).description}
                      message={refundReviewTone(data).message}
                      showIcon
                      type={refundReviewTone(data).type}
                    />
                  </ProCard>

                  <ProCard title="退款单据关系">
                    <ProDescriptions
                      column={1}
                      dataSource={{
                        returnInvoice:
                          refundContext?.returnInvoice?.name ??
                          returnInvoiceName,
                        sourceInvoice:
                          refundContext?.sourceInvoice?.name ??
                          refundContext?.returnInvoice?.returnAgainst ??
                          invoiceName,
                        customer:
                          refundContext?.returnInvoice?.customerName ??
                          data.contactDisplay,
                        company:
                          refundContext?.returnInvoice?.company ?? data.company,
                      }}
                    >
                      <ProDescriptions.Item
                        label="退货发票"
                        dataIndex="returnInvoice"
                      />
                      <ProDescriptions.Item
                        label="来源发票"
                        dataIndex="sourceInvoice"
                      />
                      <ProDescriptions.Item label="客户" dataIndex="customer" />
                      <ProDescriptions.Item label="公司" dataIndex="company" />
                    </ProDescriptions>
                  </ProCard>

                  <ProCard title="来源发票核对">
                    <ProDescriptions column={1} dataSource={data}>
                      <ProDescriptions.Item label="销售发票" dataIndex="name" />
                      <ProDescriptions.Item label="公司" dataIndex="company" />
                      <ProDescriptions.Item label="单据状态">
                        <StatusTag value={data.documentStatus} />
                      </ProDescriptions.Item>
                      <ProDescriptions.Item label="收款状态">
                        <StatusTag value={data.paymentStatus} />
                      </ProDescriptions.Item>
                      <ProDescriptions.Item
                        label="最近客户收款"
                        dataIndex="latestPaymentEntry"
                      />
                      <ProDescriptions.Item
                        label="客户"
                        dataIndex="contactDisplay"
                      />
                      <ProDescriptions.Item
                        label="收货地址"
                        dataIndex="addressDisplay"
                      />
                    </ProDescriptions>
                  </ProCard>

                  <ProCard title="原收款处理">
                    <Space
                      orientation="vertical"
                      size={12}
                      style={{ width: '100%' }}
                    >
                      <Typography.Text type="secondary">
                        已登记客户退款后，通常不再取消原收款。只有需要撤销来源发票的原收款凭证时，才使用下面的操作。
                      </Typography.Text>
                      <Button
                        danger
                        disabled={
                          !data.latestPaymentEntry ||
                          isCancelled(data.documentStatus) ||
                          isRefundCompleted
                        }
                        loading={cancelLoading}
                        onClick={confirmCancelPayment}
                      >
                        取消原客户收款
                      </Button>
                    </Space>
                  </ProCard>
                </Space>
              </ProCard>
            </ProCard>
          </>
        ) : null}
      </Space>
    </PageContainer>
  );
};

export default SalesRefundReviewPage;
