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
  remarks?: string;
  targetQty: number;
  uom?: string;
  valuationRate?: number | null;
  warehouse: string;
};

export type InventoryStockTransferPayload = {
  itemCode: string;
  postingDate?: string;
  qty: number;
  remarks?: string;
  sourceWarehouse: string;
  targetWarehouse: string;
  uom?: string;
};

export type InventoryStockCountItemPayload = {
  countedQty: number;
  itemCode: string;
  uom?: string;
  valuationRate?: number | null;
  warehouse: string;
};

export type InventoryStockCountPayload = {
  company?: string;
  items: InventoryStockCountItemPayload[];
  postingDate?: string;
  remarks?: string;
};

export type InventoryStockCountRow = {
  company: string;
  conversionFactor: number;
  countedStockQty: number;
  currentStockQty: number;
  hasDifference: boolean;
  inputQty: number;
  inputUom: string;
  itemCode: string;
  itemName: string;
  qtyDelta: number;
  stockUom: string;
  valuationRate: number;
  warehouse: string;
};

export type InventoryStockCountResult = {
  company?: string;
  differenceCount: number;
  postingDate: string | null;
  rows: InventoryStockCountRow[];
  stockReconciliation: string | null;
};

export type InventoryStockMutationResult = {
  company?: string;
  conversionFactor: number;
  currentStockQty?: number;
  inputQty: number;
  inputUom: string;
  itemCode: string;
  itemName: string;
  qtyDelta?: number;
  sourceQtyAfter?: number;
  sourceQtyBefore?: number;
  sourceWarehouse?: string;
  stockEntry: string | null;
  stockQty?: number;
  stockUom: string;
  targetStockQty?: number;
  targetWarehouse?: string;
  warehouse?: string;
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
  return runGatewayMutation<InventoryStockMutationResult>(
    'reconcile_inventory_stock_v1',
    {
      payload: compactPayload({
        item_code: payload.itemCode,
        posting_date: toOptionalText(payload.postingDate),
        remarks: toOptionalText(payload.remarks),
        target_qty: payload.targetQty,
        uom: toOptionalText(payload.uom),
        valuation_rate: payload.valuationRate ?? undefined,
        warehouse: payload.warehouse,
      }),
      successMessage: '库存已调整',
      transform: (raw) => mapInventoryStockMutationResult(readObject(raw)),
    },
  );
}

export async function transferInventoryStock(
  payload: InventoryStockTransferPayload,
) {
  return runGatewayMutation<InventoryStockMutationResult>(
    'transfer_inventory_stock_v1',
    {
      payload: compactPayload({
        item_code: payload.itemCode,
        posting_date: toOptionalText(payload.postingDate),
        qty: payload.qty,
        remarks: toOptionalText(payload.remarks),
        source_warehouse: payload.sourceWarehouse,
        target_warehouse: payload.targetWarehouse,
        uom: toOptionalText(payload.uom),
      }),
      successMessage: '库存已转仓',
      transform: (raw) => mapInventoryStockMutationResult(readObject(raw)),
    },
  );
}

export async function submitInventoryStockCount(
  payload: InventoryStockCountPayload,
) {
  return runGatewayMutation<InventoryStockCountResult>(
    'submit_inventory_stock_count_v1',
    {
      payload: compactPayload({
        company: toOptionalText(payload.company),
        items: payload.items.map((item) =>
          compactPayload({
            counted_qty: item.countedQty,
            item_code: item.itemCode,
            uom: toOptionalText(item.uom),
            valuation_rate: item.valuationRate ?? undefined,
            warehouse: item.warehouse,
          }),
        ),
        posting_date: toOptionalText(payload.postingDate),
        remarks: toOptionalText(payload.remarks),
      }),
      successMessage: '库存盘点已提交',
      transform: (raw) => mapInventoryStockCountResult(readObject(raw)),
    },
  );
}

function mapInventoryStockMutationResult(
  row: Record<string, any>,
): InventoryStockMutationResult {
  return {
    company:
      typeof row.company === 'string' && row.company ? row.company : undefined,
    conversionFactor: toNumber(row.conversion_factor),
    currentStockQty:
      row.current_stock_qty === undefined
        ? undefined
        : toNumber(row.current_stock_qty),
    inputQty: toNumber(row.input_qty),
    inputUom: String(row.input_uom ?? ''),
    itemCode: String(row.item_code ?? ''),
    itemName: String(row.item_name ?? row.item_code ?? ''),
    qtyDelta: row.qty_delta === undefined ? undefined : toNumber(row.qty_delta),
    sourceQtyAfter:
      row.source_qty_after === undefined
        ? undefined
        : toNumber(row.source_qty_after),
    sourceQtyBefore:
      row.source_qty_before === undefined
        ? undefined
        : toNumber(row.source_qty_before),
    sourceWarehouse:
      typeof row.source_warehouse === 'string' && row.source_warehouse
        ? row.source_warehouse
        : undefined,
    stockEntry:
      typeof row.stock_entry === 'string' && row.stock_entry
        ? row.stock_entry
        : null,
    stockQty: row.stock_qty === undefined ? undefined : toNumber(row.stock_qty),
    stockUom: String(row.stock_uom ?? ''),
    targetStockQty:
      row.target_stock_qty === undefined
        ? undefined
        : toNumber(row.target_stock_qty),
    targetWarehouse:
      typeof row.target_warehouse === 'string' && row.target_warehouse
        ? row.target_warehouse
        : undefined,
    warehouse:
      typeof row.warehouse === 'string' && row.warehouse
        ? row.warehouse
        : undefined,
  };
}

function mapInventoryStockCountRow(
  row: Record<string, any>,
): InventoryStockCountRow {
  return {
    company: String(row.company ?? ''),
    conversionFactor: toNumber(row.conversion_factor),
    countedStockQty: toNumber(row.counted_stock_qty),
    currentStockQty: toNumber(row.current_stock_qty),
    hasDifference: Boolean(row.has_difference),
    inputQty: toNumber(row.input_qty),
    inputUom: String(row.input_uom ?? ''),
    itemCode: String(row.item_code ?? ''),
    itemName: String(row.item_name ?? row.item_code ?? ''),
    qtyDelta: toNumber(row.qty_delta),
    stockUom: String(row.stock_uom ?? ''),
    valuationRate: toNumber(row.valuation_rate),
    warehouse: String(row.warehouse ?? ''),
  };
}

function mapInventoryStockCountResult(
  row: Record<string, any>,
): InventoryStockCountResult {
  const rows = Array.isArray(row.rows) ? row.rows : [];
  return {
    company:
      typeof row.company === 'string' && row.company ? row.company : undefined,
    differenceCount: toNumber(row.difference_count),
    postingDate:
      typeof row.posting_date === 'string' && row.posting_date
        ? row.posting_date
        : null,
    rows: rows.map((entry) => mapInventoryStockCountRow(readObject(entry))),
    stockReconciliation:
      typeof row.stock_reconciliation === 'string' && row.stock_reconciliation
        ? row.stock_reconciliation
        : null,
  };
}
