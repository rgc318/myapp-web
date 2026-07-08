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
  DatePicker,
  Form,
  Input,
  message,
  Result,
  Select,
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
import type { ProductSelectLine } from '@/components/ProductSelect';
import {
  getProductDetail,
  type ProductSummary,
} from '@/services/myapp/master-data';
import {
  getPurchaseOrderDetail,
  type PurchaseDocumentItem,
  type PurchaseOrderDetail,
  purchaseOrderEditDisabledReason,
  updatePurchaseOrderItemsV2,
  updatePurchaseOrderV2,
} from '@/services/myapp/purchase';
import { formatCurrencyValue } from '@/utils/myapp-display';
import {
  buildPurchaseOrderLineFromProduct,
  getPurchaseOrderLineMergeKey,
  getPurchaseOrderLinesTotal,
  type PurchaseOrderEditorLine,
  recalculatePurchaseOrderLine,
} from '@/utils/purchase-order-editor';
import type { SalesMode } from '@/utils/sales-order-editor';

type FormValues = {
  addressDisplay?: string;
  company: string;
  contactDisplayName?: string;
  contactPhone?: string;
  currency?: string;
  defaultPurchaseMode: SalesMode;
  remarks?: string;
  scheduleDate: dayjs.Dayjs;
  supplier: string;
  supplierRef?: string;
  transactionDate: dayjs.Dayjs;
  warehouse?: string;
};
const footerContentStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  gap: 16,
  justifyContent: 'space-between',
  margin: '0 auto',
  maxWidth: 1488,
  padding: '0 24px',
  width: '100%',
};
const footerSummaryStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flex: '1 1 auto',
  flexWrap: 'wrap',
  gap: '8px 24px',
  minWidth: 0,
};
const footerActionsStyle: React.CSSProperties = {
  flex: '0 0 auto',
};

function dateValue(value: string) {
  return value ? dayjs(value) : dayjs();
}

