import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App, Modal } from 'antd';
import React from 'react';
import SalesOrderDetailPage, { buildSalesReturnSourceOptions } from './Detail';

let mockLocationSearch = '';

jest.mock('@umijs/max', () => ({
  history: {
    push: jest.fn(),
  },
  Link: ({ children }: any) => {
    const React = jest.requireActual('react');
    return React.createElement('a', null, children);
  },
  useLocation: () => ({ search: mockLocationSearch }),
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
  cancelSalesPaymentEntry: jest.fn(),
  createSalesOrderInvoice: jest.fn(),
  getSalesInvoiceDetail: jest.fn(),
  getSalesOrderDetail: jest.fn(),
  quickCancelSalesOrderV2: jest.fn(),
  recordSalesOrderPayment: jest.fn(),
  salesOrderEditDisabledReason: jest.fn((detail: any) => {
    if (!detail) {
      return '未能加载销售订单，不能编辑';
    }
    if (detail.documentStatus === 'cancelled') {
      return '订单已作废，不能编辑';
    }
    if (detail.documentStatus !== 'submitted') {
      return '只有已提交且未进入下游流程的销售订单才能编辑';
    }
    if (detail.completionStatus === 'completed') {
      return '订单已完成并结清，不能直接编辑；如需改错，请先按回退流程处理下游单据';
    }
    if (detail.paymentStatus === 'paid') {
      return '订单已结清，不能直接编辑；如需改错，请先取消客户收款并回退下游单据';
    }
    if (detail.salesInvoices.length) {
      return '订单已存在销售发票，不能直接编辑；请先作废销售发票后再回退修改';
    }
    if (detail.deliveryNotes.length) {
      return '订单已存在销售发货单，不能直接编辑；请先作废发货单后再回退修改';
    }
    return '';
  }),
  submitSalesOrderDelivery: jest.fn(),
}));

const {
  cancelSalesPaymentEntry,
  createSalesOrderInvoice,
  getSalesOrderDetail,
  quickCancelSalesOrderV2,
  submitSalesOrderDelivery,
} = jest.requireMock('@/services/myapp/sales');

const baseSalesOrderDetail = {
  addressDisplay: '上海市浦东新区测试路 88 号 5 楼',
  amount: 9999999,
  canCancelOrder: true,
  cancelSalesOrderHint: '',
  canCreateSalesInvoice: true,
  canRecordPayment: false,
  canSubmitDelivery: true,
  company: 'rgc (Demo)',
  completionStatus: 'open',
  contactDisplay: '张三',
  contactPhone: '13800138000',
  currency: 'CNY',
  customer: 'Palmer Productions Ltd.',
  defaultSalesMode: 'wholesale' as const,
  deliveryDate: '2026-06-05',
  deliveryNotes: [],
  deliveryOverdueDays: 0,
  documentStatus: 'submitted',
  fulfillmentStatus: 'pending',
  isDeliveryOverdue: false,
  isPaymentOverdue: false,
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
      salesMode: 'wholesale' as const,
      salesOrderItem: '97kr48q50j',
      specification: '',
      uom: 'Nos',
      uomDisplay: null,
      warehouse: 'Stores - RD',
    },
  ],
  name: 'SAL-ORD-2026-01204',
  modified: '2026-06-05 12:00:00',
  outstandingAmount: 0,
  paidAmount: 0,
  paymentOverdueDays: 0,
  paymentStatus: 'unpaid',
  receivableAmount: 0,
  remarks: 'v2 HTTP test order',
  salesInvoices: [],
  timeline: [],
  transactionDate: '2026-06-05',
};

