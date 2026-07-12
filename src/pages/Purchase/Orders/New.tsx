import { PlusOutlined } from '@ant-design/icons';
import {
  FooterToolbar,
  PageContainer,
  ProCard,
} from '@ant-design/pro-components';
import { history } from '@umijs/max';
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  message,
  Select,
  Space,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import {
  CurrencySelect,
  ProductSelect,
  PurchaseOrderLinesTable,
  RemoteLinkSelect,
} from '@/components';
import type { ProductSelectLine } from '@/components/ProductSelect';
import {
  FALLBACK_COMPANY,
  useWorkspacePreferences,
} from '@/hooks/useWorkspacePreferences';
import type { ProductSummary } from '@/services/myapp/master-data';
import {
  createPurchaseOrderV2,
  getSupplierPurchaseContext,
  quickCreatePurchaseOrderV2,
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

const today = dayjs();
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

const PurchaseOrderNewPage: React.FC = () => {
  const [form] = Form.useForm<FormValues>();
  const [lines, setLines] = useState<PurchaseOrderEditorLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [lastSupplier, setLastSupplier] = useState('');
  const { defaultCompany, defaultWarehouse } = useWorkspacePreferences();
  const defaultPurchaseMode =
    Form.useWatch('defaultPurchaseMode', form) ?? 'wholesale';
  const supplier = Form.useWatch('supplier', form);
  const company = Form.useWatch('company', form);
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

  React.useEffect(() => {
    const currentCompany = form.getFieldValue('company');
    const currentWarehouse = form.getFieldValue('warehouse');
    form.setFieldsValue({
      company:
        !currentCompany || currentCompany === FALLBACK_COMPANY
          ? defaultCompany
          : currentCompany,
      warehouse: currentWarehouse || defaultWarehouse,
    });
  }, [defaultCompany, defaultWarehouse, form]);

  React.useEffect(() => {
    if (!supplier || supplier === lastSupplier) {
      return;
    }
    setLastSupplier(supplier);
    void getSupplierPurchaseContext(supplier, company).then((context) => {
      if (!context) {
        return;
      }
      form.setFieldsValue({
        addressDisplay: context.defaultAddress?.addressDisplay ?? undefined,
        company: context.suggestions.company ?? form.getFieldValue('company'),
        contactDisplayName: context.defaultContact?.displayName ?? undefined,
        contactPhone: context.defaultContact?.phone ?? undefined,
        currency:
          context.suggestions.currency ??
          context.supplier.defaultCurrency ??
          form.getFieldValue('currency'),
        warehouse:
          context.suggestions.warehouse ?? form.getFieldValue('warehouse'),
      });
    });
  }, [company, form, lastSupplier, supplier]);

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

  const submitOrder = async (quick: boolean) => {
    const values = await form.validateFields();
    if (!lines.length) {
      message.warning('请先选择商品');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        company: values.company,
        currency: values.currency,
        defaultWarehouse: values.warehouse,
        items: lines.map((line) => ({
          itemCode: line.itemCode,
          price: line.price,
          qty: line.qty,
          uom: line.uom,
          warehouse: line.warehouse || values.warehouse,
        })),
        remarks: values.remarks,
        scheduleDate: values.scheduleDate.format('YYYY-MM-DD'),
        supplier: values.supplier,
        supplierRef: values.supplierRef,
        transactionDate: values.transactionDate.format('YYYY-MM-DD'),
      };
      const result = quick
        ? await quickCreatePurchaseOrderV2({
            ...payload,
            immediateInvoice: true,
            immediatePayment: false,
            immediateReceive: true,
          })
        : await createPurchaseOrderV2(payload);
      const orderName = result.data.purchase_order;
      if (orderName) {
        history.push(`/purchase/orders/${encodeURIComponent(orderName)}`);
      } else {
        history.push('/purchase/orders');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer
      extra={[
        <Button key="back" onClick={() => history.push('/purchase/orders')}>
          返回列表
        </Button>,
      ]}
      title="新建采购订单"
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          message="当前已接入采购订单创建接口；快捷采购会同时创建采购收货和采购发票。"
          showIcon
          type="info"
        />
        <ProCard>
          <Form<FormValues>
            form={form}
            initialValues={{
              company: defaultCompany,
              defaultPurchaseMode: 'wholesale',
              scheduleDate: today,
              transactionDate: today,
            }}
            layout="vertical"
          >
            <div
              style={{
                display: 'grid',
                gap: 16,
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              }}
            >
              <Form.Item
                label="供应商"
                name="supplier"
                rules={[{ required: true, message: '请选择供应商' }]}
              >
                <RemoteLinkSelect doctype="Supplier" placeholder="搜索供应商" />
              </Form.Item>
              <Form.Item
                label="公司"
                name="company"
                rules={[{ required: true, message: '请选择公司' }]}
              >
                <RemoteLinkSelect
                  doctype="Company"
                  placeholder="搜索公司"
                  value={company}
                  onChange={(nextCompany) => {
                    form.setFieldsValue({ company: nextCompany });
                  }}
                />
              </Form.Item>
              <Form.Item label="默认仓库" name="warehouse">
                <RemoteLinkSelect
                  doctype="Warehouse"
                  extraFields={['company']}
                  filters={{ company, disabled: 0, is_group: 0 }}
                  placeholder="搜索仓库"
                  value={warehouse}
                  onChange={(nextWarehouse) => {
                    form.setFieldsValue({ warehouse: nextWarehouse });
                  }}
                />
              </Form.Item>
              <Form.Item label="币种" name="currency">
                <CurrencySelect placeholder="自动带出供应商默认币种" />
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
                <Input placeholder="默认联系人" />
              </Form.Item>
              <Form.Item label="联系电话" name="contactPhone">
                <Input placeholder="默认联系电话" />
              </Form.Item>
            </div>
            <Form.Item label="供应商地址" name="addressDisplay">
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
              icon={<PlusOutlined />}
              loading={submitting}
              onClick={() => void submitOrder(false)}
              type="primary"
            >
              保存订单
            </Button>
            <Button loading={submitting} onClick={() => void submitOrder(true)}>
              快捷采购
            </Button>
          </Space>
        </div>
      </FooterToolbar>
    </PageContainer>
  );
};

export default PurchaseOrderNewPage;
