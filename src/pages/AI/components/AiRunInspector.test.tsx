import { fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import React from 'react';
import type { AiChatResult } from '@/services/myapp/ai';
import { AiRunInspector } from './AiRunInspector';

const result: AiChatResult = {
  conversationId: 'AI-CONV-1',
  events: [],
  message: { content: '完成', role: 'assistant' },
  model: 'provider-model',
  modelAlias: 'erp-fast-chat',
  run: {
    error: null,
    errorCode: null,
    firstTokenMs: 180,
    latencyMs: 920,
    model: 'provider-model',
    modelAlias: 'erp-fast-chat',
    status: 'completed',
    traceId: 'trace-1',
    usage: {
      completionTokens: 20,
      promptTokens: 80,
      reasoningTokens: 5,
      totalTokens: 105,
    },
  },
  runId: 'AI-RUN-1',
  stream: { deltaCount: 24, streamedChars: 56 },
  traceId: 'trace-1',
  usage: {
    completionTokens: 20,
    promptTokens: 80,
    reasoningTokens: 5,
    totalTokens: 105,
  },
  warnings: ['只读模式'],
};

describe('AiRunInspector', () => {
  it('separates the business overview from advanced diagnostics', () => {
    render(
      <App>
        <AiRunInspector
          activeRunId={null}
          company="Demo Company"
          createdAt="2026-07-24 09:30:00"
          result={result}
          scenario="product_search"
          status="completed"
          tools={[
            { name: 'search_products', resultCount: 3, status: 'completed' },
          ]}
          warnings={['只读模式']}
        />
      </App>,
    );

    expect(screen.getByText('已完成')).toBeTruthy();
    expect(screen.getByText('商品查询')).toBeTruthy();
    expect(screen.getByText('Demo Company · 当前账号权限')).toBeTruthy();
    expect(screen.getByText('920 ms')).toBeTruthy();
    expect(screen.getByText('2026-07-24 09:30:00')).toBeTruthy();
    expect(screen.queryByText('erp-fast-chat')).toBeNull();
    fireEvent.click(screen.getByText('高级诊断'));
    expect(screen.getByText('erp-fast-chat')).toBeTruthy();
    expect(screen.getByText('180 ms')).toBeTruthy();
    expect(screen.getByText('流式 24 段 · 56 字符')).toBeTruthy();
    expect(screen.getByText('105（输入 80 / 输出 20 / 推理 5）')).toBeTruthy();
    expect(screen.getByText('search_products')).toBeTruthy();
    expect(screen.getByText('完成 · 3 项')).toBeTruthy();
    expect(screen.getByText('只读模式')).toBeTruthy();
  });

  it('keeps a failed run visible and requires an explicit retry', () => {
    const onRetry = jest.fn();
    render(
      <App>
        <AiRunInspector
          activeRunId="AI-RUN-FAILED"
          error="模型服务暂时不可用"
          onRetry={onRetry}
          result={null}
          status="failed"
          tools={[]}
          warnings={[]}
        />
      </App>,
    );

    expect(screen.getByText('失败')).toBeTruthy();
    expect(screen.getByText('模型服务暂时不可用')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /稍后重试/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows a stable permission classification without offering a retry', () => {
    render(
      <App>
        <AiRunInspector
          activeRunId="AI-RUN-DENIED"
          error="无权访问公司 Demo"
          errorCode="PERMISSION_DENIED"
          onRetry={jest.fn()}
          result={null}
          status="failed"
          tools={[]}
          warnings={[]}
        />
      </App>,
    );

    expect(screen.getAllByText('当前权限不允许访问')).toHaveLength(2);
    expect(screen.getByText('PERMISSION_DENIED')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '稍后重试' })).toBeNull();
  });
});
