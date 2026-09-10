import { ProCard, ProDescriptions } from '@ant-design/pro-components';
import {
  Alert,
  AutoComplete,
  Button,
  Checkbox,
  Empty,
  Form,
  type FormInstance,
  Input,
  InputNumber,
  Modal,
  message,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { PriceListName } from '@/components/PriceListName';
import { ProductUomFields } from '@/components/ProductUomFields';
import {
  assessProductUomMigration,
  executeProductUomMigration,
  type ProductUomMigrationAssessment,
  type ProductUomMigrationPrice,
  type SaveProductPayload,
} from '@/services/myapp/master-data';
import { formatCurrencyValue, resolveDisplayUom } from '@/utils/myapp-display';
import {
  resolvePriceListDisplay,
  resolvePriceListOptionLabel,
} from '@/utils/price-list-display';

type MigrationFormValues = SaveProductPayload & {
  barcodeMappings: {
    action?: 'move' | 'keep';
    sourceName: string;
    targetUom?: string;
  }[];
  confirmDisableSource: boolean;
  confirmHistoryPreserved: boolean;
  confirmInPlaceCorrection: boolean;
  confirmInventoryConversion: boolean;
  correctionReason?: string;
  inventoryMappings: {
    sourceQty: number;
    targetQty?: number;
    warehouse: string;
  }[];
  newItemCode: string;
  newPrices: {
    currency?: string;
    priceList?: string;
    rate?: number;
    targetUom?: string;
  }[];
  priceMappings: {
    action?: 'copy' | 'manual' | 'skip';
    sourceName: string;
    targetRate?: number;
    targetUom?: string;
  }[];
  strategy: 'in_place' | 'replacement';
};

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 6,
  }).format(value ?? 0);
}

function migrationUomOptions(values: MigrationFormValues['uomConversions']) {
  const seen = new Set<string>();
  return (values ?? [])
    .map((row) => row.uom?.trim())
    .filter((uom): uom is string => {
      if (!uom || seen.has(uom)) return false;
      seen.add(uom);
      return true;
    })
    .map((uom) => ({ label: resolveDisplayUom(uom), value: uom }));
}

