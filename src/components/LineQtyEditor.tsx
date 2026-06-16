import { InputNumber, Table, Typography } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { resolveDisplayUom } from '@/utils/myapp-display';

export type LineQtyEditorRow = {
  actionQty: number;
  completedQty?: number | null;
  itemCode: string;
  itemName: string;
  key: string;
  maxQty: number;
  orderedQty: number;
  uom: string;
  uomDisplay?: string | null;
};

function toQty(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function buildLineQtyRow(
  row: Omit<LineQtyEditorRow, 'actionQty' | 'maxQty' | 'orderedQty'> & {
    actionQty?: number | null;
    maxQty?: number | null;
    orderedQty?: number | null;
  },
): LineQtyEditorRow {
  const orderedQty = toQty(row.orderedQty);
  const maxQty = Math.max(toQty(row.maxQty), 0);
  const actionQty =
    row.actionQty === null || row.actionQty === undefined
      ? maxQty
      : Math.min(Math.max(toQty(row.actionQty), 0), maxQty);

  return {
    ...row,
    actionQty,
    maxQty,
    orderedQty,
  };
}

export function LineQtyEditor({
  actionTitle = '本次数量',
  completedTitle = '已完成',
  onChange,
  rows,
}: {
  actionTitle?: string;
  completedTitle?: string;
  onChange: (rows: LineQtyEditorRow[]) => void;
  rows: LineQtyEditorRow[];
}) {
  const [editableRows, setEditableRows] = useState(rows);

  useEffect(() => {
    onChange(editableRows);
  }, [editableRows, onChange]);

  const columns = useMemo(
    () => [
      {
        dataIndex: 'itemName',
        ellipsis: true,
        render: (_: unknown, record: LineQtyEditorRow) => (
          <>
            <Typography.Text>
              {record.itemName || record.itemCode}
            </Typography.Text>
            <br />
            <Typography.Text type="secondary">
              {record.itemCode}
            </Typography.Text>
          </>
        ),
        title: '商品',
      },
      {
        align: 'right' as const,
        dataIndex: 'orderedQty',
        title: '订单数量',
        width: 100,
      },
      {
        align: 'right' as const,
        dataIndex: 'completedQty',
        render: (value: number | null | undefined) => value ?? '-',
        title: completedTitle,
        width: 100,
      },
      {
        dataIndex: 'uom',
        render: (_: string, record: LineQtyEditorRow) =>
          resolveDisplayUom(record.uom, record.uomDisplay),
        title: '单位',
        width: 80,
      },
      {
        align: 'right' as const,
        dataIndex: 'actionQty',
        render: (_: unknown, record: LineQtyEditorRow) => (
          <InputNumber
            controls={false}
            max={record.maxQty}
            min={0}
            onChange={(value) => {
              const nextQty = toQty(value);
              setEditableRows((current) =>
                current.map((item) =>
                  item.key === record.key
                    ? {
                        ...item,
                        actionQty: Math.min(Math.max(nextQty, 0), item.maxQty),
                      }
                    : item,
                ),
              );
            }}
            precision={3}
            style={{ width: '100%' }}
            value={record.actionQty}
          />
        ),
        title: actionTitle,
        width: 130,
      },
    ],
    [actionTitle, completedTitle],
  );

  return (
    <Table<LineQtyEditorRow>
      columns={columns}
      dataSource={editableRows}
      pagination={false}
      rowKey="key"
      size="small"
    />
  );
}
