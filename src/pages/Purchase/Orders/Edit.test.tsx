import { render, screen } from '@testing-library/react';
import React from 'react';
import PurchaseOrderEditPage from './Edit';

jest.mock('@umijs/max', () => ({
  history: { push: jest.fn() },
  useParams: () => ({ name: 'PUR-ORD-2026-0001' }),
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
    }, []);

    return state;
  },
}));

jest.mock('@/components', () => ({
  ProductSelect: () => {
    const React = jest.requireActual('react');
    return React.createElement('button', { type: 'button' }, '选择商品');
  },
  PurchaseOrderLinesTable: () => {
    const React = jest.requireActual('react');
    return React.createElement('div', {
      'data-testid': 'purchase-lines-table',
    });
  },
  RemoteLinkSelect: () => {
    const React = jest.requireActual('react');
    return React.createElement('select');
  },
}));

jest.mock('@/services/myapp/master-data', () => ({
  getProductDetail: jest.fn(),
}));

jest.mock('@/services/myapp/purchase', () => {
  const actual = jest.requireActual('@/services/myapp/purchase');
  return {
    ...actual,
    getPurchaseOrderDetail: jest.fn(),
    updatePurchaseOrderItemsV2: jest.fn(),
    updatePurchaseOrderV2: jest.fn(),
  };
});

const { getProductDetail } = jest.requireMock('@/services/myapp/master-data');
const { getPurchaseOrderDetail } = jest.requireMock(
  '@/services/myapp/purchase',
);

const baseOrderDetail = {
  actualPaidAmount: 0,
  amount: 100,
  canCancelOrder: true,
  canCreateInvoice: true,
  canReceive: true,
  canRecordPayment: true,
  company: 'rgc (Demo)',
  completionStatus: 'open',
  currency: 'CNY',
  documentStatus: 'submitted',
  items: [
    {
      amount: 100,
      itemCode: 'SKU-001',
      itemName: 'Camera',
      purchaseOrderItem: 'po-item-001',
      qty: 1,
      rate: 100,
      uom: 'Nos',
      uomDisplay: null,
      warehouse: 'Stores - RD',
    },
  ],
  latestPaymentEntry: '',
  modified: '2026-07-04 10:00:00',
  name: 'PUR-ORD-2026-0001',
  outstandingAmount: 100,
  paidAmount: 0,
  paymentEntries: [],
  paymentStatus: 'unpaid',
  purchaseInvoices: [],
  purchaseReceipts: [],
  receivingStatus: 'pending',
  remarks: '',
  scheduleDate: '2026-07-11',
  supplier: 'SUP-0001',
  supplierAddressDisplay: '',
  supplierContactDisplay: '',
  supplierContactPhone: '',
  supplierName: '供应商 A',
  supplierRef: '',
  timeline: [],
  transactionDate: '2026-07-04',
};

describe('PurchaseOrderEditPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getPurchaseOrderDetail.mockResolvedValue({ ...baseOrderDetail });
    getProductDetail.mockResolvedValue(null);
  });

  it('blocks editing when the purchase order already has a receipt', async () => {
    getPurchaseOrderDetail.mockResolvedValue({
      ...baseOrderDetail,
      purchaseReceipts: ['MAT-PRE-2026-0001'],
    });

    render(React.createElement(PurchaseOrderEditPage));

    expect(await screen.findByText('当前采购订单不能直接编辑')).toBeTruthy();
    expect(
      screen.getByText(
        '订单已存在采购收货单，不能直接编辑；请先取消采购收货单后再回退修改',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('采购明细')).toBeNull();
    expect(screen.queryByTestId('purchase-lines-table')).toBeNull();
    expect(getProductDetail).not.toHaveBeenCalled();
  });

  it('blocks editing when the purchase order already has an invoice', async () => {
    getPurchaseOrderDetail.mockResolvedValue({
      ...baseOrderDetail,
      purchaseInvoices: ['PINV-2026-0001'],
    });

    render(React.createElement(PurchaseOrderEditPage));

    expect(await screen.findByText('当前采购订单不能直接编辑')).toBeTruthy();
    expect(
      screen.getByText(
        '订单已存在采购发票，不能直接编辑；请先作废采购发票后再回退修改',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('采购明细')).toBeNull();
    expect(screen.queryByTestId('purchase-lines-table')).toBeNull();
    expect(getProductDetail).not.toHaveBeenCalled();
  });
});
