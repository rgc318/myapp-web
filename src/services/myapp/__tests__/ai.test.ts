import { callGatewayMethod } from '../api-client';
import {
  AiDraftVersionConflictError,
  cancelAiRun,
  executeAiDraft,
  generateAiInventoryAdjustmentDraft,
  generateAiProductSetupDraft,
  getAiConversation,
  listAiConversations,
  listAiAgentApprovals,
  listAiDrafts,
  listAiSelectableModels,
  renameAiConversation,
  refreshAiBusinessResult,
  resetAiConversationContext,
  resolveAiBusinessResultSet,
  resolveAiDraftCitation,
  resolveAiScenario,
  restoreAiDraftVersion,
  reviewAiAgentApproval,
  sendAiChatMessage,
  streamAiChatMessage,
  submitAiFeedback,
  updateAiDraft,
} from '../ai';
import { runGatewayMutation } from '../mutation';
import { TextDecoder } from 'util';

Object.assign(globalThis, { TextDecoder });

jest.mock('../api-client', () => ({
  callGatewayMethod: jest.fn(),
}));
jest.mock('../mutation', () => ({
  runGatewayMutation: jest.fn(),
}));

const mockedCallGatewayMethod = jest.mocked(callGatewayMethod);
const mockedRunGatewayMutation = jest.mocked(runGatewayMutation);

