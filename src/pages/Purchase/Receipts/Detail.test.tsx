import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App, Modal } from 'antd';
import React from 'react';
import PurchaseReceiptDetailPage from './Detail';

jest.mock('@umijs/max', () => ({
  Link: ({ children, to }: any) => {
    const React = jest.requireActual('react');
    return React.createElement('a', { href: to }, children);
  },
  history: { push: jest.fn() },
  useParams: () => ({ name: 'MAT-PRE-2026-0001' }),
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

jest.mock('@/services/myapp/purchase', () => ({
  cancelPurchaseReceipt: jest.fn(),
  createPurchaseInvoiceFromReceipt: jest.fn(),
  getPurchaseReceiptDetail: jest.fn(),
}));

const {
  cancelPurchaseReceipt,
  createPurchaseInvoiceFromReceipt,
  getPurchaseReceiptDetail,
} = jest.requireMock('@/services/myapp/purchase');

const baseReceiptDetail = {
  amount: 1280,
  canCancel: true,
  canCreateInvoice: true,
  cancelPurchaseReceiptHint: '',
  company: 'rgc (Demo)',
  currency: 'CNY',
  documentStatus: 'submitted',
  items: [
    {
      amount: 1280,
      itemCode: 'SKU010',
      itemName: 'Camera',
      purchaseOrderItem: 'po-item-001',
      qty: 2,
      rate: 640,
      uom: 'Nos',
      uomDisplay: null,
      warehouse: 'Stores - RD',
    },
  ],
  name: 'MAT-PRE-2026-0001',
  postingDate: '2026-07-04',
  purchaseInvoices: [],
  purchaseOrders: ['PUR-ORD-2026-0001'],
  receivingStatus: 'received',
  remarks: '测试收货',
  supplier: 'SUP-0001',
  supplierName: '供应商 A',
  totalQty: 2,
};

describe('PurchaseReceiptDetailPage', () => {
  beforeEach(() => {
    Modal.destroyAll();
    jest.clearAllMocks();
    getPurchaseReceiptDetail.mockResolvedValue({ ...baseReceiptDetail });
    cancelPurchaseReceipt.mockResolvedValue({
      data: { purchase_receipt: 'OK' },
    });
    createPurchaseInvoiceFromReceipt.mockResolvedValue({
      data: { purchase_invoice: 'PINV-0001' },
    });
  });

  it('opens an explicit cancel confirmation before cancelling a purchase receipt', async () => {
    render(
      React.createElement(
        App,
        null,
        React.createElement(PurchaseReceiptDetailPage),
      ),
    );

    expect(await screen.findByText('Camera')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: '取消收货单' })[0]);

    expect(
      await screen.findByText('取消采购收货单 MAT-PRE-2026-0001？'),
    ).toBeTruthy();
    expect(screen.getByText('这是库存和采购收货回退操作')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '确认取消收货单' }));

    await waitFor(() => {
      expect(cancelPurchaseReceipt).toHaveBeenCalledWith('MAT-PRE-2026-0001');
    });
  });

  it('links back to the source purchase order detail', async () => {
    render(
      React.createElement(
        App,
        null,
        React.createElement(PurchaseReceiptDetailPage),
      ),
    );

    expect(await screen.findByText('Camera')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: '返回采购订单' }).getAttribute('href'),
    ).toBe('/purchase/orders/PUR-ORD-2026-0001');
  });

  it('shows downstream invoice blocking reason when the receipt cannot be cancelled', async () => {
    getPurchaseReceiptDetail.mockResolvedValue({
      ...baseReceiptDetail,
      canCancel: false,
      cancelPurchaseReceiptHint:
        '当前收货单已关联采购发票，请先作废采购发票，再回退收货单。',
      purchaseInvoices: ['PINV-0001'],
    });

    render(
      React.createElement(
        App,
        null,
        React.createElement(PurchaseReceiptDetailPage),
      ),
    );

    expect(await screen.findByText('PINV-0001')).toBeTruthy();
    expect(
      screen.getByText(
        '当前收货单已关联采购发票，请先作废采购发票，再回退收货单。',
      ),
    ).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: '取消收货单' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });
});
