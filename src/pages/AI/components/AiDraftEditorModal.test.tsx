import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import React from 'react';
import { getAiDraft, updateAiDraft } from '@/services/myapp/ai';
import { AiDraftEditorModal } from './AiDraftEditorModal';

jest.mock('@/components', () => {
  const React = jest.requireActual('react');
  return {
    RemoteLinkSelect: (props: any) =>
      React.createElement('input', {
        'aria-label': props.doctype,
        onChange: (event: any) => props.onChange?.(event.target.value),
        value: props.value ?? '',
      }),
  };
});
jest.mock('@/components/CurrencySelect', () => {
  const React = jest.requireActual('react');
  return {
    CurrencySelect: (props: any) =>
      React.createElement('input', {
        'aria-label': 'Currency',
        onChange: (event: any) => props.onChange?.(event.target.value),
        value: props.value ?? '',
      }),
  };
});
jest.mock('@/components/UomSelect', () => {
  const React = jest.requireActual('react');
  return {
    UomSelect: (props: any) =>
      React.createElement('input', {
        'aria-label': 'UOM',
        onChange: (event: any) => props.onChange?.(event.target.value),
        value: props.value ?? '',
      }),
  };
});
jest.mock('@/services/myapp/ai', () => ({
  getAiDraft: jest.fn(),
  updateAiDraft: jest.fn(),
}));

const mockedGet = jest.mocked(getAiDraft);
const mockedUpdate = jest.mocked(updateAiDraft);

const draft = {
  company: 'Demo Company',
  conversationId: 'AI-CONV-1',
  creation: '2026-07-18 10:00:00',
  draftType: 'product_setup' as const,
  execution: null,
  modified: '2026-07-18 10:00:00',
  name: 'AI-DRAFT-1',
  payload: {
    company: 'Demo Company',
    currency: 'CNY',
    item_name: '煌星',
    stock_uom: 'Unit',
  },
  sourceRun: 'AI-RUN-1',
  status: 'draft' as const,
  title: '商品建档草稿',
  validation: { errors: [], readyForHandoff: true, warnings: [] },
  version: 2,
};

