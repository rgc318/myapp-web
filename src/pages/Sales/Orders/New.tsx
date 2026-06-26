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
  buildSalesOrderLineFromProduct,
  getOrderLinesTotal,
  getSalesModeLabel,
  recalculateSalesOrderLine,
  type SalesMode,
  type SalesOrderEditorLine,
} from '@/utils/sales-order-editor';

const today = dayjs();

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
  const [form] = Form.useForm<FormValues>();
  const [lines, setLines] = useState<SalesOrderEditorLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [lastCustomer, setLastCustomer] = useState('');
  const { defaultCompany, defaultWarehouse } = useWorkspacePreferences();
  const defaultSalesMode =
    Form.useWatch('defaultSalesMode', form) ?? 'wholesale';
  const customer = Form.useWatch('customer', form);
  const company = Form.useWatch('company', form);
  const warehouse = Form.useWatch('warehouse', form);
  const totalAmount = useMemo(() => getOrderLinesTotal(lines), [lines]);

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
    if (!customer || customer === lastCustomer) {
      return;
    }
    setLastCustomer(customer);
    void getCustomerSalesContext(customer).then((context) => {
      form.setFieldsValue({
        company: context.suggestions.company ?? form.getFieldValue('company'),
        contactDisplayName: context.defaultContact?.displayName ?? undefined,
        contactPhone: context.defaultContact?.phone ?? undefined,
        shippingAddressText:
          context.defaultAddress?.addressDisplay ?? undefined,
        warehouse:
          context.suggestions.warehouse ?? form.getFieldValue('warehouse'),
      });
    });
  }, [customer, form, lastCustomer]);

  const addProduct = (product: ProductSummary) => {
    const nextLine = buildSalesOrderLineFromProduct({
      defaultMode: defaultSalesMode,
      defaultWarehouse: warehouse,
      product,
    });
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
    const values = await form.validateFields();
    if (!lines.length) {
      message.warning('请先选择商品');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        company: values.company,
        customer: values.customer,
        customerInfo: {
          contactDisplayName: values.contactDisplayName,
          contactPhone: values.contactPhone,
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
          receiverPhone: values.contactPhone,
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
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          message="当前已接入销售订单 v2 创建接口；快捷下单会同时创建发货单和销售发票。"
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
                <RemoteLinkSelect doctype="Customer" placeholder="搜索客户" />
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
              <Form.Item label="联系电话" name="contactPhone">
                <Input placeholder="默认联系电话" />
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
                快捷下单
              </Button>
            </Space>
          </Space>
        </ProCard>
      </Space>
    </PageContainer>
  );
};

export default SalesOrderNewPage;
