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
  generateAiInventoryAdjustmentDraft: jest.fn(),
  generateAiPurchaseOrderDraft: jest.fn(),
  generateAiSalesOrderDraft: jest.fn(),
  getAiConversation: jest.fn(),
  listAiConversations: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  listAiDraftVersions: jest.fn(),
  prepareAiDraftHandoff: jest.fn(),
  restoreAiDraftVersion: jest.fn(),
  streamAiChatMessage: jest.fn(),
  submitAiFeedback: jest.fn(),
  updateAiDraft: jest.fn(),
}));

const { getAiConversation, streamAiChatMessage } = jest.requireMock(
  '@/services/myapp/ai',
);

describe('AI workspace page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocationSearch = '';
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
          scenario: 'auto',
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
});
