import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { App, Modal } from 'antd';
import React from 'react';
import AiPage from './index';

let mockLocationSearch = '';

jest.mock('@umijs/max', () => ({
  history: {
    get location() {
      return { search: mockLocationSearch };
    },
    push: jest.fn(),
  },
}));

jest.mock('@ant-design/x', () => {
  const React = jest.requireActual('react');
  return {
    Bubble: {
      List: ({ items }: any) =>
        React.createElement(
          'div',
          { className: 'ant-bubble-list' },
          React.createElement(
            'div',
            { className: 'ant-bubble-list-scroll-box' },
            items.map((item: any) =>
              React.createElement('div', { key: item.key }, item.content),
            ),
          ),
        ),
    },
    Conversations: ({ items = [], menu, onActiveChange }: any) =>
      React.createElement(
        'div',
        null,
        '会话列表',
        items.map((item: any) => {
          const itemMenu = typeof menu === 'function' ? menu(item) : null;
          return React.createElement(
            'div',
            { className: item.className, key: item.key },
            React.createElement(
              'button',
              {
                'aria-label': `打开会话 ${item.key}`,
                onClick: () => onActiveChange?.(item.key),
                type: 'button',
              },
              item.label,
            ),
            itemMenu?.items?.map((menuItem: any) =>
              React.createElement(
                'button',
                {
                  'aria-label': `${menuItem.label} ${item.key}`,
                  key: menuItem.key,
                  onClick: () => itemMenu.onClick?.({ key: menuItem.key }),
                  type: 'button',
                },
                menuItem.label,
              ),
            ),
          );
        }),
      ),
    Prompts: ({ items, onItemClick }: any) =>
      React.createElement(
        'div',
        null,
        items.map((item: any) =>
          React.createElement(
            'button',
            {
              key: item.key,
              onClick: () => onItemClick({ data: item }),
              type: 'button',
            },
            item.label,
          ),
        ),
      ),
    Sender: ({ disabled, loading, onCancel, onChange, onSubmit, value }: any) =>
      React.createElement(
        'div',
        null,
        React.createElement('input', {
          'aria-label': 'AI 输入',
          disabled,
          onChange: (event: any) => onChange(event.target.value),
          value,
        }),
        React.createElement(
          'button',
          { disabled, onClick: () => onSubmit(value), type: 'button' },
          '发送',
        ),
        loading
          ? React.createElement(
              'button',
              { onClick: onCancel, type: 'button' },
              '停止生成',
            )
          : null,
      ),
    Welcome: () => React.createElement('div', null, 'AI 欢迎'),
    XProvider: ({ children }: any) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock('@/components', () => {
  const React = jest.requireActual('react');
  return {
    RemoteLinkSelect: ({ disabled, doctype, onChange, value }: any) =>
      React.createElement(
        'select',
        {
          'aria-label': `${doctype} 选择`,
          disabled,
          onChange: (event: any) => onChange?.(event.target.value),
          value: value ?? '',
        },
        React.createElement('option', { value: '' }, '请选择'),
        React.createElement(
          'option',
          { value: 'Demo Company' },
          'Demo Company',
        ),
        React.createElement(
          'option',
          { value: 'Second Company' },
          'Second Company',
        ),
      ),
  };
});

jest.mock('@/hooks/useWorkspacePreferences', () => ({
  useWorkspacePreferences: () => ({ defaultCompany: 'Demo Company' }),
}));

jest.mock('./components/AiMessageContent', () => {
  const React = jest.requireActual('react');
  return {
    AiMessageContent: ({
      content,
      citations,
      error,
      errorCode,
      feedback,
      onEditRequest,
      onRetry,
      onRefreshBusinessResult,
      onViewDiagnostics,
      onViewRun,
      progressMessage,
      runId,
      streaming,
    }: any) =>
      React.createElement(
        'div',
        null,
        content || (streaming ? progressMessage : ''),
        citations?.length
          ? React.createElement(
              'span',
              null,
              `来源 ${citations.map((citation: any) => citation.id).join(',')}`,
            )
          : null,
        error ? React.createElement('span', null, error) : null,
        feedback ? React.createElement('span', null, `反馈 ${feedback}`) : null,
        errorCode === 'AI_REQUEST_INVALID'
          ? React.createElement('span', null, '需要修改本次问题')
          : null,
        error && errorCode !== 'AI_REQUEST_INVALID' && onRetry
          ? React.createElement(
              'button',
              { onClick: onRetry, type: 'button' },
              '稍后重试',
            )
          : null,
        errorCode === 'AI_REQUEST_INVALID' && onEditRequest
          ? React.createElement(
              'button',
              { onClick: onEditRequest, type: 'button' },
              '修改问题',
            )
          : null,
        error && onViewDiagnostics
          ? React.createElement(
              'button',
              { onClick: onViewDiagnostics, type: 'button' },
              '查看诊断',
            )
          : null,
        runId && !error && onViewRun
          ? React.createElement(
              'button',
              { onClick: onViewRun, type: 'button' },
              '运行详情',
            )
          : null,
        onRefreshBusinessResult &&
          citations?.some(
            (citation: any) => citation.type === 'business_result_set',
          )
          ? React.createElement(
              'button',
              {
                onClick: () =>
                  onRefreshBusinessResult({
                    groups: [],
                    resultType: 'business_documents',
                    scope: {},
                  }),
                type: 'button',
              },
              `刷新 ${content}`,
            )
          : null,
      ),
  };
});

jest.mock('./styles', () => ({
  useAiWorkspaceStyles: () => ({
    styles: new Proxy({}, { get: (_, key) => String(key) }),
  }),
}));

jest.mock('@/services/myapp/ai', () => ({
  archiveAiConversation: jest.fn(),
  cancelAiRun: jest.fn(),
  discardAiDraft: jest.fn(),
  executeAiDraft: jest.fn(),
  generateAiInventoryAdjustmentDraft: jest.fn(),
  generateAiProductSetupDraft: jest.fn(),
  generateAiPurchaseOrderDraft: jest.fn(),
  generateAiSalesOrderDraft: jest.fn(),
  getAiErrorCode: (error: { code?: string } | null) => error?.code ?? null,
  getAiConversation: jest.fn(),
  getAiDraft: jest.fn(),
  listAiConversations: jest
    .fn()
    .mockResolvedValue({ items: [], pendingDraftTotal: 0, total: 0 }),
  listAiAgentApprovals: jest
    .fn()
    .mockResolvedValue({ items: [], hasMore: false }),
  listAiSelectableModels: jest.fn().mockResolvedValue({
    capabilities: {
      canSelectFixedModel: true,
      canViewAdvancedDiagnostics: true,
    },
    models: [
      {
        capability: 'fast_chat',
        displayName: 'GLM 5.2',
        modelAlias: 'opencode-glm-5.2',
        status: 'active',
        supportsJsonSchema: false,
        supportsStreaming: true,
      },
    ],
  }),
  listAiDraftVersions: jest.fn(),
  prepareAiDraftHandoff: jest.fn(),
  renameAiConversation: jest.fn(),
  refreshAiBusinessResult: jest.fn(),
  resetAiConversationContext: jest.fn(),
  reviewAiAgentApproval: jest.fn(),
  resolveAiScenario: jest.fn(),
  restoreAiDraftVersion: jest.fn(),
  streamAiChatMessage: jest.fn(),
  submitAiFeedback: jest.fn(),
  updateAiDraft: jest.fn(),
}));

const {
  cancelAiRun,
  generateAiInventoryAdjustmentDraft,
  generateAiProductSetupDraft,
  getAiConversation,
  listAiConversations,
  listAiAgentApprovals,
  listAiSelectableModels,
  renameAiConversation,
  resolveAiScenario,
  refreshAiBusinessResult,
  resetAiConversationContext,
  reviewAiAgentApproval,
  streamAiChatMessage,
} = jest.requireMock('@/services/myapp/ai');

const buildWaitingApprovalResult = () => ({
  approval: {
    approvalId: 'AI-APPROVAL-1',
    argumentsSummary: { target: 'SO-001' },
    callId: 'call-1',
    conversationId: 'AI-CONV-APPROVAL',
    decisionReason: null,
    expiresAt: '2026-07-27 13:00:00',
    requestedAt: '2026-07-27 12:00:00',
    riskLevel: 'L3_SENSITIVE',
    runId: 'AI-RUN-APPROVAL',
    runStatus: 'waiting_approval',
    status: 'pending',
    tool: 'submit_sales_order',
    version: 1,
  },
  conversationId: 'AI-CONV-APPROVAL',
  events: [],
  message: {
    citations: [],
    content: '该工具调用需要人工审批后才能继续。',
    role: 'assistant',
  },
  model: null,
  modelAlias: null,
  run: {
    error: null,
    errorCode: null,
    firstTokenMs: null,
    latencyMs: 230,
    model: null,
    modelAlias: null,
    status: 'waiting_approval',
    traceId: null,
    usage: {
      completionTokens: 0,
      promptTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
    },
  },
  runId: 'AI-RUN-APPROVAL',
  stream: { deltaCount: 0, streamedChars: 0 },
  traceId: null,
  usage: {
    completionTokens: 0,
    promptTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
  },
  warnings: [],
});

const buildApprovalConversationResult = () => ({
  conversation: {
    company: 'Demo Company',
    creation: '2026-07-27 12:00:00',
    lastMessageAt: '2026-07-27 12:01:00',
    messageCount: 2,
    modified: '2026-07-27 12:01:00',
    name: 'AI-CONV-APPROVAL',
    status: 'active',
    title: '审批恢复会话',
  },
  messages: [],
});

describe('AI workspace page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocationSearch = '';
    cancelAiRun.mockResolvedValue({
      run_id: 'AI-RUN-STOP',
      status: 'cancelled',
    });
    listAiConversations.mockResolvedValue({
      items: [],
      pendingDraftTotal: 0,
      total: 0,
    });
    listAiAgentApprovals.mockResolvedValue({ items: [], hasMore: false });
    reviewAiAgentApproval.mockResolvedValue({ run_status: 'completed' });
    listAiSelectableModels.mockResolvedValue({
      capabilities: {
        canSelectFixedModel: true,
        canViewAdvancedDiagnostics: true,
      },
      models: [
        {
          capability: 'fast_chat',
          displayName: 'GLM 5.2',
          modelAlias: 'opencode-glm-5.2',
          status: 'active',
          supportsJsonSchema: false,
          supportsStreaming: true,
        },
      ],
    });
    renameAiConversation.mockResolvedValue({
      company: 'Demo Company',
      creation: null,
      lastMessageAt: null,
      messageCount: 0,
      modified: null,
      name: 'AI-CONV-1',
      pendingDraftCount: 0,
      status: 'active',
      title: '新名称',
    });
    resetAiConversationContext.mockResolvedValue({
      contextStartSequence: 3,
      expiresAt: null,
      resetReason: 'user_reset',
      state: { active_scenario: 'general' },
      stateVersion: 2,
      status: 'empty',
      updatedAt: '2026-07-26 12:00:00',
    });
    resolveAiScenario.mockImplementation(async (content: string) => {
      if (content.includes('销售订单')) return 'order_query';
      if (
        content.includes('商品') ||
        content.includes('蓝色包装') ||
        content.includes('入库')
      ) {
        return 'product_search';
      }
      return 'general';
    });
    generateAiProductSetupDraft.mockResolvedValue({
      conversationId: 'AI-CONV-DRAFT',
      draft: {
        company: 'Demo Company',
        conversationId: 'AI-CONV-DRAFT',
        draftType: 'product_setup',
        name: 'AI-DRAFT-1',
        payload: { itemName: '煌星' },
        status: 'draft',
        title: '添加一个新商品，煌星',
        validation: { errors: [], readyForHandoff: false, warnings: [] },
        version: 1,
      },
      events: [],
      message: { content: '已生成商品建档草稿', role: 'assistant' },
      model: 'provider-model',
      modelAlias: 'erp-fast-chat',
      run: {
        error: null,
        errorCode: null,
        firstTokenMs: null,
        latencyMs: 760,
        model: 'provider-model',
        modelAlias: 'erp-fast-chat',
        status: 'completed',
        traceId: 'trace-draft',
        usage: {
          completionTokens: 20,
          promptTokens: 80,
          reasoningTokens: 0,
          totalTokens: 100,
        },
      },
      runId: 'AI-RUN-DRAFT',
      stream: { deltaCount: 0, streamedChars: 0 },
      traceId: 'trace-draft',
      usage: {
        completionTokens: 20,
        promptTokens: 80,
        reasoningTokens: 0,
        totalTokens: 100,
      },
      warnings: [],
    });
    generateAiInventoryAdjustmentDraft.mockResolvedValue({
      conversationId: 'AI-CONV-INVENTORY-DRAFT',
      draft: {
        company: 'Demo Company',
        conversationId: 'AI-CONV-INVENTORY-DRAFT',
        draftType: 'inventory_adjustment',
        name: 'AI-DRAFT-INVENTORY-1',
        payload: { itemCode: 'DIMO', quantity: 10 },
        status: 'draft',
        title: '给迪莫添加10个库存',
        validation: { errors: [], readyForHandoff: true, warnings: [] },
        version: 1,
      },
      events: [],
      message: { content: '已生成库存调整草稿', role: 'assistant' },
      model: 'provider-model',
      modelAlias: 'opencode-glm-5.2',
      run: {
        error: null,
        errorCode: null,
        firstTokenMs: null,
        latencyMs: 760,
        model: 'provider-model',
        modelAlias: 'opencode-glm-5.2',
        status: 'completed',
        traceId: 'trace-inventory-draft',
        usage: {
          completionTokens: 20,
          promptTokens: 80,
          reasoningTokens: 0,
          totalTokens: 100,
        },
      },
      runId: 'AI-RUN-INVENTORY-DRAFT',
      stream: { deltaCount: 0, streamedChars: 0 },
      traceId: 'trace-inventory-draft',
      usage: {
        completionTokens: 20,
        promptTokens: 80,
        reasoningTokens: 0,
        totalTokens: 100,
      },
      warnings: [],
    });
    streamAiChatMessage.mockImplementation(
      async (_payload: unknown, onEvent: any) => {
        onEvent({
          conversation: 'AI-CONV-1',
          run_id: 'AI-RUN-1',
          type: 'run_started',
        });
        onEvent({
          message: '模型已接收请求，等待首个 Token',
          phase: 'model_started',
          type: 'run_progress',
        });
        onEvent({ tool: 'search_products', type: 'tool_started' });
        onEvent({
          result_count: 2,
          tool: 'search_products',
          type: 'tool_completed',
        });
        onEvent({ message: '只读模式', type: 'warning' });
        onEvent({ delta: '找到两个商品', type: 'message_delta' });
        return {
          conversationId: 'AI-CONV-1',
          events: [],
          message: { content: '找到两个商品', role: 'assistant' },
          model: 'provider-model',
          modelAlias: 'erp-fast-chat',
          run: {
            error: null,
            errorCode: null,
            firstTokenMs: 120,
            latencyMs: 760,
            model: 'provider-model',
            modelAlias: 'erp-fast-chat',
            status: 'completed',
            traceId: 'trace-1',
            usage: {
              completionTokens: 20,
              promptTokens: 80,
              reasoningTokens: 0,
              totalTokens: 100,
            },
          },
          runId: 'AI-RUN-1',
          stream: { deltaCount: 12, streamedChars: 6 },
          traceId: 'trace-1',
          usage: {
            completionTokens: 20,
            promptTokens: 80,
            reasoningTokens: 0,
            totalTokens: 100,
          },
          warnings: ['只读模式'],
        };
      },
    );
  });

  it('submits a streamed request and renders durable diagnostics', async () => {
    render(React.createElement(App, null, React.createElement(AiPage)));

    fireEvent.change(screen.getByRole('textbox', { name: 'AI 输入' }), {
      target: { value: '查找蓝色包装商品' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => {
      expect(streamAiChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          company: 'Demo Company',
          content: '查找蓝色包装商品',
          scenario: 'auto',
        }),
        expect.any(Function),
        expect.any(AbortSignal),
      );
    });
    expect(await screen.findByText('找到两个商品')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '当前运行' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /运行详情/ }));
    expect(screen.getByText('已完成')).toBeTruthy();
    expect(screen.getByText('760 ms')).toBeTruthy();
    expect(screen.getByText('search_products')).toBeTruthy();
    expect(screen.getByText('完成 · 2 项')).toBeTruthy();
    expect(screen.getByText('只读模式')).toBeTruthy();
  });

  it('cancels the durable run before aborting the local stream', async () => {
    let observedSignal: AbortSignal | undefined;
    streamAiChatMessage.mockImplementationOnce(
      async (_payload: unknown, onEvent: any, signal?: AbortSignal) => {
        observedSignal = signal;
        onEvent({
          conversation: 'AI-CONV-STOP',
          run_id: 'AI-RUN-STOP',
          type: 'run_started',
        });
        return await new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      },
    );

    render(React.createElement(App, null, React.createElement(AiPage)));
    fireEvent.change(screen.getByRole('textbox', { name: 'AI 输入' }), {
      target: { value: '停止这个回答' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));

    await screen.findByRole('button', { name: '运行详情' });
    fireEvent.click(await screen.findByRole('button', { name: '停止生成' }));

    await waitFor(() => {
      expect(cancelAiRun).toHaveBeenCalledWith('AI-RUN-STOP');
      expect(observedSignal?.aborted).toBe(true);
    });
  });

  it('pauses the composer and resumes the original Run after approval', async () => {
    let modalConfig: any;
    let resolveInitialApprovals:
      | ((value: { items: never[]; hasMore: boolean }) => void)
      | undefined;
    const confirmSpy = jest
      .spyOn(Modal, 'confirm')
      .mockImplementation((config: any) => {
        modalConfig = config;
        return { destroy: jest.fn(), update: jest.fn() } as any;
      });
    streamAiChatMessage.mockResolvedValueOnce(buildWaitingApprovalResult());
    getAiConversation.mockResolvedValueOnce(buildApprovalConversationResult());
    listAiAgentApprovals.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveInitialApprovals = resolve;
        }),
    );

    render(React.createElement(App, null, React.createElement(AiPage)));
    fireEvent.change(screen.getByRole('textbox', { name: 'AI 输入' }), {
      target: { value: '提交销售订单' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));

    expect(await screen.findByText('AI Run 正在等待人工审批')).toBeTruthy();
    expect(screen.getByText(/工具：submit_sales_order/)).toBeTruthy();
    expect(
      screen.getByRole<HTMLInputElement>('textbox', { name: 'AI 输入' })
        .disabled,
    ).toBe(true);
    await act(async () => {
      resolveInitialApprovals?.({ items: [], hasMore: false });
    });
    expect(screen.getByText('AI Run 正在等待人工审批')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '批准并继续' }));
    expect(modalConfig.title).toBe('批准并继续此工具调用？');
    await act(async () => {
      await modalConfig.onOk();
    });

    await waitFor(() =>
      expect(reviewAiAgentApproval).toHaveBeenCalledWith(
        expect.objectContaining({ approvalId: 'AI-APPROVAL-1' }),
        'approved',
        undefined,
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLInputElement>('textbox', { name: 'AI 输入' })
          .disabled,
      ).toBe(false),
    );
    confirmSpy.mockRestore();
  });

  it('requires a reason before rejecting a paused tool call', async () => {
    let modalConfig: any;
    const confirmSpy = jest
      .spyOn(Modal, 'confirm')
      .mockImplementation((config: any) => {
        modalConfig = config;
        return { destroy: jest.fn(), update: jest.fn() } as any;
      });
    streamAiChatMessage.mockResolvedValueOnce(buildWaitingApprovalResult());
    getAiConversation.mockResolvedValueOnce(buildApprovalConversationResult());
    listAiAgentApprovals.mockResolvedValue({
      items: [buildWaitingApprovalResult().approval],
      hasMore: false,
    });

    render(React.createElement(App, null, React.createElement(AiPage)));
    await waitFor(() => expect(listAiAgentApprovals).toHaveBeenCalled());
    fireEvent.change(screen.getByRole('textbox', { name: 'AI 输入' }), {
      target: { value: '提交销售订单' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));
    await waitFor(() => expect(streamAiChatMessage).toHaveBeenCalled());
    expect(await screen.findByText('AI Run 正在等待人工审批')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: /拒\s*绝/ }));

    expect(modalConfig.title).toBe('拒绝此工具调用？');
    await expect(modalConfig.onOk()).rejects.toBeUndefined();
    expect(reviewAiAgentApproval).not.toHaveBeenCalled();

    modalConfig.content.props.onChange({
      target: { value: '业务条件尚未确认' },
    });
    await act(async () => {
      await modalConfig.onOk();
    });

    await waitFor(() =>
      expect(reviewAiAgentApproval).toHaveBeenCalledWith(
        expect.objectContaining({ approvalId: 'AI-APPROVAL-1' }),
        'rejected',
        '业务条件尚未确认',
      ),
    );
    confirmSpy.mockRestore();
  });

  it('opens the persisted Run attached to each historical answer', async () => {
    mockLocationSearch = '?conversation=AI-CONV-HISTORY';
    getAiConversation.mockResolvedValueOnce({
      conversation: {
        company: 'Demo Company',
        creation: '2026-07-24 09:00:00',
        lastMessageAt: '2026-07-24 09:05:00',
        messageCount: 4,
        modified: '2026-07-24 09:05:00',
        name: 'AI-CONV-HISTORY',
        status: 'active',
        title: '历史运行',
      },
      messages: [
        {
          citations: [],
          content: '查询商品',
          creation: '2026-07-24 09:00:00',
          feedback: null,
          name: 'AI-MSG-USER-1',
          promptVersion: null,
          role: 'user',
          run: null,
          runId: null,
          scenario: 'product_search',
          sequence: 1,
        },
        {
          citations: [],
          content: '第一条回答',
          creation: '2026-07-24 09:01:00',
          feedback: null,
          name: 'AI-MSG-ASSISTANT-1',
          promptVersion: 'erp-readonly-v5',
          role: 'assistant',
          run: {
            error: null,
            errorCode: null,
            firstTokenMs: 90,
            latencyMs: 410,
            model: 'provider-model-old',
            modelAlias: 'erp-history-old',
            status: 'completed',
            traceId: 'trace-history-1',
            usage: {
              completionTokens: 12,
              promptTokens: 30,
              reasoningTokens: 0,
              totalTokens: 42,
            },
          },
          runId: 'AI-RUN-HISTORY-1',
          scenario: 'product_search',
          sequence: 2,
        },
        {
          citations: [],
          content: '查询订单',
          creation: '2026-07-24 09:04:00',
          feedback: null,
          name: 'AI-MSG-USER-2',
          promptVersion: null,
          role: 'user',
          run: null,
          runId: null,
          scenario: 'order_query',
          sequence: 3,
        },
        {
          citations: [],
          content: '第二条回答',
          creation: '2026-07-24 09:05:00',
          feedback: null,
          name: 'AI-MSG-ASSISTANT-2',
          promptVersion: 'erp-readonly-v5',
          role: 'assistant',
          run: {
            error: null,
            errorCode: null,
            firstTokenMs: 180,
            latencyMs: 1200,
            model: 'provider-model-new',
            modelAlias: 'erp-history-new',
            status: 'completed',
            traceId: 'trace-history-2',
            usage: {
              completionTokens: 24,
              promptTokens: 60,
              reasoningTokens: 3,
              totalTokens: 87,
            },
          },
          runId: 'AI-RUN-HISTORY-2',
          scenario: 'order_query',
          sequence: 4,
        },
      ],
    });

    render(React.createElement(App, null, React.createElement(AiPage)));

    const runButtons = await screen.findAllByRole('button', {
      name: '运行详情',
    });
    fireEvent.click(runButtons[0]);
    expect(screen.getByText('商品查询')).toBeTruthy();
    expect(screen.getByText('410 ms')).toBeTruthy();
    fireEvent.click(screen.getByText('高级诊断'));
    expect(screen.getByText('erp-history-old')).toBeTruthy();
    expect(screen.getByText('AI-RUN-HISTORY-1')).toBeTruthy();

    fireEvent.click(runButtons[1]);
    expect(screen.getByText('订单查询')).toBeTruthy();
    expect(screen.getByText('1.20 秒')).toBeTruthy();
    expect(screen.getByText('erp-history-new')).toBeTruthy();
    expect(screen.getByText('AI-RUN-HISTORY-2')).toBeTruthy();
  });

  it('loads older messages without replacing the composer or current message state', async () => {
    mockLocationSearch = '?conversation=AI-CONV-LONG';
    const conversation = {
      company: 'Demo Company',
      creation: '2026-07-24 09:00:00',
      lastMessageAt: '2026-07-24 10:00:00',
      messageCount: 6,
      modified: '2026-07-24 10:00:00',
      name: 'AI-CONV-LONG',
      status: 'active',
      title: '长会话',
    };
    getAiConversation
      .mockResolvedValueOnce({
        conversation,
        messages: [
          {
            citations: [],
            content: '当前问题',
            creation: '2026-07-24 09:59:00',
            feedback: null,
            name: 'AI-MSG-5',
            promptVersion: null,
            role: 'user',
            run: null,
            runId: null,
            scenario: 'general',
            sequence: 5,
          },
          {
            citations: [],
            content: '当前回答',
            creation: '2026-07-24 10:00:00',
            feedback: null,
            name: 'AI-MSG-6',
            promptVersion: 'erp-readonly-v7',
            role: 'assistant',
            run: {
              error: null,
              errorCode: null,
              firstTokenMs: 100,
              latencyMs: 600,
              model: 'provider-current',
              modelAlias: 'erp-current',
              status: 'completed',
              traceId: 'trace-current',
              usage: {
                completionTokens: 5,
                promptTokens: 10,
                reasoningTokens: 0,
                totalTokens: 15,
              },
            },
            runId: 'AI-RUN-6',
            scenario: 'general',
            sequence: 6,
          },
        ],
        pagination: {
          hasMore: true,
          limit: 40,
          nextBeforeSequence: 5,
          returnedCount: 2,
          total: 6,
        },
      })
      .mockResolvedValueOnce({
        conversation,
        messages: [
          {
            citations: [],
            content: '较早问题',
            creation: '2026-07-24 09:00:00',
            feedback: null,
            name: 'AI-MSG-1',
            promptVersion: null,
            role: 'user',
            run: null,
            runId: null,
            scenario: 'product_search',
            sequence: 1,
          },
          {
            citations: [
              {
                data: {},
                href: '/products/ITEM-OLD',
                id: 'ITEM-OLD',
                label: '旧商品',
                type: 'product',
              },
            ],
            content: '较早回答',
            creation: '2026-07-24 09:01:00',
            feedback: {
              category: 'helpful',
              comment: null,
              rating: 'positive',
            },
            name: 'AI-MSG-2',
            promptVersion: 'erp-readonly-v7',
            role: 'assistant',
            run: {
              error: null,
              errorCode: null,
              firstTokenMs: 120,
              latencyMs: 450,
              model: 'provider-old',
              modelAlias: 'erp-old',
              status: 'completed',
              traceId: 'trace-old',
              usage: {
                completionTokens: 4,
                promptTokens: 8,
                reasoningTokens: 0,
                totalTokens: 12,
              },
            },
            runId: 'AI-RUN-2',
            scenario: 'product_search',
            sequence: 2,
          },
          {
            citations: [],
            content: '失败问题',
            creation: '2026-07-24 09:10:00',
            feedback: null,
            name: 'AI-MSG-3',
            promptVersion: null,
            role: 'user',
            run: null,
            runId: null,
            scenario: 'order_query',
            sequence: 3,
          },
          {
            citations: [],
            content: '',
            creation: '2026-07-24 09:11:00',
            feedback: null,
            name: 'AI-MSG-4',
            promptVersion: 'erp-readonly-v7',
            role: 'assistant',
            run: {
              error: '历史请求失败',
              errorCode: 'AI_SERVICE_UNAVAILABLE',
              firstTokenMs: null,
              latencyMs: 300,
              model: null,
              modelAlias: 'erp-old',
              status: 'failed',
              traceId: 'trace-failed',
              usage: {
                completionTokens: 0,
                promptTokens: 0,
                reasoningTokens: 0,
                totalTokens: 0,
              },
            },
            runId: 'AI-RUN-4',
            scenario: 'order_query',
            sequence: 4,
          },
        ],
        pagination: {
          hasMore: false,
          limit: 40,
          nextBeforeSequence: null,
          returnedCount: 4,
          total: 6,
        },
      });

    render(React.createElement(App, null, React.createElement(AiPage)));

    const composer = await screen.findByRole<HTMLInputElement>('textbox', {
      name: 'AI 输入',
    });
    const scrollBox = document.querySelector<HTMLElement>(
      '.ant-bubble-list-scroll-box',
    );
    expect(scrollBox).not.toBeNull();
    Object.defineProperty(scrollBox, 'scrollHeight', {
      configurable: true,
      get: () => (screen.queryByText('较早回答') ? 500 : 200),
    });
    if (scrollBox) scrollBox.scrollTop = 50;
    fireEvent.change(composer, { target: { value: '尚未发送的文本' } });
    fireEvent.click(
      await screen.findByRole('button', { name: /加载更早消息/ }),
    );

    expect(await screen.findByText('较早回答')).toBeTruthy();
    expect(screen.getByText(/来源 ITEM-OLD/)).toBeTruthy();
    expect(screen.getByText('反馈 positive')).toBeTruthy();
    expect(screen.getByText('历史请求失败')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '稍后重试' })).toBeNull();
    expect(composer.value).toBe('尚未发送的文本');
    await waitFor(() => expect(scrollBox?.scrollTop).toBe(350));
    expect(getAiConversation).toHaveBeenLastCalledWith('AI-CONV-LONG', {
      beforeSequence: 5,
      limit: 40,
    });

    const runButtons = screen.getAllByRole('button', { name: '运行详情' });
    fireEvent.click(runButtons[0]);
    expect(screen.getByText('商品查询')).toBeTruthy();
    expect(screen.getByText('450 ms')).toBeTruthy();
  });

  it('refreshes only the selected historical business result without calling the model', async () => {
    mockLocationSearch = '?conversation=AI-CONV-RESULTS';
    getAiConversation.mockResolvedValueOnce({
      conversation: {
        company: 'Demo Company',
        creation: '2026-07-24 09:00:00',
        lastMessageAt: '2026-07-24 09:05:00',
        messageCount: 4,
        modified: '2026-07-24 09:05:00',
        name: 'AI-CONV-RESULTS',
        status: 'active',
        title: '业务结果刷新',
      },
      messages: [
        {
          citations: [],
          content: '第一次查询',
          creation: '2026-07-24 09:00:00',
          feedback: null,
          name: 'AI-MSG-USER-1',
          promptVersion: null,
          role: 'user',
          run: null,
          runId: null,
          scenario: 'order_query',
          sequence: 1,
        },
        {
          citations: [
            {
              data: { result_type: 'business_documents' },
              href: null,
              id: 'RESULT-OLD-1',
              label: '业务查询结果',
              type: 'business_result_set',
            },
            {
              data: {},
              href: '/sales/orders/SO-OLD-1',
              id: 'SO-OLD-1',
              label: 'SO-OLD-1',
              type: 'sales_order',
            },
            {
              data: {},
              href: '/products/ITEM-KEEP',
              id: 'ITEM-KEEP',
              label: '保留来源',
              type: 'product',
            },
          ],
          content: '第一条业务回答',
          creation: '2026-07-24 09:01:00',
          feedback: null,
          name: 'AI-MSG-ASSISTANT-1',
          promptVersion: 'erp-readonly-v5',
          role: 'assistant',
          run: null,
          runId: null,
          scenario: 'order_query',
          sequence: 2,
        },
        {
          citations: [],
          content: '第二次查询',
          creation: '2026-07-24 09:04:00',
          feedback: null,
          name: 'AI-MSG-USER-2',
          promptVersion: null,
          role: 'user',
          run: null,
          runId: null,
          scenario: 'order_query',
          sequence: 3,
        },
        {
          citations: [
            {
              data: { result_type: 'business_documents' },
              href: null,
              id: 'RESULT-OLD-2',
              label: '业务查询结果',
              type: 'business_result_set',
            },
          ],
          content: '第二条业务回答',
          creation: '2026-07-24 09:05:00',
          feedback: null,
          name: 'AI-MSG-ASSISTANT-2',
          promptVersion: 'erp-readonly-v5',
          role: 'assistant',
          run: null,
          runId: null,
          scenario: 'order_query',
          sequence: 4,
        },
      ],
    });
    refreshAiBusinessResult.mockResolvedValueOnce({
      citations: [
        {
          data: {
            queried_at: '2026-07-24 12:00:00',
            result_type: 'business_documents',
            snapshot_source: 'refresh',
          },
          href: null,
          id: 'RESULT-NEW-1',
          label: '业务查询结果',
          type: 'business_result_set',
        },
        {
          data: {},
          href: '/sales/orders/SO-NEW-1',
          id: 'SO-NEW-1',
          label: 'SO-NEW-1',
          type: 'sales_order',
        },
      ],
      resultSet: {},
    });

    render(React.createElement(App, null, React.createElement(AiPage)));

    fireEvent.click(
      await screen.findByRole('button', { name: '刷新 第一条业务回答' }),
    );

    await waitFor(() => expect(refreshAiBusinessResult).toHaveBeenCalled());
    expect(
      await screen.findByText(/来源 ITEM-KEEP,RESULT-NEW-1,SO-NEW-1/),
    ).toBeTruthy();
    expect(screen.getByText(/来源 RESULT-OLD-2/)).toBeTruthy();
    expect(streamAiChatMessage).not.toHaveBeenCalled();
  });

  it('fills a common prompt into the composer without sending immediately', async () => {
    render(React.createElement(App, null, React.createElement(AiPage)));

    fireEvent.click(
      screen.getByRole('button', {
        name: '查询近30天未完成的大额采购订单，前5条。',
      }),
    );

    expect(
      screen.getByRole<HTMLInputElement>('textbox', { name: 'AI 输入' }).value,
    ).toBe('查询近30天未完成的大额采购订单，前5条。');
    expect(streamAiChatMessage).not.toHaveBeenCalled();
  });

  it('searches conversations on the server and shows draft workload metadata', async () => {
    listAiConversations.mockResolvedValue({
      items: [
        {
          company: 'Demo Company',
          creation: '2026-07-24 09:00:00',
          lastMessageAt: '2026-07-24 10:30:00',
          messageCount: 6,
          modified: '2026-07-24 10:30:00',
          name: 'AI-CONV-1',
          pendingDraftCount: 2,
          status: 'active',
          title: '采购跟进',
        },
      ],
      pendingDraftTotal: 3,
      total: 1,
    });

    render(React.createElement(App, null, React.createElement(AiPage)));

    expect(await screen.findAllByText('采购跟进')).not.toHaveLength(0);
    expect(screen.getAllByText('待复核草稿 2')).not.toHaveLength(0);
    expect(
      screen.getAllByText('待复核草稿 2')[0].closest('.conversationItem'),
    ).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();

    const search = screen.getByRole<HTMLInputElement>('searchbox', {
      name: '搜索 AI 会话',
    });
    fireEvent.change(search, { target: { value: ' 相机 ' } });
    fireEvent.keyDown(search, { code: 'Enter', key: 'Enter' });

    await waitFor(() =>
      expect(listAiConversations).toHaveBeenLastCalledWith({
        limit: 50,
        search: '相机',
        status: 'active',
      }),
    );
  });

  it('renames a conversation from the conversation menu', async () => {
    listAiConversations.mockResolvedValue({
      items: [
        {
          company: 'Demo Company',
          creation: '2026-07-24 09:00:00',
          lastMessageAt: '2026-07-24 10:30:00',
          messageCount: 6,
          modified: '2026-07-24 10:30:00',
          name: 'AI-CONV-1',
          pendingDraftCount: 0,
          status: 'active',
          title: '旧名称',
        },
      ],
      pendingDraftTotal: 0,
      total: 1,
    });

    render(React.createElement(App, null, React.createElement(AiPage)));

    fireEvent.click(
      (
        await screen.findAllByRole('button', {
          name: '重命名 AI-CONV-1',
        })
      )[0],
    );
    const titleInput = screen.getByRole<HTMLInputElement>('textbox', {
      name: '会话名称',
    });
    expect(titleInput.value).toBe('旧名称');
    fireEvent.change(titleInput, { target: { value: '采购跟进' } });
    fireEvent.click(screen.getByRole('button', { name: '保存名称' }));

    await waitFor(() =>
      expect(renameAiConversation).toHaveBeenCalledWith(
        'AI-CONV-1',
        '采购跟进',
      ),
    );
  });

  it('keeps unsent composer text separately for each conversation', async () => {
    const conversationItems = ['AI-CONV-1', 'AI-CONV-2'].map((name) => ({
      company: 'Demo Company',
      creation: '2026-07-24 09:00:00',
      lastMessageAt: '2026-07-24 10:30:00',
      messageCount: 0,
      modified: '2026-07-24 10:30:00',
      name,
      pendingDraftCount: 0,
      status: 'active',
      title: name,
    }));
    listAiConversations.mockResolvedValue({
      items: conversationItems,
      pendingDraftTotal: 0,
      total: 2,
    });
    getAiConversation.mockImplementation(async (targetId: string) => ({
      conversation: conversationItems.find((item) => item.name === targetId),
      messages: [],
      pagination: {
        hasMore: false,
        limit: 40,
        nextBeforeSequence: null,
        returnedCount: 0,
        total: 0,
      },
    }));

    render(React.createElement(App, null, React.createElement(AiPage)));

    const openConversation = async (targetId: string) => {
      fireEvent.click(
        (
          await screen.findAllByRole('button', {
            name: `打开会话 ${targetId}`,
          })
        )[0],
      );
      await waitFor(() =>
        expect(getAiConversation).toHaveBeenLastCalledWith(targetId, {
          limit: 40,
        }),
      );
    };
    const composer = screen.getByRole<HTMLInputElement>('textbox', {
      name: 'AI 输入',
    });

    await openConversation('AI-CONV-1');
    fireEvent.change(composer, { target: { value: '会话一未发送' } });
    await openConversation('AI-CONV-2');
    expect(composer.value).toBe('');
    fireEvent.change(composer, { target: { value: '会话二未发送' } });
    await openConversation('AI-CONV-1');
    expect(composer.value).toBe('会话一未发送');
    await openConversation('AI-CONV-2');
    expect(composer.value).toBe('会话二未发送');
  });

  it('keeps a failed answer inline with a retry action', async () => {
    streamAiChatMessage.mockRejectedValueOnce(new Error('AI 服务暂时不可用'));
    render(React.createElement(App, null, React.createElement(AiPage)));

    fireEvent.change(screen.getByRole('textbox', { name: 'AI 输入' }), {
      target: { value: '查询库存' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));

    expect(await screen.findByText('AI 服务暂时不可用')).toBeTruthy();
    expect(screen.getByRole('button', { name: '稍后重试' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '查看诊断' })).toBeTruthy();
  });

  it('restores an invalid request for editing instead of retrying it unchanged', async () => {
    streamAiChatMessage.mockRejectedValueOnce(
      Object.assign(new Error('请求内容未通过校验'), {
        code: 'AI_REQUEST_INVALID',
      }),
    );
    render(React.createElement(App, null, React.createElement(AiPage)));

    fireEvent.change(screen.getByRole('textbox', { name: 'AI 输入' }), {
      target: { value: '原始问题' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));

    expect(await screen.findByText('需要修改本次问题')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '稍后重试' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /修改问题/ }));
    expect(
      screen.getByRole<HTMLInputElement>('textbox', { name: 'AI 输入' }).value,
    ).toBe('原始问题');
  });

  it('renders archived conversations as read-only', async () => {
    mockLocationSearch = '?conversation=AI-CONV-ARCHIVED';
    getAiConversation.mockResolvedValueOnce({
      conversation: {
        company: 'Demo Company',
        creation: '2026-07-16 10:00:00',
        lastMessageAt: '2026-07-16 10:00:00',
        messageCount: 0,
        modified: '2026-07-16 10:00:00',
        name: 'AI-CONV-ARCHIVED',
        status: 'archived',
        title: '归档会话',
      },
      messages: [],
    });

    render(React.createElement(App, null, React.createElement(AiPage)));

    expect(await screen.findByText('当前会话为只读状态')).toBeTruthy();
    expect(
      screen.getByRole<HTMLInputElement>('textbox', { name: 'AI 输入' })
        .disabled,
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: '发送' }).disabled,
    ).toBe(true);
    expect(screen.queryByRole('button', { name: '归档' })).toBeNull();
  });

  it('restores a failed active run with its inline retry context', async () => {
    mockLocationSearch = '?conversation=AI-CONV-FAILED';
    getAiConversation.mockResolvedValueOnce({
      conversation: {
        company: 'Demo Company',
        creation: '2026-07-23 10:00:00',
        lastMessageAt: '2026-07-23 10:01:00',
        messageCount: 2,
        modified: '2026-07-23 10:01:00',
        name: 'AI-CONV-FAILED',
        status: 'active',
        title: '失败会话',
      },
      messages: [
        {
          citations: [],
          content: '查询库存',
          creation: '2026-07-23 10:00:00',
          feedback: null,
          name: 'AI-MSG-USER',
          promptVersion: null,
          role: 'user',
          run: null,
          runId: null,
          scenario: 'general',
          sequence: 1,
        },
        {
          citations: [],
          content: '',
          creation: '2026-07-23 10:01:00',
          feedback: null,
          name: 'AI-MSG-ASSISTANT',
          promptVersion: 'erp-readonly-v5',
          role: 'assistant',
          run: {
            error: '历史 AI 运行失败',
            errorCode: 'AI_UPSTREAM_UNAVAILABLE',
            firstTokenMs: null,
            latencyMs: 1000,
            model: null,
            modelAlias: 'erp-fast-chat',
            status: 'failed',
            traceId: 'trace-failed',
            usage: {
              completionTokens: 0,
              promptTokens: 0,
              reasoningTokens: 0,
              totalTokens: 0,
            },
          },
          runId: 'AI-RUN-FAILED',
          scenario: 'general',
          sequence: 2,
        },
      ],
    });

    render(React.createElement(App, null, React.createElement(AiPage)));

    expect(await screen.findByText('历史 AI 运行失败')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: '稍后重试' }));

    await waitFor(() => {
      expect(streamAiChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '查询库存',
          conversationId: 'AI-CONV-FAILED',
          modelAlias: 'erp-fast-chat',
          scenario: 'general',
        }),
        expect.any(Function),
        expect.any(AbortSignal),
      );
    });
  });

  it('allows a new conversation to choose its query company', async () => {
    render(React.createElement(App, null, React.createElement(AiPage)));

    fireEvent.change(screen.getByRole('combobox', { name: 'Company 选择' }), {
      target: { value: 'Second Company' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'AI 输入' }), {
      target: { value: '查询最新销售订单' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => {
      expect(streamAiChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          company: 'Second Company',
          content: '查询最新销售订单',
          scenario: 'auto',
        }),
        expect.any(Function),
        expect.any(AbortSignal),
      );
    });
  });

  it('allows the user to select an active LiteLLM model', async () => {
    render(React.createElement(App, null, React.createElement(AiPage)));

    await waitFor(() => expect(listAiSelectableModels).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /高级设置/ }));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'AI 模型' }));
    const modelOption = (
      await screen.findAllByText('GLM 5.2 · opencode-glm-5.2')
    )
      .map((node) => node.closest('.ant-select-item-option'))
      .find((node): node is HTMLElement => node instanceof HTMLElement);
    expect(modelOption).toBeTruthy();
    fireEvent.click(modelOption as HTMLElement);
    await screen.findByText('固定模型：GLM 5.2');
    fireEvent.change(screen.getByRole('textbox', { name: 'AI 输入' }), {
      target: { value: '你好' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => {
      expect(streamAiChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '你好',
          modelAlias: 'opencode-glm-5.2',
        }),
        expect.any(Function),
        expect.any(AbortSignal),
      );
    });
  });

  it('auto-routes an inventory addition request to the validated draft endpoint', async () => {
    resolveAiScenario.mockResolvedValueOnce('inventory_adjustment_draft');
    render(React.createElement(App, null, React.createElement(AiPage)));

    await waitFor(() => expect(listAiSelectableModels).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /高级设置/ }));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'AI 模型' }));
    const modelOption = (
      await screen.findAllByText('GLM 5.2 · opencode-glm-5.2')
    )
      .map((node) => node.closest('.ant-select-item-option'))
      .find((node): node is HTMLElement => node instanceof HTMLElement);
    fireEvent.click(modelOption as HTMLElement);
    fireEvent.change(screen.getByRole('textbox', { name: 'AI 输入' }), {
      target: { value: '给迪莫添加10个库存' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => {
      expect(resolveAiScenario).toHaveBeenCalledWith('给迪莫添加10个库存');
      expect(generateAiInventoryAdjustmentDraft).toHaveBeenCalledWith({
        company: 'Demo Company',
        content: '给迪莫添加10个库存',
        conversationId: null,
        modelAlias: 'opencode-glm-5.2',
      });
    });
    expect(streamAiChatMessage).not.toHaveBeenCalled();
  });

  it('auto-routes a product completion request to the validated draft endpoint', async () => {
    resolveAiScenario.mockResolvedValueOnce('product_setup_draft');
    render(React.createElement(App, null, React.createElement(AiPage)));

    await waitFor(() => expect(listAiSelectableModels).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /高级设置/ }));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'AI 模型' }));
    const modelOption = (
      await screen.findAllByText('GLM 5.2 · opencode-glm-5.2')
    )
      .map((node) => node.closest('.ant-select-item-option'))
      .find((node): node is HTMLElement => node instanceof HTMLElement);
    fireEvent.click(modelOption as HTMLElement);
    fireEvent.change(screen.getByRole('textbox', { name: 'AI 输入' }), {
      target: { value: '完善迪莫商品资料' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => {
      expect(resolveAiScenario).toHaveBeenCalledWith('完善迪莫商品资料');
      expect(generateAiProductSetupDraft).toHaveBeenCalledWith({
        company: 'Demo Company',
        content: '完善迪莫商品资料',
        conversationId: null,
        modelAlias: 'opencode-glm-5.2',
      });
    });
    expect(streamAiChatMessage).not.toHaveBeenCalled();
  });

  it('keeps an explicitly selected read-only scenario locked for one request', async () => {
    render(React.createElement(App, null, React.createElement(AiPage)));

    fireEvent.click(screen.getByRole('button', { name: /高级设置/ }));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'AI 场景' }));
    fireEvent.click(await screen.findByText('商品搜索'));
    fireEvent.change(screen.getByRole('textbox', { name: 'AI 输入' }), {
      target: { value: '仓里还有迪莫吗' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => {
      expect(resolveAiScenario).not.toHaveBeenCalled();
      expect(streamAiChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '仓里还有迪莫吗',
          scenario: 'product_search',
        }),
        expect.any(Function),
        expect.any(AbortSignal),
      );
    });
  });

  it('keeps fixed model inventory hidden for ordinary workspace users', async () => {
    listAiSelectableModels.mockResolvedValue({
      capabilities: {
        canSelectFixedModel: false,
        canViewAdvancedDiagnostics: false,
      },
      models: [],
    });

    render(React.createElement(App, null, React.createElement(AiPage)));

    fireEvent.click(screen.getByRole('button', { name: /高级设置/ }));
    expect(await screen.findByText('模型由策略自动选择')).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'AI 模型' })).toBeNull();
    expect(screen.queryByText('opencode-glm-5.2')).toBeNull();
  });

  it('shows the upstream progress phase before the first text delta', async () => {
    let finishStream: ((value: unknown) => void) | undefined;
    streamAiChatMessage.mockImplementationOnce(
      async (_payload: unknown, onEvent: any) => {
        onEvent({
          conversation: 'AI-CONV-PROGRESS',
          run_id: 'AI-RUN-PROGRESS',
          type: 'run_started',
        });
        onEvent({
          message: '模型已接收请求，等待首个 Token',
          phase: 'model_started',
          type: 'run_progress',
        });
        return await new Promise((resolve) => {
          finishStream = resolve;
        });
      },
    );

    render(React.createElement(App, null, React.createElement(AiPage)));
    fireEvent.change(screen.getByRole('textbox', { name: 'AI 输入' }), {
      target: { value: '解释库存周转率' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));

    expect(
      await screen.findByText('模型已接收请求，等待首个 Token'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '当前运行' }));
    expect(screen.getByText('生成中')).toBeTruthy();
    fireEvent.click(screen.getByText('高级诊断'));
    expect(screen.getByText('AI-RUN-PROGRESS')).toBeTruthy();

    finishStream?.({
      conversationId: 'AI-CONV-PROGRESS',
      events: [],
      message: { content: '库存周转率说明', role: 'assistant' },
      model: 'provider-model',
      modelAlias: 'erp-fast-chat',
      run: {
        error: null,
        errorCode: null,
        firstTokenMs: 3200,
        latencyMs: 3600,
        model: 'provider-model',
        modelAlias: 'erp-fast-chat',
        status: 'completed',
        traceId: 'trace-progress',
        usage: {
          completionTokens: 10,
          promptTokens: 20,
          reasoningTokens: 0,
          totalTokens: 30,
        },
      },
      runId: 'AI-RUN-PROGRESS',
      stream: { deltaCount: 8, streamedChars: 8 },
      traceId: 'trace-progress',
      usage: {
        completionTokens: 10,
        promptTokens: 20,
        reasoningTokens: 0,
        totalTokens: 30,
      },
      warnings: [],
    });
    expect(await screen.findByText('库存周转率说明')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '当前运行' })).toBeNull();
  });

  it('keeps an existing conversation bound to its original company', async () => {
    mockLocationSearch = '?conversation=AI-CONV-OLD';
    getAiConversation.mockResolvedValue({
      conversation: {
        company: 'Original Company',
        creation: '2026-07-16 10:00:00',
        lastMessageAt: '2026-07-16 10:00:00',
        messageCount: 0,
        modified: '2026-07-16 10:00:00',
        name: 'AI-CONV-OLD',
        status: 'active',
        title: '旧会话',
      },
      messages: [],
    });

    render(React.createElement(App, null, React.createElement(AiPage)));

    expect(await screen.findByText(/会话公司.*Original Company/)).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'AI 输入' }), {
      target: { value: '继续查询' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => {
      expect(streamAiChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          company: 'Original Company',
          content: '继续查询',
          conversationId: 'AI-CONV-OLD',
        }),
        expect.any(Function),
        expect.any(AbortSignal),
      );
    });
  });

  it('uses an explicit draft scenario once and auto-routes the next message', async () => {
    render(React.createElement(App, null, React.createElement(AiPage)));

    fireEvent.click(screen.getByRole('button', { name: /高级设置/ }));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'AI 场景' }));
    fireEvent.click(await screen.findByText('商品建档草稿'));
    fireEvent.change(screen.getByRole('textbox', { name: 'AI 输入' }), {
      target: { value: '添加一个新商品，煌星，10000一个，入库5000个' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => {
      expect(generateAiProductSetupDraft).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'AI 输入' }), {
      target: { value: '查询一下煌星是否已经正常入库' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => {
      expect(resolveAiScenario).toHaveBeenCalledWith(
        '查询一下煌星是否已经正常入库',
      );
      expect(streamAiChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '查询一下煌星是否已经正常入库',
          scenario: 'auto',
        }),
        expect.any(Function),
        expect.any(AbortSignal),
      );
    });
    expect(generateAiProductSetupDraft).toHaveBeenCalledTimes(1);
  });
});
