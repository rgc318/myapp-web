import type { AiDraft } from '@/services/myapp/ai';
import {
  buildAiDraftConflictFields,
  buildAiDraftPayload,
  getAiDraftFormValues,
  mergeAiDraftConflictValues,
} from './ai-draft-form';

describe('AI draft conflict form helpers', () => {
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
