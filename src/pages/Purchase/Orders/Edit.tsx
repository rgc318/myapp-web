import { SaveOutlined } from '@ant-design/icons';
import { PageContainer, ProCard } from '@ant-design/pro-components';
import { history, useParams, useRequest } from '@umijs/max';
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  message,
  Result,
  Skeleton,
  Space,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import {
  ProductSelect,
  PurchaseOrderLinesTable,
  RemoteLinkSelect,
} from '@/components';
import {
  getProductDetail,
  type ProductSummary,
} from '@/services/myapp/master-data';
import {
  getPurchaseOrderDetail,
  type PurchaseDocumentItem,
  type PurchaseOrderDetail,
  updatePurchaseOrderItemsV2,
  updatePurchaseOrderV2,
} from '@/services/myapp/purchase';
import { formatCurrencyValue } from '@/utils/myapp-display';
import {
  buildPurchaseOrderLineFromProduct,
  getPurchaseOrderLinesTotal,
  type PurchaseOrderEditorLine,
  recalculatePurchaseOrderLine,
} from '@/utils/purchase-order-editor';

type FormValues = {
  addressDisplay?: string;
  company: string;
  contactDisplayName?: string;
  contactPhone?: string;
  currency?: string;
  remarks?: string;
  scheduleDate: dayjs.Dayjs;
  supplier: string;
  supplierRef?: string;
  transactionDate: dayjs.Dayjs;
  warehouse?: string;
};

function dateValue(value: string) {
  return value ? dayjs(value) : dayjs();
}

function fallbackLineFromItem(
  item: PurchaseDocumentItem,
): PurchaseOrderEditorLine {
  const uom = item.uom || null;
  const price = item.rate ?? 0;
  return recalculatePurchaseOrderLine({
    allUomDisplays: {},
    allUoms: uom ? [uom] : [],
    amount: item.amount ?? 0,
    itemCode: item.itemCode,
    itemName: item.itemName || item.itemCode,
    key:
      item.purchaseOrderItem ||
      `${item.itemCode}:${item.warehouse || 'default'}`,
    price,
    qty: item.qty ?? 1,
    specification: '',
    stockQty: null,
    stockUom: uom,
    uom,
    uomConversions: [],
    warehouse: item.warehouse,
  });
}

async function buildEditableLines(detail: PurchaseOrderDetail) {
  const products = await Promise.all(
    detail.items.map((item) =>
      getProductDetail(item.itemCode, {
        company: detail.company,
        warehouse: item.warehouse,
      }).catch(() => null),
    ),
  );

  return detail.items.map((item, index) => {
    const product = products[index];
    if (!product) {
      return fallbackLineFromItem(item);
    }

    return recalculatePurchaseOrderLine({
      ...buildPurchaseOrderLineFromProduct({
        defaultWarehouse: item.warehouse,
        product,
      }),
      amount: item.amount ?? 0,
      key:
        item.purchaseOrderItem ||
        `${item.itemCode}:${item.warehouse || 'default'}`,
      price: item.rate,
      qty: item.qty ?? 1,
      uom: item.uom || product.uom || product.stockUom,
      warehouse: item.warehouse || product.warehouse,
    });
  });
}

