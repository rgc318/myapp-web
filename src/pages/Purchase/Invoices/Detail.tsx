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
  App as AntdApp,
  Button,
  Descriptions,
  Empty,
  Modal,
  Progress,
  Skeleton,
  Space,
} from 'antd';
import React, { useState } from 'react';
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
import { PURCHASE_RETURN_REFUND_ENTRY_ENABLED } from '@/config/feature-flags';
import {
  cancelPurchaseInvoice,
  cancelSupplierPaymentEntry,
  getPurchaseInvoiceDetail,
  type PurchaseDocumentItem,
  type PurchaseOrderPaymentEntry,
  recordSupplierPayment,
} from '@/services/myapp/purchase';
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

const paymentEntryColumns = buildPaymentEntryColumns<PurchaseOrderPaymentEntry>(
  {
    actualAmountKey: 'amount',
    actualAmountTitle: '实付金额',
    dateTitle: '付款日期',
    entryTitle: '付款单',
  },
);

const itemColumns = buildInvoiceItemColumns<PurchaseDocumentItem>();

const PurchaseInvoiceDetailPage: React.FC = () => {
  const { message } = AntdApp.useApp();
  const params = useParams();
  const invoiceName = decodeURIComponent(String(params.name ?? ''));
  const [cancelLoading, setCancelLoading] = useState(false);
  const paymentModal = useInvoicePaymentModal({ referenceName: invoiceName });
  const [paymentCancelLoading, setPaymentCancelLoading] = useState(false);
  const [paymentSelectionOpen, setPaymentSelectionOpen] = useState(false);
  const [paymentToCancel, setPaymentToCancel] =
    useState<PurchaseOrderPaymentEntry | null>(null);
  const [voidInvoiceModalOpen, setVoidInvoiceModalOpen] = useState(false);
  const [voidPaymentConfirmOpen, setVoidPaymentConfirmOpen] = useState(false);
  const [cancelledPaymentEntries, setCancelledPaymentEntries] = useState<
    Set<string>
  >(new Set());
  const { data, error, loading, refresh } = useRequest(
    () => getPurchaseInvoiceDetail(invoiceName),
    {
      formatResult: (result) => result,
      refreshDeps: [invoiceName],
    },
  );
  const cancelled = data ? isCancelled(data.documentStatus) : false;
  const hasOutstanding = (data?.outstandingAmount ?? 0) > 0;
  const activePaymentEntries = (data?.paymentEntries ?? []).filter(
    (entry) =>
      entry.paymentEntry && !cancelledPaymentEntries.has(entry.paymentEntry),
  );

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
      message.warning('请先逐笔取消供应商付款，再作废采购发票');
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
        await cancelSupplierPaymentEntry(paymentEntryToCancel.paymentEntry);
        setCancelledPaymentEntries((current) => {
          const next = new Set(current);
          next.add(paymentEntryToCancel.paymentEntry);
          return next;
        });
      }
      await cancelPurchaseInvoice(invoiceName);
      message.success(
        paymentEntryToCancel
          ? `已取消供应商付款 ${paymentEntryToCancel.paymentEntry}，并作废采购发票 ${invoiceName}`
          : `采购发票 ${invoiceName} 已作废`,
      );
      setVoidPaymentConfirmOpen(false);
      setVoidInvoiceModalOpen(false);
      refresh();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '操作失败');
      throw caught;
    } finally {
      setCancelLoading(false);
    }
  };

  const openCancelPayment = (entry: PurchaseOrderPaymentEntry | null) => {
    if (!entry?.paymentEntry) {
      message.warning('当前发票没有可取消的供应商付款');
      return;
    }
    setPaymentSelectionOpen(false);
    setPaymentToCancel(entry);
  };

  const submitCancelPayment = async () => {
    if (!paymentToCancel?.paymentEntry) {
      return;
    }
    setPaymentCancelLoading(true);
    try {
      await cancelSupplierPaymentEntry(paymentToCancel.paymentEntry);
      message.success(
        `已取消供应商付款 ${paymentToCancel.paymentEntry}，金额 ${formatCurrencyValue(
          paymentToCancel.allocatedAmount ?? paymentToCancel.amount,
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

  const confirmRecordPayment = () => {
    if (!data) {
      return;
    }

    paymentModal.openWithDraft({
      amount: data.outstandingAmount ?? 0,
      referenceName: invoiceName,
    });
  };

  const submitRecordPayment = async () => {
    const paymentAmount = Number(paymentModal.draft.amount ?? 0);
    if (paymentAmount <= 0 || paymentAmount > (data?.outstandingAmount ?? 0)) {
      message.error('付款金额必须大于 0 且不能超过未付金额');
      throw new Error('Invalid payment amount');
    }

    await paymentModal
      .runSubmit(async (paymentDraft) => {
        await recordSupplierPayment(invoiceName, paymentAmount, {
          modeOfPayment: paymentDraft.modeOfPayment,
          referenceDate: paymentDraft.referenceDate,
          referenceNo: paymentDraft.referenceNo,
          settlementMode:
            paymentDraft.settlementMode === 'writeoff' ? 'writeoff' : 'partial',
          writeoffReason:
            paymentDraft.settlementMode === 'writeoff'
              ? 'Web 端采购差额核销结清'
              : undefined,
        });
        refresh();
      })
      .catch((caught) => {
        message.error(caught instanceof Error ? caught.message : '操作失败');
        throw caught;
      });
  };

  const paymentColumns = [
    ...paymentEntryColumns,
    buildPaymentActionColumn<PurchaseOrderPaymentEntry>({
      cancelText: '取消付款',
      disabled: cancelled,
      onCancelPayment: openCancelPayment,
    }),
  ];

  return (
    <>
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
          PURCHASE_RETURN_REFUND_ENTRY_ENABLED &&
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
            loading={paymentModal.loading}
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
            disabled={!activePaymentEntries.length}
            key="cancel-payment"
            loading={paymentCancelLoading}
            onClick={() => setPaymentSelectionOpen(true)}
          >
            选择取消付款
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
              showIcon
              title="采购发票详情加载失败"
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
                    <ProTable<PurchaseOrderPaymentEntry>
                      columns={paymentEntryColumns}
                      dataSource={data.paymentEntries}
                      headerTitle="付款历史"
                      options={false}
                      pagination={false}
                      rowKey="paymentEntry"
                      scroll={{ x: 650 }}
                      search={false}
                      size="small"
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
                        showIcon
                        title={cancelled ? '这是一张历史发票' : '当前结算状态'}
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
                          {docLinks(
                            data.purchaseReceipts,
                            '/purchase/receipts',
                          )}
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
                    (data.canCancel || data.latestPaymentEntry) ? (
                      <ProCard title="回退处理">
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
                                  选择取消付款
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
                              ? `这张发票已经有关联付款。若只是付款登记有误，请在付款历史中选择具体付款单取消；若采购金额或开票结果有问题，应先取消全部相关供应商付款，再作废发票。当前共有 ${activePaymentEntries.length || 1} 笔供应商付款。`
                              : '如需修改采购订单或重走开票流程，可以先作废当前采购发票，再回到收货或订单页面继续处理。'
                          }
                          showIcon
                          title="发票回退前请确认付款状态"
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
              ? '取消付款并作废发票'
              : '确认作废发票'
          }
          onCancel={() => {
            setVoidPaymentConfirmOpen(false);
            setVoidInvoiceModalOpen(false);
          }}
          onOk={() => submitVoidInvoice()}
          open={voidInvoiceModalOpen}
          title={`作废采购发票 ${invoiceName}？`}
          width={820}
        >
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            {activePaymentEntries.length ? (
              <Alert
                description={
                  activePaymentEntries.length > 1
                    ? '当前发票存在多笔供应商付款。请先在下方逐笔取消供应商付款，全部取消后再作废采购发票。'
                    : '当前发票存在一笔供应商付款。你可以先取消这笔付款后作废发票，也可以直接在二次确认后由系统同步取消付款并作废发票；这不是供应商退款流程。'
                }
                showIcon
                title={
                  activePaymentEntries.length > 1
                    ? '多笔付款需要逐笔处理'
                    : '发票存在供应商付款'
                }
                type="warning"
              />
            ) : (
              <Alert
                description="作废后，这张发票将从采购结算链路中移除。如需重新开票，请回到来源采购订单或收货链路继续处理。"
                showIcon
                title="付款已清理，可以作废发票"
                type="success"
              />
            )}
            {activePaymentEntries.length ? (
              <ProTable<PurchaseOrderPaymentEntry>
                columns={paymentColumns}
                dataSource={activePaymentEntries}
                headerTitle="供应商付款"
                options={false}
                pagination={false}
                rowKey="paymentEntry"
                scroll={{ x: 770 }}
                search={false}
                size="small"
                toolBarRender={false}
              />
            ) : null}
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="采购发票">
                {invoiceName}
              </Descriptions.Item>
              <Descriptions.Item label="发票金额">
                {formatCurrencyValue(data.amount, data.currency)}
              </Descriptions.Item>
              <Descriptions.Item label="采购订单">
                {docLinks(data.purchaseOrders, '/purchase/orders')}
              </Descriptions.Item>
              <Descriptions.Item label="采购收货单">
                {docLinks(data.purchaseReceipts, '/purchase/receipts')}
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
          okText="取消付款并作废发票"
          onCancel={() => setVoidPaymentConfirmOpen(false)}
          onOk={() => submitVoidInvoice({ cancelSinglePayment: true })}
          open={voidPaymentConfirmOpen}
          title="同步取消供应商付款并作废发票？"
          width={620}
        >
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              description="系统会先取消这笔供应商付款凭证，再继续作废采购发票。这是纠错 / 回退动作，不是正式供应商退款；原付款单不会继续保留为有效凭证。"
              showIcon
              title="请确认是否同步取消供应商付款"
              type="warning"
            />
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="付款单">
                <Link
                  to={paymentEntryPath(activePaymentEntries[0].paymentEntry)}
                >
                  {activePaymentEntries[0].paymentEntry}
                </Link>
              </Descriptions.Item>
              <Descriptions.Item label="付款金额">
                {formatCurrencyValue(
                  activePaymentEntries[0].allocatedAmount ??
                    activePaymentEntries[0].amount,
                  data.currency,
                )}
              </Descriptions.Item>
              <Descriptions.Item label="付款方式">
                {activePaymentEntries[0].modeOfPayment || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="付款日期">
                {activePaymentEntries[0].date || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Space>
        </Modal>
      ) : null}
      <Modal
        cancelText="取消"
        confirmLoading={paymentModal.loading}
        destroyOnHidden
        okText="确认付款"
        onCancel={paymentModal.close}
        onOk={submitRecordPayment}
        open={paymentModal.open}
        title={`记录付款 ${invoiceName}`}
        width={520}
      >
        <InvoicePaymentForm
          detailBasePath="/purchase/invoices"
          invoices={[invoiceName]}
          label="采购发票"
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
        title="选择需要取消的供应商付款"
        width={760}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            description="请从下方列表选择具体供应商付款单取消。取消付款是作废 Payment Entry，不等同于采购退货后的供应商退款。"
            showIcon
            title="请选择具体付款单"
            type="warning"
          />
          <ProTable<PurchaseOrderPaymentEntry>
            columns={paymentColumns}
            dataSource={activePaymentEntries}
            options={false}
            pagination={false}
            rowKey="paymentEntry"
            scroll={{ x: 770 }}
            search={false}
            size="small"
            toolBarRender={false}
          />
        </Space>
      </Modal>
      <Modal
        cancelText="保留付款"
        confirmLoading={paymentCancelLoading}
        destroyOnHidden
        okText="确认取消这笔付款"
        okType="danger"
        onCancel={() => setPaymentToCancel(null)}
        onOk={submitCancelPayment}
        open={Boolean(paymentToCancel)}
        title="取消供应商付款凭证"
        width={620}
      >
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            description="该操作会作废下面这一个供应商付款凭证，不会自动取消同一张发票上的其他付款，也不等同于退货后的供应商退款。"
            showIcon
            title="请确认要取消的具体付款"
            type="warning"
          />
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="付款单">
              {paymentToCancel?.paymentEntry ? (
                <Link to={paymentEntryPath(paymentToCancel.paymentEntry)}>
                  {paymentToCancel.paymentEntry}
                </Link>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="付款日期">
              {paymentToCancel?.date || '-'}
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
            <Descriptions.Item label="实付金额">
              {formatCurrencyValue(paymentToCancel?.amount, data?.currency)}
            </Descriptions.Item>
          </Descriptions>
        </Space>
      </Modal>
    </>
  );
};

export default PurchaseInvoiceDetailPage;
