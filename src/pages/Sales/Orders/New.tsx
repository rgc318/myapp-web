import { PlusOutlined } from '@ant-design/icons';
import {
  FooterToolbar,
  PageContainer,
  ProCard,
} from '@ant-design/pro-components';
import { history, useLocation } from '@umijs/max';
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
  ProductSelect,
  RemoteLinkSelect,
  SalesOrderLinesTable,
} from '@/components';
import type { ProductSelectLine } from '@/components/ProductSelect';
import {
  FALLBACK_COMPANY,
  useWorkspacePreferences,
} from '@/hooks/useWorkspacePreferences';
import type { ProductSummary } from '@/services/myapp/master-data';
import {
  createSalesOrderV2,
  getCustomerSalesContext,
  quickCreateSalesOrderV2,
} from '@/services/myapp/sales';
import { formatCurrencyValue } from '@/utils/myapp-display';
import {
  normalizePhoneInput,
  PHONE_MAX_LENGTH,
  phoneValidationMessage,
  validatePhoneValue,
} from '@/utils/phone-validation';
import {
  buildSalesOrderLineFromProduct,
  getOrderLinesTotal,
  getSalesModeLabel,
  getSalesOrderLineMergeKey,
  recalculateSalesOrderLine,
  type SalesMode,
  type SalesOrderEditorLine,
} from '@/utils/sales-order-editor';

