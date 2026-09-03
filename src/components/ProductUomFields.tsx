import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Form,
  type FormInstance,
  InputNumber,
  Select,
  Space,
  Typography,
} from 'antd';
import React, { useEffect, useMemo, useRef } from 'react';
import type { SaveProductPayload } from '@/services/myapp/master-data';
import { resolveDisplayUom } from '@/utils/myapp-display';
import { UomSelect } from './UomSelect';

function normalizeUom(value: string | null | undefined) {
  return value?.trim() || '';
}

type ProductUomConversion = NonNullable<
  SaveProductPayload['uomConversions']
>[number];

export function ProductUomFields({
  disabled = false,
  form,
  lockStockUom = false,
  stockUomDisplay,
  uomDisplays = {},
}: {
  disabled?: boolean;
  form: FormInstance<SaveProductPayload>;
  lockStockUom?: boolean;
  stockUomDisplay?: string | null;
  uomDisplays?: Record<string, string>;
}) {
  const stockUom = Form.useWatch('stockUom', form);
  const conversions = Form.useWatch('uomConversions', form) ?? [];
  const previousStockUomRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const resolvedStockUom = normalizeUom(stockUom);
    const previousStockUom = previousStockUomRef.current;
    previousStockUomRef.current = resolvedStockUom;
    if (!resolvedStockUom) return;

    const current: ProductUomConversion[] =
      form.getFieldValue('uomConversions') ?? [];
    const stockIndex = current.findIndex(
      (entry) => normalizeUom(entry?.uom) === resolvedStockUom,
    );
    if (stockIndex < 0) {
      const canReplaceInitialStockUom =
        !lockStockUom &&
        Boolean(previousStockUom) &&
        current.length === 1 &&
        normalizeUom(current[0]?.uom) === previousStockUom &&
        Number(current[0]?.conversionFactor ?? 0) === 1;
      if (canReplaceInitialStockUom) {
        form.setFieldValue('uomConversions', [
          { ...current[0], uom: resolvedStockUom },
        ]);
        if (form.getFieldValue('wholesaleDefaultUom') === previousStockUom) {
          form.setFieldValue('wholesaleDefaultUom', resolvedStockUom);
        }
        if (form.getFieldValue('retailDefaultUom') === previousStockUom) {
          form.setFieldValue('retailDefaultUom', resolvedStockUom);
        }
        return;
      }
      form.setFieldValue('uomConversions', [
        { conversionFactor: 1, uom: resolvedStockUom },
        ...current,
      ]);
      return;
    }
    if (Number(current[stockIndex]?.conversionFactor ?? 0) !== 1) {
      const next = current.map((entry, index) =>
        index === stockIndex ? { ...entry, conversionFactor: 1 } : entry,
      );
      form.setFieldValue('uomConversions', next);
    }
  }, [form, lockStockUom, stockUom]);

  const defaultOptions = useMemo(() => {
    const seen = new Set<string>();
    return conversions
      .map((entry) => normalizeUom(entry?.uom))
      .filter((uom) => {
        if (!uom || seen.has(uom)) return false;
        seen.add(uom);
        return true;
      })
      .map((uom) => ({
        label: resolveDisplayUom(uom, uomDisplays[uom]),
        value: uom,
      }));
  }, [conversions, uomDisplays]);

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Alert
        showIcon
        type="info"
        message="库存基准单位用于库存账本；包装单位必须明确配置换算关系。换算含义统一为：1 当前单位 = 换算系数 × 库存基准单位。"
      />
      {lockStockUom ? (
        <Alert
          showIcon
          type="warning"
          message="已有商品的库存基准单位不在普通编辑中修改，避免破坏历史库存账本；如确需变更，应使用受控单位迁移流程。"
        />
      ) : null}
      <Form.Item
        label="库存基准单位"
        name="stockUom"
        rules={[{ required: true, message: '请选择库存基准单位' }]}
      >
        <UomSelect
          disabled={disabled || lockStockUom}
          displayValue={stockUomDisplay}
        />
      </Form.Item>
      <Form.List name="uomConversions">
        {(fields, { add, remove }) => (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Typography.Text strong>商品单位与换算</Typography.Text>
            {fields.map((field) => {
              const rowUom = normalizeUom(conversions[field.name]?.uom);
              const isStockUom = rowUom === normalizeUom(stockUom);
              return (
                <Space align="start" key={field.key} style={{ width: '100%' }}>
                  <Form.Item
                    {...field}
                    label={field.name === 0 ? '单位' : undefined}
                    name={[field.name, 'uom']}
                    rules={[
                      { required: true, message: '请选择单位' },
                      {
                        validator: async (_, value) => {
                          const normalized = normalizeUom(value);
                          const duplicateCount = conversions.filter(
                            (entry) => normalizeUom(entry?.uom) === normalized,
                          ).length;
                          if (normalized && duplicateCount > 1) {
                            throw new Error('同一单位不能重复配置');
                          }
                        },
                      },
                    ]}
                    style={{ minWidth: 240, marginBottom: 0 }}
                  >
                    <UomSelect
                      disabled={disabled || isStockUom}
                      displayValue={uomDisplays[rowUom]}
                    />
                  </Form.Item>
                  <Form.Item
                    {...field}
                    extra={isStockUom ? '基准单位固定为 1' : undefined}
                    label={field.name === 0 ? '换算系数' : undefined}
                    name={[field.name, 'conversionFactor']}
                    rules={[
                      { required: true, message: '请输入换算系数' },
                      {
                        validator: async (_, value) => {
                          if (Number(value ?? 0) <= 0) {
                            throw new Error('换算系数必须大于 0');
                          }
                        },
                      },
                    ]}
                    style={{ minWidth: 220, marginBottom: 0 }}
                  >
                    <InputNumber
                      disabled={disabled || isStockUom}
                      min={0.000001}
                      precision={6}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  <Button
                    danger
                    disabled={disabled || isStockUom}
                    icon={<MinusCircleOutlined />}
                    style={{ marginTop: field.name === 0 ? 30 : 0 }}
                    type="text"
                    onClick={() => remove(field.name)}
                  />
                </Space>
              );
            })}
            <Button
              block
              disabled={disabled}
              icon={<PlusOutlined />}
              type="dashed"
              onClick={() =>
                add({ conversionFactor: undefined, uom: undefined })
              }
            >
              添加包装或交易单位
            </Button>
          </Space>
        )}
      </Form.List>
      <Space size={16} style={{ width: '100%' }}>
        <Form.Item
          label="批发默认单位"
          name="wholesaleDefaultUom"
          style={{ flex: 1 }}
        >
          <Select
            allowClear
            disabled={disabled}
            options={defaultOptions}
            placeholder="从商品单位中选择"
          />
        </Form.Item>
        <Form.Item
          label="零售默认单位"
          name="retailDefaultUom"
          style={{ flex: 1 }}
        >
          <Select
            allowClear
            disabled={disabled}
            options={defaultOptions}
            placeholder="从商品单位中选择"
          />
        </Form.Item>
      </Space>
    </Space>
  );
}
