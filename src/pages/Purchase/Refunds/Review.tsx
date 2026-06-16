import {
  PageContainer,
  ProCard,
  ProDescriptions,
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
  cancelSupplierPaymentEntry,
  getPurchaseInvoiceDetail,
} from '@/services/myapp/purchase';
import { formatCurrencyValue, StatusTag } from '@/utils/myapp-display';

type FormValues = {
  invoiceName: string;
  returnInvoiceName?: string;
};

function invoicePath(name: string) {
  return `/purchase/invoices/${encodeURIComponent(name)}`;
}

const PurchaseRefundReviewPage: React.FC = () => {
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
      invoiceName
        ? getPurchaseInvoiceDetail(invoiceName)
        : Promise.resolve(null),
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
      message.warning('当前发票没有可回退的最近付款');
      return;
    }

    Modal.confirm({
      cancelText: '取消',
      content:
        '这会作废当前采购发票最近一笔付款记录，用于退货后需要回退供应商付款的场景。若供应商已线下退款，请先按财务规范处理实际退款凭证。',
      okText: '取消最近付款',
      okType: 'danger',
      onOk: async () => {
        setCancelLoading(true);
        try {
          await cancelSupplierPaymentEntry(data.latestPaymentEntry);
          refresh();
        } catch (caught) {
          message.error(caught instanceof Error ? caught.message : '操作失败');
          throw caught;
        } finally {
          setCancelLoading(false);
        }
      },
      title: `取消付款 ${data.latestPaymentEntry}？`,
      width: 620,
    });
  };

  return (
    <PageContainer
      title="采购退款核对"
      extra={[
        <Button key="orders" onClick={() => history.push('/purchase/orders')}>
          返回采购订单
        </Button>,
      ]}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          message="当前系统尚未提供独立供应商退款入账接口。本页用于退货后核对来源采购发票付款状态，并在需要时回退最近付款。"
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
                label="来源采购发票"
                name="invoiceName"
                rules={[{ required: true, message: '请选择来源采购发票' }]}
              >
                <RemoteLinkSelect
                  doctype="Purchase Invoice"
                  extraFields={['supplier', 'company']}
                  placeholder="搜索来源采购发票"
                />
              </Form.Item>
              <Form.Item label="退货发票" name="returnInvoiceName">
                <RemoteLinkSelect
                  doctype="Purchase Invoice"
                  extraFields={['supplier', 'company']}
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
            message="采购发票加载失败"
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
            <Empty description="未找到采购发票" />
          </ProCard>
        ) : null}

        {data ? (
          <>
            <StatisticCard.Group direction="row">
              <StatisticCard
                statistic={{
                  title: '应付金额',
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
                  title: '当前未付',
                  value: formatCurrencyValue(
                    data.outstandingAmount,
                    data.currency,
                  ),
                }}
              />
            </StatisticCard.Group>

            <ProCard title="退款核对">
              <ProDescriptions column={2} dataSource={data}>
                <ProDescriptions.Item label="采购发票" dataIndex="name" />
                <ProDescriptions.Item label="公司" dataIndex="company" />
                <ProDescriptions.Item label="单据状态">
                  <StatusTag value={data.documentStatus} />
                </ProDescriptions.Item>
                <ProDescriptions.Item label="付款状态">
                  <StatusTag value={data.paymentStatus} />
                </ProDescriptions.Item>
                <ProDescriptions.Item
                  label="最近付款"
                  dataIndex="latestPaymentEntry"
                />
                <ProDescriptions.Item label="供应商" dataIndex="supplierName" />
                <ProDescriptions.Item
                  label="备注"
                  dataIndex="remarks"
                  span={2}
                />
              </ProDescriptions>
            </ProCard>

            <ProCard>
              <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                <Typography.Text type="secondary">
                  如退货后需要回退原付款，可取消最近付款；如供应商已线下退款，请保留财务凭证并按实际流程登记。
                </Typography.Text>
                <Button
                  danger
                  disabled={!data.latestPaymentEntry}
                  loading={cancelLoading}
                  onClick={confirmCancelPayment}
                >
                  取消最近付款
                </Button>
              </Space>
            </ProCard>
          </>
        ) : null}
      </Space>
    </PageContainer>
  );
};

export default PurchaseRefundReviewPage;
