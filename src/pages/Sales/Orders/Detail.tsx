import {
  PageContainer,
  ProCard,
  ProDescriptions,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { Link, useLocation, useParams, useRequest } from '@umijs/max';
import {
  Alert,
  Button,
  DatePicker,
  Empty,
  Input,
  Modal,
  message,
  Skeleton,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SalesRollbackGuide } from '@/components/DownstreamRollbackGuide';
import {
  type InvoicePaymentDraft,
  InvoicePaymentForm,
} from '@/components/InvoicePaymentForm';
import {
  buildLineQtyRow,
  LineQtyEditor,
  type LineQtyEditorRow,
} from '@/components/LineQtyEditor';
import { PrintDocumentButton } from '@/components/PrintDocumentButton';
import {
  cancelSalesOrder,
  createSalesOrderInvoice,
  getSalesInvoiceDetail,
  getSalesOrderDetail,
  quickCancelSalesOrderV2,
  recordSalesOrderPayment,
  type SalesOrderDetail,
  type SalesOrderDetailItem,
  submitSalesOrderDelivery,
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

function toQty(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function buildSalesActionRows(
  items: SalesOrderDetailItem[],
  getMaxQty: (item: SalesOrderDetailItem) => number,
) {
  return items
    .map((item) =>
      buildLineQtyRow({
        completedQty: item.deliveredQty,
        itemCode: item.itemCode,
        itemName: item.itemName,
        key: item.salesOrderItem || item.itemCode,
        maxQty: getMaxQty(item),
        orderedQty: item.qty,
        uom: item.uom,
        uomDisplay: item.uomDisplay,
      }),
    )
    .filter((item) => item.maxQty > 0);
}

function toSalesActionItems(rows: LineQtyEditorRow[]) {
  return rows
    .filter((row) => row.actionQty > 0)
    .map((row) => ({
      itemCode: row.itemCode,
      qty: row.actionQty,
      salesOrderItem: row.key,
    }));
}

function quickCancelStepLabel(step: string) {
  if (step === 'payment_entry') {
    return '收款单';
  }
  if (step === 'sales_invoice') {
    return '销售发票';
  }
  if (step === 'delivery_note') {
    return '销售发货单';
  }
  return step;
}

function actionTargetLabel(actionTarget: string | null) {
  if (actionTarget === 'delivery') {
    return '创建发货单';
  }
  if (actionTarget === 'invoice') {
    return '创建销售发票';
  }
  if (actionTarget === 'payment') {
    return '记录收款';
  }
  return null;
}

function deliveryDisabledReason(detail: SalesOrderDetail) {
  if (detail.canSubmitDelivery) {
    return '';
  }
  if (detail.documentStatus === 'cancelled') {
    return '订单已作废，不能创建发货单';
  }
  if (detail.documentStatus !== 'submitted') {
    return '只有已提交的销售订单才能创建发货单';
  }
  if (detail.fulfillmentStatus === 'shipped') {
    return '订单已全部发货';
  }
  return '当前订单暂不满足发货条件';
}

function invoiceDisabledReason(detail: SalesOrderDetail) {
  if (detail.canCreateSalesInvoice) {
    return '';
  }
  if (detail.documentStatus === 'cancelled') {
    return '订单已作废，不能创建销售发票';
  }
  if (detail.documentStatus !== 'submitted') {
    return '只有已提交的销售订单才能创建销售发票';
  }
  if (detail.salesInvoices.length) {
    return '当前订单已存在销售发票';
  }
  if ((detail.outstandingAmount ?? 0) <= 0) {
    return '当前订单没有待开票/待收款金额';
  }
  return '当前订单暂不满足开票条件';
}

function paymentDisabledReason(detail: SalesOrderDetail) {
  if (detail.canRecordPayment && (detail.outstandingAmount ?? 0) > 0) {
    return '';
  }
  if (detail.documentStatus === 'cancelled') {
    return '订单已作废，不能记录收款';
  }
  if (!detail.salesInvoices.length) {
    return '请先创建销售发票后再记录收款';
  }
  if ((detail.outstandingAmount ?? 0) <= 0) {
    return '当前订单没有未收金额';
  }
  return '当前订单暂不满足收款条件';
}

function actionUnavailableReason(
  detail: SalesOrderDetail,
  actionTarget: string | null,
) {
  if (actionTarget === 'delivery') {
    return deliveryDisabledReason(detail);
  }
  if (actionTarget === 'invoice') {
    return invoiceDisabledReason(detail);
  }
  if (actionTarget === 'payment') {
    return paymentDisabledReason(detail);
  }
  return '';
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
    title: '已发数量',
    dataIndex: 'deliveredQty',
    align: 'right' as const,
    width: 110,
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

const SalesOrderDetailPage: React.FC = () => {
  const params = useParams();
  const location = useLocation();
  const orderName = decodeURIComponent(String(params.name ?? ''));
  const actionPanelRef = useRef<HTMLDivElement | null>(null);
  const [actionLoading, setActionLoading] = useState<string>();
  const actionTarget = useMemo(() => {
    const value = new URLSearchParams(location.search).get('action');
    return ['delivery', 'invoice', 'payment'].includes(String(value))
      ? String(value)
      : null;
  }, [location.search]);
  const actionTargetText = actionTargetLabel(actionTarget);
  const {
    data: detail,
    error,
    loading,
    refresh,
  } = useRequest(() => getSalesOrderDetail(orderName), {
    formatResult: (result) => result,
    refreshDeps: [orderName],
  });

  useEffect(() => {
    if (!detail || !actionTarget) {
      return;
    }
    window.setTimeout(() => {
      actionPanelRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 120);
  }, [actionTarget, detail]);

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

  const confirmSubmitDelivery = () => {
    if (!detail) {
      return;
    }

    let postingDate = dayjs().format('YYYY-MM-DD');
    let remarks = '';
    let selectedRows = buildSalesActionRows(detail.items, (item) =>
      Math.max(toQty(item.qty) - toQty(item.deliveredQty), 0),
    );

    if (!selectedRows.length) {
      message.warning('当前订单没有可发货的商品明细');
      return;
    }

    Modal.confirm({
      cancelText: '取消',
      content: (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
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
          <LineQtyEditor
            actionTitle="本次发货"
            completedTitle="已发货"
            onChange={(rows) => {
              selectedRows = rows;
            }}
            rows={selectedRows}
          />
        </Space>
      ),
      okText: '创建发货单',
      onOk: async () => {
        const deliveryItems = toSalesActionItems(selectedRows);
        if (!deliveryItems.length) {
          message.error('请至少填写一条本次发货数量');
          throw new Error('No delivery items selected');
        }

        setActionLoading('delivery');
        try {
          await submitSalesOrderDelivery(detail.name, {
            deliveryItems,
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
      title: `创建销售发货单 ${detail.name}`,
      width: 900,
    });
  };

  const confirmCreateInvoice = () => {
    if (!detail) {
      return;
    }

    let remarks = '';
    let selectedRows = buildSalesActionRows(detail.items, (item) =>
      toQty(item.qty),
    );

    if (!selectedRows.length) {
      message.warning('当前订单没有可开票的商品明细');
      return;
    }

    Modal.confirm({
      cancelText: '取消',
      content: (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 4 }}
            onChange={(event) => {
              remarks = event.target.value;
            }}
            placeholder="备注"
          />
          <LineQtyEditor
            actionTitle="本次开票"
            completedTitle="已发货"
            onChange={(rows) => {
              selectedRows = rows;
            }}
            rows={selectedRows}
          />
        </Space>
      ),
      okText: '创建销售发票',
      onOk: async () => {
        const invoiceItems = toSalesActionItems(selectedRows);
        if (!invoiceItems.length) {
          message.error('请至少填写一条本次开票数量');
          throw new Error('No invoice items selected');
        }

        setActionLoading('invoice');
        try {
          await createSalesOrderInvoice(detail.name, {
            invoiceItems,
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
      title: `创建销售发票 ${detail.name}`,
      width: 900,
    });
  };

  const confirmRecordPayment = () => {
    if (!detail) {
      return;
    }

    const invoiceNames = detail.salesInvoices ?? [];
    if (!invoiceNames.length) {
      message.warning('请先创建销售发票后再登记收款');
      return;
    }

    let draft: InvoicePaymentDraft = {
      amount: 0,
      modeOfPayment: '',
      referenceName: invoiceNames[0],
    };
    Modal.confirm({
      cancelText: '取消',
      content: (
        <InvoicePaymentForm
          detailBasePath="/sales/invoices"
          invoices={invoiceNames}
          label="销售发票"
          loadOutstandingAmount={async (invoiceName) => {
            const invoice = await getSalesInvoiceDetail(invoiceName);
            return invoice?.outstandingAmount ?? 0;
          }}
          onChange={(nextDraft) => {
            draft = nextDraft;
          }}
        />
      ),
      okText: '确认收款',
      onOk: async () => {
        const paymentAmount = Number(draft.amount ?? 0);
        if (paymentAmount <= 0) {
          message.error('收款金额必须大于 0 且不能超过未收金额');
          throw new Error('Invalid payment amount');
        }
        if (!draft.referenceName) {
          message.error('请选择销售发票');
          throw new Error('Missing payment reference');
        }

        setActionLoading('payment');
        try {
          await recordSalesOrderPayment(draft.referenceName, paymentAmount, {
            modeOfPayment: draft.modeOfPayment,
            referenceDoctype: 'Sales Invoice',
          });
          refresh();
        } catch (caught) {
          message.error(caught instanceof Error ? caught.message : '操作失败');
          throw caught;
        } finally {
          setActionLoading(undefined);
        }
      },
      title:
        invoiceNames.length > 1
          ? `选择销售发票并记录收款 ${detail.name}`
          : `记录收款 ${invoiceNames[0]}`,
    });
  };

  const confirmQuickCancelDownstream = () => {
    if (!detail) {
      return;
    }

    Modal.confirm({
      cancelText: '取消',
      content: (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <span>
            系统会按顺序回退收款单、销售发票和销售发货单。若当前订单存在多张发票、发货单或多笔收款，后端会拒绝快捷回退。
          </span>
          <SalesRollbackGuide
            deliveryNotes={detail.deliveryNotes}
            salesInvoices={detail.salesInvoices}
          />
        </Space>
      ),
      okText: '快捷回退',
      okType: 'danger',
      onOk: async () => {
        setActionLoading('quick-cancel');
        try {
          const result = await quickCancelSalesOrderV2(detail.name, {
            rollbackPayment: true,
          });
          refresh();
          const completedSteps = result.data.completedSteps
            .map(quickCancelStepLabel)
            .join('、');
          Modal.success({
            content: (
              <Space orientation="vertical" size={4}>
                <span>
                  {completedSteps
                    ? `已回退：${completedSteps}`
                    : '当前没有需要回退的下游单据。'}
                </span>
                {result.data.cancelledPaymentEntries.length ? (
                  <span>
                    收款单：{result.data.cancelledPaymentEntries.join('、')}
                  </span>
                ) : null}
                {result.data.cancelledSalesInvoice ? (
                  <span>销售发票：{result.data.cancelledSalesInvoice}</span>
                ) : null}
                {result.data.cancelledDeliveryNote ? (
                  <span>销售发货单：{result.data.cancelledDeliveryNote}</span>
                ) : null}
              </Space>
            ),
            title: '快捷回退完成',
          });
        } catch (caught) {
          const errorMessage =
            caught instanceof Error ? caught.message : '操作失败';
          message.error(errorMessage);
          Modal.warning({
            content: (
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                <span>{errorMessage}</span>
                <SalesRollbackGuide
                  deliveryNotes={detail.deliveryNotes}
                  salesInvoices={detail.salesInvoices}
                />
              </Space>
            ),
            title: '请改用分步回退',
            width: 680,
          });
          throw caught;
        } finally {
          setActionLoading(undefined);
        }
      },
      title: `快捷回退销售订单 ${detail.name} 的下游单据？`,
      width: 620,
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
        <PrintDocumentButton
          disabled={!orderName}
          docname={orderName}
          doctype="Sales Order"
          key="print"
        />,
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
            title="销售订单详情加载失败"
            type="error"
          />
        )}

        {loading && !detail ? (
          <ProCard>
            <Skeleton active paragraph={{ rows: 8 }} />
          </ProCard>
        ) : null}

        {!loading && !error && !detail ? (
          <ProCard>
            <Empty description="未找到销售订单" />
          </ProCard>
        ) : null}

        {detail ? (
          <>
            {actionTarget && actionUnavailableReason(detail, actionTarget) ? (
              <Alert
                showIcon
                description={actionUnavailableReason(detail, actionTarget)}
                title={`${actionTargetText}暂不可用`}
                type="warning"
              />
            ) : null}
            <StatisticCard.Group direction="row">
              <StatisticCard
                statistic={{
                  title: '订单金额',
                  value: formatCurrencyValue(detail.amount, detail.currency),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '已收金额',
                  value: formatCurrencyValue(
                    detail.paidAmount,
                    detail.currency,
                  ),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '未收金额',
                  value: formatCurrencyValue(
                    detail.outstandingAmount,
                    detail.currency,
                  ),
                }}
              />
            </StatisticCard.Group>

            <ProCard split="vertical">
              <ProCard title="基本信息">
                <ProDescriptions column={2} dataSource={detail}>
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
                    <StatusTag value={detail.documentStatus} />
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="履约状态">
                    <StatusTag value={detail.fulfillmentStatus} />
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="收款状态">
                    <StatusTag value={detail.paymentStatus} />
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="完成状态">
                    <StatusTag value={detail.completionStatus} />
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="币种">
                    {formatCurrencyCode(detail.currency)}
                  </ProDescriptions.Item>
                </ProDescriptions>
              </ProCard>

              <div ref={actionPanelRef}>
                <ProCard
                  title={
                    <Space size={8}>
                      <span>履约动作</span>
                      {actionTargetText ? (
                        <Typography.Text type="secondary">
                          当前入口：{actionTargetText}
                        </Typography.Text>
                      ) : null}
                    </Space>
                  }
                >
                  <Space wrap>
                    <Link
                      to={`/sales/orders/${encodeURIComponent(detail.name)}/edit`}
                    >
                      <Button>编辑订单</Button>
                    </Link>
                    <Tooltip title={deliveryDisabledReason(detail)}>
                      <span>
                        <Button
                          disabled={!detail.canSubmitDelivery}
                          loading={actionLoading === 'delivery'}
                          onClick={confirmSubmitDelivery}
                          type={
                            actionTarget === 'delivery' ? 'primary' : 'default'
                          }
                        >
                          创建发货单
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title={invoiceDisabledReason(detail)}>
                      <span>
                        <Button
                          disabled={!detail.canCreateSalesInvoice}
                          loading={actionLoading === 'invoice'}
                          onClick={confirmCreateInvoice}
                          type={
                            actionTarget === 'invoice' ? 'primary' : 'default'
                          }
                        >
                          创建销售发票
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title={paymentDisabledReason(detail)}>
                      <span>
                        <Button
                          disabled={
                            !detail.canRecordPayment ||
                            (detail.outstandingAmount ?? 0) <= 0
                          }
                          loading={actionLoading === 'payment'}
                          onClick={confirmRecordPayment}
                          type={
                            actionTarget === 'payment' ? 'primary' : 'default'
                          }
                        >
                          记录收款
                        </Button>
                      </span>
                    </Tooltip>
                    <Button
                      danger
                      disabled={
                        !detail.deliveryNotes.length &&
                        !detail.salesInvoices.length
                      }
                      loading={actionLoading === 'quick-cancel'}
                      onClick={confirmQuickCancelDownstream}
                    >
                      快捷回退下游
                    </Button>
                    <Tooltip title={detail.cancelSalesOrderHint}>
                      <span>
                        <Button
                          danger
                          disabled={!detail.canCancelOrder}
                          loading={actionLoading === 'cancel'}
                          onClick={() =>
                            runOrderAction(
                              'cancel',
                              `取消销售订单 ${detail.name}？`,
                              () => cancelSalesOrder(detail.name),
                              true,
                            )
                          }
                        >
                          取消销售订单
                        </Button>
                      </span>
                    </Tooltip>
                  </Space>
                </ProCard>
              </div>
            </ProCard>

            <ProCard title="收货信息">
              <ProDescriptions column={2} dataSource={detail}>
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
                  {docLinks(detail.deliveryNotes, '/sales/delivery-notes')}
                </ProDescriptions.Item>
                <ProDescriptions.Item label="销售发票">
                  {docLinks(detail.salesInvoices, '/sales/invoices')}
                </ProDescriptions.Item>
              </ProDescriptions>
            </ProCard>

            <ProTable<SalesOrderDetailItem>
              columns={itemColumns}
              dataSource={detail.items}
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
