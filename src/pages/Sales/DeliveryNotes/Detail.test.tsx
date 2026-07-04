import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App, Modal } from 'antd';
import React from 'react';
import DeliveryNoteDetailPage from './Detail';

jest.mock('@umijs/max', () => ({
  Link: ({ children }: any) => {
    const React = jest.requireActual('react');
    return React.createElement('a', null, children);
  },
  useParams: () => ({ name: 'MAT-DN-2026-00274' }),
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
  cancelDeliveryNote: jest.fn(),
  getDeliveryNoteDetail: jest.fn(),
}));

const { cancelDeliveryNote, getDeliveryNoteDetail } = jest.requireMock(
  '@/services/myapp/sales',
);

const baseDeliveryNoteDetail = {
  addressDisplay: '上海市浦东新区测试路 88 号 5 楼',
  canCancelDeliveryNote: true,
  cancelDeliveryNoteHint: '',
  company: 'rgc (Demo)',
  contactDisplay: '张三',
  contactPhone: '13800138000',
  currency: 'CNY',
  documentStatus: 'submitted',
  grandTotal: 1280,
  items: [
    {
      amount: 1280,
      deliveredQty: 2,
      itemCode: 'SKU010',
      itemName: 'Camera',
      qty: 2,
      rate: 640,
      salesMode: 'wholesale' as const,
      salesOrderItem: 'so-item-001',
      specification: '',
      uom: 'Nos',
      uomDisplay: null,
      warehouse: 'Stores - RD',
    },
  ],
  name: 'MAT-DN-2026-00274',
  postingDate: '2026-07-04',
  postingTime: '10:00:00',
  remarks: '测试发货',
  salesInvoices: [],
  salesOrders: ['SAL-ORD-2026-01204'],
  totalQty: 2,
};

describe('DeliveryNoteDetailPage', () => {
  beforeEach(() => {
    Modal.destroyAll();
    jest.clearAllMocks();
    getDeliveryNoteDetail.mockResolvedValue({ ...baseDeliveryNoteDetail });
    cancelDeliveryNote.mockResolvedValue({ data: { delivery_note: 'OK' } });
  });

  it('opens an explicit void confirmation before cancelling a delivery note', async () => {
    render(
      React.createElement(
        App,
        null,
        React.createElement(DeliveryNoteDetailPage),
      ),
    );

    expect(await screen.findByText('Camera')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: '作废发货单' })[0]);

    expect(
      await screen.findByText('作废发货单 MAT-DN-2026-00274？'),
    ).toBeTruthy();
    expect(screen.getByText('这是库存和履约回退操作')).toBeTruthy();
    expect(screen.getAllByText('SAL-ORD-2026-01204')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: '确认作废发货单' }));

    await waitFor(() => {
      expect(cancelDeliveryNote).toHaveBeenCalledWith('MAT-DN-2026-00274');
    });
  });

  it('shows downstream invoice blocking reason when the delivery note cannot be cancelled', async () => {
    getDeliveryNoteDetail.mockResolvedValue({
      ...baseDeliveryNoteDetail,
      canCancelDeliveryNote: false,
      cancelDeliveryNoteHint:
        '当前发货单已关联销售发票，请先作废销售发票，再回退发货单。',
      salesInvoices: ['ACC-SINV-2026-00695'],
    });

    render(
      React.createElement(
        App,
        null,
        React.createElement(DeliveryNoteDetailPage),
      ),
    );

    expect(await screen.findByText('ACC-SINV-2026-00695')).toBeTruthy();
    expect(
      screen.getByText(
        '当前发货单已关联销售发票，请先作废销售发票，再回退发货单。',
      ),
    ).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: '作废发货单' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });
});