function fallbackLineFromItem(
  item: PurchaseDocumentItem,
): PurchaseOrderEditorLine {
  const uom = item.uom || null;
  const price = item.rate ?? 0;
  const allUomDisplays =
    uom && item.uomDisplay ? { [uom]: item.uomDisplay } : {};
  return recalculatePurchaseOrderLine({
    allUomDisplays,
    allUoms: uom ? [uom] : [],
    amount: item.amount ?? 0,
    imageUrl: item.imageUrl,
    itemCode: item.itemCode,
    itemName: item.itemName || item.itemCode,
    key:
      item.purchaseOrderItem ||
      `${item.itemCode}:${item.warehouse || 'default'}`,
    modeDefaults: {
      retail: { uom },
      wholesale: { uom },
    },
    price,
    qty: item.qty ?? 1,
    standardBuyingRate: null,
    specification: '',
    stockQty: null,
    stockUom: uom,
    stockUomDisplay: item.uomDisplay,
    totalQty: null,
    uom,
    uomConversions: uom ? [{ conversionFactor: 1, uom }] : [],
    uomDisplay: item.uomDisplay,
    warehouse: item.warehouse,
    warehouseStockDetails: [],
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
      imageUrl: product.imageUrl || item.imageUrl,
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
  const defaultPurchaseMode =
    Form.useWatch('defaultPurchaseMode', form) ?? 'wholesale';
  const warehouse = Form.useWatch('warehouse', form);
  const totalAmount = useMemo(() => getPurchaseOrderLinesTotal(lines), [lines]);
  const totalQty = useMemo(
    () =>
      lines.reduce(
        (sum, line) => sum + (Number.isFinite(line.qty) ? line.qty : 0),
        0,
      ),
    [lines],
  );

  const { data, error, loading } = useRequest(
    async () => {
      const detail = await getPurchaseOrderDetail(orderName);
      if (!detail) {
        return null;
      }
      if (purchaseOrderEditDisabledReason(detail)) {
        return detail;
      }
      const editableLines = await buildEditableLines(detail);
      form.setFieldsValue({
        addressDisplay: detail.supplierAddressDisplay,
        company: detail.company,
        contactDisplayName: detail.supplierContactDisplay,
        contactPhone: detail.supplierContactPhone,
        currency: detail.currency,
        defaultPurchaseMode: 'wholesale',
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
      defaultMode: defaultPurchaseMode,
      defaultWarehouse: warehouse,
      product,
    });
    setLines((current) => {
      const nextMergeKey = getPurchaseOrderLineMergeKey(nextLine);
      const lineToAdd = { ...nextLine, key: nextMergeKey };
      const existing = current.find(
        (line) => getPurchaseOrderLineMergeKey(line) === nextMergeKey,
      );
      if (existing) {
        return current.map((line) =>
          getPurchaseOrderLineMergeKey(line) === nextMergeKey
            ? recalculatePurchaseOrderLine({ ...line, qty: line.qty + 1 })
            : line,
        );
      }
      return [...current, lineToAdd];
    });
  };

  const addProductLines = (productLines: ProductSelectLine[]) => {
    setLines((current) => {
      const nextLines = [...current];
      productLines.forEach((productLine) => {
        const baseLine = buildPurchaseOrderLineFromProduct({
          defaultMode: productLine.salesMode ?? defaultPurchaseMode,
          defaultWarehouse: productLine.warehouse || warehouse,
          product: productLine.product,
        });
        const nextLine = recalculatePurchaseOrderLine({
          ...baseLine,
          price: productLine.price,
          qty: productLine.qty,
          uom: productLine.uom,
          warehouse: productLine.warehouse,
        });
        const nextMergeKey = getPurchaseOrderLineMergeKey(nextLine);
        const lineToAdd = { ...nextLine, key: nextMergeKey };
        const existingIndex = nextLines.findIndex(
          (line) => getPurchaseOrderLineMergeKey(line) === nextMergeKey,
        );
        if (existingIndex >= 0) {
          nextLines[existingIndex] = recalculatePurchaseOrderLine({
            ...nextLines[existingIndex],
            qty: nextLines[existingIndex].qty + productLine.qty,
          });
        } else {
          nextLines.push(lineToAdd);
        }
      });
      return nextLines;
    });
  };

  const applyDefaultModeToLines = (nextMode: SalesMode) => {
    setLines((current) =>
      current.map((line) =>
        recalculatePurchaseOrderLine({
          ...line,
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

  const editDisabledReason = purchaseOrderEditDisabledReason(data);
  if (editDisabledReason) {
    return (
      <PageContainer title={`编辑采购订单 ${orderName}`}>
        <Result
          extra={
            <Space>
              <Button
                onClick={() =>
                  history.push(
                    `/purchase/orders/${encodeURIComponent(orderName)}`,
                  )
                }
              >
                返回订单详情
              </Button>
              <Button onClick={() => history.push('/purchase/orders')}>
                返回列表
              </Button>
            </Space>
          }
          status="warning"
          subTitle={editDisabledReason}
          title="当前采购订单不能直接编辑"
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
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          message="保存会先更新订单日期、交货日期、供应商单号和备注，再替换商品明细；只有未进入收货、开票或付款链路的订单允许直接编辑。"
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
                  filters={{ company, disabled: 0, is_group: 0 }}
                  placeholder="搜索仓库"
                />
              </Form.Item>
              <Form.Item label="币种" name="currency">
                <Input disabled />
              </Form.Item>
              <Form.Item label="默认取值模式" name="defaultPurchaseMode">
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
              defaultSalesMode={defaultPurchaseMode}
              itemContext="purchase"
              selectedProductKeys={lines.map((line) => line.itemCode)}
              selectedProductLines={lines}
              onSelectLines={addProductLines}
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
      </Space>
      <FooterToolbar>
        <div style={footerContentStyle}>
          <div style={footerSummaryStyle}>
            <Space size={8}>
              <Typography.Text type="secondary">行数</Typography.Text>
              <Typography.Text
                strong
                style={{ color: '#1677ff', fontSize: 18 }}
              >
                {lines.length}
              </Typography.Text>
            </Space>
            <Space size={8}>
              <Typography.Text type="secondary">数量</Typography.Text>
              <Typography.Text
                strong
                style={{ color: '#1677ff', fontSize: 18 }}
              >
                {totalQty}
              </Typography.Text>
            </Space>
            <Space size={8}>
              <Typography.Text type="secondary">总金额</Typography.Text>
              <Typography.Text
                strong
                style={{ color: '#f5222d', fontSize: 20 }}
              >
                {formatCurrencyValue(totalAmount)}
              </Typography.Text>
            </Space>
          </div>
          <Space style={footerActionsStyle}>
            <Button
              onClick={() =>
                history.push(
                  `/purchase/orders/${encodeURIComponent(orderName)}`,
                )
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
        </div>
      </FooterToolbar>
    </PageContainer>
  );
};

export default PurchaseOrderEditPage;
