import type { ProductSummary } from '@/services/myapp/master-data';
import {
  getProductAvailableUoms,
  getProductModeDefaultUom,
  type SalesMode,
} from '@/utils/sales-order-editor';

export type PurchaseOrderEditorLine = {
  allUomDisplays: Record<string, string>;
  allUoms: string[];
  amount: number;
  imageUrl?: string;
  itemCode: string;
  itemName: string;
  key: string;
  modeDefaults: Record<SalesMode, { uom: string | null }>;
  price: number | null;
  qty: number;
  standardBuyingRate?: number | null;
  specification: string;
  stockQty: number | null;
  stockUom: string | null;
  stockUomDisplay?: string | null;
  totalQty?: number | null;
  uom: string | null;
  uomConversions: ProductSummary['uomConversions'];
  uomDisplay?: string | null;
  warehouse: string;
  warehouseStockDetails?: ProductSummary['warehouseStockDetails'];
};

function firstFiniteNumber(values: (number | null | undefined)[]) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

export function getProductPurchaseDefaultPrice(product: ProductSummary) {
  const summary = product.priceSummary;
  return firstFiniteNumber([
    summary?.standardBuyingRate,
    summary?.valuationRate,
    summary?.currentRate,
    product.price,
  ]);
}

export function buildPurchaseOrderLineFromProduct(options: {
  defaultMode?: SalesMode;
  defaultWarehouse?: string;
  product: ProductSummary;
}) {
  const { defaultMode = 'wholesale', defaultWarehouse, product } = options;
  const allUoms = getProductAvailableUoms(product);
  const stockUom = product.stockUom || product.uom || null;
  const price = getProductPurchaseDefaultPrice(product);
  const modeDefaults = {
    retail: { uom: getProductModeDefaultUom(product, 'retail') || null },
    wholesale: { uom: getProductModeDefaultUom(product, 'wholesale') || null },
  };
  const uom =
    modeDefaults[defaultMode]?.uom ||
    product.uom ||
    stockUom ||
    allUoms[0] ||
    null;
  const warehouse = product.warehouse || defaultWarehouse || '';

  return {
    allUomDisplays: product.allUomDisplays,
    allUoms,
    amount: price ?? 0,
    imageUrl: product.imageUrl,
    itemCode: product.itemCode,
    itemName: product.itemName || product.itemCode,
    key: `${product.itemCode}:${warehouse || 'default'}`,
    modeDefaults,
    price,
    qty: 1,
    standardBuyingRate: product.priceSummary?.standardBuyingRate ?? null,
    specification: product.specification,
    stockQty:
      product.warehouseStockQty ?? product.stockQty ?? product.totalQty ?? null,
    stockUom,
    stockUomDisplay: product.stockUomDisplay,
    totalQty: product.totalQty,
    uom,
    uomConversions: product.uomConversions,
    uomDisplay: product.uomDisplay,
    warehouse,
    warehouseStockDetails: product.warehouseStockDetails,
  } satisfies PurchaseOrderEditorLine;
}

export function recalculatePurchaseOrderLine(
  line: PurchaseOrderEditorLine,
): PurchaseOrderEditorLine {
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

export function getPurchaseOrderLineMergeKey(line: PurchaseOrderEditorLine) {
  return [
    line.itemCode,
    line.warehouse || '',
    line.uom || '',
    line.price ?? '',
  ].join('::');
}

export function getPurchaseOrderLinesTotal(lines: PurchaseOrderEditorLine[]) {
  return lines.reduce(
    (sum, line) => sum + recalculatePurchaseOrderLine(line).amount,
    0,
  );
}
