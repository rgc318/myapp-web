import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import React from 'react';
import {
  getProductDetail,
  listProductPrices,
} from '@/services/myapp/master-data';
import { ProductDetailDrawer } from './ProductDetailDrawer';

jest.mock('@/services/myapp/master-data', () => ({
  getProductDetail: jest.fn(),
  listProductPrices: jest.fn(),
}));

const mockedGetProduct = jest.mocked(getProductDetail);
const mockedListProductPrices = jest.mocked(listProductPrices);

describe('ProductDetailDrawer', () => {
  it('shows product and warehouse stock without forcing navigation', async () => {
    mockedListProductPrices.mockResolvedValue({
      canCreate: true,
      canWrite: true,
      itemCode: 'ITEM-001',
      itemModified: null,
      priceLists: [],
      prices: [
        {
          currency: 'CNY',
          modified: '2026-09-02 10:00:00',
          name: 'PRICE-1',
          priceList: 'Wholesale',
          priceListType: 'selling',
          rate: 1200,
          uom: 'Box',
          validFrom: null,
          validUpto: null,
        },
      ],
    });
    mockedGetProduct.mockResolvedValue({
      allUomDisplays: {},
      allUoms: ['Unit'],
      barcode: '',
      barcodes: [],
      brand: 'Brand A',
      canWrite: true,
      description: '测试商品',
      disabled: false,
      imageUrl: '',
      itemCode: 'ITEM-001',
      itemGroup: 'Products',
      itemName: '煌星',
      modified: null,
      price: 100,
      priceSummary: null,
      salesProfiles: [],
      specification: '',
      stockQty: 5,
      stockUom: 'Unit',
      stockUomDisplay: '个',
      totalQty: 5,
      uom: 'Unit',
      uomConversions: [],
      uomDisplay: '个',
      warehouse: 'Stores - DC',
      warehouseStockQty: 5,
      globalWarehouseStockDetails: [],
      warehouseStockDetails: [
        { company: 'Demo Company', qty: 5, warehouse: 'Stores - DC' },
      ],
    });

    render(
      React.createElement(
        App,
        null,
        React.createElement(ProductDetailDrawer, {
          citation: {
            data: {
              company: 'Demo Company',
              price: 88,
              qty: 4,
              queried_at: '2026-07-24 09:20:00',
              uom_display: '个',
            },
            href: '/master-data/products/ITEM-001',
            id: 'ITEM-001',
            label: '煌星',
            type: 'product',
          },
          onClose: jest.fn(),
        }),
      ),
    );

    expect(await screen.findByText('Stores - DC')).toBeTruthy();
    expect(screen.getByText('回答时数据')).toBeTruthy();
    expect(screen.getByText('当前数据')).toBeTruthy();
    expect(screen.getByText('2026-07-24 09:20:00')).toBeTruthy();
    expect(screen.getByText('4 个')).toBeTruthy();
    expect(screen.getByText('测试商品')).toBeTruthy();
    expect(screen.getByText('商品图片')).toBeTruthy();
    expect(screen.getByText('完整价目表')).toBeTruthy();
    expect(screen.getByText('Wholesale')).toBeTruthy();
    expect(screen.getByRole('img', { name: '商品图片：无图片' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /上传图片/ })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: /在商品模块打开/ }).getAttribute('href'),
    ).toBe('/master-data/products/ITEM-001');
    expect(
      screen.getByRole('link', { name: /维护商品/ }).getAttribute('href'),
    ).toBe('/master-data/products/ITEM-001/edit?section=basic');
    const refreshButton = screen.getByRole<HTMLButtonElement>('button', {
      name: /刷新当前数据/,
    });
    await waitFor(() => expect(refreshButton.disabled).toBe(false));
    fireEvent.click(refreshButton);
    await waitFor(() => expect(mockedGetProduct).toHaveBeenCalledTimes(2));
    expect(mockedListProductPrices).toHaveBeenCalledTimes(2);
  });
});