function findDuplicatePricePlan(
  assessment: ProductUomMigrationAssessment,
  values: MigrationFormValues,
) {
  const sourceByName = new Map(
    assessment.prices.map((price) => [price.name, price]),
  );
  const rows = [
    ...(values.priceMappings ?? [])
      .filter((mapping) => mapping.action && mapping.action !== 'skip')
      .map((mapping) => {
        const source = sourceByName.get(mapping.sourceName);
        return {
          currency: source?.currency?.trim() || '',
          priceList: source?.priceList?.trim() || '',
          targetUom: mapping.targetUom?.trim() || '',
        };
      }),
    ...(values.newPrices ?? []).map((price) => ({
      currency: price.currency?.trim() || '',
      priceList: price.priceList?.trim() || '',
      targetUom: price.targetUom?.trim() || '',
    })),
  ];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.priceList}\u0000${row.currency}\u0000${row.targetUom}`;
    if (seen.has(key)) {
      return `${resolvePriceListDisplay(row.priceList)} / ${row.currency || '默认币种'} / ${resolveDisplayUom(
        row.targetUom,
      )}`;
    }
    seen.add(key);
  }
  return undefined;
}

export function ProductUomMigrationModal({
  itemCode,
  onClose,
  onCompleted,
  open,
}: {
  itemCode: string;
  onClose: () => void;
  onCompleted: (newItemCode: string) => void;
  open: boolean;
}) {
  const [form] = Form.useForm<MigrationFormValues>();
  const [assessment, setAssessment] = useState<ProductUomMigrationAssessment>();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [previewValues, setPreviewValues] = useState<MigrationFormValues>();
  const uomConversions = Form.useWatch('uomConversions', form) ?? [];
  const priceMappings = Form.useWatch('priceMappings', form) ?? [];
  const barcodeMappings = Form.useWatch('barcodeMappings', form) ?? [];
  const strategy = Form.useWatch('strategy', form) ?? 'replacement';
  const targetStockUom = Form.useWatch('stockUom', form);
  const uomOptions = useMemo(
    () => migrationUomOptions(uomConversions),
    [uomConversions],
  );
  const priceListOptions = useMemo(() => {
    const names = new Set([
      'Retail',
      'Wholesale',
      'Standard Selling',
      'Standard Buying',
      ...(assessment?.prices.map((price) => price.priceList) ?? []),
    ]);
    return [...names].map((name) => ({
      label: resolvePriceListOptionLabel(name),
      value: name,
    }));
  }, [assessment]);

  useEffect(() => {
    if (!open || !itemCode) return;
    let active = true;
    setLoading(true);
    setError(undefined);
    setAssessment(undefined);
    void assessProductUomMigration(itemCode)
      .then((result) => {
        if (!active) return;
        setAssessment(result);
        setPreviewValues(undefined);
        form.setFieldsValue({
          barcodeMappings: result.barcodes.map((row) => ({
            action: undefined,
            sourceName: row.name ?? '',
            targetUom: row.uom ?? result.source.stockUom,
          })),
          confirmDisableSource: false,
          confirmHistoryPreserved: false,
          confirmInPlaceCorrection: false,
          confirmInventoryConversion: false,
          correctionReason: '纠正错误库存基准单位',
          inventoryMappings: result.inventory.bins
            .filter((row) => Number(row.actualQty ?? 0) > 0.000001)
            .map((row) => ({
              sourceQty: Number(row.actualQty),
              targetQty: undefined,
              warehouse: row.warehouse,
            })),
          itemName: result.source.itemName,
          newItemCode: result.suggestedNewItemCode,
          newPrices: [],
          priceMappings: result.prices.map((row) => ({
            action: undefined,
            sourceName: row.name,
            targetUom: row.uom ?? result.source.stockUom,
          })),
          retailDefaultUom:
            result.source.retailDefaultUom ?? result.source.stockUom,
          strategy: result.recommendedStrategy ?? 'replacement',
          stockUom: result.source.stockUom,
          uomConversions: result.source.uomConversions.map((row) => ({
            conversionFactor: row.conversionFactor,
            uom: row.uom,
          })),
          wholesaleDefaultUom:
            result.source.wholesaleDefaultUom ?? result.source.stockUom,
        });
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : '纠正评估失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [form, itemCode, open]);

  const executeMigration = async (values: MigrationFormValues) => {
    if (!assessment) return;
    setSubmitting(true);
    try {
      const result = await executeProductUomMigration({
        barcodeMappings: (values.barcodeMappings ?? []).map((mapping) => ({
          action: mapping.action as 'move' | 'keep',
          sourceName: mapping.sourceName,
          targetUom: mapping.targetUom,
        })),
        confirmDisableSource: values.confirmDisableSource,
        confirmHistoryPreserved: values.confirmHistoryPreserved,
        confirmInPlaceCorrection: values.confirmInPlaceCorrection,
        confirmInventoryConversion: values.confirmInventoryConversion,
        correctionReason: values.correctionReason,
        itemCode: assessment.source.itemCode,
        inventoryMappings: (values.inventoryMappings ?? []).map((mapping) => ({
          sourceQty: Number(mapping.sourceQty),
          targetQty: Number(mapping.targetQty),
          warehouse: mapping.warehouse,
        })),
        newItemCode:
          values.strategy === 'replacement'
            ? values.newItemCode?.trim() || undefined
            : undefined,
        newItemName: values.itemName,
        newPrices: (values.newPrices ?? []).map((price) => ({
          currency: price.currency?.trim() || undefined,
          priceList: String(price.priceList || '').trim(),
          rate: Number(price.rate),
          targetUom: String(price.targetUom || ''),
        })),
        priceMappings: (values.priceMappings ?? []).map((mapping) => ({
          action: mapping.action as 'copy' | 'manual' | 'skip',
          sourceName: mapping.sourceName,
          targetRate: mapping.targetRate,
          targetUom: mapping.targetUom,
        })),
        retailDefaultUom: values.retailDefaultUom,
        sourceModified: assessment.source.modified,
        stockUom: String(values.stockUom || ''),
        strategy: values.strategy,
        uomConversions: values.uomConversions ?? [],
        wholesaleDefaultUom: values.wholesaleDefaultUom,
      });
      setPreviewValues(undefined);
      onCompleted(result.data.newItem.itemCode);
    } catch {
      // mutation 层已经展示结构化错误；保留预览和表单内容供用户修正后重试。
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (values: MigrationFormValues) => {
    if (!assessment) return;
    const duplicatePrice = findDuplicatePricePlan(assessment, values);
    if (duplicatePrice) {
      message.error(`价格计划重复：${duplicatePrice}，请合并或删除重复项。`);
      return;
    }
    setPreviewValues({
      ...values,
      barcodeMappings: values.barcodeMappings ?? [],
      inventoryMappings: values.inventoryMappings ?? [],
      newPrices: values.newPrices ?? [],
      priceMappings: values.priceMappings ?? [],
      uomConversions: values.uomConversions ?? [],
    });
  };

  const previewPrices = useMemo(() => {
    if (!assessment || !previewValues) return [];
    const sourceByName = new Map(
      assessment.prices.map((price) => [price.name, price]),
    );
    const mapped = previewValues.priceMappings
      .filter((mapping) => mapping.action && mapping.action !== 'skip')
      .map((mapping) => {
        const source = sourceByName.get(mapping.sourceName);
        return {
          currency: source?.currency || '',
          key: `source-${mapping.sourceName}`,
          priceList: source?.priceList || '',
          rate: mapping.action === 'manual' ? mapping.targetRate : source?.rate,
          source: mapping.action === 'manual' ? '手工指定' : '保留原金额',
          uom: mapping.targetUom || '',
        };
      });
    return [
      ...mapped,
      ...previewValues.newPrices.map((price, index) => ({
        currency: price.currency || '',
        key: `new-${index}`,
        priceList: price.priceList || '',
        rate: price.rate,
        source: '直接新增',
        uom: price.targetUom || '',
      })),
    ];
  }, [assessment, previewValues]);

  const positiveInventoryBins = useMemo(
    () =>
      assessment?.inventory.bins.filter(
        (row) => Number(row.actualQty ?? 0) > 0.000001,
      ) ?? [],
    [assessment],
  );
  const requiresInventoryConversion =
    strategy === 'replacement' &&
    Boolean(assessment?.canExecuteWithInventoryConversion) &&
    positiveInventoryBins.length > 0;
  const canProceed = Boolean(
    assessment?.canExecute || requiresInventoryConversion,
  );

  return (
    <>
      <Modal
        destroyOnHidden
        footer={null}
        onCancel={() => {
          setPreviewValues(undefined);
          onClose();
        }}
        open={open}
        title={`单位错误纠正 · ${itemCode}`}
        width={1120}
      >
        {loading ? <Skeleton active paragraph={{ rows: 10 }} /> : null}
        {error ? (
          <Alert
            action={<Button onClick={onClose}>关闭</Button>}
            description={error}
            showIcon
            title="纠正评估失败"
            type="error"
          />
        ) : null}
        {!loading && !error && !assessment ? (
          <Empty description="未读取到纠正评估结果" />
        ) : null}
        {assessment ? (
          <Form<MigrationFormValues>
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            onFinishFailed={({ errorFields }) => {
              const firstError = errorFields[0];
              if (firstError?.name) {
                form.scrollToField(firstError.name, { block: 'center' });
              }
              message.error(
                firstError?.errors[0] || '纠正表单仍有内容需要检查。',
              );
            }}
          >
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
              <Alert
                description={
                  strategy === 'in_place'
                    ? '系统会保留原商品编码，受控修正库存单位、换算、价格和条码。历史 Stock Ledger Entry 保持原记录，不会重写账本。'
                    : '系统会新建正确商品、建立正式继任关系并停用源商品。历史 Stock Ledger Entry 永久保留在源商品下。'
                }
                showIcon
                title={
                  strategy === 'in_place'
                    ? '系统推荐：保留原编码并受控纠正'
                    : '创建继任商品并停用源商品'
                }
                type="warning"
              />

              {assessment.blockers.map((issue) => (
                <Alert
                  description={issue.message}
                  key={issue.code}
                  showIcon
                  title={issue.code}
                  type={
                    issue.code === 'NON_ZERO_STOCK' &&
                    assessment.canExecuteWithInventoryConversion
                      ? 'warning'
                      : 'error'
                  }
                />
              ))}
              {assessment.warnings.map((issue) => (
                <Alert
                  description={issue.message}
                  key={issue.code}
                  showIcon
                  title={issue.code}
                  type="warning"
                />
              ))}

              <ProCard title="评估报告">
                <ProDescriptions column={3}>
                  <ProDescriptions.Item label="源商品编码">
                    {assessment.source.itemCode}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="源库存单位">
                    {resolveDisplayUom(
                      assessment.source.stockUom,
                      assessment.source.stockUomDisplay,
                    )}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="历史库存流水">
                    {assessment.history.stockLedgerEntryCount} 条
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="实际库存">
                    {formatNumber(assessment.inventory.totalActualQty)}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="库存占用/在途">
                    {formatNumber(assessment.inventory.totalCommittedQty)}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="未完订单">
                    销售 {assessment.openTransactions.salesOrderCount} / 采购{' '}
                    {assessment.openTransactions.purchaseOrderCount}
                  </ProDescriptions.Item>
                </ProDescriptions>
                <Table
                  columns={[
                    { dataIndex: 'warehouse', title: '仓库' },
                    { dataIndex: 'company', title: '公司' },
                    {
                      align: 'right' as const,
                      dataIndex: 'actualQty',
                      render: formatNumber,
                      title: '实际库存',
                    },
                    {
                      align: 'right' as const,
                      dataIndex: 'committedQty',
                      render: formatNumber,
                      title: '占用/在途',
                    },
                    {
                      align: 'right' as const,
                      dataIndex: 'projectedQty',
                      render: formatNumber,
                      title: '预计库存',
                    },
                  ]}
                  dataSource={assessment.inventory.bins}
                  locale={{ emptyText: '没有 Bin 库存记录' }}
                  pagination={false}
                  rowKey="warehouse"
                  size="small"
                />
              </ProCard>

              <ProCard title="处理策略">
                <Form.Item
                  extra={
                    strategy === 'in_place'
                      ? assessment.strategies.inPlace.reason
                      : assessment.strategies.replacement.reason
                  }
                  label="纠正方式"
                  name="strategy"
                  rules={[{ required: true, message: '请选择纠正方式' }]}
                >
                  <Select
                    options={[
                      {
                        disabled: !assessment.strategies.inPlace.available,
                        label: '保留原商品编码（推荐用于低风险录入错误）',
                        value: 'in_place',
                      },
                      {
                        disabled: !assessment.strategies.replacement.available,
                        label: '创建继任商品并停用源商品',
                        value: 'replacement',
                      },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  label="纠正原因"
                  name="correctionReason"
                  rules={[{ required: true, message: '请填写纠正原因' }]}
                >
                  <Input.TextArea
                    autoSize={{ maxRows: 3, minRows: 2 }}
                    placeholder="例如：建档时误选科学计量单位，实际应按瓶管理"
                  />
                </Form.Item>
              </ProCard>

              <ProCard title="商品与正确单位">
                <Alert
                  description="下方已经载入当前单位、换算和默认单位。没有问题的内容保持不变，只修改确认错误的部分；保存前系统仍会重新校验库存、历史和价格条码引用。"
                  showIcon
                  title="从当前配置开始纠正"
                  type="info"
                />
                <ProDescriptions
                  bordered
                  column={2}
                  size="small"
                  style={{ marginTop: 12, marginBottom: 16 }}
                  title="当前单位配置"
                >
                  <ProDescriptions.Item label="库存基准单位">
                    {resolveDisplayUom(
                      assessment.source.stockUom,
                      assessment.source.stockUomDisplay,
                    )}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="批发默认单位">
                    {assessment.source.wholesaleDefaultUom
                      ? resolveDisplayUom(assessment.source.wholesaleDefaultUom)
                      : '-'}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="零售默认单位">
                    {assessment.source.retailDefaultUom
                      ? resolveDisplayUom(assessment.source.retailDefaultUom)
                      : '-'}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="当前换算">
                    {assessment.source.uomConversions
                      .map(
                        (row) =>
                          `1 ${resolveDisplayUom(row.uom)} = ${formatNumber(
                            row.conversionFactor,
                          )} ${resolveDisplayUom(assessment.source.stockUom)}`,
                      )
                      .join('；') || '-'}
                  </ProDescriptions.Item>
                </ProDescriptions>
                {strategy === 'replacement' ? (
                  <Space size={16} style={{ width: '100%' }}>
                    <Form.Item
                      extra="系统已按现有商品编码规则给出建议；可修改，也可留空由后端执行时生成。"
                      label="新商品编码（建议值）"
                      name="newItemCode"
                      style={{ flex: 1 }}
                    >
                      <Input
                        addonAfter={
                          <Button
                            disabled={!assessment.suggestedNewItemCode}
                            onClick={() =>
                              form.setFieldValue(
                                'newItemCode',
                                assessment.suggestedNewItemCode,
                              )
                            }
                            size="small"
                            type="link"
                          >
                            使用建议
                          </Button>
                        }
                        placeholder="留空由系统自动生成"
                      />
                    </Form.Item>
                    <Form.Item
                      label="新商品名称"
                      name="itemName"
                      rules={[{ required: true, message: '请输入新商品名称' }]}
                      style={{ flex: 1 }}
                    >
                      <Input />
                    </Form.Item>
                  </Space>
                ) : null}
                <ProductUomFields
                  form={form as unknown as FormInstance<SaveProductPayload>}
                />
              </ProCard>

              {requiresInventoryConversion ? (
                <ProCard title="现有库存转换（正式 Repack）">
                  <Alert
                    description={`旧单位本身不可信，系统不会自动推算数量。请按实际盘点结果，逐仓填写继任商品应入账的“${resolveDisplayUom(String(targetStockUom || ''))}”数量。执行时会先创建继任商品，再用正式 Repack 同时扣减旧商品并增加新商品；任一步失败都会整体回滚。`}
                    showIcon
                    title="必须人工确认旧库存对应的新库存数量"
                    type="warning"
                  />
                  <Table
                    columns={[
                      { dataIndex: 'warehouse', title: '仓库' },
                      { dataIndex: 'company', title: '公司' },
                      {
                        align: 'right' as const,
                        dataIndex: 'actualQty',
                        render: (value) =>
                          `${formatNumber(value)} ${resolveDisplayUom(
                            assessment.source.stockUom,
                            assessment.source.stockUomDisplay,
                          )}`,
                        title: '待转出旧库存',
                      },
                      {
                        render: (_value, row, index) => (
                          <>
                            <Form.Item
                              hidden
                              name={['inventoryMappings', index, 'warehouse']}
                            >
                              <Input />
                            </Form.Item>
                            <Form.Item
                              hidden
                              name={['inventoryMappings', index, 'sourceQty']}
                            >
                              <InputNumber />
                            </Form.Item>
                            <Form.Item
                              extra={`按新的库存基准单位 ${resolveDisplayUom(
                                String(targetStockUom || ''),
                              )} 填写，不按旧抽象单位自动换算`}
                              name={['inventoryMappings', index, 'targetQty']}
                              rules={[
                                {
                                  required: true,
                                  message: `请确认仓库 ${row.warehouse} 的新库存数量`,
                                },
                                {
                                  validator: async (_, value) => {
                                    if (Number(value ?? 0) <= 0) {
                                      throw new Error('新库存数量必须大于 0');
                                    }
                                  },
                                },
                              ]}
                              style={{ marginBottom: 0 }}
                            >
                              <InputNumber
                                aria-label={`仓库 ${row.warehouse} 的继任商品数量`}
                                min={0.000001}
                                precision={6}
                                style={{ width: 220 }}
                              />
                            </Form.Item>
                          </>
                        ),
                        title: `继任商品入账数量（${resolveDisplayUom(
                          String(targetStockUom || ''),
                        )}）`,
                      },
                    ]}
                    dataSource={positiveInventoryBins}
                    pagination={false}
                    rowKey="warehouse"
                    size="small"
                    style={{ marginTop: 16 }}
                  />
                </ProCard>
              ) : null}

              <ProCard title="价格单位人工映射">
                <Alert
                  description={
                    strategy === 'in_place'
                      ? '当前价格和原单位已经带入，但处理动作仍需逐条选择。你可以保持金额、修改单位或金额；“终止旧价格”会设置失效日期并保留审计，不会物理删除记录。'
                      : '当前价格和建议目标单位已经带入，但是否迁移仍需逐条选择。“不迁移”只是不复制到继任商品，旧价格仍保留在停用源商品上。'
                  }
                  showIcon
                  title="逐条确认价格处理结果"
                  type="info"
                />
                <Table<ProductUomMigrationPrice>
                  columns={[
                    {
                      dataIndex: 'priceList',
                      render: (value) => <PriceListName code={value} />,
                      title: '价格表',
                      width: 120,
                    },
                    {
                      dataIndex: 'uom',
                      render: (value) => resolveDisplayUom(value),
                      title: '旧单位',
                    },
                    { dataIndex: 'currency', title: '币种' },
                    {
                      align: 'right' as const,
                      dataIndex: 'rate',
                      render: (value) => formatCurrencyValue(value),
                      title: '原金额',
                    },
                    {
                      title: '处理方式',
                      render: (_value, _row, index) => (
                        <>
                          <Form.Item
                            hidden
                            name={['priceMappings', index, 'sourceName']}
                          >
                            <Input />
                          </Form.Item>
                          <Form.Item
                            name={['priceMappings', index, 'action']}
                            rules={[
                              { required: true, message: '请选择处理方式' },
                            ]}
                            style={{ marginBottom: 0 }}
                          >
                            <Select
                              options={[
                                {
                                  label:
                                    strategy === 'in_place'
                                      ? '保持金额并确认单位'
                                      : '迁移并保持原金额',
                                  value: 'copy',
                                },
                                {
                                  label:
                                    strategy === 'in_place'
                                      ? '修改单位或金额'
                                      : '迁移并重新定价',
                                  value: 'manual',
                                },
                                {
                                  label:
                                    strategy === 'in_place'
                                      ? '终止这条旧价格'
                                      : '不迁移（保留在源商品）',
                                  value: 'skip',
                                },
                              ]}
                              placeholder="必须选择"
                              style={{ width: 160 }}
                            />
                          </Form.Item>
                        </>
                      ),
                    },
                    {
                      title: '新单位',
                      render: (_value, _row, index) => (
                        <Form.Item
                          name={['priceMappings', index, 'targetUom']}
                          rules={[
                            {
                              validator: async (_, value) => {
                                if (
                                  ['copy', 'manual'].includes(
                                    String(priceMappings[index]?.action || ''),
                                  ) &&
                                  !value
                                ) {
                                  throw new Error('创建价格时必须选择新单位');
                                }
                              },
                            },
                          ]}
                          style={{ marginBottom: 0 }}
                        >
                          <Select
                            allowClear
                            disabled={
                              !['copy', 'manual'].includes(
                                String(priceMappings[index]?.action || ''),
                              )
                            }
                            options={uomOptions}
                            placeholder="从新换算表选择"
                            style={{ width: 180 }}
                          />
                        </Form.Item>
                      ),
                    },
                    {
                      title: '新金额',
                      render: (_value, row, index) => (
                        <Form.Item
                          name={['priceMappings', index, 'targetRate']}
                          rules={[
                            {
                              validator: async (_, value) => {
                                if (
                                  priceMappings[index]?.action === 'manual' &&
                                  (value === undefined || value === null)
                                ) {
                                  throw new Error('请输入手工新价格');
                                }
                                if (value !== undefined && Number(value) < 0) {
                                  throw new Error('价格不能为负数');
                                }
                              },
                            },
                          ]}
                          style={{ marginBottom: 0 }}
                        >
                          <InputNumber
                            disabled={priceMappings[index]?.action !== 'manual'}
                            min={0}
                            placeholder={
                              priceMappings[index]?.action === 'copy'
                                ? formatNumber(row.rate)
                                : '输入新金额'
                            }
                            precision={6}
                            style={{ width: 140 }}
                          />
                        </Form.Item>
                      ),
                    },
                  ]}
                  dataSource={assessment.prices}
                  locale={{ emptyText: '源商品没有价格记录' }}
                  pagination={false}
                  rowKey="name"
                  size="small"
                />
                <Form.List name="newPrices">
                  {(fields, { add, remove }) => (
                    <Space
                      orientation="vertical"
                      size={8}
                      style={{ marginTop: 16, width: '100%' }}
                    >
                      <Typography.Text strong>
                        新增独立价格（不依赖旧记录）
                      </Typography.Text>
                      {fields.map((field) => (
                        <Space align="start" key={field.key} wrap>
                          <Form.Item
                            label={field.name === 0 ? '价格表' : undefined}
                            name={[field.name, 'priceList']}
                            rules={[
                              { required: true, message: '请选择价格表' },
                            ]}
                            style={{ marginBottom: 0, width: 200 }}
                          >
                            <AutoComplete
                              options={priceListOptions}
                              placeholder="选择或输入价格表"
                            />
                          </Form.Item>
                          <Form.Item
                            label={field.name === 0 ? '币种' : undefined}
                            name={[field.name, 'currency']}
                            rules={[{ required: true, message: '请输入币种' }]}
                            style={{ marginBottom: 0, width: 120 }}
                          >
                            <Input placeholder="CNY" />
                          </Form.Item>
                          <Form.Item
                            label={field.name === 0 ? '单位' : undefined}
                            name={[field.name, 'targetUom']}
                            rules={[{ required: true, message: '请选择单位' }]}
                            style={{ marginBottom: 0, width: 180 }}
                          >
                            <Select
                              options={uomOptions}
                              placeholder="选择单位"
                            />
                          </Form.Item>
                          <Form.Item
                            label={field.name === 0 ? '金额' : undefined}
                            name={[field.name, 'rate']}
                            rules={[
                              { required: true, message: '请输入金额' },
                              {
                                validator: async (_, value) => {
                                  if (
                                    value !== undefined &&
                                    Number(value) < 0
                                  ) {
                                    throw new Error('价格不能为负数');
                                  }
                                },
                              },
                            ]}
                            style={{ marginBottom: 0, width: 160 }}
                          >
                            <InputNumber
                              min={0}
                              precision={6}
                              style={{ width: '100%' }}
                            />
                          </Form.Item>
                          <Button
                            danger
                            onClick={() => remove(field.name)}
                            style={{ marginTop: field.name === 0 ? 30 : 0 }}
                            type="link"
                          >
                            删除
                          </Button>
                        </Space>
                      ))}
                      <Button
                        block
                        onClick={() =>
                          add({ currency: 'CNY', priceList: 'Retail' })
                        }
                        type="dashed"
                      >
                        ＋ 新增价格行
                      </Button>
                    </Space>
                  )}
                </Form.List>
              </ProCard>

              <ProCard title="条码单位人工映射">
                <Alert
                  description={
                    strategy === 'in_place'
                      ? '改绑会更新原商品条码的对应单位；如果旧单位不在新换算表中，则不能保留旧单位。'
                      : '迁移会从源商品移除条码并原子地绑定到继任商品；保留则条码继续指向停用的源商品。'
                  }
                  showIcon
                  title="现有条码数据已带入，但处理动作仍需逐条确认"
                  type="info"
                />
                <Table
                  columns={[
                    { dataIndex: 'barcode', title: '条码' },
                    {
                      dataIndex: 'uom',
                      render: (value) => resolveDisplayUom(value),
                      title: '旧单位',
                    },
                    {
                      dataIndex: 'isPrimary',
                      render: (value) =>
                        value ? <Tag color="green">主条码</Tag> : '-',
                      title: '主条码',
                    },
                    {
                      title: '处理方式',
                      render: (_value, _row, index) => (
                        <>
                          <Form.Item
                            hidden
                            name={['barcodeMappings', index, 'sourceName']}
                          >
                            <Input />
                          </Form.Item>
                          <Form.Item
                            name={['barcodeMappings', index, 'action']}
                            rules={[
                              { required: true, message: '请选择处理方式' },
                            ]}
                            style={{ marginBottom: 0 }}
                          >
                            <Select
                              options={[
                                {
                                  label:
                                    strategy === 'in_place'
                                      ? '改绑到新单位'
                                      : '迁移到继任商品',
                                  value: 'move',
                                },
                                {
                                  label:
                                    strategy === 'in_place'
                                      ? '保留原单位'
                                      : '保留在源商品',
                                  value: 'keep',
                                },
                              ]}
                              placeholder="必须选择"
                              style={{ width: 170 }}
                            />
                          </Form.Item>
                        </>
                      ),
                    },
                    {
                      title: '新单位',
                      render: (_value, _row, index) => (
                        <Form.Item
                          name={['barcodeMappings', index, 'targetUom']}
                          rules={[
                            {
                              validator: async (_, value) => {
                                if (
                                  barcodeMappings[index]?.action === 'move' &&
                                  !value
                                ) {
                                  throw new Error('迁移条码时必须选择新单位');
                                }
                              },
                            },
                          ]}
                          style={{ marginBottom: 0 }}
                        >
                          <Select
                            allowClear
                            disabled={barcodeMappings[index]?.action !== 'move'}
                            options={uomOptions}
                            placeholder="从新换算表选择"
                            style={{ width: 180 }}
                          />
                        </Form.Item>
                      ),
                    },
                  ]}
                  dataSource={assessment.barcodes}
                  locale={{ emptyText: '源商品没有条码记录' }}
                  pagination={false}
                  rowKey={(row) => row.name || row.barcode}
                  size="small"
                />
              </ProCard>

              <ProCard title="最终确认">
                <Typography.Paragraph type="danger">
                  {strategy === 'in_place'
                    ? '执行成功后会保留原商品编码并更新当前主数据。该操作不会修改历史单据或历史库存流水。'
                    : '执行成功后，源商品会立即停用；新交易应改用继任商品。该操作不会修改历史单据、历史库存流水或历史价格记录。'}
                </Typography.Paragraph>
                {strategy === 'replacement' ? (
                  <>
                    {requiresInventoryConversion ? (
                      <Form.Item
                        name="confirmInventoryConversion"
                        rules={[
                          {
                            validator: async (_, value) => {
                              if (!value) {
                                throw new Error('请确认逐仓库存转换数量');
                              }
                            },
                          },
                        ]}
                        valuePropName="checked"
                      >
                        <Checkbox>
                          我确认上述逐仓数量来自实际盘点，并同意通过正式 Repack
                          将旧库存全部转入继任商品
                        </Checkbox>
                      </Form.Item>
                    ) : null}
                    <Form.Item
                      name="confirmDisableSource"
                      rules={[
                        {
                          validator: async (_, value) => {
                            if (!value) throw new Error('请确认停用源商品');
                          },
                        },
                      ]}
                      valuePropName="checked"
                    >
                      <Checkbox>我确认迁移成功后停用源商品</Checkbox>
                    </Form.Item>
                  </>
                ) : (
                  <Form.Item
                    name="confirmInPlaceCorrection"
                    rules={[
                      {
                        validator: async (_, value) => {
                          if (!value) throw new Error('请确认保留原商品编码');
                        },
                      },
                    ]}
                    valuePropName="checked"
                  >
                    <Checkbox>
                      我确认保留原商品编码，并按上述配置纠正当前主数据
                    </Checkbox>
                  </Form.Item>
                )}
                <Form.Item
                  name="confirmHistoryPreserved"
                  rules={[
                    {
                      validator: async (_, value) => {
                        if (!value) throw new Error('请确认保留历史账本');
                      },
                    },
                  ]}
                  valuePropName="checked"
                >
                  <Checkbox>
                    我确认历史库存流水继续保留在源商品下，不要求重写历史
                  </Checkbox>
                </Form.Item>
              </ProCard>

              {!canProceed ? (
                <Alert
                  description={assessment.blockers
                    .map((issue) => issue.message)
                    .join('；')}
                  showIcon
                  title="当前仍有不能在本向导中解除的阻断项"
                  type="error"
                />
              ) : null}
              <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
                <Button onClick={onClose}>取消</Button>
                <Button
                  danger={strategy === 'replacement'}
                  disabled={!canProceed}
                  loading={submitting}
                  onClick={() => form.submit()}
                  type="primary"
                >
                  {requiresInventoryConversion
                    ? '预览库存转换与纠正'
                    : '预览并确认纠正'}
                </Button>
              </Space>
            </Space>
          </Form>
        ) : null}
      </Modal>
      <Modal
        cancelText="返回修改"
        confirmLoading={submitting}
        okButtonProps={{ danger: previewValues?.strategy === 'replacement' }}
        okText={
          previewValues?.strategy === 'in_place'
            ? '确认原地纠正'
            : '确认创建继任商品'
        }
        onCancel={() => setPreviewValues(undefined)}
        onOk={() =>
          previewValues ? void executeMigration(previewValues) : undefined
        }
        open={Boolean(previewValues)}
        title="确认商品单位纠正计划"
        width={900}
      >
        {assessment && previewValues ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              description={
                previewValues.strategy === 'in_place'
                  ? '确认后会保留原商品编码，修正单位、价格和条码；历史账本仍保持原记录。'
                  : previewValues.inventoryMappings.length
                    ? '确认后会创建继任商品，通过正式 Repack 按下列逐仓数量转移库存，再创建价格、处理条码并停用源商品；任一步失败都会整体回滚。'
                    : '确认后会创建继任商品、创建下列价格、处理条码并停用源商品；历史账本仍保留在源商品下。'
              }
              showIcon
              title="请核对最终变更"
              type="warning"
            />
            <ProDescriptions column={2} bordered size="small">
              <ProDescriptions.Item label="源商品">
                {assessment.source.itemCode}
              </ProDescriptions.Item>
              <ProDescriptions.Item label="处理策略">
                {previewValues.strategy === 'in_place'
                  ? '保留原商品编码并受控纠正'
                  : '创建继任商品并停用源商品'}
              </ProDescriptions.Item>
              {previewValues.strategy === 'replacement' ? (
                <>
                  <ProDescriptions.Item label="新商品编码">
                    {previewValues.newItemCode?.trim() || '执行时自动生成'}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="新商品名称">
                    {previewValues.itemName}
                  </ProDescriptions.Item>
                </>
              ) : null}
              <ProDescriptions.Item label="纠正原因" span={2}>
                {previewValues.correctionReason}
              </ProDescriptions.Item>
              <ProDescriptions.Item label="库存基准单位">
                {resolveDisplayUom(String(previewValues.stockUom || ''))}
              </ProDescriptions.Item>
              <ProDescriptions.Item label="批发默认单位">
                {previewValues.wholesaleDefaultUom
                  ? resolveDisplayUom(previewValues.wholesaleDefaultUom)
                  : '-'}
              </ProDescriptions.Item>
              <ProDescriptions.Item label="零售默认单位">
                {previewValues.retailDefaultUom
                  ? resolveDisplayUom(previewValues.retailDefaultUom)
                  : '-'}
              </ProDescriptions.Item>
              <ProDescriptions.Item label="单位换算" span={2}>
                {(previewValues.uomConversions ?? [])
                  .map(
                    (row) =>
                      `1 ${resolveDisplayUom(String(row.uom || ''))} = ${formatNumber(
                        row.conversionFactor,
                      )} ${resolveDisplayUom(String(previewValues.stockUom || ''))}`,
                  )
                  .join('；') || '-'}
              </ProDescriptions.Item>
              {previewValues.inventoryMappings.length ? (
                <ProDescriptions.Item label="库存转换" span={2}>
                  {previewValues.inventoryMappings.length} 个仓库将通过正式
                  Repack 转移；旧商品库存必须全部归零后才会停用
                </ProDescriptions.Item>
              ) : null}
              <ProDescriptions.Item label="条码处理" span={2}>
                {previewValues.barcodeMappings.length
                  ? `${previewValues.strategy === 'in_place' ? '改绑' : '迁移'} ${previewValues.barcodeMappings.filter((row) => row.action === 'move').length} 条，保留 ${previewValues.barcodeMappings.filter((row) => row.action === 'keep').length} 条`
                  : '源商品没有条码，无需处理'}
              </ProDescriptions.Item>
              <ProDescriptions.Item
                label={
                  previewValues.strategy === 'in_place'
                    ? '本次终止旧价格'
                    : '不迁移的源价格'
                }
                span={2}
              >
                {
                  previewValues.priceMappings.filter(
                    (row) => row.action === 'skip',
                  ).length
                }{' '}
                条
              </ProDescriptions.Item>
            </ProDescriptions>
            {previewValues.inventoryMappings.length ? (
              <Table
                columns={[
                  { dataIndex: 'warehouse', title: '仓库' },
                  {
                    align: 'right' as const,
                    dataIndex: 'sourceQty',
                    render: (value) =>
                      `${formatNumber(value)} ${resolveDisplayUom(
                        assessment.source.stockUom,
                        assessment.source.stockUomDisplay,
                      )}`,
                    title: '转出旧库存',
                  },
                  {
                    align: 'right' as const,
                    dataIndex: 'targetQty',
                    render: (value) =>
                      `${formatNumber(value)} ${resolveDisplayUom(
                        String(previewValues.stockUom || ''),
                      )}`,
                    title: '转入继任商品',
                  },
                ]}
                dataSource={previewValues.inventoryMappings}
                pagination={false}
                rowKey="warehouse"
                size="small"
              />
            ) : null}
            <Table
              columns={[
                {
                  dataIndex: 'priceList',
                  render: (value) => <PriceListName code={value} />,
                  title: '价格表',
                  width: 120,
                },
                { dataIndex: 'currency', title: '币种' },
                {
                  dataIndex: 'uom',
                  render: (value) => resolveDisplayUom(value),
                  title: '单位',
                },
                {
                  align: 'right' as const,
                  dataIndex: 'rate',
                  render: (value) => formatCurrencyValue(value),
                  title: '金额',
                },
                { dataIndex: 'source', title: '来源' },
              ]}
              dataSource={previewPrices}
              locale={{ emptyText: '本次不会创建价格' }}
              pagination={false}
              rowKey="key"
              size="small"
            />
          </Space>
        ) : null}
      </Modal>
    </>
  );
}
