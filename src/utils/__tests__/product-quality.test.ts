import type {
  ProductPriceRecord,
  ProductSummary,
} from '@/services/myapp/master-data';
import { assessProductQuality } from '../product-quality';

function makeProduct(overrides: Partial<ProductSummary> = {}): ProductSummary {
  return {
    allUomDisplays: { Box: '箱', Nos: '件' },
    allUoms: ['Nos', 'Box'],
    barcode: '',
    barcodes: [],
    brand: '',
    canWrite: true,
    description: '',
    disabled: false,
    globalWarehouseStockDetails: [],
    imageUrl: '',
    isPurchaseItem: true,
    isSalesItem: true,
    itemCode: 'ITEM-001',
    itemGroup: '商品',
    itemName: '测试商品',
    modified: '2026-09-03 12:00:00',
    price: null,
    priceSummary: null,
    retailDefaultUom: 'Nos',
    salesProfiles: [],
    specification: '',
    stockQty: 0,
    stockUom: 'Nos',
    stockUomDisplay: '件',
    totalQty: 0,
    uom: 'Nos',
    uomConversions: [
      { conversionFactor: 1, uom: 'Nos' },
      { conversionFactor: 24, uom: 'Box' },
    ],
    warehouse: '',
    warehouseStockDetails: [],
    warehouseStockQty: null,
    wholesaleDefaultUom: 'Box',
    ...overrides,
  };
}

function makePrice(
  overrides: Partial<ProductPriceRecord> = {},
): ProductPriceRecord {
  return {
    currency: 'CNY',
    modified: '2026-09-03 12:00:00',
    name: 'PRICE-001',
    priceList: 'Standard Selling',
    priceListType: 'selling',
    rate: 12,
    uom: 'Nos',
    validFrom: null,
    validUpto: null,
    ...overrides,
  };
}

describe('product quality assessment', () => {
  it('treats barcode, brand, image and reference prices as optional suggestions', () => {
    const assessment = assessProductQuality(makeProduct(), {
      prices: [],
      today: '2026-09-03',
    });

    expect(assessment.status).toBe('healthy');
    expect(assessment.errorCount).toBe(0);
    expect(assessment.warningCount).toBe(0);
    expect(assessment.issues.map((issue) => issue.title)).toEqual(
      expect.arrayContaining([
        '尚未维护条码（可选）',
        '尚未维护销售价格（可选）',
        '尚未维护采购参考价（可选）',
        '尚未维护商品图片（可选）',
        '尚未维护品牌（可选）',
      ]),
    );
  });

  it('detects invalid unit relationships across defaults, barcodes and prices', () => {
    const product = makeProduct({
      barcodes: [
        {
          barcode: 'BOX-CODE',
          idx: 1,
          isPrimary: true,
          name: 'BAR-1',
          uom: 'Carton',
        },
      ],
      retailDefaultUom: 'Bottle',
      uomConversions: [
        { conversionFactor: 2, uom: 'Nos' },
        { conversionFactor: -1, uom: 'Box' },
        { conversionFactor: 24, uom: 'Box' },
      ],
    });
    const assessment = assessProductQuality(product, {
      prices: [makePrice({ uom: 'Carton' })],
      today: '2026-09-03',
    });

    expect(assessment.status).toBe('critical');
    expect(assessment.issues.map((issue) => issue.key)).toEqual(
      expect.arrayContaining([
        'stock-uom-conversion',
        'duplicate-uoms',
        'invalid-uom-factor',
        'retail-default-uom',
        'barcode-invalid-uom',
        'selling-price-invalid-uom',
      ]),
    );
  });

  it('separates ambiguous legacy units from hard invalid-unit errors', () => {
    const assessment = assessProductQuality(
      makeProduct({
        barcodes: [
          {
            barcode: 'LEGACY-CODE',
            idx: 1,
            isPrimary: true,
            name: 'BAR-1',
            uom: null,
          },
        ],
      }),
      {
        prices: [makePrice({ uom: null })],
        today: '2026-09-03',
      },
    );

    expect(assessment.status).toBe('attention');
    expect(assessment.errorCount).toBe(0);
    expect(assessment.issues.map((issue) => issue.key)).toEqual(
      expect.arrayContaining([
        'barcode-missing-uom',
        'selling-price-missing-uom',
      ]),
    );
  });

  it('distinguishes disabled stock warnings from negative-stock errors', () => {
    const disabledStock = assessProductQuality(
      makeProduct({ disabled: true, totalQty: 5 }),
    );
    const negativeStock = assessProductQuality(
      makeProduct({ disabled: true, totalQty: -1 }),
    );

    expect(disabledStock.status).toBe('attention');
    expect(
      disabledStock.issues.some((issue) => issue.key === 'disabled-with-stock'),
    ).toBe(true);
    expect(negativeStock.status).toBe('critical');
    expect(
      negativeStock.issues.some((issue) => issue.key === 'negative-stock'),
    ).toBe(true);
  });

  it('ignores expired prices when evaluating current sales readiness', () => {
    const assessment = assessProductQuality(makeProduct(), {
      prices: [makePrice({ validUpto: '2026-09-02' })],
      today: '2026-09-03',
    });

    expect(
      assessment.issues.some((issue) => issue.key === 'selling-price-optional'),
    ).toBe(true);
  });
});
