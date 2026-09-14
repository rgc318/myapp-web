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
        issues: [
          {
            code: 'INVENTORY_REASON_REQUIRED',
            field: 'reason',
            message: '库存调整必须填写盘点差异或业务原因。',
            meta: {},
          },
        ],
        warnings: ['商品“圣晶石”无法唯一匹配，请人工选择。'],
      },
    } as unknown as AiDraft;

    expect(getAiDraftFormValues(draft).itemCode).toBeUndefined();
    expect(getAiDraftFormFieldIssues(draft)).toEqual(
      expect.arrayContaining([
        {
          message: '“圣晶石”尚未匹配到唯一商品，请从下拉结果中选择具体商品。',
          name: 'itemCode',
        },
        {
          message: '库存调整必须填写盘点差异或业务原因。',
          name: 'reason',
        },
      ]),
    );
    expect(buildAiDraftPayload(draft, getAiDraftFormValues(draft))).toEqual(
      expect.objectContaining({
        item_code: undefined,
        item_query: '圣晶石',
      }),
    );
  });

  it('round-trips inventory valuation cost and maps cost validation to its field', () => {
    const draft = {
      company: 'Demo Company',
      draftType: 'inventory_adjustment',
      payload: {
        adjustment_type: 'increase',
        company: 'Demo Company',
        items: [
          {
            current_stock_qty: 0,
            item_code: 'ITEM-001',
            qty: 200,
            stock_uom: 'Nos',
            target_stock_qty: 4800,
            uom: 'Box',
            valuation_input_rate: 60,
            valuation_input_uom: 'Box',
            valuation_rate: 2.5,
            valuation_rate_reference_id: 'PRICE-BOX',
            valuation_rate_source: 'buying_price_reference',
          },
        ],
        posting_date: '2026-09-01',
        reason: '盘点补录',
        warehouse: 'Stores - RD',
      },
      validation: {
        errors: [],
        readyForHandoff: true,
        warnings: [],
      },
    } as unknown as AiDraft;

    const values = getAiDraftFormValues(draft);
    expect(values.valuationRate).toBe(2.5);
    expect(values.valuationInputRate).toBe(60);
    expect(buildAiDraftPayload(draft, values)).toEqual(
      expect.objectContaining({
        valuation_input_rate: 60,
        valuation_input_uom: 'Box',
        valuation_rate: 2.5,
        valuation_rate_reference_id: 'PRICE-BOX',
        valuation_rate_source: 'buying_price_reference',
      }),
    );

    const invalidDraft = {
      ...draft,
      payload: {
        ...draft.payload,
        items: [
          {
            ...((draft.payload.items as Record<string, unknown>[])[0] ?? {}),
            valuation_rate: null,
          },
        ],
      },
      validation: {
        errors: [
          '库存增加会形成新的库存资产，必须填写有效的执行后库存估值单价。',
        ],
        readyForHandoff: false,
        issues: [
          {
            code: 'INVENTORY_VALUATION_REQUIRED',
            field: 'items.0.valuation_rate',
            message:
              '库存增加会形成新的库存资产，必须填写有效的执行后库存估值单价。',
            meta: {},
          },
        ],
        warnings: [],
      },
    } as unknown as AiDraft;
    expect(getAiDraftFormFieldIssues(invalidDraft)).toContainEqual({
      message: '库存增加会形成新的库存资产，必须填写有效的执行后库存估值单价。',
      name: 'valuationInputRate',
    });
  });

  it('maps nested inventory validation paths to top-level inventory fields', () => {
    const draft = {
      company: 'Demo Company',
      draftType: 'inventory_adjustment',
      payload: {
        adjustment_type: 'decrease',
        company: 'Demo Company',
        items: [{ item_code: 'ITEM-001', qty: 20, uom: 'Box' }],
        reason: '盘亏',
        warehouse: 'Stores - RD',
      },
      validation: {
        errors: ['调整后的目标库存不能为负数。', '单位换算无效。'],
        readyForHandoff: false,
        issues: [
          {
            code: 'INVENTORY_TARGET_NEGATIVE',
            field: 'items.0.qty',
            message: '调整后的目标库存不能为负数。',
            meta: {},
          },
          {
            code: 'INVENTORY_UOM_INVALID',
            field: 'items.0.uom',
            message: '单位换算无效。',
            meta: {},
          },
        ],
        warnings: [],
      },
    } as unknown as AiDraft;

    expect(getAiDraftFormFieldIssues(draft)).toEqual(
      expect.arrayContaining([
        { message: '调整后的目标库存不能为负数。', name: 'quantity' },
        { message: '单位换算无效。', name: 'uom' },
      ]),
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

  it('does not submit hidden legacy scalar prices with the per-UOM pricing contract', () => {
    const draft = {
      company: 'Demo Company',
      draftType: 'product_setup',
      payload: {
        _state: { operation: 'update', baseline: {}, patch: {} },
        company: 'Demo Company',
        currency: 'CNY',
        item_code: 'ITEM-PRICED',
        item_name: '按单位计价商品',
        operation: 'update',
        pricing_contract_version: 'product-pricing-v1',
        prices: [
          {
            row_id: 'retail',
            price_list: 'Retail',
            rate: 3,
            uom: 'Bottle',
            currency: 'CNY',
          },
        ],
        stock_uom: 'Bottle',
        uom_relations: [],
      },
    } as unknown as AiDraft;

    const payload = buildAiDraftPayload(draft, getAiDraftFormValues(draft));

    expect(payload).toEqual(
      expect.objectContaining({
        pricing_contract_version: 'product-pricing-v1',
        prices: [expect.objectContaining({ price_list: 'Retail', rate: 3 })],
      }),
    );
    expect(payload).not.toHaveProperty('standard_selling_rate');
    expect(payload).not.toHaveProperty('wholesale_rate');
    expect(payload).not.toHaveProperty('retail_rate');
    expect(payload).not.toHaveProperty('standard_buying_rate');
  });

  it('only marks order item replacement explicit when rows changed or the source draft required it', () => {
    const draft = {
      company: 'Demo Company',
      draftType: 'sales_order',
      payload: {
        company: 'Demo Company',
        customer: 'CUST-1',
        operation: 'update',
        order_number: 'SO-001',
        transaction_date: '2026-08-14',
        delivery_date: '2026-08-15',
        update_items_explicit: false,
        items: [
          {
            item_code: 'ITEM-001',
            price: 10,
            qty: 1,
            uom: 'Unit',
            warehouse: 'Stores - RD',
          },
        ],
      },
    } as unknown as AiDraft;
    const values = getAiDraftFormValues(draft);

    expect(
      buildAiDraftPayload(draft, { ...values, remarks: '只改备注' }),
    ).toEqual(expect.objectContaining({ update_items_explicit: false }));
    expect(
      buildAiDraftPayload(draft, {
        ...values,
        items: [{ ...(values.items?.[0] ?? {}), qty: 2 }],
      }),
    ).toEqual(expect.objectContaining({ update_items_explicit: true }));

    const extractedDraft = {
      ...draft,
      payload: { ...draft.payload, update_items_explicit: true },
    } as unknown as AiDraft;
    expect(
      buildAiDraftPayload(extractedDraft, getAiDraftFormValues(extractedDraft)),
    ).toEqual(expect.objectContaining({ update_items_explicit: true }));
  });

  it('preserves generated header clears and records fields cleared by the user', () => {
    const salesDraft = {
      company: 'Demo Company',
      draftType: 'sales_order',
      payload: {
        company: 'Demo Company',
        customer: 'CUST-1',
        operation: 'update',
        order_number: 'SO-001',
        transaction_date: '2026-09-04',
        delivery_date: '2026-09-05',
        remarks: null,
        header_clear_fields: ['remarks'],
        items: [],
      },
    } as unknown as AiDraft;
    const purchaseDraft = {
      company: 'Demo Company',
      draftType: 'purchase_order',
      payload: {
        company: 'Demo Company',
        supplier: 'SUP-1',
        operation: 'update',
        order_number: 'PO-001',
        transaction_date: '2026-09-04',
        schedule_date: '2026-09-06',
        supplier_ref: 'REF-OLD',
        remarks: '原采购备注',
        items: [],
      },
    } as unknown as AiDraft;

    expect(
      buildAiDraftPayload(salesDraft, getAiDraftFormValues(salesDraft)),
    ).toEqual(expect.objectContaining({ header_clear_fields: ['remarks'] }));

    const purchaseValues = getAiDraftFormValues(purchaseDraft);
    expect(
      buildAiDraftPayload(purchaseDraft, {
        ...purchaseValues,
        remarks: undefined,
        supplierRef: undefined,
      }),
    ).toEqual(
      expect.objectContaining({
        header_clear_fields: ['remarks', 'supplier_ref'],
        remarks: undefined,
        supplier_ref: undefined,
      }),
    );

    expect(
      buildAiDraftPayload(salesDraft, {
        ...getAiDraftFormValues(salesDraft),
        remarks: '重新填写',
      }),
    ).toEqual(expect.objectContaining({ header_clear_fields: [] }));
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