describe('AI domain service', () => {
  beforeEach(() => {
    mockedCallGatewayMethod.mockReset();
    mockedRunGatewayMutation.mockReset();
  });

  it('executes the confirmed draft with a deterministic version idempotency key', async () => {
    mockedRunGatewayMutation.mockResolvedValue({
      data: {
        draft: {
          name: 'AI-DRAFT-1',
          draft_type: 'sales_order',
          status: 'executed',
          version: 3,
          payload: {},
          validation: { ready_for_handoff: true, errors: [], warnings: [] },
          execution: {
            executed_at: '2026-07-18 12:00:00',
            executed_by: 'user@example.com',
            request_id: 'REQ-1',
            target_doctype: 'Sales Order',
            target_name: 'SO-001',
            result: { order: 'SO-001' },
          },
        },
        execution: {
          executed_at: '2026-07-18 12:00:00',
          executed_by: 'user@example.com',
          request_id: 'REQ-1',
          target_doctype: 'Sales Order',
          target_name: 'SO-001',
          result: { order: 'SO-001' },
        },
        replayed: false,
      },
      idempotencyKey: 'web-execute-ai-draft-AI-DRAFT-1-v3',
    });

    const result = await executeAiDraft('AI-DRAFT-1', 3);

    expect(mockedRunGatewayMutation).toHaveBeenCalledWith(
      'execute_ai_draft_v1',
      expect.objectContaining({
        idempotencyKey: 'web-execute-ai-draft-AI-DRAFT-1-v3',
        notifyError: false,
        payload: {
          confirmed: 1,
          draft_id: 'AI-DRAFT-1',
          expected_version: 3,
        },
      }),
    );
    expect(result.draft.status).toBe('executed');
    expect(result.execution.targetName).toBe('SO-001');
  });

  it('updates a draft through the mutation layer with its expected version', async () => {
    mockedRunGatewayMutation.mockResolvedValue({
      data: {
        name: 'AI-DRAFT-1',
        draft_type: 'sales_order',
        status: 'draft',
        version: 3,
        payload: { remarks: '修改后' },
        validation: { ready_for_handoff: true, errors: [], warnings: [] },
      },
      idempotencyKey: 'REQ-UPDATE-1',
    });

    const result = await updateAiDraft('AI-DRAFT-1', 2, {
      remarks: '修改后',
    });

    expect(mockedRunGatewayMutation).toHaveBeenCalledWith(
      'update_ai_draft_v1',
      {
        notifyError: false,
        payload: {
          draft_id: 'AI-DRAFT-1',
          expected_version: 2,
          payload: { remarks: '修改后' },
        },
      },
    );
    expect(result.version).toBe(3);
  });

  it('cancels a durable AI run through the mutation layer', async () => {
    mockedRunGatewayMutation.mockResolvedValue({
      data: { run_id: 'AI-RUN-1', status: 'cancelled' },
      idempotencyKey: 'REQ-CANCEL-1',
    });

    const result = await cancelAiRun('AI-RUN-1');

    expect(mockedRunGatewayMutation).toHaveBeenCalledWith(
      'cancel_ai_run_v1',
      {
        notifyError: false,
        payload: { run_id: 'AI-RUN-1' },
      },
    );
    expect(result).toEqual({ run_id: 'AI-RUN-1', status: 'cancelled' });
  });

  it('maps the stable draft conflict code to a recoverable domain error', async () => {
    mockedRunGatewayMutation.mockRejectedValue({
      code: 'AI_DRAFT_VERSION_CONFLICT',
      message: '草稿版本已变化，请重新打开最新版本后再保存。',
    });

    await expect(
      updateAiDraft('AI-DRAFT-1', 2, { remarks: '本地修改' }),
    ).rejects.toBeInstanceOf(AiDraftVersionConflictError);
  });

  it('restores a draft version through an idempotent current-version mutation', async () => {
    mockedRunGatewayMutation.mockResolvedValue({
      data: { name: 'AI-DRAFT-1', version: 4 },
      idempotencyKey: 'REQ-RESTORE-1',
    });

    await restoreAiDraftVersion('AI-DRAFT-1', 1, 3);

    expect(mockedRunGatewayMutation).toHaveBeenCalledWith(
      'restore_ai_draft_version_v1',
      {
        idempotencyKey: 'web-restore-ai-draft-AI-DRAFT-1-v3-from-v1',
        payload: {
          draft_id: 'AI-DRAFT-1',
          expected_version: 3,
          version: 1,
        },
      },
    );
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
        stream: {
          delta_count: 18,
          streamed_chars: 42,
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
    expect(result.stream).toEqual({ deltaCount: 18, streamedChars: 42 });
    expect(result.events).toEqual([{ type: 'completed' }]);
  });

  it('maps conversation list pagination', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: {
        capabilities: {
          can_select_fixed_model: true,
          can_view_advanced_diagnostics: true,
        },
        items: [
          {
            name: 'AI-CONV-1',
            title: '测试会话',
            status: 'active',
            company: 'rgc (Demo)',
            message_count: 2,
            pending_draft_count: 2,
          },
        ],
        pagination: { total: 1 },
        pending_draft_total: 3,
      },
      meta: {},
      raw: {},
    });

    const result = await listAiConversations({ search: ' 采购 ' });

    expect(result.total).toBe(1);
    expect(result.pendingDraftTotal).toBe(3);
    expect(result.items[0].messageCount).toBe(2);
    expect(result.items[0].pendingDraftCount).toBe(2);
    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'list_ai_conversations_v1',
      { limit: 50, search: '采购', start: 0, status: 'active' },
    );
  });

  it('renames a conversation through the mutation layer', async () => {
    mockedRunGatewayMutation.mockResolvedValue({
      data: {
        company: 'Demo Company',
        creation: null,
        lastMessageAt: null,
        messageCount: 4,
        modified: '2026-07-24 13:00:00',
        name: 'AI-CONV-1',
        pendingDraftCount: 1,
        status: 'active',
        title: '采购跟进',
      },
      idempotencyKey: 'REQ-1',
    });

    const result = await renameAiConversation('AI-CONV-1', '采购跟进');

    expect(mockedRunGatewayMutation).toHaveBeenCalledWith(
      'rename_ai_conversation_v1',
      {
        payload: { conversation_id: 'AI-CONV-1', title: '采购跟进' },
        transform: expect.any(Function),
      },
    );
    expect(result.title).toBe('采购跟进');
  });

  it('maps user-selectable active model aliases', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: {
        capabilities: {
          can_select_fixed_model: true,
          can_view_advanced_diagnostics: true,
        },
        items: [
          {
            capability: 'fast_chat',
            display_name: 'GLM 5.2',
            model_alias: 'opencode-glm-5.2',
            status: 'active',
            supports_json_schema: 0,
            supports_streaming: 1,
          },
        ],
      },
      meta: {},
      raw: {},
    });

    const result = await listAiSelectableModels();

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'list_ai_selectable_models_v1',
    );
    expect(result.capabilities).toEqual({
      canSelectFixedModel: true,
      canViewAdvancedDiagnostics: true,
    });
    expect(result.models[0]).toMatchObject({
      displayName: 'GLM 5.2',
      modelAlias: 'opencode-glm-5.2',
      supportsStreaming: true,
    });
  });

  it('maps versioned business result metadata and document citations', () => {
    const resultSet = resolveAiBusinessResultSet([
      {
        type: 'business_result_set',
        id: 'RESULT-1',
        label: '业务查询结果',
        href: null,
        data: {
          schema_version: 'business-result-set-v1',
          result_type: 'business_documents',
          permission_filtered: true,
          queried_at: '2026-07-24 11:30:00',
          snapshot_source: 'answer',
          scope: {
            company: 'rgc (Demo)',
            date_range: 'all',
            date_from: null,
            date_to: null,
            status_filter: 'all',
            sort_by: 'latest',
            min_amount: null,
            limit_per_group: 3,
            exclude_cancelled: true,
          },
          groups: [
            {
              entity: 'sales_order',
              label: '销售订单',
              requested_count: 3,
              returned_count: 1,
              available_count: 5,
              module_href: '/sales/orders',
              status: 'partial',
              truncated: true,
            },
            {
              entity: 'sales_invoice',
              label: '销售发票',
              requested_count: 3,
              returned_count: 0,
              status: 'empty',
            },
          ],
        },
      },
      {
        type: 'sales_order',
        id: 'SAL-ORD-1',
        label: '销售订单 SAL-ORD-1 · 客户A',
        href: '/sales/orders/SAL-ORD-1',
        data: {
          party: '客户A',
          company: 'rgc (Demo)',
          transaction_date: '2026-07-17',
          document_status: 'submitted',
          currency: 'CNY',
          amount: 2400,
          outstanding_amount: 0,
        },
      },
    ]);

    expect(resultSet).toMatchObject({
      schemaVersion: 'business-result-set-v1',
      permissionFiltered: true,
      queriedAt: '2026-07-24 11:30:00',
      snapshotSource: 'answer',
      scope: {
        company: 'rgc (Demo)',
        limitPerGroup: 3,
        sortBy: 'latest',
      },
    });
    expect(resultSet?.groups).toHaveLength(2);
    expect(resultSet?.groups[0]).toMatchObject({
      entity: 'sales_order',
      requestedCount: 3,
      returnedCount: 1,
      status: 'partial',
      availableCount: 5,
      moduleHref: '/sales/orders',
      truncated: true,
    });
    expect(resultSet?.groups[0].items[0]).toMatchObject({
      id: 'SAL-ORD-1',
      documentStatus: 'submitted',
      amount: 2400,
      currency: 'CNY',
      snapshotAt: '2026-07-24 11:30:00',
      snapshotSource: 'answer',
    });
    expect(resultSet?.groups[1]).toMatchObject({
      entity: 'sales_invoice',
      returnedCount: 0,
      status: 'empty',
    });
  });

  it('refreshes a business result without sending a model request', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: {
        citations: [
          {
            type: 'business_result_set',
            id: 'RESULT-REFRESHED',
            label: '业务查询结果',
            href: null,
            data: {
              schema_version: 'business-result-set-v1',
              result_type: 'business_documents',
              permission_filtered: true,
              queried_at: '2026-07-24 12:00:00',
              snapshot_source: 'refresh',
              scope: {
                company: 'rgc (Demo)',
                date_range: 'all',
                date_from: null,
                date_to: null,
                exclude_cancelled: true,
                status_filter: 'all',
                sort_by: 'latest',
                min_amount: null,
                limit_per_group: 3,
              },
              groups: [
                {
                  entity: 'sales_order',
                  label: '销售订单',
                  requested_count: 3,
                  returned_count: 0,
                  available_count: 0,
                  module_href: '/sales/orders',
                  status: 'empty',
                  truncated: false,
                },
              ],
            },
          },
        ],
      },
      meta: {},
      raw: {},
    });
    const original = resolveAiBusinessResultSet([
      {
        type: 'business_result_set',
        id: 'RESULT-1',
        label: '业务查询结果',
        href: null,
        data: {
          schema_version: 'business-result-set-v1',
          result_type: 'business_documents',
          scope: {
            company: 'rgc (Demo)',
            date_range: 'all',
            date_from: null,
            date_to: null,
            exclude_cancelled: true,
            status_filter: 'all',
            sort_by: 'latest',
            min_amount: null,
            limit_per_group: 3,
          },
          groups: [
            { entity: 'sales_order', requested_count: 3 },
          ],
        },
      },
    ]);

    const refreshed = await refreshAiBusinessResult(original!);

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'refresh_ai_business_result_v1',
      {
        result_set: expect.objectContaining({
          groups: [{ entity: 'sales_order', requested_count: 3 }],
          result_type: 'business_documents',
          scope: expect.objectContaining({
            company: 'rgc (Demo)',
            exclude_cancelled: true,
            limit_per_group: 3,
          }),
        }),
      },
    );
    expect(refreshed.resultSet).toMatchObject({
      queriedAt: '2026-07-24 12:00:00',
      snapshotSource: 'refresh',
    });
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
      modelAlias: 'gpt-5.5',
    });

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'generate_ai_inventory_adjustment_draft_v1',
      {
        company: 'rgc (Demo)',
        content: '把 SKU010 库存调整到 8 个',
        conversation_id: 'AI-CONV-INV',
        model_alias: 'gpt-5.5',
      },
    );
    expect(result.draft.name).toBe('AI-DRAFT-INV');
    expect(result.draft.validation.readyForHandoff).toBe(true);
  });

  it('resolves product creation and maps a product setup draft', async () => {
    mockedCallGatewayMethod
      .mockResolvedValueOnce({
        data: { scenario: 'product_setup_draft' },
        meta: {},
        raw: {},
      })
      .mockResolvedValueOnce({
        data: {
          conversation: 'AI-CONV-PRODUCT',
          run_id: 'AI-RUN-PRODUCT',
          message: { role: 'assistant', content: '已生成商品建档草稿' },
          draft: {
            name: 'AI-DRAFT-PRODUCT',
            title: '新增传承结晶',
            status: 'draft',
            draft_type: 'product_setup',
            payload: { item_name: '传承结晶' },
            validation: { ready_for_handoff: false, errors: ['缺少估值价'], warnings: [] },
          },
        },
        meta: {},
        raw: {},
      });

    await expect(resolveAiScenario('新增商品传承结晶')).resolves.toBe(
      'product_setup_draft',
    );
    const result = await generateAiProductSetupDraft({
      company: 'rgc (Demo)',
      content: '新增商品传承结晶',
      conversationId: 'AI-CONV-PRODUCT',
      modelAlias: 'gpt-5.5',
    });

    expect(mockedCallGatewayMethod).toHaveBeenNthCalledWith(
      2,
      'generate_ai_product_setup_draft_v1',
      {
        company: 'rgc (Demo)',
        content: '新增商品传承结晶',
        conversation_id: 'AI-CONV-PRODUCT',
        model_alias: 'gpt-5.5',
      },
    );
    expect(result.draft.draftType).toBe('product_setup');
    expect(result.draft.validation.readyForHandoff).toBe(false);
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

  it('normalizes a full ai_draft citation into the shared draft domain model', () => {
    const draft = resolveAiDraftCitation({
      data: {
        draft_type: 'inventory_adjustment',
        payload: {
          items: [{ item_code: 'SKU-001', qty_delta: 5 }],
          warehouse: 'Stores - RD',
        },
        status: 'draft',
        validation: {
          errors: [],
          ready_for_handoff: true,
          warnings: ['请复核估值'],
        },
        version: 2,
      },
      href: null,
      id: 'AI-DRAFT-2',
      label: '库存调整草稿',
      type: 'ai_draft',
    });

    expect(draft).toMatchObject({
      draftType: 'inventory_adjustment',
      name: 'AI-DRAFT-2',
      payload: {
        items: [{ item_code: 'SKU-001', qty_delta: 5 }],
        warehouse: 'Stores - RD',
      },
      title: '库存调整草稿',
      validation: {
        readyForHandoff: true,
        warnings: ['请复核估值'],
      },
      version: 2,
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
        context: {
          status: 'active',
          version: 3,
          updated_at: '2026-07-26 12:00:00',
          expires_at: '2026-08-02 12:00:00',
          context_start_sequence: 1,
          state: { active_scenario: 'product_search' },
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
        pagination: {
          has_more: true,
          limit: 40,
          next_before_sequence: 1,
          returned_count: 1,
          total: 81,
        },
      },
      meta: {},
      raw: {},
    });

    const result = await getAiConversation('AI-CONV-1', {
      beforeSequence: 41,
      limit: 40,
    });

    expect(result.messages[0].scenario).toBe('product_search');
    expect(result.context?.status).toBe('active');
    expect(result.context?.stateVersion).toBe(3);
    expect(result.messages[0].citations?.[0].id).toBe('ITEM-001');
    expect(result.messages[0].run).toMatchObject({
      modelAlias: 'erp-fast-chat',
      firstTokenMs: 220,
      latencyMs: 900,
      usage: { totalTokens: 12 },
    });
    expect(result.messages[0].feedback?.rating).toBe('positive');
    expect(result.pagination).toEqual({
      hasMore: true,
      limit: 40,
      nextBeforeSequence: 1,
      returnedCount: 1,
      total: 81,
    });
    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'get_ai_conversation_v1',
      {
        before_sequence: 41,
        conversation_id: 'AI-CONV-1',
        limit: 40,
      },
    );
  });

  it('clears a conversation working context through the gateway', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: {
        status: 'empty',
        reset_reason: 'user_reset',
        version: 4,
        context_start_sequence: 3,
        state: { active_scenario: 'general' },
      },
      meta: {},
      raw: {},
    });

    const result = await resetAiConversationContext('AI-CONV-1');

    expect(result.status).toBe('empty');
    expect(result.resetReason).toBe('user_reset');
    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'reset_ai_conversation_context_v1',
      { conversation_id: 'AI-CONV-1' },
    );
  });

  it('consumes POST SSE events and returns completed chat metadata', async () => {
    const chunks = [
      'data: {"type":"run_started","conversation":"AI-CONV-1","run_id":"AI-RUN-1"}\n\n',
      'data: {"type":"run_progress","phase":"model_started","message":"模型已接收请求"}\n\n',
      'data: {"type":"message_delta","delta":"连接"}\n\n',
      'data: {"type":"message_delta","delta":"成功"}\n\n',
      'data: {"type":"completed","conversation":"AI-CONV-1","run_id":"AI-RUN-1","message":{"role":"assistant","content":"连接成功"},"model":"opencode-deepseek-v4-flash","model_alias":"opencode-deepseek-v4-flash","run":{"status":"completed","latency_ms":760,"first_token_ms":120},"stream":{"delta_count":2,"streamed_chars":4},"usage":{"total_tokens":10},"warnings":[]}\n\n',
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
      { content: '你好', modelAlias: 'opencode-glm-5.2' },
      (event) => events.push(event.type),
    );

    expect(events).toEqual([
      'run_started',
      'run_progress',
      'message_delta',
      'message_delta',
      'completed',
    ]);
    expect(result.conversationId).toBe('AI-CONV-1');
    expect(result.message.content).toBe('连接成功');
    expect(result.model).toBe('opencode-deepseek-v4-flash');
    expect(result.run).toMatchObject({ latencyMs: 760, firstTokenMs: 120 });
    expect(result.stream).toEqual({ deltaCount: 2, streamedChars: 4 });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      content: '你好',
      model_alias: 'opencode-glm-5.2',
      scenario: 'auto',
    });
    fetchMock.mockRestore();
  });

  it('returns a durable waiting approval result when the SSE run pauses', async () => {
    const chunk = new Uint8Array(
      Buffer.from(
        'data: {"type":"waiting_approval","conversation":"AI-CONV-1","run_id":"AI-RUN-1","latency_ms":230,"approval":{"approval_id":"AI-APPROVAL-1","conversation_id":"AI-CONV-1","run_id":"AI-RUN-1","call_id":"call-1","tool":"sensitive_tool","risk_level":"L3_SENSITIVE","arguments_summary":{"target":"SO-1"},"status":"pending","version":1}}\n\n',
      ),
    );
    let read = false;
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: async () =>
            read
              ? { done: true, value: undefined }
              : ((read = true), { done: false, value: chunk }),
        }),
      },
    } as Response);

    const result = await streamAiChatMessage(
      { content: '执行敏感操作' },
      jest.fn(),
    );

    expect(result.run.status).toBe('waiting_approval');
    expect(result.approval).toMatchObject({
      approvalId: 'AI-APPROVAL-1',
      argumentsSummary: { target: 'SO-1' },
      conversationId: 'AI-CONV-1',
    });
    fetchMock.mockRestore();
  });

  it('lists and reviews owner-scoped agent approvals', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: {
        items: [
          {
            approval_id: 'AI-APPROVAL-1',
            conversation_id: 'AI-CONV-1',
            run_id: 'AI-RUN-1',
            call_id: 'call-1',
            tool: 'sensitive_tool',
            risk_level: 'L3_SENSITIVE',
            arguments_summary: { target: 'SO-1' },
            status: 'pending',
            version: 1,
          },
        ],
        has_more: false,
      },
      meta: {},
      raw: {},
    });
    const approvals = await listAiAgentApprovals({ status: 'pending' });
    expect(approvals.items[0].approvalId).toBe('AI-APPROVAL-1');

    mockedRunGatewayMutation.mockResolvedValue({
      data: {},
      idempotencyKey: 'REQ-APPROVAL-1',
    });
    await reviewAiAgentApproval(approvals.items[0], 'approved');
    expect(mockedRunGatewayMutation).toHaveBeenCalledWith(
      'review_ai_agent_approval_v1',
      expect.objectContaining({
        payload: expect.objectContaining({
          approval_id: 'AI-APPROVAL-1',
          decision: 'approved',
          expected_version: 1,
        }),
      }),
    );
  });

  it('preserves a stable SSE failure code for recovery decisions', async () => {
    const chunk = new Uint8Array(
      Buffer.from(
        'data: {"type":"error","code":"AI_REQUEST_RATE_LIMITED","message":"请求过于频繁","conversation":"AI-CONV-1","run_id":"AI-RUN-1"}\n\n',
      ),
    );
    let read = false;
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: async () =>
            read
              ? { done: true, value: undefined }
              : ((read = true), { done: false, value: chunk }),
        }),
      },
    } as Response);

    await expect(
      streamAiChatMessage({ content: '你好' }, jest.fn()),
    ).rejects.toMatchObject({
      code: 'AI_REQUEST_RATE_LIMITED',
      conversationId: 'AI-CONV-1',
      runId: 'AI-RUN-1',
    });
    fetchMock.mockRestore();
  });

  it('reads gateway error envelopes before an SSE stream is established', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      body: null,
      json: async () => ({
        message: {
          code: 'PERMISSION_DENIED',
          message: '无权访问该公司',
          ok: false,
        },
      }),
      ok: false,
      status: 403,
    } as Response);

    await expect(
      streamAiChatMessage({ content: '查询其他公司' }, jest.fn()),
    ).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
      message: '无权访问该公司',
    });
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
