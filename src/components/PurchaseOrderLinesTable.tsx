import {
  Button,
  Image,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
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

type PurchaseLineGroup = {
  itemCode: string;
  itemName: string;
  rows: PurchaseOrderEditorLine[];
  specification: string;
};

function groupPurchaseLines(lines: PurchaseOrderEditorLine[]) {
  const groups = new Map<string, PurchaseLineGroup>();
  lines.forEach((line) => {
    const key = line.itemCode || line.key;
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(line);
      return;
    }
    groups.set(key, {
      itemCode: line.itemCode,
      itemName: line.itemName,
      rows: [line],
      specification: line.specification,
    });
  });
  return Array.from(groups.values());
}

function lineIncomingStockQty(line: PurchaseOrderEditorLine) {
  return (
    convertQtyToStockQty({
      qty: line.qty,
      stockUom: line.stockUom,
      uom: line.uom,
      uomConversions: line.uomConversions,
    }) ?? line.qty
  );
}

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

  const addWarehouseLine = (
    record: PurchaseOrderEditorLine,
    warehouse = '',
  ) => {
    onChange([
      ...lines,
      recalculatePurchaseOrderLine({
        ...record,
        key: `${record.itemCode}:warehouse:${warehouse || 'manual'}:${Date.now()}`,
        qty: 1,
        warehouse,
      }),
    ]);
  };

  const groupedLines = groupPurchaseLines(lines);

  const columns: ColumnsType<PurchaseOrderEditorLine> = [
    {
      dataIndex: 'itemName',
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
      title: '商品',
      width: 320,
    },
    {
      dataIndex: 'qty',
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
          filters={{ company, disabled: 0, is_group: 0 }}
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
        const currentWarehouseStock =
          record.warehouseStockDetails?.find(
            (entry) => entry.warehouse === record.warehouse,
          )?.qty ?? record.stockQty;
        const projectedWarehouseStock =
          typeof currentWarehouseStock === 'number'
            ? currentWarehouseStock + (stockQty ?? 0)
            : null;
        return (
          <Space orientation="vertical" size={0}>
            <Typography.Text>
              当前仓 {formatQty(currentWarehouseStock)} {stockUomDisplay}
            </Typography.Text>
            <Typography.Text type="secondary">
              本单 {formatQty(stockQty)} {stockUomDisplay}
            </Typography.Text>
            <Typography.Text type="secondary">
              入库后 {formatQty(projectedWarehouseStock)} {stockUomDisplay}
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

  if (!lines.length) {
    return (
      <Table<PurchaseOrderEditorLine>
        columns={columns}
        dataSource={[]}
        pagination={false}
        rowKey="key"
        scroll={{ x: 1250 }}
      />
    );
  }

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      {groupedLines.map((group, index) => {
        const leadRow = group.rows[0];
        const stockUomDisplay = resolveUomDisplay(
          leadRow.stockUom,
          leadRow.allUomDisplays,
          leadRow.stockUomDisplay,
        );
        const incomingQty = group.rows.reduce(
          (sum, row) => sum + lineIncomingStockQty(row),
          0,
        );
        const purchaseAmount = getPurchaseOrderLinesTotal(group.rows);
        const projectedTotal =
          typeof leadRow.totalQty === 'number'
            ? leadRow.totalQty + incomingQty
            : null;
        const groupWarehouses = new Set(
          group.rows.map((row) => row.warehouse).filter(Boolean),
        );
        const availableWarehouseRows =
          leadRow.warehouseStockDetails?.filter(
            (entry) =>
              entry.warehouse &&
              !entry.warehouse.toLowerCase().startsWith('all warehouses') &&
              !groupWarehouses.has(entry.warehouse),
          ) ?? [];

        return (
          <div
            key={group.itemCode || index}
            style={{
              border: '1px solid #f0f0f0',
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                alignItems: 'center',
                background: '#fafafa',
                display: 'flex',
                gap: 16,
                justifyContent: 'space-between',
                padding: '12px 16px',
              }}
            >
              <Space orientation="vertical" size={2}>
                <Space wrap>
                  <Typography.Text strong>
                    {group.itemName || group.itemCode}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    {group.itemCode}
                  </Typography.Text>
                  {group.specification ? (
                    <Tag>{group.specification}</Tag>
                  ) : null}
                </Space>
                <Space wrap size={16}>
                  <Typography.Text type="secondary">
                    参考采购价{' '}
                    <Typography.Text strong>
                      {leadRow.standardBuyingRate == null
                        ? '未设置'
                        : formatCurrencyValue(leadRow.standardBuyingRate)}
                    </Typography.Text>
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    本次采购额{' '}
                    <Typography.Text strong>
                      {formatCurrencyValue(purchaseAmount)}
                    </Typography.Text>
                  </Typography.Text>
                </Space>
              </Space>
              <Space wrap size={16}>
                <Typography.Text>
                  总库存 {formatQty(leadRow.totalQty ?? leadRow.stockQty)}{' '}
                  {stockUomDisplay}
                </Typography.Text>
                <Typography.Text>
                  本次入库 {formatQty(incomingQty)} {stockUomDisplay}
                </Typography.Text>
                <Typography.Text>
                  入库后 {formatQty(projectedTotal)} {stockUomDisplay}
                </Typography.Text>
                <Tag color="blue">{group.rows.length} 条仓库行</Tag>
              </Space>
            </div>
            {availableWarehouseRows.length ? (
              <div
                style={{
                  background: '#fcfcfc',
                  borderTop: '1px solid #f0f0f0',
                  padding: '6px 16px',
                }}
              >
                <Space wrap size={[8, 8]}>
                  <Typography.Text type="secondary">
                    可拆分到已有库存仓
                  </Typography.Text>
                  {availableWarehouseRows.slice(0, 8).map((entry) => (
                    <Button
                      key={entry.warehouse}
                      onClick={() => addWarehouseLine(leadRow, entry.warehouse)}
                      size="small"
                      type="link"
                    >
                      {entry.warehouse} · {formatQty(entry.qty)}{' '}
                      {stockUomDisplay}
                    </Button>
                  ))}
                </Space>
              </div>
            ) : null}
            <Table<PurchaseOrderEditorLine>
              columns={columns}
              dataSource={group.rows}
              pagination={false}
              rowKey="key"
              scroll={{ x: 1250 }}
            />
          </div>
        );
      })}
      <div
        style={{
          alignItems: 'center',
          background: '#fafafa',
          border: '1px solid #f0f0f0',
          borderRadius: 6,
          display: 'flex',
          justifyContent: 'space-between',
          padding: '12px 16px',
        }}
      >
        <Typography.Text strong>合计</Typography.Text>
        <Typography.Text strong>
          {formatCurrencyValue(getPurchaseOrderLinesTotal(lines))}
        </Typography.Text>
      </div>
    </Space>
  );
}
