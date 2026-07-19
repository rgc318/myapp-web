import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import React from 'react';
import { updateAiDraft } from '@/services/myapp/ai';
import { AiDraftEditorModal } from './AiDraftEditorModal';

jest.mock('@/components', () => {
  const React = jest.requireActual('react');
  return {
    RemoteLinkSelect: (props: any) =>
      React.createElement('input', {
        'aria-label': props.doctype,
        onChange: (event: any) => props.onChange?.(event.target.value),
        value: props.value ?? '',
      }),
  };
});
jest.mock('@/components/CurrencySelect', () => {
  const React = jest.requireActual('react');
  return {
    CurrencySelect: (props: any) =>
      React.createElement('input', {
        'aria-label': 'Currency',
        onChange: (event: any) => props.onChange?.(event.target.value),
        value: props.value ?? '',
      }),
  };
});
jest.mock('@/components/UomSelect', () => {
  const React = jest.requireActual('react');
  return {
    UomSelect: (props: any) =>
      React.createElement('input', {
        'aria-label': 'UOM',
        onChange: (event: any) => props.onChange?.(event.target.value),
        value: props.value ?? '',
      }),
  };
});
jest.mock('@/services/myapp/ai', () => ({
  updateAiDraft: jest.fn(),
}));

const mockedUpdate = jest.mocked(updateAiDraft);

const draft = {
  company: 'Demo Company',
  conversationId: 'AI-CONV-1',
  creation: '2026-07-18 10:00:00',
  draftType: 'product_setup' as const,
  execution: null,
  modified: '2026-07-18 10:00:00',
  name: 'AI-DRAFT-1',
  payload: {
    company: 'Demo Company',
    currency: 'CNY',
    item_name: '煌星',
    stock_uom: 'Unit',
  },
  sourceRun: 'AI-RUN-1',
  status: 'draft' as const,
  title: '商品建档草稿',
  validation: { errors: [], readyForHandoff: true, warnings: [] },
  version: 2,
};

describe('AiDraftEditorModal', () => {
  beforeEach(() => {
    mockedUpdate.mockReset();
  });

  it('edits and revalidates a product draft without leaving the AI workspace', async () => {
    const updated = { ...draft, version: 3 };
    mockedUpdate.mockResolvedValue(updated);
    const onUpdated = jest.fn();
    render(
      React.createElement(
        App,
        null,
        React.createElement(AiDraftEditorModal, {
          draft,
          onClose: jest.fn(),
          onUpdated,
        }),
      ),
    );

    expect(screen.getByDisplayValue('煌星')).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue('煌星'), {
      target: { value: '煌星升级版' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));

    await waitFor(() => {
      expect(mockedUpdate).toHaveBeenCalledWith(
        'AI-DRAFT-1',
        expect.objectContaining({ item_name: '煌星升级版' }),
      );
      expect(onUpdated).toHaveBeenCalledWith(updated);
    });
  });

  it('requires a default buying price for opening stock', async () => {
    const incompleteDraft = {
      ...draft,
      payload: {
        ...draft.payload,
        opening_qty: 1000,
        warehouse: 'Stores - RD',
      },
      validation: {
        errors: ['填写初始库存时必须补充默认采购价。'],
        readyForHandoff: false,
        warnings: [],
      },
    };
    render(
      React.createElement(
        App,
        null,
        React.createElement(AiDraftEditorModal, {
          draft: incompleteDraft,
          onClose: jest.fn(),
          onUpdated: jest.fn(),
        }),
      ),
    );

    expect(screen.getByText('库存基准单位')).toBeTruthy();
    expect(screen.queryByText('初始库存单位')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
    expect(
      await screen.findByText('填写初始库存时，请输入默认采购价'),
    ).toBeTruthy();
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('keeps saved values visible when backend validation still needs attention', async () => {
    const current = {
      ...draft,
      payload: {
        ...draft.payload,
        opening_qty: 1000,
        standard_buying_rate: 5000,
        warehouse: 'Stores - RD',
      },
      validation: {
        errors: ['商品分类无法唯一匹配，请人工选择。'],
        readyForHandoff: false,
        warnings: [],
      },
    };
    const updated = { ...current, version: 3 };
    mockedUpdate.mockResolvedValue(updated);
    const onClose = jest.fn();
    render(
      React.createElement(
        App,
        null,
        React.createElement(AiDraftEditorModal, {
          draft: current,
          onClose,
          onUpdated: jest.fn(),
        }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));

    await waitFor(() => {
      expect(mockedUpdate).toHaveBeenCalledWith(
        'AI-DRAFT-1',
        expect.objectContaining({
          opening_uom: 'Unit',
          standard_buying_rate: 5000,
        }),
      );
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(
      Number(
        screen.getByRole<HTMLInputElement>('spinbutton', {
          name: '默认采购价',
        }).value,
      ),
    ).toBe(5000);
  });
});
