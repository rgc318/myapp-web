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
  Descriptions,
  Empty,
  Input,
  Modal,
  message,
  Skeleton,
  Space,
} from 'antd';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import { PrintDocumentButton } from '@/components/PrintDocumentButton';
import { PURCHASE_RETURN_REFUND_ENTRY_ENABLED } from '@/config/feature-flags';
import {
  cancelPurchaseReceipt,
  createPurchaseInvoiceFromReceipt,
  getPurchaseReceiptDetail,
  type PurchaseDocumentItem,
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

const PurchaseReceiptDetailPage: React.FC = () => {
  const params = useParams();
  const receiptName = decodeURIComponent(String(params.name ?? ''));
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const { data, error, loading, refresh } = useRequest(
    () => getPurchaseReceiptDetail(receiptName),
    {
      formatResult: (result) => result,
      refreshDeps: [receiptName],
    },
  );
  const cancelled = data?.documentStatus === 'cancelled';
  const sourceOrder = data?.purchaseOrders[0] ?? '';
  const linkedInvoice = data?.purchaseInvoices[0] ?? '';
  const canCancelReceipt = Boolean(data?.canCancel);

  const showCancelModal = () => {
    setCancelModalOpen(true);
  };

  const submitCancel = async () => {
    setCancelLoading(true);
    try {
      await cancelPurchaseReceipt(receiptName);
      setCancelModalOpen(false);
      refresh();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '操作失败');
      throw caught;
    } finally {
      setCancelLoading(false);
    }
  };

  const confirmCreateInvoice = () => {
    let dueDate = dayjs().format('YYYY-MM-DD');
    let remarks = '';
    Modal.confirm({
      cancelText: '取消',
      content: (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <DatePicker
            defaultValue={dayjs(dueDate)}
            onChange={(value) => {
              dueDate = value?.format('YYYY-MM-DD') ?? '';
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
        </Space>
      ),
      okText: '创建采购发票',
      onOk: async () => {
        setInvoiceLoading(true);
        try {
          const result = await createPurchaseInvoiceFromReceipt(receiptName, {
            dueDate,
            remarks,
          });
          const invoiceName = result.data.purchase_invoice;
          if (invoiceName) {
            history.push(
              `/purchase/invoices/${encodeURIComponent(invoiceName)}`,
            );
          } else {
            refresh();
          }
        } catch (caught) {
          message.error(caught instanceof Error ? caught.message : '操作失败');
          throw caught;
        } finally {
          setInvoiceLoading(false);
        }
      },
      title: `基于收货单 ${receiptName} 创建采购发票`,
    });
  };

  return (
    <PageContainer
      title={receiptName || '采购收货单详情'}
      extra={[
        <Button key="back">
          <Link
            to={
              sourceOrder
                ? `/purchase/orders/${encodeURIComponent(sourceOrder)}`
                : '/purchase/orders'
            }
          >
            返回采购订单
          </Link>
        </Button>,
        <Button key="refresh" loading={loading} onClick={refresh}>
          刷新
        </Button>,
        <PrintDocumentButton
          disabled={!receiptName}
          docname={receiptName}
          doctype="Purchase Receipt"
          key="print"
        />,
        <Button
          disabled={!data?.canCreateInvoice}
          key="invoice"
          loading={invoiceLoading}
          onClick={confirmCreateInvoice}
          type="primary"
        >
          创建采购发票
        </Button>,
        PURCHASE_RETURN_REFUND_ENTRY_ENABLED &&
        data?.documentStatus !== 'cancelled' ? (
          <Button
            key="return"
            onClick={() => {
              const params = new URLSearchParams({
                sourceDoctype: 'Purchase Receipt',
                sourceName: receiptName,
              });
              history.push(`/purchase/returns/new?${params.toString()}`);
            }}
          >
            采购退货
          </Button>
        ) : null,
        <Button
          danger
          disabled={!canCancelReceipt}
          key="cancel"
          loading={cancelLoading}
          onClick={showCancelModal}
        >
          取消收货单
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
            title="采购收货单详情加载失败"
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
            <Empty description="未找到采购收货单" />
          </ProCard>
        ) : null}

        {data ? (
          <>
            <StatisticCard.Group direction="row">
              <StatisticCard
                statistic={{
                  title: '收货金额',
                  value: formatCurrencyValue(data.amount, data.currency),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '收货数量',
                  value: data.totalQty ?? 0,
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

                  <ProCard title={cancelled ? '历史单据说明' : '后续处理'}>
                    {cancelled ? (
                      <Alert
                        description="当前采购收货单已经作废，库存和采购订单收货状态通常已经回退。建议返回来源采购订单查看最新状态；如需继续收货或开票，应基于仍然有效的采购订单链路重新处理。"
                        showIcon
                        title="这是一张历史收货单"
                        type="warning"
                      />
                    ) : linkedInvoice ? (
                      <Alert
                        action={
                          <Button size="small">
                            <Link
                              to={`/purchase/invoices/${encodeURIComponent(linkedInvoice)}`}
                            >
                              查看发票
                            </Link>
                          </Button>
                        }
                        description="这张采购收货单已经关联采购发票，后续付款、发票作废或退款核对建议从采购发票详情继续处理。"
                        showIcon
                        title="收货已进入开票链路"
                        type="success"
                      />
                    ) : data.canCreateInvoice ? (
                      <Alert
                        action={
                          <Button
                            onClick={confirmCreateInvoice}
                            size="small"
                            type="primary"
                          >
                            创建采购发票
                          </Button>
                        }
                        description="当前采购收货单还没有关联采购发票。可基于实际收货结果创建采购发票，再继续处理供应商付款。"
                        showIcon
                        title="下一步建议创建采购发票"
                        type="info"
                      />
                    ) : (
                      <Alert
                        description="当前采购收货单没有返回采购订单或发票的关联信息，请先核对单据来源。"
                        showIcon
                        title="缺少上游关联"
                        type="warning"
                      />
                    )}
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
                      <ProDescriptions.Item label="公司" dataIndex="company" />
                      <ProDescriptions.Item
                        label="过账日期"
                        dataIndex="postingDate"
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
                      <ProDescriptions.Item label="可开票">
                        {data.canCreateInvoice ? '是' : '否'}
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
                      <ProDescriptions.Item label="采购发票">
                        {docLinks(data.purchaseInvoices, '/purchase/invoices')}
                      </ProDescriptions.Item>
                    </ProDescriptions>
                  </ProCard>

                  <ProCard title="备注">
                    <ProDescriptions column={1} dataSource={data}>
                      <ProDescriptions.Item label="备注">
                        {data.remarks || '无'}
                      </ProDescriptions.Item>
                    </ProDescriptions>
                  </ProCard>

                  {!cancelled &&
                  (data.canCancel || data.cancelPurchaseReceiptHint) ? (
                    <ProCard title="回退处理">
                      <Alert
                        action={
                          data.canCancel ? (
                            <Button
                              danger
                              loading={cancelLoading}
                              onClick={showCancelModal}
                              size="small"
                            >
                              取消收货单
                            </Button>
                          ) : null
                        }
                        description={
                          data.cancelPurchaseReceiptHint ||
                          '如需回退这张采购收货单，系统会回退入库库存并把采购订单收货状态退回待收货。若已经开票，请先处理下游采购发票。'
                        }
                        showIcon
                        title="收货单取消会影响库存和采购订单收货状态"
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
      <Modal
        cancelText="先不取消"
        confirmLoading={cancelLoading}
        okButtonProps={{ danger: true }}
        okText="确认取消收货单"
        onCancel={() => setCancelModalOpen(false)}
        onOk={submitCancel}
        open={cancelModalOpen}
        title={`取消采购收货单 ${receiptName}？`}
      >
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            description={
              data?.cancelPurchaseReceiptHint ||
              '系统会作废这张 Purchase Receipt，并由 ERPNext 回退库存入库和来源采购订单的已收货数量。取消后如需重新收货，请回到来源采购订单继续处理。'
            }
            showIcon
            title="这是库存和采购收货回退操作"
            type="warning"
          />
          {data ? (
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="采购收货单">
                {receiptName}
              </Descriptions.Item>
              <Descriptions.Item label="采购订单">
                {data.purchaseOrders.length
                  ? data.purchaseOrders.join('、')
                  : '无'}
              </Descriptions.Item>
              <Descriptions.Item label="采购发票">
                {data.purchaseInvoices.length
                  ? data.purchaseInvoices.join('、')
                  : '无'}
              </Descriptions.Item>
              <Descriptions.Item label="收货数量">
                {data.totalQty ?? 0}
              </Descriptions.Item>
              <Descriptions.Item label="收货金额">
                {formatCurrencyValue(data.amount, data.currency)}
              </Descriptions.Item>
            </Descriptions>
          ) : null}
          {data?.purchaseInvoices.length ? (
            <Alert
              description="当前采购收货单已关联采购发票时，后端会拒绝直接取消收货单。请先进入采购发票详情作废下游发票，再回到这里取消收货单。"
              showIcon
              title="请先处理下游采购发票"
              type="error"
            />
          ) : null}
        </Space>
      </Modal>
    </PageContainer>
  );
};

export default PurchaseReceiptDetailPage;
