import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import {
  assessProductUomMigration,
  executeProductUomMigration,
} from '@/services/myapp/master-data';
import { ProductUomMigrationModal } from './ProductUomMigrationModal';

jest.mock('@/components/ProductUomFields', () => {
  const React = jest.requireActual('react');
  return {
    ProductUomFields: () =>
      React.createElement('div', null, '新商品单位配置区'),
  };
});

jest.mock('@/services/myapp/master-data', () => ({
  assessProductUomMigration: jest.fn(),
  executeProductUomMigration: jest.fn(),
}));

const mockedAssess = jest.mocked(assessProductUomMigration);
const mockedExecute = jest.mocked(executeProductUomMigration);

function assessment(
  overrides: Partial<{
    blockers: { code: string; message: string }[];
    canExecute: boolean;
  }> = {},
) {
  return {
    alternatives: [],
    barcodes: [],
    blockers: [],
    canExecute: true,
    history: {
      latestStockLedgerEntry: null,
      stockLedgerEntryCount: 2,
    },
    inventory: {
      bins: [
        {
          actualQty: 0,
          committedQty: 0,
          company: 'rgc (Demo)',
          projectedQty: 0,
          warehouse: 'Stores - RD',
        },
      ],
      totalActualQty: 0,
      totalCommittedQty: 0,
    },
    openTransactions: { purchaseOrderCount: 0, salesOrderCount: 0 },
    prices: [
      {
        currency: 'CNY',
        name: 'PRICE-1',
        priceList: 'Wholesale',
        rate: 99,
        uom: 'Wrong UOM',
      },
    ],
    source: {
      disabled: false,
      itemCode: 'ITEM-OLD',
      itemName: '测试商品',
      modified: '2026-08-31 12:00:00',
      retailDefaultUom: null,
      stockUom: 'Wrong UOM',
      stockUomDisplay: '错误单位',
      uomConversions: [{ conversionFactor: 1, uom: 'Wrong UOM' }],
      wholesaleDefaultUom: null,
    },
    warnings: [{ code: 'HISTORY_PRESERVED', message: '历史流水保持不变' }],
    ...overrides,
  };
}

describe('ProductUomMigrationModal', () => {
  beforeEach(() => {
    mockedAssess.mockReset();
    mockedExecute.mockReset();
  });

  it('shows the assessment and requires manual price mapping', async () => {
    mockedAssess.mockResolvedValue(assessment());

    render(
      React.createElement(ProductUomMigrationModal, {
        itemCode: 'ITEM-OLD',
        onClose: jest.fn(),
        onCompleted: jest.fn(),
        open: true,
      }),
    );

    expect(
      await screen.findByText('这是主数据替代迁移，不是原地改单位'),
    ).toBeTruthy();
    expect(screen.getByText('历史流水保持不变')).toBeTruthy();
    expect(screen.getByText('新商品单位配置区')).toBeTruthy();
    expect(screen.getByText('必须选择')).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: '创建替代商品并停用源商品' })
        .hasAttribute('disabled'),
    ).toBe(false);
    expect(mockedExecute).not.toHaveBeenCalled();
  });

  it('disables execution when the assessment has blockers', async () => {
    mockedAssess.mockResolvedValue(
      assessment({
        blockers: [{ code: 'NON_ZERO_STOCK', message: '源商品仍有库存' }],
        canExecute: false,
      }),
    );

    render(
      React.createElement(ProductUomMigrationModal, {
        itemCode: 'ITEM-OLD',
        onClose: jest.fn(),
        onCompleted: jest.fn(),
        open: true,
      }),
    );

    expect(await screen.findByText('源商品仍有库存')).toBeTruthy();
    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: '创建替代商品并停用源商品' })
          .hasAttribute('disabled'),
      ).toBe(true);
    });
  });
});
