import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    recommendedStrategy: 'in_place' | 'replacement' | null;
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
    recommendedStrategy: 'replacement' as const,
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
    suggestedNewItemCode: 'ITEM-NEW',
    strategies: {
      inPlace: { available: true, reason: '满足低风险原地纠正条件' },
      replacement: { available: true, reason: '允许创建继任商品' },
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
      (await screen.findAllByText('创建继任商品并停用源商品')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('历史流水保持不变')).toBeTruthy();
    expect(screen.getByText('新商品单位配置区')).toBeTruthy();
    expect(screen.getByText('添加新价格')).toBeTruthy();
    expect(
      (screen.getByLabelText('新商品编码（建议值）') as HTMLInputElement).value,
    ).toBe('ITEM-NEW');
    expect(screen.getByText('必须选择')).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: '预览并确认纠正' })
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
          .getByRole('button', { name: '预览并确认纠正' })
          .hasAttribute('disabled'),
      ).toBe(true);
    });
  });

  it('submits empty price and barcode mappings when the source has no rows', async () => {
    const noMappedRowsAssessment = assessment();
    noMappedRowsAssessment.prices = [];
    noMappedRowsAssessment.barcodes = [];
    mockedAssess.mockResolvedValue(noMappedRowsAssessment);
    mockedExecute.mockResolvedValue({
      data: { newItem: { itemCode: 'ITEM-NEW' } },
    } as never);

    render(
      React.createElement(ProductUomMigrationModal, {
        itemCode: 'ITEM-OLD',
        onClose: jest.fn(),
        onCompleted: jest.fn(),
        open: true,
      }),
    );

    const itemCodeInput = await screen.findByLabelText('新商品编码（建议值）');
    fireEvent.change(itemCodeInput, { target: { value: 'ITEM-NEW' } });
    fireEvent.change(screen.getByLabelText('纠正原因'), {
      target: { value: '建档时误选单位' },
    });
    fireEvent.click(screen.getByLabelText('我确认迁移成功后停用源商品'));
    fireEvent.click(
      screen.getByLabelText(
        '我确认历史库存流水继续保留在源商品下，不要求重写历史',
      ),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: '预览并确认纠正',
      }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: '确认创建继任商品' }),
    );

    await waitFor(() => {
      expect(mockedExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          barcodeMappings: [],
          correctionReason: '建档时误选单位',
          newItemCode: 'ITEM-NEW',
          newPrices: [],
          priceMappings: [],
          strategy: 'replacement',
        }),
      );
    });
  });

  it('supports an in-place correction without asking for a new item code', async () => {
    const inPlaceAssessment = assessment({ recommendedStrategy: 'in_place' });
    inPlaceAssessment.prices = [];
    mockedAssess.mockResolvedValue(inPlaceAssessment);
    mockedExecute.mockResolvedValue({
      data: { newItem: { itemCode: 'ITEM-OLD' } },
    } as never);

    render(
      React.createElement(ProductUomMigrationModal, {
        itemCode: 'ITEM-OLD',
        onClose: jest.fn(),
        onCompleted: jest.fn(),
        open: true,
      }),
    );

    expect(
      await screen.findByText('系统推荐：保留原编码并受控纠正'),
    ).toBeTruthy();
    expect(screen.queryByLabelText('新商品编码（建议值）')).toBeNull();
    fireEvent.change(screen.getByLabelText('纠正原因'), {
      target: { value: '无业务占用，纠正建档单位' },
    });
    fireEvent.click(
      screen.getByLabelText('我确认保留原商品编码，并按上述配置纠正当前主数据'),
    );
    fireEvent.click(
      screen.getByLabelText(
        '我确认历史库存流水继续保留在源商品下，不要求重写历史',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: '预览并确认纠正' }));
    fireEvent.click(
      await screen.findByRole('button', { name: '确认原地纠正' }),
    );

    await waitFor(() => {
      expect(mockedExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmInPlaceCorrection: true,
          correctionReason: '无业务占用，纠正建档单位',
          newItemCode: undefined,
          strategy: 'in_place',
        }),
      );
    });
  });
});
