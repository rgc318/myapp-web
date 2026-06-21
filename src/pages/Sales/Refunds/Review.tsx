import {
  PageContainer,
  ProCard,
  ProDescriptions,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { history, useLocation, useRequest } from '@umijs/max';
import {
  Alert,
  Button,
  Empty,
  Form,
  Modal,
  message,
  Skeleton,
  Space,
  Typography,
} from 'antd';
import React, { useState } from 'react';
import { RemoteLinkSelect } from '@/components';
import {
  cancelSalesPaymentEntry,
  getSalesInvoiceDetail,
  type SalesInvoicePaymentEntry,
} from '@/services/myapp/sales';
import { formatCurrencyValue, StatusTag } from '@/utils/myapp-display';

type FormValues = {
  invoiceName: string;
  returnInvoiceName?: string;
};

function invoicePath(name: string) {
  return `/sales/invoices/${encodeURIComponent(name)}`;
}

function isCancelled(status: string) {
  return status === 'cancelled' || status === '已作废';
}

function refundReviewTone(data: {
  documentStatus: string;
  latestPaymentEntry: string;
  latestUnallocatedAmount: number | null;
  outstandingAmount: number | null;
  paidAmount: number | null;
  totalWriteoffAmount: number | null;
}) {
  if (isCancelled(data.documentStatus)) {
    return {
      description:
        '来源发票已经作废，通常不再从这里继续回退收款。请回到来源订单或财务流水核对实际状态。',
      message: '来源发票已作废',
      type: 'warning' as const,
    };
  }
  if (!data.latestPaymentEntry && (data.paidAmount ?? 0) <= 0) {
    return {
      description:
        '来源发票没有可回退的最近收款，退货后通常不需要在本页处理客户退款。',
      message: '暂无可回退收款',
      type: 'info' as const,
    };
  }
  if (data.latestPaymentEntry) {
    if ((data.latestUnallocatedAmount ?? 0) > 0) {
      return {
        description:
          '来源发票最近收款存在多收保留金额。退货后请优先核对该未分配金额是否应退回客户，或按财务流程转抵其他应收。',
        message: '存在多收保留金额',
        type: 'warning' as const,
      };
    }
    if ((data.totalWriteoffAmount ?? 0) > 0) {
      return {
        description:
          '来源发票包含差额核销。退货后请同时核对原收款和核销原因，避免重复退款或遗漏核销回退。',
        message: '存在核销结清金额',
        type: 'warning' as const,
      };
    }
    return {
      description:
        '来源发票存在最近收款。若本次退货需要回退原客户收款，可在确认财务凭证后取消最近收款；若已经线下退款，请保留实际退款凭证并按财务流程登记。',
      message: '需要核对客户退款',
      type: 'warning' as const,
    };
  }
  if ((data.outstandingAmount ?? 0) > 0) {
    return {
      description:
        '来源发票仍有未收金额。退货后优先核对应收余额是否已经正确冲减，再决定是否需要额外财务处理。',
      message: '来源发票仍未结清',
      type: 'info' as const,
    };
  }
  return {
    description:
      '当前未发现可直接回退的最近收款。请结合退货单、来源发票和财务凭证完成线下核对。',
    message: '请完成财务核对',
    type: 'info' as const,
  };
}

const paymentEntryColumns = [
  {
    title: '收款单',
    dataIndex: 'paymentEntry',
    width: 180,
  },
  {
    title: '收款日期',
    dataIndex: 'postingDate',
    width: 110,
  },
  {
    title: '付款方式',
    dataIndex: 'modeOfPayment',
    width: 120,
    render: (_: unknown, record: SalesInvoicePaymentEntry) =>
      record.modeOfPayment || '-',
  },
  {
    title: '核销金额',
    dataIndex: 'allocatedAmount',
    align: 'right' as const,
    width: 120,
    render: (_: unknown, record: SalesInvoicePaymentEntry) =>
      formatCurrencyValue(record.allocatedAmount),
  },
  {
    title: '实收金额',
    dataIndex: 'actualPaidAmount',
    align: 'right' as const,
    width: 120,
    render: (_: unknown, record: SalesInvoicePaymentEntry) =>
      formatCurrencyValue(record.actualPaidAmount),
  },
  {
    title: '差额核销',
    dataIndex: 'writeoffAmount',
    align: 'right' as const,
    width: 120,
    render: (_: unknown, record: SalesInvoicePaymentEntry) =>
      formatCurrencyValue(record.writeoffAmount),
  },
  {
    title: '多收保留',
    dataIndex: 'latestUnallocatedAmount',
    align: 'right' as const,
    width: 120,
    render: (_: unknown, record: SalesInvoicePaymentEntry) =>
      formatCurrencyValue(record.latestUnallocatedAmount),
  },
  {
    title: '参考号',
    dataIndex: 'referenceNo',
    ellipsis: true,
    width: 160,
    render: (_: unknown, record: SalesInvoicePaymentEntry) =>
      record.referenceNo || '-',
  },
];

const SalesRefundReviewPage: React.FC = () => {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const [form] = Form.useForm<FormValues>();
  const [invoiceName, setInvoiceName] = useState(
    query.get('sourceInvoice') ?? '',
  );
  const returnInvoiceName = query.get('returnInvoice') ?? '';
  const [cancelLoading, setCancelLoading] = useState(false);

  const { data, error, loading, refresh } = useRequest(
    () =>
      invoiceName ? getSalesInvoiceDetail(invoiceName) : Promise.resolve(null),
    {
      formatResult: (result) => result,
      refreshDeps: [invoiceName],
    },
  );

  const loadInvoice = async () => {
    const values = await form.validateFields(['invoiceName']);
    setInvoiceName(values.invoiceName);
  };

  const confirmCancelPayment = () => {
    if (!data?.latestPaymentEntry) {
      message.warning('当前发票没有可回退的最近收款');
      return;
    }

    Modal.confirm({
      cancelText: '取消',
      content:
        '这会作废当前发票最近一笔收款记录，用于退货后需要回退客户收款的场景。若只需线下退款登记，请先按财务规范处理实际退款凭证。',
      okText: '取消最近收款',
      okType: 'danger',
      onOk: async () => {
        setCancelLoading(true);
        try {
          await cancelSalesPaymentEntry(data.latestPaymentEntry);
          refresh();
        } catch (caught) {
          message.error(caught instanceof Error ? caught.message : '操作失败');
          throw caught;
        } finally {
          setCancelLoading(false);
        }
      },
      title: `取消收款 ${data.latestPaymentEntry}？`,
      width: 620,
    });
  };

  return (
    <PageContainer
      title="销售退款核对"
      extra={[
        <Button key="orders" onClick={() => history.push('/sales/orders')}>
          返回销售订单
        </Button>,
      ]}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          message="当前系统尚未提供独立客户退款打款接口。本页用于退货后核对来源发票收款状态，并在需要时回退最近收款。"
          showIcon
          type="info"
        />

        <ProCard>
          <Form<FormValues>
            form={form}
            initialValues={{
              invoiceName,
              returnInvoiceName,
            }}
            layout="vertical"
          >
            <div
              style={{
                display: 'grid',
                gap: 16,
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              }}
            >
              <Form.Item
                label="来源销售发票"
                name="invoiceName"
                rules={[{ required: true, message: '请选择来源销售发票' }]}
              >
                <RemoteLinkSelect
                  doctype="Sales Invoice"
                  extraFields={['customer', 'company']}
                  placeholder="搜索来源销售发票"
                />
              </Form.Item>
              <Form.Item label="退货发票" name="returnInvoiceName">
                <RemoteLinkSelect
                  doctype="Sales Invoice"
                  extraFields={['customer', 'company']}
                  placeholder="可选，选择退货发票"
                />
              </Form.Item>
            </div>
            <Space>
              <Button
                loading={loading}
                onClick={() => void loadInvoice()}
                type="primary"
              >
                读取发票
              </Button>
              {invoiceName ? (
                <Button onClick={() => history.push(invoicePath(invoiceName))}>
                  查看来源发票
                </Button>
              ) : null}
              {returnInvoiceName ? (
                <Button
                  onClick={() => history.push(invoicePath(returnInvoiceName))}
                >
                  查看退货发票
                </Button>
              ) : null}
            </Space>
          </Form>
        </ProCard>

        {error ? (
          <Alert
            action={
              <Button size="small" onClick={refresh}>
                重试
              </Button>
            }
            description={
              error instanceof Error ? error.message : '请稍后重试。'
            }
            message="销售发票加载失败"
            showIcon
            type="error"
          />
        ) : null}

        {loading && invoiceName ? (
          <ProCard>
            <Skeleton active paragraph={{ rows: 6 }} />
          </ProCard>
        ) : null}

        {!loading && invoiceName && !data && !error ? (
          <ProCard>
            <Empty description="未找到销售发票" />
          </ProCard>
        ) : null}

        {data ? (
          <>
            <StatisticCard.Group direction="row">
              <StatisticCard
                statistic={{
                  title: '应收金额',
                  value: formatCurrencyValue(
                    data.receivableAmount,
                    data.currency,
                  ),
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
              {(data.latestUnallocatedAmount ?? 0) > 0 ? (
                <StatisticCard
                  statistic={{
                    title: '最近多收保留',
                    value: formatCurrencyValue(
                      data.latestUnallocatedAmount,
                      data.currency,
                    ),
                  }}
                />
              ) : null}
              <StatisticCard
                statistic={{
                  title: '当前未收',
                  value: formatCurrencyValue(
                    data.outstandingAmount,
                    data.currency,
                  ),
                }}
              />
            </StatisticCard.Group>

            <ProCard title="处理建议">
              <Alert
                description={refundReviewTone(data).description}
                message={refundReviewTone(data).message}
                showIcon
                type={refundReviewTone(data).type}
              />
            </ProCard>

            <ProCard title="退款核对">
              <ProDescriptions column={2} dataSource={data}>
                <ProDescriptions.Item label="销售发票" dataIndex="name" />
                <ProDescriptions.Item label="公司" dataIndex="company" />
                <ProDescriptions.Item label="单据状态">
                  <StatusTag value={data.documentStatus} />
                </ProDescriptions.Item>
                <ProDescriptions.Item label="收款状态">
                  <StatusTag value={data.paymentStatus} />
                </ProDescriptions.Item>
                <ProDescriptions.Item
                  label="最近收款"
                  dataIndex="latestPaymentEntry"
                />
                <ProDescriptions.Item label="客户" dataIndex="contactDisplay" />
                <ProDescriptions.Item
                  label="收货地址"
                  dataIndex="addressDisplay"
                  span={2}
                />
              </ProDescriptions>
            </ProCard>

            <ProTable<SalesInvoicePaymentEntry>
              columns={paymentEntryColumns}
              dataSource={data.paymentEntries}
              headerTitle="来源发票收款历史"
              pagination={false}
              rowKey="paymentEntry"
              scroll={{ x: 1050 }}
              search={false}
              toolBarRender={false}
            />

            <ProCard>
              <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                <Typography.Text type="secondary">
                  本页不创建独立打款退款单；如退货后需要回退原收款，可取消最近收款；如已线下退款，请保留财务凭证并按实际流程登记。
                </Typography.Text>
                <Button
                  danger
                  disabled={
                    !data.latestPaymentEntry || isCancelled(data.documentStatus)
                  }
                  loading={cancelLoading}
                  onClick={confirmCancelPayment}
                >
                  取消最近收款
                </Button>
              </Space>
            </ProCard>
          </>
        ) : null}
      </Space>
    </PageContainer>
  );
};

export default SalesRefundReviewPage;
