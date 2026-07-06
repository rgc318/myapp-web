import { PageContainer, ProTable } from '@ant-design/pro-components';
import { history, Link, useLocation, useParams, useRequest } from '@umijs/max';
import type { DescriptionsProps } from 'antd';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Empty,
  Image,
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
import { SALES_RETURN_REFUND_ENTRY_ENABLED } from '@/config/feature-flags';
import {
  cancelSalesOrder,
  cancelSalesPaymentEntry,
  createSalesOrderInvoice,
  getSalesInvoiceDetail,
  getSalesOrderDetail,
  quickCancelSalesOrderV2,
  recordSalesOrderPayment,
  type SalesOrderDetail,
  type SalesOrderDetailItem,
  type SalesOrderTimelineEvent,
  salesOrderEditDisabledReason,
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

function timelineDocLinks(
  events: SalesOrderTimelineEvent[],
  type: SalesOrderTimelineEvent['type'],
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

function documentPath(doctype: string, docname: string) {
  if (!docname) {
    return '';
  }
  if (doctype === 'Delivery Note') {
    return `/sales/delivery-notes/${encodeURIComponent(docname)}`;
  }
  if (doctype === 'Sales Invoice') {
    return `/sales/invoices/${encodeURIComponent(docname)}`;
  }
  if (doctype === 'Payment Entry') {
    return `/payments/${encodeURIComponent(docname)}`;
  }
  if (doctype === 'Sales Order') {
    return `/sales/orders/${encodeURIComponent(docname)}`;
  }
  return '';
}

type SalesReturnSourceOption = {
  doctype: 'Sales Invoice' | 'Delivery Note';
  label: string;
  name: string;
};

type RollbackPaymentEntry = {
  amount: number | null;
  date: string;
  modeOfPayment: string;
  paymentEntry: string;
};

export function buildSalesReturnSourceOptions(
  detail?: SalesOrderDetail | null,
): SalesReturnSourceOption[] {
  if (!detail) {
    return [];
  }

  if (detail.salesInvoices.length) {
    return detail.salesInvoices.map((name) => ({
      doctype: 'Sales Invoice' as const,
      label: '销售发票',
      name,
    }));
  }

  return detail.deliveryNotes.map((name) => ({
    doctype: 'Delivery Note' as const,
    label: '销售发货单',
    name,
  }));
}

function salesReturnSourcePath(source: SalesReturnSourceOption) {
  return `/sales/returns/new?sourceDoctype=${encodeURIComponent(source.doctype)}&sourceName=${encodeURIComponent(source.name)}`;
}

function customerRefundReviewPath(returnInvoice: string) {
  return `/sales/refunds/review?returnInvoice=${encodeURIComponent(returnInvoice)}`;
}

function timelineColor(event: SalesOrderTimelineEvent) {
  if (event.status === 'cancelled') {
    return 'red';
  }
  if (event.type === 'customer_refund') {
    return 'purple';
  }
  if (event.type === 'payment_entry') {
    return 'green';
  }
  if (event.type === 'sales_return') {
    return 'orange';
  }
  return 'blue';
}

function timelineEventDescription(
  event: SalesOrderTimelineEvent,
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

function toQty(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
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

function getErrorMessage(error: unknown, fallback = '操作失败') {
  return error instanceof Error ? error.message : fallback;
}

function isStockShortageError(error: unknown) {
  const errorMessage = getErrorMessage(error, '');
  return (
    errorMessage.includes('库存不足') || errorMessage.includes('可用库存不足')
  );
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
        rate: item.rate,
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
  if (step === 'customer_refund') {
    return '客户退款';
  }
  if (step === 'payment_entry') {
    return '收款单';
  }
  if (step === 'sales_return') {
    return '退货发票';
  }
  if (step === 'sales_invoice') {
    return '销售发票';
  }
  if (step === 'delivery_note') {
    return '销售发货单';
  }
  return step;
}

function hasRollbackableDownstream(detail: SalesOrderDetail) {
  if (detail.deliveryNotes.length || detail.salesInvoices.length) {
    return true;
  }

  return detail.timeline.some((event) => {
    if (!event.docname) {
      return false;
    }
    if (
      !['customer_refund', 'payment_entry', 'sales_return'].includes(event.type)
    ) {
      return false;
    }
    return !['cancelled', 'canceled', '已作废'].includes(event.status);
  });
}

function hasCustomerPayment(detail: SalesOrderDetail) {
  return Boolean(
    (detail.paidAmount ?? 0) > 0 ||
      detail.paymentStatus === 'paid' ||
      detail.timeline.some(
        (event) => event.type === 'payment_entry' && event.docname,
      ),
  );
}

function getRollbackPaymentEntries(
  detail: SalesOrderDetail | null | undefined,
  cancelledPaymentEntries: Set<string> = new Set(),
): RollbackPaymentEntry[] {
  if (!detail) {
    return [];
  }

  const entries = detail.timeline
    .filter(
      (event) =>
        event.type === 'payment_entry' &&
        event.docname &&
        !cancelledPaymentEntries.has(event.docname) &&
        !['cancelled', 'canceled', '已作废'].includes(event.status),
    )
    .map((event) => ({
      amount: event.amount,
      date: event.date,
      modeOfPayment: event.modeOfPayment,
      paymentEntry: event.docname,
    }));

  return Array.from(
    new Map(entries.map((entry) => [entry.paymentEntry, entry])).values(),
  );
}

function actionTargetLabel(actionTarget: string | null) {
  if (actionTarget === 'delivery') {
    return '创建发货单';
  }
  if (actionTarget === 'invoice') {
    return '创建销售发票';
  }
  if (actionTarget === 'payment') {
    return '登记客户收款';
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

function quickBillDisabledReason(detail: SalesOrderDetail) {
  if (detail.canCreateSalesInvoice) {
    return '';
  }
  if (detail.documentStatus === 'cancelled') {
    return '订单已作废，不能一键开单';
  }
  if (detail.documentStatus !== 'submitted') {
    return '只有已提交的销售订单才能一键开单';
  }
  if (detail.salesInvoices.length) {
    return '当前订单已存在销售发票';
  }
  return invoiceDisabledReason(detail) || '当前订单暂不满足一键开单条件';
}

function paymentDisabledReason(detail: SalesOrderDetail) {
  if (detail.canRecordPayment) {
    return '';
  }
  if (detail.documentStatus === 'cancelled') {
    return '订单已作废，不能登记客户收款';
  }
  if (!detail.salesInvoices.length) {
    return '请先创建销售发票后再登记客户收款';
  }
  if ((detail.outstandingAmount ?? 0) <= 0) {
    return '当前订单已结清，没有可登记的客户收款';
  }
  return '当前订单暂不满足登记客户收款条件';
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

function readMutationName(data: unknown, key: string) {
  if (!data || typeof data !== 'object') {
    return '';
  }
  const value = (data as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

function showActionResult({
  actionText,
  detailPath,
  documentName,
  documentText,
  nextAction,
}: {
  actionText: string;
  detailPath?: string;
  documentName?: string;
  documentText: string;
  nextAction?: React.ReactNode;
}) {
  Modal.success({
    content: (
      <Space orientation="vertical" size={8}>
        {documentName ? (
          <span>
            {documentText}：
            {detailPath ? (
              <Link to={`${detailPath}/${encodeURIComponent(documentName)}`}>
                {documentName}
              </Link>
            ) : (
              documentName
            )}
          </span>
        ) : (
          <span>{documentText}已生成，详情刷新后可查看。</span>
        )}
        {nextAction ? <span>{nextAction}</span> : null}
      </Space>
    ),
    title: `${actionText}成功`,
  });
}

function salesOrderProgress(detail: SalesOrderDetail) {
  if (detail.documentStatus === 'cancelled') {
    return {
      current: 0,
      status: 'error' as const,
    };
  }
  if (detail.completionStatus === 'completed') {
    return {
      current: 4,
      status: 'finish' as const,
    };
  }
  if (detail.paymentStatus === 'paid') {
    return {
      current: 4,
      status: 'process' as const,
    };
  }
  if (detail.salesInvoices.length || detail.paymentStatus !== 'unpaid') {
    return {
      current: 3,
      status: 'process' as const,
    };
  }
  if (detail.fulfillmentStatus === 'shipped') {
    return {
      current: 2,
      status: 'process' as const,
    };
  }
  if (detail.documentStatus === 'submitted') {
    return {
      current: 1,
      status: 'process' as const,
    };
  }
  return {
    current: 0,
    status: 'process' as const,
  };
}

const itemColumns = [
  {
    title: '商品信息',
    dataIndex: 'itemName',
    width: 320,
    render: (_: unknown, record: SalesOrderDetailItem) => (
      <Space align="start" size={12}>
        {record.imageUrl ? (
          <Image
            alt={record.itemName || record.itemCode}
            height={56}
            preview={false}
            src={record.imageUrl}
            style={{ objectFit: 'cover' }}
            width={56}
          />
        ) : (
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
        )}
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>{record.itemName}</Typography.Text>
          <Typography.Text type="secondary">{record.itemCode}</Typography.Text>
          {record.specification ? (
            <Typography.Text type="secondary">
              {record.specification}
            </Typography.Text>
          ) : null}
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
    title: '已发数量',
    dataIndex: 'deliveredQty',
    align: 'right' as const,
    width: 110,
  },
  {
    title: '待发数量',
    dataIndex: 'pendingDeliveryQty',
    align: 'right' as const,
    width: 110,
    render: (_: unknown, record: SalesOrderDetailItem) =>
      Math.max(toQty(record.qty) - toQty(record.deliveredQty), 0),
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
];

const SalesOrderDetailPage: React.FC = () => {
  const params = useParams();
  const location = useLocation();
  const orderName = decodeURIComponent(String(params.name ?? ''));
  const actionPanelRef = useRef<HTMLDivElement | null>(null);
  const [actionLoading, setActionLoading] = useState<string>();
  const [paymentDraft, setPaymentDraft] = useState<InvoicePaymentDraft>({
    amount: 0,
    modeOfPayment: '',
    referenceName: '',
  });
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [rollbackCancelledPayments, setRollbackCancelledPayments] = useState<
    Set<string>
  >(new Set());
  const [rollbackPaymentCancelling, setRollbackPaymentCancelling] = useState<
    string | null
  >(null);
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

  useEffect(() => {
    setRollbackCancelledPayments(new Set());
  }, [detail?.name]);

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
    if (!detail) {
      return;
    }

    const shouldCreateDelivery = detail.canSubmitDelivery;
    const steps = shouldCreateDelivery
      ? '系统会先按当前待发数量创建销售发货单，再创建销售发票。'
      : '系统会基于当前订单创建销售发票，不会重复创建发货单。';

    const runQuickBill = async (forceDelivery = false) => {
      let deliveryNoteName = '';
      let salesInvoiceName = '';

      if (shouldCreateDelivery) {
        const deliveryResult = await submitSalesOrderDelivery(detail.name, {
          forceDelivery,
        });
        deliveryNoteName = readMutationName(
          deliveryResult.data,
          'delivery_note',
        );
      }

      const invoiceResult = await createSalesOrderInvoice(detail.name);
      salesInvoiceName = readMutationName(invoiceResult.data, 'sales_invoice');
      refresh();

      Modal.success({
        content: (
          <Space orientation="vertical" size={8}>
            {deliveryNoteName ? (
              <span>
                销售发货单：
                <Link
                  to={`/sales/delivery-notes/${encodeURIComponent(
                    deliveryNoteName,
                  )}`}
                >
                  {deliveryNoteName}
                </Link>
              </span>
            ) : null}
            {salesInvoiceName ? (
              <span>
                销售发票：
                <Link
                  to={`/sales/invoices/${encodeURIComponent(salesInvoiceName)}`}
                >
                  {salesInvoiceName}
                </Link>
              </span>
            ) : (
              <span>销售发票已生成，详情刷新后可查看。</span>
            )}
            <span>如需收款，可继续在订单或销售发票页面登记客户收款。</span>
          </Space>
        ),
        title: forceDelivery ? '强制一键开单成功' : '一键开单成功',
      });
    };

    Modal.confirm({
      cancelText: '取消',
      content: (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            description="一键开单适合整单快速履约。若需要部分发货、部分开票或调整明细数量，请继续使用分步的创建发货单和创建销售发票。"
            showIcon
            title={steps}
            type="info"
          />
          <Descriptions
            column={1}
            items={[
              {
                key: 'order',
                label: '销售订单',
                children: detail.name,
              },
              {
                key: 'amount',
                label: '订单金额',
                children: formatCurrencyValue(detail.amount, detail.currency),
              },
              {
                key: 'delivery',
                label: '发货动作',
                children: shouldCreateDelivery
                  ? '创建销售发货单'
                  : '跳过，当前无需创建发货单',
              },
              {
                key: 'invoice',
                label: '开票动作',
                children: '创建销售发票',
              },
            ]}
            size="small"
          />
        </Space>
      ),
      okText: shouldCreateDelivery ? '确认发货并开票' : '确认创建销售发票',
      onOk: async () => {
        setActionLoading('quick-bill');
        try {
          await runQuickBill();
        } catch (caught) {
          if (shouldCreateDelivery && isStockShortageError(caught)) {
            Modal.confirm({
              cancelText: '取消',
              content: (
                <Alert
                  description="强制一键开单会跳过库存预检并继续创建发货单和销售发票，可能造成负库存或库存账实不一致。仅在仓库实物已确认出货、后续会补录库存或业务明确允许时使用。"
                  showIcon
                  title={getErrorMessage(caught, '当前可用库存不足')}
                  type="warning"
                />
              ),
              okText: '强制发货并开票',
              okType: 'danger',
              onOk: async () => {
                setActionLoading('quick-bill');
                try {
                  await runQuickBill(true);
                } catch (forceCaught) {
                  message.error(getErrorMessage(forceCaught));
                  throw forceCaught;
                } finally {
                  setActionLoading(undefined);
                }
              },
              title: '库存不足，是否强制一键开单？',
              width: 560,
            });
            return;
          }

          message.error(getErrorMessage(caught));
          throw caught;
        } finally {
          setActionLoading(undefined);
        }
      },
      title: `一键开单 ${detail.name}`,
      width: 640,
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

    const defaultDeliveryLines = selectedRows.filter(
      (row) => row.actionQty > 0,
    );
    const defaultDeliveryQty = defaultDeliveryLines.reduce(
      (total, row) => total + toQty(row.actionQty),
      0,
    );

    Modal.confirm({
      cancelText: '取消',
      content: (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            description={`系统默认按当前待发数量创建发货单，已完成发货的商品不会出现在本次明细中。数量可以调整为部分发货，填 0 的行不会提交。`}
            showIcon
            title={`默认本次发货 ${defaultDeliveryLines.length} 种商品，共 ${defaultDeliveryQty} 件`}
            type="info"
          />
          <Row gutter={12}>
            <Col md={8} xs={24}>
              <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                <Typography.Text type="secondary">发货日期</Typography.Text>
                <DatePicker
                  defaultValue={dayjs(postingDate)}
                  onChange={(value) => {
                    postingDate = value?.format('YYYY-MM-DD') ?? '';
                  }}
                  style={{ width: '100%' }}
                />
              </Space>
            </Col>
            <Col md={16} xs={24}>
              <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                <Typography.Text type="secondary">备注</Typography.Text>
                <Input.TextArea
                  autoSize={{ minRows: 1, maxRows: 3 }}
                  onChange={(event) => {
                    remarks = event.target.value;
                  }}
                  placeholder="填写给仓库或财务查看的发货备注"
                />
              </Space>
            </Col>
          </Row>
          <LineQtyEditor
            actionTitle="本次发货"
            amountTitle="本次发货金额"
            completedTitle="已发货"
            currency={detail.currency}
            maxTitle="待发数量"
            onChange={(rows) => {
              selectedRows = rows;
            }}
            rows={selectedRows}
            showAmount
            showMaxQty
            summaryLabel="合计"
          />
          <Typography.Text type="secondary">
            本次发货数量不能超过待发数量；如需跳过某个商品，将本次发货数量改为
            0。
          </Typography.Text>
        </Space>
      ),
      okText: '确认创建发货单',
      onOk: async () => {
        const deliveryItems = toSalesActionItems(selectedRows);
        if (!deliveryItems.length) {
          message.error('请至少填写一条本次发货数量');
          throw new Error('No delivery items selected');
        }

        const submitDelivery = async (forceDelivery = false) => {
          const result = await submitSalesOrderDelivery(detail.name, {
            deliveryItems,
            forceDelivery,
            postingDate,
            remarks,
          });
          refresh();
          const deliveryNoteName = readMutationName(
            result.data,
            'delivery_note',
          );
          showActionResult({
            actionText: forceDelivery ? '强制创建发货单' : '创建发货单',
            detailPath: '/sales/delivery-notes',
            documentName: deliveryNoteName,
            documentText: '销售发货单',
            nextAction: forceDelivery
              ? '本次为强制发货，请后续核对库存和出入库记录。'
              : '如需继续开票，可在订单详情刷新后创建销售发票。',
          });
        };

        setActionLoading('delivery');
        try {
          await submitDelivery();
        } catch (caught) {
          if (isStockShortageError(caught)) {
            Modal.confirm({
              cancelText: '取消',
              content: (
                <Alert
                  description="强制创建发货单会跳过库存预检，可能造成负库存或库存账实不一致。仅在仓库实物已确认出货、后续会补录库存或业务明确允许时使用。"
                  showIcon
                  title={getErrorMessage(caught, '当前可用库存不足')}
                  type="warning"
                />
              ),
              okText: '强制创建发货单',
              okType: 'danger',
              onOk: async () => {
                setActionLoading('delivery');
                try {
                  await submitDelivery(true);
                } catch (forceCaught) {
                  message.error(getErrorMessage(forceCaught));
                  throw forceCaught;
                } finally {
                  setActionLoading(undefined);
                }
              },
              title: '库存不足，是否强制创建发货单？',
              width: 560,
            });
            return;
          }

          message.error(getErrorMessage(caught));
          throw caught;
        } finally {
          setActionLoading(undefined);
        }
      },
      title: `创建销售发货单 ${detail.name}`,
      width: 960,
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
          const result = await createSalesOrderInvoice(detail.name, {
            invoiceItems,
            remarks,
          });
          refresh();
          const salesInvoiceName = readMutationName(
            result.data,
            'sales_invoice',
          );
          showActionResult({
            actionText: '创建销售发票',
            detailPath: '/sales/invoices',
            documentName: salesInvoiceName,
            documentText: '销售发票',
            nextAction: '如需继续收款，可在订单详情刷新后登记客户收款。',
          });
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
      message.error('收款金额必须大于 0 且不能超过未收金额');
      throw new Error('Invalid payment amount');
    }
    if (!paymentDraft.referenceName) {
      message.error('请选择销售发票');
      throw new Error('Missing payment reference');
    }

    setActionLoading('payment');
    try {
      const result = await recordSalesOrderPayment(
        paymentDraft.referenceName,
        paymentAmount,
        {
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
        },
      );
      setPaymentModalOpen(false);
      refresh();
      const paymentEntryName = readMutationName(result.data, 'payment_entry');
      showActionResult({
        actionText: '登记客户收款',
        documentName: paymentEntryName,
        documentText: '收款单',
        nextAction: (
          <span>
            可在 <Link to="/payments">收付款流水</Link> 中核对本次收款记录。
          </span>
        ),
      });
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '操作失败');
      throw caught;
    } finally {
      setActionLoading(undefined);
    }
  };

  const confirmQuickCancelDownstream = () => {
    if (!detail) {
      return;
    }
    if (!hasRollbackableDownstream(detail)) {
      message.warning('当前订单没有可回退的发货、开票或收款记录');
      return;
    }

    setRollbackModalOpen(true);
  };

  const submitQuickCancelDownstream = async (options?: {
    rollbackPayment?: boolean;
  }) => {
    if (!detail) {
      return;
    }

    setActionLoading('quick-cancel');
    try {
      const result = await quickCancelSalesOrderV2(detail.name || orderName, {
        rollbackPayment: options?.rollbackPayment,
      });
      setRollbackModalOpen(false);
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
                : '当前没有需要回退的发货、开票或收款记录。'}
            </span>
            {result.data.cancelledPaymentEntries.length ? (
              <span>
                收款单：{result.data.cancelledPaymentEntries.join('、')}
              </span>
            ) : null}
            {result.data.cancelledRefundEntries.length ? (
              <span>
                客户退款单：{result.data.cancelledRefundEntries.join('、')}
              </span>
            ) : null}
            {result.data.cancelledReturnInvoices.length ? (
              <span>
                退货发票：{result.data.cancelledReturnInvoices.join('、')}
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
            <SalesRollbackGuide
              deliveryNotes={detail.deliveryNotes}
              salesInvoices={detail.salesInvoices}
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
      await cancelSalesPaymentEntry(paymentEntry);
      setRollbackCancelledPayments((current) => {
        const next = new Set(current);
        next.add(paymentEntry);
        return next;
      });
      message.success(`已取消客户收款 ${paymentEntry}`);
      refresh();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '操作失败');
      throw caught;
    } finally {
      setRollbackPaymentCancelling(null);
    }
  };

  const confirmSubmitQuickCancelDownstream = () => {
    if (!detail) {
      return;
    }

    const activePaymentEntries = getRollbackPaymentEntries(
      detail,
      rollbackCancelledPayments,
    );
    const originalPaymentEntryCount = getRollbackPaymentEntries(detail).length;
    if (originalPaymentEntryCount > 1 && activePaymentEntries.length > 0) {
      message.warning('请先逐笔取消客户收款，再继续回退发票和发货单');
      return;
    }

    if (!activePaymentEntries.length) {
      void submitQuickCancelDownstream({ rollbackPayment: false });
      return;
    }

    if (!hasCustomerPayment(detail)) {
      void submitQuickCancelDownstream({ rollbackPayment: false });
      return;
    }

    Modal.confirm({
      cancelText: '取消',
      content: (
        <Alert
          description="当前订单已经存在客户收款。一键回退会先作废相关客户收款凭证，再继续作废销售发票和销售发货单；这不是客户退款流程，也不会保留原收款单。若当前订单存在多笔有效收款，后端仍会拒绝快捷回退，请改用分步回退。"
          title="请确认是否同步取消客户收款"
          showIcon
          type="warning"
        />
      ),
      okButtonProps: { danger: true },
      okText: '取消收款并一键回退',
      onOk: () => submitQuickCancelDownstream({ rollbackPayment: true }),
      style: { top: 'min(32vh, 320px)' },
      title: '强制回退已收款订单？',
      width: 560,
    });
  };

  const pageDescriptionItems: DescriptionsProps['items'] = detail
    ? [
        {
          key: 'customer',
          label: '客户',
          children: detail.customer,
        },
        {
          key: 'company',
          label: '公司',
          children: detail.company,
        },
        {
          key: 'transactionDate',
          label: '订单日期',
          children: detail.transactionDate,
        },
        {
          key: 'deliveryDate',
          label: '交货日期',
          children: detail.deliveryDate,
        },
      ]
    : [];
  const basicItems: DescriptionsProps['items'] = detail
    ? [
        {
          key: 'documentStatus',
          label: '单据状态',
          children: <StatusTag value={detail.documentStatus} />,
        },
        {
          key: 'fulfillmentStatus',
          label: '履约状态',
          children: <StatusTag value={detail.fulfillmentStatus} />,
        },
        {
          key: 'paymentStatus',
          label: '收款状态',
          children: <StatusTag value={detail.paymentStatus} />,
        },
        {
          key: 'completionStatus',
          label: '完成状态',
          children: <StatusTag value={detail.completionStatus} />,
        },
        {
          key: 'currency',
          label: '币种',
          children: formatCurrencyCode(detail.currency),
        },
      ]
    : [];
  const shippingItems: DescriptionsProps['items'] = detail
    ? [
        {
          key: 'contactDisplay',
          label: '联系人',
          children: detail.contactDisplay || '无',
        },
        {
          key: 'contactPhone',
          label: '联系电话',
          children: detail.contactPhone || '无',
        },
        {
          key: 'addressDisplay',
          label: '收货地址',
          children: detail.addressDisplay || '无',
        },
        {
          key: 'remarks',
          label: '备注',
          children: detail.remarks || '无',
        },
      ]
    : [];
  const timelineEvents = detail?.timeline ?? [];
  const rollbackPaymentEntries = getRollbackPaymentEntries(
    detail,
    rollbackCancelledPayments,
  );
  const rollbackOriginalPaymentCount = getRollbackPaymentEntries(detail).length;
  const rollbackRequiresManualPaymentCleanup =
    rollbackOriginalPaymentCount > 1 && rollbackPaymentEntries.length > 0;
  const canQuickCancelDownstream = detail
    ? hasRollbackableDownstream(detail)
    : false;
  const editDisabledReason = detail ? salesOrderEditDisabledReason(detail) : '';
  const returnInvoiceNames = timelineEvents
    .filter((event) => event.type === 'sales_return' && event.docname)
    .map((event) => event.docname);
  const returnSourceOptions = buildSalesReturnSourceOptions(detail);
  const openReturnSource = () => {
    if (!returnSourceOptions.length) {
      return;
    }
    if (returnSourceOptions.length === 1) {
      history.push(salesReturnSourcePath(returnSourceOptions[0]));
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
                history.push(salesReturnSourcePath(source));
              }}
            >
              {source.label} {source.name}
            </Button>
          ))}
        </Space>
      ),
      title: '选择退货来源单据',
      width: 520,
    });
  };
  const openRefundReview = () => {
    if (!returnInvoiceNames.length) {
      return;
    }
    if (returnInvoiceNames.length === 1) {
      history.push(customerRefundReviewPath(returnInvoiceNames[0]));
      return;
    }
    Modal.info({
      content: (
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          {returnInvoiceNames.map((name) => (
            <Button
              block
              key={name}
              onClick={() => {
                Modal.destroyAll();
                history.push(customerRefundReviewPath(name));
              }}
            >
              退货发票 {name}
            </Button>
          ))}
        </Space>
      ),
      title: '选择需要核对退款的退货发票',
      width: 520,
    });
  };
  const referenceItems: DescriptionsProps['items'] = detail
    ? [
        {
          key: 'deliveryNotes',
          label: '发货单',
          children: docLinks(detail.deliveryNotes, '/sales/delivery-notes'),
        },
        {
          key: 'salesInvoices',
          label: '销售发票',
          children: docLinks(detail.salesInvoices, '/sales/invoices'),
        },
        {
          key: 'paymentEntries',
          label: '收款单',
          children: timelineDocLinks(timelineEvents, 'payment_entry'),
        },
        ...(SALES_RETURN_REFUND_ENTRY_ENABLED
          ? [
              {
                key: 'salesReturns',
                label: '退货发票',
                children: timelineDocLinks(timelineEvents, 'sales_return'),
              },
              {
                key: 'customerRefunds',
                label: '退款单',
                children: timelineDocLinks(timelineEvents, 'customer_refund'),
              },
            ]
          : []),
      ]
    : [];
  const progress = detail ? salesOrderProgress(detail) : null;
  const rollbackPaymentColumns = [
    {
      title: '收款单',
      dataIndex: 'paymentEntry',
      ellipsis: true,
      width: 190,
      render: (_: unknown, record: RollbackPaymentEntry) => (
        <Link to={`/payments/${encodeURIComponent(record.paymentEntry)}`}>
          {record.paymentEntry}
        </Link>
      ),
    },
    {
      title: '日期',
      dataIndex: 'date',
      width: 110,
      render: (_: unknown, record: RollbackPaymentEntry) => record.date || '-',
    },
    {
      title: '方式',
      dataIndex: 'modeOfPayment',
      ellipsis: true,
      width: 120,
      render: (_: unknown, record: RollbackPaymentEntry) =>
        record.modeOfPayment || '-',
    },
    {
      title: '金额',
      dataIndex: 'amount',
      align: 'right' as const,
      width: 115,
      render: (_: unknown, record: RollbackPaymentEntry) =>
        formatCurrencyValue(record.amount, detail?.currency),
    },
    {
      title: '操作',
      valueType: 'option' as const,
      width: 110,
      render: (_: unknown, record: RollbackPaymentEntry) => (
        <Button
          danger
          loading={rollbackPaymentCancelling === record.paymentEntry}
          onClick={() => cancelRollbackPaymentEntry(record.paymentEntry)}
          size="small"
          type="link"
        >
          取消收款
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageContainer
        title={detail?.name || orderName || '销售订单详情'}
        content={
          detail ? (
            <Descriptions
              column={2}
              items={pageDescriptionItems}
              size="small"
            />
          ) : undefined
        }
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
            <Card variant="borderless">
              <Skeleton active paragraph={{ rows: 8 }} />
            </Card>
          ) : null}

          {!loading && !error && !detail ? (
            <Card variant="borderless">
              <Empty description="未找到销售订单" />
            </Card>
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

              <Card title="金额概览" variant="borderless">
                <Row gutter={[24, 16]}>
                  <Col lg={6} sm={12} xs={24}>
                    <Statistic
                      styles={{ content: { fontSize: 24, fontWeight: 600 } }}
                      title="订单金额"
                      value={formatCurrencyValue(
                        detail.amount,
                        detail.currency,
                      )}
                    />
                    <Typography.Text type="secondary">
                      当前订单商品与税费合计
                    </Typography.Text>
                  </Col>
                  <Col lg={6} sm={12} xs={24}>
                    <Statistic
                      styles={{ content: { fontSize: 22, fontWeight: 600 } }}
                      title="应收金额"
                      value={formatCurrencyValue(
                        detail.receivableAmount,
                        detail.currency,
                      )}
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
                      title="已收金额"
                      value={formatCurrencyValue(
                        detail.paidAmount,
                        detail.currency,
                      )}
                    />
                    <Progress
                      percent={toPercent(
                        detail.paidAmount,
                        detail.receivableAmount || detail.amount,
                      )}
                      size="small"
                      status="success"
                    />
                  </Col>
                  <Col lg={6} sm={12} xs={24}>
                    <Statistic
                      styles={{
                        content: {
                          color:
                            (detail.outstandingAmount ?? 0) > 0
                              ? '#cf1322'
                              : '#389e0d',
                          fontSize: 24,
                          fontWeight: 700,
                        },
                      }}
                      title="未收金额"
                      value={formatCurrencyValue(
                        detail.outstandingAmount,
                        detail.currency,
                      )}
                    />
                    <Typography.Text
                      type={
                        (detail.outstandingAmount ?? 0) > 0
                          ? 'danger'
                          : 'secondary'
                      }
                    >
                      {(detail.outstandingAmount ?? 0) > 0
                        ? '仍需跟进收款'
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
                            content: detail.transactionDate,
                          },
                          {
                            title: '提交订单',
                            content: (
                              <StatusTag value={detail.documentStatus} />
                            ),
                          },
                          {
                            title: '发货',
                            content: (
                              <StatusTag value={detail.fulfillmentStatus} />
                            ),
                          },
                          {
                            title: '开票',
                            content: detail.salesInvoices.length
                              ? `${detail.salesInvoices.length} 张销售发票`
                              : '未开票',
                          },
                          {
                            title: '收款完成',
                            content: <StatusTag value={detail.paymentStatus} />,
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
                                      detail.currency,
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

                    <ProTable<SalesOrderDetailItem>
                      columns={itemColumns}
                      dataSource={detail.items}
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
                    <Card
                      ref={actionPanelRef}
                      title={
                        actionTargetText
                          ? `履约动作（当前入口：${actionTargetText}）`
                          : '履约动作'
                      }
                      variant="borderless"
                    >
                      <Space wrap>
                        <Tooltip title={editDisabledReason}>
                          <span>
                            <Button
                              disabled={Boolean(editDisabledReason)}
                              onClick={() => {
                                if (!editDisabledReason) {
                                  history.push(
                                    `/sales/orders/${encodeURIComponent(
                                      detail.name,
                                    )}/edit`,
                                  );
                                }
                              }}
                            >
                              编辑订单
                            </Button>
                          </span>
                        </Tooltip>
                        <Tooltip title={deliveryDisabledReason(detail)}>
                          <span>
                            <Button
                              disabled={!detail.canSubmitDelivery}
                              loading={actionLoading === 'delivery'}
                              onClick={confirmSubmitDelivery}
                              type={
                                actionTarget === 'delivery'
                                  ? 'primary'
                                  : 'default'
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
                                actionTarget === 'invoice'
                                  ? 'primary'
                                  : 'default'
                              }
                            >
                              创建销售发票
                            </Button>
                          </span>
                        </Tooltip>
                        <Tooltip title={quickBillDisabledReason(detail)}>
                          <span>
                            <Button
                              disabled={!detail.canCreateSalesInvoice}
                              loading={actionLoading === 'quick-bill'}
                              onClick={confirmQuickBill}
                              type="primary"
                            >
                              一键开单
                            </Button>
                          </span>
                        </Tooltip>
                        <Tooltip title={paymentDisabledReason(detail)}>
                          <span>
                            <Button
                              disabled={!detail.canRecordPayment}
                              loading={actionLoading === 'payment'}
                              onClick={confirmRecordPayment}
                              type={
                                actionTarget === 'payment'
                                  ? 'primary'
                                  : 'default'
                              }
                            >
                              登记客户收款
                            </Button>
                          </span>
                        </Tooltip>
                        {SALES_RETURN_REFUND_ENTRY_ENABLED ? (
                          <Tooltip
                            title={
                              detail.salesInvoices.length ||
                              detail.deliveryNotes.length
                                ? ''
                                : '需要先完成发货或开票后再发起退货'
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
                        ) : null}
                        {SALES_RETURN_REFUND_ENTRY_ENABLED ? (
                          <Tooltip
                            title={
                              returnInvoiceNames.length
                                ? ''
                                : '退款核对仅用于已有退货发票后的客户退款；普通收款回退请进入销售发票详情取消客户收款'
                            }
                          >
                            <span>
                              <Button
                                disabled={!returnInvoiceNames.length}
                                onClick={openRefundReview}
                              >
                                退款核对
                              </Button>
                            </span>
                          </Tooltip>
                        ) : null}
                        <Tooltip
                          title={
                            canQuickCancelDownstream
                              ? ''
                              : '当前订单没有可回退的发货、开票或收款记录'
                          }
                        >
                          <span>
                            <Button
                              danger
                              disabled={!canQuickCancelDownstream}
                              loading={actionLoading === 'quick-cancel'}
                              onClick={confirmQuickCancelDownstream}
                            >
                              回退并修改订单
                            </Button>
                          </span>
                        </Tooltip>
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
                    </Card>

                    <Card title="基本信息" variant="borderless">
                      <Descriptions column={1} items={basicItems} />
                    </Card>

                    <Card title="关联单据" variant="borderless">
                      <Descriptions column={1} items={referenceItems} />
                    </Card>

                    <Card title="收货信息" variant="borderless">
                      <Descriptions column={1} items={shippingItems} />
                    </Card>
                  </Space>
                </Col>
              </Row>
            </>
          ) : null}
        </Space>
      </PageContainer>
      <Modal
        cancelText="取消"
        confirmLoading={actionLoading === 'payment'}
        destroyOnHidden
        okText="确认登记"
        onCancel={() => setPaymentModalOpen(false)}
        onOk={submitRecordPayment}
        open={paymentModalOpen}
        title={
          (detail?.salesInvoices.length ?? 0) > 1
            ? `选择销售发票并登记客户收款 ${detail?.name ?? ''}`
            : `登记客户收款 ${paymentDraft.referenceName || detail?.salesInvoices[0] || ''}`
        }
        width={520}
      >
        {detail ? (
          <InvoicePaymentForm
            detailBasePath="/sales/invoices"
            invoices={detail.salesInvoices}
            label="销售发票"
            loadOutstandingAmount={async (invoiceName) => {
              const invoice = await getSalesInvoiceDetail(invoiceName);
              if (!invoice?.canRecordPayment) {
                return 0;
              }
              return invoice.outstandingAmount ?? 0;
            }}
            onChange={setPaymentDraft}
            showReferenceFields
            showSettlementMode
          />
        ) : null}
      </Modal>
      <Modal
        cancelText="取消"
        confirmLoading={actionLoading === 'quick-cancel'}
        destroyOnHidden
        okButtonProps={{
          danger: true,
          disabled: rollbackRequiresManualPaymentCleanup,
        }}
        okText={
          rollbackOriginalPaymentCount > 1
            ? '继续回退发票和发货单'
            : '一键回退并修改'
        }
        onCancel={() => setRollbackModalOpen(false)}
        onOk={confirmSubmitQuickCancelDownstream}
        open={rollbackModalOpen}
        title={`回退并修改销售订单 ${detail?.name || orderName}？`}
        width={760}
      >
        {detail ? (
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <span>
              系统会按顺序取消客户退款单、退货发票、客户收款单、销售发票和销售发货单，让订单回到可修改状态。若当前订单存在多张发票、发货单或多笔收款/退款，后端会拒绝一键回退。
            </span>
            {rollbackOriginalPaymentCount === 1 &&
            rollbackPaymentEntries.length ? (
              <Alert
                description="当前订单存在一笔客户收款。你可以先取消这笔收款后继续回退，也可以直接一键回退并在二次确认后由系统同步取消收款。"
                title="订单存在客户收款"
                showIcon
                type="warning"
              />
            ) : null}
            {rollbackOriginalPaymentCount > 1 ? (
              <Alert
                description="当前订单存在多笔客户收款。请先在下方逐笔取消客户收款，全部取消后再继续回退销售发票和销售发货单。"
                title="多笔收款需要逐笔处理"
                showIcon
                type="warning"
              />
            ) : null}
            {rollbackOriginalPaymentCount > 0 &&
            rollbackPaymentEntries.length ? (
              <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
                <ProTable<RollbackPaymentEntry>
                  columns={rollbackPaymentColumns}
                  dataSource={rollbackPaymentEntries}
                  headerTitle="客户收款"
                  options={false}
                  pagination={false}
                  rowKey="paymentEntry"
                  scroll={{ x: 645 }}
                  search={false}
                  size="small"
                  tableStyle={{ minWidth: 645 }}
                  toolBarRender={false}
                />
              </div>
            ) : null}
            {rollbackOriginalPaymentCount > 0 &&
            !rollbackPaymentEntries.length ? (
              <Alert
                description="客户收款已全部取消，可以继续回退销售发票和销售发货单。"
                title="收款已清理"
                showIcon
                type="success"
              />
            ) : null}
            <SalesRollbackGuide
              deliveryNotes={detail.deliveryNotes}
              salesInvoices={detail.salesInvoices}
            />
          </Space>
        ) : null}
      </Modal>
    </>
  );
};

export default SalesOrderDetailPage;
