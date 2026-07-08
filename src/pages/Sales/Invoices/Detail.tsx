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
  Descriptions,
  Empty,
  Modal,
  message,
  Progress,
  Skeleton,
  Space,
} from 'antd';
import React, { useEffect, useState } from 'react';
import { buildInvoiceItemColumns } from '@/components/BusinessOrderDetail';
import {
  buildPaymentActionColumn,
  buildPaymentEntryColumns,
} from '@/components/BusinessPaymentTables';
import {
  InvoicePaymentForm,
  useInvoicePaymentModal,
} from '@/components/InvoicePaymentForm';
import { PrintDocumentButton } from '@/components/PrintDocumentButton';
import { SALES_RETURN_REFUND_ENTRY_ENABLED } from '@/config/feature-flags';
import {
  cancelSalesInvoice,
  cancelSalesPaymentEntry,
  getSalesInvoiceDetail,
  recordSalesOrderPayment,
  type SalesInvoicePaymentEntry,
  type SalesOrderDetailItem,
} from '@/services/myapp/sales';
import { paymentEntryPath } from '@/utils/business-document';
import {
  formatCurrencyCode,
  formatCurrencyValue,
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

function getErrorMessage(error: unknown, fallback = '操作失败') {
  return error instanceof Error ? error.message : fallback;
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
  canRecordPayment: boolean;
  documentStatus: string;
  latestPaymentEntry: string;
  latestUnallocatedAmount: number | null;
  outstandingAmount: number | null;
  recordPaymentHint: string;
  totalWriteoffAmount: number | null;
}) {
  if (isCancelled(data.documentStatus)) {
    return '当前发票已经作废，仅作为历史单据查看。后续业务处理应返回仍然有效的订单或发货单。';
  }
  if (!data.canRecordPayment && data.recordPaymentHint) {
    return data.recordPaymentHint;
  }
  if ((data.outstandingAmount ?? 0) > 0) {
    return '当前发票仍有未收金额，可继续登记客户收款；如果需要回改单据，请先确认是否要同步取消原客户收款。';
  }
  if ((data.totalWriteoffAmount ?? 0) > 0) {
    return '当前发票已通过差额核销结清。若需要回退开票结果，应先核对核销原因和关联客户收款，再处理发票作废。';
  }
  if ((data.latestUnallocatedAmount ?? 0) > 0) {
    return '当前发票已结清，最近一次客户收款存在多收保留金额。后续退款或转抵其他应收需要按财务流程单独核对。';
  }
  if (data.latestPaymentEntry) {
    return '当前发票已经结清。若需要回退开票结果，应先确认是否要取消关联客户收款，再作废发票。';
  }
  return '当前发票没有未收金额，可继续打印留档或返回来源单据核对业务链路。';
}

const itemColumns = buildInvoiceItemColumns<SalesOrderDetailItem>();

const paymentEntryColumns = buildPaymentEntryColumns<SalesInvoicePaymentEntry>({
  actualAmountKey: 'actualPaidAmount',
  actualAmountTitle: '实收金额',
  dateKey: 'postingDate',
  dateTitle: '收款日期',
  entryTitle: '收款单',
  extraColumns: [
    {
      title: '差额核销',
      dataIndex: 'writeoffAmount',
      align: 'right',
      width: 120,
      render: (_, record) => formatCurrencyValue(record.writeoffAmount),
    },
    {
      title: '多收保留',
      dataIndex: 'latestUnallocatedAmount',
      align: 'right',
      width: 120,
      render: (_, record) =>
        formatCurrencyValue(record.latestUnallocatedAmount),
    },
    {
      title: '参考号',
      dataIndex: 'referenceNo',
      ellipsis: true,
      width: 160,
      render: (_, record) => record.referenceNo || '-',
    },
  ],
});

