import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { history } from '@umijs/max';
import { App } from 'antd';
import React from 'react';
import { listStockLedgerEntries } from '@/services/myapp/inventory';
import {
  addProductBarcode,
  getProductDetail,
  listProductPrices,
  setProductDisabled,
} from '@/services/myapp/master-data';
import ProductDetailPage from './Detail';

jest.mock('@umijs/max', () => ({
  history: { push: jest.fn(), replace: jest.fn() },
  Link: ({ children }: { children: unknown }) => children,
  useLocation: () => ({
    pathname: '/master-data/products/ITEM-001',
    search: '',
  }),
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
}));

jest.mock('@/components/BarcodeScannerButton', () => ({
  BarcodeScannerButton: () => null,
}));

jest.mock('@/components/ProductImage', () => ({
  ProductImage: () => {
    const React = jest.requireActual('react');
    return React.createElement('div', null, '商品图片');
  },
}));

jest.mock('./ProductPriceEditorModal', () => ({
  ProductPriceEditorModal: () => null,
}));

jest.mock('./ProductUomMigrationModal', () => ({
  ProductUomMigrationModal: () => null,
}));

jest.mock('@/services/myapp/inventory', () => ({
  listStockLedgerEntries: jest.fn(),
}));

jest.mock('@/services/myapp/master-data', () => ({
  addProductBarcode: jest.fn(),
  deleteProductBarcode: jest.fn(),
  getProductDetail: jest.fn(),
  listProductPrices: jest.fn(),
  setPrimaryProductBarcode: jest.fn(),
  setProductDisabled: jest.fn(),
  terminateProductPrice: jest.fn(),
}));

const mockedAddProductBarcode = jest.mocked(addProductBarcode);
const mockedGetProductDetail = jest.mocked(getProductDetail);
const mockedListProductPrices = jest.mocked(listProductPrices);
const mockedListStockLedgerEntries = jest.mocked(listStockLedgerEntries);
const mockedSetProductDisabled = jest.mocked(setProductDisabled);
const mockedHistoryPush = history.push as jest.Mock;
const originalGetComputedStyle = window.getComputedStyle;

const product = {
  allUomDisplays: { Nos: '件' },
  allUoms: ['Nos'],
  barcode: '',
  barcodes: [],
  brand: '',
  canWrite: true,
  description: '',
  disabled: false,
  globalWarehouseStockDetails: [],
  imageUrl: '',
  itemCode: 'ITEM-001',
  itemGroup: '商品',
  itemName: '测试商品',
  modified: '2026-09-03 10:00:00',
  price: null,
  priceSummary: null,
  salesProfiles: [],
  specification: '',
  stockQty: 0,
  stockUom: 'Nos',
  stockUomDisplay: '件',
  totalQty: 0,
  uom: 'Nos',
  uomConversions: [{ conversionFactor: 1, uom: 'Nos' }],
  uomDisplay: '件',
  warehouse: '',
  warehouseStockDetails: [],
  warehouseStockQty: 0,
};

function renderPage() {
  return render(
    React.createElement(App, null, React.createElement(ProductDetailPage)),
  );
}

describe('ProductDetailPage permissions and concurrency', () => {
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
    jest.clearAllMocks();
    mockedGetProductDetail.mockResolvedValue(product as never);
    mockedListProductPrices.mockResolvedValue({
      canCreate: false,
      canWrite: false,
      itemCode: 'ITEM-001',
      itemModified: product.modified,
      priceLists: [],
      prices: [],
    });
    mockedListStockLedgerEntries.mockResolvedValue({
      hasMore: false,
      items: [],
      total: 0,
    });
  });

  it('disables Item mutations when the product is read-only', async () => {
    mockedGetProductDetail.mockResolvedValue({
      ...product,
      canWrite: false,
    } as never);

    renderPage();

    expect(await screen.findByText('当前商品为只读')).toBeTruthy();
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: '编辑商品' })
        .disabled,
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: '单位错误纠正' })
        .disabled,
    ).toBe(true);
    expect(
      screen.getByPlaceholderText<HTMLInputElement>('新增条码').disabled,
    ).toBe(true);
    expect(mockedSetProductDisabled).not.toHaveBeenCalled();
  });

  it('passes the current Item version when adding a barcode', async () => {
    renderPage();

    fireEvent.change(await screen.findByPlaceholderText('新增条码'), {
      target: { value: 'BAR-NEW' },
    });
    fireEvent.click(screen.getByRole('button', { name: /新增条码/ }));

    await waitFor(() => {
      expect(mockedAddProductBarcode).toHaveBeenCalledWith(
        'ITEM-001',
        'BAR-NEW',
        {
          itemModified: '2026-09-03 10:00:00',
          uom: 'Nos',
        },
      );
    });
  });

  it('separates optional enrichment from data errors and routes fixes precisely', async () => {
    renderPage();

    expect(await screen.findByText('治理状态良好')).toBeTruthy();
    expect(screen.queryByText(/资料完整度/)).toBeNull();
    expect(screen.getByText('尚未维护条码（可选）')).toBeTruthy();
    expect(screen.getByText('尚未维护采购参考价（可选）')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '维护条码' }));
    expect(mockedHistoryPush).toHaveBeenCalledWith(
      '/master-data/products/ITEM-001/edit?section=barcodes',
    );
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: '维护采购价格',
      }).disabled,
    ).toBe(true);
  });
});
