import type { AiChatMessage, AiCitation } from '@/services/myapp/ai';
import { findPendingInventoryCandidateSelection } from './ai-draft-candidate-selection';

function inventoryDraftCitation(): AiCitation {
  return {
    data: {
      company: 'Demo Company',
      draft_type: 'inventory_adjustment',
      name: 'AI-DRAFT-1',
      payload: {
        adjustment_type: 'increase',
        items: [
          {
            candidates: [
              { item_code: 'COKE-5000', item_name: '可口可乐 5000ml' },
              { item_code: 'PEPSI-5000', item_name: '百事可乐 5000ml' },
              { item_code: 'PEPSI-330', item_name: '百事可乐 330ml' },
            ],
            item_code: null,
            item_query: '可乐',
            qty: 500,
            uom: 'Box',
          },
        ],
      },
      status: 'draft',
      title: '增加可乐库存',
      validation: {
        errors: ['商品无法唯一匹配，请人工选择。'],
        ready_for_handoff: false,
        warnings: [],
      },
      version: 1,
    },
    href: null,
    id: 'AI-DRAFT-1',
    label: '增加可乐库存',
    type: 'ai_draft',
  };
}

const messages: AiChatMessage[] = [
  {
    citations: [inventoryDraftCitation()],
    content: '请选择商品',
    role: 'assistant',
  },
];

describe('findPendingInventoryCandidateSelection', () => {
  it('uniquely matches a more specific product name in the pending draft', () => {
    const result = findPendingInventoryCandidateSelection(messages, '可口可乐');

    expect(result?.draft.name).toBe('AI-DRAFT-1');
    expect(result?.matches).toEqual([
      { itemCode: 'COKE-5000', itemName: '可口可乐 5000ml' },
    ]);
  });

  it('keeps an ambiguous product name unresolved', () => {
    const result = findPendingInventoryCandidateSelection(messages, '百事可乐');

    expect(result?.matches).toHaveLength(2);
  });
});
