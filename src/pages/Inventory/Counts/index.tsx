import { PageContainer, ProCard, ProTable } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  message,
  Popconfirm,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import { ProductSelect, RemoteLinkSelect } from '@/components';
import { useWorkspacePreferences } from '@/hooks/useWorkspacePreferences';
import {
  type InventoryStockCountResult,
  submitInventoryStockCount,
} from '@/services/myapp/inventory';
import type { ProductSummary } from '@/services/myapp/master-data';
import { resolveDisplayUom } from '@/utils/myapp-display';

type FormValues = {
  company?: string;
  postingDate: dayjs.Dayjs;
  remarks?: string;
  warehouse?: string;
};

type CountLine = {
  countedQty: number;
  currentQty: number;
  itemCode: string;
  itemName: string;
  key: string;
  stockUom: string;
  stockUomDisplay?: string | null;
  uom: string;
  uomDisplays: Record<string, string>;
  uoms: string[];
  valuationRate?: number | null;
  warehouse: string;
};

function formatQty(value: number | null | undefined) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function buildLineKey(itemCode: string, warehouse: string) {
  return `${itemCode}::${warehouse}`;
}

const InventoryCountsPage: React.FC = () => {
  const [form] = Form.useForm<FormValues>();
  const { defaultCompany, defaultWarehouse } = useWorkspacePreferences();
  const [lines, setLines] = useState<CountLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<InventoryStockCountResult | null>(null);
  const company = Form.useWatch('company', form) || defaultCompany;
  const warehouse = Form.useWatch('warehouse', form) || defaultWarehouse;

  React.useEffect(() => {
    form.setFieldsValue({
      company: form.getFieldValue('company') || defaultCompany,
      postingDate: form.getFieldValue('postingDate') || dayjs(),
      warehouse: form.getFieldValue('warehouse') || defaultWarehouse,
    });
  }, [defaultCompany, defaultWarehouse, form]);

  const differenceLines = useMemo(
    () =>
      result?.rows.filter((row) => row.hasDifference || row.qtyDelta !== 0) ??
      [],
    [result],
  );

  const handleProductSelect = (product: ProductSummary) => {
    const resolvedWarehouse = warehouse;
    if (!resolvedWarehouse) {
      message.error('请先选择仓库');
      return;
    }
    const key = buildLineKey(product.itemCode, resolvedWarehouse);
    if (lines.some((line) => line.key === key)) {
      message.warning('该商品和仓库已在盘点明细中');
      return;
    }
    const stockUom = product.stockUom || product.uom || '';
    const stockUomDisplay = resolveDisplayUom(
      stockUom,
      product.stockUomDisplay ?? product.uomDisplay,
    );
    setLines((current) => [
      ...current,
      {
        countedQty:
          product.warehouseStockQty ??
          product.stockQty ??
          product.totalQty ??
          0,
        currentQty:
          product.warehouseStockQty ??
          product.stockQty ??
          product.totalQty ??
          0,
        itemCode: product.itemCode,
        itemName: product.itemName,
        key,
        stockUom,
        stockUomDisplay,
        uom: stockUom,
        uomDisplays: product.allUomDisplays ?? {},
        uoms: product.allUoms?.length ? product.allUoms : [stockUom],
        valuationRate:
          product.priceSummary?.valuationRate ??
          product.priceSummary?.standardBuyingRate ??
          undefined,
        warehouse: resolvedWarehouse,
      },
    ]);
    setResult(null);
  };

  const updateLine = (key: string, patch: Partial<CountLine>) => {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
    setResult(null);
  };

  const removeLine = (key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
    setResult(null);
  };

  const handleSubmit = async (values: FormValues) => {
    if (!values.company) {
      message.error('请选择公司');
      return;
    }
    if (!lines.length) {
      message.error('请先添加盘点商品');
      return;
    }
    const invalidLine = lines.find(
      (line) =>
        !line.itemCode || !line.warehouse || !line.uom || line.countedQty < 0,
    );
    if (invalidLine) {
      message.error('盘点明细存在未填写或负数数量');
      return;
    }

    setSubmitting(true);
    try {
      const response = await submitInventoryStockCount({
        company: values.company,
        items: lines.map((line) => ({
          countedQty: line.countedQty,
          itemCode: line.itemCode,
          uom: line.uom,
          valuationRate: line.valuationRate,
          warehouse: line.warehouse,
        })),
        postingDate: values.postingDate?.format('YYYY-MM-DD'),
        remarks: values.remarks,
      });
      setResult(response.data);
      if (response.data.stockReconciliation) {
        message.success(`盘点单已提交：${response.data.stockReconciliation}`);
      }
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '库存盘点失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer
      title="批量盘点"
      extra={[
        <Button key="stock" onClick={() => history.push('/inventory/stock')}>
          商品库存
        </Button>,
        <Button
          key="adjustments"
          onClick={() => history.push('/inventory/adjustments')}
        >
          单品调整
        </Button>,
        <Button
          key="transfers"
          onClick={() => history.push('/inventory/transfers')}
        >
          库存转仓
        </Button>,
        <Button key="ledger" onClick={() => history.push('/inventory/ledger')}>
          库存流水
        </Button>,
      ]}
    >
      <ProCard direction="column" gutter={16}>
        <Alert
          showIcon
          type="info"
          message="批量盘点会按明细行的实盘数量提交 ERPNext Stock Reconciliation；无差异行会保留在结果中，但不会写入正式盘点单。"
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
            <Form.Item label="备注" name="remarks" style={{ minWidth: 360 }}>
              <Input placeholder="盘点批次、原因或操作说明" />
            </Form.Item>
          </Space>
          <Form.Item label="添加商品">
            <ProductSelect
              company={company}
              itemContext="inventory"
              warehouse={warehouse}
              onSelectProduct={handleProductSelect}
            />
          </Form.Item>
          <ProTable<CountLine>
            columns={[
              {
                title: '商品编码',
                dataIndex: 'itemCode',
                width: 170,
                fixed: 'left',
              },
              {
                title: '商品名称',
                dataIndex: 'itemName',
                width: 220,
                ellipsis: true,
              },
              {
                title: '仓库',
                dataIndex: 'warehouse',
                width: 180,
                ellipsis: true,
              },
              {
                title: '当前库存',
                dataIndex: 'currentQty',
                width: 120,
                renderText: (_, record) =>
                  `${formatQty(record.currentQty)} ${record.stockUomDisplay || record.stockUom}`,
              },
              {
                title: '实盘数量',
                dataIndex: 'countedQty',
                width: 150,
                render: (_, record) => (
                  <InputNumber
                    min={0}
                    precision={2}
                    value={record.countedQty}
                    style={{ width: '100%' }}
                    onChange={(value) =>
                      updateLine(record.key, {
                        countedQty: Number(value ?? 0),
                      })
                    }
                  />
                ),
              },
              {
                title: '单位',
                dataIndex: 'uom',
                width: 150,
                render: (_, record) => (
                  <Select
                    value={record.uom}
                    style={{ width: '100%' }}
                    options={record.uoms.map((uom) => ({
                      label: resolveDisplayUom(uom, record.uomDisplays[uom]),
                      value: uom,
                    }))}
                    onChange={(value) => updateLine(record.key, { uom: value })}
                  />
                ),
              },
              {
                title: '估值价',
                dataIndex: 'valuationRate',
                width: 140,
                render: (_, record) => (
                  <InputNumber
                    min={0}
                    precision={2}
                    value={record.valuationRate ?? undefined}
                    style={{ width: '100%' }}
                    onChange={(value) =>
                      updateLine(record.key, {
                        valuationRate:
                          value === null || value === undefined
                            ? undefined
                            : Number(value),
                      })
                    }
                  />
                ),
              },
              {
                title: '操作',
                valueType: 'option',
                width: 100,
                fixed: 'right',
                render: (_, record) => [
                  <Popconfirm
                    key="delete"
                    title="移除该盘点行？"
                    onConfirm={() => removeLine(record.key)}
                  >
                    <Button danger type="link">
                      移除
                    </Button>
                  </Popconfirm>,
                ],
              },
            ]}
            dataSource={lines}
            pagination={false}
            rowKey="key"
            scroll={{ x: 1230 }}
            search={false}
            size="small"
            toolBarRender={false}
          />
          <Space style={{ marginTop: 16 }}>
            <Button loading={submitting} type="primary" htmlType="submit">
              提交盘点
            </Button>
            <Button
              onClick={() => {
                setLines([]);
                setResult(null);
              }}
            >
              清空明细
            </Button>
          </Space>
        </Form>
      </ProCard>
      {result ? (
        <ProCard
          title="盘点结果"
          extra={
            result.stockReconciliation ? (
              <Button
                onClick={() =>
                  history.push(
                    `/inventory/ledger?voucherType=${encodeURIComponent('Stock Reconciliation')}&voucherNo=${encodeURIComponent(result.stockReconciliation || '')}`,
                  )
                }
              >
                查看流水
              </Button>
            ) : null
          }
        >
          <Space size={32} style={{ marginBottom: 16 }} wrap>
            <Statistic
              title="Stock Reconciliation"
              value={result.stockReconciliation || '无差异'}
            />
            <Statistic title="差异行数" value={result.differenceCount} />
            <Typography.Text type="secondary">
              {result.company || company || '-'}
            </Typography.Text>
          </Space>
          <ProTable
            columns={[
              {
                title: '商品',
                dataIndex: 'itemCode',
                width: 180,
                render: (_, record) => (
                  <Space orientation="vertical" size={0}>
                    <Typography.Text>{record.itemCode}</Typography.Text>
                    <Typography.Text type="secondary">
                      {record.itemName}
                    </Typography.Text>
                  </Space>
                ),
              },
              {
                title: '仓库',
                dataIndex: 'warehouse',
                ellipsis: true,
              },
              {
                title: '当前库存',
                dataIndex: 'currentStockQty',
                width: 120,
                renderText: (value, record) =>
                  `${formatQty(value)} ${record.stockUom}`,
              },
              {
                title: '实盘库存',
                dataIndex: 'countedStockQty',
                width: 120,
                renderText: (value, record) =>
                  `${formatQty(value)} ${record.stockUom}`,
              },
              {
                title: '差异',
                dataIndex: 'qtyDelta',
                width: 110,
                render: (_, record) =>
                  record.qtyDelta === 0 ? (
                    <Tag>无差异</Tag>
                  ) : (
                    <Tag color={record.qtyDelta > 0 ? 'green' : 'red'}>
                      {formatQty(record.qtyDelta)}
                    </Tag>
                  ),
              },
            ]}
            dataSource={result.rows}
            pagination={false}
            rowKey={(record) => `${record.itemCode}:${record.warehouse}`}
            search={false}
            size="small"
            toolBarRender={() => [
              <Typography.Text key="summary" type="secondary">
                差异明细 {differenceLines.length} 行
              </Typography.Text>,
            ]}
          />
        </ProCard>
      ) : null}
    </PageContainer>
  );
};

export default InventoryCountsPage;
