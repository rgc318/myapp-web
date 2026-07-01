import { PlusOutlined } from '@ant-design/icons';
import { PageContainer, ProCard } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  message,
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
  getPurchaseOrderLinesTotal,
  type PurchaseOrderEditorLine,
  recalculatePurchaseOrderLine,
} from '@/utils/purchase-order-editor';

const today = dayjs();

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

const PurchaseOrderNewPage: React.FC = () => {
  const [form] = Form.useForm<FormValues>();
  const [lines, setLines] = useState<PurchaseOrderEditorLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [lastSupplier, setLastSupplier] = useState('');
  const { defaultCompany, defaultWarehouse } = useWorkspacePreferences();
  const supplier = Form.useWatch('supplier', form);
  const company = Form.useWatch('company', form);
  const warehouse = Form.useWatch('warehouse', form);
  const totalAmount = useMemo(() => getPurchaseOrderLinesTotal(lines), [lines]);

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
                  filters={{ company }}
                  placeholder="搜索仓库"
                  value={warehouse}
                  onChange={(nextWarehouse) => {
                    form.setFieldsValue({ warehouse: nextWarehouse });
                  }}
                />
              </Form.Item>
              <Form.Item label="币种" name="currency">
                <Input placeholder="自动带出供应商默认币种" />
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
            <Space>
              <Button
                icon={<PlusOutlined />}
                loading={submitting}
                onClick={() => void submitOrder(false)}
                type="primary"
              >
                保存订单
              </Button>
              <Button
                loading={submitting}
                onClick={() => void submitOrder(true)}
              >
                快捷采购
              </Button>
            </Space>
          </Space>
        </ProCard>
      </Space>
    </PageContainer>
  );
};

export default PurchaseOrderNewPage;
