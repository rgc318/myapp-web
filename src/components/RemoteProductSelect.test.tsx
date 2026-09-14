import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React from 'react';
import { searchProducts } from '@/services/myapp/master-data';
import { RemoteProductSelect } from './RemoteProductSelect';

jest.mock('antd', () => ({
  Select: (props: any) => {
    const React = jest.requireActual('react');
    return React.createElement(
      'div',
      null,
      React.createElement('input', {
        'aria-label': '商品搜索',
        onChange: (event: any) => props.onSearch?.(event.target.value),
      }),
      React.createElement(
        'button',
        { onClick: () => props.onOpenChange?.(true), type: 'button' },
        '打开',
      ),
      ...(props.options ?? []).map((option: any) =>
        React.createElement(
          'button',
          {
            key: option.value,
            onClick: () => props.onChange?.(option.value),
            type: 'button',
          },
          option.label,
        ),
      ),
      React.createElement('span', null, props.notFoundContent),
    );
  },
}));

jest.mock('@/services/myapp/master-data', () => ({
  searchProducts: jest.fn(),
}));

const mockedSearchProducts = jest.mocked(searchProducts);

describe('RemoteProductSelect', () => {
  beforeEach(() => {
    mockedSearchProducts.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows backend draft candidates before another remote search finishes', () => {
    mockedSearchProducts.mockResolvedValue({
      hasMore: false,
      items: [],
      total: 0,
    });
    render(
      React.createElement(RemoteProductSelect, {
        initialCandidates: [
          { itemCode: 'COKE-001', itemName: '可口可乐' },
          { itemCode: 'PEPSI-001', itemName: '百事可乐', nickname: '蓝罐' },
        ],
        initialQuery: '可乐',
        itemContext: 'inventory',
      }),
    );

    expect(screen.getByText('可口可乐（COKE-001）')).toBeTruthy();
    expect(screen.getByText('百事可乐（PEPSI-001） · 昵称：蓝罐')).toBeTruthy();
  });

  it('uses the product domain search and merges returned products', async () => {
    jest.useFakeTimers();
    mockedSearchProducts.mockResolvedValue({
      hasMore: false,
      items: [
        {
          brand: '饮料',
          itemCode: 'COKE-5000',
          itemName: '可口可乐 5000ml',
          nickname: '大可乐',
          specification: '5000ml',
        } as any,
      ],
      total: 1,
    });
    render(
      React.createElement(RemoteProductSelect, {
        company: 'rgc (Demo)',
        itemContext: 'inventory',
        warehouse: 'Stores - RD',
      }),
    );

    fireEvent.change(screen.getByLabelText('商品搜索'), {
      target: { value: '可乐' },
    });
    await act(async () => {
      jest.advanceTimersByTime(250);
    });

    await waitFor(() => {
      expect(mockedSearchProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          company: 'rgc (Demo)',
          itemContext: 'inventory',
          searchKey: '可乐',
          warehouse: 'Stores - RD',
        }),
      );
    });
    expect(
      await screen.findByText(
        '可口可乐 5000ml（COKE-5000） · 昵称：大可乐 · 5000ml · 饮料',
      ),
    ).toBeTruthy();
  });

  it('shows the real search error instead of an empty-data message', async () => {
    mockedSearchProducts.mockRejectedValue(new Error('商品搜索权限不足'));
    render(React.createElement(RemoteProductSelect));

    fireEvent.click(screen.getByRole('button', { name: '打开' }));

    expect(await screen.findByText('商品搜索权限不足')).toBeTruthy();
  });
});
