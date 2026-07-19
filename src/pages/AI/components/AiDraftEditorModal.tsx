import { ProCard } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import { RemoteLinkSelect } from '@/components';
import { CurrencySelect } from '@/components/CurrencySelect';
import { UomSelect } from '@/components/UomSelect';
import { type AiDraft, updateAiDraft } from '@/services/myapp/ai';

type FormValues = Record<string, any>;

function initialValues(draft: AiDraft): FormValues {
  const payload = draft.payload as Record<string, any>;
  if (draft.draftType === 'product_setup') {
    return {
      brand: payload.brand ?? payload.brand_query,
      company: payload.company ?? draft.company,
      currency: payload.currency ?? 'CNY',
      description: payload.description,
      itemCode: payload.item_code,
      itemGroup: payload.item_group ?? payload.item_group_query,
      itemName: payload.item_name,
      openingQty: payload.opening_qty,
      standardBuyingRate:
        payload.standard_buying_rate ?? payload.valuation_rate,
      standardSellingRate: payload.standard_selling_rate,
      stockUom: payload.stock_uom,
      warehouse: payload.warehouse ?? payload.warehouse_query,
    };
  }
  if (draft.draftType === 'inventory_adjustment') {
    const item = Array.isArray(payload.items) ? (payload.items[0] ?? {}) : {};
    return {
      adjustmentType: payload.adjustment_type ?? 'set_target',
      company: payload.company ?? draft.company,
      itemCode: item.item_code ?? item.item_query,
      postingDate: payload.posting_date
        ? dayjs(payload.posting_date)
        : undefined,
      quantity: item.qty,
      reason: payload.reason ?? payload.remarks,
      uom: item.uom,
      warehouse: payload.warehouse,
    };
  }
  return {
    company: payload.company ?? draft.company,
    defaultMode:
      (draft.draftType === 'purchase_order'
        ? payload.default_purchase_mode
        : payload.default_sales_mode) ?? 'wholesale',
    items: Array.isArray(payload.items)
      ? payload.items.map((row: Record<string, unknown>) => ({
          itemCode: row.item_code ?? row.item_query,
          price: row.price,
          qty: row.qty,
          uom: row.uom,
          warehouse: row.warehouse,
        }))
      : [],
    party:
      draft.draftType === 'purchase_order'
        ? (payload.supplier ?? payload.supplier_query)
        : (payload.customer ?? payload.customer_query),
    remarks: payload.remarks,
    targetDate: (
      draft.draftType === 'purchase_order'
        ? payload.schedule_date
        : payload.delivery_date
    )
      ? dayjs(
          draft.draftType === 'purchase_order'
            ? payload.schedule_date
            : payload.delivery_date,
        )
      : undefined,
    transactionDate: payload.transaction_date
      ? dayjs(payload.transaction_date)
      : undefined,
    warehouse: payload.warehouse,
  };
}

function buildPayload(draft: AiDraft, values: FormValues) {
  if (draft.draftType === 'product_setup') {
    return {
      brand: values.brand,
      company: values.company,
      currency: values.currency,
      description: values.description,
      item_code: values.itemCode,
      item_group: values.itemGroup,
      item_name: values.itemName,
      opening_qty: values.openingQty,
      opening_uom: values.stockUom,
      standard_buying_rate: values.standardBuyingRate,
      standard_selling_rate: values.standardSellingRate,
      stock_uom: values.stockUom,
      warehouse: values.warehouse,
    };
  }
  if (draft.draftType === 'inventory_adjustment') {
    return {
      adjustment_type: values.adjustmentType,
      company: values.company,
      item_code: values.itemCode,
      posting_date: values.postingDate?.format('YYYY-MM-DD'),
      quantity: values.quantity,
      reason: values.reason,
      uom: values.uom,
      warehouse: values.warehouse,
    };
  }
  return {
    ...(draft.draftType === 'purchase_order'
      ? { supplier: values.party }
      : { customer: values.party }),
    company: values.company,
    ...(draft.draftType === 'purchase_order'
      ? {
          default_purchase_mode: values.defaultMode,
          schedule_date: values.targetDate?.format('YYYY-MM-DD'),
        }
      : {
          default_sales_mode: values.defaultMode,
          delivery_date: values.targetDate?.format('YYYY-MM-DD'),
        }),
    items: (values.items ?? []).map((row: Record<string, unknown>) => ({
      item_code: row.itemCode,
      price: row.price,
      qty: row.qty,
      uom: row.uom,
      warehouse: row.warehouse,
    })),
    remarks: values.remarks,
    transaction_date: values.transactionDate?.format('YYYY-MM-DD'),
    warehouse: values.warehouse,
  };
}