const PurchaseOrderEditPage: React.FC = () => {
  const params = useParams();
  const orderName = decodeURIComponent(String(params.name ?? ''));
  const [form] = Form.useForm<FormValues>();
  const [lines, setLines] = useState<PurchaseOrderEditorLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const company = Form.useWatch('company', form);
  const warehouse = Form.useWatch('warehouse', form);
  const totalAmount = useMemo(() => getPurchaseOrderLinesTotal(lines), [lines]);

  const { data, error, loading } = useRequest(
    async () => {
      const detail = await getPurchaseOrderDetail(orderName);
      if (!detail) {
        return null;
      }
      const editableLines = await buildEditableLines(detail);
      form.setFieldsValue({
        addressDisplay: detail.supplierAddressDisplay,
        company: detail.company,
        contactDisplayName: detail.supplierContactDisplay,
        contactPhone: detail.supplierContactPhone,
        currency: detail.currency,
        remarks: detail.remarks,
        scheduleDate: dateValue(detail.scheduleDate),
        supplier: detail.supplier,
        supplierRef: detail.supplierRef,
        transactionDate: dateValue(detail.transactionDate),
        warehouse: editableLines.find((line) => line.warehouse)?.warehouse,
      });
      setLines(editableLines);
      return detail;
    },
    { formatResult: (result) => result, refreshDeps: [orderName] },
  );

  const addProduct = (product: ProductSummary) => {
    const nextLine = buildPurchaseOrderLineFromProduct({
      defaultWarehouse: warehouse,
      product,
    });
    setLines((current) => {
      const existing = current.find((line) => line.key === nextLine.key);
      if (existing) {
        return current.map((line) =>
          line.key === nextLine.key
            ? recalculatePurchaseOrderLine({ ...line, qty: line.qty + 1 })
            : line,
        );
      }
      return [...current, nextLine];
    });
  };

  const submitOrder = async () => {
    const values = await form.validateFields();
    if (!lines.length) {
      message.warning('请先选择商品');
      return;
    }

    setSubmitting(true);
    try {
      await updatePurchaseOrderV2(orderName, {
        remarks: values.remarks,
        scheduleDate: values.scheduleDate.format('YYYY-MM-DD'),
        supplierRef: values.supplierRef,
        transactionDate: values.transactionDate.format('YYYY-MM-DD'),
      });
      const result = await updatePurchaseOrderItemsV2(orderName, {
        company: values.company,
        defaultWarehouse: values.warehouse,
        items: lines.map((line) => ({
          itemCode: line.itemCode,
          price: line.price,
          qty: line.qty,
          uom: line.uom,
          warehouse: line.warehouse || values.warehouse,
        })),
        scheduleDate: values.scheduleDate.format('YYYY-MM-DD'),
      });
      history.push(
        `/purchase/orders/${encodeURIComponent(
          result.data.purchase_order || orderName,
        )}`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageContainer title={`编辑采购订单 ${orderName}`}>
        <Skeleton active />
      </PageContainer>
    );
  }

  if (error || !data) {
    return (
      <PageContainer title={`编辑采购订单 ${orderName}`}>
        <Result
          extra={
            <Button onClick={() => history.push('/purchase/orders')}>
              返回列表
            </Button>
          }
          status="warning"
          title="未能加载采购订单"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      extra={[
        <Button
          key="detail"
          onClick={() =>
            history.push(`/purchase/orders/${encodeURIComponent(orderName)}`)
          }
        >
          返回详情
        </Button>,
      ]}
      title={`编辑采购订单 ${orderName}`}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          message="保存会先更新订单日期、交货日期、供应商单号和备注，再替换商品明细；已收货或已开票订单可能被后端拒绝编辑。"
          showIcon
          type="info"
        />
        <ProCard>
          <Form<FormValues> form={form} layout="vertical">
            <div
              style={{
                display: 'grid',
                gap: 16,
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              }}
            >
              <Form.Item label="供应商" name="supplier">
                <RemoteLinkSelect disabled doctype="Supplier" />
              </Form.Item>
              <Form.Item
                label="公司"
                name="company"
                rules={[{ required: true, message: '请选择公司' }]}
              >
                <RemoteLinkSelect disabled doctype="Company" />
              </Form.Item>
              <Form.Item label="默认仓库" name="warehouse">
                <RemoteLinkSelect
                  doctype="Warehouse"
                  extraFields={['company']}
                  filters={{ company }}
                  placeholder="搜索仓库"
                />
              </Form.Item>
              <Form.Item label="币种" name="currency">
                <Input disabled />
              </Form.Item>
              <Form.Item
                label="订单日期"
                name="transactionDate"
                rules={[{ required: true, message: '请选择订单日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                label="交货日期"
                name="scheduleDate"
                rules={[{ required: true, message: '请选择交货日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="供应商单号" name="supplierRef">
                <Input placeholder="供应商参考单号" />
              </Form.Item>
              <Form.Item label="联系人" name="contactDisplayName">
                <Input disabled />
              </Form.Item>
              <Form.Item label="联系电话" name="contactPhone">
                <Input disabled />
              </Form.Item>
            </div>
            <Form.Item label="供应商地址" name="addressDisplay">
              <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} disabled />
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
              itemContext="purchase"
              onSelectProduct={addProduct}
              placeholder="搜索采购商品"
              style={{ minWidth: 320 }}
              warehouse={warehouse}
            />
          }
          title="采购明细"
        >
          <PurchaseOrderLinesTable
            company={company}
            lines={lines}
            onChange={setLines}
          />
        </ProCard>

        <ProCard>
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Typography.Text type="secondary">
              共 {lines.length} 个商品，总金额{' '}
              {formatCurrencyValue(totalAmount)}
            </Typography.Text>
            <Button
              icon={<SaveOutlined />}
              loading={submitting}
              onClick={() => void submitOrder()}
              type="primary"
            >
              保存修改
            </Button>
          </Space>
        </ProCard>
      </Space>
    </PageContainer>
  );
};

export default PurchaseOrderEditPage;
