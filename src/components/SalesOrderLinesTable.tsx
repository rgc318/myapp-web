import {
  Button,
  Image,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Table,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React from 'react';
import { RemoteLinkSelect } from '@/components/RemoteLinkSelect';
import { formatCurrencyValue } from '@/utils/myapp-display';
import {
  convertQtyToStockQty,
  formatQty,
  getOrderLinesTotal,
  recalculateSalesOrderLine,
  resolveUomDisplay,
  type SalesMode,
  type SalesOrderEditorLine,
} from '@/utils/sales-order-editor';

export function SalesOrderLinesTable({
  company,
  lines,
  onChange,
}: {
  company?: string;
  lines: SalesOrderEditorLine[];
  onChange: (lines: SalesOrderEditorLine[]) => void;
}) {
  const updateLine = (key: string, patch: Partial<SalesOrderEditorLine>) => {
    onChange(
      lines.map((line) =>
        line.key === key
          ? recalculateSalesOrderLine({ ...line, ...patch })
          : line,
      ),
    );
  };
  const totalQty = lines.reduce((sum, line) => sum + Number(line.qty || 0), 0);
  const totalAmount = getOrderLinesTotal(lines);

  const columns: ColumnsType<SalesOrderEditorLine> = [
    {
      dataIndex: 'itemName',
      title: '商品',
      width: 320,
      render: (_, record) => (
        <Space align="start" size={12}>
          {record.imageUrl ? (
            <Image
              alt={record.itemName || record.itemCode}
              height={48}
              preview={false}
              src={record.imageUrl}
              style={{ objectFit: 'cover' }}
              width={48}
            />
          ) : (
            <div
              style={{
                alignItems: 'center',
                background: '#f5f5f5',
                border: '1px solid #f0f0f0',
                color: 'rgba(0, 0, 0, 0.45)',
                display: 'flex',
                height: 48,
                justifyContent: 'center',
                width: 48,
              }}
            >
              无图
            </div>
          )}
          <Space orientation="vertical" size={0}>
            <Typography.Text strong>{record.itemName}</Typography.Text>
            <Typography.Text type="secondary">
              {record.itemCode}
            </Typography.Text>
            {record.specification ? (
              <Typography.Text type="secondary">
                {record.specification}
              </Typography.Text>
            ) : null}
          </Space>
        </Space>
      ),
    },
    {
      dataIndex: 'salesMode',
      title: '模式',
      width: 120,
      render: (_, record) => (
        <Select
          options={[
            { label: '批发', value: 'wholesale' },
            { label: '零售', value: 'retail' },
          ]}
          onChange={(nextMode: SalesMode) => {
            updateLine(record.key, {
              price: record.modeDefaults[nextMode]?.price ?? record.price,
              salesMode: nextMode,
              uom: record.modeDefaults[nextMode]?.uom || record.uom,
            });
          }}
          value={record.salesMode}
        />
      ),
    },
    {
      dataIndex: 'qty',
      title: '数量',
      width: 130,
      render: (_, record) => (
        <InputNumber
          min={0.001}
          onChange={(nextValue) => {
            updateLine(record.key, { qty: Number(nextValue ?? 0) });
          }}
          step={1}
          style={{ width: '100%' }}
          value={record.qty}
        />
      ),
    },
    {
      dataIndex: 'uom',
      title: '单位',
      width: 140,
      render: (_, record) => (
        <Select
          options={record.allUoms.map((uom) => ({
            label: resolveUomDisplay(uom, record.allUomDisplays),
            value: uom,
          }))}
          onChange={(uom) => updateLine(record.key, { uom })}
          value={record.uom ?? undefined}
        />
      ),
    },
    {
      dataIndex: 'price',
      title: '单价',
      width: 140,
      render: (_, record) => (
        <InputNumber
          min={0}
          onChange={(nextValue) => {
            updateLine(record.key, { price: Number(nextValue ?? 0) });
          }}
          precision={2}
          prefix="¥"
          style={{ width: '100%' }}
          value={record.price ?? undefined}
        />
      ),
    },
    {
      dataIndex: 'warehouse',
      title: '仓库',
      width: 180,
      render: (_, record) => (
        <RemoteLinkSelect
          doctype="Warehouse"
          extraFields={['company']}
          filters={{ company, disabled: 0, is_group: 0 }}
          onChange={(nextWarehouse) => {
            updateLine(record.key, { warehouse: nextWarehouse });
          }}
          placeholder="选择仓库"
          value={record.warehouse}
        />
      ),
    },
    {
      dataIndex: 'stockQty',
      title: '库存参考',
      width: 170,
      render: (_, record) => {
        const stockQty = convertQtyToStockQty({
          qty: record.qty,
          stockUom: record.stockUom,
          uom: record.uom,
          uomConversions: record.uomConversions,
        });
        const stockUomDisplay = resolveUomDisplay(
          record.stockUom,
          record.allUomDisplays,
          record.stockUomDisplay,
        );
        return (
          <div
            style={{
              background: '#fafafa',
              borderRadius: 6,
              padding: '6px 8px',
            }}
          >
            <Space size={6}>
              <Typography.Text type="secondary">可用</Typography.Text>
              <Typography.Text strong style={{ color: '#1677ff' }}>
                {formatQty(record.stockQty)} {stockUomDisplay}
              </Typography.Text>
            </Space>
            <br />
            <Space size={6}>
              <Typography.Text type="secondary">本单</Typography.Text>
              <Typography.Text style={{ color: '#8c8c8c' }}>
                {formatQty(stockQty)} {stockUomDisplay}
              </Typography.Text>
            </Space>
          </div>
        );
      },
    },
    {
      align: 'right',
      dataIndex: 'amount',
      title: '金额',
      width: 150,
      render: (_, record) => (
        <Typography.Text strong style={{ color: '#f5222d', fontSize: 17 }}>
          {formatCurrencyValue(record.amount)}
        </Typography.Text>
      ),
    },
    {
      title: '操作',
      width: 90,
      render: (_, record) => (
        <Popconfirm
          title="移除该商品？"
          onConfirm={() => {
            onChange(lines.filter((line) => line.key !== record.key));
          }}
        >
          <Button danger type="link">
            移除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Table<SalesOrderEditorLine>
      columns={columns}
      dataSource={lines}
      pagination={false}
      rowKey="key"
      scroll={{ x: 1380 }}
      summary={() => (
        <Table.Summary.Row>
          <Table.Summary.Cell colSpan={2} index={0}>
            <Typography.Text strong>合计</Typography.Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={1}>
            <Typography.Text strong style={{ color: '#1677ff', fontSize: 16 }}>
              {formatQty(totalQty)}
            </Typography.Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell colSpan={4} index={2} />
          <Table.Summary.Cell align="right" index={3}>
            <Typography.Text strong style={{ color: '#f5222d', fontSize: 18 }}>
              {formatCurrencyValue(totalAmount)}
            </Typography.Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={4} />
        </Table.Summary.Row>
      )}
    />
  );
}
