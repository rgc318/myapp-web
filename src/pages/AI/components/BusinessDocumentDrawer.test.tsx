import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import React from 'react';
import { getAiBusinessDocumentDetail } from '@/services/myapp/ai';
import { BusinessDocumentDrawer } from './BusinessDocumentDrawer';

jest.mock('@/services/myapp/ai', () => ({
  getAiBusinessDocumentDetail: jest.fn(),
}));

const mockedGetDetail = jest.mocked(getAiBusinessDocumentDetail);

describe('BusinessDocumentDrawer', () => {
  it('shows business detail inline and keeps the full page as a secondary action', async () => {
    mockedGetDetail.mockResolvedValue({
      amount: 200,
      company: 'Demo Company',
      currency: 'CNY',
      date: '2026-07-18',
      documentStatus: 'submitted',
      dueOrTargetDate: '2026-07-20',
      href: '/sales/orders/SO-001',
      id: 'SO-001',
      items: [
        {
          amount: 200,
          itemCode: 'ITEM-001',
          itemName: '煌星',
          qty: 2,
          rate: 100,
          uom: 'Unit',
          uomDisplay: '个',
          warehouse: 'Stores - DC',
        },
      ],
      outstandingAmount: 200,
      paidAmount: 0,
      party: '客户 A',
      references: [],
      remarks: 'AI 查询结果',
      type: 'sales_order',
    });

    render(
      React.createElement(
        App,
        null,
        React.createElement(BusinessDocumentDrawer, {
          document: {
            amount: 200,
            company: 'Demo Company',
            currency: 'CNY',
            deliveryDate: '2026-07-20',
            documentStatus: 'submitted',
            dueDate: null,
            href: '/sales/orders/SO-001',
            id: 'SO-001',
            label: 'SO-001',
            outstandingAmount: 200,
            paidAmount: 0,
            party: '客户 A',
            snapshotAt: '2026-07-24 09:30:00',
            snapshotSource: 'answer',
            transactionDate: '2026-07-18',
            type: 'sales_order',
          },
          onClose: jest.fn(),
        }),
      ),
    );

    expect(await screen.findByText('煌星')).toBeTruthy();
    expect(screen.getByText('回答时数据')).toBeTruthy();
    expect(screen.getByText('当前数据')).toBeTruthy();
    expect(screen.getByText('2026-07-24 09:30:00')).toBeTruthy();
    expect(screen.getAllByText('客户 A')).toHaveLength(2);
    expect(
      screen.getByRole('link', { name: /在业务模块打开/ }).getAttribute('href'),
    ).toBe('/sales/orders/SO-001');
    const refreshButton = screen.getByRole<HTMLButtonElement>('button', {
      name: /刷新当前数据/,
    });
    await waitFor(() => expect(refreshButton.disabled).toBe(false));
    fireEvent.click(refreshButton);
    await waitFor(() => expect(mockedGetDetail).toHaveBeenCalledTimes(2));
  });
});
