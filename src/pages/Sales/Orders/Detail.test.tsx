import { render, screen } from '@testing-library/react';
import { App } from 'antd';
import React from 'react';
import SalesOrderDetailPage from './Detail';

jest.mock('@umijs/max', () => ({
  Link: ({ children }: any) => {
    const React = jest.requireActual('react');
    return React.createElement('a', null, children);
  },
  useParams: () => ({ name: 'SAL-ORD-2026-01204' }),
  useRequest: (service: any) => {
    const React = jest.requireActual('react');
    const [state, setState] = React.useState({
      data: undefined,
      error: undefined,
      loading: true,
    });

    React.useEffect(() => {
      let mounted = true;
      service()
        .then((data: any) => {
          if (mounted) {
            setState({ data, error: undefined, loading: false });
          }
        })
        .catch((error: Error) => {
          if (mounted) {
            setState({ data: undefined, error, loading: false });
          }
        });

      return () => {
        mounted = false;
      };
    }, [service]);

    return {
      ...state,
      refresh: jest.fn(),
    };
  },
}));

jest.mock('@/components/PrintDocumentButton', () => ({
  PrintDocumentButton: () => {
    const React = jest.requireActual('react');
    return React.createElement('button', { type: 'button' }, '打印');
  },
}));

jest.mock('@/services/myapp/sales', () => ({
  cancelSalesOrder: jest.fn(),
  createSalesOrderInvoice: jest.fn(),
  getSalesInvoiceDetail: jest.fn(),
  getSalesOrderDetail: jest.fn(),
  quickCancelSalesOrderV2: jest.fn(),
  recordSalesOrderPayment: jest.fn(),
  submitSalesOrderDelivery: jest.fn(),
}));

const { getSalesOrderDetail } = jest.requireMock('@/services/myapp/sales');

describe('SalesOrderDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSalesOrderDetail.mockResolvedValue({
      addressDisplay: '上海市浦东新区测试路 88 号 5 楼',
      amount: 9999999,
      canCancelOrder: true,
      canCreateSalesInvoice: true,
      canRecordPayment: false,
      canSubmitDelivery: true,
      company: 'rgc (Demo)',
      completionStatus: 'open',
      contactDisplay: '张三',
      contactPhone: '13800138000',
      currency: 'CNY',
      customer: 'Palmer Productions Ltd.',
      defaultSalesMode: 'wholesale',
      deliveryDate: '2026-06-05',
      deliveryNotes: [],
      documentStatus: 'submitted',
      fulfillmentStatus: 'pending',
      items: [
        {
          amount: 9999999,
          deliveredQty: 0,
          imageUrl:
            'https://images.pexels.com/photos/51383/photo-camera-subject-photographer-51383.jpeg',
          itemCode: 'SKU010',
          itemName: 'Camera',
          qty: 1,
          rate: 9999999,
          salesMode: 'wholesale',
          salesOrderItem: '97kr48q50j',
          specification: '',
          uom: 'Nos',
          uomDisplay: null,
          warehouse: 'Stores - RD',
        },
      ],
      name: 'SAL-ORD-2026-01204',
      outstandingAmount: 0,
      paidAmount: 0,
      paymentStatus: 'unpaid',
      receivableAmount: 0,
      remarks: 'v2 HTTP test order',
      salesInvoices: [],
      transactionDate: '2026-06-05',
    });
  });

  it('renders sales order details from gateway data', async () => {
    render(
      React.createElement(App, null, React.createElement(SalesOrderDetailPage)),
    );

    expect(await screen.findByText('Palmer Productions Ltd.')).toBeTruthy();
    expect(screen.getByText('rgc (Demo)')).toBeTruthy();
    expect(screen.getByText('Camera')).toBeTruthy();
    expect(screen.getByText('SKU010')).toBeTruthy();
    expect(screen.getByText('Stores - RD')).toBeTruthy();
  });
});
