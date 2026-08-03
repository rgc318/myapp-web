import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import React from 'react';
import {
  AiDraftVersionConflictError,
  executeAiDraft,
  getAiDraft,
  updateAiDraft,
} from '@/services/myapp/ai';
import { AiDraftEditorModal } from './AiDraftEditorModal';

jest.mock('@/components', () => {
  const React = jest.requireActual('react');
  return {
    RemoteLinkSelect: (props: any) =>
      React.createElement('input', {
        'aria-label': props.doctype,
        'data-initial-query': props.initialQuery ?? '',
        onChange: (event: any) => props.onChange?.(event.target.value),
        placeholder: props.placeholder,
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
jest.mock('@/services/myapp/ai', () => {
  class MockAiDraftVersionConflictError extends Error {
    code = 'AI_DRAFT_VERSION_CONFLICT';

    constructor(message = '草稿版本已变化') {
      super(message);
      this.name = 'AiDraftVersionConflictError';
    }
  }

  return {
    AiDraftVersionConflictError: MockAiDraftVersionConflictError,
    executeAiDraft: jest.fn(),
    getAiDraft: jest.fn(),
    isAiDraftVersionConflictError: (error: unknown) =>
      error instanceof MockAiDraftVersionConflictError,
    updateAiDraft: jest.fn(),
  };
});

const mockedExecute = jest.mocked(executeAiDraft);
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
    mockedExecute.mockReset();
    mockedUpdate.mockReset();
  });

  it('edits and revalidates a product draft without leaving the AI workspace', async () => {
    const updated = {
      ...draft,
      payload: { ...draft.payload, item_name: '煌星升级版' },
      version: 3,
    };
    mockedUpdate.mockResolvedValue(updated);
    const onClose = jest.fn();
    const onUpdated = jest.fn();
    render(
      React.createElement(
        App,
        null,
        React.createElement(AiDraftEditorModal, {
          draftId: draft.name,
          onClose,
          onUpdated,
        }),
      ),
    );

    expect(await screen.findByDisplayValue('煌星')).toBeTruthy();
    expect(screen.getByText('版本 2 已保存')).toBeTruthy();
    expect(
      screen.getByText('后端校验通过 · 最近校验 2026-07-18 10:00:00'),
    ).toBeTruthy();
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
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('煌星升级版')).toBeTruthy();
  });

  it('renders existing-product mode with hydrated baseline and read-only stock context', async () => {
    mockedGet.mockResolvedValue({
      ...draft,
      payload: {
        _state: {
          baseline: { standard_selling_rate: 5 },
          context: {
            company_total_qty: 1000,
            stock_uom: 'Unit',
            stock_uom_display: '件',
          },
          operation: 'update',
          patch: { description: '补充说明' },
        },
        company: 'Demo Company',
        currency: 'CNY',
        description: '补充说明',
        item_code: 'ITEM-DIMO',
        item_name: '迪莫',
        operation: 'update',
        standard_selling_rate: 5,
        stock_uom: 'Unit',
      },
    });

    render(
      React.createElement(
        App,
        null,
        React.createElement(AiDraftEditorModal, {
          draftId: draft.name,
          onClose: jest.fn(),
          onUpdated: jest.fn(),
        }),
      ),
    );

    expect(await screen.findByText('正在完善现有商品')).toBeTruthy();
    expect(screen.getByText(/当前库存：1000 件/)).toBeTruthy();
    expect(screen.getByText(/商品描述：未设置 → 补充说明/)).toBeTruthy();
    expect(screen.queryByText('初始库存数量')).toBeNull();
    expect(
      (screen.getByDisplayValue('ITEM-DIMO') as HTMLInputElement).disabled,
    ).toBe(true);
  });

  it('saves the latest form version and executes it without closing the editor', async () => {
    const updated = {
      ...draft,
      payload: { ...draft.payload, item_name: '煌星升级版' },
      version: 3,
    };
    const execution = {
      executedAt: '2026-07-23 18:00:00',
      executedBy: 'admin@example.com',
      requestId: 'REQ-1',
      result: {},
      targetDoctype: 'Item',
      targetName: 'ITEM-0001',
    };
    const executed = {
      ...updated,
      execution,
      status: 'executed',
    };
    mockedUpdate.mockResolvedValue(updated);
    mockedExecute.mockResolvedValue({
      draft: executed,
      execution,
      replayed: false,
    });
    const onClose = jest.fn();
    const onUpdated = jest.fn();
    render(
      React.createElement(
        App,
        null,
        React.createElement(AiDraftEditorModal, {
          draftId: draft.name,
          onClose,
          onUpdated,
        }),
      ),
    );

    fireEvent.change(await screen.findByDisplayValue('煌星'), {
      target: { value: '煌星升级版' },
    });
    fireEvent.click(screen.getByRole('button', { name: '确认执行' }));

    expect(
      await screen.findByRole('button', { name: '确认执行当前版本' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '确认执行当前版本' }));

    await waitFor(() => {
      expect(mockedUpdate).toHaveBeenCalledWith(
        draft.name,
        2,
        expect.objectContaining({ item_name: '煌星升级版' }),
      );
      expect(mockedExecute).toHaveBeenCalledWith(draft.name, 3);
      expect(onUpdated).toHaveBeenLastCalledWith(executed);
    });
    expect(await screen.findByText(/已创建 Item ITEM-0001/)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('compares a stale form with the latest draft and rebases selected local fields', async () => {
    const latest = {
      ...draft,
      payload: {
        ...draft.payload,
        brand: '服务器品牌',
        item_name: '服务器名称',
      },
      version: 3,
    };
    const rebased = {
      ...latest,
      payload: {
        ...latest.payload,
        item_name: '我的名称',
      },
      version: 4,
    };
    mockedGet.mockResolvedValueOnce(draft).mockResolvedValueOnce(latest);
    mockedUpdate
      .mockRejectedValueOnce(new AiDraftVersionConflictError())
      .mockResolvedValueOnce(rebased);
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

    fireEvent.change(await screen.findByDisplayValue('煌星'), {
      target: { value: '我的名称' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));

    expect(await screen.findByText('检测到草稿版本冲突')).toBeTruthy();
    expect(screen.getAllByText('原打开版本').length).toBeGreaterThan(0);
    expect(screen.getAllByText('我的输入').length).toBeGreaterThan(0);
    expect(screen.getAllByText('最新持久版本').length).toBeGreaterThan(0);
    expect(screen.getByText('我的名称')).toBeTruthy();
    expect(screen.getByText('服务器名称')).toBeTruthy();
    expect(screen.getByText('服务器品牌')).toBeTruthy();
    expect(screen.getByText('双方均修改')).toBeTruthy();
    expect(screen.getByText('仅最新版本修改')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '应用选择并继续' }));
    expect(screen.getByDisplayValue('我的名称')).toBeTruthy();
    expect(screen.getByDisplayValue('服务器品牌')).toBeTruthy();
    expect(screen.getByText(/商品建档草稿 · 版本 3$/)).toBeTruthy();
    expect(screen.getByText('有未保存修改')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    await waitFor(() => {
      expect(mockedUpdate).toHaveBeenLastCalledWith(
        draft.name,
        3,
        expect.objectContaining({
          brand: '服务器品牌',
          item_name: '我的名称',
        }),
      );
      expect(onUpdated).toHaveBeenLastCalledWith(rebased);
    });
  });

  it('refreshes a changed persisted version before asking the user to execute', async () => {
    const latest = {
      ...draft,
      payload: { ...draft.payload, item_name: '服务器最新名称' },
      version: 3,
    };
    mockedGet.mockResolvedValueOnce(draft).mockResolvedValueOnce(latest);
    render(
      React.createElement(
        App,
        null,
        React.createElement(AiDraftEditorModal, {
          draftId: draft.name,
          onClose: jest.fn(),
          onUpdated: jest.fn(),
        }),
      ),
    );

    await screen.findByDisplayValue('煌星');
    fireEvent.click(screen.getByRole('button', { name: '确认执行' }));

    expect(await screen.findByDisplayValue('服务器最新名称')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: '确认执行当前版本' }),
    ).toBeNull();
    expect(mockedExecute).not.toHaveBeenCalled();
  });

  it('opens version comparison when the draft changes after execution confirmation', async () => {
    const latest = {
      ...draft,
      payload: { ...draft.payload, item_name: '确认后被其他页面修改' },
      version: 3,
    };
    mockedGet
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce(latest);
    mockedExecute.mockRejectedValueOnce(new AiDraftVersionConflictError());
    render(
      React.createElement(
        App,
        null,
        React.createElement(AiDraftEditorModal, {
          draftId: draft.name,
          onClose: jest.fn(),
          onUpdated: jest.fn(),
        }),
      ),
    );

    await screen.findByDisplayValue('煌星');
    fireEvent.click(screen.getByRole('button', { name: '确认执行' }));
    fireEvent.click(
      await screen.findByRole('button', { name: '确认执行当前版本' }),
    );

    expect(await screen.findByText('检测到草稿版本冲突')).toBeTruthy();
    expect(screen.getByText('确认后被其他页面修改')).toBeTruthy();
    expect(screen.getByText('仅最新版本修改')).toBeTruthy();
    expect(mockedExecute).toHaveBeenCalledWith(draft.name, 2);
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
      await screen.findByText('填写初始库存时，请输入成本价（默认采购价）'),
    ).toBeTruthy();
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('keeps saved values visible when backend validation still needs attention', async () => {
    const current = {
      ...draft,
      payload: {
        ...draft.payload,
        opening_qty: 1000,
        retail_rate: 6500,
        standard_buying_rate: 5000,
        wholesale_rate: 6000,
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
          retail_rate: 6500,
          standard_buying_rate: 5000,
          wholesale_rate: 6000,
        }),
      );
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(
      Number(
        screen.getByRole<HTMLInputElement>('spinbutton', {
          name: '成本价（默认采购价）',
        }).value,
      ),
    ).toBe(5000);
  });

  it('renders unresolved product master-data queries as empty actionable selectors', async () => {
    const productDraft = {
      ...draft,
      payload: {
        ...draft.payload,
        brand: null,
        brand_query: '幻兽品牌',
        item_group: null,
        item_group_query: '宝石分类',
        opening_qty: 10,
        warehouse: null,
        warehouse_query: '成品仓',
      },
      validation: {
        errors: [
          '商品分类无法唯一匹配，请人工选择。',
          '品牌无法唯一匹配，请人工选择。',
          '填写初始库存时必须选择当前公司的叶子仓库。',
        ],
        readyForHandoff: false,
        warnings: [],
      },
    };
    mockedGet.mockResolvedValue(productDraft);
    render(
      React.createElement(
        App,
        null,
        React.createElement(AiDraftEditorModal, {
          draftId: productDraft.name,
          onClose: jest.fn(),
          onUpdated: jest.fn(),
        }),
      ),
    );

    const itemGroup = await screen.findByLabelText('Item Group');
    const brand = screen.getByLabelText('Brand');
    const warehouse = screen.getByLabelText('Warehouse');
    expect((itemGroup as HTMLInputElement).value).toBe('');
    expect((brand as HTMLInputElement).value).toBe('');
    expect((warehouse as HTMLInputElement).value).toBe('');
    expect(itemGroup.getAttribute('data-initial-query')).toBe('宝石分类');
    expect(brand.getAttribute('data-initial-query')).toBe('幻兽品牌');
    expect(warehouse.getAttribute('data-initial-query')).toBe('成品仓');
    expect(
      screen.getByText(
        'AI 只识别到分类搜索词“宝石分类”，请搜索并选择具体分类。',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('“幻兽品牌”尚未匹配到唯一品牌，请从下拉结果中选择。'),
    ).toBeTruthy();
    expect(screen.getByText('当前有 3 项必须处理')).toBeTruthy();
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

  it('shows unresolved inventory validation on the actionable fields', async () => {
    const inventoryDraft = {
      ...draft,
      draftType: 'inventory_adjustment' as const,
      payload: {
        adjustment_type: 'increase',
        company: 'Demo Company',
        items: [
          {
            item_code: null,
            item_query: '圣晶石',
            qty: 10,
            uom: 'Unit',
          },
        ],
        posting_date: '2026-08-03',
        reason: null,
        warehouse: 'Stores - RD',
      },
      title: '库存调整草稿',
      validation: {
        errors: [
          '商品无法唯一匹配，请人工选择。',
          '库存调整必须填写盘点差异或业务原因。',
        ],
        readyForHandoff: false,
        warnings: ['商品“圣晶石”无法唯一匹配，请人工选择。'],
      },
    };
    mockedGet.mockResolvedValue(inventoryDraft);
    render(
      React.createElement(
        App,
        null,
        React.createElement(AiDraftEditorModal, {
          draftId: inventoryDraft.name,
          onClose: jest.fn(),
          onUpdated: jest.fn(),
        }),
      ),
    );

    const itemInput = await screen.findByLabelText('Item');
    expect((itemInput as HTMLInputElement).value).toBe('');
    expect(
      screen.getByText(
        'AI 只识别到搜索词“圣晶石”，尚未匹配商品编码。请搜索并选择具体商品。',
      ),
    ).toBeTruthy();
    expect(
      await screen.findByText(
        '“圣晶石”尚未匹配到唯一商品，请从下拉结果中选择具体商品。',
      ),
    ).toBeTruthy();
    expect(
      screen.getAllByText('库存调整必须填写盘点差异或业务原因。').length,
    ).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole('button', { name: '确认执行' }));

    expect(
      await screen.findByText(
        '无法执行：商品无法唯一匹配，请人工选择；库存调整必须填写盘点差异或业务原因。',
      ),
    ).toBeTruthy();
    expect(mockedExecute).not.toHaveBeenCalled();
  });

  it.each([
    ['sales_order', 'Customer', '老客户', '客户', '明细'],
    ['purchase_order', 'Supplier', '老供应商', '供应商', '收货'],
  ] as const)('renders unresolved %s selections as empty fields with original search hints', async (draftType, partyDoctype, partyQuery, partyLabel, warehouseLabel) => {
    const orderDraft = {
      ...draft,
      draftType,
      payload: {
        company: 'Demo Company',
        [draftType === 'purchase_order' ? 'supplier' : 'customer']: null,
        [draftType === 'purchase_order' ? 'supplier_query' : 'customer_query']:
          partyQuery,
        default_purchase_mode: 'wholesale',
        default_sales_mode: 'wholesale',
        delivery_date: '2026-08-04',
        schedule_date: '2026-08-04',
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
      },
      title: `${partyLabel}订单草稿`,
      validation: {
        errors: [
          `${partyLabel}无法唯一匹配，请人工选择。`,
          `第 1 行需要人工补充商品、数量或${warehouseLabel}仓库。`,
        ],
        readyForHandoff: false,
        warnings: ['商品“圣晶石”无法唯一匹配，请人工选择。'],
      },
    };
    mockedGet.mockResolvedValue(orderDraft);
    render(
      React.createElement(
        App,
        null,
        React.createElement(AiDraftEditorModal, {
          draftId: orderDraft.name,
          onClose: jest.fn(),
          onUpdated: jest.fn(),
        }),
      ),
    );

    const party = await screen.findByLabelText(partyDoctype);
    const item = screen.getByLabelText('Item');
    const warehouses = screen.getAllByLabelText('Warehouse');
    expect((party as HTMLInputElement).value).toBe('');
    expect((item as HTMLInputElement).value).toBe('');
    expect(party.getAttribute('data-initial-query')).toBe(partyQuery);
    expect(item.getAttribute('data-initial-query')).toBe('圣晶石');
    expect(
      warehouses.map((input) => input.getAttribute('data-initial-query')),
    ).toEqual(expect.arrayContaining(['默认仓', '临时仓']));
    expect(
      screen.getByText(
        `AI 只识别到搜索词“${partyQuery}”，请搜索并选择具体${partyLabel}。`,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        '“圣晶石”尚未匹配到唯一商品，请从下拉结果中选择具体商品。',
      ),
    ).toBeTruthy();
    expect(screen.getByText('当前有 2 项必须处理')).toBeTruthy();
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
