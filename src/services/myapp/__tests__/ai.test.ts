import { callGatewayMethod } from '../api-client';
import {
  generateAiInventoryAdjustmentDraft,
  getAiConversation,
  listAiConversations,
  listAiDrafts,
  sendAiChatMessage,
  streamAiChatMessage,
  submitAiFeedback,
} from '../ai';
import { TextDecoder } from 'util';

Object.assign(globalThis, { TextDecoder });

jest.mock('../api-client', () => ({
  callGatewayMethod: jest.fn(),
}));

const mockedCallGatewayMethod = jest.mocked(callGatewayMethod);

describe('AI domain service', () => {
  beforeEach(() => {
    mockedCallGatewayMethod.mockReset();
  });

  it('maps chat, audit and product citation fields', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: {
        conversation: 'AI-CONV-1',
        run_id: 'AI-RUN-1',
        message: {
          role: 'assistant',
          content: '找到一个候选商品',
          citations: [
            {
              type: 'product',
              id: 'ITEM-001',
              label: '测试商品',
              href: '/products/ITEM-001',
              data: { qty: 10, uom_display: '箱' },
            },
          ],
        },
        model: 'gpt-5.5',
        model_alias: 'erp-fast-chat',
        trace_id: 'trace-1',
        run: {
          status: 'completed',
          latency_ms: 920,
          first_token_ms: 180,
        },
        usage: {
          prompt_tokens: 10,
          completion_tokens: 2,
          total_tokens: 12,
          reasoning_tokens: 0,
        },
        warnings: ['只读模式'],
        events: [{ type: 'completed' }],
      },
      meta: {},
      raw: {},
    });

    const result = await sendAiChatMessage({
      company: 'rgc (Demo)',
      content: '蓝色包装商品',
      conversationId: 'AI-CONV-1',
      scenario: 'product_search',
    });

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith('chat_ai_v1', {
      company: 'rgc (Demo)',
      content: '蓝色包装商品',
      conversation_id: 'AI-CONV-1',
      scenario: 'product_search',
    });
    expect(result.conversationId).toBe('AI-CONV-1');
    expect(result.runId).toBe('AI-RUN-1');
    expect(result.message.citations?.[0].id).toBe('ITEM-001');
    expect(result.usage.reasoningTokens).toBe(0);
    expect(result.run).toMatchObject({
      firstTokenMs: 180,
      latencyMs: 920,
      status: 'completed',
    });
    expect(result.events).toEqual([{ type: 'completed' }]);
  });

  it('maps conversation list pagination', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: {
        items: [
          {
            name: 'AI-CONV-1',
            title: '测试会话',
            status: 'active',
            company: 'rgc (Demo)',
            message_count: 2,
          },
        ],
        pagination: { total: 1 },
      },
      meta: {},
      raw: {},
    });

    const result = await listAiConversations();

    expect(result.total).toBe(1);
    expect(result.items[0].messageCount).toBe(2);
  });

  it('generates an inventory adjustment draft through the domain service', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: {
        conversation: 'AI-CONV-INV',
        run_id: 'AI-RUN-INV',
        message: { role: 'assistant', content: '已生成库存调整草稿' },
        draft: {
          name: 'AI-DRAFT-INV',
          title: '库存调整',
          status: 'draft',
          draft_type: 'inventory_adjustment',
          payload: { warehouse: 'Stores - RD' },
          validation: { ready_for_handoff: true, errors: [], warnings: [] },
        },
      },
      meta: {},
      raw: {},
    });

    const result = await generateAiInventoryAdjustmentDraft({
      company: 'rgc (Demo)',
      content: '把 SKU010 库存调整到 8 个',
      conversationId: 'AI-CONV-INV',
    });

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'generate_ai_inventory_adjustment_draft_v1',
      {
        company: 'rgc (Demo)',
        content: '把 SKU010 库存调整到 8 个',
        conversation_id: 'AI-CONV-INV',
      },
    );
    expect(result.draft.name).toBe('AI-DRAFT-INV');
    expect(result.draft.validation.readyForHandoff).toBe(true);
  });

  it('maps the current user draft center with filters and pagination', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: {
        items: [
          {
            name: 'AI-DRAFT-1',
            conversation: 'AI-CONV-1',
            source_run: 'AI-RUN-1',
            draft_type: 'purchase_order',
            status: 'draft',
            company: 'Demo Company',
            title: '采购订单草稿',
            version: 3,
            payload: { supplier: 'SUP-1' },
            validation: {
              ready_for_handoff: false,
              errors: ['缺少商品'],
              warnings: [],
            },
          },
        ],
        pagination: { total: 21 },
      },
      meta: {},
      raw: {},
    });

    const result = await listAiDrafts({
      current: 2,
      draftType: 'purchase_order',
      pageSize: 20,
      status: 'draft',
    });

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith('list_ai_drafts_v1', {
      draft_type: 'purchase_order',
      limit: 20,
      start: 20,
      status: 'draft',
    });
    expect(result.total).toBe(21);
    expect(result.items[0]).toMatchObject({
      conversationId: 'AI-CONV-1',
      draftType: 'purchase_order',
      version: 3,
      validation: { readyForHandoff: false, errors: ['缺少商品'] },
    });
  });

  it('maps persisted conversation messages and citations', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: {
        conversation: {
          name: 'AI-CONV-1',
          title: '测试会话',
          status: 'active',
          message_count: 2,
        },
        messages: [
          {
            name: 'AI-MSG-1',
            sequence: 1,
            role: 'assistant',
            content: '候选商品',
            scenario: 'product_search',
            citations: [{ type: 'product', id: 'ITEM-001', label: '测试商品' }],
            run_id: 'AI-RUN-1',
            run: {
              status: 'completed',
              model_alias: 'erp-fast-chat',
              model: 'provider-model',
              trace_id: 'trace-1',
              latency_ms: 900,
              first_token_ms: 220,
              usage: { total_tokens: 12, reasoning_tokens: 0 },
            },
            feedback: { rating: 'positive', category: 'helpful' },
          },
        ],
      },
      meta: {},
      raw: {},
    });

    const result = await getAiConversation('AI-CONV-1');

    expect(result.messages[0].scenario).toBe('product_search');
    expect(result.messages[0].citations?.[0].id).toBe('ITEM-001');
    expect(result.messages[0].run).toMatchObject({
      modelAlias: 'erp-fast-chat',
      firstTokenMs: 220,
      latencyMs: 900,
      usage: { totalTokens: 12 },
    });
    expect(result.messages[0].feedback?.rating).toBe('positive');
  });

  it('consumes POST SSE events and returns completed chat metadata', async () => {
    const chunks = [
      'data: {"type":"run_started","conversation":"AI-CONV-1","run_id":"AI-RUN-1"}\n\n',
      'data: {"type":"message_delta","delta":"连接"}\n\n',
      'data: {"type":"message_delta","delta":"成功"}\n\n',
      'data: {"type":"completed","conversation":"AI-CONV-1","run_id":"AI-RUN-1","message":{"role":"assistant","content":"连接成功"},"model":"opencode-deepseek-v4-flash","model_alias":"opencode-deepseek-v4-flash","run":{"status":"completed","latency_ms":760,"first_token_ms":120},"usage":{"total_tokens":10},"warnings":[]}\n\n',
    ].map((value) => new Uint8Array(Buffer.from(value)));
    let index = 0;
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: async () =>
            index < chunks.length
              ? { done: false, value: chunks[index++] }
              : { done: true, value: undefined },
        }),
      },
    } as Response);
    const events: string[] = [];

    const result = await streamAiChatMessage(
      { content: '你好', scenario: 'general' },
      (event) => events.push(event.type),
    );

    expect(events).toEqual([
      'run_started',
      'message_delta',
      'message_delta',
      'completed',
    ]);
    expect(result.conversationId).toBe('AI-CONV-1');
    expect(result.message.content).toBe('连接成功');
    expect(result.model).toBe('opencode-deepseek-v4-flash');
    expect(result.run).toMatchObject({ latencyMs: 760, firstTokenMs: 120 });
    fetchMock.mockRestore();
  });

  it('submits feedback against an audited run', async () => {
    mockedCallGatewayMethod.mockResolvedValue({ data: {}, meta: {}, raw: {} });

    await submitAiFeedback({
      runId: 'AI-RUN-1',
      rating: 'negative',
      category: 'incorrect',
      comment: '价格不正确',
    });

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'submit_ai_feedback_v1',
      {
        run_id: 'AI-RUN-1',
        rating: 'negative',
        category: 'incorrect',
        comment: '价格不正确',
      },
    );
  });
});