describe('SalesOrderDetailPage', () => {
  beforeEach(() => {
    Modal.destroyAll();
    jest.clearAllMocks();
    mockLocationSearch = '';
    getSalesOrderDetail.mockResolvedValue({ ...baseSalesOrderDetail });
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

  it('explains unavailable action targets from list entry links', async () => {
    mockLocationSearch = '?action=payment';

    render(
      React.createElement(App, null, React.createElement(SalesOrderDetailPage)),
    );

    expect(await screen.findByText('登记客户收款暂不可用')).toBeTruthy();
    expect(screen.getByText('请先创建销售发票后再登记客户收款')).toBeTruthy();
  });

  it('hides sales return and refund entry buttons while the feature is disabled', async () => {
    getSalesOrderDetail.mockResolvedValue({
      ...baseSalesOrderDetail,
      deliveryNotes: ['MAT-DN-2026-00274'],
      salesInvoices: ['ACC-SINV-2026-00695'],
      timeline: [
        {
          amount: -100,
          date: '2026-07-03',
          description: '销售退货',
          docname: 'ACC-SINV-RET-2026-00001',
          doctype: 'Sales Invoice',
          modeOfPayment: '',
          referenceNo: '',
          status: 'submitted',
          type: 'sales_return',
        },
        {
          amount: -100,
          date: '2026-07-03',
          description: '客户退款',
          docname: 'ACC-PAY-RET-2026-00001',
          doctype: 'Payment Entry',
          modeOfPayment: 'Bank',
          referenceNo: '',
          status: 'submitted',
          type: 'customer_refund',
        },
      ],
    });

    render(
      React.createElement(App, null, React.createElement(SalesOrderDetailPage)),
    );

    expect(await screen.findByText('ACC-SINV-2026-00695')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '发起退货' })).toBeNull();
    expect(screen.queryByRole('button', { name: '退款核对' })).toBeNull();
    expect(screen.queryByText('退货发票')).toBeNull();
    expect(screen.queryByText('退款单')).toBeNull();
  });

  it('disables direct editing after invoices or settlement exist', async () => {
    getSalesOrderDetail.mockResolvedValue({
      ...baseSalesOrderDetail,
      completionStatus: 'completed',
      deliveryNotes: ['MAT-DN-2026-00274'],
      paymentStatus: 'paid',
      salesInvoices: ['ACC-SINV-2026-00695'],
    });

    render(
      React.createElement(App, null, React.createElement(SalesOrderDetailPage)),
    );

    expect(await screen.findByText('ACC-SINV-2026-00695')).toBeTruthy();
    const editButton = screen.getByRole('button', { name: '编辑订单' });
    expect((editButton as HTMLButtonElement).disabled).toBe(true);
  });

  it('confirms quick billing before creating delivery note and sales invoice', async () => {
    submitSalesOrderDelivery.mockResolvedValue({
      data: { delivery_note: 'MAT-DN-2026-00274' },
    });
    createSalesOrderInvoice.mockResolvedValue({
      data: { sales_invoice: 'ACC-SINV-2026-00695' },
    });

    render(
      React.createElement(App, null, React.createElement(SalesOrderDetailPage)),
    );

    fireEvent.click(await screen.findByRole('button', { name: '一键开单' }));

    expect(
      await screen.findAllByText('一键开单 SAL-ORD-2026-01204'),
    ).toHaveLength(2);
    expect(
      screen.getByText(
        '系统会先按当前待发数量创建销售发货单，再创建销售发票。',
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '确认发货并开票' }));

    await waitFor(() => {
      expect(submitSalesOrderDelivery).toHaveBeenCalledWith(
        'SAL-ORD-2026-01204',
        { forceDelivery: false },
      );
      expect(createSalesOrderInvoice).toHaveBeenCalledWith(
        'SAL-ORD-2026-01204',
      );
    });
    expect(await screen.findAllByText('一键开单成功')).toHaveLength(2);
  });

  it('asks for explicit confirmation before rolling back customer payments', async () => {
    getSalesOrderDetail.mockResolvedValue({
      ...baseSalesOrderDetail,
      deliveryNotes: ['MAT-DN-2026-00274'],
      paidAmount: 100,
      paymentStatus: 'paid',
      salesInvoices: ['ACC-SINV-2026-00695'],
      timeline: [
        {
          amount: 100,
          date: '2026-07-03',
          description: '客户收款',
          docname: 'ACC-PAY-2026-00001',
          doctype: 'Payment Entry',
          modeOfPayment: 'Bank',
          referenceNo: '',
          status: 'submitted',
          type: 'payment_entry',
        },
      ],
    });

    render(
      React.createElement(App, null, React.createElement(SalesOrderDetailPage)),
    );

    fireEvent.click(
      await screen.findByRole('button', { name: '回退并修改订单' }),
    );
    expect(await screen.findByText('订单存在客户收款')).toBeTruthy();
    expect(screen.getAllByText('ACC-PAY-2026-00001').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '取消收款' })).toBeTruthy();

    fireEvent.click(
      await screen.findByRole('button', { name: '一键回退并修改' }),
    );

    expect(await screen.findAllByText('强制回退已收款订单？')).toHaveLength(2);
    expect(quickCancelSalesOrderV2).not.toHaveBeenCalled();
  });

  it('lists multiple customer payments for manual cancellation before rollback', async () => {
    cancelSalesPaymentEntry.mockResolvedValue({});
    getSalesOrderDetail.mockResolvedValue({
      ...baseSalesOrderDetail,
      deliveryNotes: ['MAT-DN-2026-00274'],
      paidAmount: 300,
      paymentStatus: 'paid',
      salesInvoices: ['ACC-SINV-2026-00695'],
      timeline: [
        {
          amount: 100,
          date: '2026-07-03',
          description: '客户收款',
          docname: 'ACC-PAY-2026-00001',
          doctype: 'Payment Entry',
          modeOfPayment: 'Bank',
          referenceNo: 'REF-001',
          status: 'submitted',
          type: 'payment_entry',
        },
        {
          amount: 200,
          date: '2026-07-03',
          description: '客户收款',
          docname: 'ACC-PAY-2026-00002',
          doctype: 'Payment Entry',
          modeOfPayment: 'Cash',
          referenceNo: 'REF-002',
          status: 'submitted',
          type: 'payment_entry',
        },
      ],
    });

    render(
      React.createElement(App, null, React.createElement(SalesOrderDetailPage)),
    );

    fireEvent.click(
      await screen.findByRole('button', { name: '回退并修改订单' }),
    );

    expect(await screen.findByText('多笔收款需要逐笔处理')).toBeTruthy();
    expect(screen.getAllByText('ACC-PAY-2026-00001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ACC-PAY-2026-00002').length).toBeGreaterThan(0);
    expect(
      (
        screen.getByRole('button', {
          name: '继续回退发票和发货单',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it('uses sales invoices instead of delivery notes for invoiced order returns', () => {
    expect(
      buildSalesReturnSourceOptions({
        ...baseSalesOrderDetail,
        deliveryNotes: ['MAT-DN-2026-00274'],
        salesInvoices: ['ACC-SINV-2026-00695'],
      }),
    ).toEqual([
      {
        doctype: 'Sales Invoice',
        label: '销售发票',
        name: 'ACC-SINV-2026-00695',
      },
    ]);
  });
});
