import { PageContainer, ProTable } from '@ant-design/pro-components';
import { history, Link, useParams, useRequest } from '@umijs/max';
import type { DescriptionsProps } from 'antd';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Empty,
  Input,
  Modal,
  message,
  Row,
  Skeleton,
  Space,
  Steps,
  Tooltip,
} from 'antd';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import {
  AmountOverview,
  BusinessTimeline,
  buildTransactionItemColumns,
} from '@/components/BusinessOrderDetail';
import {
  buildPaymentActionColumn,
  buildPaymentEntryColumns,
  purchaseInvoiceReferenceColumn,
} from '@/components/BusinessPaymentTables';
import { PurchaseRollbackGuide } from '@/components/DownstreamRollbackGuide';
import {
  InvoicePaymentForm,
  useInvoicePaymentModal,
} from '@/components/InvoicePaymentForm';
import {
  buildLineQtyRow,
  LineQtyEditor,
  type LineQtyEditorRow,
} from '@/components/LineQtyEditor';
import { PrintDocumentButton } from '@/components/PrintDocumentButton';
import { PURCHASE_RETURN_REFUND_ENTRY_ENABLED } from '@/config/feature-flags';
import {
  cancelPurchaseOrder,
  cancelSupplierPaymentEntry,
  createPurchaseInvoiceFromReceipt,
  createPurchaseOrderInvoice,
  getPurchaseInvoiceDetail,
  getPurchaseOrderDetail,
  type PurchaseDocumentItem,
  type PurchaseOrderPaymentEntry,
  type PurchaseOrderTimelineEvent,
  type PurchaseReturnSourceDoctype,
  purchaseOrderEditDisabledReason,
  quickCancelPurchaseOrderV2,
  receivePurchaseOrder,
  recordSupplierPayment,
} from '@/services/myapp/purchase';
import {
  DocumentLinks,
  TimelineDocumentLinks,
} from '@/utils/business-document';
import {
  formatCurrencyCode,
  formatCurrencyValue,
  StatusTag,
} from '@/utils/myapp-display';

