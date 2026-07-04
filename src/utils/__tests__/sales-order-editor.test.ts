import type { ProductSummary } from '@/services/myapp/master-data';
import {
  buildSalesOrderLineFromProduct,
  convertQtyToStockQty,
  getOrderLinesTotal,
  getSalesOrderLineMergeKey,
  resolveUomDisplay,
} from '../sales-order-editor';

const product: ProductSummary = {
  allUomDisplays: { Box: '箱', Nos: '个' },
  allUoms: ['Nos', 'Box'],
  barcode: '',
  barcodes: [],
  brand: '',
  description: '',
  disabled: false,
  imageUrl: '',
  itemCode: 'SKU-1',
  itemGroup: '',
  itemName: '测试商品',
  modified: null,
  price: 9,
  priceSummary: {
    retailRate: 12,
    standardSellingRate: 10,
    wholesaleRate: 100,
  },
  retailDefaultUom: 'Nos',
  retailDefaultUomDisplay: '个',
  salesProfiles: [],
  specification: '',
  stockQty: 120,
  stockUom: 'Nos',
  stockUomDisplay: '个',
  totalQty: 120,
  uom: 'Nos',
  uomConversions: [
    { conversionFactor: 1, uom: 'Nos' },
    { conversionFactor: 12, uom: 'Box' },
  ],
  uomDisplay: '个',
  warehouse: 'Stores - RD',
  warehouseStockQty: null,
  warehouseStockUom: null,
  warehouseStockUomDisplay: null,
  wholesaleDefaultUom: 'Box',
  wholesaleDefaultUomDisplay: '箱',
  globalWarehouseStockDetails: [],
  warehouseStockDetails: [],
};

describe('sales order editor utils', () => {
  it('builds line from product mode defaults', () => {
    const line = buildSalesOrderLineFromProduct({
      defaultMode: 'wholesale',
      product,
    });

    expect(line).toMatchObject({
      itemCode: 'SKU-1',
      price: 100,
      qty: 1,
      salesMode: 'wholesale',
      uom: 'Box',
    });
    expect(line.modeDefaults.retail).toEqual({ price: 12, uom: 'Nos' });
    expect(getOrderLinesTotal([line])).toBe(100);
  });

  it('converts entered qty to stock qty', () => {
    expect(
      convertQtyToStockQty({
        qty: 2,
        stockUom: 'Nos',
        uom: 'Box',
        uomConversions: product.uomConversions,
      }),
    ).toBe(24);
    expect(resolveUomDisplay('Box', product.allUomDisplays)).toBe('箱');
  });

  it('merges only identical sales business lines', () => {
    const line = buildSalesOrderLineFromProduct({
      defaultMode: 'wholesale',
      defaultWarehouse: 'Stores - RD',
      product,
    });

    expect(getSalesOrderLineMergeKey({ ...line, qty: 1 })).toBe(
      getSalesOrderLineMergeKey({ ...line, qty: 5 }),
    );
    expect(getSalesOrderLineMergeKey({ ...line, uom: 'Nos' })).not.toBe(
      getSalesOrderLineMergeKey(line),
    );
    expect(
      getSalesOrderLineMergeKey({ ...line, warehouse: 'Other - RD' }),
    ).not.toBe(getSalesOrderLineMergeKey(line));
    expect(
      getSalesOrderLineMergeKey({ ...line, salesMode: 'retail' }),
    ).not.toBe(getSalesOrderLineMergeKey(line));
  });
});
