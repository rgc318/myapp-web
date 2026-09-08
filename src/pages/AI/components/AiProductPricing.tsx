import {
  Alert,
  Button,
  Form,
  InputNumber,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import React from 'react';
import { PriceListName } from '@/components/PriceListName';
import { UomSelect } from '@/components/UomSelect';
import { readAiProductPricing } from '@/services/myapp/ai-product-pricing';
import { resolveDisplayUom } from '@/utils/display-uom';
import { formatCurrencyValue } from '@/utils/myapp-display';

const priceOptions = [
  { value: 'Standard Selling', label: '标准销售参考价' },
  { value: 'Wholesale', label: '批发价' },
  { value: 'Retail', label: '零售价' },
  { value: 'Standard Buying', label: '标准采购参考价' },
];

export function AiProductPricingSummary({
  payload,
}: {
  payload: Record<string, unknown>;
}) {
  const pricing = readAiProductPricing(payload);
  if (!pricing) return null;
  return (
    <Space wrap size={[12, 4]}>
      {pricing.productPrices.map((row, index) => (
        <span key={row.rowId ?? index}>
          <PriceListName code={row.priceList} />{' '}
          {formatCurrencyValue(row.rate, row.currency ?? 'CNY')}/
          {resolveDisplayUom(row.uom, row.uomDisplay)}{' '}
          {row.interpretation === 'inferred' && (
            <Tag color="orange">推断待确认</Tag>
          )}
          {row.interpretation === 'default' && <Tag>默认参考</Tag>}
        </span>
      ))}
    </Space>
  );
}

export function AiProductPricingFields() {
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <Alert
        type="info"
        showIcon
        title="价格必须按各自单位保存"
        description="请逐行核对用途、金额和计价单位。整箱/单件用途可能是推断；标准参考价默认采用同库存单位的批发价。单位换算必须按真实包装数量填写，不能按价格比例推算。"
      />
      <Typography.Title level={5}>价格与计价单位</Typography.Title>
      <Form.List name="productPrices">
        {(fields, { add, remove }) => (
          <>
            <Table
              pagination={false}
              size="small"
              rowKey="key"
              dataSource={fields}
              scroll={{ x: 680 }}
              columns={[
                {
                  title: '价格用途',
                  width: 200,
                  render: (_, field) => (
                    <Form.Item
                      name={[field.name, 'priceList']}
                      rules={[{ required: true, message: '选择价格用途' }]}
                    >
                      <Select options={priceOptions} />
                    </Form.Item>
                  ),
                },
                {
                  title: '金额',
                  width: 150,
                  render: (_, field) => (
                    <Form.Item
                      name={[field.name, 'rate']}
                      rules={[{ required: true, message: '填写金额' }]}
                    >
                      <InputNumber
                        min={0}
                        max={1000000000}
                        precision={6}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  ),
                },
                {
                  title: '每单位',
                  width: 170,
                  render: (_, field) => (
                    <Form.Item
                      name={[field.name, 'uom']}
                      rules={[{ required: true, message: '选择计价单位' }]}
                    >
                      <UomSelect />
                    </Form.Item>
                  ),
                },
                {
                  title: '来源',
                  render: (_, field) => (
                    <Form.Item noStyle shouldUpdate>
                      {({ getFieldValue }) => {
                        const row = getFieldValue([
                          'productPrices',
                          field.name,
                        ]);
                        return (
                          <Typography.Text
                            type={
                              row?.interpretation === 'inferred'
                                ? 'warning'
                                : 'secondary'
                            }
                          >
                            {row?.evidence || '用户填写'}
                          </Typography.Text>
                        );
                      }}
                    </Form.Item>
                  ),
                },
                {
                  title: '操作',
                  width: 65,
                  render: (_, field) => (
                    <Button
                      danger
                      type="link"
                      onClick={() => remove(field.name)}
                    >
                      移除
                    </Button>
                  ),
                },
              ]}
            />
            <Button
              onClick={() =>
                add({
                  rowId: `user-${Date.now()}-${fields.length}`,
                  interpretation: 'user',
                })
              }
            >
              添加价格
            </Button>
          </>
        )}
      </Form.List>
      <Typography.Title level={5}>包装与单位换算</Typography.Title>
      <Typography.Paragraph type="secondary">
        例如填写“12 瓶 = 1
        箱”。未知数量留空保存草稿，补齐并通过后端校验后才能执行。
      </Typography.Paragraph>
      <Form.List name="productUomRelations">
        {(fields, { add, remove }) => (
          <>
            {fields.map((field) => (
              <Space key={field.key} align="baseline" wrap>
                <Form.Item name={[field.name, 'fromQty']}>
                  <InputNumber
                    aria-label="左侧数量"
                    min={0.000000001}
                    max={1000000000}
                    placeholder="数量待补充"
                  />
                </Form.Item>
                <Form.Item name={[field.name, 'fromUom']}>
                  <UomSelect style={{ width: 150 }} />
                </Form.Item>
                <span>=</span>
                <Form.Item name={[field.name, 'toQty']}>
                  <InputNumber
                    aria-label="右侧数量"
                    min={0.000000001}
                    max={1000000000}
                  />
                </Form.Item>
                <Form.Item name={[field.name, 'toUom']}>
                  <UomSelect style={{ width: 150 }} />
                </Form.Item>
                <Button danger type="link" onClick={() => remove(field.name)}>
                  移除关系
                </Button>
              </Space>
            ))}
            <Button onClick={() => add({ fromQty: 1, toQty: 1 })}>
              添加换算关系
            </Button>
          </>
        )}
      </Form.List>
      <Space align="start" wrap style={{ marginTop: 16 }}>
        <Form.Item label="批发默认单位" name="wholesaleDefaultUom">
          <UomSelect style={{ width: 220 }} />
        </Form.Item>
        <Form.Item label="零售默认单位" name="retailDefaultUom">
          <UomSelect style={{ width: 220 }} />
        </Form.Item>
      </Space>
    </div>
  );
}
