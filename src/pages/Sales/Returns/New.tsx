import {
  PageContainer,
  ProCard,
  StatisticCard,
} from '@ant-design/pro-components';
import { history, useLocation } from '@umijs/max';
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  message,
  Result,
  Select,
  Space,
  Table,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import { RemoteLinkSelect } from '@/components';
import {
  getSalesReturnSourceContext,
  type SalesReturnSourceContext,
  type SalesReturnSourceContextItem,
  type SalesReturnSourceDoctype,
  type SalesReturnSubmissionResult,
  submitSalesReturn,
} from '@/services/myapp/sales';
import {
  formatCurrencyValue,
  formatDisplayUom,
  StatusTag,
} from '@/utils/myapp-display';

type ReturnLine = SalesReturnSourceContextItem & {
  returnQty: number;
};

type FormValues = {
  postingDate: dayjs.Dayjs;
  remarks?: string;
  sourceDoctype: SalesReturnSourceDoctype;
  sourceName: string;
};

function getDocumentPath(doctype: SalesReturnSourceDoctype, name: string) {
  const encodedName = encodeURIComponent(name);
  return doctype === 'Sales Invoice'
    ? `/sales/invoices/${encodedName}`
    : `/sales/delivery-notes/${encodedName}`;
}

function getSuggestedActionHint(result: SalesReturnSubmissionResult) {
  if (result.nextActions.suggestedNextAction === 'review_refund') {
    return '来源销售发票若已收款，下一步建议核对客户退款。';
  }
  return '可以查看退货单，或返回来源单据继续处理后续业务。';
}

function getRefundReviewPath(result: SalesReturnSubmissionResult) {
  const params = new URLSearchParams({
    returnInvoice: result.returnDocument,
    sourceInvoice: result.sourceName,
  });
  return `/sales/refunds/review?${params.toString()}`;
}

function estimateLineAmount(line: ReturnLine) {
  const maxQty = line.maxReturnableQty ?? line.sourceQty ?? 0;
  if (!maxQty || !line.amount) {
    return 0;
  }
  return (line.amount / maxQty) * line.returnQty;
}

function formatQty(value: number | null | undefined) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return '-';
  }
  return Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(2);
}

