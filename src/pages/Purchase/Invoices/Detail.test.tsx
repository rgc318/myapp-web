import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App, Modal } from 'antd';
import React from 'react';
import PurchaseInvoiceDetailPage from './Detail';

jest.mock('@ant-design/pro-components', () => {
  const actual = jest.requireActual('@ant-design/pro-components');
  return {
    ...actual,
    ProTable: ({ columns = [], dataSource = [], headerTitle, rowKey }: any) => {
      const React = jest.requireActual('react');
      return React.createElement(
        'div',
        { 'data-testid': 'pro-table' },
        headerTitle ? React.createElement('div', null, headerTitle) : null,
        dataSource.map((record: any, rowIndex: number) =>
          React.createElement(
            'div',
            {
              key:
                typeof rowKey === 'function'
                  ? rowKey(record)
                  : (record[rowKey] ?? rowIndex),
            },
            columns.map((column: any, columnIndex: number) => {
              const value = column.dataIndex
                ? record[column.dataIndex]
                : undefined;
              const content = column.render
                ? column.render(value, record)
                : String(value ?? '');
              return React.createElement(
                React.Fragment,
                { key: column.key ?? column.dataIndex ?? columnIndex },
                content,
              );
            }),
          ),
        ),
      );
    },
  };
});

jest.mock('@umijs/max', () => ({
  Link: ({ children, to }: any) => {
    const React = jest.requireActual('react');
    return React.createElement('a', { href: to }, children);
  },
  history: { push: jest.fn() },
  useParams: () => ({ name: 'PINV-2026-0001' }),
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

jest.mock('@/components/InvoicePaymentForm', () => {
  const actual = jest.requireActual('@/components/InvoicePaymentForm');
  return {
    ...actual,
    InvoicePaymentForm: () => {
      const React = jest.requireActual('react');
      return React.createElement('div', null, '付款表单');
    },
  };
});

jest.mock('@/components/PrintDocumentButton', () => ({
  PrintDocumentButton: () => {
    const React = jest.requireActual('react');
    return React.createElement('button', { type: 'button' }, '打印');
  },
}));

jest.mock('@/services/myapp/purchase', () => ({
  cancelPurchaseInvoice: jest.fn(),
  cancelSupplierPaymentEntry: jest.fn(),
  getPurchaseInvoiceDetail: jest.fn(),
  recordSupplierPayment: jest.fn(),
}));

const {
  cancelPurchaseInvoice,
  cancelSupplierPaymentEntry,
  getPurchaseInvoiceDetail,
} = jest.requireMock('@/services/myapp/purchase');

const baseInvoiceDetail = {
  amount: 300,
  canCancel: true,
  company: 'rgc (Demo)',
  currency: 'CNY',
  documentStatus: 'submitted',
  dueDate: '2026-07-12',
  items: [
    {
      amount: 300,
      itemCode: 'SKU-001',
      itemName: 'Camera',
      purchaseOrderItem: 'po-item-001',
      qty: 3,
      rate: 100,
      uom: 'Nos',
      uomDisplay: null,
      warehouse: 'Stores - RD',
    },
  ],
  latestPaymentEntry: 'PAY-0001',
  name: 'PINV-2026-0001',
  outstandingAmount: 0,
  paidAmount: 300,
  paymentEntries: [
    {
      allocatedAmount: 300,
      amount: 300,
      date: '2026-07-05',
      modeOfPayment: 'Bank',
      paymentEntry: 'PAY-0001',
      referenceName: 'PINV-2026-0001',
    },
  ],
  paymentStatus: 'paid',
  postingDate: '2026-07-05',
  purchaseOrders: ['PUR-ORD-2026-0001'],
  purchaseReceipts: ['MAT-PRE-2026-0001'],
  remarks: '',
  supplier: 'SUP-0001',
  supplierName: '供应商 A',
};

const originalGetComputedStyle = window.getComputedStyle;

async function waitForInvoiceActionsReady() {
  await waitFor(() => {
    expect(
      (
        screen.getAllByRole('button', {
          name: '取消采购发票',
        })[0] as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
}

describe('PurchaseInvoiceDetailPage', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'getComputedStyle', {
      configurable: true,
      value: (() =>
        document.documentElement.style) as typeof window.getComputedStyle,
    });
  });

  afterAll(() => {
    Object.defineProperty(window, 'getComputedStyle', {
      configurable: true,
      value: originalGetComputedStyle,
    });
  });

  beforeEach(() => {
    Modal.destroyAll();
    jest.clearAllMocks();
    getPurchaseInvoiceDetail.mockResolvedValue({ ...baseInvoiceDetail });
    cancelPurchaseInvoice.mockResolvedValue({
      data: { purchase_invoice: 'OK' },
    });
    cancelSupplierPaymentEntry.mockResolvedValue({
      data: { payment_entry: 'OK' },
    });
  });

  it('requires a second confirmation before cancelling a single supplier payment and voiding the invoice', async () => {
    render(
      React.createElement(
        App,
        null,
        React.createElement(PurchaseInvoiceDetailPage),
      ),
    );

    await waitForInvoiceActionsReady();
    fireEvent.click(screen.getAllByRole('button', { name: '取消采购发票' })[0]);

    expect(await screen.findByText('发票存在供应商付款')).toBeTruthy();
    fireEvent.click(
      screen.getAllByRole('button', { name: '取消付款并作废发票' })[0],
    );

    expect(
      await screen.findByText('同步取消供应商付款并作废发票？'),
    ).toBeTruthy();
    const confirmButtons = screen.getAllByRole('button', {
      name: '取消付款并作废发票',
    });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(cancelSupplierPaymentEntry).toHaveBeenCalledWith('PAY-0001');
      expect(cancelPurchaseInvoice).toHaveBeenCalledWith('PINV-2026-0001');
    });
  });

  it('blocks invoice voiding until multiple supplier payments are cancelled manually', async () => {
    getPurchaseInvoiceDetail.mockResolvedValue({
      ...baseInvoiceDetail,
      latestPaymentEntry: 'PAY-0002',
      paymentEntries: [
        baseInvoiceDetail.paymentEntries[0],
        {
          allocatedAmount: 120,
          amount: 120,
          date: '2026-07-06',
          modeOfPayment: 'Cash',
          paymentEntry: 'PAY-0002',
          referenceName: 'PINV-2026-0001',
        },
      ],
    });

    render(
      React.createElement(
        App,
        null,
        React.createElement(PurchaseInvoiceDetailPage),
      ),
    );

    await waitForInvoiceActionsReady();
    fireEvent.click(screen.getAllByRole('button', { name: '取消采购发票' })[0]);

    expect(await screen.findByText('多笔付款需要逐笔处理')).toBeTruthy();
    expect(screen.getAllByText('PAY-0001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PAY-0002').length).toBeGreaterThan(0);
    expect(
      (
        screen.getByRole('button', {
          name: '确认作废发票',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(cancelPurchaseInvoice).not.toHaveBeenCalled();
  });

  it('cancels the selected supplier payment from payment history', async () => {
    render(
      React.createElement(
        App,
        null,
        React.createElement(PurchaseInvoiceDetailPage),
      ),
    );

    await waitForInvoiceActionsReady();
    fireEvent.click(screen.getAllByRole('button', { name: '选择取消付款' })[0]);

    expect(await screen.findByText('请选择具体付款单')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: '取消付款' })[0]);

    expect(await screen.findByText('取消供应商付款凭证')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '确认取消这笔付款' }));

    await waitFor(() => {
      expect(cancelSupplierPaymentEntry).toHaveBeenCalledWith('PAY-0001');
      expect(cancelPurchaseInvoice).not.toHaveBeenCalled();
    });
  });
});