const SalesInvoiceDetailPage: React.FC = () => {
  const params = useParams();
  const invoiceName = decodeURIComponent(String(params.name ?? ''));
  const [cancelLoading, setCancelLoading] = useState(false);
  const paymentModal = useInvoicePaymentModal({ referenceName: invoiceName });
  const [paymentCancelLoading, setPaymentCancelLoading] = useState(false);
  const [paymentSelectionOpen, setPaymentSelectionOpen] = useState(false);
  const [paymentToCancel, setPaymentToCancel] =
    useState<SalesInvoicePaymentEntry | null>(null);
  const [voidInvoiceModalOpen, setVoidInvoiceModalOpen] = useState(false);
  const [voidPaymentConfirmOpen, setVoidPaymentConfirmOpen] = useState(false);
  const [cancelledPaymentEntries, setCancelledPaymentEntries] = useState<
    Set<string>
  >(new Set());
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
  const canRecordPayment = Boolean(data?.canRecordPayment);
  const hasReturnInvoices = Boolean(data?.returnInvoices.length);
  const shouldTreatPaymentsAsException =
    Boolean(data) && !canRecordPayment && hasReturnInvoices;
  const activePaymentEntries = (data?.paymentEntries ?? []).filter(
    (entry) =>
      entry.paymentEntry && !cancelledPaymentEntries.has(entry.paymentEntry),
  );

  useEffect(() => {
    setCancelledPaymentEntries(new Set());
  }, [invoiceName]);

  const openCancelPayment = (entry: SalesInvoicePaymentEntry | null) => {
    if (!entry?.paymentEntry) {
      message.warning('当前发票没有可取消的客户收款');
      return;
    }
    setPaymentSelectionOpen(false);
    setPaymentToCancel(entry);
  };

  const confirmCancel = () => {
    if (!data) {
      return;
    }
    setVoidInvoiceModalOpen(true);
  };

  const submitVoidInvoice = async (options?: {
    cancelSinglePayment?: boolean;
  }) => {
    if (!data) {
      return;
    }

    if (activePaymentEntries.length > 1) {
      message.warning('请先逐笔取消客户收款，再作废销售发票');
      return;
    }

    const paymentEntryToCancel = activePaymentEntries[0];
    if (paymentEntryToCancel && !options?.cancelSinglePayment) {
      setVoidPaymentConfirmOpen(true);
      return;
    }

    setCancelLoading(true);
    try {
      if (paymentEntryToCancel) {
        await cancelSalesPaymentEntry(paymentEntryToCancel.paymentEntry);
        setCancelledPaymentEntries((current) => {
          const next = new Set(current);
          next.add(paymentEntryToCancel.paymentEntry);
          return next;
        });
      }
      await cancelSalesInvoice(invoiceName);
      message.success(
        paymentEntryToCancel
          ? `已取消客户收款 ${paymentEntryToCancel.paymentEntry}，并作废销售发票 ${invoiceName}`
          : `销售发票 ${invoiceName} 已作废`,
      );
      setVoidPaymentConfirmOpen(false);
      setVoidInvoiceModalOpen(false);
      refresh();
    } catch (caught) {
      message.error(getErrorMessage(caught));
      throw caught;
    } finally {
      setCancelLoading(false);
    }
  };

  const submitCancelPayment = async () => {
    if (!paymentToCancel?.paymentEntry) {
      return;
    }
    setPaymentCancelLoading(true);
    try {
      await cancelSalesPaymentEntry(paymentToCancel.paymentEntry);
      message.success(
        `${shouldTreatPaymentsAsException ? '已清理异常客户收款' : '已取消客户收款'} ${paymentToCancel.paymentEntry}，金额 ${formatCurrencyValue(
          paymentToCancel.allocatedAmount ?? paymentToCancel.actualPaidAmount,
          data?.currency,
        )}`,
      );
      setCancelledPaymentEntries((current) => {
        const next = new Set(current);
        next.add(paymentToCancel.paymentEntry);
        return next;
      });
      setPaymentToCancel(null);
      refresh();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '操作失败');
      throw caught;
    } finally {
      setPaymentCancelLoading(false);
    }
  };

  const paymentColumns = [
    ...paymentEntryColumns,
    buildPaymentActionColumn<SalesInvoicePaymentEntry>({
      cancelText: shouldTreatPaymentsAsException
        ? '清理这笔异常收款'
        : '取消这笔收款',
      disabled: cancelled,
      onCancelPayment: openCancelPayment,
      width: 150,
    }),
  ];

  const confirmRecordPayment = () => {
    if (!data || cancelled || !hasOutstanding || !canRecordPayment) {
      message.warning(
        data?.recordPaymentHint || '当前发票没有可登记的未收金额',
      );
      return;
    }

    paymentModal.openWithDraft({
      amount: data.outstandingAmount ?? 0,
      referenceName: invoiceName,
    });
  };

  const submitRecordPayment = async () => {
    const paymentAmount = Number(paymentModal.draft.amount ?? 0);
    if (paymentAmount <= 0) {
      message.error('收款金额必须大于 0');
      throw new Error('Invalid payment amount');
    }

    await paymentModal
      .runSubmit(async (paymentDraft) => {
        await recordSalesOrderPayment(invoiceName, paymentAmount, {
          modeOfPayment: paymentDraft.modeOfPayment,
          referenceDate: paymentDraft.referenceDate,
          referenceDoctype: 'Sales Invoice',
          referenceNo: paymentDraft.referenceNo,
          settlementMode:
            paymentDraft.settlementMode === 'writeoff' ? 'writeoff' : 'partial',
          writeoffReason:
            paymentDraft.settlementMode === 'writeoff'
              ? 'Web 端差额核销结清'
              : undefined,
        });
        refresh();
      })
      .catch((caught) => {
        message.error(caught instanceof Error ? caught.message : '操作失败');
        throw caught;
      });
  };

  return (
    <>
      <PageContainer
        title={invoiceName || '销售发票详情'}
        extra={[
          <Button key="back">
            <Link
              to={
                sourceOrder
                  ? `/sales/orders/${encodeURIComponent(sourceOrder)}`
                  : '/sales/orders'
              }
            >
              返回销售订单
            </Link>
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
          hasOutstanding && canRecordPayment && !cancelled ? (
            <Button
              key="payment"
              loading={paymentModal.loading}
              onClick={confirmRecordPayment}
              type="primary"
            >
              登记客户收款
            </Button>
          ) : null,
          SALES_RETURN_REFUND_ENTRY_ENABLED ? (
            <Button key="return">
              <Link
                to={`/sales/returns/new?sourceDoctype=Sales%20Invoice&sourceName=${encodeURIComponent(invoiceName)}`}
              >
                创建退货
              </Link>
            </Button>
          ) : null,
          <Button
            danger
            disabled={!data?.canCancelSalesInvoice}
            key="cancel"
            loading={cancelLoading}
            onClick={confirmCancel}
          >
            作废销售发票
          </Button>,
          <Button
            danger
            disabled={!activePaymentEntries.length}
            key="cancel-payment"
            loading={paymentCancelLoading}
            onClick={() => setPaymentSelectionOpen(true)}
          >
            {shouldTreatPaymentsAsException
              ? '选择清理异常收款'
              : '选择取消客户收款'}
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
                      columns={paymentColumns}
                      dataSource={data.paymentEntries}
                      headerTitle="收款历史"
                      pagination={false}
                      rowKey="paymentEntry"
                      scroll={{ x: 1210 }}
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
                          ) : hasOutstanding ? (
                            <Button
                              disabled={!canRecordPayment}
                              loading={paymentModal.loading}
                              onClick={confirmRecordPayment}
                              size="small"
                              type="primary"
                            >
                              登记客户收款
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
                            : hasOutstanding && canRecordPayment
                              ? 'info'
                              : data.canRecordPayment
                                ? 'success'
                                : 'warning'
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
                          label="公司"
                          dataIndex="company"
                        />
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
                        <ProDescriptions.Item label="可登记收款">
                          {data.canRecordPayment ? '是' : '否'}
                        </ProDescriptions.Item>
                        {!data.canRecordPayment && data.recordPaymentHint ? (
                          <ProDescriptions.Item label="收款限制">
                            {data.recordPaymentHint}
                          </ProDescriptions.Item>
                        ) : null}
                      </ProDescriptions>
                    </ProCard>

                    <ProCard title="关联单据">
                      <ProDescriptions column={1}>
                        <ProDescriptions.Item label="销售订单">
                          {docLinks(data.salesOrders, '/sales/orders')}
                        </ProDescriptions.Item>
                        <ProDescriptions.Item label="发货单">
                          {docLinks(
                            data.deliveryNotes,
                            '/sales/delivery-notes',
                          )}
                        </ProDescriptions.Item>
                        <ProDescriptions.Item label="退货发票">
                          {docLinks(data.returnInvoices, '/sales/invoices')}
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
                        <ProDescriptions.Item label="最近客户收款">
                          {data.latestPaymentEntry ? (
                            <Link
                              to={paymentEntryPath(data.latestPaymentEntry)}
                            >
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
                      <ProCard
                        title={
                          shouldTreatPaymentsAsException
                            ? '异常收款清理'
                            : '回退处理'
                        }
                      >
                        <Alert
                          action={
                            <Space>
                              {data.latestPaymentEntry ? (
                                <Button
                                  danger
                                  loading={paymentCancelLoading}
                                  onClick={() => setPaymentSelectionOpen(true)}
                                  size="small"
                                >
                                  {shouldTreatPaymentsAsException
                                    ? '选择清理异常收款'
                                    : '选择取消客户收款'}
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
                                    ? '取消收款并作废发票'
                                    : '作废销售发票'}
                                </Button>
                              ) : null}
                            </Space>
                          }
                          description={
                            shouldTreatPaymentsAsException
                              ? `这张来源发票已被退货发票 ${data.returnInvoices.join('、')} 冲回，不能再登记客户收款或直接作废来源发票。当前仍有关联客户收款时，只能作为异常收款逐笔清理；清理后不会重新开放原发票收款入口。`
                              : data.latestPaymentEntry
                                ? `这张发票已经有关联客户收款。若只是某笔收款登记有误，请在收款历史中选择具体收款单取消；若订单金额或开票结果有问题，应先取消全部相关客户收款，再作废发票。当前共有 ${activePaymentEntries.length || 1} 笔客户收款。`
                                : data.cancelSalesInvoiceHint ||
                                  '如需修改订单或重走开票流程，可以先作废当前销售发票，再回到发货或订单页面继续处理。'
                          }
                          title={
                            shouldTreatPaymentsAsException
                              ? '退货后的异常收款需要单独清理'
                              : '发票回退前请确认客户收款状态'
                          }
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
      {data ? (
        <Modal
          cancelText="取消"
          centered
          confirmLoading={cancelLoading}
          destroyOnHidden
          okButtonProps={{
            danger: true,
            disabled: activePaymentEntries.length > 1,
          }}
          okText={
            activePaymentEntries.length === 1
              ? '取消收款并作废发票'
              : '确认作废发票'
          }
          onCancel={() => {
            setVoidPaymentConfirmOpen(false);
            setVoidInvoiceModalOpen(false);
          }}
          onOk={() => submitVoidInvoice()}
          open={voidInvoiceModalOpen}
          title={`作废销售发票 ${invoiceName}？`}
          width={820}
        >
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            {activePaymentEntries.length ? (
              <Alert
                description={
                  activePaymentEntries.length > 1
                    ? '当前发票存在多笔客户收款。请先在下方逐笔取消客户收款，全部取消后再作废销售发票。'
                    : '当前发票存在一笔客户收款。你可以先取消这笔收款后作废发票，也可以直接在二次确认后由系统同步取消收款并作废发票；这不是客户退款流程。'
                }
                title={
                  activePaymentEntries.length > 1
                    ? '多笔收款需要逐笔处理'
                    : '发票存在客户收款'
                }
                showIcon
                type="warning"
              />
            ) : (
              <Alert
                description={
                  data.cancelSalesInvoiceHint ||
                  '作废后，这张发票将从订单结算链路中移除。如需重新开票，请回到来源订单或发货链路继续处理。'
                }
                title="收款已清理，可以作废发票"
                showIcon
                type="success"
              />
            )}
            {activePaymentEntries.length ? (
              <ProTable<SalesInvoicePaymentEntry>
                columns={paymentColumns}
                dataSource={activePaymentEntries}
                headerTitle="客户收款"
                options={false}
                pagination={false}
                rowKey="paymentEntry"
                scroll={{ x: 1210 }}
                search={false}
                size="small"
                toolBarRender={false}
              />
            ) : null}
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="销售发票">
                {invoiceName}
              </Descriptions.Item>
              <Descriptions.Item label="发票金额">
                {formatCurrencyValue(data.grandTotal, data.currency)}
              </Descriptions.Item>
              <Descriptions.Item label="销售订单">
                {docLinks(data.salesOrders, '/sales/orders')}
              </Descriptions.Item>
              <Descriptions.Item label="发货单">
                {docLinks(data.deliveryNotes, '/sales/delivery-notes')}
              </Descriptions.Item>
            </Descriptions>
          </Space>
        </Modal>
      ) : null}
      {data && activePaymentEntries.length === 1 ? (
        <Modal
          cancelText="取消"
          centered
          confirmLoading={cancelLoading}
          destroyOnHidden
          okButtonProps={{ danger: true }}
          okText="取消收款并作废发票"
          onCancel={() => setVoidPaymentConfirmOpen(false)}
          onOk={() => submitVoidInvoice({ cancelSinglePayment: true })}
          open={voidPaymentConfirmOpen}
          title="同步取消客户收款并作废发票？"
          width={620}
        >
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              description="系统会先取消这笔客户收款凭证，再继续作废销售发票。这是纠错 / 回退动作，不是正式客户退款；原收款单不会继续保留为有效凭证。"
              showIcon
              title="请确认是否同步取消客户收款"
              type="warning"
            />
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="收款单">
                <Link
                  to={paymentEntryPath(activePaymentEntries[0].paymentEntry)}
                >
                  {activePaymentEntries[0].paymentEntry}
                </Link>
              </Descriptions.Item>
              <Descriptions.Item label="收款金额">
                {formatCurrencyValue(
                  activePaymentEntries[0].allocatedAmount ??
                    activePaymentEntries[0].actualPaidAmount,
                  data.currency,
                )}
              </Descriptions.Item>
              <Descriptions.Item label="付款方式">
                {activePaymentEntries[0].modeOfPayment || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="收款日期">
                {activePaymentEntries[0].postingDate || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Space>
        </Modal>
      ) : null}
      <Modal
        cancelText="取消"
        confirmLoading={paymentModal.loading}
        destroyOnHidden
        okText="确认登记"
        onCancel={paymentModal.close}
        onOk={submitRecordPayment}
        open={paymentModal.open}
        title={`登记客户收款 ${invoiceName}`}
        width={520}
      >
        <InvoicePaymentForm
          detailBasePath="/sales/invoices"
          invoices={[invoiceName]}
          label="销售发票"
          loadOutstandingAmount={async () => data?.outstandingAmount ?? 0}
          onChange={paymentModal.setDraft}
          showReferenceFields
          showSettlementMode
        />
      </Modal>
      <Modal
        footer={null}
        onCancel={() => setPaymentSelectionOpen(false)}
        open={paymentSelectionOpen}
        title={
          shouldTreatPaymentsAsException
            ? '选择需要清理的异常收款'
            : '选择需要取消的客户收款'
        }
        width={820}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            description={
              shouldTreatPaymentsAsException
                ? '请从下方列表选择具体异常收款单清理。该操作只作废选中的收款凭证，不会自动处理其他收款。'
                : '请从下方列表选择具体客户收款单取消。取消收款是作废 Payment Entry，不等同于客户退款。'
            }
            title="请选择具体收款单"
            showIcon
            type="warning"
          />
          <ProTable<SalesInvoicePaymentEntry>
            columns={paymentColumns}
            dataSource={activePaymentEntries}
            options={false}
            pagination={false}
            rowKey="paymentEntry"
            scroll={{ x: 1210 }}
            search={false}
            size="small"
            toolBarRender={false}
          />
        </Space>
      </Modal>
      <Modal
        cancelText="保留收款"
        confirmLoading={paymentCancelLoading}
        destroyOnHidden
        okText={
          shouldTreatPaymentsAsException
            ? '确认清理这笔异常收款'
            : '确认取消这笔收款'
        }
        okType="danger"
        onCancel={() => setPaymentToCancel(null)}
        onOk={submitCancelPayment}
        open={Boolean(paymentToCancel)}
        title={
          shouldTreatPaymentsAsException
            ? '清理异常客户收款'
            : '取消客户收款凭证'
        }
        width={620}
      >
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            description={
              shouldTreatPaymentsAsException
                ? '这张来源发票已经被退货发票冲回，不能再继续收款。该操作只用于作废下面这一个异常收款凭证，不会自动取消其他收款，也不会重新开放原发票收款入口。'
                : '该操作会作废下面这一个客户收款凭证，不会自动取消同一张发票上的其他收款，也不等同于退货后的客户退款。'
            }
            title={
              shouldTreatPaymentsAsException
                ? '请确认要清理的异常收款'
                : '请确认要取消的具体收款'
            }
            showIcon
            type="warning"
          />
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="收款单">
              {paymentToCancel?.paymentEntry ? (
                <Link to={paymentEntryPath(paymentToCancel.paymentEntry)}>
                  {paymentToCancel.paymentEntry}
                </Link>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="收款日期">
              {paymentToCancel?.postingDate || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="付款方式">
              {paymentToCancel?.modeOfPayment || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="核销金额">
              {formatCurrencyValue(
                paymentToCancel?.allocatedAmount,
                data?.currency,
              )}
            </Descriptions.Item>
            <Descriptions.Item label="实收金额">
              {formatCurrencyValue(
                paymentToCancel?.actualPaidAmount,
                data?.currency,
              )}
            </Descriptions.Item>
            <Descriptions.Item label="差额核销">
              {formatCurrencyValue(
                paymentToCancel?.writeoffAmount,
                data?.currency,
              )}
            </Descriptions.Item>
            <Descriptions.Item label="多收保留">
              {formatCurrencyValue(
                paymentToCancel?.latestUnallocatedAmount,
                data?.currency,
              )}
            </Descriptions.Item>
            <Descriptions.Item label="参考号">
              {paymentToCancel?.referenceNo || '-'}
            </Descriptions.Item>
          </Descriptions>
        </Space>
      </Modal>
    </>
  );
};

export default SalesInvoiceDetailPage;
