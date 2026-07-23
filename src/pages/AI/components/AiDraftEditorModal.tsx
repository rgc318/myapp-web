import { ProCard } from '@ant-design/pro-components';
import {
  Alert,
  App,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
  Typography,
} from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import React, { useEffect, useRef, useState } from 'react';
import { RemoteLinkSelect } from '@/components';
import { CurrencySelect } from '@/components/CurrencySelect';
import { UomSelect } from '@/components/UomSelect';
import {
  type AiDraft,
  executeAiDraft,
  getAiDraft,
  updateAiDraft,
} from '@/services/myapp/ai';
import { notifyMutationError } from '@/services/myapp/mutation';
import { AiDraftBusinessReview } from './AiDraftReview';

type DraftItemFormValues = {
  itemCode?: string;
  price?: number;
  qty?: number;
  uom?: string;
  warehouse?: string;
};

type FormValues = {
  adjustmentType?: 'set_target' | 'increase' | 'decrease';
  brand?: string;
  company?: string;
  currency?: string;
  defaultMode?: 'wholesale' | 'retail';
  description?: string;
  itemCode?: string;
  itemGroup?: string;
  itemName?: string;
  items?: DraftItemFormValues[];
  openingQty?: number;
  party?: string;
  postingDate?: Dayjs;
  quantity?: number;
  reason?: string;
  remarks?: string;
  retailRate?: number;
  standardBuyingRate?: number;
  standardSellingRate?: number;
  stockUom?: string;
  supplierRef?: string;
  targetDate?: Dayjs;
  transactionDate?: Dayjs;
  uom?: string;
  warehouse?: string;
  wholesaleRate?: number;
};

