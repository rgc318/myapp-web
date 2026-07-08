import {
  PageContainer,
  ProCard,
  ProDescriptions,
  StatisticCard,
} from '@ant-design/pro-components';
import { history, Link, useLocation, useRequest } from '@umijs/max';
import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Result,
  Skeleton,
  Space,
  Typography,
} from 'antd';
import React, { useState } from 'react';
import { RemoteLinkSelect } from '@/components';
import { PURCHASE_RETURN_REFUND_ENTRY_ENABLED } from '@/config/feature-flags';
import {
  cancelSupplierPaymentEntry,
  createSupplierRefund,
  getPurchaseInvoiceDetail,
  getSupplierRefundContext,
  type SupplierRefundResult,
} from '@/services/myapp/purchase';
import { formatCurrencyValue, StatusTag } from '@/utils/myapp-display';

type FormValues = {
  invoiceName: string;
  returnInvoiceName?: string;
};

function invoicePath(name: string) {
  return `/purchase/invoices/${encodeURIComponent(name)}`;
}

function paymentEntryPath(name: string) {
  return `/payments/${encodeURIComponent(name)}`;
}

const PurchaseRefundReviewDisabledPage: React.FC = () => (
  <PageContainer title="采购退款核对">
    <Result
      extra={[
        <Button key="orders" onClick={() => history.push('/purchase/orders')}>
          返回采购订单
        </Button>,
      ]}
      status="info"
      subTitle="Web 端已暂停直接登记供应商退款。当前业务改错请从采购订单使用“回退并修改订单”，或进入采购发票详情取消相关付款后再处理。"
      title="采购退款入口已暂停"
    />
  </PageContainer>
);

