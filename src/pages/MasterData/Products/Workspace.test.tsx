import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App, Modal } from 'antd';
import React from 'react';
import {
  getProductDetail,
  listProductChangeHistory,
  listProductPrices,
  updateProduct,
} from '@/services/myapp/master-data';
import ProductMaintenanceWorkspace from './Workspace';

jest.mock('@umijs/max', () => {
  let search = '?section=basic';
  return {
    __setSearch: (value: string) => {
      search = value;
    },
    history: { push: jest.fn() },
    useLocation: () => ({ search }),
    useParams: () => ({ itemCode: 'ITEM-001' }),
    useRequest: (service: () => Promise<unknown>) => {
      const React = jest.requireActual('react');
      const [revision, setRevision] = React.useState(0);
      const [state, setState] = React.useState({
        data: undefined,
        error: undefined,
        loading: true,
      });

      React.useEffect(() => {
        let mounted = true;
        setState((current: typeof state) => ({ ...current, loading: true }));
        service()
          .then((data) => {
            if (mounted) setState({ data, error: undefined, loading: false });
          })
          .catch((error: Error) => {
            if (mounted) setState({ data: undefined, error, loading: false });
          });
        return () => {
          mounted = false;
        };
      }, [revision]);

      return {
        ...state,
        refresh: () => setRevision((current: number) => current + 1),
      };
    },
  };
});

jest.mock('@/components/ItemImageUpload', () => ({
  ItemImageUpload: () => {
    const React = jest.requireActual('react');
    return React.createElement('div', null, '商品图片上传区');
  },
}));

jest.mock('@/components/RemoteLinkSelect', () => ({
  RemoteLinkSelect: () => {
    const React = jest.requireActual('react');
    const { Input } = jest.requireActual('antd');
    return React.createElement(Input);
  },
}));

jest.mock('@/components/ProductUomFields', () => {
  const React = jest.requireActual('react');
  const { Form, Input } = jest.requireActual('antd');
  return {
    ProductUomFields: ({ lockStockUom }: { lockStockUom?: boolean }) =>
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          Form.Item,
          { label: '库存基准单位', name: 'stockUom' },
          React.createElement(Input, {
            'data-testid': 'stock-uom-input',
            disabled: lockStockUom,
          }),
        ),
        React.createElement('div', null, '商品单位与换算'),
      ),
  };
});

jest.mock('./ProductPriceEditorModal', () => ({
  ProductPriceEditorModal: () => null,
}));

jest.mock('./ProductUomMigrationModal', () => {
  const React = jest.requireActual('react');
  return {
    ProductUomMigrationModal: ({ open }: { open: boolean }) =>
      open ? React.createElement('div', null, '单位纠正窗口') : null,
  };
});

jest.mock('@/services/myapp/master-data', () => ({
  addProductBarcode: jest.fn(),
  deleteProductBarcode: jest.fn(),
  getProductDetail: jest.fn(),
  listProductChangeHistory: jest.fn(),
  listProductPrices: jest.fn(),
  setPrimaryProductBarcode: jest.fn(),
  terminateProductPrice: jest.fn(),
  updateProduct: jest.fn(),
}));

const mockedGetProductDetail = jest.mocked(getProductDetail);
const mockedListProductChangeHistory = jest.mocked(listProductChangeHistory);
const mockedListProductPrices = jest.mocked(listProductPrices);
const mockedUpdateProduct = jest.mocked(updateProduct);
const mockedUmi = jest.requireMock('@umijs/max') as {
  __setSearch: (value: string) => void;
  history: { push: jest.Mock };
};

const product = {
  allUomDisplays: { Box: '箱', Nos: '件' },
  allUoms: ['Nos', 'Box'],
  barcode: '690000000001',
  barcodes: [
    {
      barcode: '690000000001',
      isPrimary: true,
      name: 'BARCODE-1',
      uom: 'Nos',
    },
  ],
  brand: '测试品牌',
  description: '测试描述',
  disabled: false,
  globalWarehouseStockDetails: [],
  imageUrl: '',
  itemCode: 'ITEM-001',
  itemGroup: '商品',
  itemName: '测试商品',
  modified: '2026-09-02 10:00:00',
  price: 10,
  priceSummary: {
    currentRate: 10,
    retailRate: 12,
    standardBuyingRate: 8,
    standardSellingRate: 10,
    valuationRate: 7,
    wholesaleRate: 9,
  },
  retailDefaultUom: 'Nos',
  salesProfiles: [],
  specification: '',
  stockQty: 5,
  stockUom: 'Nos',
  stockUomDisplay: '件',
  totalQty: 5,
  uom: 'Nos',
  uomConversions: [
    { conversionFactor: 1, uom: 'Nos' },
    { conversionFactor: 24, uom: 'Box' },
  ],
  uomDisplay: '件',
  warehouse: 'Stores - TD',
  warehouseStockDetails: [
    { company: 'Test Company', qty: 5, warehouse: 'Stores - TD' },
  ],
  warehouseStockQty: 5,
  wholesaleDefaultUom: 'Box',
};

