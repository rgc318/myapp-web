import type { ProductSummary } from '@/services/myapp/master-data';

export type SalesMode = 'wholesale' | 'retail';

export type SalesOrderEditorLine = {
  allUomDisplays: Record<string, string>;
  allUoms: string[];
  amount: number;
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
  const normalizedUom = typeof uom === 'string' ? uom.trim() : '';
  if (!normalizedUom) {
    return '';
  }
  return directDisplay || displays?.[normalizedUom] || normalizedUom;
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
    mode === 'retail' ? summary?.retailRate : summary?.wholesaleRate,
    summary?.currentRate,
    product.price,
    summary?.standardSellingRate,
  ]);
}

export function getConversionFactorToStockUnit(options: {
  stockUom?: string | null;
  uom?: string | null;
  uomConversions?: ProductSummary['uomConversions'] | null;
}) {
  const stockUom = options.stockUom?.trim();
  const targetUom = options.uom?.trim() || stockUom;

  if (!stockUom || !targetUom) {
    return null;
  }
  if (stockUom === targetUom) {
    return 1;
  }

  const matched = options.uomConversions?.find(
    (entry) => entry.uom.trim() === targetUom,
  );
  return matched?.conversionFactor ?? null;
}

export function convertQtyToStockQty(options: {
  qty: number;
  stockUom?: string | null;
  uom?: string | null;
  uomConversions?: ProductSummary['uomConversions'] | null;
}) {
  if (!Number.isFinite(options.qty)) {
    return null;
  }

  const factor = getConversionFactorToStockUnit(options);
  return factor === null ? null : options.qty * factor;
}

export function formatQty(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.?0+$/, '');
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

export function getOrderLinesTotal(lines: SalesOrderEditorLine[]) {
  return lines.reduce(
    (sum, line) => sum + recalculateSalesOrderLine(line).amount,
    0,
  );
}
