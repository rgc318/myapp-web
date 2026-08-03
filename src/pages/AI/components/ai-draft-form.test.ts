import type { AiDraft } from '@/services/myapp/ai';
import {
  buildAiDraftConflictFields,
  buildAiDraftPayload,
  getAiDraftFormFieldIssues,
  getAiDraftFormValues,
  mergeAiDraftConflictValues,
} from './ai-draft-form';

describe('AI draft conflict form helpers', () => {
  it('does not treat an unresolved inventory search term as a selected item', () => {
    const draft = {
      company: 'Demo Company',
      draftType: 'inventory_adjustment',
      payload: {
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
      validation: {
        errors: [
          '商品无法唯一匹配，请人工选择。',
          '库存调整必须填写盘点差异或业务原因。',
        ],
        readyForHandoff: false,
        warnings: ['商品“圣晶石”无法唯一匹配，请人工选择。'],
      },
    } as unknown as AiDraft;

    expect(getAiDraftFormValues(draft).itemCode).toBeUndefined();
    expect(getAiDraftFormFieldIssues(draft)).toEqual([
      {
        message: '“圣晶石”尚未匹配到唯一商品，请从下拉结果中选择具体商品。',
        name: 'itemCode',
      },
      {
        message: '库存调整必须填写盘点差异或业务原因。',
        name: 'reason',
      },
    ]);
    expect(buildAiDraftPayload(draft, getAiDraftFormValues(draft))).toEqual(
      expect.objectContaining({
        item_code: undefined,
        item_query: '圣晶石',
      }),
    );
  });

  it('keeps unresolved product master-data queries separate from selected values', () => {
    const draft = {
      company: 'Demo Company',
      draftType: 'product_setup',
      payload: {
        brand: null,
        brand_query: '幻兽品牌',
        company: 'Demo Company',
        currency: 'CNY',
        item_group: null,
        item_group_query: '宝石分类',
        item_name: '圣晶石',
        opening_qty: 10,
        operation: 'create',
        stock_uom: 'Unit',
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
    } as unknown as AiDraft;

    const values = getAiDraftFormValues(draft);
    expect(values).toEqual(
      expect.objectContaining({
        brand: undefined,
        itemGroup: undefined,
        warehouse: undefined,
      }),
    );
    expect(getAiDraftFormFieldIssues(draft)).toEqual(
      expect.arrayContaining([
        {
          message: '“宝石分类”尚未匹配到唯一商品分类，请从下拉结果中选择。',
          name: 'itemGroup',
        },
        {
          message: '“幻兽品牌”尚未匹配到唯一品牌，请从下拉结果中选择。',
          name: 'brand',
        },
        {
          message: '“成品仓”尚未匹配到当前公司的可用仓库，请重新选择。',
          name: 'warehouse',
        },
      ]),
    );
    expect(buildAiDraftPayload(draft, values)).toEqual(
      expect.objectContaining({
        brand: undefined,
        brand_query: '幻兽品牌',
        item_group: undefined,
        item_group_query: '宝石分类',
        warehouse: undefined,
        warehouse_query: '成品仓',
      }),
    );
  });

  it.each([
    ['sales_order', 'customer', 'customer_query', '老客户', '客户', '明细'],
    [
      'purchase_order',
      'supplier',
      'supplier_query',
      '老供应商',
      '供应商',
      '收货',
    ],
  ] as const)('keeps unresolved %s party, item, and warehouse queries actionable', (draftType, partyKey, partyQueryKey, partyQuery, partyLabel, warehouseLabel) => {
    const draft = {
      company: 'Demo Company',
      draftType,
      payload: {
        company: 'Demo Company',
        [partyKey]: null,
        [partyQueryKey]: partyQuery,
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
        [draftType === 'purchase_order' ? 'schedule_date' : 'delivery_date']:
          '2026-08-04',
        warehouse: null,
        warehouse_query: '默认仓',
      },
      validation: {
        errors: [
          `${partyLabel}无法唯一匹配，请人工选择。`,
          `第 1 行需要人工补充商品、数量或${warehouseLabel}仓库。`,
        ],
        readyForHandoff: false,
        warnings: ['商品“圣晶石”无法唯一匹配，请人工选择。'],
      },
    } as unknown as AiDraft;

    const values = getAiDraftFormValues(draft);
    expect(values.party).toBeUndefined();
    expect(values.items?.[0].itemCode).toBeUndefined();
    expect(values.items?.[0].warehouse).toBeUndefined();
    expect(getAiDraftFormFieldIssues(draft)).toEqual(
      expect.arrayContaining([
        {
          message: `“${partyQuery}”尚未匹配到唯一${partyLabel}，请从下拉结果中选择。`,
          name: 'party',
        },
        {
          message:
            '“默认仓”尚未匹配到当前公司的可用默认仓库，请重新选择或为每行选择仓库。',
          name: 'warehouse',
        },
        {
          message: '“圣晶石”尚未匹配到唯一商品，请从下拉结果中选择具体商品。',
          name: ['items', 0, 'itemCode'],
        },
        {
          message: `“临时仓”尚未匹配到当前公司的可用${warehouseLabel}仓库，请重新选择。`,
          name: ['items', 0, 'warehouse'],
        },
      ]),
    );
    const payload = buildAiDraftPayload(draft, values);
    expect(payload).toEqual(
      expect.objectContaining({
        [partyKey]: undefined,
        [partyQueryKey]: partyQuery,
        warehouse: undefined,
        warehouse_query: '默认仓',
      }),
    );
    expect((payload as { items: unknown[] }).items).toEqual([
      expect.objectContaining({
        item_code: undefined,
        item_query: '圣晶石',
        warehouse: undefined,
        warehouse_query: '临时仓',
      }),
    ]);
  });

  it('preserves product state and never sends opening stock in update mode', () => {
    const state = {
      operation: 'update',
      baseline: { standard_selling_rate: 5 },
      patch: {},
    };
    const draft = {
      company: 'Demo Company',
      draftType: 'product_setup',
      payload: {
        _state: state,
        company: 'Demo Company',
        item_code: 'ITEM-DIMO',
        item_name: '迪莫',
        opening_qty: null,
        operation: 'update',
        standard_selling_rate: 5,
        stock_uom: 'Unit',
      },
    } as unknown as AiDraft;

    const values = getAiDraftFormValues(draft);
    const payload = buildAiDraftPayload(draft, {
      ...values,
      openingQty: 1000,
      standardSellingRate: 6,
      warehouse: 'Stores - DC',
    });

    expect(payload).toEqual(
      expect.objectContaining({
        _state: state,
        item_code: 'ITEM-DIMO',
        operation: 'update',
        standard_selling_rate: 6,
      }),
    );
    expect(payload.opening_qty).toBeUndefined();
    expect(payload.warehouse).toBeUndefined();
  });

  it('treats order items as one explicit conflict field and never merges rows silently', () => {
    const baseItems = [
      {
        itemCode: 'ITEM-001',
        price: 100,
        qty: 1,
        uom: 'Unit',
        warehouse: 'Stores - RD',
      },
    ];
    const localItems = [{ ...baseItems[0], qty: 2 }];
    const latestItems = [{ ...baseItems[0], price: 120 }];

    const differences = buildAiDraftConflictFields(
      'sales_order',
      { items: baseItems },
      { items: localItems },
      { items: latestItems },
    );

    expect(differences).toEqual([
      expect.objectContaining({
        key: 'items',
        label: '商品明细',
        latestChanged: true,
        localChanged: true,
      }),
    ]);
    expect(
      mergeAiDraftConflictValues(
        { items: latestItems },
        { items: localItems },
        [],
      ).items,
    ).toEqual(latestItems);
    expect(
      mergeAiDraftConflictValues(
        { items: latestItems },
        { items: localItems },
        ['items'],
      ).items,
    ).toEqual(localItems);
  });
});
