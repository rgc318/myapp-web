import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
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
          null,
          items.map((item: any) =>
            React.createElement('div', { key: item.key }, item.content),
          ),
        ),
    },
    Conversations: () => React.createElement('div', null, '会话列表'),
    Prompts: () => React.createElement('div', null, '常用能力'),
    Sender: ({ onChange, onSubmit, value }: any) =>
      React.createElement(
        'div',
        null,
        React.createElement('input', {
          'aria-label': 'AI 输入',
          onChange: (event: any) => onChange(event.target.value),
          value,
        }),
        React.createElement(
          'button',
          { onClick: () => onSubmit(value), type: 'button' },
          '发送',
        ),
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
    AiMessageContent: ({ content, progressMessage, streaming }: any) =>
      React.createElement(
        'div',
        null,
        content || (streaming ? progressMessage : ''),
      ),
  };
});

jest.mock('./styles', () => ({
  useAiWorkspaceStyles: () => ({
    styles: new Proxy({}, { get: () => '' }),
  }),
}));

jest.mock('@/services/myapp/ai', () => ({
  archiveAiConversation: jest.fn(),
  discardAiDraft: jest.fn(),
  executeAiDraft: jest.fn(),
  generateAiInventoryAdjustmentDraft: jest.fn(),
  generateAiProductSetupDraft: jest.fn(),
  generateAiPurchaseOrderDraft: jest.fn(),
  generateAiSalesOrderDraft: jest.fn(),
  getAiConversation: jest.fn(),
  getAiDraft: jest.fn(),
  listAiConversations: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  listAiSelectableModels: jest.fn().mockResolvedValue([
    {
      capability: 'fast_chat',
      displayName: 'opencode-glm-5.2',
      modelAlias: 'opencode-glm-5.2',
      status: 'active',
      supportsJsonSchema: false,
      supportsStreaming: true,
    },
  ]),
  listAiDraftVersions: jest.fn(),
  prepareAiDraftHandoff: jest.fn(),
  resolveAiScenario: jest.fn(),
  restoreAiDraftVersion: jest.fn(),
  streamAiChatMessage: jest.fn(),
  submitAiFeedback: jest.fn(),
  updateAiDraft: jest.fn(),
}));

const {
  generateAiProductSetupDraft,
  getAiConversation,
  resolveAiScenario,
  streamAiChatMessage,
} = jest.requireMock('@/services/myapp/ai');

describe('AI workspace page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocationSearch = '';
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
          scenario: 'product_search',
        }),
        expect.any(Function),
        expect.any(AbortSignal),
      );
    });
    expect(await screen.findByText('找到两个商品')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /运行详情/ }));
    expect(screen.getByText('已完成')).toBeTruthy();
    expect(screen.getByText('760 ms')).toBeTruthy();
    expect(screen.getByText('search_products')).toBeTruthy();
    expect(screen.getByText('完成 · 2 项')).toBeTruthy();
    expect(screen.getByText('只读模式')).toBeTruthy();
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
          scenario: 'order_query',
        }),
        expect.any(Function),
        expect.any(AbortSignal),
      );
    });
  });

  it('allows the user to select an active LiteLLM model', async () => {
    render(React.createElement(App, null, React.createElement(AiPage)));

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'AI 模型' }));
    const modelOption = (await screen.findAllByText('opencode-glm-5.2'))
      .map((node) => node.closest('.ant-select-item-option'))
      .find((node): node is HTMLElement => node instanceof HTMLElement);
    expect(modelOption).toBeTruthy();
    fireEvent.click(modelOption as HTMLElement);
    await screen.findByText('固定模型：opencode-glm-5.2');
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
          scenario: 'product_search',
        }),
        expect.any(Function),
        expect.any(AbortSignal),
      );
    });
    expect(generateAiProductSetupDraft).toHaveBeenCalledTimes(1);
  });
});
