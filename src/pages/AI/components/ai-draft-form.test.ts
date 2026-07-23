import {
  buildAiDraftConflictFields,
  mergeAiDraftConflictValues,
} from './ai-draft-form';

describe('AI draft conflict form helpers', () => {
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