export function AiDraftEditorModal({
  draft,
  onClose,
  onUpdated,
}: {
  draft: AiDraft | null;
  onClose: () => void;
  onUpdated: (draft: AiDraft) => void;
}) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const company = Form.useWatch('company', form);
  const openingQty = Form.useWatch('openingQty', form);
  const stockUom = Form.useWatch('stockUom', form);
  const hasOpeningStock = Number(openingQty ?? 0) > 0;

  useEffect(() => {
    form.resetFields();
    if (draft) form.setFieldsValue(initialValues(draft));
  }, [draft, form]);

  const save = async () => {
    if (!draft) return;
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSaving(true);
    try {
      const updated = await updateAiDraft(
        draft.name,
        buildPayload(draft, values),
      );
      onUpdated(updated);
      if (updated.validation.readyForHandoff) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      destroyOnHidden
      onCancel={onClose}
      onOk={() => void save()}
      okButtonProps={{ loading: saving }}
      okText="保存草稿"
      open={Boolean(draft)}
      title={
        draft
          ? `${draft.validation.readyForHandoff ? '编辑' : '完善'}${
              draft.draftType === 'product_setup'
                ? '商品建档'
                : draft.draftType === 'inventory_adjustment'
                  ? '库存调整'
                  : draft.draftType === 'purchase_order'
                    ? '采购订单'
                    : '销售订单'
            }草稿 · 版本 ${draft.version}`
          : '编辑 AI 草稿'
      }
      width={980}
    >
      {draft ? (
        <Form form={form} layout="vertical">
          {draft.validation.errors.length ||
          draft.validation.warnings.length ? (
            <Alert
              description={
                <Space orientation="vertical" size={2}>
                  {draft.validation.errors.map((error) => (
                    <Typography.Text key={error} type="danger">
                      {error}
                    </Typography.Text>
                  ))}
                  {draft.validation.warnings.map((warning) => (
                    <Typography.Text key={warning}>{warning}</Typography.Text>
                  ))}
                </Space>
              }
              showIcon
              style={{ marginBottom: 16 }}
              title="请补充以下信息"
              type={draft.validation.errors.length ? 'warning' : 'info'}
            />
          ) : null}
          <Form.Item label="公司" name="company" rules={[{ required: true }]}>
            <Input disabled />
          </Form.Item>
          {draft.draftType === 'product_setup' ? (
            <>
              <div
                style={{
                  display: 'grid',
                  gap: 12,
                  gridTemplateColumns: '1fr 1fr',
                }}
              >
                <Form.Item
                  label="商品名称"
                  name="itemName"
                  rules={[{ required: true }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item label="商品编码" name="itemCode">
                  <Input />
                </Form.Item>
                <Form.Item label="商品分类" name="itemGroup">
                  <RemoteLinkSelect
                    doctype="Item Group"
                    filters={{ is_group: 0 }}
                  />
                </Form.Item>
                <Form.Item label="品牌" name="brand">
                  <RemoteLinkSelect doctype="Brand" />
                </Form.Item>
                <Form.Item
                  label="库存基准单位"
                  name="stockUom"
                  extra="初始库存统一按该单位写入，不需要另外选择入库单位。"
                  rules={[{ message: '请选择库存基准单位', required: true }]}
                >
                  <UomSelect />
                </Form.Item>
                <Form.Item
                  label="币种"
                  name="currency"
                  rules={[{ required: true }]}
                >
                  <CurrencySelect />
                </Form.Item>
                <Form.Item label="标准售价" name="standardSellingRate">
                  <InputNumber
                    min={0}
                    precision={6}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
                <Form.Item
                  label="默认采购价"
                  name="standardBuyingRate"
                  extra={
                    hasOpeningStock
                      ? '用于首次入库成本和默认采购价格；不会使用标准售价代替。'
                      : '用于采购业务的默认参考价。'
                  }
                  required={hasOpeningStock}
                  rules={[
                    {
                      validator: async (_, value) => {
                        if (
                          Number(form.getFieldValue('openingQty') ?? 0) > 0 &&
                          (value === null ||
                            value === undefined ||
                            value === '')
                        ) {
                          throw new Error('填写初始库存时，请输入默认采购价');
                        }
                      },
                    },
                  ]}
                >
                  <InputNumber
                    min={0}
                    precision={6}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
                <Form.Item label="初始库存数量" name="openingQty">
                  <InputNumber
                    min={0}
                    precision={6}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
                <Form.Item
                  label="入库仓库"
                  name="warehouse"
                  extra={
                    hasOpeningStock
                      ? `将按库存基准单位${stockUom ? `（${stockUom}）` : ''}入库。`
                      : undefined
                  }
                  required={hasOpeningStock}
                  rules={[
                    {
                      validator: async (_, value) => {
                        if (
                          Number(form.getFieldValue('openingQty') ?? 0) > 0 &&
                          !value
                        ) {
                          throw new Error('填写初始库存时，请选择入库仓库');
                        }
                      },
                    },
                  ]}
                >
                  <RemoteLinkSelect
                    doctype="Warehouse"
                    filters={{ company, disabled: 0, is_group: 0 }}
                  />
                </Form.Item>
              </div>
              <Form.Item label="商品描述" name="description">
                <Input.TextArea maxLength={2000} rows={3} />
              </Form.Item>
            </>
          ) : draft.draftType === 'inventory_adjustment' ? (
            <div
              style={{
                display: 'grid',
                gap: 12,
                gridTemplateColumns: '1fr 1fr',
              }}
            >
              <Form.Item
                label="过账日期"
                name="postingDate"
                rules={[{ required: true }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                label="仓库"
                name="warehouse"
                rules={[{ required: true }]}
              >
                <RemoteLinkSelect
                  doctype="Warehouse"
                  filters={{ company, disabled: 0, is_group: 0 }}
                />
              </Form.Item>
              <Form.Item
                label="商品"
                name="itemCode"
                rules={[{ required: true }]}
              >
                <RemoteLinkSelect
                  doctype="Item"
                  filters={{ disabled: 0, is_stock_item: 1 }}
                />
              </Form.Item>
              <Form.Item
                label="调整方式"
                name="adjustmentType"
                rules={[{ required: true }]}
              >
                <Select
                  options={[
                    { label: '调整到目标库存', value: 'set_target' },
                    { label: '增加库存', value: 'increase' },
                    { label: '减少库存', value: 'decrease' },
                  ]}
                />
              </Form.Item>
              <Form.Item
                label="数量"
                name="quantity"
                rules={[{ required: true }]}
              >
                <InputNumber min={0} precision={6} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="单位" name="uom">
                <UomSelect />
              </Form.Item>
              <Form.Item
                label="调整原因"
                name="reason"
                rules={[{ required: true }]}
              >
                <Input.TextArea maxLength={1000} rows={3} />
              </Form.Item>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gap: 12,
                  gridTemplateColumns: '1fr 1fr',
                }}
              >
                <Form.Item
                  label={
                    draft.draftType === 'purchase_order' ? '供应商' : '客户'
                  }
                  name="party"
                  rules={[{ required: true }]}
                >
                  <RemoteLinkSelect
                    doctype={
                      draft.draftType === 'purchase_order'
                        ? 'Supplier'
                        : 'Customer'
                    }
                  />
                </Form.Item>
                <Form.Item
                  label="默认仓库"
                  name="warehouse"
                  rules={[{ required: true }]}
                >
                  <RemoteLinkSelect
                    doctype="Warehouse"
                    filters={{ company, disabled: 0, is_group: 0 }}
                  />
                </Form.Item>
                <Form.Item
                  label="单据日期"
                  name="transactionDate"
                  rules={[{ required: true }]}
                >
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  label={
                    draft.draftType === 'purchase_order'
                      ? '预计到货日期'
                      : '交货日期'
                  }
                  name="targetDate"
                  rules={[{ required: true }]}
                >
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  label={
                    draft.draftType === 'purchase_order'
                      ? '采购取值模式'
                      : '销售模式'
                  }
                  name="defaultMode"
                >
                  <Select
                    options={[
                      { label: '批发', value: 'wholesale' },
                      { label: '零售', value: 'retail' },
                    ]}
                  />
                </Form.Item>
              </div>
              <Form.Item label="备注" name="remarks">
                <Input.TextArea maxLength={1000} />
              </Form.Item>
              <Form.List name="items">
                {(fields, { add, remove }) => (
                  <Space orientation="vertical" style={{ width: '100%' }}>
                    {fields.map((field) => (
                      <ProCard
                        key={field.key}
                        size="small"
                        title={`商品行 ${field.name + 1}`}
                        extra={
                          <Button danger onClick={() => remove(field.name)}>
                            删除
                          </Button>
                        }
                      >
                        <div
                          style={{
                            display: 'grid',
                            gap: 12,
                            gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr',
                          }}
                        >
                          <Form.Item
                            name={[field.name, 'itemCode']}
                            rules={[{ required: true }]}
                          >
                            <RemoteLinkSelect
                              doctype="Item"
                              filters={{ disabled: 0 }}
                              placeholder="商品"
                            />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, 'qty']}
                            rules={[{ required: true }]}
                          >
                            <InputNumber
                              min={0.000001}
                              placeholder="数量"
                              style={{ width: '100%' }}
                            />
                          </Form.Item>
                          <Form.Item name={[field.name, 'uom']}>
                            <UomSelect placeholder="单位" />
                          </Form.Item>
                          <Form.Item name={[field.name, 'price']}>
                            <InputNumber
                              min={0}
                              placeholder="价格"
                              precision={6}
                              style={{ width: '100%' }}
                            />
                          </Form.Item>
                          <Form.Item name={[field.name, 'warehouse']}>
                            <RemoteLinkSelect
                              doctype="Warehouse"
                              filters={{ company, disabled: 0, is_group: 0 }}
                              placeholder="仓库"
                            />
                          </Form.Item>
                        </div>
                      </ProCard>
                    ))}
                    <Button onClick={() => add()} type="dashed">
                      新增商品行
                    </Button>
                  </Space>
                )}
              </Form.List>
            </>
          )}
        </Form>
      ) : null}
    </Modal>
  );
}
