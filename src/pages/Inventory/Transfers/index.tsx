import { PageContainer, ProCard } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  message,
  Space,
  Statistic,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import { ProductSelect, RemoteLinkSelect, UomSelect } from '@/components';
import { useWorkspacePreferences } from '@/hooks/useWorkspacePreferences';
import { transferInventoryStock } from '@/services/myapp/inventory';
import type { ProductSummary } from '@/services/myapp/master-data';
import { resolveDisplayUom } from '@/utils/myapp-display';

type FormValues = {
  company?: string;
  itemCode?: string;
  itemName?: string;
  postingDate: dayjs.Dayjs;
  qty: number;
  remarks?: string;
  sourceWarehouse?: string;
  targetWarehouse?: string;
  uom?: string;
};

function formatQty(value: number | null | undefined) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

const InventoryTransferPage: React.FC = () => {
  const [form] = Form.useForm<FormValues>();
  const { defaultCompany, defaultWarehouse } = useWorkspacePreferences();
  const [selectedProduct, setSelectedProduct] = useState<ProductSummary | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const company = Form.useWatch('company', form) || defaultCompany;
  const sourceWarehouse =
    Form.useWatch('sourceWarehouse', form) || defaultWarehouse;

  React.useEffect(() => {
    form.setFieldsValue({
      company: form.getFieldValue('company') || defaultCompany,
      postingDate: form.getFieldValue('postingDate') || dayjs(),
      sourceWarehouse:
        form.getFieldValue('sourceWarehouse') || defaultWarehouse,
    });
  }, [defaultCompany, defaultWarehouse, form]);

  const handleProductSelect = (product: ProductSummary) => {
    setSelectedProduct(product);
    form.setFieldsValue({
      itemCode: product.itemCode,
      itemName: product.itemName,
      qty: undefined,
      uom: product.stockUom,
    });
  };

  const handleSubmit = async (values: FormValues) => {
    if (!values.itemCode) {
      message.error('请选择商品');
      return;
    }
    if (!values.sourceWarehouse || !values.targetWarehouse) {
      message.error('请选择转出仓库和转入仓库');
      return;
    }
    if (values.sourceWarehouse === values.targetWarehouse) {
      message.error('转出仓库和转入仓库不能相同');
      return;
    }

    setSubmitting(true);
    try {
      await transferInventoryStock({
        itemCode: values.itemCode,
        postingDate: values.postingDate?.format('YYYY-MM-DD'),
        qty: values.qty,
        remarks: values.remarks,
        sourceWarehouse: values.sourceWarehouse,
        targetWarehouse: values.targetWarehouse,
        uom: values.uom,
      });
      history.push(
        `/inventory/ledger?itemCode=${encodeURIComponent(values.itemCode)}&warehouse=${encodeURIComponent(values.sourceWarehouse)}`,
      );
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '库存转仓失败');
    } finally {
      setSubmitting(false);
    }
  };

  const stockUomDisplay = selectedProduct
    ? resolveDisplayUom(
        selectedProduct.stockUom,
        selectedProduct.stockUomDisplay,
      )
    : '';

  return (
    <PageContainer
      title="库存转仓"
      extra={[
        <Button key="stock" onClick={() => history.push('/inventory/stock')}>
          商品库存
        </Button>,
        <Button
          key="adjustments"
          onClick={() => history.push('/inventory/adjustments')}
        >
          库存调整
        </Button>,
        <Button key="counts" onClick={() => history.push('/inventory/counts')}>
          批量盘点
        </Button>,
        <Button key="ledger" onClick={() => history.push('/inventory/ledger')}>
          库存流水
        </Button>,
      ]}
    >
      <ProCard>
        <Alert
          showIcon
          style={{ marginBottom: 16 }}
          type="info"
          message="库存转仓会生成正式库存转移单据，数量按商品单位配置统一换算为库存基准单位。"
        />
        <Form<FormValues> form={form} layout="vertical" onFinish={handleSubmit}>
          <Space size={16} style={{ width: '100%' }} wrap>
            <Form.Item
              label="公司"
              name="company"
              rules={[{ required: true, message: '请选择公司' }]}
              style={{ minWidth: 260 }}
            >
              <RemoteLinkSelect doctype="Company" placeholder="公司" />
            </Form.Item>
            <Form.Item
              label="转出仓库"
              name="sourceWarehouse"
              rules={[{ required: true, message: '请选择转出仓库' }]}
              style={{ minWidth: 280 }}
            >
              <RemoteLinkSelect
                doctype="Warehouse"
                extraFields={['company']}
                filters={{ company, disabled: 0, is_group: 0 }}
                placeholder="转出仓库"
              />
            </Form.Item>
            <Form.Item
              label="转入仓库"
              name="targetWarehouse"
              rules={[{ required: true, message: '请选择转入仓库' }]}
              style={{ minWidth: 280 }}
            >
              <RemoteLinkSelect
                doctype="Warehouse"
                extraFields={['company']}
                filters={{ company, disabled: 0, is_group: 0 }}
                placeholder="转入仓库"
              />
            </Form.Item>
            <Form.Item
              label="过账日期"
              name="postingDate"
              rules={[{ required: true, message: '请选择过账日期' }]}
              style={{ minWidth: 180 }}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item label="商品" required>
            <ProductSelect
              company={company}
              itemContext="inventory"
              warehouse={sourceWarehouse}
              onSelectProduct={handleProductSelect}
            />
          </Form.Item>
          <Form.Item name="itemCode" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="itemName" hidden>
            <Input />
          </Form.Item>
          {selectedProduct && (
            <Space size={32} style={{ marginBottom: 16 }} wrap>
              <Statistic
                title="转出仓当前库存"
                value={`${formatQty(selectedProduct.warehouseStockQty ?? selectedProduct.stockQty)} ${stockUomDisplay}`}
              />
              <Statistic
                title="公司总库存"
                value={`${formatQty(selectedProduct.totalQty)} ${stockUomDisplay}`}
              />
              <Typography.Text type="secondary">
                {selectedProduct.itemName} ({selectedProduct.itemCode})
              </Typography.Text>
            </Space>
          )}
          <Space size={16} style={{ width: '100%' }} wrap>
            <Form.Item
              label="转仓数量"
              name="qty"
              rules={[{ required: true, message: '请输入转仓数量' }]}
              style={{ minWidth: 180 }}
            >
              <InputNumber
                min={0.000001}
                precision={2}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item
              label="单位"
              name="uom"
              rules={[{ required: true, message: '请选择单位' }]}
              style={{ minWidth: 180 }}
            >
              <UomSelect />
            </Form.Item>
            <Form.Item label="备注" name="remarks" style={{ minWidth: 360 }}>
              <Input placeholder="转仓原因或操作说明" />
            </Form.Item>
          </Space>
          <Space>
            <Button loading={submitting} type="primary" htmlType="submit">
              提交转仓
            </Button>
            <Button onClick={() => form.resetFields()}>重置</Button>
          </Space>
        </Form>
      </ProCard>
    </PageContainer>
  );
};

export default InventoryTransferPage;
