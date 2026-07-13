import { PageContainer, ProCard } from '@ant-design/pro-components';
import { history, useLocation } from '@umijs/max';
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
import { adjustInventoryStock } from '@/services/myapp/inventory';
import {
  getProductDetail,
  type ProductSummary,
} from '@/services/myapp/master-data';
import { resolveDisplayUom } from '@/utils/myapp-display';

type FormValues = {
  company?: string;
  itemCode?: string;
  itemName?: string;
  postingDate: dayjs.Dayjs;
  remarks?: string;
  targetQty: number;
  uom?: string;
  valuationRate?: number;
  warehouse?: string;
};

function formatQty(value: number | null | undefined) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

const InventoryAdjustmentPage: React.FC = () => {
  const [form] = Form.useForm<FormValues>();
  const location = useLocation();
  const appliedAiDraftRef = React.useRef<string | null>(null);
  const { defaultCompany, defaultWarehouse } = useWorkspacePreferences();
  const [selectedProduct, setSelectedProduct] = useState<ProductSummary | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const company = Form.useWatch('company', form) || defaultCompany;
  const warehouse = Form.useWatch('warehouse', form) || defaultWarehouse;

  React.useEffect(() => {
    form.setFieldsValue({
      company: form.getFieldValue('company') || defaultCompany,
      postingDate: form.getFieldValue('postingDate') || dayjs(),
      warehouse: form.getFieldValue('warehouse') || defaultWarehouse,
    });
  }, [defaultCompany, defaultWarehouse, form]);

  React.useEffect(() => {
    const draftId = new URLSearchParams(location.search).get('ai_draft');
    if (!draftId || appliedAiDraftRef.current === draftId) return;
    const storageKey = `myapp:ai-inventory-adjustment-draft:${draftId}`;
    const stored = sessionStorage.getItem(storageKey);
    if (!stored) {
      message.warning(
        'AI 库存调整草稿交接数据已失效，请返回 AI 工作台重新交接。',
      );
      return;
    }
    try {
      const payload = JSON.parse(stored) as Record<string, unknown>;
      const itemCode = String(payload.item_code ?? '');
      const companyValue = String(payload.company ?? defaultCompany ?? '');
      const warehouseValue = String(
        payload.warehouse ?? defaultWarehouse ?? '',
      );
      appliedAiDraftRef.current = draftId;
      form.setFieldsValue({
        company: companyValue,
        itemCode,
        itemName: String(payload.item_name ?? itemCode),
        postingDate: dayjs(
          String(payload.posting_date ?? dayjs().format('YYYY-MM-DD')),
        ),
        remarks: String(payload.remarks ?? payload.reason ?? '') || undefined,
        targetQty: Number(payload.target_qty ?? 0),
        uom: String(payload.uom ?? '') || undefined,
        valuationRate:
          payload.valuation_rate === null ||
          payload.valuation_rate === undefined
            ? undefined
            : Number(payload.valuation_rate),
        warehouse: warehouseValue,
      });
      sessionStorage.removeItem(storageKey);
      if (itemCode) {
        void getProductDetail(itemCode, {
          company: companyValue,
          warehouse: warehouseValue,
        })
          .then((product) => setSelectedProduct(product))
          .catch(() => {
            message.warning('商品实时详情加载失败，请重新选择商品后再提交。');
          });
      }
      message.success(
        'AI 库存调整草稿已载入，请复核实时库存后再提交正式调整。',
      );
    } catch {
      message.error('AI 库存调整草稿交接数据格式不正确。');
    }
  }, [defaultCompany, defaultWarehouse, form, location.search]);

  const handleProductSelect = (product: ProductSummary) => {
    setSelectedProduct(product);
    form.setFieldsValue({
      itemCode: product.itemCode,
      itemName: product.itemName,
      targetQty:
        product.warehouseStockQty ?? product.stockQty ?? product.totalQty ?? 0,
      uom: product.stockUom,
      valuationRate:
        product.priceSummary?.valuationRate ??
        product.priceSummary?.standardBuyingRate ??
        undefined,
    });
  };

  const handleSubmit = async (values: FormValues) => {
    if (!values.itemCode) {
      message.error('请选择商品');
      return;
    }
    if (!values.warehouse) {
      message.error('请选择仓库');
      return;
    }

    setSubmitting(true);
    try {
      await adjustInventoryStock({
        company: values.company,
        itemCode: values.itemCode,
        postingDate: values.postingDate?.format('YYYY-MM-DD'),
        remarks: values.remarks,
        targetQty: values.targetQty,
        uom: values.uom,
        valuationRate: values.valuationRate,
        warehouse: values.warehouse,
      });
      history.push(
        `/inventory/ledger?itemCode=${encodeURIComponent(values.itemCode)}&warehouse=${encodeURIComponent(values.warehouse)}`,
      );
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '库存调整失败');
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
      title="库存调整"
      extra={[
        <Button key="stock" onClick={() => history.push('/inventory/stock')}>
          商品库存
        </Button>,
        <Button
          key="transfers"
          onClick={() => history.push('/inventory/transfers')}
        >
          库存转仓
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
          message={
            new URLSearchParams(location.search).has('ai_draft')
              ? '当前内容来自 AI 库存调整草稿。请重新核对商品、仓库、实时库存、目标数量、单位、估值价和调整原因。'
              : '库存调整会生成正式库存单据，将所选仓库库存调整到目标数量。'
          }
        />
        <Form<FormValues> form={form} layout="vertical" onFinish={handleSubmit}>
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item
              label="公司"
              name="company"
              rules={[{ required: true, message: '请选择公司' }]}
              style={{ minWidth: 260 }}
            >
              <RemoteLinkSelect doctype="Company" placeholder="公司" />
            </Form.Item>
            <Form.Item
              label="仓库"
              name="warehouse"
              rules={[{ required: true, message: '请选择仓库' }]}
              style={{ minWidth: 280 }}
            >
              <RemoteLinkSelect
                doctype="Warehouse"
                extraFields={['company']}
                filters={{ company, disabled: 0, is_group: 0 }}
                placeholder="仓库"
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
              warehouse={warehouse}
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
            <Space size={32} style={{ marginBottom: 16 }}>
              <Statistic
                title="当前仓库库存"
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
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item
              label="目标库存"
              name="targetQty"
              rules={[{ required: true, message: '请输入目标库存' }]}
              style={{ minWidth: 180 }}
            >
              <InputNumber precision={2} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="单位"
              name="uom"
              rules={[{ required: true, message: '请选择单位' }]}
              style={{ minWidth: 180 }}
            >
              <UomSelect />
            </Form.Item>
            <Form.Item
              label="估值价"
              name="valuationRate"
              style={{ minWidth: 180 }}
            >
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="备注" name="remarks" style={{ minWidth: 360 }}>
              <Input placeholder="盘点原因或操作说明" />
            </Form.Item>
          </Space>
          <Space>
            <Button loading={submitting} type="primary" htmlType="submit">
              提交调整
            </Button>
            <Button
              onClick={() => {
                form.resetFields();
                setSelectedProduct(null);
              }}
            >
              重置
            </Button>
          </Space>
        </Form>
      </ProCard>
    </PageContainer>
  );
};

export default InventoryAdjustmentPage;
