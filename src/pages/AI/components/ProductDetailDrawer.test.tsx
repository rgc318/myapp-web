import { render, screen } from '@testing-library/react';
import { App } from 'antd';
import React from 'react';
import { getProductDetail } from '@/services/myapp/master-data';
import { ProductDetailDrawer } from './ProductDetailDrawer';

jest.mock('@/services/myapp/master-data', () => ({
  getProductDetail: jest.fn(),
}));

const mockedGetProduct = jest.mocked(getProductDetail);

describe('ProductDetailDrawer', () => {
  it('shows product and warehouse stock without forcing navigation', async () => {
    mockedGetProduct.mockResolvedValue({
      allUomDisplays: {},
      allUoms: ['Unit'],
      barcode: '',
      barcodes: [],
      brand: 'Brand A',
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
            data: { company: 'Demo Company' },
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
    expect(screen.getByText('测试商品')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: /在商品模块打开/ }).getAttribute('href'),
    ).toBe('/master-data/products/ITEM-001');
  });
});
