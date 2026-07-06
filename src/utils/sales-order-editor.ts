import type { ProductSummary } from '@/services/myapp/master-data';
import { resolveDisplayUomFromMap } from '@/utils/display-uom';
import {
  convertQtyToStockQty,
  formatConvertedQty,
  getConversionFactorToStockUnit,
} from '@/utils/uom-conversion';

export { convertQtyToStockQty, getConversionFactorToStockUnit };

export type SalesMode = 'wholesale' | 'retail';

export type SalesOrderEditorLine = {
  allUomDisplays: Record<string, string>;
  allUoms: string[];
  amount: number;
  imageUrl?: string;
  itemCode: string;
  itemName: string;
  key: string;
  modeDefaults: Record<SalesMode, { price: number | null; uom: string | null }>;
  price: number | null;
  qty: number;
  salesMode: SalesMode;
  specification: string;
  stockQty: number | null;
  stockUom: string | null;
  stockUomDisplay?: string | null;
  uom: string | null;
  uomConversions: ProductSummary['uomConversions'];
  uomDisplay?: string | null;
  warehouse: string;
};

export function normalizeSalesMode(value: unknown): SalesMode {
  return value === 'retail' ? 'retail' : 'wholesale';
}

export function getSalesModeLabel(mode: SalesMode) {
  return mode === 'retail' ? '零售' : '批发';
}

function firstFiniteNumber(values: (number | null | undefined)[]) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function modePriceFromSummary(
  summary: ProductSummary['priceSummary'],
  mode: SalesMode,
) {
  if (!summary) {
    return null;
  }
  const priceList = mode === 'retail' ? 'Retail' : 'Wholesale';
  const explicitEntry = summary.sellingPrices?.find(
    (entry) => entry.priceList.toLowerCase() === priceList.toLowerCase(),
  );
  if (explicitEntry) {
    return explicitEntry.rate;
  }

  const legacyModeRate =
    mode === 'retail' ? summary.retailRate : summary.wholesaleRate;
  return legacyModeRate === 0 ? null : legacyModeRate;
}

function uniqueText(values: (string | null | undefined)[]) {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean),
    ),
  );
}

export function resolveUomDisplay(
  uom?: string | null,
  displays?: Record<string, string> | null,
  directDisplay?: string | null,
) {
  return resolveDisplayUomFromMap(uom, displays, directDisplay);
}

export function getProductAvailableUoms(product: ProductSummary) {
  return uniqueText([
    ...(product.allUoms ?? []),
    product.wholesaleDefaultUom,
    product.retailDefaultUom,
    product.uom,
    product.stockUom,
  ]);
}

export function getProductModeDefaultUom(
  product: ProductSummary,
  mode: SalesMode,
) {
  const profileUom =
    product.salesProfiles.find((profile) => profile.modeCode === mode)
      ?.defaultUom ?? null;
  const directUom =
    mode === 'retail' ? product.retailDefaultUom : product.wholesaleDefaultUom;

  return (
    uniqueText([
      profileUom,
      directUom,
      product.uom,
      product.stockUom,
      ...product.allUoms,
    ])[0] ?? ''
  );
}

export function getProductModeDefaultPrice(
  product: ProductSummary,
  mode: SalesMode,
) {
  const summary = product.priceSummary;
  return firstFiniteNumber([
    modePriceFromSummary(summary, mode),
    product.price,
    summary?.currentRate,
    summary?.standardSellingRate,
  ]);
}

export function formatQty(value: number | null | undefined) {
  return formatConvertedQty(value) || '-';
}

export function buildSalesOrderLineFromProduct(options: {
  defaultMode: SalesMode;
  defaultWarehouse?: string;
  product: ProductSummary;
}) {
  const { defaultMode, defaultWarehouse, product } = options;
  const uom = getProductModeDefaultUom(product, defaultMode);
  const price = getProductModeDefaultPrice(product, defaultMode);
  const allUoms = getProductAvailableUoms(product);
  const stockUom = product.stockUom || product.uom || null;
  const warehouse = product.warehouse || defaultWarehouse || '';

  return {
    allUomDisplays: product.allUomDisplays,
    allUoms,
    amount: price ?? 0,
    imageUrl: product.imageUrl,
    itemCode: product.itemCode,
    itemName: product.itemName || product.itemCode,
    key: `${product.itemCode}:${warehouse || 'default'}`,
    modeDefaults: {
      retail: {
        price: getProductModeDefaultPrice(product, 'retail'),
        uom: getProductModeDefaultUom(product, 'retail') || null,
      },
      wholesale: {
        price: getProductModeDefaultPrice(product, 'wholesale'),
        uom: getProductModeDefaultUom(product, 'wholesale') || null,
      },
    },
    price,
    qty: 1,
    salesMode: defaultMode,
    specification: product.specification,
    stockQty:
      product.warehouseStockQty ?? product.stockQty ?? product.totalQty ?? null,
    stockUom,
    stockUomDisplay: product.stockUomDisplay,
    uom: uom || stockUom,
    uomConversions: product.uomConversions,
    uomDisplay: product.uomDisplay,
    warehouse,
  } satisfies SalesOrderEditorLine;
}

export function recalculateSalesOrderLine(
  line: SalesOrderEditorLine,
): SalesOrderEditorLine {
  const qty = Number.isFinite(line.qty) ? line.qty : 0;
  const price =
    typeof line.price === 'number' && Number.isFinite(line.price)
      ? line.price
      : null;

  return {
    ...line,
    amount: qty * (price ?? 0),
  };
}

export function getSalesOrderLineMergeKey(line: SalesOrderEditorLine) {
  return [
    line.itemCode,
    line.warehouse || '',
    line.salesMode,
    line.uom || '',
    line.price ?? '',
  ].join('::');
}

export function getOrderLinesTotal(lines: SalesOrderEditorLine[]) {
  return lines.reduce(
    (sum, line) => sum + recalculateSalesOrderLine(line).amount,
    0,
  );
}
