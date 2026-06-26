import { SaveOutlined } from '@ant-design/icons';
import {
  FooterToolbar,
  PageContainer,
  ProCard,
} from '@ant-design/pro-components';
import { history, useParams, useRequest } from '@umijs/max';
import {
  Alert,
  Button,
  Col,
  DatePicker,
  Form,
  Input,
  message,
  Result,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ProductSelect,
  RemoteLinkSelect,
  SalesOrderLinesTable,
} from '@/components';
import {
  getProductDetail,
  type ProductSummary,
} from '@/services/myapp/master-data';
import {
  getSalesOrderDetail,
  type SalesOrderDetail,
  type SalesOrderDetailItem,
  updateSalesOrderItemsV2,
  updateSalesOrderV2,
} from '@/services/myapp/sales';
import { formatCurrencyValue } from '@/utils/myapp-display';
import {
  buildSalesOrderLineFromProduct,
  getOrderLinesTotal,
  getSalesModeLabel,
  normalizeSalesMode,
  recalculateSalesOrderLine,
  type SalesMode,
  type SalesOrderEditorLine,
} from '@/utils/sales-order-editor';

type FormValues = {
  company: string;
  contactDisplayName?: string;
  contactPhone?: string;
  customer: string;
  defaultSalesMode: SalesMode;
  deliveryDate: dayjs.Dayjs;
  remarks?: string;
  shippingAddressText?: string;
  transactionDate: dayjs.Dayjs;
  warehouse?: string;
};

function dateValue(value: string) {
  return value ? dayjs(value) : dayjs();
}

function normalizeTextareaValue(value: string) {
  return value
    ? value
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p\s*>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    : '';
}

function fallbackLineFromItem(
  item: SalesOrderDetailItem,
  defaultMode: SalesMode,
): SalesOrderEditorLine {
  const uom = item.uom || null;
  const price = item.rate ?? 0;
  return recalculateSalesOrderLine({
    allUomDisplays: {},
    allUoms: uom ? [uom] : [],
    amount: item.amount ?? 0,
    imageUrl: item.imageUrl,
    itemCode: item.itemCode,
    itemName: item.itemName || item.itemCode,
    key:
      item.salesOrderItem || `${item.itemCode}:${item.warehouse || 'default'}`,
    modeDefaults: {
      retail: { price, uom },
      wholesale: { price, uom },
    },
    price,
    qty: item.qty ?? 1,
    salesMode: item.salesMode || defaultMode,
    specification: item.specification,
    stockQty: null,
    stockUom: uom,
    uom,
    uomConversions: [],
    warehouse: item.warehouse,
  });
}

async function buildEditableLines(detail: SalesOrderDetail) {
  const products = await Promise.all(
    detail.items.map((item) =>
      getProductDetail(item.itemCode, {
        company: detail.company,
        warehouse: item.warehouse,
      }).catch(() => null),
    ),
  );

  return detail.items.map((item, index) => {
    const mode = normalizeSalesMode(item.salesMode || detail.defaultSalesMode);
    const product = products[index];
    if (!product) {
      return fallbackLineFromItem(item, mode);
    }

    return recalculateSalesOrderLine({
      ...buildSalesOrderLineFromProduct({
        defaultMode: mode,
        defaultWarehouse: item.warehouse,
        product,
      }),
      amount: item.amount ?? 0,
      key:
        item.salesOrderItem ||
        `${item.itemCode}:${item.warehouse || 'default'}`,
      price: item.rate,
      qty: item.qty ?? 1,
      salesMode: mode,
      uom: item.uom || product.uom || product.stockUom,
      warehouse: item.warehouse || product.warehouse,
      imageUrl: item.imageUrl || product.imageUrl,
    });
  });
}