const SalesReturnNewPage: React.FC = () => {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const initialSourceDoctype =
    query.get('sourceDoctype') === 'Sales Invoice'
      ? 'Sales Invoice'
      : 'Delivery Note';
  const initialSourceName = query.get('sourceName') ?? '';
  const [form] = Form.useForm<FormValues>();
  const sourceDoctype =
    Form.useWatch('sourceDoctype', form) ?? initialSourceDoctype;
  const sourceName = Form.useWatch('sourceName', form) ?? initialSourceName;
  const [context, setContext] = useState<SalesReturnSourceContext | null>(null);
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SalesReturnSubmissionResult | null>(
    null,
  );

  const selectedLines = useMemo(
    () => lines.filter((line) => line.returnQty > 0),
    [lines],
  );
  const selectedQtyTotal = useMemo(
    () => selectedLines.reduce((sum, line) => sum + line.returnQty, 0),
    [selectedLines],
  );
  const selectedAmount = useMemo(
    () =>
      selectedLines.reduce((sum, line) => sum + estimateLineAmount(line), 0),
    [selectedLines],
  );
  const hasInvalidQty = lines.some(
    (line) =>
      line.returnQty < 0 ||
      (line.maxReturnableQty !== null &&
        line.maxReturnableQty !== undefined &&
        line.returnQty > line.maxReturnableQty),
  );

  const loadContext = async () => {
    const values = await form.validateFields(['sourceDoctype', 'sourceName']);
    setLoadingContext(true);
    setResult(null);
    try {
      const nextContext = await getSalesReturnSourceContext(
        values.sourceDoctype,
        values.sourceName,
      );
      setContext(nextContext);
      setLines(
        (nextContext?.items ?? []).map((item) => ({
          ...item,
          returnQty:
            item.defaultReturnQty ??
            item.maxReturnableQty ??
            item.sourceQty ??
            0,
        })),
      );
      if (!nextContext) {
        message.warning('未找到退货来源单据');
      }
    } finally {
      setLoadingContext(false);
    }
  };

  useEffect(() => {
    if (!initialSourceName) {
      return;
    }
    void loadContext();
  }, []);

  const updateLineQty = (detailId: string, returnQty: number) => {
    setLines((current) =>
      current.map((line) =>
        line.detailId === detailId ? { ...line, returnQty } : line,
      ),
    );
  };

  const submitReturn = async () => {
    const values = await form.validateFields();
    if (!context) {
      message.warning('请先读取来源单据');
      return;
    }
    if (!context.canProcessReturn) {
      message.warning('当前来源单据暂不允许退货');
      return;
    }
    if (!selectedLines.length) {
      message.warning('请至少填写一条退货数量');
      return;
    }
    if (hasInvalidQty) {
      message.warning('退货数量不能小于 0，且不能超过可退数量');
      return;
    }

    setSubmitting(true);
    try {
      const submitted = await submitSalesReturn({
        postingDate: values.postingDate.format('YYYY-MM-DD'),
        remarks: values.remarks,
        returnItems: selectedLines.map((line) => ({
          [line.detailSubmitKey]: line.detailId,
          qty: line.returnQty,
        })),
        sourceDoctype: values.sourceDoctype,
        sourceName: values.sourceName,
      });
      setResult(submitted.data);
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<ReturnLine> = [
    {
      dataIndex: 'itemName',
      title: '商品',
      width: 240,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.itemName}</Typography.Text>
          <Typography.Text type="secondary">{record.itemCode}</Typography.Text>
          {record.specification ? (
            <Typography.Text type="secondary">
              {record.specification}
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      align: 'right',
      dataIndex: 'sourceQty',
      title: '来源数量',
      width: 110,
    },
    {
      align: 'right',
      dataIndex: 'returnedQty',
      title: '已退数量',
      width: 110,
    },
    {
      align: 'right',
      dataIndex: 'maxReturnableQty',
      title: '可退数量',
      width: 110,
    },
    {
      dataIndex: 'returnQty',
      title: '本次退货',
      width: 140,
      render: (_, record) => (
        <InputNumber
          min={0}
          onChange={(nextValue) =>
            updateLineQty(record.detailId, Number(nextValue ?? 0))
          }
          precision={3}
          style={{ width: '100%' }}
          value={record.returnQty}
        />
      ),
    },
    {
      dataIndex: 'uom',
      title: '单位',
      width: 90,
      render: (_, record) => formatDisplayUom(record.uom),
    },
    {
      align: 'right',
      dataIndex: 'rate',
      title: '单价',
      width: 120,
      render: (_, record) =>
        formatCurrencyValue(record.rate, context?.currency),
    },
    {
      align: 'right',
      title: '退货金额估算',
      width: 140,
      render: (_, record) =>
        formatCurrencyValue(estimateLineAmount(record), context?.currency),
    },
    {
      dataIndex: 'warehouse',
      ellipsis: true,
      title: '仓库',
      width: 180,
    },
  ];

  return (
    <PageContainer
      title="销售退货"
      extra={[
        <Button key="orders" onClick={() => history.push('/sales/orders')}>
          返回销售订单
        </Button>,
      ]}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          message="退货会基于销售发货单或销售发票创建独立退货单；来源发票已收款时，退货后需继续核对客户退款。"
          showIcon
          type="info"
        />

        <ProCard>
          <Form<FormValues>
            form={form}
            initialValues={{
              postingDate: dayjs(),
              sourceDoctype: initialSourceDoctype,
              sourceName: initialSourceName,
            }}
            layout="vertical"
          >
            <div
              style={{
                display: 'grid',
                gap: 16,
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              }}
            >
              <Form.Item label="来源类型" name="sourceDoctype">
                <Select
                  onChange={() => {
                    form.setFieldValue('sourceName', '');
                    setContext(null);
                    setLines([]);
                    setResult(null);
                  }}
                  options={[
                    { label: '销售发货单', value: 'Delivery Note' },
                    { label: '销售发票', value: 'Sales Invoice' },
                  ]}
                />
              </Form.Item>
              <Form.Item
                label="来源单据"
                name="sourceName"
                rules={[{ required: true, message: '请选择来源单据' }]}
              >
                <RemoteLinkSelect
                  doctype={sourceDoctype}
                  extraFields={['customer', 'company']}
                  placeholder="搜索来源单据"
                />
              </Form.Item>
              <Form.Item
                label="退货日期"
                name="postingDate"
                rules={[{ required: true, message: '请选择退货日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </div>
            <Form.Item label="备注" name="remarks">
              <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
            </Form.Item>
            <Space>
              <Button
                loading={loadingContext}
                onClick={() => void loadContext()}
                type="primary"
              >
                读取来源单据
              </Button>
              {sourceName ? (
                <Button
                  onClick={() =>
                    history.push(getDocumentPath(sourceDoctype, sourceName))
                  }
                >
                  查看来源单据
                </Button>
              ) : null}
            </Space>
          </Form>
        </ProCard>

        {context ? (
          <>
            <StatisticCard.Group direction="row">
              <StatisticCard
                statistic={{
                  title: '来源金额',
                  value: formatCurrencyValue(
                    context.primaryAmount,
                    context.currency,
                  ),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '本次退货估算',
                  value: formatCurrencyValue(selectedAmount, context.currency),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '退货数量',
                  value: selectedQtyTotal,
                }}
              />
            </StatisticCard.Group>

            <ProCard title="来源信息">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Space wrap size={24}>
                  <Typography.Text>
                    来源：{context.sourceLabel} {context.sourceName}
                  </Typography.Text>
                  <Typography.Text>
                    客户：{context.partyDisplayName}
                  </Typography.Text>
                  <Typography.Text>公司：{context.company}</Typography.Text>
                  <Typography.Text>
                    状态：
                    <StatusTag value={context.documentStatus} />
                  </Typography.Text>
                  <Typography.Text>
                    可退货：{context.canProcessReturn ? '是' : '否'}
                  </Typography.Text>
                </Space>
                {!context.canProcessReturn ? (
                  <Alert
                    message="当前来源单据暂不允许继续退货，请先回到来源单据确认状态。"
                    showIcon
                    type="warning"
                  />
                ) : context.sourceDoctype === 'Sales Invoice' &&
                  (context.outstandingAmount ?? 0) <= 0 ? (
                  <Alert
                    description="来源销售发票看起来已经结清。退货单创建后，需要继续核对客户退款或回退原收款。"
                    message="退货后需要关注退款核对"
                    showIcon
                    type="warning"
                  />
                ) : (
                  <Alert
                    description="退货会创建独立退货单，原来源单据保留业务事实；退款、收款回退等财务动作在退货后单独核对。"
                    message="退货不会直接改写原销售订单"
                    showIcon
                    type="info"
                  />
                )}
              </Space>
            </ProCard>

            <ProCard title="退货明细">
              <Table<ReturnLine>
                columns={columns}
                dataSource={lines}
                pagination={false}
                rowKey="detailId"
                scroll={{ x: 1330 }}
              />
            </ProCard>

            <ProCard>
              <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                <Typography.Text type="secondary">
                  已选择 {selectedLines.length} 条，数量 {selectedQtyTotal}
                  ，金额 {formatCurrencyValue(selectedAmount, context.currency)}
                </Typography.Text>
                <Button
                  disabled={!context.canProcessReturn || hasInvalidQty}
                  loading={submitting}
                  onClick={() => void submitReturn()}
                  type="primary"
                >
                  提交退货
                </Button>
              </Space>
            </ProCard>
          </>
        ) : null}

        {result ? (
          <ProCard>
            <Result
              status="success"
              title="销售退货单已创建"
              subTitle={`${result.returnDoctype} ${result.returnDocument}，${getSuggestedActionHint(result)}`}
              extra={[
                result.nextActions.suggestedNextAction === 'review_refund' ? (
                  <Button
                    key="refund"
                    onClick={() => history.push(getRefundReviewPath(result))}
                    type="primary"
                  >
                    核对退款
                  </Button>
                ) : null,
                <Button
                  key="return"
                  onClick={() =>
                    history.push(
                      getDocumentPath(
                        result.returnDoctype,
                        result.returnDocument,
                      ),
                    )
                  }
                  type={
                    result.nextActions.suggestedNextAction === 'review_refund'
                      ? 'default'
                      : 'primary'
                  }
                >
                  查看退货单
                </Button>,
                <Button
                  key="source"
                  onClick={() =>
                    history.push(
                      getDocumentPath(result.sourceDoctype, result.sourceName),
                    )
                  }
                >
                  返回来源单据
                </Button>,
              ]}
            />
            <StatisticCard.Group direction="row">
              <StatisticCard
                statistic={{
                  title: '退货明细',
                  value: `${result.summary.itemCount} 条`,
                }}
              />
              <StatisticCard
                statistic={{
                  title: '退货数量',
                  value: formatQty(result.summary.totalQty),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '预计退货金额',
                  value: formatCurrencyValue(
                    result.summary.returnAmountEstimate,
                    context?.currency,
                  ),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '退货方式',
                  value: result.summary.isPartialReturn
                    ? '部分退货'
                    : '整单退货',
                }}
              />
            </StatisticCard.Group>
          </ProCard>
        ) : null}
      </Space>
    </PageContainer>
  );
};

export default SalesReturnNewPage;
