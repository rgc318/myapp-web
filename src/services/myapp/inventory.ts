import { callGatewayMethod } from './api-client';
import {
  compactPayload,
  readObject,
  toNumber,
  toOptionalText,
  type PageResult,
} from './api-utils';

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
