import type { ProductSummary } from '@/services/myapp/master-data';
import {
  buildProductExportCsvRows,
  fetchProductExportRows,
  ProductExportChangedError,
  ProductExportLimitError,
} from '../product-export';

function makeProduct(index: number): ProductSummary {
  const itemCode = `ITEM-${String(index).padStart(3, '0')}`;
  return {
    allUomDisplays: { Box: '箱', Nos: '件' },
    allUoms: ['Nos', 'Box'],
    barcode: `${690000000000 + index}`,
    barcodes: [
      {
        barcode: `${690000000000 + index}`,
        idx: 1,
        isPrimary: true,
        name: `BAR-${index}`,
        uom: 'Nos',
      },
      {
        barcode: `${16900000000000 + index}`,
        idx: 2,
        isPrimary: false,
        name: `BOX-${index}`,
        uom: 'Box',
      },
    ],
    brand: '示例品牌',
    canWrite: true,
    description: '商品描述',
    disabled: false,
    globalWarehouseStockDetails: [],
    imageUrl: '',
    itemCode,
    itemGroup: '饮料',
    itemName: `商品 ${index}`,
    modified: '2026-09-03 12:00:00',
    price: 12,
    priceSummary: {
      buyingPrices: [
        {
          currency: 'CNY',
          priceList: 'Standard Buying',
          rate: 8,
          uom: 'Box',
        },
      ],
      sellingPrices: [
        {
          currency: 'CNY',
          priceList: 'Retail',
          rate: 12,
          uom: 'Nos',
        },
      ],
      standardBuyingRate: 8,
      standardSellingRate: 12,
      valuationRate: 7,
    },
    retailDefaultUom: 'Nos',
    retailDefaultUomDisplay: '件',
    salesProfiles: [],
    specification: '500ml',
    stockQty: index,
    stockUom: 'Nos',
    stockUomDisplay: '件',
    totalQty: index + 10,
    uom: 'Nos',
    uomConversions: [
      { conversionFactor: 1, uom: 'Nos' },
      { conversionFactor: 24, uom: 'Box' },
    ],
    warehouse: '',
    warehouseStockDetails: [],
    warehouseStockQty: null,
    wholesaleDefaultUom: 'Box',
    wholesaleDefaultUomDisplay: '箱',
  };
}

describe('product export governance', () => {
  it('loads every backend page with a stable item-code order', async () => {
    const products = Array.from({ length: 250 }, (_, index) =>
      makeProduct(index + 1),
    );
    const listProducts = jest.fn(async (options) => {
      const start = Number(options.start ?? 0);
      const limit = Number(options.limit ?? 100);
      return {
        items: products.slice(start, start + limit),
        total: products.length,
      };
    });
    const progress = jest.fn();

    const result = await fetchProductExportRows(
      { brand: '示例品牌', searchKey: '商品' },
      { listProducts, onProgress: progress },
    );

    expect(result).toHaveLength(250);
    expect(result[0].itemCode).toBe('ITEM-001');
    expect(result[249].itemCode).toBe('ITEM-250');
    expect(listProducts).toHaveBeenCalledTimes(3);
    expect(listProducts).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        brand: '示例品牌',
        limit: 100,
        searchKey: '商品',
        sortBy: 'name',
        sortOrder: 'asc',
        start: 0,
      }),
    );
    expect(progress).toHaveBeenLastCalledWith(250, 250);
  });

  it('refuses to create a silently truncated browser export', async () => {
    const listProducts = jest.fn().mockResolvedValue({
      items: Array.from({ length: 100 }, (_, index) => makeProduct(index + 1)),
      total: 5001,
    });

    await expect(
      fetchProductExportRows({}, { listProducts, maxRows: 5000 }),
    ).rejects.toEqual(expect.any(ProductExportLimitError));
    expect(listProducts).toHaveBeenCalledTimes(1);
  });

  it('fails closed when totals or rows change during pagination', async () => {
    const listProducts = jest
      .fn()
      .mockResolvedValueOnce({
        items: Array.from({ length: 100 }, (_, index) =>
          makeProduct(index + 1),
        ),
        total: 150,
      })
      .mockResolvedValueOnce({
        items: Array.from({ length: 49 }, (_, index) =>
          makeProduct(index + 101),
        ),
        total: 149,
      });

    await expect(fetchProductExportRows({}, { listProducts })).rejects.toEqual(
      expect.any(ProductExportChangedError),
    );
  });

  it('exports barcode, unit, price and filter semantics explicitly', () => {
    const rows = buildProductExportCsvRows([makeProduct(1)], {
      company: 'rgc (Demo)',
      disabled: 'enabled',
      stockScope: 'in_stock',
      warehouse: 'Stores - RD',
    });
    const header = rows[0];
    const data = rows[1];

    expect(data[header.indexOf('主条码单位')]).toBe('件 (Nos)');
    expect(data[header.indexOf('全部条码（含单位）')]).toContain(
      '16900000000001 [箱 (Box)]',
    );
    expect(data[header.indexOf('单位换算')]).toContain('箱 (Box)=24');
    expect(data[header.indexOf('采购价格摘要')]).toContain(
      'Standard Buying | CNY | 箱 (Box) | 8',
    );
    expect(data[header.indexOf('导出筛选')]).toBe(
      '公司=rgc (Demo)；仓库=Stores - RD；状态=启用；库存=仅有库存',
    );
  });
});
