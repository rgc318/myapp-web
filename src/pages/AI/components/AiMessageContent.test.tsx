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
    BusinessResultPanel: ({ onRefresh, resultSet }: any) =>
      React.createElement(
        'div',
        null,
        `结构化结果 ${resultSet.groups[0].label} ${resultSet.groups[0].returnedCount}`,
        onRefresh
          ? React.createElement(
              'button',
              { onClick: onRefresh, type: 'button' },
              '刷新当前数据',
            )
          : null,
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
              payload: {
                item_name: '迪莫',
                stock_uom: 'Nos',
                stock_uom_display: '件',
                standard_selling_rate: 5,
              },
              modified: '2026-07-24 10:10:00',
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
    expect(screen.getByText('迪莫')).toBeTruthy();
    expect(screen.getByText('标准 5.00 元')).toBeTruthy();
    expect(screen.getByText(/最近校验：2026-07-24 10:10:00/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '确认执行' })).toBeNull();
  });

  it('labels product citations as answer-time permission-scoped data', () => {
    render(
      React.createElement(AiMessageContent, {
        ...baseProps,
        citations: [
          {
            data: {
              company: 'Demo Company',
              price: 88,
              qty: 4,
              queried_at: '2026-07-24 09:20:00',
              uom_display: '个',
            },
            href: '/products/ITEM-001',
            id: 'ITEM-001',
            label: '煌星',
            type: 'product',
          },
        ],
        content: '找到商品',
      }),
    );

    expect(screen.getByText('回答时数据')).toBeTruthy();
    expect(screen.getByText(/查询时间：2026-07-24 09:20:00/)).toBeTruthy();
    expect(screen.getByText(/公司：Demo Company/)).toBeTruthy();
    expect(screen.getByText(/当前账号权限范围/)).toBeTruthy();
  });

  it('delegates a no-model refresh for this result set', () => {
    const onRefreshBusinessResult = jest.fn().mockResolvedValue(undefined);
    render(
      React.createElement(AiMessageContent, {
        ...baseProps,
        content: '销售订单返回 1 条。',
        onRefreshBusinessResult,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: '刷新当前数据' }));
    expect(onRefreshBusinessResult).toHaveBeenCalledWith(
      expect.objectContaining({ resultType: 'business_documents' }),
    );
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

  it('opens the run attached to this answer', () => {
    const onViewRun = jest.fn();
    render(
      React.createElement(AiMessageContent, {
        ...baseProps,
        citations: [],
        content: '回答已完成',
        onViewRun,
        runId: 'AI-RUN-1',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: /运行详情/ }));
    expect(onViewRun).toHaveBeenCalledTimes(1);
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
    fireEvent.click(screen.getByRole('button', { name: /稍后重试/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the actual model on provider rejection failures', () => {
    render(
      React.createElement(AiMessageContent, {
        ...baseProps,
        citations: [],
        content: '',
        error: '模型 DeepSeek V4 Flash 暂时不可用',
        errorCode: 'MODEL_PROVIDER_REJECTED',
        modelDisplay: 'DeepSeek V4 Flash',
        onRetry: jest.fn(),
      }),
    );

    expect(screen.getByText('本次模型：DeepSeek V4 Flash')).toBeTruthy();
    expect(screen.getByText('本次模型不可用')).toBeTruthy();
  });

  it('asks the user to edit validation failures instead of resending unchanged input', () => {
    const onEditRequest = jest.fn();
    render(
      React.createElement(AiMessageContent, {
        ...baseProps,
        citations: [],
        content: '',
        error: '请求内容未通过校验',
        errorCode: 'AI_REQUEST_INVALID',
        onEditRequest,
        onRetry: jest.fn(),
      }),
    );

    expect(screen.getByText('需要修改本次问题')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '稍后重试' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /修改问题/ }));
    expect(onEditRequest).toHaveBeenCalledTimes(1);
  });
});
