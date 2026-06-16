import { callGatewayMethod } from './api-client';
import {
  compactPayload,
  readObject,
  toNumber,
  toOptionalText,
  type PageResult,
} from './api-utils';
import { runGatewayMutation } from './mutation';

export type StockLedgerEntry = {
  actualQty: number;
  company: string;
  incomingRate: number;
  itemCode: string;
  itemName: string;
  name: string;
  postingDate: string | null;
  postingTime: string | null;
  qtyAfterTransaction: number;
  stockValueDifference: number;
  voucherNo: string;
  voucherType: string;
  warehouse: string;
};

export type StockLedgerEntryParams = {
  company?: string;
  dateFrom?: string;
  dateTo?: string;
  itemCode?: string;
  page?: number;
  pageSize?: number;
  voucherNo?: string;
  voucherType?: string;
  warehouse?: string;
};

export type InventoryStockStatus =
  | 'all'
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'negative';

export type InventoryStockSummaryRow = {
  actualQty: number;
  company: string;
  disabled: boolean;
  indentedQty: number;
  itemCode: string;
  itemName: string;
  orderedQty: number;
  projectedQty: number;
  reservedQty: number;
  stockUom: string;
  stockUomDisplay: string | null;
  stockValue: number;
  valuationRate: number;
  warehouse: string;
};

export type InventoryStockSummary = {
  actualQtyTotal: number;
  negativeCount: number;
  outOfStockCount: number;
  projectedQtyTotal: number;
  reservedQtyTotal: number;
  stockValueTotal: number;
};

export type InventoryStockSummaryParams = {
  company?: string;
  lowStockThreshold?: number;
  page?: number;
  pageSize?: number;
  searchKey?: string;
  stockStatus?: InventoryStockStatus;
  warehouse?: string;
};

export type InventoryStockSummaryResult = PageResult<InventoryStockSummaryRow> & {
  summary: InventoryStockSummary;
};

export type InventoryStockAdjustmentPayload = {
  company?: string;
  itemCode: string;
  postingDate?: string;
  targetQty: number;
  uom?: string;
  valuationRate?: number | null;
  warehouse: string;
};

function mapStockLedgerEntry(row: Record<string, any>): StockLedgerEntry {
  return {
    actualQty: toNumber(row.actual_qty),
    company: String(row.company ?? ''),
    incomingRate: toNumber(row.incoming_rate),
    itemCode: String(row.item_code ?? ''),
    itemName: String(row.item_name ?? row.item_code ?? ''),
    name: String(row.name ?? ''),
    postingDate: typeof row.posting_date === 'string' ? row.posting_date : null,
    postingTime: typeof row.posting_time === 'string' ? row.posting_time : null,
    qtyAfterTransaction: toNumber(row.qty_after_transaction),
    stockValueDifference: toNumber(row.stock_value_difference),
    voucherNo: String(row.voucher_no ?? ''),
    voucherType: String(row.voucher_type ?? ''),
    warehouse: String(row.warehouse ?? ''),
  };
}

function emptyStockSummary(): InventoryStockSummary {
  return {
    actualQtyTotal: 0,
    negativeCount: 0,
    outOfStockCount: 0,
    projectedQtyTotal: 0,
    reservedQtyTotal: 0,
    stockValueTotal: 0,
  };
}

function mapInventoryStockSummaryRow(
  row: Record<string, any>,
): InventoryStockSummaryRow {
  return {
    actualQty: toNumber(row.actual_qty),
    company: String(row.company ?? ''),
    disabled: Boolean(row.disabled),
    indentedQty: toNumber(row.indented_qty),
    itemCode: String(row.item_code ?? ''),
    itemName: String(row.item_name ?? row.item_code ?? ''),
    orderedQty: toNumber(row.ordered_qty),
    projectedQty: toNumber(row.projected_qty),
    reservedQty: toNumber(row.reserved_qty),
    stockUom: String(row.stock_uom ?? ''),
    stockUomDisplay:
      typeof row.stock_uom_display === 'string' ? row.stock_uom_display : null,
    stockValue: toNumber(row.stock_value),
    valuationRate: toNumber(row.valuation_rate),
    warehouse: String(row.warehouse ?? ''),
  };
}

function mapInventoryStockSummary(value: unknown): InventoryStockSummary {
  const row = readObject(value);
  return {
    actualQtyTotal: toNumber(row.actual_qty_total),
    negativeCount: toNumber(row.negative_count),
    outOfStockCount: toNumber(row.out_of_stock_count),
    projectedQtyTotal: toNumber(row.projected_qty_total),
    reservedQtyTotal: toNumber(row.reserved_qty_total),
    stockValueTotal: toNumber(row.stock_value_total),
  };
}

export async function listStockLedgerEntries(
  params: StockLedgerEntryParams = {},
): Promise<PageResult<StockLedgerEntry>> {
  const result = await callGatewayMethod<Record<string, any>>(
    'list_stock_ledger_entries_v1',
    compactPayload({
      company: toOptionalText(params.company),
      date_from: toOptionalText(params.dateFrom),
      date_to: toOptionalText(params.dateTo),
      item_code: toOptionalText(params.itemCode),
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20,
      voucher_no: toOptionalText(params.voucherNo),
      voucher_type: toOptionalText(params.voucherType),
      warehouse: toOptionalText(params.warehouse),
    }),
  );
  const data = result.data ?? {};
  const pagination = readObject(data.pagination);
  const rows = Array.isArray(data.rows) ? data.rows : [];

  return {
    hasMore: Boolean(pagination.has_more),
    items: rows.map((row) => mapStockLedgerEntry(readObject(row))),
    total: toNumber(pagination.total_count, rows.length),
  };
}

export async function listInventoryStockSummary(
  params: InventoryStockSummaryParams = {},
): Promise<InventoryStockSummaryResult> {
  const result = await callGatewayMethod<Record<string, any>>(
    'list_inventory_stock_summary_v1',
    compactPayload({
      company: toOptionalText(params.company),
      low_stock_threshold: params.lowStockThreshold,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20,
      search_key: toOptionalText(params.searchKey),
      stock_status: params.stockStatus ?? 'all',
      warehouse: toOptionalText(params.warehouse),
    }),
  );
  const data = result.data ?? {};
  const pagination = readObject(data.pagination);
  const rows = Array.isArray(data.rows) ? data.rows : [];

  return {
    hasMore: Boolean(pagination.has_more),
    items: rows.map((row) => mapInventoryStockSummaryRow(readObject(row))),
    summary: {
      ...emptyStockSummary(),
      ...mapInventoryStockSummary(data.summary),
    },
    total: toNumber(pagination.total_count, rows.length),
  };
}

export async function adjustInventoryStock(
  payload: InventoryStockAdjustmentPayload,
) {
  return runGatewayMutation<Record<string, unknown>>('update_product_v2', {
    payload: compactPayload({
      company: toOptionalText(payload.company),
      item_code: payload.itemCode,
      posting_date: toOptionalText(payload.postingDate),
      valuation_rate: payload.valuationRate ?? undefined,
      warehouse: payload.warehouse,
      warehouse_stock_qty: payload.targetQty,
      warehouse_stock_uom: toOptionalText(payload.uom),
    }),
    successMessage: '库存已调整',
    transform: (raw) => readObject(raw),
  });
}
