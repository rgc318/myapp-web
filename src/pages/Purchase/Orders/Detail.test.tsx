import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App, Modal } from 'antd';
import React from 'react';
import PurchaseOrderDetailPage from './Detail';

jest.mock('@umijs/max', () => ({
  history: {
    push: jest.fn(),
  },
  Link: ({ children }: any) => {
    const React = jest.requireActual('react');
    return React.createElement('a', null, children);
  },
  useParams: () => ({ name: 'PUR-ORD-2026-01846-1' }),
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
  cancelPurchaseOrder: jest.fn(),
  cancelSupplierPaymentEntry: jest.fn(),
  createPurchaseInvoiceFromReceipt: jest.fn(),
  createPurchaseOrderInvoice: jest.fn(),
  getPurchaseInvoiceDetail: jest.fn(),
  getPurchaseOrderDetail: jest.fn(),
  purchaseOrderEditDisabledReason: jest.fn((detail: any) => {
    if (!detail) {
      return '未能加载采购订单，不能编辑';
    }
    if (detail.documentStatus === 'cancelled') {
      return '订单已作废，不能编辑';
    }
    if (detail.documentStatus !== 'submitted') {
      return '只有已提交且未进入下游流程的采购订单才能编辑';
    }
    if (detail.purchaseInvoices.length) {
      return '订单已存在采购发票，不能直接编辑；请先作废采购发票后再回退修改';
    }
    if (detail.purchaseReceipts.length) {
      return '订单已存在采购收货单，不能直接编辑；请先取消采购收货单后再回退修改';
    }
    return '';
  }),
  quickCancelPurchaseOrderV2: jest.fn(),
  receivePurchaseOrder: jest.fn(),
  recordSupplierPayment: jest.fn(),
}));

const {
  createPurchaseInvoiceFromReceipt,
  createPurchaseOrderInvoice,
  getPurchaseOrderDetail,
  receivePurchaseOrder,
} = jest.requireMock('@/services/myapp/purchase');

const basePurchaseOrderDetail = {
  actualPaidAmount: 0,
  amount: 120,
  canCancelOrder: true,
  canCreateInvoice: true,
  canReceive: true,
  canRecordPayment: false,
  company: 'rgc (Demo)',
  completionStatus: 'open',
  currency: 'CNY',
  documentStatus: 'submitted',
  items: [
    {
      amount: 120,
      billedQty: 0,
      imageUrl: '/files/item.png',
      itemCode: 'SKU-PUR-001',
      itemName: '采购测试商品',
      pendingBillingQty: 2,
      purchaseOrderItem: 'po-item-001',
      qty: 2,
      rate: 60,
      receivedQty: 0,
      uom: 'Nos',
      uomDisplay: null,
      warehouse: 'Stores - RD',
    },
  ],
  latestPaymentEntry: '',
  name: 'PUR-ORD-2026-01846-1',
  outstandingAmount: 120,
  paidAmount: 0,
  paymentEntries: [],
  paymentStatus: 'unpaid',
  purchaseInvoices: [],
  purchaseReceipts: [],
  receivingStatus: 'pending',
  remarks: '',
  scheduleDate: '2026-07-08',
  supplier: 'Supplier A',
  supplierAddressDisplay: '上海市测试路 1 号',
  supplierContactDisplay: '李四',
  supplierContactPhone: '13900139000',
  supplierName: '测试供应商',
  supplierRef: '',
  timeline: [],
  transactionDate: '2026-07-07',
};

describe('PurchaseOrderDetailPage', () => {
  beforeEach(() => {
    Modal.destroyAll();
    jest.clearAllMocks();
    getPurchaseOrderDetail.mockResolvedValue({ ...basePurchaseOrderDetail });
  });

  it('confirms quick billing before creating purchase receipt and purchase invoice', async () => {
    receivePurchaseOrder.mockResolvedValue({
      data: { purchase_receipt: 'MAT-PRE-2026-01052' },
    });
    createPurchaseInvoiceFromReceipt.mockResolvedValue({
      data: { purchase_invoice: 'ACC-PINV-2026-01318' },
    });

    render(
      React.createElement(
        App,
        null,
        React.createElement(PurchaseOrderDetailPage),
      ),
    );

    fireEvent.click(await screen.findByRole('button', { name: '一键开单' }));

    expect(
      await screen.findAllByText('一键开单 PUR-ORD-2026-01846-1'),
    ).toHaveLength(2);
    expect(
      screen.getByText(
        '系统会先按当前待收数量创建采购收货单，再基于本次收货创建采购发票。',
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '确认收货并开票' }));

    await waitFor(() => {
      expect(receivePurchaseOrder).toHaveBeenCalledWith('PUR-ORD-2026-01846-1');
      expect(createPurchaseInvoiceFromReceipt).toHaveBeenCalledWith(
        'MAT-PRE-2026-01052',
      );
      expect(createPurchaseOrderInvoice).not.toHaveBeenCalled();
    });
    expect(await screen.findAllByText('一键开单成功')).toHaveLength(2);
  });
});