function toQty(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function buildPurchaseActionRows(
  items: PurchaseDocumentItem[],
  getCompletedQty: (item: PurchaseDocumentItem) => number,
  getMaxQty: (item: PurchaseDocumentItem) => number,
) {
  return items
    .map((item) =>
      buildLineQtyRow({
        completedQty: getCompletedQty(item),
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

function timelineDocLinks(
  events: PurchaseOrderTimelineEvent[],
  type: PurchaseOrderTimelineEvent['type'],
) {
  return <TimelineDocumentLinks events={events} type={type} />;
}

function timelineColor(event: PurchaseOrderTimelineEvent) {
  if (event.status === 'cancelled') {
    return 'red';
  }
  if (event.type === 'supplier_refund') {
    return 'purple';
  }
  if (event.type === 'payment_entry') {
    return 'green';
  }
  if (event.type === 'purchase_return') {
    return 'orange';
  }
  return 'blue';
}

function purchaseOrderProgress(detail: {
  documentStatus: string;
  paymentStatus: string;
  purchaseInvoices: string[];
  purchaseReceipts: string[];
  receivingStatus: string;
}) {
  if (detail.documentStatus === 'cancelled') {
    return { current: 0, status: 'error' as const };
  }
  if (detail.paymentStatus === 'paid') {
    return { current: 4, status: 'finish' as const };
  }
  if (detail.purchaseInvoices.length) {
    return { current: 3, status: 'process' as const };
  }
  if (detail.purchaseReceipts.length || detail.receivingStatus === 'received') {
    return { current: 2, status: 'process' as const };
  }
  return { current: 1, status: 'process' as const };
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

function quickBillDisabledReason(detail: {
  canCreateInvoice: boolean;
  documentStatus: string;
  outstandingAmount: number | null;
  purchaseInvoices: string[];
}) {
  if (detail.canCreateInvoice) {
    return '';
  }
  if (detail.documentStatus === 'cancelled') {
    return '订单已取消，不能一键开单';
  }
  if (detail.documentStatus !== 'submitted') {
    return '只有已提交的采购订单才能一键开单';
  }
  if (detail.purchaseInvoices.length) {
    return '当前订单已存在采购发票';
  }
  if ((detail.outstandingAmount ?? 0) <= 0) {
    return '当前订单没有待开票/待付款金额';
  }
  return '当前订单暂不满足一键开单条件';
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

const itemColumns = buildTransactionItemColumns<PurchaseDocumentItem>({
  completedQtyKey: 'receivedQty',
  completedTitle: '已收数量',
  pendingTitle: '待收数量',
});

function readMutationName(data: unknown, key: string) {
  if (!data || typeof data !== 'object') {
    return '';
  }
  const value = (data as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

const PurchaseOrderDetailPage: React.FC = () => {
  const params = useParams();
  const orderName = decodeURIComponent(String(params.name ?? ''));
  const [actionLoading, setActionLoading] = useState<string>();
  const paymentModal = useInvoicePaymentModal();
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false);
  const [rollbackPaymentCancelling, setRollbackPaymentCancelling] = useState<
    string | null
  >(null);
  const [rollbackCancelledPayments, setRollbackCancelledPayments] = useState(
    () => new Set<string>(),
  );
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

  const confirmQuickBill = () => {
    if (!data) {
      return;
    }

    const shouldCreateReceipt = data.canReceive;
    const steps = shouldCreateReceipt
      ? '系统会先按当前待收数量创建采购收货单，再基于本次收货创建采购发票。'
      : '系统会基于当前订单创建采购发票，不会重复创建采购收货单。';

    const runQuickBill = async () => {
      let purchaseReceiptName = '';
      let purchaseInvoiceName = '';

      if (shouldCreateReceipt) {
        const receiptResult = await receivePurchaseOrder(data.name);
        purchaseReceiptName = readMutationName(
          receiptResult.data,
          'purchase_receipt',
        );
        if (!purchaseReceiptName) {
          throw new Error(
            '采购收货单已创建，但接口未返回收货单号，已停止继续开票',
          );
        }
      }

      if (purchaseReceiptName) {
        const invoiceResult =
          await createPurchaseInvoiceFromReceipt(purchaseReceiptName);
        purchaseInvoiceName = readMutationName(
          invoiceResult.data,
          'purchase_invoice',
        );
      } else {
        const invoiceResult = await createPurchaseOrderInvoice(data.name);
        purchaseInvoiceName = readMutationName(
          invoiceResult.data,
          'purchase_invoice',
        );
      }

      refresh();

      Modal.success({
        content: (
          <Space orientation="vertical" size={8}>
            {purchaseReceiptName ? (
              <span>
                采购收货单：
                <Link
                  to={`/purchase/receipts/${encodeURIComponent(
                    purchaseReceiptName,
                  )}`}
                >
                  {purchaseReceiptName}
                </Link>
              </span>
            ) : null}
            {purchaseInvoiceName ? (
              <span>
                采购发票：
                <Link
                  to={`/purchase/invoices/${encodeURIComponent(
                    purchaseInvoiceName,
                  )}`}
                >
                  {purchaseInvoiceName}
                </Link>
              </span>
            ) : (
              <span>采购发票已生成，详情刷新后可查看。</span>
            )}
            <span>如需付款，可继续在订单或采购发票页面记录供应商付款。</span>
          </Space>
        ),
        title: '一键开单成功',
      });
    };

    Modal.confirm({
      cancelText: '取消',
      content: (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            description="一键开单适合整单快速收货和结算。若需要部分收货、部分开票或调整明细数量，请继续使用分步的创建收货单和创建采购发票。"
            showIcon
            title={steps}
            type="info"
          />
          <Descriptions
            column={1}
            items={[
              {
                key: 'order',
                label: '采购订单',
                children: data.name,
              },
              {
                key: 'amount',
                label: '订单金额',
                children: formatCurrencyValue(data.amount, data.currency),
              },
              {
                key: 'receipt',
                label: '收货动作',
                children: shouldCreateReceipt
                  ? '创建采购收货单'
                  : '跳过，当前无需创建收货单',
              },
              {
                key: 'invoice',
                label: '开票动作',
                children: '创建采购发票',
              },
            ]}
            size="small"
          />
        </Space>
      ),
      okText: shouldCreateReceipt ? '确认收货并开票' : '确认创建采购发票',
      onOk: async () => {
        setActionLoading('quick-bill');
        try {
          await runQuickBill();
        } catch (caught) {
          message.error(caught instanceof Error ? caught.message : '操作失败');
          throw caught;
        } finally {
          setActionLoading(undefined);
        }
      },
      title: `一键开单 ${data.name}`,
      width: 640,
    });
  };

  const confirmReceivePurchaseOrder = () => {
    if (!data) {
      return;
    }

    let postingDate = dayjs().format('YYYY-MM-DD');
    let remarks = '';
    let selectedRows = buildPurchaseActionRows(
      data.items,
      (item) => toQty(item.receivedQty),
      (item) => Math.max(toQty(item.qty) - toQty(item.receivedQty), 0),
    );

    if (!selectedRows.length) {
      message.warning('当前订单没有可收货的商品明细');
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
    let selectedRows = buildPurchaseActionRows(
      data.items,
      (item) => toQty(item.billedQty),
      (item) =>
        Math.max(
          toQty(
            item.pendingBillingQty ?? toQty(item.qty) - toQty(item.billedQty),
          ),
          0,
        ),
    );

    if (!selectedRows.length) {
      message.warning('当前订单已全部开票，没有可继续开票的商品明细');
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
            completedTitle="已开票"
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

    paymentModal.openWithDraft({
      amount: 0,
      referenceName: invoiceNames[0],
    });
  };

  const submitRecordPayment = async () => {
    const paymentAmount = Number(paymentModal.draft.amount ?? 0);
    if (paymentAmount <= 0) {
      message.error('付款金额必须大于 0 且不能超过未付金额');
      throw new Error('Invalid payment amount');
    }
    if (!paymentModal.draft.referenceName) {
      message.error('请选择采购发票');
      throw new Error('Missing payment reference');
    }

    await paymentModal
      .runSubmit(async (paymentDraft) => {
        setActionLoading('payment');
        await recordSupplierPayment(paymentDraft.referenceName, paymentAmount, {
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
      })
      .finally(() => {
        setActionLoading(undefined);
      });
  };

  const confirmQuickCancelDownstream = () => {
    if (!data) {
      return;
    }
    if (!data.purchaseReceipts.length && !data.purchaseInvoices.length) {
      message.warning('当前订单没有可回退的收货、开票或付款记录');
      return;
    }

    setRollbackModalOpen(true);
  };

  const submitQuickCancelDownstream = async (options?: {
    rollbackPayment?: boolean;
  }) => {
    if (!data) {
      return;
    }

    setActionLoading('quick-cancel');
    try {
      const result = await quickCancelPurchaseOrderV2(data.name, {
        rollbackPayment: options?.rollbackPayment,
      });
      setRollbackModalOpen(false);
      setRollbackConfirmOpen(false);
      setRollbackCancelledPayments(new Set());
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
                供应商付款：{result.data.cancelledPaymentEntries.join('、')}
              </span>
            ) : null}
            {result.data.cancelledPurchaseInvoice ? (
              <span>采购发票：{result.data.cancelledPurchaseInvoice}</span>
            ) : null}
            {result.data.cancelledPurchaseReceipt ? (
              <span>采购收货单：{result.data.cancelledPurchaseReceipt}</span>
            ) : null}
          </Space>
        ),
        title: '回退并修改订单完成',
      });
    } catch (caught) {
      const errorMessage =
        caught instanceof Error ? caught.message : '操作失败';
      message.error(errorMessage);
      Modal.warning({
        content: (
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <span>{errorMessage}</span>
            <PurchaseRollbackGuide
              purchaseInvoices={data.purchaseInvoices}
              purchaseReceipts={data.purchaseReceipts}
            />
          </Space>
        ),
        title: '请分步回退后再修改',
        width: 680,
      });
      throw caught;
    } finally {
      setActionLoading(undefined);
    }
  };

  const cancelRollbackPaymentEntry = async (paymentEntry: string) => {
    if (!paymentEntry) {
      return;
    }

    setRollbackPaymentCancelling(paymentEntry);
    try {
      await cancelSupplierPaymentEntry(paymentEntry);
      setRollbackCancelledPayments((current) => {
        const next = new Set(current);
        next.add(paymentEntry);
        return next;
      });
      message.success(`已取消供应商付款 ${paymentEntry}`);
      refresh();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '操作失败');
      throw caught;
    } finally {
      setRollbackPaymentCancelling(null);
    }
  };

  const confirmSubmitQuickCancelDownstream = () => {
    if (!data) {
      return;
    }

    const activePayments = data.paymentEntries.filter(
      (entry) => !rollbackCancelledPayments.has(entry.paymentEntry),
    );

    if (!activePayments.length) {
      void submitQuickCancelDownstream({ rollbackPayment: false });
      return;
    }

    if (data.paymentEntries.length > 1) {
      message.warning('请先逐笔取消供应商付款，再继续回退发票和收货单');
      return;
    }

    setRollbackConfirmOpen(true);
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
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
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
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
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
  const timelineEvents = data?.timeline ?? [];
  const progress = data ? purchaseOrderProgress(data) : null;
  const activeRollbackPayments =
    data?.paymentEntries.filter(
      (entry) => !rollbackCancelledPayments.has(entry.paymentEntry),
    ) ?? [];
  const rollbackRequiresManualPaymentCleanup =
    (data?.paymentEntries.length ?? 0) > 1 && activeRollbackPayments.length > 0;
  const paymentColumns = [
    ...buildPaymentEntryColumns<PurchaseOrderPaymentEntry>({
      actualAmountKey: 'amount',
      actualAmountTitle: '金额',
      currency: data?.currency,
      dateTitle: '日期',
      entryTitle: '付款单',
      extraColumns: [
        purchaseInvoiceReferenceColumn<PurchaseOrderPaymentEntry>(),
      ],
      showAllocatedAmount: false,
    }),
    buildPaymentActionColumn<PurchaseOrderPaymentEntry>({
      cancelText: '取消付款',
      loading: (record) => rollbackPaymentCancelling === record.paymentEntry,
      onCancelPayment: (record) =>
        cancelRollbackPaymentEntry(record.paymentEntry),
      width: 110,
    }),
  ];
  const editDisabledReason = purchaseOrderEditDisabledReason(data ?? null);
  const pageDescriptionItems: DescriptionsProps['items'] = data
    ? [
        {
          key: 'supplier',
          label: '供应商',
          children: data.supplierName || data.supplier,
        },
        {
          key: 'company',
          label: '公司',
          children: data.company,
        },
        {
          key: 'transactionDate',
          label: '订单日期',
          children: data.transactionDate || '-',
        },
        {
          key: 'scheduleDate',
          label: '要求到货日期',
          children: data.scheduleDate || '-',
        },
      ]
    : [];
  const basicItems: DescriptionsProps['items'] = data
    ? [
        {
          key: 'documentStatus',
          label: '单据状态',
          children: <StatusTag value={data.documentStatus} />,
        },
        {
          key: 'receivingStatus',
          label: '收货状态',
          children: <StatusTag value={data.receivingStatus} />,
        },
        {
          key: 'paymentStatus',
          label: '付款状态',
          children: <StatusTag value={data.paymentStatus} />,
        },
        {
          key: 'completionStatus',
          label: '完成状态',
          children: <StatusTag value={data.completionStatus} />,
        },
        {
          key: 'currency',
          label: '币种',
          children: formatCurrencyCode(data.currency),
        },
        {
          key: 'supplierRef',
          label: '供应商单号',
          children: data.supplierRef || '-',
        },
        {
          key: 'remarks',
          label: '订单备注',
          children: data.remarks || '-',
        },
      ]
    : [];
  const referenceItems: DescriptionsProps['items'] = data
    ? [
        {
          key: 'receipts',
          label: '采购收货单',
          children: (
            <DocumentLinks
              basePath="/purchase/receipts"
              names={data.purchaseReceipts}
            />
          ),
        },
        {
          key: 'invoices',
          label: '采购发票',
          children: (
            <DocumentLinks
              basePath="/purchase/invoices"
              names={data.purchaseInvoices}
            />
          ),
        },
        {
          key: 'payments',
          label: '供应商付款',
          children: timelineDocLinks(timelineEvents, 'payment_entry'),
        },
        ...(PURCHASE_RETURN_REFUND_ENTRY_ENABLED
          ? [
              {
                key: 'returns',
                label: '采购退货',
                children: timelineDocLinks(timelineEvents, 'purchase_return'),
              },
              {
                key: 'refunds',
                label: '供应商退款',
                children: timelineDocLinks(timelineEvents, 'supplier_refund'),
              },
            ]
          : []),
      ]
    : [];
  const supplierItems: DescriptionsProps['items'] = data
    ? [
        {
          key: 'contact',
          label: '联系人',
          children: data.supplierContactDisplay || '-',
        },
        {
          key: 'phone',
          label: '联系电话',
          children: data.supplierContactPhone || '-',
        },
        {
          key: 'address',
          label: '供应商地址',
          children: data.supplierAddressDisplay || '-',
        },
      ]
    : [];

  return (
    <PageContainer
      title={orderName || '采购订单详情'}
      content={
        data ? (
          <Descriptions column={2} items={pageDescriptionItems} size="small" />
        ) : undefined
      }
      extra={[
        <Button key="back">
          <Link to="/purchase/orders">返回列表</Link>
        </Button>,
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
            title="采购订单详情加载失败"
            type="error"
          />
        )}

        {loading && !data ? (
          <Card variant="borderless">
            <Skeleton active paragraph={{ rows: 8 }} />
          </Card>
        ) : null}

        {!loading && !error && !data ? (
          <Card variant="borderless">
            <Empty description="未找到采购订单" />
          </Card>
        ) : null}

        {data ? (
          <>
            <AmountOverview
              amount={data.amount}
              currency={data.currency}
              outstandingAmount={data.outstandingAmount}
              outstandingTitle="未付金额"
              paidAmount={data.paidAmount}
              paidTitle="已付金额"
              payableAmount={data.amount}
              payableTitle="应付金额"
              settledText="当前已结清"
              unsettledText="仍需跟进付款"
            />

            <Row gutter={[16, 16]}>
              <Col lg={16} xs={24}>
                <Space
                  orientation="vertical"
                  size={16}
                  style={{ width: '100%' }}
                >
                  <Card title="订单进度" variant="borderless">
                    <Steps
                      current={progress?.current}
                      items={[
                        {
                          title: '创建订单',
                          content: data.transactionDate || '-',
                        },
                        {
                          title: '提交订单',
                          content: <StatusTag value={data.documentStatus} />,
                        },
                        {
                          title: '收货',
                          content: <StatusTag value={data.receivingStatus} />,
                        },
                        {
                          title: '开票',
                          content: data.purchaseInvoices.length
                            ? `${data.purchaseInvoices.length} 张采购发票`
                            : '未开票',
                        },
                        {
                          title: '付款完成',
                          content: <StatusTag value={data.paymentStatus} />,
                        },
                      ]}
                      status={progress?.status}
                    />
                  </Card>

                  <BusinessTimeline
                    currency={data.currency}
                    events={timelineEvents}
                    getColor={timelineColor}
                  />

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
                </Space>
              </Col>

              <Col lg={8} xs={24}>
                <Space
                  orientation="vertical"
                  size={16}
                  style={{ width: '100%' }}
                >
                  <Card title="采购动作" variant="borderless">
                    <Space wrap>
                      <Tooltip title={editDisabledReason}>
                        <span>
                          <Button
                            disabled={Boolean(editDisabledReason)}
                            onClick={() => {
                              if (!editDisabledReason) {
                                history.push(
                                  `/purchase/orders/${encodeURIComponent(
                                    data.name,
                                  )}/edit`,
                                );
                              }
                            }}
                          >
                            编辑订单
                          </Button>
                        </span>
                      </Tooltip>
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
                      <Tooltip title={quickBillDisabledReason(data)}>
                        <span>
                          <Button
                            disabled={!data.canCreateInvoice}
                            loading={actionLoading === 'quick-bill'}
                            onClick={confirmQuickBill}
                            type="primary"
                          >
                            一键开单
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
                      {PURCHASE_RETURN_REFUND_ENTRY_ENABLED ? (
                        <>
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
                        </>
                      ) : null}
                      <Button
                        danger
                        disabled={
                          !data.purchaseReceipts.length &&
                          !data.purchaseInvoices.length
                        }
                        loading={actionLoading === 'quick-cancel'}
                        onClick={confirmQuickCancelDownstream}
                      >
                        回退并修改订单
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
                  </Card>

                  <Card title="基本信息" variant="borderless">
                    <Descriptions column={1} items={basicItems} />
                  </Card>

                  <Card title="关联单据" variant="borderless">
                    <Descriptions column={1} items={referenceItems} />
                  </Card>

                  <Card title="供应商信息" variant="borderless">
                    <Descriptions column={1} items={supplierItems} />
                  </Card>
                </Space>
              </Col>
            </Row>
          </>
        ) : null}
      </Space>
      <Modal
        confirmLoading={paymentModal.loading}
        destroyOnHidden
        okText="确认付款"
        onCancel={paymentModal.close}
        onOk={submitRecordPayment}
        open={paymentModal.open}
        title={
          (data?.purchaseInvoices?.length ?? 0) > 1
            ? `选择采购发票并记录付款 ${data?.name ?? ''}`
            : `记录付款 ${paymentModal.draft.referenceName || ''}`
        }
      >
        <InvoicePaymentForm
          detailBasePath="/purchase/invoices"
          invoices={data?.purchaseInvoices ?? []}
          label="采购发票"
          loadOutstandingAmount={async (invoiceName) => {
            const invoice = await getPurchaseInvoiceDetail(invoiceName);
            return invoice?.outstandingAmount ?? 0;
          }}
          onChange={paymentModal.setDraft}
          showReferenceFields
          showSettlementMode
        />
      </Modal>
      <Modal
        cancelText="取消"
        confirmLoading={actionLoading === 'quick-cancel'}
        okButtonProps={{
          danger: true,
          disabled: rollbackRequiresManualPaymentCleanup,
        }}
        okText="回退并修改订单"
        onCancel={() => setRollbackModalOpen(false)}
        onOk={confirmSubmitQuickCancelDownstream}
        open={rollbackModalOpen}
        title={`回退采购订单 ${data?.name ?? orderName} 的下游单据？`}
        width={680}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            description="系统会按供应商付款、采购发票、采购收货单的顺序回退下游单据。若当前订单存在多张发票、收货单或多笔付款，后端会拒绝快捷回退，需要改用分步回退。"
            showIcon
            title="回退后采购订单会保留为可继续编辑的已提交状态"
            type="warning"
          />
          {(data?.paymentEntries.length ?? 0) === 1 &&
          activeRollbackPayments.length ? (
            <Alert
              description="当前订单存在一笔供应商付款。你可以先取消这笔付款后继续回退，也可以直接在二次确认后由系统同步取消付款。"
              showIcon
              title="当前订单已有供应商付款"
              type="warning"
            />
          ) : null}
          {(data?.paymentEntries.length ?? 0) > 1 ? (
            <Alert
              description="当前订单存在多笔供应商付款。请先在下方逐笔取消供应商付款，全部取消后再继续回退采购发票和采购收货单。"
              showIcon
              title="多笔付款需要逐笔处理"
              type="warning"
            />
          ) : null}
          {(data?.paymentEntries.length ?? 0) > 0 &&
          activeRollbackPayments.length ? (
            <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
              <ProTable<PurchaseOrderPaymentEntry>
                columns={paymentColumns}
                dataSource={activeRollbackPayments}
                headerTitle="供应商付款"
                options={false}
                pagination={false}
                rowKey="paymentEntry"
                scroll={{ x: 815 }}
                search={false}
                size="small"
                tableStyle={{ minWidth: 815 }}
                toolBarRender={false}
              />
            </div>
          ) : null}
          {(data?.paymentEntries.length ?? 0) > 0 &&
          !activeRollbackPayments.length ? (
            <Alert
              description="供应商付款已全部取消，可以继续回退采购发票和采购收货单。"
              showIcon
              title="付款已清理"
              type="success"
            />
          ) : null}
          <PurchaseRollbackGuide
            purchaseInvoices={data?.purchaseInvoices ?? []}
            purchaseReceipts={data?.purchaseReceipts ?? []}
          />
        </Space>
      </Modal>
      <Modal
        cancelText="取消"
        confirmLoading={actionLoading === 'quick-cancel'}
        okButtonProps={{ danger: true }}
        okText="取消付款并回退"
        onCancel={() => setRollbackConfirmOpen(false)}
        onOk={() => submitQuickCancelDownstream({ rollbackPayment: true })}
        open={rollbackConfirmOpen}
        title="确认同步取消供应商付款？"
        width={560}
      >
        <Alert
          description="当前订单已经存在供应商付款。继续一键回退会先作废相关付款凭证，再作废采购发票和采购收货单；这不是供应商退款流程，也不会保留原付款单。若实际已发生资金退回，应改用分步退款或财务核对流程。"
          showIcon
          title="请确认付款处理口径"
          type="warning"
        />
      </Modal>
    </PageContainer>
  );
};

export default PurchaseOrderDetailPage;
