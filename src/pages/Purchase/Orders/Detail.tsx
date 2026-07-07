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
  Progress,
  Row,
  Skeleton,
  Space,
  Statistic,
  Steps,
  Timeline,
  Tooltip,
  Typography,
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
  cancelSupplierPaymentEntry,
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

function paymentEntryPath(paymentEntry: string) {
  return `/payments/${encodeURIComponent(paymentEntry)}`;
}

function documentPath(doctype: string, docname: string) {
  if (!docname) {
    return '';
  }
  if (doctype === 'Purchase Receipt') {
    return `/purchase/receipts/${encodeURIComponent(docname)}`;
  }
  if (doctype === 'Purchase Invoice') {
    return `/purchase/invoices/${encodeURIComponent(docname)}`;
  }
  if (doctype === 'Payment Entry') {
    return paymentEntryPath(docname);
  }
  if (doctype === 'Purchase Order') {
    return `/purchase/orders/${encodeURIComponent(docname)}`;
  }
  return '';
}

function timelineDocLinks(
  events: PurchaseOrderTimelineEvent[],
  type: PurchaseOrderTimelineEvent['type'],
) {
  const documents = events
    .filter((event) => event.type === type && event.docname)
    .map((event) => ({
      docname: event.docname,
      path: documentPath(event.doctype, event.docname),
    }));

  return documents.length
    ? documents.map((document, index) => (
        <React.Fragment key={`${type}-${document.docname}`}>
          {index > 0 ? '、' : null}
          {document.path ? (
            <Link to={document.path}>{document.docname}</Link>
          ) : (
            document.docname
          )}
        </React.Fragment>
      ))
    : '无';
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

function timelineEventDescription(
  event: PurchaseOrderTimelineEvent,
  currency: string,
) {
  const pieces = [
    event.date,
    event.description,
    event.amount != null ? formatCurrencyValue(event.amount, currency) : '',
    event.modeOfPayment,
    event.referenceNo ? `参考号 ${event.referenceNo}` : '',
  ].filter(Boolean);

  return pieces.join(' · ');
}

function toPercent(
  value: number | null | undefined,
  total: number | null | undefined,
) {
  const totalValue = toQty(total);
  if (totalValue <= 0) {
    return 0;
  }
  return Math.min(Math.round((toQty(value) / totalValue) * 100), 100);
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
    title: '商品信息',
    dataIndex: 'itemName',
    width: 320,
    render: (_: unknown, record: PurchaseDocumentItem) => (
      <Space align="start" size={12}>
        <div
          style={{
            alignItems: 'center',
            background: '#f5f5f5',
            border: '1px solid #f0f0f0',
            color: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            height: 56,
            justifyContent: 'center',
            width: 56,
          }}
        >
          无图
        </div>
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>{record.itemName}</Typography.Text>
          <Typography.Text type="secondary">{record.itemCode}</Typography.Text>
          {record.warehouse ? (
            <Typography.Text type="secondary">
              {record.warehouse}
            </Typography.Text>
          ) : null}
        </Space>
      </Space>
    ),
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
    title: '待收数量',
    dataIndex: 'pendingReceiptQty',
    align: 'right' as const,
    width: 110,
    render: (_: unknown, record: PurchaseDocumentItem) =>
      Math.max(toQty(record.qty) - toQty(record.receivedQty), 0),
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
];

const PurchaseOrderDetailPage: React.FC = () => {
  const params = useParams();
  const orderName = decodeURIComponent(String(params.name ?? ''));
  const [actionLoading, setActionLoading] = useState<string>();
  const [paymentDraft, setPaymentDraft] = useState<InvoicePaymentDraft>({
    amount: 0,
    modeOfPayment: '',
    referenceName: '',
  });
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
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

    setPaymentDraft({
      amount: 0,
      modeOfPayment: '',
      referenceName: invoiceNames[0],
    });
    setPaymentModalOpen(true);
  };

  const submitRecordPayment = async () => {
    const paymentAmount = Number(paymentDraft.amount ?? 0);
    if (paymentAmount <= 0) {
      message.error('付款金额必须大于 0 且不能超过未付金额');
      throw new Error('Invalid payment amount');
    }
    if (!paymentDraft.referenceName) {
      message.error('请选择采购发票');
      throw new Error('Missing payment reference');
    }

    setActionLoading('payment');
    try {
      await recordSupplierPayment(paymentDraft.referenceName, paymentAmount, {
        modeOfPayment: paymentDraft.modeOfPayment,
      });
      setPaymentModalOpen(false);
      refresh();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '操作失败');
      throw caught;
    } finally {
      setActionLoading(undefined);
    }
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
    {
      title: '付款单',
      dataIndex: 'paymentEntry',
      ellipsis: true,
      width: 190,
      render: (_: unknown, record: PurchaseOrderPaymentEntry) => (
        <Link to={paymentEntryPath(record.paymentEntry)}>
          {record.paymentEntry}
        </Link>
      ),
    },
    {
      title: '日期',
      dataIndex: 'date',
      width: 110,
      render: (_: unknown, record: PurchaseOrderPaymentEntry) =>
        record.date || '-',
    },
    {
      title: '方式',
      dataIndex: 'modeOfPayment',
      ellipsis: true,
      width: 120,
      render: (_: unknown, record: PurchaseOrderPaymentEntry) =>
        record.modeOfPayment || '-',
    },
    {
      title: '金额',
      dataIndex: 'amount',
      align: 'right' as const,
      width: 115,
      render: (_: unknown, record: PurchaseOrderPaymentEntry) =>
        formatCurrencyValue(record.amount, data?.currency),
    },
    {
      title: '采购发票',
      dataIndex: 'referenceName',
      ellipsis: true,
      width: 170,
      render: (_: unknown, record: PurchaseOrderPaymentEntry) =>
        record.referenceName ? (
          <Link
            to={`/purchase/invoices/${encodeURIComponent(record.referenceName)}`}
          >
            {record.referenceName}
          </Link>
        ) : (
          '-'
        ),
    },
    {
      title: '操作',
      valueType: 'option' as const,
      width: 110,
      render: (_: unknown, record: PurchaseOrderPaymentEntry) => (
        <Button
          danger
          loading={rollbackPaymentCancelling === record.paymentEntry}
          onClick={() => cancelRollbackPaymentEntry(record.paymentEntry)}
          size="small"
          type="link"
        >
          取消付款
        </Button>
      ),
    },
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
      ]
    : [];
  const referenceItems: DescriptionsProps['items'] = data
    ? [
        {
          key: 'receipts',
          label: '采购收货单',
          children: docLinks(data.purchaseReceipts, '/purchase/receipts'),
        },
        {
          key: 'invoices',
          label: '采购发票',
          children: docLinks(data.purchaseInvoices, '/purchase/invoices'),
        },
        {
          key: 'payments',
          label: '供应商付款',
          children: timelineDocLinks(timelineEvents, 'payment_entry'),
        },
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
        {
          key: 'remarks',
          label: '备注',
          children: data.remarks || '-',
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
            <Card title="金额概览" variant="borderless">
              <Row gutter={[24, 16]}>
                <Col lg={6} sm={12} xs={24}>
                  <Statistic
                    styles={{ content: { fontSize: 24, fontWeight: 600 } }}
                    title="订单金额"
                    value={formatCurrencyValue(data.amount, data.currency)}
                  />
                  <Typography.Text type="secondary">
                    当前订单商品与税费合计
                  </Typography.Text>
                </Col>
                <Col lg={6} sm={12} xs={24}>
                  <Statistic
                    styles={{ content: { fontSize: 22, fontWeight: 600 } }}
                    title="应付金额"
                    value={formatCurrencyValue(data.amount, data.currency)}
                  />
                  <Typography.Text type="secondary">
                    按订单/发票口径汇总
                  </Typography.Text>
                </Col>
                <Col lg={6} sm={12} xs={24}>
                  <Statistic
                    styles={{
                      content: {
                        color: '#389e0d',
                        fontSize: 22,
                        fontWeight: 600,
                      },
                    }}
                    title="已付金额"
                    value={formatCurrencyValue(data.paidAmount, data.currency)}
                  />
                  <Progress
                    percent={toPercent(data.paidAmount, data.amount)}
                    size="small"
                    status="success"
                  />
                </Col>
                <Col lg={6} sm={12} xs={24}>
                  <Statistic
                    styles={{
                      content: {
                        color:
                          (data.outstandingAmount ?? 0) > 0
                            ? '#cf1322'
                            : '#389e0d',
                        fontSize: 24,
                        fontWeight: 700,
                      },
                    }}
                    title="未付金额"
                    value={formatCurrencyValue(
                      data.outstandingAmount,
                      data.currency,
                    )}
                  />
                  <Typography.Text
                    type={
                      (data.outstandingAmount ?? 0) > 0 ? 'danger' : 'secondary'
                    }
                  >
                    {(data.outstandingAmount ?? 0) > 0
                      ? '仍需跟进付款'
                      : '当前已结清'}
                  </Typography.Text>
                </Col>
              </Row>
            </Card>

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

                  <Card title="业务时间线" variant="borderless">
                    {timelineEvents.length ? (
                      <Timeline
                        items={timelineEvents.map((event) => {
                          const path = documentPath(
                            event.doctype,
                            event.docname,
                          );
                          const relatedPath = documentPath(
                            event.relatedDoctype,
                            event.relatedDocname,
                          );
                          return {
                            color: timelineColor(event),
                            content: (
                              <Space orientation="vertical" size={4}>
                                <Space wrap>
                                  <Typography.Text strong>
                                    {event.title || event.type}
                                  </Typography.Text>
                                  {path ? (
                                    <Link to={path}>{event.docname}</Link>
                                  ) : (
                                    <Typography.Text>
                                      {event.docname}
                                    </Typography.Text>
                                  )}
                                  {event.status ? (
                                    <StatusTag value={event.status} />
                                  ) : null}
                                </Space>
                                <Typography.Text type="secondary">
                                  {timelineEventDescription(
                                    event,
                                    data.currency,
                                  )}
                                </Typography.Text>
                                {event.relatedDocname ? (
                                  <Typography.Text type="secondary">
                                    关联：
                                    {relatedPath ? (
                                      <Link to={relatedPath}>
                                        {event.relatedDocname}
                                      </Link>
                                    ) : (
                                      event.relatedDocname
                                    )}
                                  </Typography.Text>
                                ) : null}
                              </Space>
                            ),
                          };
                        })}
                      />
                    ) : (
                      <Empty description="暂无业务时间线" />
                    )}
                  </Card>

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
        confirmLoading={actionLoading === 'payment'}
        destroyOnHidden
        okText="确认付款"
        onCancel={() => setPaymentModalOpen(false)}
        onOk={submitRecordPayment}
        open={paymentModalOpen}
        title={
          (data?.purchaseInvoices?.length ?? 0) > 1
            ? `选择采购发票并记录付款 ${data?.name ?? ''}`
            : `记录付款 ${paymentDraft.referenceName || ''}`
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
          onChange={setPaymentDraft}
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
