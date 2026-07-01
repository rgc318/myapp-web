import {
  PageContainer,
  ProCard,
  type ProColumns,
  ProDescriptions,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { history, Link, useParams, useRequest } from '@umijs/max';
import { Alert, Button, Empty, Skeleton, Space, Tag, Typography } from 'antd';
import React from 'react';
import {
  getPaymentEntryDetail,
  type PaymentEntryDeduction,
  type PaymentEntryDetail,
  type PaymentEntryReference,
} from '@/services/myapp/reports';
import { formatCurrencyValue, StatusTag } from '@/utils/myapp-display';

function directionTag(value: PaymentEntryDetail['direction']) {
  const map: Record<
    PaymentEntryDetail['direction'],
    { color: string; text: string }
  > = {
    in: { color: 'green', text: '收入' },
    out: { color: 'orange', text: '支出' },
    transfer: { color: 'blue', text: '转账' },
  };
  const item = map[value] ?? { color: 'default', text: '未知' };
  return <Tag color={item.color}>{item.text}</Tag>;
}

function businessTypeText(value: string) {
  const map: Record<string, string> = {
    customer_receipt: '客户收款',
    customer_refund: '客户退款',
    customer_settlement: '客户结算',
    internal_transfer: '内部转账',
    other: '其他收支',
    supplier_payment: '供应商付款',
    supplier_refund: '供应商退款',
    supplier_settlement: '供应商结算',
  };
  return map[value] ?? (value || '-');
}

function documentPath(doctype: string | null, name: string | null) {
  if (!doctype || !name) {
    return '';
  }
  const encoded = encodeURIComponent(name);
  if (doctype === 'Sales Invoice') {
    return `/sales/invoices/${encoded}`;
  }
  if (doctype === 'Purchase Invoice') {
    return `/purchase/invoices/${encoded}`;
  }
  if (doctype === 'Sales Order') {
    return `/sales/orders/${encoded}`;
  }
  if (doctype === 'Purchase Order') {
    return `/purchase/orders/${encoded}`;
  }
  if (doctype === 'Delivery Note') {
    return `/sales/delivery-notes/${encoded}`;
  }
  if (doctype === 'Purchase Receipt') {
    return `/purchase/receipts/${encoded}`;
  }
  return '';
}

function documentLink(doctype: string | null, name: string | null) {
  const path = documentPath(doctype, name);
  if (!name) {
    return '-';
  }
  return path ? <Link to={path}>{name}</Link> : name;
}

function docLinks(names: string[], doctype: string) {
  if (!names.length) {
    return '无';
  }
  return (
    <Space wrap>
      {names.map((name) => (
        <Link key={`${doctype}-${name}`} to={documentPath(doctype, name)}>
          {name}
        </Link>
      ))}
    </Space>
  );
}

function returnInvoiceDoctype(data: PaymentEntryDetail) {
  return data.partyType === 'Supplier' ||
    data.businessType.startsWith('supplier')
    ? 'Purchase Invoice'
    : 'Sales Invoice';
}

function firstBusinessDocument(data: PaymentEntryDetail) {
  const candidates = [
    { doctype: 'Sales Invoice', names: data.links.salesInvoices },
    { doctype: 'Purchase Invoice', names: data.links.purchaseInvoices },
    { doctype: 'Sales Order', names: data.links.salesOrders },
    { doctype: 'Purchase Order', names: data.links.purchaseOrders },
    { doctype: returnInvoiceDoctype(data), names: data.links.returnInvoices },
  ];
  const candidate = candidates.find((item) => item.names.length > 0);
  if (!candidate) {
    return null;
  }
  return {
    doctype: candidate.doctype,
    name: candidate.names[0],
    path: documentPath(candidate.doctype, candidate.names[0]),
  };
}

function businessTraceMessage(data: PaymentEntryDetail) {
  if (data.businessType === 'customer_receipt') {
    return '这是一笔客户收款，可从核销发票或销售订单继续追溯销售链路。';
  }
  if (data.businessType === 'supplier_payment') {
    return '这是一笔供应商付款，可从核销发票或采购订单继续追溯采购链路。';
  }
  if (data.businessType === 'customer_refund') {
    return '这是一笔客户退款，应重点核对退货发票、来源销售发票和原收款链路。';
  }
  if (data.businessType === 'supplier_refund') {
    return '这是一笔供应商退款或付款回退，应重点核对退货发票、来源采购发票和原付款链路。';
  }
  if (data.direction === 'transfer') {
    return '这是一笔内部转账，主要核对付款账户、收款账户和参考号。';
  }
  return '这笔收付款暂未归类到明确业务类型，请结合核销明细、账户和参考号核对。';
}

const referenceColumns: ProColumns<PaymentEntryReference>[] = [
  {
    title: '引用单据',
    dataIndex: 'referenceName',
    width: 220,
    render: (_, record) =>
      documentLink(record.referenceDoctype, record.referenceName),
  },
  {
    title: '单据类型',
    dataIndex: 'referenceDoctype',
    width: 140,
    renderText: (value) => value || '-',
  },
  {
    title: '核销金额',
    dataIndex: 'allocatedAmount',
    align: 'right',
    width: 130,
    render: (_, record) => formatCurrencyValue(record.allocatedAmount),
  },
  {
    title: '单据金额',
    dataIndex: 'totalAmount',
    align: 'right',
    width: 130,
    render: (_, record) => formatCurrencyValue(record.totalAmount),
  },
  {
    title: '未结金额',
    dataIndex: 'outstandingAmount',
    align: 'right',
    width: 130,
    render: (_, record) => formatCurrencyValue(record.outstandingAmount),
  },
  {
    title: '到期日期',
    dataIndex: 'dueDate',
    width: 120,
    renderText: (value) => value || '-',
  },
  {
    title: '退货来源',
    dataIndex: 'returnAgainst',
    width: 180,
    render: (_, record) =>
      record.returnAgainst
        ? documentLink(record.referenceDoctype, record.returnAgainst)
        : '-',
  },
];

const deductionColumns: ProColumns<PaymentEntryDeduction>[] = [
  {
    title: '科目',
    dataIndex: 'account',
    ellipsis: true,
    renderText: (value) => value || '-',
  },
  {
    title: '成本中心',
    dataIndex: 'costCenter',
    ellipsis: true,
    renderText: (value) => value || '-',
  },
  {
    title: '金额',
    dataIndex: 'amount',
    align: 'right',
    width: 130,
    render: (_, record) => formatCurrencyValue(record.amount),
  },
  {
    title: '说明',
    dataIndex: 'description',
    ellipsis: true,
    renderText: (value) => value || '-',
  },
];

const PaymentEntryDetailPage: React.FC = () => {
  const params = useParams<{ name?: string }>();
  const paymentEntryName = params.name ? decodeURIComponent(params.name) : '';
  const { data, error, loading, refresh } = useRequest(
    () => getPaymentEntryDetail(paymentEntryName),
    {
      formatResult: (result) => result,
      ready: Boolean(paymentEntryName),
      refreshDeps: [paymentEntryName],
    },
  );
  const primaryBusinessDocument = data ? firstBusinessDocument(data) : null;

  return (
    <PageContainer
      title={paymentEntryName || '收付款详情'}
      extra={[
        <Button key="list" onClick={() => history.push('/payments')}>
          返回资金流水
        </Button>,
        <Button key="refresh" onClick={refresh}>
          刷新
        </Button>,
      ]}
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
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
            message="收付款详情加载失败"
            showIcon
            type="error"
          />
        ) : null}

        {loading && !data ? (
          <ProCard>
            <Skeleton active paragraph={{ rows: 8 }} />
          </ProCard>
        ) : null}

        {!loading && !error && !data ? (
          <ProCard>
            <Empty description="未找到收付款单" />
          </ProCard>
        ) : null}

        {data ? (
          <>
            <StatisticCard.Group direction="row">
              <StatisticCard
                statistic={{
                  title: '收支金额',
                  value: formatCurrencyValue(data.amount, data.currency),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '方向',
                  value: data.direction,
                  formatter: () => directionTag(data.direction),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '业务类型',
                  value: businessTypeText(data.businessType),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '未分配金额',
                  value: formatCurrencyValue(
                    data.unallocatedAmount,
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
                  <ProCard title="业务链路">
                    <Space
                      orientation="vertical"
                      size={12}
                      style={{ width: '100%' }}
                    >
                      <Alert
                        action={
                          primaryBusinessDocument?.path ? (
                            <Button size="small" type="primary">
                              <Link to={primaryBusinessDocument.path}>
                                查看关联单据
                              </Link>
                            </Button>
                          ) : null
                        }
                        description={businessTraceMessage(data)}
                        message={businessTypeText(data.businessType)}
                        showIcon
                        type={
                          data.direction === 'transfer' ? 'info' : 'success'
                        }
                      />
                      <ProDescriptions column={2}>
                        <ProDescriptions.Item label="往来方">
                          {data.partyName || data.party || '无'}
                        </ProDescriptions.Item>
                        <ProDescriptions.Item label="首要关联">
                          {primaryBusinessDocument
                            ? documentLink(
                                primaryBusinessDocument.doctype,
                                primaryBusinessDocument.name,
                              )
                            : '无'}
                        </ProDescriptions.Item>
                        <ProDescriptions.Item label="销售订单">
                          {docLinks(data.links.salesOrders, 'Sales Order')}
                        </ProDescriptions.Item>
                        <ProDescriptions.Item label="销售发票">
                          {docLinks(data.links.salesInvoices, 'Sales Invoice')}
                        </ProDescriptions.Item>
                        <ProDescriptions.Item label="采购订单">
                          {docLinks(
                            data.links.purchaseOrders,
                            'Purchase Order',
                          )}
                        </ProDescriptions.Item>
                        <ProDescriptions.Item label="采购发票">
                          {docLinks(
                            data.links.purchaseInvoices,
                            'Purchase Invoice',
                          )}
                        </ProDescriptions.Item>
                        <ProDescriptions.Item label="退货发票" span={2}>
                          {docLinks(
                            data.links.returnInvoices,
                            returnInvoiceDoctype(data),
                          )}
                        </ProDescriptions.Item>
                      </ProDescriptions>
                    </Space>
                  </ProCard>

                  <ProTable<PaymentEntryReference>
                    columns={referenceColumns}
                    dataSource={data.references}
                    headerTitle="核销明细"
                    pagination={false}
                    rowKey={(record) =>
                      `${record.referenceDoctype}-${record.referenceName}`
                    }
                    scroll={{ x: 1050 }}
                    search={false}
                    toolBarRender={false}
                  />

                  <ProTable<PaymentEntryDeduction>
                    columns={deductionColumns}
                    dataSource={data.deductions}
                    headerTitle="差额 / 扣减明细"
                    locale={{ emptyText: '无差额或扣减明细' }}
                    pagination={false}
                    rowKey={(record, index) =>
                      `${record.account}-${record.amount}-${index}`
                    }
                    search={false}
                    toolBarRender={false}
                  />

                  <ProCard title="备注">
                    <Typography.Paragraph style={{ marginBottom: 0 }}>
                      {data.remarks || '无'}
                    </Typography.Paragraph>
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
                      <ProDescriptions.Item label="单据状态">
                        <StatusTag value={data.documentStatus} />
                      </ProDescriptions.Item>
                      <ProDescriptions.Item label="方向">
                        {directionTag(data.direction)}
                      </ProDescriptions.Item>
                      <ProDescriptions.Item label="业务类型">
                        {businessTypeText(data.businessType)}
                      </ProDescriptions.Item>
                      <ProDescriptions.Item
                        label="ERPNext 类型"
                        dataIndex="paymentType"
                      />
                    </ProDescriptions>
                  </ProCard>

                  <ProCard title="往来方">
                    <ProDescriptions column={1} dataSource={data}>
                      <ProDescriptions.Item
                        label="往来方类型"
                        dataIndex="partyType"
                      />
                      <ProDescriptions.Item
                        label="往来方"
                        dataIndex="partyName"
                      />
                      <ProDescriptions.Item label="付款方式">
                        {data.modeOfPayment || '未填写'}
                      </ProDescriptions.Item>
                    </ProDescriptions>
                  </ProCard>

                  <ProCard title="账户与参考号">
                    <ProDescriptions column={1} dataSource={data}>
                      <ProDescriptions.Item
                        label="付款账户"
                        dataIndex="paidFrom"
                      />
                      <ProDescriptions.Item
                        label="收款账户"
                        dataIndex="paidTo"
                      />
                      <ProDescriptions.Item
                        label="参考号"
                        dataIndex="referenceNo"
                      />
                      <ProDescriptions.Item
                        label="参考日期"
                        dataIndex="referenceDate"
                      />
                    </ProDescriptions>
                  </ProCard>

                  <ProCard title="关联单据">
                    <ProDescriptions column={1}>
                      <ProDescriptions.Item label="销售订单">
                        {docLinks(data.links.salesOrders, 'Sales Order')}
                      </ProDescriptions.Item>
                      <ProDescriptions.Item label="销售发票">
                        {docLinks(data.links.salesInvoices, 'Sales Invoice')}
                      </ProDescriptions.Item>
                      <ProDescriptions.Item label="采购订单">
                        {docLinks(data.links.purchaseOrders, 'Purchase Order')}
                      </ProDescriptions.Item>
                      <ProDescriptions.Item label="采购发票">
                        {docLinks(
                          data.links.purchaseInvoices,
                          'Purchase Invoice',
                        )}
                      </ProDescriptions.Item>
                      <ProDescriptions.Item label="退货发票">
                        {docLinks(
                          data.links.returnInvoices,
                          returnInvoiceDoctype(data),
                        )}
                      </ProDescriptions.Item>
                    </ProDescriptions>
                  </ProCard>

                  <ProCard title="动作状态">
                    <Alert
                      description={
                        data.actions.canCancel
                          ? '当前收付款单处于可作废状态。作废动作仍建议从对应销售或采购业务单据进入，避免脱离业务链路处理。'
                          : data.actions.cancelHint || '当前不可作废。'
                      }
                      message={data.actions.canCancel ? '可作废' : '暂不可作废'}
                      showIcon
                      type={data.actions.canCancel ? 'info' : 'warning'}
                    />
                  </ProCard>
                </Space>
              </ProCard>
            </ProCard>
          </>
        ) : null}
      </Space>
    </PageContainer>
  );
};

export default PaymentEntryDetailPage;