const PurchaseRefundReviewFormPage: React.FC = () => {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const [form] = Form.useForm<FormValues>();
  const [invoiceName, setInvoiceName] = useState(
    query.get('sourceInvoice') ?? '',
  );
  const [returnInvoiceName, setReturnInvoiceName] = useState(
    query.get('returnInvoice') ?? '',
  );
  const [cancelLoading, setCancelLoading] = useState(false);
  const [refundLoading, setRefundLoading] = useState(false);
  const [lastRefundResult, setLastRefundResult] =
    useState<SupplierRefundResult>();

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

  const {
    data: refundContext,
    error: refundContextError,
    loading: refundContextLoading,
    refresh: refreshRefundContext,
  } = useRequest(
    () =>
      returnInvoiceName
        ? getSupplierRefundContext(returnInvoiceName)
        : Promise.resolve(null),
    {
      formatResult: (result) => result,
      onSuccess: (nextContext) => {
        const suggestedAmount =
          nextContext?.refund.suggestedRefundAmount ??
          nextContext?.refund.refundableAmount ??
          0;
        if (suggestedAmount > 0) {
          setLastRefundResult(undefined);
        }
      },
      refreshDeps: [returnInvoiceName],
    },
  );

  const loadInvoice = async () => {
    const values = await form.validateFields([
      'invoiceName',
      'returnInvoiceName',
    ]);
    setInvoiceName(values.invoiceName);
    setReturnInvoiceName(values.returnInvoiceName ?? '');
  };

  const confirmCreateRefund = () => {
    const refundableAmount = refundContext?.refund.refundableAmount ?? 0;
    const suggestedAmount =
      refundContext?.refund.suggestedRefundAmount ?? refundableAmount;

    if (!returnInvoiceName) {
      message.warning('请先选择采购退货发票');
      return;
    }
    if (!refundContext?.actions.canCreateRefund) {
      message.warning(
        refundContext?.actions.createRefundHint || '当前不能登记供应商退款',
      );
      return;
    }

    let refundAmount = suggestedAmount;
    let modeOfPayment = '';
    let remarks = '';

    Modal.confirm({
      cancelText: '取消',
      content: (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <InputNumber
            addonBefore="退款金额"
            defaultValue={refundAmount}
            max={refundableAmount || undefined}
            min={0}
            onChange={(value) => {
              refundAmount = Number(value ?? 0);
            }}
            precision={2}
            style={{ width: '100%' }}
          />
          <Input
            onChange={(event) => {
              modeOfPayment = event.target.value;
            }}
            placeholder="付款方式，可留空使用默认值"
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
      okText: '登记退款',
      onOk: async () => {
        if (refundAmount <= 0) {
          message.error('退款金额必须大于 0');
          throw new Error('Invalid refund amount');
        }
        if (refundableAmount > 0 && refundAmount > refundableAmount) {
          message.error('退款金额不能超过当前可退金额');
          throw new Error('Refund amount exceeds refundable amount');
        }

        setRefundLoading(true);
        try {
          const result = await createSupplierRefund(
            returnInvoiceName,
            refundAmount,
            {
              modeOfPayment,
              remarks,
            },
          );
          setLastRefundResult(result.data);
          refreshRefundContext();
        } catch (caught) {
          message.error(caught instanceof Error ? caught.message : '操作失败');
          throw caught;
        } finally {
          setRefundLoading(false);
        }
      },
      title: `登记供应商退款 ${returnInvoiceName}`,
      width: 560,
    });
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
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          message="本页用于核对采购退货后的供应商退款，可基于采购退货发票登记退款，也可在需要时回退原付款。"
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

        {refundContextError ? (
          <Alert
            description={
              refundContextError instanceof Error
                ? refundContextError.message
                : '请稍后重试。'
            }
            message="供应商退款上下文加载失败"
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

            <ProCard split="vertical">
              <ProCard colSpan="65%">
                <Space
                  orientation="vertical"
                  size={16}
                  style={{ width: '100%' }}
                >
                  <ProCard title="退款核对">
                    <ProDescriptions column={2} dataSource={data}>
                      <ProDescriptions.Item label="采购发票" dataIndex="name" />
                      <ProDescriptions.Item label="公司" dataIndex="company" />
                      <ProDescriptions.Item label="供应商">
                        {data.supplierName || data.supplier || '-'}
                      </ProDescriptions.Item>
                      <ProDescriptions.Item label="付款状态">
                        <StatusTag value={data.paymentStatus} />
                      </ProDescriptions.Item>
                      <ProDescriptions.Item label="最近付款">
                        {data.latestPaymentEntry ? (
                          <Link to={paymentEntryPath(data.latestPaymentEntry)}>
                            {data.latestPaymentEntry}
                          </Link>
                        ) : (
                          '无'
                        )}
                      </ProDescriptions.Item>
                      <ProDescriptions.Item
                        label="备注"
                        dataIndex="remarks"
                        span={2}
                      />
                    </ProDescriptions>
                  </ProCard>

                  <ProCard title="后续处理">
                    <Alert
                      action={
                        <Space>
                          <Button
                            disabled={!refundContext?.actions.canCreateRefund}
                            loading={refundLoading || refundContextLoading}
                            onClick={confirmCreateRefund}
                            size="small"
                            type="primary"
                          >
                            登记供应商退款
                          </Button>
                          {data.latestPaymentEntry ? (
                            <Button
                              danger
                              loading={cancelLoading}
                              onClick={confirmCancelPayment}
                              size="small"
                            >
                              取消最近付款
                            </Button>
                          ) : null}
                        </Space>
                      }
                      description={
                        refundContext?.actions.createRefundHint ||
                        '如供应商已退款，可基于采购退货发票登记退款；如原付款登记有误，可取消最近付款。'
                      }
                      message="当前页面用于供应商退款核对"
                      showIcon
                      type={
                        refundContext?.actions.canCreateRefund
                          ? 'success'
                          : 'info'
                      }
                    />
                    {lastRefundResult ? (
                      <Alert
                        description={
                          lastRefundResult.paymentEntry ? (
                            <Link
                              to={paymentEntryPath(
                                lastRefundResult.paymentEntry,
                              )}
                            >
                              查看退款单 {lastRefundResult.paymentEntry}
                            </Link>
                          ) : null
                        }
                        message={`供应商退款已登记：${formatCurrencyValue(
                          lastRefundResult.refundAmount,
                          refundContext?.refund.currency ?? data.currency,
                        )}`}
                        showIcon
                        style={{ marginTop: 12 }}
                        type="success"
                      />
                    ) : null}
                  </ProCard>
                </Space>
              </ProCard>

              <ProCard colSpan="35%">
                <Space
                  orientation="vertical"
                  size={16}
                  style={{ width: '100%' }}
                >
                  <ProCard title="处理建议">
                    <Typography.Paragraph style={{ marginBottom: 0 }}>
                      供应商退款应以采购退货发票为依据登记。若只是原付款登记错误，优先回退付款；若供应商实际退回资金，则登记供应商退款并保留对应凭证。
                    </Typography.Paragraph>
                  </ProCard>

                  <ProCard title="发票关系">
                    <ProDescriptions column={1}>
                      <ProDescriptions.Item label="来源采购发票">
                        <Link to={invoicePath(data.name)}>{data.name}</Link>
                      </ProDescriptions.Item>
                      <ProDescriptions.Item label="退货发票">
                        {returnInvoiceName ? (
                          <Link to={invoicePath(returnInvoiceName)}>
                            {returnInvoiceName}
                          </Link>
                        ) : (
                          '未选择'
                        )}
                      </ProDescriptions.Item>
                    </ProDescriptions>
                  </ProCard>

                  <ProCard title="退款状态">
                    <ProDescriptions column={1}>
                      <ProDescriptions.Item label="退货金额">
                        {formatCurrencyValue(
                          refundContext?.refund.returnAmount,
                          refundContext?.refund.currency ?? data.currency,
                        )}
                      </ProDescriptions.Item>
                      <ProDescriptions.Item label="已退金额">
                        {formatCurrencyValue(
                          refundContext?.refund.refundedAmount,
                          refundContext?.refund.currency ?? data.currency,
                        )}
                      </ProDescriptions.Item>
                      <ProDescriptions.Item label="可退金额">
                        {formatCurrencyValue(
                          refundContext?.refund.refundableAmount,
                          refundContext?.refund.currency ?? data.currency,
                        )}
                      </ProDescriptions.Item>
                      <ProDescriptions.Item label="状态">
                        <StatusTag value={refundContext?.refund.status ?? ''} />
                      </ProDescriptions.Item>
                    </ProDescriptions>
                  </ProCard>

                  <ProCard title="付款状态">
                    <ProDescriptions column={1} dataSource={data}>
                      <ProDescriptions.Item label="单据状态">
                        <StatusTag value={data.documentStatus} />
                      </ProDescriptions.Item>
                      <ProDescriptions.Item label="付款状态">
                        <StatusTag value={data.paymentStatus} />
                      </ProDescriptions.Item>
                      <ProDescriptions.Item label="最近付款">
                        {data.latestPaymentEntry ? (
                          <Link to={paymentEntryPath(data.latestPaymentEntry)}>
                            {data.latestPaymentEntry}
                          </Link>
                        ) : (
                          '无'
                        )}
                      </ProDescriptions.Item>
                    </ProDescriptions>
                  </ProCard>

                  <ProCard title="回退动作">
                    <Space orientation="vertical" style={{ width: '100%' }}>
                      <Button
                        block
                        disabled={!refundContext?.actions.canCreateRefund}
                        loading={refundLoading || refundContextLoading}
                        onClick={confirmCreateRefund}
                        type="primary"
                      >
                        登记供应商退款
                      </Button>
                      <Button
                        block
                        danger
                        disabled={!data.latestPaymentEntry}
                        loading={cancelLoading}
                        onClick={confirmCancelPayment}
                      >
                        取消最近付款
                      </Button>
                    </Space>
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

const PurchaseRefundReviewPage: React.FC = () =>
  PURCHASE_RETURN_REFUND_ENTRY_ENABLED ? (
    <PurchaseRefundReviewFormPage />
  ) : (
    <PurchaseRefundReviewDisabledPage />
  );

export default PurchaseRefundReviewPage;
