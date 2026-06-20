import { InputNumber, Table, Typography } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { formatCurrencyValue, resolveDisplayUom } from '@/utils/myapp-display';

export type LineQtyEditorRow = {
  actionQty: number;
  completedQty?: number | null;
  itemCode: string;
  itemName: string;
  key: string;
  maxQty: number;
  orderedQty: number;
  rate?: number | null;
  uom: string;
  uomDisplay?: string | null;
};

function toQty(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function formatQty(value: number | null | undefined) {
  const qty = toQty(value);
  return Number.isInteger(qty) ? String(qty) : String(Number(qty.toFixed(3)));
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
  amountTitle = '本次金额',
  completedTitle = '已完成',
  currency,
  maxTitle = '可处理',
  onChange,
  rows,
  showAmount = false,
  showMaxQty = false,
  summaryLabel,
}: {
  actionTitle?: string;
  amountTitle?: string;
  completedTitle?: string;
  currency?: string;
  maxTitle?: string;
  onChange: (rows: LineQtyEditorRow[]) => void;
  rows: LineQtyEditorRow[];
  showAmount?: boolean;
  showMaxQty?: boolean;
  summaryLabel?: string;
}) {
  const [editableRows, setEditableRows] = useState(rows);

  const summary = useMemo(
    () =>
      editableRows.reduce(
        (result, row) => ({
          actionQty: result.actionQty + toQty(row.actionQty),
          amount: result.amount + toQty(row.actionQty) * toQty(row.rate),
          completedQty: result.completedQty + toQty(row.completedQty),
          maxQty: result.maxQty + toQty(row.maxQty),
          orderedQty: result.orderedQty + toQty(row.orderedQty),
        }),
        {
          actionQty: 0,
          amount: 0,
          completedQty: 0,
          maxQty: 0,
          orderedQty: 0,
        },
      ),
    [editableRows],
  );

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
        render: (value: number | null | undefined) => formatQty(value),
        title: '订单数量',
        width: 100,
      },
      {
        align: 'right' as const,
        dataIndex: 'completedQty',
        render: (value: number | null | undefined) =>
          value === null || value === undefined ? '-' : formatQty(value),
        title: completedTitle,
        width: 100,
      },
      ...(showMaxQty
        ? [
            {
              align: 'right' as const,
              dataIndex: 'maxQty',
              render: (value: number | null | undefined) => formatQty(value),
              title: maxTitle,
              width: 100,
            },
          ]
        : []),
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
            step={1}
            style={{ width: '100%' }}
            value={record.actionQty}
          />
        ),
        title: actionTitle,
        width: 130,
      },
      ...(showAmount
        ? [
            {
              align: 'right' as const,
              dataIndex: 'rate',
              render: (value: number | null | undefined) => (
                <Typography.Text type="secondary">
                  {formatCurrencyValue(value, currency)}
                </Typography.Text>
              ),
              title: '单价',
              width: 120,
            },
            {
              align: 'right' as const,
              dataIndex: 'actionAmount',
              render: (_: unknown, record: LineQtyEditorRow) => (
                <Typography.Text strong style={{ color: '#cf1322' }}>
                  {formatCurrencyValue(
                    toQty(record.actionQty) * toQty(record.rate),
                    currency,
                  )}
                </Typography.Text>
              ),
              title: amountTitle,
              width: 140,
            },
          ]
        : []),
    ],
    [
      actionTitle,
      amountTitle,
      completedTitle,
      currency,
      maxTitle,
      showAmount,
      showMaxQty,
    ],
  );

  const actionQtyColumnIndex = showMaxQty ? 5 : 4;

  return (
    <Table<LineQtyEditorRow>
      columns={columns}
      dataSource={editableRows}
      pagination={false}
      rowKey="key"
      size="small"
      summary={
        summaryLabel
          ? () => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}>
                  <Typography.Text strong>{summaryLabel}</Typography.Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <Typography.Text strong>
                    {formatQty(summary.orderedQty)}
                  </Typography.Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">
                  <Typography.Text strong>
                    {formatQty(summary.completedQty)}
                  </Typography.Text>
                </Table.Summary.Cell>
                {showMaxQty ? (
                  <Table.Summary.Cell index={3} align="right">
                    <Typography.Text strong>
                      {formatQty(summary.maxQty)}
                    </Typography.Text>
                  </Table.Summary.Cell>
                ) : null}
                <Table.Summary.Cell index={showMaxQty ? 4 : 3} />
                <Table.Summary.Cell index={actionQtyColumnIndex} align="right">
                  <Typography.Text strong>
                    {formatQty(summary.actionQty)}
                  </Typography.Text>
                </Table.Summary.Cell>
                {showAmount ? (
                  <>
                    <Table.Summary.Cell index={actionQtyColumnIndex + 1} />
                    <Table.Summary.Cell
                      index={actionQtyColumnIndex + 2}
                      align="right"
                    >
                      <Typography.Text
                        strong
                        style={{ color: '#cf1322', fontSize: 16 }}
                      >
                        {formatCurrencyValue(summary.amount, currency)}
                      </Typography.Text>
                    </Table.Summary.Cell>
                  </>
                ) : null}
              </Table.Summary.Row>
            )
          : undefined
      }
    />
  );
}
