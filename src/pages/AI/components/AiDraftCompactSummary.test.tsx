import { render, screen } from '@testing-library/react';
import { App } from 'antd';
import React from 'react';
import type { AiDraft } from '@/services/myapp/ai';
import { AiDraftCompactSummary } from './AiDraftCompactSummary';

function buildDraft(
  draftType: AiDraft['draftType'],
  payload: Record<string, unknown>,
): AiDraft {
  return {
    company: 'Demo Company',
    conversationId: 'AI-CONV-1',
    creation: '2026-07-23 10:00:00',
    draftType,
    execution: null,
    modified: '2026-07-23 10:00:00',
    name: `AI-DRAFT-${draftType}`,
    payload,
    sourceRun: 'AI-RUN-1',
    status: 'draft',
    title: 'AI 草稿',
    validation: { errors: [], readyForHandoff: true, warnings: [] },
    version: 1,
  };
}

function renderSummary(draft: AiDraft) {
  return render(
    <App>
      <AiDraftCompactSummary draft={draft} />
    </App>,
  );
}

describe('AiDraftCompactSummary', () => {
  it('shows product identity, business UOM, four prices and opening stock', () => {
    renderSummary(
      buildDraft('product_setup', {
        currency: 'CNY',
        item_code: 'SKU-001',
        item_name: '迪莫',
        opening_qty: 1000,
        opening_uom: 'Nos',
        opening_uom_display: '件',
        retail_rate: 6,
        standard_buying_rate: 3,
        standard_selling_rate: 5,
        stock_uom: 'Nos',
        stock_uom_display: '件',
        warehouse: '成品仓 - RD',
        wholesale_rate: 4,
      }),
    );

    expect(screen.getByText('迪莫（SKU-001）')).toBeTruthy();
    expect(screen.getAllByText('件').length).toBeGreaterThan(0);
    expect(screen.getByText('标准 5.00 元')).toBeTruthy();
    expect(screen.getByText('批发 4.00 元')).toBeTruthy();
    expect(screen.getByText('零售 6.00 元')).toBeTruthy();
    expect(screen.getByText('成本 3.00 元')).toBeTruthy();
    expect(screen.getByText('1000 件 · 成品仓 - RD')).toBeTruthy();
  });

  it('shows hydrated prices and read-only current stock for product update', () => {
    renderSummary(
      buildDraft('product_setup', {
        _state: {
          context: {
            company_total_qty: 1000,
            stock_uom: 'Nos',
            stock_uom_display: '件',
          },
        },
        currency: 'CNY',
        item_code: 'SKU-DIMO',
        item_name: '迪莫',
        operation: 'update',
        standard_selling_rate: 5,
        stock_uom: 'Nos',
        stock_uom_display: '件',
        wholesale_rate: 3,
      }),
    );

    expect(screen.getByText('完善现有商品')).toBeTruthy();
    expect(screen.getByText('标准 5.00 元')).toBeTruthy();
    expect(screen.getByText('批发 3.00 元')).toBeTruthy();
    expect(screen.getByText('1000 件')).toBeTruthy();
    expect(screen.queryByText('初始库存')).toBeNull();
  });

  it('summarizes sales lines by UOM without adding incompatible units', () => {
    renderSummary(
      buildDraft('sales_order', {
        customer: 'CUST-001',
        customer_display_name: '客户甲',
        delivery_date: '2026-07-25',
        items: [
          {
            price: 100,
            qty: 2,
            uom: 'Box',
            uom_display: '箱',
            warehouse: 'A 仓',
          },
          {
            price: 10,
            qty: 3,
            uom: 'Nos',
            uom_display: '件',
            warehouse: 'B 仓',
          },
        ],
        transaction_date: '2026-07-23',
      }),
    );

    expect(screen.getByText('客户甲')).toBeTruthy();
    expect(screen.getByText('2026-07-23 · 交货 2026-07-25')).toBeTruthy();
    expect(screen.getByText('2 行 · 2 箱 + 3 件')).toBeTruthy();
    expect(screen.getByText('230.00 元')).toBeTruthy();
    expect(screen.getByText('A 仓、B 仓')).toBeTruthy();
  });

  it('uses supplier, arrival date and draft currency for purchase summaries', () => {
    renderSummary(
      buildDraft('purchase_order', {
        currency: 'USD',
        items: [
          {
            price: 12.5,
            qty: 4,
            uom: 'Nos',
            uom_display: '件',
            warehouse: '采购仓',
          },
        ],
        schedule_date: '2026-07-30',
        supplier: 'SUP-001',
        supplier_display_name: '供应商乙',
        transaction_date: '2026-07-23',
      }),
    );

    expect(screen.getByText('供应商乙')).toBeTruthy();
    expect(screen.getByText('2026-07-23 · 到货 2026-07-30')).toBeTruthy();
    expect(screen.getByText('1 行 · 4 件')).toBeTruthy();
    expect(screen.getByText('50.00 USD')).toBeTruthy();
    expect(screen.getByText('采购仓')).toBeTruthy();
  });

  it('shows current, target and delta stock with valuation and reason', () => {
    renderSummary(
      buildDraft('inventory_adjustment', {
        items: [
          {
            current_stock_qty: 10,
            item_code: 'SKU-002',
            item_name: '备用件',
            qty_delta: 5,
            stock_uom: 'Nos',
            stock_uom_display: '件',
            target_stock_qty: 15,
            valuation_rate: 12.5,
            warehouse: '盘点仓',
          },
        ],
        reason: '盘点盘盈',
        warehouse: '盘点仓',
      }),
    );

    expect(screen.getByText('备用件（SKU-002）')).toBeTruthy();
    expect(screen.getByText('盘点仓')).toBeTruthy();
    expect(screen.getByText('10 → 15 件（差异 +5 件）')).toBeTruthy();
    expect(screen.getByText('12.50 元')).toBeTruthy();
    expect(screen.getByText('盘点盘盈')).toBeTruthy();
  });

  it('shows unresolved draft queries as pending matches instead of empty values', () => {
    const { rerender } = renderSummary(
      buildDraft('sales_order', {
        customer: null,
        customer_query: '老客户',
        items: [
          {
            item_code: null,
            item_query: '圣晶石',
            qty: 2,
            warehouse: null,
            warehouse_query: '临时仓',
          },
        ],
        transaction_date: '2026-08-03',
        warehouse: null,
        warehouse_query: '默认仓',
      }),
    );

    expect(screen.getByText('待匹配：老客户')).toBeTruthy();
    expect(screen.getByText('待匹配：临时仓、默认仓')).toBeTruthy();

    rerender(
      <AiDraftCompactSummary
        draft={buildDraft('inventory_adjustment', {
          items: [{ item_code: null, item_query: '圣晶石' }],
        })}
      />,
    );
    expect(screen.getByText('待匹配：圣晶石')).toBeTruthy();
  });
});
