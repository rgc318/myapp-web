import { fireEvent, render, screen } from '@testing-library/react';
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
  onOpenBusinessDocument: jest.fn(),
  onOpenDraftHistory: jest.fn(),
  onOpenProduct: jest.fn(),
};

describe('AiMessageContent', () => {
  it('opens the shared review and execution workbench for a validated draft', () => {
    const onEditDraft = jest.fn();
    render(
      React.createElement(AiMessageContent, {
        ...baseProps,
        citations: [
          {
            data: {
              draft_type: 'product_setup',
              status: 'draft',
              validation: { errors: [], ready_for_handoff: true, warnings: [] },
              version: 2,
            },
            href: null,
            id: 'AI-DRAFT-1',
            label: '商品建档草稿',
            type: 'ai_draft',
          },
        ],
        content: '草稿已生成',
        onEditDraft,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: '复核并执行' }));
    expect(onEditDraft).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'AI-DRAFT-1' }),
    );
    expect(screen.queryByRole('button', { name: '确认执行' })).toBeNull();
  });

  it('uses a clear action label when a draft still needs information', () => {
    render(
      React.createElement(AiMessageContent, {
        ...baseProps,
        citations: [
          {
            data: {
              draft_type: 'product_setup',
              status: 'draft',
              validation: {
                errors: ['请填写默认采购价'],
                ready_for_handoff: false,
                warnings: [],
              },
              version: 2,
            },
            href: null,
            id: 'AI-DRAFT-1',
            label: '商品建档草稿',
            type: 'ai_draft',
          },
        ],
        content: '草稿需要补充信息',
      }),
    );

    expect(screen.getByRole('button', { name: '完善草稿' })).toBeTruthy();
    expect(screen.queryByText('编辑并重新校验')).toBeNull();
  });

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

  it('keeps an inline failure with an explicit retry action', () => {
    const onRetry = jest.fn();
    render(
      React.createElement(AiMessageContent, {
        ...baseProps,
        citations: [],
        content: '',
        error: 'AI 服务暂时不可用',
        onRetry,
      }),
    );

    expect(screen.getByText('AI 服务暂时不可用')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /重新发送/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
