import { ProCard, ProDescriptions } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Form,
  type FormInstance,
  Input,
  Modal,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { ProductUomFields } from '@/components/ProductUomFields';
import {
  assessProductUomMigration,
  executeProductUomMigration,
  type ProductUomMigrationAssessment,
  type ProductUomMigrationPrice,
  type SaveProductPayload,
} from '@/services/myapp/master-data';
import { formatCurrencyValue, resolveDisplayUom } from '@/utils/myapp-display';

type MigrationFormValues = SaveProductPayload & {
  barcodeMappings: {
    action?: 'move' | 'keep';
    sourceName: string;
    targetUom?: string;
  }[];
  confirmDisableSource: boolean;
  confirmHistoryPreserved: boolean;
  newItemCode: string;
  priceMappings: {
    action?: 'copy' | 'skip';
    sourceName: string;
    targetUom?: string;
  }[];
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
  const uomConversions = Form.useWatch('uomConversions', form) ?? [];
  const priceMappings = Form.useWatch('priceMappings', form) ?? [];
  const barcodeMappings = Form.useWatch('barcodeMappings', form) ?? [];
  const uomOptions = useMemo(
    () => migrationUomOptions(uomConversions),
    [uomConversions],
  );

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
        form.setFieldsValue({
          barcodeMappings: result.barcodes.map((row) => ({
            action: undefined,
            sourceName: row.name ?? '',
            targetUom: undefined,
          })),
          confirmDisableSource: false,
          confirmHistoryPreserved: false,
          itemName: result.source.itemName,
          newItemCode: '',
          priceMappings: result.prices.map((row) => ({
            action: undefined,
            sourceName: row.name,
            targetUom: undefined,
          })),
          retailDefaultUom: undefined,
          stockUom: undefined,
          uomConversions: [],
          wholesaleDefaultUom: undefined,
        });
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : '迁移评估失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [form, itemCode, open]);

  const handleSubmit = async (values: MigrationFormValues) => {
    if (!assessment) return;
    setSubmitting(true);
    try {
      const result = await executeProductUomMigration({
        barcodeMappings: values.barcodeMappings.map((mapping) => ({
          action: mapping.action as 'move' | 'keep',
          sourceName: mapping.sourceName,
          targetUom: mapping.targetUom,
        })),
        confirmDisableSource: values.confirmDisableSource,
        confirmHistoryPreserved: values.confirmHistoryPreserved,
        itemCode: assessment.source.itemCode,
        newItemCode: values.newItemCode.trim(),
        newItemName: values.itemName,
        priceMappings: values.priceMappings.map((mapping) => ({
          action: mapping.action as 'copy' | 'skip',
          sourceName: mapping.sourceName,
          targetUom: mapping.targetUom,
        })),
        retailDefaultUom: values.retailDefaultUom,
        sourceModified: assessment.source.modified,
        stockUom: String(values.stockUom || ''),
        uomConversions: values.uomConversions ?? [],
        wholesaleDefaultUom: values.wholesaleDefaultUom,
      });
      onCompleted(result.data.newItem.itemCode);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      destroyOnHidden
      footer={null}
      onCancel={onClose}
      open={open}
      title={`单位错误迁移 · ${itemCode}`}
      width={1120}
    >
      {loading ? <Skeleton active paragraph={{ rows: 10 }} /> : null}
      {error ? (
        <Alert
          action={<Button onClick={onClose}>关闭</Button>}
          description={error}
          showIcon
          title="迁移评估失败"
          type="error"
        />
      ) : null}
      {!loading && !error && !assessment ? (
        <Empty description="未读取到迁移评估结果" />
      ) : null}
      {assessment ? (
        <Form<MigrationFormValues>
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              description="系统会新建正确商品、建立 ERPNext 原生替代关系并停用源商品。历史 Stock Ledger Entry 永久保留在源商品下，不会直接覆盖 stock_uom。"
              showIcon
              title="这是主数据替代迁移，不是原地改单位"
              type="warning"
            />

            {assessment.blockers.map((issue) => (
              <Alert
                description={issue.message}
                key={issue.code}
                showIcon
                title={issue.code}
                type="error"
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

            <ProCard title="新商品与正确单位">
              <Space size={16} style={{ width: '100%' }}>
                <Form.Item
                  label="新商品编码"
                  name="newItemCode"
                  rules={[{ required: true, message: '请明确填写新商品编码' }]}
                  style={{ flex: 1 }}
                >
                  <Input placeholder="例如 COCA-COLA-5000ML-V2" />
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
              <ProductUomFields
                form={form as unknown as FormInstance<SaveProductPayload>}
              />
            </ProCard>

            <ProCard title="价格单位人工映射">
              <Alert
                description="复制会保留原价格表、币种和金额，只把该价格明确绑定到你选择的新单位；跳过则不在新商品创建该价格。"
                showIcon
                title="系统不会根据旧单位自动换算或猜测价格"
                type="info"
              />
              <Table<ProductUomMigrationPrice>
                columns={[
                  { dataIndex: 'priceList', title: '价格表' },
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
                              { label: '复制到新商品', value: 'copy' },
                              { label: '跳过此价格', value: 'skip' },
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
                                priceMappings[index]?.action === 'copy' &&
                                !value
                              ) {
                                throw new Error('复制价格时必须选择新单位');
                              }
                            },
                          },
                        ]}
                        style={{ marginBottom: 0 }}
                      >
                        <Select
                          allowClear
                          disabled={priceMappings[index]?.action !== 'copy'}
                          options={uomOptions}
                          placeholder="从新换算表选择"
                          style={{ width: 180 }}
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
            </ProCard>

            <ProCard title="条码单位人工映射">
              <Alert
                description="迁移会从源商品移除条码并原子地绑定到新商品；保留则条码继续指向停用的源商品。"
                showIcon
                title="每条条码必须明确选择"
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
                              { label: '迁移到新商品', value: 'move' },
                              { label: '保留在源商品', value: 'keep' },
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
                执行成功后，源商品会立即停用；新交易应改用新商品。该操作不会修改历史单据、历史库存流水或历史价格记录。
              </Typography.Paragraph>
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

            <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
              <Button onClick={onClose}>取消</Button>
              <Button
                danger
                disabled={!assessment.canExecute}
                loading={submitting}
                onClick={() => form.submit()}
                type="primary"
              >
                创建替代商品并停用源商品
              </Button>
            </Space>
          </Space>
        </Form>
      ) : null}
    </Modal>
  );
}
