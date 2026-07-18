import { render, screen } from '@testing-library/react';
import React from 'react';
import { AiMessageContent } from './AiMessageContent';

jest.mock('@ant-design/x', () => {
  const React = jest.requireActual('react');
  return {
    Actions: () => React.createElement('div', null, '反馈操作'),
  };
});

jest.mock('@ant-design/x-markdown', () => {
  const React = jest.requireActual('react');
  return {
    __esModule: true,
    default: ({ children }: any) => React.createElement('div', null, children),
  };
});

jest.mock('./BusinessResultPanel', () => {
  const React = jest.requireActual('react');
  return {
    BusinessResultPanel: ({ resultSet }: any) =>
      React.createElement(
        'div',
        null,
        `结构化结果 ${resultSet.groups[0].label} ${resultSet.groups[0].returnedCount}`,
      ),
  };
});

jest.mock('../styles', () => ({
  useAiWorkspaceStyles: () => ({
    styles: new Proxy({}, { get: () => '' }),
  }),
}));

const citations = [
  {
    type: 'business_result_set',
    id: 'RESULT-1',
    label: '业务查询结果',
    href: null,
    data: {
      schema_version: 'business-result-set-v1',
      result_type: 'business_documents',
      scope: { company: 'Demo', limit_per_group: 5 },
      groups: [
        {
          entity: 'sales_order',
          label: '销售订单',
          requested_count: 5,
          returned_count: 1,
          status: 'partial',
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
      document_status: 'submitted',
      amount: 2400,
      outstanding_amount: 0,
    },
  },
];

const baseProps = {
  citations,
  onDiscardDraft: jest.fn(),
  onEditDraft: jest.fn(),
  onFeedback: jest.fn(),
  onHandoffDraft: jest.fn(),
  onOpenDraftHistory: jest.fn(),
};

describe('AiMessageContent', () => {
  it('shows structured business results before the model summary arrives', () => {
    render(
      React.createElement(AiMessageContent, {
        ...baseProps,
        content: '',
        progressMessage: '模型已接收请求，等待首个 Token',
        progressStartedAt: Date.now(),
        streaming: true,
      }),
    );

    expect(screen.getByText('结构化结果 销售订单 1')).toBeTruthy();
    expect(screen.getByText('业务结果已返回，正在生成摘要')).toBeTruthy();
    expect(screen.getByText(/结构化明细可立即查看/)).toBeTruthy();
    expect(screen.queryByText('业务来源')).toBeNull();
  });

  it('places the concise AI summary after the structured result', () => {
    render(
      React.createElement(AiMessageContent, {
        ...baseProps,
        content: '销售订单返回 1 条，当前范围内不足 5 条。',
        runId: 'AI-RUN-1',
      }),
    );

    const result = screen.getByText('结构化结果 销售订单 1');
    const summary = screen.getByText('AI 摘要');
    expect(
      result.compareDocumentPosition(summary) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByText('销售订单返回 1 条，当前范围内不足 5 条。'),
    ).toBeTruthy();
  });
});