function renderWorkspace() {
  return render(
    React.createElement(
      App,
      null,
      React.createElement(ProductMaintenanceWorkspace),
    ),
  );
}

describe('ProductMaintenanceWorkspace', () => {
  beforeEach(() => {
    Modal.destroyAll();
    jest.clearAllMocks();
    mockedUmi.__setSearch('?section=basic');
    mockedGetProductDetail.mockResolvedValue(product as never);
    mockedListProductChangeHistory.mockResolvedValue({
      events: [],
      hasMore: false,
      itemCode: 'ITEM-001',
      limit: 100,
      start: 0,
    });
    mockedListProductPrices.mockResolvedValue({
      canCreate: true,
      canWrite: true,
      itemCode: 'ITEM-001',
      itemModified: product.modified,
      priceLists: [],
      prices: [],
    });
    mockedUpdateProduct.mockResolvedValue(product as never);
  });

  it('loads the product and saves ordinary master-data changes in place', async () => {
    renderWorkspace();

    expect(await screen.findByText('商品维护工作区 · 测试商品')).toBeTruthy();
    expect(screen.getByRole('tab', { name: '基本资料' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '销售价格' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '采购价格' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '变更历史' })).toBeTruthy();

    const nameInput = screen.getByLabelText('商品名称');
    fireEvent.change(nameInput, { target: { value: '测试商品（新）' } });
    expect(screen.getByText('当前有尚未保存的商品资料修改')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /保存商品资料/ })[0]);

    await waitFor(() => {
      expect(mockedUpdateProduct).toHaveBeenCalledWith(
        'ITEM-001',
        expect.objectContaining({ itemName: '测试商品（新）' }),
      );
    });
  });

  it('locks the stock UOM and exposes the governed correction flow', async () => {
    mockedUmi.__setSearch('?section=units');
    renderWorkspace();

    expect(await screen.findByText('商品维护工作区 · 测试商品')).toBeTruthy();
    expect(
      screen.getByRole('tab', { name: '单位与包装', selected: true }),
    ).toBeTruthy();
    expect(
      screen.getByTestId<HTMLInputElement>('stock-uom-input').disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /单位风险纠正/ }));
    expect(screen.getByText('单位纠正窗口')).toBeTruthy();
  });

  it('keeps the complete price matrix read-only without Item Price permission', async () => {
    mockedUmi.__setSearch('?section=selling-prices');
    mockedListProductPrices.mockResolvedValue({
      canCreate: false,
      canWrite: false,
      itemCode: 'ITEM-001',
      itemModified: product.modified,
      priceLists: [],
      prices: [
        {
          currency: 'CNY',
          modified: '2026-09-02 10:00:00',
          name: 'PRICE-1',
          priceList: 'Standard Selling',
          priceListType: 'selling',
          rate: 10,
          uom: 'Nos',
          validFrom: null,
          validUpto: null,
        },
      ],
    });
    renderWorkspace();

    expect(await screen.findByText('Standard Selling')).toBeTruthy();
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: /新增销售价格/ })
        .disabled,
    ).toBe(true);
    expect(screen.getByText('只读')).toBeTruthy();
  });

  it('asks for confirmation before leaving with unsaved changes', async () => {
    renderWorkspace();
    fireEvent.change(await screen.findByLabelText('商品名称'), {
      target: { value: '尚未保存的名称' },
    });
    fireEvent.click(screen.getByRole('tab', { name: '销售价格' }));

    expect(
      (await screen.findAllByText('放弃未保存修改？')).length,
    ).toBeGreaterThan(0);
    expect(mockedUmi.history.push).not.toHaveBeenCalled();
  });

  it('renders the governed product change timeline from the backend', async () => {
    mockedUmi.__setSearch('?section=history');
    mockedListProductChangeHistory.mockResolvedValue({
      events: [
        {
          action: 'terminated',
          actor: 'editor@example.com',
          category: 'price',
          changes: [
            {
              field: 'valid_upto',
              label: '失效日期',
              newValue: '2026-09-03',
              oldValue: null,
              rowAction: null,
            },
          ],
          id: 'Version:VERSION-1',
          occurredAt: '2026-09-03 10:00:00',
          sourceDoctype: 'Item Price',
          sourceName: 'PRICE-1',
          summary: 'Standard Selling · 件',
          title: '终止价格',
        },
      ],
      hasMore: false,
      itemCode: 'ITEM-001',
      limit: 100,
      start: 0,
    });

    renderWorkspace();

    expect(await screen.findByText('正式变更审计')).toBeTruthy();
    expect(screen.getByText('终止价格')).toBeTruthy();
    expect(screen.getByText('Standard Selling · 件')).toBeTruthy();
    expect(screen.getByText(/失效日期/)).toBeTruthy();
    expect(mockedListProductChangeHistory).toHaveBeenCalledWith('ITEM-001', {
      limit: 100,
    });
  });
});
