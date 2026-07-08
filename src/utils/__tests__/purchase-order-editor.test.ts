import type { PurchaseOrderEditorLine } from '../purchase-order-editor';
import {
  buildPurchaseOrderLineFromProduct,
  getPurchaseOrderLineMergeKey,
} from '../purchase-order-editor';

const line: PurchaseOrderEditorLine = {
  allUomDisplays: { Box: '箱', Nos: '个' },
  allUoms: ['Nos', 'Box'],
  amount: 100,
  itemCode: 'SKU-1',
  itemName: '测试商品',
  key: 'SKU-1:Stores - RD',
  modeDefaults: {
    retail: { uom: 'Nos' },
    wholesale: { uom: 'Box' },
  },
  price: 100,
  qty: 1,
  standardBuyingRate: 100,
  specification: '',
  stockQty: 120,
  stockUom: 'Nos',
  stockUomDisplay: '个',
  totalQty: 120,
  uom: 'Box',
  uomConversions: [
    { conversionFactor: 1, uom: 'Nos' },
    { conversionFactor: 12, uom: 'Box' },
  ],
  uomDisplay: '箱',
  warehouse: 'Stores - RD',
  warehouseStockDetails: [],
};

describe('purchase order editor utils', () => {
  it('merges only identical purchase business lines', () => {
    expect(getPurchaseOrderLineMergeKey({ ...line, qty: 1 })).toBe(
      getPurchaseOrderLineMergeKey({ ...line, qty: 5 }),
    );
    expect(getPurchaseOrderLineMergeKey({ ...line, uom: 'Nos' })).not.toBe(
      getPurchaseOrderLineMergeKey(line),
    );
    expect(
      getPurchaseOrderLineMergeKey({ ...line, warehouse: 'Other - RD' }),
    ).not.toBe(getPurchaseOrderLineMergeKey(line));
    expect(getPurchaseOrderLineMergeKey({ ...line, price: 88 })).not.toBe(
      getPurchaseOrderLineMergeKey(line),
    );
  });

  it('uses the selected sales profile unit as purchase line default', () => {
    const product = {
      allUomDisplays: { Box: '箱', Nos: '个' },
      allUoms: ['Nos', 'Box'],
      itemCode: 'SKU-1',
      itemName: '测试商品',
      priceSummary: { standardBuyingRate: 80 },
      retailDefaultUom: 'Nos',
      salesProfiles: [],
      specification: '',
      stockUom: 'Nos',
      uom: 'Nos',
      uomConversions: [
        { conversionFactor: 1, uom: 'Nos' },
        { conversionFactor: 12, uom: 'Box' },
      ],
      warehouseStockDetails: [],
      wholesaleDefaultUom: 'Box',
    } as any;

    expect(
      buildPurchaseOrderLineFromProduct({
        defaultMode: 'wholesale',
        product,
      }).uom,
    ).toBe('Box');
    expect(
      buildPurchaseOrderLineFromProduct({
        defaultMode: 'retail',
        product,
      }).uom,
    ).toBe('Nos');
  });
});