const today = dayjs();
const requiredFieldLabels: Record<string, string> = {
  company: '公司',
  customer: '客户',
  deliveryDate: '交货日期',
  transactionDate: '订单日期',
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

const SalesOrderNewPage: React.FC = () => {
  const location = useLocation();
  const [form] = Form.useForm<FormValues>();
  const [lines, setLines] = useState<SalesOrderEditorLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const customerContextRequestRef = React.useRef(0);
  const appliedAiDraftRef = React.useRef<string | null>(null);
  const { defaultCompany, defaultWarehouse } = useWorkspacePreferences();
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
    const draftId = new URLSearchParams(location.search).get('ai_draft');
    if (!draftId || appliedAiDraftRef.current === draftId) {
      return;
    }
    const stored = sessionStorage.getItem(`myapp:ai-sales-draft:${draftId}`);
    if (!stored) {
      message.warning('AI 草稿交接数据已失效，请返回 AI 工作台重新交接。');
      return;
    }
    try {
      const payload = JSON.parse(stored) as Record<string, any>;
      appliedAiDraftRef.current = draftId;
      form.setFieldsValue({
        company: String(payload.company ?? defaultCompany),
        customer: String(payload.customer ?? ''),
        defaultSalesMode:
          payload.default_sales_mode === 'retail' ? 'retail' : 'wholesale',
        deliveryDate: dayjs(
          String(payload.delivery_date ?? today.format('YYYY-MM-DD')),
        ),
        remarks:
          typeof payload.remarks === 'string' ? payload.remarks : undefined,
        transactionDate: dayjs(
          String(payload.transaction_date ?? today.format('YYYY-MM-DD')),
        ),
        warehouse:
          typeof payload.warehouse === 'string'
            ? payload.warehouse
            : defaultWarehouse,
      });
      setLines(
        (Array.isArray(payload.items) ? payload.items : []).map(
          (row: Record<string, any>, index: number) => {
            const uom = String(row.uom ?? '');
            const price = Number(row.price ?? 0);
            const qty = Number(row.qty ?? 0);
            const warehouseName = String(
              row.warehouse ?? payload.warehouse ?? '',
            );
            return {
              allUomDisplays: uom
                ? { [uom]: String(row.uom_display ?? uom) }
                : {},
              allUoms: uom ? [uom] : [],
              amount: qty * price,
              itemCode: String(row.item_code ?? ''),
              itemName: String(row.item_name ?? row.item_code ?? ''),
              key: `ai:${draftId}:${index}`,
              modeDefaults: {
                retail: { price, uom: uom || null },
                wholesale: { price, uom: uom || null },
              },
              price,
              qty,
              salesMode:
                payload.default_sales_mode === 'retail'
                  ? 'retail'
                  : 'wholesale',
              specification: '',
              stockQty: null,
              stockUom: String(row.stock_uom ?? uom) || null,
              stockUomDisplay:
                String(row.stock_uom_display ?? row.uom_display ?? uom) || null,
              uom: uom || null,
              uomConversions: uom
                ? [
                    {
                      conversionFactor: Number(row.conversion_factor ?? 1),
                      uom,
                    },
                  ]
                : [],
              uomDisplay: String(row.uom_display ?? uom) || null,
              warehouse: warehouseName,
            } satisfies SalesOrderEditorLine;
          },
        ),
      );
      sessionStorage.removeItem(`myapp:ai-sales-draft:${draftId}`);
      message.success('AI 销售订单草稿已载入，请复核后再创建正式订单。');
    } catch {
      message.error('AI 草稿交接数据格式不正确。');
    }
  }, [defaultCompany, defaultWarehouse, form, location.search]);

  const applyCustomerSalesContext = async (nextCustomer: string) => {
    const requestId = customerContextRequestRef.current + 1;
    customerContextRequestRef.current = requestId;
    form.setFieldValue('customer', nextCustomer || undefined);
    if (!nextCustomer) {
      form.setFieldsValue({
        contactDisplayName: undefined,
        contactPhone: undefined,
        shippingAddressText: undefined,
      });
      return;
    }

    const context = await getCustomerSalesContext(nextCustomer);
    if (requestId !== customerContextRequestRef.current) {
      return;
    }
    form.setFieldsValue({
      company: context.suggestions.company ?? form.getFieldValue('company'),
      contactDisplayName: context.defaultContact?.displayName || undefined,
      contactPhone:
        normalizePhoneInput(context.defaultContact?.phone) || undefined,
      shippingAddressText: context.defaultAddress?.addressDisplay || undefined,
      warehouse:
        context.suggestions.warehouse ?? form.getFieldValue('warehouse'),
    });
  };

  const addProduct = (product: ProductSummary) => {
    const nextLine = buildSalesOrderLineFromProduct({
      defaultMode: defaultSalesMode,
      defaultWarehouse: warehouse,
      product,
    });
    setLines((current) => {
      const nextMergeKey = getSalesOrderLineMergeKey(nextLine);
      const lineToAdd = { ...nextLine, key: nextMergeKey };
      const existing = current.find(
        (line) => getSalesOrderLineMergeKey(line) === nextMergeKey,
      );
      if (existing) {
        return current.map((line) =>
          getSalesOrderLineMergeKey(line) === nextMergeKey
            ? recalculateSalesOrderLine({ ...line, qty: line.qty + 1 })
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
        const baseLine = buildSalesOrderLineFromProduct({
          defaultMode: productLine.salesMode ?? defaultSalesMode,
          defaultWarehouse: productLine.warehouse || warehouse,
          product: productLine.product,
        });
        const nextLine = recalculateSalesOrderLine({
          ...baseLine,
          price: productLine.price,
          qty: productLine.qty,
          salesMode: productLine.salesMode ?? defaultSalesMode,
          uom: productLine.uom,
          warehouse: productLine.warehouse,
        });
        const nextMergeKey = getSalesOrderLineMergeKey(nextLine);
        const lineToAdd = { ...nextLine, key: nextMergeKey };
        const existingIndex = nextLines.findIndex(
          (line) => getSalesOrderLineMergeKey(line) === nextMergeKey,
        );
        if (existingIndex >= 0) {
          nextLines[existingIndex] = recalculateSalesOrderLine({
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
        recalculateSalesOrderLine({
          ...line,
          price: line.modeDefaults[nextMode]?.price ?? line.price,
          salesMode: nextMode,
          uom: line.modeDefaults[nextMode]?.uom || line.uom,
        }),
      ),
    );
  };

  const submitOrder = async (quick: boolean) => {
    let values: FormValues | undefined;
    const missingItems = new Set<string>();
    try {
      values = await form.validateFields();
    } catch (error) {
      const errorFields =
        (error as { errorFields?: { name: (string | number)[] }[] })
          .errorFields ?? [];
      errorFields.forEach((field) => {
        const fieldName = String(field.name[0] ?? '');
        missingItems.add(requiredFieldLabels[fieldName] ?? fieldName);
      });
    }
    if (!lines.length) {
      missingItems.add('商品明细');
    }
    if (!values || missingItems.size) {
      message.error(`请先补充：${Array.from(missingItems).join('、')}`);
      return;
    }

    setSubmitting(true);
    try {
      const contactPhone = normalizePhoneInput(values.contactPhone);
      form.setFieldValue('contactPhone', contactPhone || undefined);
      const payload = {
        company: values.company,
        customer: values.customer,
        customerInfo: {
          contactDisplayName: values.contactDisplayName,
          contactPhone,
        },
        defaultSalesMode: values.defaultSalesMode,
        deliveryDate: values.deliveryDate.format('YYYY-MM-DD'),
        items: lines.map((line) => ({
          itemCode: line.itemCode,
          price: line.price,
          qty: line.qty,
          salesMode: line.salesMode,
          uom: line.uom,
          warehouse: line.warehouse || values.warehouse,
        })),
        remarks: values.remarks,
        shippingInfo: {
          receiverName: values.contactDisplayName,
          receiverPhone: contactPhone,
          shippingAddressText: values.shippingAddressText,
        },
        transactionDate: values.transactionDate.format('YYYY-MM-DD'),
      };
      const result = quick
        ? await quickCreateSalesOrderV2(payload)
        : await createSalesOrderV2(payload);
      const orderName = result.data.order;
      if (orderName) {
        history.push(`/sales/orders/${encodeURIComponent(orderName)}`);
      } else {
        history.push('/sales/orders');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer
      title="新建销售订单"
      extra={[
        <Button key="back" onClick={() => history.push('/sales/orders')}>
          返回列表
        </Button>,
      ]}
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          title={
            new URLSearchParams(location.search).has('ai_draft')
              ? '当前内容来自 AI 草稿。请重新核对客户、商品、单位、价格、库存和仓库后再创建正式订单。'
              : '当前已接入销售订单 v2 创建接口；快捷下单会同时创建发货单和销售发票。'
          }
          showIcon
          type="info"
        />
        <ProCard>
          <Form<FormValues>
            form={form}
            initialValues={{
              company: defaultCompany,
              defaultSalesMode: 'wholesale',
              deliveryDate: today,
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
                label="客户"
                name="customer"
                rules={[{ required: true, message: '请选择客户' }]}
              >
                <RemoteLinkSelect
                  doctype="Customer"
                  placeholder="搜索客户"
                  onChange={(nextCustomer) => {
                    void applyCustomerSalesContext(nextCustomer);
                  }}
                />
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
                <Input placeholder="默认联系人" />
              </Form.Item>
              <Form.Item
                label="联系电话"
                name="contactPhone"
                normalize={normalizePhoneInput}
                rules={[
                  {
                    message: phoneValidationMessage(),
                    validator: validatePhoneValue,
                  },
                ]}
              >
                <Input
                  inputMode="numeric"
                  maxLength={PHONE_MAX_LENGTH}
                  placeholder="默认联系电话"
                />
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
              defaultSalesMode={defaultSalesMode}
              itemContext="sales"
              selectedProductKeys={lines.map((line) => line.itemCode)}
              selectedProductLines={lines}
              warehouse={warehouse}
              onSelectLines={addProductLines}
              onSelectProduct={addProduct}
              style={{ minWidth: 320 }}
            />
          }
          title={`商品明细（默认${getSalesModeLabel(defaultSalesMode)}）`}
        >
          <SalesOrderLinesTable
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
              快捷下单
            </Button>
          </Space>
        </div>
      </FooterToolbar>
    </PageContainer>
  );
};

export default SalesOrderNewPage;
