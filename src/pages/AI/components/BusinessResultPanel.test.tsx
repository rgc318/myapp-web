import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import React from 'react';
import type { AiBusinessResultSet } from '@/services/myapp/ai';
import { BusinessResultPanel } from './BusinessResultPanel';

const resultSet: AiBusinessResultSet = {
  groups: [
    {
      availableCount: 8,
      entity: 'sales_order',
      items: [
        {
          amount: 1200,
          company: 'Demo Company',
          currency: 'CNY',
          deliveryDate: '2026-07-25',
          documentStatus: 'submitted',
          dueDate: null,
          href: '/sales/orders/SO-001',
          id: 'SO-001',
          label: 'SO-001',
          outstandingAmount: 1200,
          paidAmount: 0,
          party: '客户 A',
          snapshotAt: '2026-07-24 10:00:00',
          snapshotSource: 'answer',
          transactionDate: '2026-07-24',
          type: 'sales_order',
        },
      ],
      label: '销售订单',
      moduleHref: '/sales/orders',
      requestedCount: 1,
      returnedCount: 1,
      status: 'success',
      truncated: true,
    },
  ],
  permissionFiltered: true,
  queriedAt: '2026-07-24 10:00:00',
  resultType: 'business_documents',
  schemaVersion: 'business-result-set-v1',
  scope: {
    company: 'Demo Company',
    dateFrom: null,
    dateRange: 'all',
    dateTo: null,
    excludeCancelled: true,
    limitPerGroup: 1,
    minAmount: null,
    sortBy: 'latest',
    statusFilter: 'all',
  },
  snapshotSource: 'answer',
};

describe('BusinessResultPanel', () => {
  it('shows snapshot scope, coverage and the full module entry', () => {
    render(
      React.createElement(
        App,
        null,
        React.createElement(BusinessResultPanel, { resultSet }),
      ),
    );

    expect(screen.getByText('回答时数据')).toBeTruthy();
    expect(screen.getByText(/查询时间：2026-07-24 10:00:00/)).toBeTruthy();
    expect(screen.getByText('已按当前账号权限过滤')).toBeTruthy();
    expect(screen.getByText('当前可见 8 条')).toBeTruthy();
    expect(screen.getByText('结果已截断')).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: /在业务模块查看完整结果/ })
        .getAttribute('href'),
    ).toBe('/sales/orders');
  });

  it('keeps a refresh failure inside the result panel', async () => {
    const onRefresh = jest.fn().mockRejectedValue(new Error('刷新权限已变化'));
    render(
      React.createElement(
        App,
        null,
        React.createElement(BusinessResultPanel, { onRefresh, resultSet }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: /刷新当前数据/ }));

    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('刷新权限已变化')).toBeTruthy();
  });
});