describe('AiDraftEditorModal', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedGet.mockResolvedValue(draft);
    mockedUpdate.mockReset();
  });

  it('edits and revalidates a product draft without leaving the AI workspace', async () => {
    const updated = { ...draft, version: 3 };
    mockedUpdate.mockResolvedValue(updated);
    const onUpdated = jest.fn();
    render(
      React.createElement(
        App,
        null,
        React.createElement(AiDraftEditorModal, {
          draftId: draft.name,
          onClose: jest.fn(),
          onUpdated,
        }),
      ),
    );

    expect(await screen.findByDisplayValue('煌星')).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue('煌星'), {
      target: { value: '煌星升级版' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));

    await waitFor(() => {
      expect(mockedUpdate).toHaveBeenCalledWith(
        'AI-DRAFT-1',
        2,
        expect.objectContaining({ item_name: '煌星升级版' }),
      );
      expect(onUpdated).toHaveBeenCalledWith(updated);
    });
  });

  it('requires a default buying price for opening stock', async () => {
    const incompleteDraft = {
      ...draft,
      payload: {
        ...draft.payload,
        opening_qty: 1000,
        warehouse: 'Stores - RD',
      },
      validation: {
        errors: ['填写初始库存时必须补充默认采购价。'],
        readyForHandoff: false,
        warnings: [],
      },
    };
    mockedGet.mockResolvedValue(incompleteDraft);
    render(
      React.createElement(
        App,
        null,
        React.createElement(AiDraftEditorModal, {
          draftId: incompleteDraft.name,
          onClose: jest.fn(),
          onUpdated: jest.fn(),
        }),
      ),
    );

    expect(await screen.findByText('库存基准单位')).toBeTruthy();
    expect(screen.queryByText('初始库存单位')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    expect(
      await screen.findByText('填写初始库存时，请输入默认采购价'),
    ).toBeTruthy();
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('keeps saved values visible when backend validation still needs attention', async () => {
    const current = {
      ...draft,
      payload: {
        ...draft.payload,
        opening_qty: 1000,
        standard_buying_rate: 5000,
        warehouse: 'Stores - RD',
      },
      validation: {
        errors: ['商品分类无法唯一匹配，请人工选择。'],
        readyForHandoff: false,
        warnings: [],
      },
    };
    const updated = { ...current, version: 3 };
    mockedGet.mockResolvedValue(current);
    mockedUpdate.mockResolvedValue(updated);
    const onClose = jest.fn();
    render(
      React.createElement(
        App,
        null,
        React.createElement(AiDraftEditorModal, {
          draftId: current.name,
          onClose,
          onUpdated: jest.fn(),
        }),
      ),
    );

    fireEvent.click(await screen.findByRole('button', { name: '保存草稿' }));

    await waitFor(() => {
      expect(mockedUpdate).toHaveBeenCalledWith(
        'AI-DRAFT-1',
        2,
        expect.objectContaining({
          opening_uom: 'Unit',
          standard_buying_rate: 5000,
        }),
      );
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(
      Number(
        screen.getByRole<HTMLInputElement>('spinbutton', {
          name: '默认采购价',
        }).value,
      ),
    ).toBe(5000);
  });

  it('reloads the latest saved sales order version every time the editor opens', async () => {
    const salesDraft = {
      ...draft,
      draftType: 'sales_order' as const,
      payload: {
        company: 'Demo Company',
        customer: 'Customer A',
        default_sales_mode: 'wholesale',
        delivery_date: '2026-07-20',
        items: [
          {
            item_code: 'ITEM-001',
            price: 100,
            qty: 2,
            uom: 'Unit',
            warehouse: 'Stores - RD',
          },
        ],
        remarks: '原始备注',
        transaction_date: '2026-07-19',
        warehouse: 'Stores - RD',
      },
      title: '销售订单草稿',
    };
    const updated = {
      ...salesDraft,
      payload: {
        ...salesDraft.payload,
        items: [{ ...salesDraft.payload.items[0], price: 120, qty: 5 }],
        remarks: '已修改备注',
      },
      version: 3,
    };
    mockedGet.mockResolvedValueOnce(salesDraft).mockResolvedValueOnce(updated);
    mockedUpdate.mockResolvedValue(updated);
    const onClose = jest.fn();
    const onUpdated = jest.fn();
    const view = (draftId: string | null) =>
      React.createElement(
        App,
        null,
        React.createElement(AiDraftEditorModal, {
          draftId,
          onClose,
          onUpdated,
        }),
      );
    const { rerender } = render(view(salesDraft.name));

    fireEvent.change(await screen.findByDisplayValue('原始备注'), {
      target: { value: '已修改备注' },
    });
    const [qtyInput, priceInput] = screen.getAllByRole('spinbutton');
    fireEvent.change(qtyInput, { target: { value: '5' } });
    fireEvent.change(priceInput, { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));

    await waitFor(() => {
      expect(mockedUpdate).toHaveBeenCalledWith(
        salesDraft.name,
        2,
        expect.objectContaining({
          items: [
            expect.objectContaining({
              item_code: 'ITEM-001',
              price: 120,
              qty: 5,
            }),
          ],
          remarks: '已修改备注',
        }),
      );
    });

    rerender(view(null));
    rerender(view(salesDraft.name));

    expect(await screen.findByDisplayValue('已修改备注')).toBeTruthy();
    expect(
      screen
        .getAllByRole<HTMLInputElement>('spinbutton')
        .map((input) => Number(input.value)),
    ).toEqual(expect.arrayContaining([5, 120]));
    expect(mockedGet).toHaveBeenCalledTimes(2);
  });

  it('preserves purchase currency and supplier reference when saving', async () => {
    const purchaseDraft = {
      ...draft,
      draftType: 'purchase_order' as const,
      payload: {
        company: 'Demo Company',
        currency: 'USD',
        default_purchase_mode: 'wholesale',
        items: [
          {
            item_code: 'ITEM-001',
            price: 80,
            qty: 3,
            uom: 'Unit',
            warehouse: 'Stores - RD',
          },
        ],
        schedule_date: '2026-07-22',
        supplier: 'Supplier A',
        supplier_ref: 'SUP-REF-001',
        transaction_date: '2026-07-19',
        warehouse: 'Stores - RD',
      },
      title: '采购订单草稿',
    };
    mockedGet.mockResolvedValue(purchaseDraft);
    mockedUpdate.mockResolvedValue({ ...purchaseDraft, version: 3 });
    render(
      React.createElement(
        App,
        null,
        React.createElement(AiDraftEditorModal, {
          draftId: purchaseDraft.name,
          onClose: jest.fn(),
          onUpdated: jest.fn(),
        }),
      ),
    );

    expect(await screen.findByDisplayValue('USD')).toBeTruthy();
    expect(screen.getByDisplayValue('SUP-REF-001')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));

    await waitFor(() => {
      expect(mockedUpdate).toHaveBeenCalledWith(
        purchaseDraft.name,
        2,
        expect.objectContaining({
          currency: 'USD',
          supplier_ref: 'SUP-REF-001',
        }),
      );
    });
  });

  it('reloads inventory edits and rejects zero for increase adjustments', async () => {
    const inventoryDraft = {
      ...draft,
      draftType: 'inventory_adjustment' as const,
      payload: {
        adjustment_type: 'increase',
        company: 'Demo Company',
        items: [{ item_code: 'ITEM-001', qty: 4, uom: 'Unit' }],
        posting_date: '2026-07-19',
        reason: '盘点差异',
        warehouse: 'Stores - RD',
      },
      title: '库存调整草稿',
    };
    const updated = {
      ...inventoryDraft,
      payload: {
        ...inventoryDraft.payload,
        items: [{ item_code: 'ITEM-001', qty: 7, uom: 'Unit' }],
      },
      version: 3,
    };
    mockedGet
      .mockResolvedValueOnce(inventoryDraft)
      .mockResolvedValueOnce(updated);
    mockedUpdate.mockResolvedValue(updated);
    const view = (draftId: string | null) =>
      React.createElement(
        App,
        null,
        React.createElement(AiDraftEditorModal, {
          draftId,
          onClose: jest.fn(),
          onUpdated: jest.fn(),
        }),
      );
    const { rerender } = render(view(inventoryDraft.name));

    const quantity = await screen.findByRole('spinbutton', { name: '数量' });
    fireEvent.change(quantity, { target: { value: '0' } });
    fireEvent.blur(quantity);
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    expect(
      await screen.findByText('增加或减少库存时，数量必须大于 0'),
    ).toBeTruthy();
    expect(mockedUpdate).not.toHaveBeenCalled();

    fireEvent.change(quantity, { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    await waitFor(() => {
      expect(mockedUpdate).toHaveBeenCalledWith(
        inventoryDraft.name,
        2,
        expect.objectContaining({
          adjustment_type: 'increase',
          quantity: 7,
        }),
      );
    });

    rerender(view(null));
    rerender(view(inventoryDraft.name));
    await screen.findByText('编辑库存调整草稿 · 版本 3');
    expect(
      screen
        .getAllByRole<HTMLInputElement>('spinbutton')
        .map((input) => Number(input.value)),
    ).toContain(7);
  });

  it('allows order drafts to rely on complete line-level warehouses', async () => {
    const lineWarehouseDraft = {
      ...draft,
      draftType: 'sales_order' as const,
      payload: {
        company: 'Demo Company',
        customer: 'Customer A',
        delivery_date: '2026-07-20',
        items: [
          {
            item_code: 'ITEM-001',
            price: 100,
            qty: 2,
            uom: 'Unit',
            warehouse: 'Line Stores - RD',
          },
        ],
        transaction_date: '2026-07-19',
      },
    };
    mockedGet.mockResolvedValue(lineWarehouseDraft);
    mockedUpdate.mockResolvedValue({ ...lineWarehouseDraft, version: 3 });
    render(
      React.createElement(
        App,
        null,
        React.createElement(AiDraftEditorModal, {
          draftId: lineWarehouseDraft.name,
          onClose: jest.fn(),
          onUpdated: jest.fn(),
        }),
      ),
    );

    expect(await screen.findByDisplayValue('Line Stores - RD')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));

    await waitFor(() => {
      expect(mockedUpdate).toHaveBeenCalledWith(
        lineWarehouseDraft.name,
        2,
        expect.objectContaining({
          items: [expect.objectContaining({ warehouse: 'Line Stores - RD' })],
          warehouse: undefined,
        }),
      );
    });
  });
});
