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
  Skeleton,
  Space,
} from 'antd';
import React, { useState } from 'react';
import { PrintDocumentButton } from '@/components/PrintDocumentButton';
import { SALES_RETURN_REFUND_ENTRY_ENABLED } from '@/config/feature-flags';
import {
  cancelDeliveryNote,
  getDeliveryNoteDetail,
  type SalesOrderDetailItem,
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

function isCancelled(status: string) {
  return status === 'cancelled' || status === '已作废';
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

const DeliveryNoteDetailPage: React.FC = () => {
  const params = useParams();
  const deliveryNoteName = decodeURIComponent(String(params.name ?? ''));
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const { data, error, loading, refresh } = useRequest(
    () => getDeliveryNoteDetail(deliveryNoteName),
    {
      formatResult: (result) => result,
      refreshDeps: [deliveryNoteName],
    },
  );
  const cancelled = data ? isCancelled(data.documentStatus) : false;
  const sourceOrder = data?.salesOrders[0] ?? '';
  const linkedInvoice = data?.salesInvoices[0] ?? '';
  const canCancelDeliveryNote = Boolean(data?.canCancelDeliveryNote);

  const showCancelModal = () => {
    setCancelModalOpen(true);
  };

  const submitCancel = async () => {
    setCancelLoading(true);
    try {
      await cancelDeliveryNote(deliveryNoteName);
      setCancelModalOpen(false);
      refresh();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '操作失败');
      throw caught;
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <PageContainer
      title={deliveryNoteName || '销售发货单详情'}
      extra={[
        <Button key="back">
          <Link to="/sales/orders">返回销售订单</Link>
        </Button>,
        <Button key="refresh" loading={loading} onClick={refresh}>
          刷新
        </Button>,
        <PrintDocumentButton
          disabled={!deliveryNoteName}
          docname={deliveryNoteName}
          doctype="Delivery Note"
          key="print"
        />,
        linkedInvoice ? (
          <Button key="invoice" type="primary">
            <Link to={`/sales/invoices/${encodeURIComponent(linkedInvoice)}`}>
              查看发票
            </Link>
          </Button>
        ) : sourceOrder && !cancelled ? (
          <Button key="invoice" type="primary">
            <Link
              to={`/sales/orders/${encodeURIComponent(sourceOrder)}?action=invoice`}
            >
              前往开票
            </Link>
          </Button>
        ) : null,
        SALES_RETURN_REFUND_ENTRY_ENABLED ? (
          <Button key="return">
            <Link
              to={`/sales/returns/new?sourceDoctype=Delivery%20Note&sourceName=${encodeURIComponent(deliveryNoteName)}`}
            >
              创建退货
            </Link>
          </Button>
        ) : null,
        <Button
          danger
          disabled={!canCancelDeliveryNote}
          key="cancel"
          loading={cancelLoading}
          onClick={showCancelModal}
        >
          作废发货单
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
            title="销售发货单详情加载失败"
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
            <Empty description="未找到销售发货单" />
          </ProCard>
        ) : null}

        {data ? (
          <>
            <StatisticCard.Group direction="row">
              <StatisticCard
                statistic={{
                  title: '发货金额',
                  value: formatCurrencyValue(data.grandTotal, data.currency),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '发货数量',
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

                  <ProCard title={cancelled ? '历史单据说明' : '后续处理'}>
                    {cancelled ? (
                      <Alert
                        description="当前发货单已经作废，库存和订单履约状态通常已经回退。建议返回来源订单查看最新状态；如需继续开票或发货，应基于仍然有效的订单链路重新处理。"
                        title="这是一张历史发货单"
                        showIcon
                        type="warning"
                      />
                    ) : linkedInvoice ? (
                      <Alert
                        action={
                          <Button size="small">
                            <Link
                              to={`/sales/invoices/${encodeURIComponent(linkedInvoice)}`}
                            >
                              查看发票
                            </Link>
                          </Button>
                        }
                        description="这张发货单已经关联销售发票，后续收款、发票作废或退款核对建议从发票详情继续处理。"
                        title="发货已进入开票链路"
                        showIcon
                        type="success"
                      />
                    ) : sourceOrder ? (
                      <Alert
                        action={
                          <Button size="small" type="primary">
                            <Link
                              to={`/sales/orders/${encodeURIComponent(
                                sourceOrder,
                              )}?action=invoice`}
                            >
                              前往开票
                            </Link>
                          </Button>
                        }
                        description="当前发货单还没有关联销售发票。点击后会进入来源订单并直接打开创建销售发票流程。"
                        title="下一步建议创建销售发票"
                        showIcon
                        type="info"
                      />
                    ) : (
                      <Alert
                        description="当前发货单没有返回订单或发票的关联信息，请先核对单据来源。"
                        title="缺少上游关联"
                        showIcon
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
                      <ProDescriptions.Item label="公司" dataIndex="company" />
                      <ProDescriptions.Item
                        label="过账日期"
                        dataIndex="postingDate"
                      />
                      <ProDescriptions.Item
                        label="过账时间"
                        dataIndex="postingTime"
                      />
                      <ProDescriptions.Item label="币种">
                        {formatCurrencyCode(data.currency)}
                      </ProDescriptions.Item>
                      <ProDescriptions.Item label="单据状态">
                        <StatusTag value={data.documentStatus} />
                      </ProDescriptions.Item>
                      <ProDescriptions.Item label="可取消">
                        {data.canCancelDeliveryNote ? '是' : '否'}
                      </ProDescriptions.Item>
                    </ProDescriptions>
                  </ProCard>

                  <ProCard title="关联单据">
                    <ProDescriptions column={1}>
                      <ProDescriptions.Item label="销售订单">
                        {docLinks(data.salesOrders, '/sales/orders')}
                      </ProDescriptions.Item>
                      <ProDescriptions.Item label="销售发票">
                        {docLinks(data.salesInvoices, '/sales/invoices')}
                      </ProDescriptions.Item>
                    </ProDescriptions>
                  </ProCard>

                  <ProCard title="收货信息">
                    <ProDescriptions column={1} dataSource={data}>
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
                      />
                      <ProDescriptions.Item label="备注">
                        {data.remarks || '无'}
                      </ProDescriptions.Item>
                    </ProDescriptions>
                  </ProCard>

                  {!cancelled &&
                  (data.canCancelDeliveryNote ||
                    data.cancelDeliveryNoteHint) ? (
                    <ProCard title="回退处理">
                      <Alert
                        action={
                          data.canCancelDeliveryNote ? (
                            <Button
                              danger
                              loading={cancelLoading}
                              onClick={showCancelModal}
                              size="small"
                            >
                              作废发货单
                            </Button>
                          ) : null
                        }
                        description={
                          data.cancelDeliveryNoteHint ||
                          '如需回退这张发货单，系统会恢复库存并把订单履约状态退回到待发货。若已经开票，请先处理下游销售发票。'
                        }
                        title="发货单作废会影响库存和订单履约状态"
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

      <Modal
        cancelText="先不作废"
        confirmLoading={cancelLoading}
        okButtonProps={{ danger: true }}
        okText="确认作废发货单"
        onCancel={() => setCancelModalOpen(false)}
        onOk={submitCancel}
        open={cancelModalOpen}
        title={`作废发货单 ${deliveryNoteName}？`}
      >
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            description={
              data?.cancelDeliveryNoteHint ||
              '系统会作废这张 Delivery Note，并由 ERPNext 回退库存扣减和来源销售订单的履约数量。作废后如需重新发货，请回到来源销售订单继续处理。'
            }
            title="这是库存和履约回退操作"
            showIcon
            type="warning"
          />
          {data ? (
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="发货单">
                {deliveryNoteName}
              </Descriptions.Item>
              <Descriptions.Item label="销售订单">
                {data.salesOrders.length ? data.salesOrders.join('、') : '无'}
              </Descriptions.Item>
              <Descriptions.Item label="销售发票">
                {data.salesInvoices.length
                  ? data.salesInvoices.join('、')
                  : '无'}
              </Descriptions.Item>
              <Descriptions.Item label="发货数量">
                {data.totalQty ?? 0}
              </Descriptions.Item>
              <Descriptions.Item label="发货金额">
                {formatCurrencyValue(data.grandTotal, data.currency)}
              </Descriptions.Item>
            </Descriptions>
          ) : null}
          {data?.salesInvoices.length ? (
            <Alert
              description="当前发货单已关联销售发票时，后端会拒绝直接作废发货单。请先进入销售发票详情作废下游发票，再回到这里作废发货单。"
              title="请先处理下游销售发票"
              showIcon
              type="error"
            />
          ) : null}
        </Space>
      </Modal>
    </PageContainer>
  );
};

export default DeliveryNoteDetailPage;
