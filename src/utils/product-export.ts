import type {
  ProductListOptions,
  ProductPriceEntry,
  ProductSummary,
} from '@/services/myapp/master-data';
import { resolveDisplayUom } from './myapp-display';

export const PRODUCT_EXPORT_PAGE_SIZE = 100;
export const PRODUCT_EXPORT_MAX_ROWS = 5000;

export class ProductExportLimitError extends Error {
  maxRows: number;
  total: number;

  constructor(total: number, maxRows: number) {
    super(`当前筛选结果有 ${total} 条，超过浏览器导出上限 ${maxRows} 条`);
    this.name = 'ProductExportLimitError';
    this.total = total;
    this.maxRows = maxRows;
  }
}

export class ProductExportChangedError extends Error {
  constructor() {
    super('导出期间商品数据发生变化，未生成可能缺行或重复的文件，请重新导出');
    this.name = 'ProductExportChangedError';
  }
}

type ProductExportDependencies = {
  listProducts: (
    options: ProductListOptions,
  ) => Promise<{ items: ProductSummary[]; total: number }>;
  maxRows?: number;
  onProgress?: (loaded: number, total: number) => void;
  pageSize?: number;
};

export async function fetchProductExportRows(
  filters: ProductListOptions,
  dependencies: ProductExportDependencies,
) {
  const pageSize = Math.min(
    PRODUCT_EXPORT_PAGE_SIZE,
    Math.max(1, dependencies.pageSize ?? PRODUCT_EXPORT_PAGE_SIZE),
  );
  const maxRows = Math.max(1, dependencies.maxRows ?? PRODUCT_EXPORT_MAX_ROWS);
  const requestOptions: ProductListOptions = {
    ...filters,
    limit: pageSize,
    sortBy: 'name',
    sortOrder: 'asc',
    start: 0,
  };
  const firstPage = await dependencies.listProducts(requestOptions);
  const total = firstPage.total;
  if (total > maxRows) {
    throw new ProductExportLimitError(total, maxRows);
  }
  if (!total) {
    dependencies.onProgress?.(0, 0);
    return [];
  }

  const pageCount = Math.ceil(total / pageSize);
  const pages: ProductSummary[][] = Array.from({ length: pageCount });
  pages[0] = firstPage.items;
  dependencies.onProgress?.(Math.min(firstPage.items.length, total), total);

  let nextPage = 1;
  let loaded = firstPage.items.length;
  let sourceChanged = false;
  const worker = async () => {
    while (nextPage < pageCount) {
      const pageIndex = nextPage;
      nextPage += 1;
      const page = await dependencies.listProducts({
        ...requestOptions,
        start: pageIndex * pageSize,
      });
      if (page.total !== total) {
        sourceChanged = true;
      }
      pages[pageIndex] = page.items;
      loaded += page.items.length;
      dependencies.onProgress?.(Math.min(loaded, total), total);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(4, Math.max(0, pageCount - 1)) }, () =>
      worker(),
    ),
  );

  const items = pages.flat();
  const uniqueItems = Array.from(
    new Map(items.map((item) => [item.itemCode, item])).values(),
  );
  if (sourceChanged || items.length !== total || uniqueItems.length !== total) {
    throw new ProductExportChangedError();
  }
  dependencies.onProgress?.(total, total);
  return uniqueItems;
}

export type ProductExportContext = {
  brand?: string;
  company?: string;
  disabled?: 'enabled' | 'disabled' | 'all';
  itemGroup?: string;
  searchKey?: string;
  stockScope?: 'all' | 'in_stock';
  warehouse?: string;
};

function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? '' : String(value);
}

function formatUom(uom: string | null | undefined, product: ProductSummary) {
  if (!uom) return '';
  const display = resolveDisplayUom(uom, product.allUomDisplays[uom]);
  return display === uom ? uom : `${display} (${uom})`;
}

function formatPrices(
  prices: ProductPriceEntry[] | undefined,
  product: ProductSummary,
) {
  return (prices ?? [])
    .map((price) =>
      [
        price.priceList,
        price.currency,
        formatUom(price.uom, product),
        formatNumber(price.rate),
      ]
        .filter(Boolean)
        .join(' | '),
    )
    .join('；');
}

function formatExportFilter(context: ProductExportContext) {
  return [
    context.searchKey ? `关键词=${context.searchKey}` : '',
    context.company ? `公司=${context.company}` : '',
    context.warehouse ? `仓库=${context.warehouse}` : '',
    context.itemGroup ? `分类=${context.itemGroup}` : '',
    context.brand ? `品牌=${context.brand}` : '',
    `状态=${
      context.disabled === 'disabled'
        ? '停用'
        : context.disabled === 'all'
          ? '全部'
          : '启用'
    }`,
    `库存=${context.stockScope === 'in_stock' ? '仅有库存' : '全部'}`,
  ]
    .filter(Boolean)
    .join('；');
}

export function buildProductExportCsvRows(
  products: ProductSummary[],
  context: ProductExportContext,
): Array<Array<unknown>> {
  const filterSummary = formatExportFilter(context);
  return [
    [
      '商品编码',
      '商品名称',
      '规格',
      '分类',
      '品牌',
      '主条码',
      '主条码单位',
      '全部条码（含单位）',
      '当前查询口径库存',
      '总库存',
      '库存单位编码',
      '库存单位',
      '单位换算',
      '批发默认单位编码',
      '批发默认单位',
      '零售默认单位编码',
      '零售默认单位',
      '标准售价',
      '批发价',
      '零售价',
      '标准采购价',
      '库存估值',
      '销售价格摘要',
      '采购价格摘要',
      '状态',
      '描述',
      '最后修改时间',
      '导出筛选',
    ],
    ...products.map((product) => {
      const primaryBarcode =
        product.barcodes.find((barcode) => barcode.isPrimary) ??
        product.barcodes[0];
      return [
        product.itemCode,
        product.itemName,
        product.specification,
        product.itemGroup,
        product.brand,
        primaryBarcode?.barcode || product.barcode,
        formatUom(primaryBarcode?.uom, product),
        product.barcodes
          .map(
            (barcode) =>
              `${barcode.barcode}${barcode.uom ? ` [${formatUom(barcode.uom, product)}]` : ''}`,
          )
          .join('；'),
        formatNumber(product.stockQty),
        formatNumber(product.totalQty),
        product.stockUom,
        resolveDisplayUom(product.stockUom, product.stockUomDisplay),
        product.uomConversions
          .map(
            (conversion) =>
              `${formatUom(conversion.uom, product)}=${formatNumber(conversion.conversionFactor)}`,
          )
          .join('；'),
        product.wholesaleDefaultUom ?? '',
        formatUom(product.wholesaleDefaultUom, product),
        product.retailDefaultUom ?? '',
        formatUom(product.retailDefaultUom, product),
        formatNumber(product.priceSummary?.standardSellingRate),
        formatNumber(product.priceSummary?.wholesaleRate),
        formatNumber(product.priceSummary?.retailRate),
        formatNumber(product.priceSummary?.standardBuyingRate),
        formatNumber(product.priceSummary?.valuationRate),
        formatPrices(product.priceSummary?.sellingPrices, product),
        formatPrices(product.priceSummary?.buyingPrices, product),
        product.disabled ? '停用' : '启用',
        product.description,
        product.modified ?? '',
        filterSummary,
      ];
    }),
  ];
}