function readPayloadRow(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function textValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function dateValue(value: unknown): Dayjs | undefined {
  return typeof value === 'string' && value ? dayjs(value) : undefined;
}

function initialValues(draft: AiDraft): FormValues {
  const payload = draft.payload;
  if (draft.draftType === 'product_setup') {
    return {
      brand: textValue(payload.brand) ?? textValue(payload.brand_query),
      company: textValue(payload.company) ?? draft.company ?? undefined,
      currency: textValue(payload.currency) ?? 'CNY',
      description: textValue(payload.description),
      itemCode: textValue(payload.item_code),
      itemGroup:
        textValue(payload.item_group) ?? textValue(payload.item_group_query),
      itemName: textValue(payload.item_name),
      openingQty: numberValue(payload.opening_qty),
      standardBuyingRate:
        numberValue(payload.standard_buying_rate) ??
        numberValue(payload.valuation_rate),
      retailRate: numberValue(payload.retail_rate),
      standardSellingRate: numberValue(payload.standard_selling_rate),
      stockUom: textValue(payload.stock_uom),
      warehouse:
        textValue(payload.warehouse) ?? textValue(payload.warehouse_query),
      wholesaleRate: numberValue(payload.wholesale_rate),
    };
  }
  if (draft.draftType === 'inventory_adjustment') {
    const item = readPayloadRow(
      Array.isArray(payload.items) ? payload.items[0] : undefined,
    );
    const rawAdjustmentType = textValue(payload.adjustment_type);
    return {
      adjustmentType:
        rawAdjustmentType === 'increase' || rawAdjustmentType === 'decrease'
          ? rawAdjustmentType
          : 'set_target',
      company: textValue(payload.company) ?? draft.company ?? undefined,
      itemCode: textValue(item.item_code) ?? textValue(item.item_query),
      postingDate: dateValue(payload.posting_date),
      quantity: numberValue(item.qty),
      reason: textValue(payload.reason) ?? textValue(payload.remarks),
      uom: textValue(item.uom),
      warehouse: textValue(payload.warehouse),
    };
  }
  return {
    company: textValue(payload.company) ?? draft.company ?? undefined,
    defaultMode:
      (draft.draftType === 'purchase_order'
        ? textValue(payload.default_purchase_mode)
        : textValue(payload.default_sales_mode)) === 'retail'
        ? 'retail'
        : 'wholesale',
    items: Array.isArray(payload.items)
      ? payload.items.map((value) => {
          const row = readPayloadRow(value);
          return {
            itemCode:
              String(row.item_code ?? row.item_query ?? '') || undefined,
            price: numberValue(row.price),
            qty: numberValue(row.qty),
            uom: textValue(row.uom),
            warehouse: textValue(row.warehouse),
          };
        })
      : [],
    party:
      draft.draftType === 'purchase_order'
        ? (textValue(payload.supplier) ?? textValue(payload.supplier_query))
        : (textValue(payload.customer) ?? textValue(payload.customer_query)),
    currency:
      draft.draftType === 'purchase_order'
        ? textValue(payload.currency)
        : undefined,
    remarks: textValue(payload.remarks),
    supplierRef:
      draft.draftType === 'purchase_order'
        ? textValue(payload.supplier_ref)
        : undefined,
    targetDate: dateValue(
      draft.draftType === 'purchase_order'
        ? payload.schedule_date
        : payload.delivery_date,
    ),
    transactionDate: dateValue(payload.transaction_date),
    warehouse: textValue(payload.warehouse),
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
      retail_rate: values.retailRate,
      standard_buying_rate: values.standardBuyingRate,
      standard_selling_rate: values.standardSellingRate,
      stock_uom: values.stockUom,
      warehouse: values.warehouse,
      wholesale_rate: values.wholesaleRate,
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
          currency: values.currency,
          default_purchase_mode: values.defaultMode,
          schedule_date: values.targetDate?.format('YYYY-MM-DD'),
          supplier_ref: values.supplierRef,
        }
      : {
          default_sales_mode: values.defaultMode,
          delivery_date: values.targetDate?.format('YYYY-MM-DD'),
        }),
    items: (values.items ?? []).map((row) => ({
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
  draftId,
  onClose,
  onLoaded,
  onUpdated,
}: {
  draftId: string | null;
  onClose: () => void;
  onLoaded?: (draft: AiDraft) => void;
  onUpdated: (draft: AiDraft) => void;
}) {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [draft, setDraft] = useState<AiDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const onCloseRef = useRef(onClose);
  const onLoadedRef = useRef(onLoaded);
  const company = Form.useWatch('company', form);
  const adjustmentType = Form.useWatch('adjustmentType', form);
  const openingQty = Form.useWatch('openingQty', form);
  const stockUom = Form.useWatch('stockUom', form);
  const hasOpeningStock = Number(openingQty ?? 0) > 0;
  const busy = saving || executing;

  const applyDraft = (nextDraft: AiDraft) => {
    setDraft(nextDraft);
    form.resetFields();
    form.setFieldsValue(initialValues(nextDraft));
    onUpdated(nextDraft);
  };

  useEffect(() => {
    onCloseRef.current = onClose;
    onLoadedRef.current = onLoaded;
  }, [onClose, onLoaded]);

  useEffect(() => {
    form.resetFields();
    setDraft(null);
    if (!draftId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void getAiDraft(draftId)
      .then((latestDraft) => {
        if (!active) return;
        setDraft(latestDraft);
        form.setFieldsValue(initialValues(latestDraft));
        onLoadedRef.current?.(latestDraft);
      })
      .catch((error) => {
        if (!active) return;
        notifyMutationError(error);
        onCloseRef.current();
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [draftId, form]);

  const save = async ({ notify = true }: { notify?: boolean } = {}) => {
    if (!draft || draft.status !== 'draft') return null;
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return null;
    }
    setSaving(true);
    try {
      const updated = await updateAiDraft(
        draft.name,
        draft.version,
        buildPayload(draft, values),
      );
      applyDraft(updated);
      if (notify)
        message.success(`草稿版本 ${updated.version} 已保存并重新校验`);
      return updated;
    } catch (error) {
      notifyMutationError(error);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const confirmExecute = async () => {
    if (!draft || draft.status !== 'draft') return;

    let latestDraft: AiDraft | null = null;
    if (form.isFieldsTouched()) {
      latestDraft = await save({ notify: false });
    } else {
      setSaving(true);
      try {
        latestDraft = await getAiDraft(draft.name);
        applyDraft(latestDraft);
      } catch (error) {
        notifyMutationError(error);
        return;
      } finally {
        setSaving(false);
      }
    }

    if (!latestDraft) return;
    if (latestDraft.status !== 'draft') {
      message.info('草稿状态已变化，已刷新为最新状态。');
      return;
    }
    if (!latestDraft.validation.readyForHandoff) {
      message.warning('草稿仍有未解决的校验问题，请先完善后再执行。');
      return;
    }

    modal.confirm({
      content: (
        <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
          <AiDraftBusinessReview draft={latestDraft} />
        </div>
      ),
      okText: '确认执行当前版本',
      onOk: async () => {
        setExecuting(true);
        try {
          const result = await executeAiDraft(
            latestDraft.name,
            latestDraft.version,
          );
          applyDraft(result.draft);
          message.success(
            result.replayed
              ? '该草稿已执行，已恢复正式业务回执。'
              : '草稿执行成功，正式业务回执已生成。',
          );
        } catch (error) {
          notifyMutationError(error);
          throw error;
        } finally {
          setExecuting(false);
        }
      },
      title: `确认执行草稿 ${latestDraft.name} · 版本 ${latestDraft.version}？`,
      width: 760,
    });
  };

  return (
    <Modal
      closable={!busy}
      destroyOnHidden
      footer={
        draft?.status === 'draft' ? (
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button disabled={busy} onClick={onClose}>
              取消
            </Button>
            <Button
              disabled={loading || executing}
              loading={saving}
              onClick={() => void save()}
            >
              保存草稿
            </Button>
            <Button
              disabled={loading || saving}
              loading={executing}
              onClick={() => void confirmExecute()}
              type="primary"
            >
              确认执行
            </Button>
          </Space>
        ) : (
          <Button onClick={onClose} type="primary">
            关闭
          </Button>
        )
      }
      keyboard={!busy}
      mask={{ closable: !busy }}
      onCancel={() => {
        if (!busy) onClose();
      }}
      open={Boolean(draftId)}
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
      <Spin description="正在读取最新草稿版本…" spinning={loading}>
        {draft && draft.status !== 'draft' ? (
          <AiDraftBusinessReview draft={draft} />
        ) : draft ? (
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
                  <Form.Item
                    label="标准售价（默认单价）"
                    name="standardSellingRate"
                    extra="写入 Standard Selling，作为未指定销售模式时的默认销售单价。"
                  >
                    <InputNumber
                      min={0}
                      precision={6}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  <Form.Item
                    label="批发价"
                    name="wholesaleRate"
                    extra="写入 Wholesale 价格表，供批发销售模式默认取价。"
                  >
                    <InputNumber
                      min={0}
                      precision={6}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  <Form.Item
                    label="零售价"
                    name="retailRate"
                    extra="写入 Retail 价格表，供零售销售模式默认取价。"
                  >
                    <InputNumber
                      min={0}
                      precision={6}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  <Form.Item
                    label="成本价（默认采购价）"
                    name="standardBuyingRate"
                    extra={
                      hasOpeningStock
                        ? '用于首次入库成本，同时写入 Standard Buying 作为默认采购参考价；不会使用售价代替。'
                        : '写入 Standard Buying，作为采购业务的默认成本参考价。'
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
                            throw new Error(
                              '填写初始库存时，请输入成本价（默认采购价）',
                            );
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
                  rules={[
                    { required: true },
                    {
                      validator: async (_, value) => {
                        if (
                          adjustmentType !== 'set_target' &&
                          Number(value ?? 0) <= 0
                        ) {
                          throw new Error('增加或减少库存时，数量必须大于 0');
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
                  {draft.draftType === 'purchase_order' ? (
                    <Form.Item
                      label="币种"
                      name="currency"
                      rules={[{ required: true }]}
                    >
                      <CurrencySelect />
                    </Form.Item>
                  ) : null}
                  <Form.Item
                    extra="未填写时，每个商品行必须单独选择仓库。"
                    label="默认仓库"
                    name="warehouse"
                  >
                    <RemoteLinkSelect
                      doctype="Warehouse"
                      filters={{ company, disabled: 0, is_group: 0 }}
                    />
                  </Form.Item>
                  {draft.draftType === 'purchase_order' ? (
                    <Form.Item label="供应商参考号" name="supplierRef">
                      <Input maxLength={140} />
                    </Form.Item>
                  ) : null}
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
        ) : (
          <div style={{ minHeight: 180 }} />
        )}
      </Spin>
    </Modal>
  );
}