const SalesOrderEditPage: React.FC = () => {
  const params = useParams();
  const orderName = decodeURIComponent(String(params.name ?? ''));
  const [form] = Form.useForm<FormValues>();
  const [lines, setLines] = useState<SalesOrderEditorLine[]>([]);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const defaultSalesMode =
    Form.useWatch('defaultSalesMode', form) ?? 'wholesale';
  const company = Form.useWatch('company', form);
  const warehouse = Form.useWatch('warehouse', form);
  const totalAmount = useMemo(() => getOrderLinesTotal(lines), [lines]);
  const totalQty = useMemo(
    () =>
      lines.reduce(
        (sum, line) => sum + (Number.isFinite(line.qty) ? line.qty : 0),
        0,
      ),
    [lines],
  );

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty || submitting) {
        return;
      }
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty, submitting]);

  const { data, error, loading } = useRequest(
    async () => {
      const detail = await getSalesOrderDetail(orderName);
      if (!detail) {
        return null;
      }
      const editableLines = await buildEditableLines(detail);
      form.setFieldsValue({
        company: detail.company,
        contactDisplayName: detail.contactDisplay,
        contactPhone: detail.contactPhone,
        customer: detail.customer,
        defaultSalesMode: detail.defaultSalesMode,
        deliveryDate: dateValue(detail.deliveryDate),
        remarks: normalizeTextareaValue(detail.remarks),
        shippingAddressText: normalizeTextareaValue(detail.addressDisplay),
        transactionDate: dateValue(detail.transactionDate),
        warehouse: editableLines.find((line) => line.warehouse)?.warehouse,
      });
      setLines(editableLines);
      setDirty(false);
      return detail;
    },
    {
      formatResult: (result) => result,
      refreshDeps: [orderName],
    },
  );

  const addProduct = (product: ProductSummary) => {
    const nextLine = buildSalesOrderLineFromProduct({
      defaultMode: defaultSalesMode,
      defaultWarehouse: warehouse,
      product,
    });
    setDirty(true);
    setLines((current) => {
      const existing = current.find((line) => line.key === nextLine.key);
      if (existing) {
        return current.map((line) =>
          line.key === nextLine.key
            ? recalculateSalesOrderLine({ ...line, qty: line.qty + 1 })
            : line,
        );
      }
      return [...current, nextLine];
    });
  };

  const applyDefaultModeToLines = (nextMode: SalesMode) => {
    setDirty(true);
    setLines((current) =>
      current.map((line) =>
        recalculateSalesOrderLine({
          ...line,
          price: line.modeDefaults[nextMode]?.price ?? line.price,
          salesMode: nextMode,
          uom: line.modeDefaults[nextMode]?.uom || line.uom,
        }),
      ),
    );
  };

  const submitOrder = async () => {
    const values = await form.validateFields();
    if (!lines.length) {
      message.warning('请先选择商品');
      return;
    }

    setSubmitting(true);
    try {
      await updateSalesOrderV2(orderName, {
        customerInfo: {
          contactDisplayName: values.contactDisplayName,
          contactPhone: values.contactPhone,
        },
        defaultSalesMode: values.defaultSalesMode,
        deliveryDate: values.deliveryDate.format('YYYY-MM-DD'),
        remarks: values.remarks,
        shippingInfo: {
          receiverName: values.contactDisplayName,
          receiverPhone: values.contactPhone,
          shippingAddressText: values.shippingAddressText,
        },
        transactionDate: values.transactionDate.format('YYYY-MM-DD'),
      });
      const result = await updateSalesOrderItemsV2(orderName, {
        company: values.company,
        defaultWarehouse: values.warehouse,
        deliveryDate: values.deliveryDate.format('YYYY-MM-DD'),
        items: lines.map((line) => ({
          itemCode: line.itemCode,
          price: line.price,
          qty: line.qty,
          salesMode: line.salesMode,
          uom: line.uom,
          warehouse: line.warehouse || values.warehouse,
        })),
      });
      history.push(
        `/sales/orders/${encodeURIComponent(result.data.order || orderName)}`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageContainer title={`编辑销售订单 ${orderName}`}>
        <Skeleton active />
      </PageContainer>
    );
  }

  if (error || !data) {
    return (
      <PageContainer title={`编辑销售订单 ${orderName}`}>
        <Result
          status="warning"
          title="未能加载销售订单"
          extra={
            <Button onClick={() => history.push('/sales/orders')}>
              返回列表
            </Button>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={`编辑销售订单 ${orderName}`}
      extra={[
        <Button
          key="detail"
          onClick={() =>
            history.push(`/sales/orders/${encodeURIComponent(orderName)}`)
          }
        >
          返回详情
        </Button>,
      ]}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          message="保存会先更新订单日期、交付日期、销售模式和收货信息，再替换商品明细；已发货或已开票订单可能被后端拒绝编辑。"
          showIcon
          type="info"
        />

        <ProCard title="金额摘要">
          <Row gutter={[24, 16]}>
            <Col lg={6} sm={12} xs={24}>
              <Statistic title="商品种类" value={lines.length} suffix="种" />
              <Typography.Text type="secondary">
                当前编辑明细行数
              </Typography.Text>
            </Col>
            <Col lg={6} sm={12} xs={24}>
              <Statistic
                title="商品数量"
                value={totalQty}
                precision={Number.isInteger(totalQty) ? 0 : 2}
              />
              <Typography.Text type="secondary">按订单单位汇总</Typography.Text>
            </Col>
            <Col lg={6} sm={12} xs={24}>
              <Statistic
                styles={{
                  content: {
                    color: '#cf1322',
                    fontSize: 24,
                    fontWeight: 700,
                  },
                }}
                title="订单金额"
                value={formatCurrencyValue(totalAmount)}
              />
              <Typography.Text type="secondary">
                随商品数量和单价实时更新
              </Typography.Text>
            </Col>
            <Col lg={6} sm={12} xs={24}>
              <Statistic title="编辑状态" value={dirty ? '未保存' : '已同步'} />
              <Typography.Text type={dirty ? 'danger' : 'secondary'}>
                {dirty ? '请保存后再离开页面' : '当前无待保存修改'}
              </Typography.Text>
            </Col>
          </Row>
        </ProCard>

        <ProCard title="订单基础信息">
          <Form<FormValues>
            form={form}
            layout="vertical"
            onValuesChange={() => setDirty(true)}
          >
            <div
              style={{
                display: 'grid',
                gap: 16,
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              }}
            >
              <Form.Item label="客户" name="customer">
                <RemoteLinkSelect
                  disabled
                  doctype="Customer"
                  placeholder="客户"
                />
              </Form.Item>
              <Form.Item
                label="公司"
                name="company"
                rules={[{ required: true, message: '请选择公司' }]}
              >
                <RemoteLinkSelect
                  disabled
                  doctype="Company"
                  placeholder="公司"
                />
              </Form.Item>
              <Form.Item label="默认仓库" name="warehouse">
                <RemoteLinkSelect
                  doctype="Warehouse"
                  extraFields={['company']}
                  filters={{ company }}
                  placeholder="搜索仓库"
                />
              </Form.Item>
              <Form.Item label="销售模式" name="defaultSalesMode">
                <Select
                  onChange={(nextMode: SalesMode) => {
                    applyDefaultModeToLines(nextMode);
                  }}
                  options={[
                    { label: '批发', value: 'wholesale' },
                    { label: '零售', value: 'retail' },
                  ]}
                />
              </Form.Item>
              <Form.Item
                label="订单日期"
                name="transactionDate"
                rules={[{ required: true, message: '请选择订单日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                label="交付日期"
                name="deliveryDate"
                rules={[{ required: true, message: '请选择交付日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="联系人" name="contactDisplayName">
                <Input placeholder="联系人" />
              </Form.Item>
              <Form.Item label="联系电话" name="contactPhone">
                <Input placeholder="联系电话" />
              </Form.Item>
            </div>
            <Form.Item label="收货地址" name="shippingAddressText">
              <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
            </Form.Item>
            <Form.Item label="备注" name="remarks">
              <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
            </Form.Item>
          </Form>
        </ProCard>

        <ProCard
          extra={
            <ProductSelect
              company={company}
              itemContext="sales"
              warehouse={warehouse}
              onSelectProduct={addProduct}
              style={{ minWidth: 320 }}
            />
          }
          title={`商品明细（默认${getSalesModeLabel(defaultSalesMode)}）`}
        >
          <SalesOrderLinesTable
            company={company}
            lines={lines}
            onChange={(nextLines) => {
              setDirty(true);
              setLines(nextLines);
            }}
          />
        </ProCard>
      </Space>
      <FooterToolbar>
        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <Typography.Text type={dirty ? 'danger' : 'secondary'}>
            {dirty ? '有未保存修改' : '当前无待保存修改'}，共 {lines.length}{' '}
            个商品，总金额 {formatCurrencyValue(totalAmount)}
          </Typography.Text>
          <Space>
            <Button
              onClick={() =>
                history.push(`/sales/orders/${encodeURIComponent(orderName)}`)
              }
            >
              取消
            </Button>
            <Button
              icon={<SaveOutlined />}
              loading={submitting}
              onClick={() => void submitOrder()}
              type="primary"
            >
              保存修改
            </Button>
          </Space>
        </Space>
      </FooterToolbar>
    </PageContainer>
  );
};

export default SalesOrderEditPage;
