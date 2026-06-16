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
  DatePicker,
  Empty,
  Input,
  InputNumber,
  Modal,
  message,
  Skeleton,
  Space,
} from 'antd';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import {
  buildLineQtyRow,
  LineQtyEditor,
  type LineQtyEditorRow,
} from '@/components/LineQtyEditor';
import { PaymentModeSelect } from '@/components/PaymentModeSelect';
import {
  cancelSalesOrder,
  createSalesOrderInvoice,
  getSalesOrderDetail,
  quickCancelSalesOrderV2,
  recordSalesOrderPayment,
  type SalesOrderDetailItem,
  submitSalesOrderDelivery,
} from '@/services/myapp/sales';
import {
  formatCurrencyCode,
  formatCurrencyValue,
  formatDisplayUom,
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
      formatDisplayUom(record.uom),
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
  const orderName = decodeURIComponent(String(params.name ?? ''));
  const [actionLoading, setActionLoading] = useState<string>();
  const { data, error, loading, refresh } = useRequest(
    () => getSalesOrderDetail(orderName),
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

  const confirmSubmitDelivery = () => {
    if (!data) {
      return;
    }

    let postingDate = dayjs().format('YYYY-MM-DD');
    let remarks = '';
    let selectedRows = buildSalesActionRows(data.items, (item) =>
      Math.max(toQty(item.qty) - toQty(item.deliveredQty), 0),
    );

    if (!selectedRows.length) {
      message.warning('当前订单没有可发货的商品明细');
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
          await submitSalesOrderDelivery(data.name, {
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
      title: `创建销售发货单 ${data.name}`,
      width: 900,
    });
  };

  const confirmCreateInvoice = () => {
    if (!data) {
      return;
    }

    let remarks = '';
    let selectedRows = buildSalesActionRows(data.items, (item) =>
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
          await createSalesOrderInvoice(data.name, {
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
      title: `创建销售发票 ${data.name}`,
      width: 900,
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
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
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
      okText: '确认收款',
      onOk: async () => {
        if (paymentAmount <= 0 || paymentAmount > outstandingAmount) {
          message.error('收款金额必须大于 0 且不能超过未收金额');
          throw new Error('Invalid payment amount');
        }

        setActionLoading('payment');
        try {
          await recordSalesOrderPayment(data.name, paymentAmount, {
            modeOfPayment,
          });
          refresh();
        } catch (caught) {
          message.error(caught instanceof Error ? caught.message : '操作失败');
          throw caught;
        } finally {
          setActionLoading(undefined);
        }
      },
      title: `记录收款 ${data.name}`,
    });
  };

  const confirmQuickCancelDownstream = () => {
    if (!data) {
      return;
    }

    Modal.confirm({
      cancelText: '取消',
      content:
        '系统会按顺序回退收款单、销售发票和销售发货单。若当前订单存在多张发票、发货单或多笔收款，后端会拒绝快捷回退，请改用分步处理。',
      okText: '快捷回退',
      okType: 'danger',
      onOk: async () => {
        setActionLoading('quick-cancel');
        try {
          const result = await quickCancelSalesOrderV2(data.name, {
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
          message.error(caught instanceof Error ? caught.message : '操作失败');
          throw caught;
        } finally {
          setActionLoading(undefined);
        }
      },
      title: `快捷回退销售订单 ${data.name} 的下游单据？`,
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
            message="销售订单详情加载失败"
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
            <Empty description="未找到销售订单" />
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
                  title: '已收金额',
                  value: formatCurrencyValue(data.paidAmount, data.currency),
                }}
              />
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
              <ProCard title="基本信息">
                <ProDescriptions column={2} dataSource={data}>
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
                    <StatusTag value={data.documentStatus} />
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="履约状态">
                    <StatusTag value={data.fulfillmentStatus} />
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="收款状态">
                    <StatusTag value={data.paymentStatus} />
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="完成状态">
                    <StatusTag value={data.completionStatus} />
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="币种">
                    {formatCurrencyCode(data.currency)}
                  </ProDescriptions.Item>
                </ProDescriptions>
              </ProCard>

              <ProCard title="履约动作">
                <Space wrap>
                  <Link
                    to={`/sales/orders/${encodeURIComponent(data.name)}/edit`}
                  >
                    <Button>编辑订单</Button>
                  </Link>
                  <Button
                    disabled={!data.canSubmitDelivery}
                    loading={actionLoading === 'delivery'}
                    onClick={confirmSubmitDelivery}
                    type="primary"
                  >
                    创建发货单
                  </Button>
                  <Button
                    disabled={!data.canCreateSalesInvoice}
                    loading={actionLoading === 'invoice'}
                    onClick={confirmCreateInvoice}
                  >
                    创建销售发票
                  </Button>
                  <Button
                    disabled={
                      !data.canRecordPayment ||
                      (data.outstandingAmount ?? 0) <= 0
                    }
                    loading={actionLoading === 'payment'}
                    onClick={confirmRecordPayment}
                  >
                    记录收款
                  </Button>
                  <Button
                    danger
                    disabled={
                      !data.deliveryNotes.length && !data.salesInvoices.length
                    }
                    loading={actionLoading === 'quick-cancel'}
                    onClick={confirmQuickCancelDownstream}
                  >
                    快捷回退下游
                  </Button>
                  <Button
                    danger
                    disabled={!data.canCancelOrder}
                    loading={actionLoading === 'cancel'}
                    onClick={() =>
                      runOrderAction(
                        'cancel',
                        `取消销售订单 ${data.name}？`,
                        () => cancelSalesOrder(data.name),
                        true,
                      )
                    }
                  >
                    取消销售订单
                  </Button>
                </Space>
              </ProCard>
            </ProCard>

            <ProCard title="收货信息">
              <ProDescriptions column={2} dataSource={data}>
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
                  {docLinks(data.deliveryNotes, '/sales/delivery-notes')}
                </ProDescriptions.Item>
                <ProDescriptions.Item label="销售发票">
                  {docLinks(data.salesInvoices, '/sales/invoices')}
                </ProDescriptions.Item>
              </ProDescriptions>
            </ProCard>

            <ProTable<SalesOrderDetailItem>
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

export default SalesOrderDetailPage;
