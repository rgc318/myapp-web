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
  DatePicker,
  Empty,
  Input,
  Modal,
  message,
  Skeleton,
  Space,
  Tooltip,
} from 'antd';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import { PurchaseRollbackGuide } from '@/components/DownstreamRollbackGuide';
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
  cancelPurchaseOrder,
  createPurchaseOrderInvoice,
  getPurchaseInvoiceDetail,
  getPurchaseOrderDetail,
  type PurchaseDocumentItem,
  type PurchaseReturnSourceDoctype,
  quickCancelPurchaseOrderV2,
  receivePurchaseOrder,
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

function toQty(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function buildPurchaseActionRows(
  items: PurchaseDocumentItem[],
  getMaxQty: (item: PurchaseDocumentItem) => number,
) {
  return items
    .map((item) =>
      buildLineQtyRow({
        completedQty: item.receivedQty,
        itemCode: item.itemCode,
        itemName: item.itemName,
        key: item.purchaseOrderItem || item.itemCode,
        maxQty: getMaxQty(item),
        orderedQty: item.qty,
        uom: item.uom,
        uomDisplay: item.uomDisplay,
      }),
    )
    .filter((item) => item.maxQty > 0);
}

function toPurchaseActionItems(rows: LineQtyEditorRow[]) {
  return rows
    .filter((row) => row.actionQty > 0)
    .map((row) => ({
      itemCode: row.itemCode,
      purchaseOrderItem: row.key,
      qty: row.actionQty,
    }));
}

function quickCancelStepLabel(step: string) {
  if (step === 'payment_entry') {
    return '供应商付款';
  }
  if (step === 'purchase_invoice') {
    return '采购发票';
  }
  if (step === 'purchase_receipt') {
    return '采购收货单';
  }
  return step;
}

type PurchaseReturnSourceOption = {
  doctype: PurchaseReturnSourceDoctype;
  name: string;
};

function purchaseReturnSourcePath(source: PurchaseReturnSourceOption) {
  const params = new URLSearchParams({
    sourceDoctype: source.doctype,
    sourceName: source.name,
  });
  return `/purchase/returns/new?${params.toString()}`;
}

function purchaseRefundReviewPath(returnInvoice: string, sourceInvoice = '') {
  const params = new URLSearchParams({
    returnInvoice,
  });
  if (sourceInvoice) {
    params.set('sourceInvoice', sourceInvoice);
  }
  return `/purchase/refunds/review?${params.toString()}`;
}

function receiptDisabledReason(detail: {
  canReceive: boolean;
  documentStatus: string;
  receivingStatus: string;
}) {
  if (detail.canReceive) {
    return '';
  }
  if (detail.documentStatus === 'cancelled') {
    return '订单已取消，不能创建收货单';
  }
  if (detail.documentStatus !== 'submitted') {
    return '只有已提交的采购订单才能创建收货单';
  }
  if (detail.receivingStatus === 'received') {
    return '订单已全部收货';
  }
  return '当前订单暂不满足收货条件';
}

function invoiceDisabledReason(detail: {
  canCreateInvoice: boolean;
  documentStatus: string;
  outstandingAmount: number | null;
  purchaseInvoices: string[];
}) {
  if (detail.canCreateInvoice) {
    return '';
  }
  if (detail.documentStatus === 'cancelled') {
    return '订单已取消，不能创建采购发票';
  }
  if (detail.documentStatus !== 'submitted') {
    return '只有已提交的采购订单才能创建采购发票';
  }
  if (detail.purchaseInvoices.length) {
    return '当前订单已存在采购发票';
  }
  if ((detail.outstandingAmount ?? 0) <= 0) {
    return '当前订单没有待开票/待付款金额';
  }
  return '当前订单暂不满足开票条件';
}

function paymentDisabledReason(detail: {
  canRecordPayment: boolean;
  documentStatus: string;
  outstandingAmount: number | null;
  purchaseInvoices: string[];
}) {
  if (detail.canRecordPayment && (detail.outstandingAmount ?? 0) > 0) {
    return '';
  }
  if (detail.documentStatus === 'cancelled') {
    return '订单已取消，不能记录付款';
  }
  if (!detail.purchaseInvoices.length) {
    return '请先创建采购发票后再记录付款';
  }
  if ((detail.outstandingAmount ?? 0) <= 0) {
    return '当前订单没有未付金额';
  }
  return '当前订单暂不满足付款条件';
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

const PurchaseOrderDetailPage: React.FC = () => {
  const params = useParams();
  const orderName = decodeURIComponent(String(params.name ?? ''));
  const [actionLoading, setActionLoading] = useState<string>();
  const { data, error, loading, refresh } = useRequest(
    () => getPurchaseOrderDetail(orderName),
    {
      formatResult: (result) => result,
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
    let selectedRows = buildPurchaseActionRows(data.items, (item) =>
      Math.max(toQty(item.qty) - toQty(item.receivedQty), 0),
    );

    if (!selectedRows.length) {
      message.warning('当前订单没有可收货的商品明细');
      return;
    }

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
          <LineQtyEditor
            actionTitle="本次收货"
            completedTitle="已收货"
            onChange={(rows) => {
              selectedRows = rows;
            }}
            rows={selectedRows}
          />
        </Space>
      ),
      okText: '创建收货单',
      onOk: async () => {
        const receiptItems = toPurchaseActionItems(selectedRows);
        if (!receiptItems.length) {
          message.error('请至少填写一条本次收货数量');
          throw new Error('No receipt items selected');
        }

        setActionLoading('receipt');
        try {
          await receivePurchaseOrder(data.name, {
            postingDate,
            receiptItems,
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
      width: 900,
    });
  };

  const confirmCreateInvoice = () => {
    if (!data) {
      return;
    }

    let remarks = '';
    let selectedRows = buildPurchaseActionRows(data.items, (item) =>
      toQty(item.qty),
    );

    if (!selectedRows.length) {
      message.warning('当前订单没有可开票的商品明细');
      return;
    }

    Modal.confirm({
      cancelText: '取消',
      content: (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 4 }}
            onChange={(event) => {
              remarks = event.target.value;
            }}
            placeholder="备注"
          />
          <LineQtyEditor
            actionTitle="本次开票"
            completedTitle="已收货"
            onChange={(rows) => {
              selectedRows = rows;
            }}
            rows={selectedRows}
          />
        </Space>
      ),
      okText: '创建采购发票',
      onOk: async () => {
        const invoiceItems = toPurchaseActionItems(selectedRows);
        if (!invoiceItems.length) {
          message.error('请至少填写一条本次开票数量');
          throw new Error('No invoice items selected');
        }

        setActionLoading('invoice');
        try {
          await createPurchaseOrderInvoice(data.name, {
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
      title: `创建采购发票 ${data.name}`,
      width: 900,
    });
  };

  const confirmRecordPayment = () => {
    if (!data) {
      return;
    }

    const invoiceNames = data.purchaseInvoices ?? [];
    if (!invoiceNames.length) {
      message.warning('请先创建采购发票后再登记付款');
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
          detailBasePath="/purchase/invoices"
          invoices={invoiceNames}
          label="采购发票"
          loadOutstandingAmount={async (invoiceName) => {
            const invoice = await getPurchaseInvoiceDetail(invoiceName);
            return invoice?.outstandingAmount ?? 0;
          }}
          onChange={(nextDraft) => {
            draft = nextDraft;
          }}
        />
      ),
      okText: '确认付款',
      onOk: async () => {
        const paymentAmount = Number(draft.amount ?? 0);
        if (paymentAmount <= 0) {
          message.error('付款金额必须大于 0 且不能超过未付金额');
          throw new Error('Invalid payment amount');
        }
        if (!draft.referenceName) {
          message.error('请选择采购发票');
          throw new Error('Missing payment reference');
        }

        setActionLoading('payment');
        try {
          await recordSupplierPayment(draft.referenceName, paymentAmount, {
            modeOfPayment: draft.modeOfPayment,
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
          ? `选择采购发票并记录付款 ${data.name}`
          : `记录付款 ${invoiceNames[0]}`,
    });
  };

  const confirmQuickCancelDownstream = () => {
    if (!data) {
      return;
    }

    Modal.confirm({
      cancelText: '取消',
      content: (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <span>
            系统会按顺序回退供应商付款、采购发票和采购收货单。若当前订单存在多张发票、收货单或多笔付款，后端会拒绝快捷回退。
          </span>
          <PurchaseRollbackGuide
            purchaseInvoices={data.purchaseInvoices}
            purchaseReceipts={data.purchaseReceipts}
          />
        </Space>
      ),
      okText: '快捷回退',
      okType: 'danger',
      onOk: async () => {
        setActionLoading('quick-cancel');
        try {
          const result = await quickCancelPurchaseOrderV2(data.name, {
            rollbackPayment: true,
          });
          refresh();
          const completedSteps = result.data.completedSteps
            .map(quickCancelStepLabel)
            .join('、');
          Modal.success({
            content: (
              <Space direction="vertical" size={4}>
                <span>
                  {completedSteps
                    ? `已回退：${completedSteps}`
                    : '当前没有需要回退的下游单据。'}
                </span>
                {result.data.cancelledPaymentEntries.length ? (
                  <span>
                    供应商付款：
                    {result.data.cancelledPaymentEntries.join('、')}
                  </span>
                ) : null}
                {result.data.cancelledPurchaseInvoice ? (
                  <span>采购发票：{result.data.cancelledPurchaseInvoice}</span>
                ) : null}
                {result.data.cancelledPurchaseReceipt ? (
                  <span>
                    采购收货单：{result.data.cancelledPurchaseReceipt}
                  </span>
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
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <span>{errorMessage}</span>
                <PurchaseRollbackGuide
                  purchaseInvoices={data.purchaseInvoices}
                  purchaseReceipts={data.purchaseReceipts}
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
      title: `快捷回退采购订单 ${data.name} 的下游单据？`,
      width: 620,
    });
  };

  const returnSourceOptions: PurchaseReturnSourceOption[] = data
    ? [
        ...data.purchaseReceipts.map((name) => ({
          doctype: 'Purchase Receipt' as const,
          name,
        })),
        ...data.purchaseInvoices.map((name) => ({
          doctype: 'Purchase Invoice' as const,
          name,
        })),
      ]
    : [];
  const openReturnSource = () => {
    if (!returnSourceOptions.length) {
      return;
    }
    if (returnSourceOptions.length === 1) {
      history.push(purchaseReturnSourcePath(returnSourceOptions[0]));
      return;
    }
    Modal.info({
      content: (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {returnSourceOptions.map((source) => (
            <Button
              block
              key={`${source.doctype}-${source.name}`}
              onClick={() => {
                Modal.destroyAll();
                history.push(purchaseReturnSourcePath(source));
              }}
            >
              {source.doctype === 'Purchase Receipt'
                ? '采购收货单'
                : '采购发票'}{' '}
              {source.name}
            </Button>
          ))}
        </Space>
      ),
      title: '选择退货来源单据',
      width: 560,
    });
  };

  const openRefundReview = () => {
    const invoiceNames = data?.purchaseInvoices ?? [];
    if (!invoiceNames.length) {
      return;
    }
    if (invoiceNames.length === 1) {
      history.push(purchaseRefundReviewPath(invoiceNames[0]));
      return;
    }
    Modal.info({
      content: (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {invoiceNames.map((name) => (
            <Button
              block
              key={name}
              onClick={() => {
                Modal.destroyAll();
                history.push(purchaseRefundReviewPath(name));
              }}
            >
              采购发票 {name}
            </Button>
          ))}
        </Space>
      ),
      title: '选择需要核对退款的采购发票',
      width: 560,
    });
  };

  return (
    <PageContainer
      title={orderName || '采购订单详情'}
      extra={[
        <Button key="back">
          <Link to="/purchase/orders">返回列表</Link>
        </Button>,
        data && data.documentStatus !== 'cancelled' ? (
          <Button
            key="edit"
            onClick={() =>
              history.push(
                `/purchase/orders/${encodeURIComponent(orderName)}/edit`,
              )
            }
          >
            编辑订单
          </Button>
        ) : null,
        <Button key="refresh" loading={loading} onClick={refresh}>
          刷新
        </Button>,
        <PrintDocumentButton
          disabled={!orderName}
          docname={orderName}
          doctype="Purchase Order"
          key="print"
        />,
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
                  <Tooltip title={receiptDisabledReason(data)}>
                    <span>
                      <Button
                        disabled={!data.canReceive}
                        loading={actionLoading === 'receipt'}
                        onClick={confirmReceivePurchaseOrder}
                        type="primary"
                      >
                        创建收货单
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip title={invoiceDisabledReason(data)}>
                    <span>
                      <Button
                        disabled={!data.canCreateInvoice}
                        loading={actionLoading === 'invoice'}
                        onClick={confirmCreateInvoice}
                      >
                        创建采购发票
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip title={paymentDisabledReason(data)}>
                    <span>
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
                    </span>
                  </Tooltip>
                  <Tooltip
                    title={
                      returnSourceOptions.length
                        ? ''
                        : '需要先完成收货或开票后再发起退货'
                    }
                  >
                    <span>
                      <Button
                        disabled={!returnSourceOptions.length}
                        onClick={openReturnSource}
                      >
                        发起退货
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip
                    title={
                      data.purchaseInvoices.length
                        ? ''
                        : '需要先创建退货发票后再核对退款'
                    }
                  >
                    <span>
                      <Button
                        disabled={!data.purchaseInvoices.length}
                        onClick={openRefundReview}
                      >
                        退款核对
                      </Button>
                    </span>
                  </Tooltip>
                  <Button
                    danger
                    disabled={
                      !data.purchaseReceipts.length &&
                      !data.purchaseInvoices.length
                    }
                    loading={actionLoading === 'quick-cancel'}
                    onClick={confirmQuickCancelDownstream}
                  >
                    快捷回退下游
                  </Button>
                  <Tooltip
                    title={
                      data.canCancelOrder
                        ? ''
                        : '如已存在收货、发票或付款，请先回退下游单据'
                    }
                  >
                    <span>
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
                    </span>
                  </Tooltip>
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
