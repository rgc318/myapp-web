import { fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import React from 'react';
import type { AiDraft } from '@/services/myapp/ai';
import { AiDraftBusinessReview, AiDraftVersionList } from './AiDraftReview';

const draft: AiDraft = {
  company: 'Demo Company',
  conversationId: 'AI-CONV-1',
  creation: '2026-07-16 10:00:00',
  draftType: 'sales_order',
  execution: null,
  modified: '2026-07-16 10:10:00',
  name: 'AI-DRAFT-1',
  payload: {
    company: 'Demo Company',
    customer: 'Customer A',
    delivery_date: '2026-07-20',
    items: [
      {
        item_code: 'SKU010',
        item_name: '数码相机',
        price: 999,
        qty: 2,
        uom_display: '箱',
        warehouse: 'Stores - RD',
      },
    ],
    remarks: '重点客户',
    transaction_date: '2026-07-16',
    warehouse: 'Stores - RD',
  },
  sourceRun: 'AI-RUN-1',
  status: 'draft',
  title: '销售订单草稿',
  validation: { errors: [], readyForHandoff: true, warnings: [] },
  version: 2,
};

describe('AI draft review components', () => {
  it('renders business fields and item details instead of only raw JSON', () => {
    render(
      <App>
        <AiDraftBusinessReview draft={draft} />
      </App>,
    );

    expect(screen.getByText('Customer A')).toBeTruthy();
    expect(screen.getByText('数码相机')).toBeTruthy();
    expect(screen.getByText('SKU010')).toBeTruthy();
    expect(
      screen.getByText('草稿已通过后端实时校验，可以确认执行。'),
    ).toBeTruthy();
  });

  it('explains version differences and requests safe restore', () => {
    const onRestore = jest.fn();
    render(
      <App>
        <AiDraftVersionList
          currentVersion={2}
          onRestore={onRestore}
          versions={[
            {
              change_source: 'user_edit',
              creation: '2026-07-16 10:10:00',
              diff: {
                fields: [
                  { after: 'Customer A', before: null, field: 'customer' },
                ],
                items: [],
              },
              version: 2,
            },
            {
              change_source: 'generated',
              creation: '2026-07-16 10:00:00',
              diff: { fields: [], items: [] },
              version: 1,
            },
          ]}
        />
      </App>,
    );

    expect(screen.getByText('客户：- → Customer A')).toBeTruthy();
    const restoreButtons = screen.getAllByRole('button', {
      name: '恢复为新版本',
    });
    expect((restoreButtons[0] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(restoreButtons[1]);
    expect(onRestore).toHaveBeenCalledWith(1);
  });
});
