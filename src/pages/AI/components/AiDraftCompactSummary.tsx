import { Space, Typography } from 'antd';
import React, { type ReactNode } from 'react';
import { ProductImage } from '@/components/ProductImage';
import type { AiDraft } from '@/services/myapp/ai';
import { resolveMediaUrl } from '@/services/myapp/media-url';
import { resolveDisplayUom } from '@/utils/display-uom';
import {
  calculateLineAmount,
  formatCurrencyValue,
} from '@/utils/myapp-display';
import { formatConvertedQty } from '@/utils/uom-conversion';

type SummaryItem = {
  key: string;
  label: string;
  value: ReactNode;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function currencyValue(value: unknown): number | string | null {
  return typeof value === 'number' || typeof value === 'string' ? value : null;
}

function displayUom(value: unknown, displayValue: unknown) {
  const uom = optionalText(value);
  const uomDisplay = optionalText(displayValue);
  return uom || uomDisplay ? resolveDisplayUom(uom, uomDisplay) : '未设置单位';
}

function formatQty(value: unknown) {
  const number = finiteNumber(value);
  return number === null ? '-' : formatConvertedQty(number) || '-';
}

function itemRows(payload: Record<string, unknown>) {
  return (Array.isArray(payload.items) ? payload.items : []).map(asObject);
}

function summarizeLineQuantities(rows: Record<string, unknown>[]) {
  const totals = new Map<string, { qty: number; uom: string }>();
  for (const row of rows) {
    const qty = finiteNumber(row.qty);
    if (qty === null) continue;
    const uom = optionalText(row.uom);
    const uomDisplay = displayUom(uom, row.uom_display);
    const key = `${uom ?? ''}:${uomDisplay}`;
    const current = totals.get(key);
    totals.set(key, {
      qty: (current?.qty ?? 0) + qty,
      uom: uomDisplay || '未设置单位',
    });
  }
  return Array.from(totals.values())
    .map(({ qty, uom }) => `${formatConvertedQty(qty)} ${uom}`)
    .join(' + ');
}

function summarizeDraftAmount(rows: Record<string, unknown>[]) {
  if (!rows.length) return null;
  let total = 0;
  for (const row of rows) {
    const qty = finiteNumber(row.qty);
    const price = finiteNumber(row.price ?? row.rate);
    if (qty === null || price === null) return null;
    total += calculateLineAmount({ price, qty });
  }
  return total;
}

function summarizeWarehouses(
  payload: Record<string, unknown>,
  rows: Record<string, unknown>[],
) {
  const rowWarehouses = rows
    .map((row) => optionalText(row.warehouse))
    .filter((value): value is string => Boolean(value));
  const warehouses = Array.from(
    new Set(
      rowWarehouses.length
        ? rowWarehouses
        : [optionalText(payload.warehouse)].filter((value): value is string =>
            Boolean(value),
          ),
    ),
  );
  if (!warehouses.length) {
    const unresolvedWarehouses = Array.from(
      new Set(
        [
          ...rows.map((row) => optionalText(row.warehouse_query)),
          optionalText(payload.warehouse_query),
        ].filter((value): value is string => Boolean(value)),
      ),
    );
    if (unresolvedWarehouses.length) {
      return `待匹配：${unresolvedWarehouses.join('、')}`;
    }
  }
  if (warehouses.length <= 2) return warehouses.join('、') || '-';
  return `${warehouses.slice(0, 2).join('、')} 等 ${warehouses.length} 个仓库`;
}

function productSummaryItems(draft: AiDraft): SummaryItem[] {
  const payload = draft.payload;
  const currency = optionalText(payload.currency) ?? 'CNY';
  const itemName = optionalText(payload.item_name) ?? '-';
  const itemCode = optionalText(payload.item_code);
  const openingQty = finiteNumber(payload.opening_qty);
  const openingUom = displayUom(
    optionalText(payload.opening_uom) ?? optionalText(payload.stock_uom),
    optionalText(payload.opening_uom_display) ??
      optionalText(payload.stock_uom_display),
  );
  const warehouse = optionalText(payload.warehouse);
  const warehouseQuery = optionalText(payload.warehouse_query);
  const state = asObject(payload._state);
  const stateContext = asObject(state.context);
  const isUpdate = payload.operation === 'update';
  const currentStockQty = finiteNumber(stateContext.company_total_qty);
  const currentStockUom = displayUom(
    stateContext.stock_uom,
    stateContext.stock_uom_display,
  );

  return [
    {
      key: 'operation',
      label: '操作',
      value: isUpdate ? '完善现有商品' : '创建新商品',
    },
    {
      key: 'product',
      label: '商品',
      value: itemCode ? `${itemName}（${itemCode}）` : itemName,
    },
    {
      key: 'stock-uom',
      label: '库存单位',
      value: displayUom(payload.stock_uom, payload.stock_uom_display),
    },
    {
      key: 'prices',
      label: '价格',
      value: (
        <Space size={[12, 0]} wrap>
          <span>
            标准{' '}
            {formatCurrencyValue(
              currencyValue(payload.standard_selling_rate),
              currency,
            )}
          </span>
          <span>
            批发{' '}
            {formatCurrencyValue(
              currencyValue(payload.wholesale_rate),
              currency,
            )}
          </span>
          <span>
            零售{' '}
            {formatCurrencyValue(currencyValue(payload.retail_rate), currency)}
          </span>
          <span>
            成本{' '}
            {formatCurrencyValue(
              currencyValue(
                payload.standard_buying_rate ?? payload.valuation_rate,
              ),
              currency,
            )}
          </span>
        </Space>
      ),
    },
    {
      key: 'opening-stock',
      label: isUpdate ? '当前库存（只读）' : '初始库存',
      value: isUpdate
        ? [formatQty(currentStockQty), currentStockUom].join(' ')
        : openingQty === null
          ? '-'
          : `${formatConvertedQty(openingQty)} ${openingUom}${warehouse ? ` · ${warehouse}` : warehouseQuery ? ` · 待匹配：${warehouseQuery}` : openingQty > 0 ? ' · 未选择仓库' : ''}`,
    },
  ];
}

function orderSummaryItems(draft: AiDraft): SummaryItem[] {
  const payload = draft.payload;
  const rows = itemRows(payload);
  const isPurchase = draft.draftType === 'purchase_order';
  const party = isPurchase
    ? (optionalText(payload.supplier_display_name) ??
      optionalText(payload.supplier))
    : (optionalText(payload.customer_display_name) ??
      optionalText(payload.customer));
  const partyQuery = isPurchase
    ? optionalText(payload.supplier_query)
    : optionalText(payload.customer_query);
  const transactionDate = optionalText(payload.transaction_date) ?? '-';
  const targetDate = isPurchase
    ? optionalText(payload.schedule_date)
    : optionalText(payload.delivery_date);
  const quantitySummary = summarizeLineQuantities(rows);
  const amount = summarizeDraftAmount(rows);
  const currency = optionalText(payload.currency) ?? 'CNY';

  return [
    {
      key: 'party',
      label: isPurchase ? '供应商' : '客户',
      value: party ?? (partyQuery ? `待匹配：${partyQuery}` : '-'),
    },
    {
      key: 'dates',
      label: '日期',
      value: targetDate
        ? `${transactionDate} · ${isPurchase ? '到货' : '交货'} ${targetDate}`
        : transactionDate,
    },
    {
      key: 'lines',
      label: '商品明细',
      value: `${rows.length} 行${quantitySummary ? ` · ${quantitySummary}` : ''}`,
    },
    {
      key: 'amount',
      label: '草稿金额',
      value: formatCurrencyValue(amount, currency),
    },
    {
      key: 'warehouse',
      label: '仓库',
      value: summarizeWarehouses(payload, rows),
    },
  ];
}

function inventorySummaryItems(draft: AiDraft): SummaryItem[] {
  const payload = draft.payload;
  const row = itemRows(payload)[0] ?? {};
  const itemQuery = optionalText(row.item_query);
  const itemName =
    optionalText(row.item_name) ?? (itemQuery ? `待匹配：${itemQuery}` : '-');
  const itemCode = optionalText(row.item_code);
  const stockUom = displayUom(
    optionalText(row.stock_uom) ?? optionalText(row.uom),
    optionalText(row.stock_uom_display) ?? optionalText(row.uom_display),
  );
  const currentQty = finiteNumber(row.current_stock_qty);
  const targetQty = finiteNumber(row.target_stock_qty);
  const deltaQty = finiteNumber(row.qty_delta);
  const deltaLabel =
    deltaQty === null
      ? '-'
      : `${deltaQty > 0 ? '+' : ''}${formatConvertedQty(deltaQty)} ${stockUom}`;

  return [
    {
      key: 'product',
      label: '商品',
      value: itemCode ? `${itemName}（${itemCode}）` : itemName,
    },
    {
      key: 'warehouse',
      label: '仓库',
      value:
        optionalText(payload.warehouse) ?? optionalText(row.warehouse) ?? '-',
    },
    {
      key: 'stock-change',
      label: '库存变化',
      value: `${formatQty(currentQty)} → ${formatQty(targetQty)} ${stockUom}（差异 ${deltaLabel}）`,
    },
    {
      key: 'valuation',
      label: '估值参考',
      value: formatCurrencyValue(
        finiteNumber(row.valuation_rate),
        optionalText(payload.currency) ?? 'CNY',
      ),
    },
    {
      key: 'reason',
      label: '调整原因',
      value:
        optionalText(payload.reason) ?? optionalText(payload.remarks) ?? '-',
    },
  ];
}

export function AiDraftCompactSummary({ draft }: { draft: AiDraft }) {
  const items =
    draft.draftType === 'product_setup'
      ? productSummaryItems(draft)
      : draft.draftType === 'inventory_adjustment'
        ? inventorySummaryItems(draft)
        : orderSummaryItems(draft);

  const summary = (
    <Space orientation="vertical" size={2} style={{ width: '100%' }}>
      {items.map((item) => (
        <div key={item.key}>
          <Typography.Text type="secondary">{item.label}：</Typography.Text>
          <Typography.Text>{item.value}</Typography.Text>
        </div>
      ))}
    </Space>
  );

  if (draft.draftType !== 'product_setup') return summary;

  return (
    <Space align="start" size={12} style={{ width: '100%' }}>
      <ProductImage
        alt={optionalText(draft.payload.item_name) ?? '商品草稿'}
        emptyText="未设置"
        height={64}
        src={resolveMediaUrl(optionalText(draft.payload.image) ?? '')}
        width={64}
      />
      {summary}
    </Space>
  );
}
