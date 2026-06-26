import {
  Button,
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
import type { PurchaseOrderEditorLine } from '@/utils/purchase-order-editor';
import {
  getPurchaseOrderLinesTotal,
  recalculatePurchaseOrderLine,
} from '@/utils/purchase-order-editor';
import {
  convertQtyToStockQty,
  formatQty,
  resolveUomDisplay,
} from '@/utils/sales-order-editor';

export function PurchaseOrderLinesTable({
  company,
  lines,
  onChange,
}: {
  company?: string;
  lines: PurchaseOrderEditorLine[];
  onChange: (lines: PurchaseOrderEditorLine[]) => void;
}) {
  const updateLine = (key: string, patch: Partial<PurchaseOrderEditorLine>) => {
    onChange(
      lines.map((line) =>
        line.key === key
          ? recalculatePurchaseOrderLine({ ...line, ...patch })
          : line,
      ),
    );
  };

  const addWarehouseLine = (record: PurchaseOrderEditorLine) => {
    onChange([
      ...lines,
      recalculatePurchaseOrderLine({
        ...record,
        key: `${record.itemCode}:warehouse:${Date.now()}`,
        qty: 1,
        warehouse: '',
      }),
    ]);
  };

  const columns: ColumnsType<PurchaseOrderEditorLine> = [
    {
      dataIndex: 'itemName',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.itemName}</Typography.Text>
          <Typography.Text type="secondary">{record.itemCode}</Typography.Text>
          {record.specification ? (
            <Typography.Text type="secondary">
              {record.specification}
            </Typography.Text>
          ) : null}
        </Space>
      ),
      title: '商品',
      width: 260,
    },
    {
      dataIndex: 'qty',
      render: (_, record) => (
        <InputNumber
          min={0.001}
          onChange={(nextValue) => {
            updateLine(record.key, { qty: Number(nextValue ?? 0) });
          }}
          precision={3}
          style={{ width: '100%' }}
          value={record.qty}
        />
      ),
      title: '数量',
      width: 130,
    },
    {
      dataIndex: 'uom',
      render: (_, record) => (
        <Select
          onChange={(uom) => updateLine(record.key, { uom })}
          options={record.allUoms.map((uom) => ({
            label: resolveUomDisplay(uom, record.allUomDisplays),
            value: uom,
          }))}
          value={record.uom ?? undefined}
        />
      ),
      title: '单位',
      width: 140,
    },
    {
      dataIndex: 'price',
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
      title: '采购价',
      width: 140,
    },
    {
      dataIndex: 'warehouse',
      render: (_, record) => (
        <RemoteLinkSelect
          doctype="Warehouse"
          extraFields={['company']}
          filters={{ company }}
          onChange={(nextWarehouse) => {
            updateLine(record.key, { warehouse: nextWarehouse });
          }}
          placeholder="选择仓库"
          value={record.warehouse}
        />
      ),
      title: '仓库',
      width: 190,
    },
    {
      dataIndex: 'stockQty',
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
          <Space direction="vertical" size={0}>
            <Typography.Text>
              {formatQty(record.stockQty)} {stockUomDisplay}
            </Typography.Text>
            <Typography.Text type="secondary">
              本单 {formatQty(stockQty)} {stockUomDisplay}
            </Typography.Text>
          </Space>
        );
      },
      title: '库存参考',
      width: 160,
    },
    {
      align: 'right',
      dataIndex: 'amount',
      render: (_, record) => formatCurrencyValue(record.amount),
      title: '金额',
      width: 140,
    },
    {
      render: (_, record) => (
        <Space size={0}>
          <Button onClick={() => addWarehouseLine(record)} type="link">
            新增仓库行
          </Button>
          <Popconfirm
            onConfirm={() => {
              onChange(lines.filter((line) => line.key !== record.key));
            }}
            title="移除该商品？"
          >
            <Button danger type="link">
              移除
            </Button>
          </Popconfirm>
        </Space>
      ),
      title: '操作',
      width: 180,
    },
  ];

  return (
    <Table<PurchaseOrderEditorLine>
      columns={columns}
      dataSource={lines}
      pagination={false}
      rowKey="key"
      scroll={{ x: 1250 }}
      summary={() => (
        <Table.Summary.Row>
          <Table.Summary.Cell colSpan={6} index={0}>
            <Typography.Text strong>合计</Typography.Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell align="right" index={1}>
            <Typography.Text strong>
              {formatCurrencyValue(getPurchaseOrderLinesTotal(lines))}
            </Typography.Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={2} />
        </Table.Summary.Row>
      )}
    />
  );
}
