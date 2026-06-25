import { callGatewayMethod } from './api-client';
import {
  compactPayload,
  readObject,
  toNumber,
  toOptionalText,
  type PageResult,
} from './api-utils';

export type ReportFilter = {
  company?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number;
  searchKey?: string | null;
};

export type BusinessOverview = {
  netCashflowTotal: number;
  paidAmountTotal: number;
  payableOutstandingTotal: number;
  purchaseAmountTotal: number;
  receivableOutstandingTotal: number;
  receivedAmountTotal: number;
  salesAmountTotal: number;
};

export type PartySummaryRow = {
  amount?: number;
  count: number;
  name: string;
  outstandingAmount?: number;
  paidAmount?: number;
  totalAmount?: number;
};

export type TrendRow = {
  amount: number;
  count: number;
  trendDate: string;
};

export type ProductSummaryRow = {
  amount: number;
  itemKey: string;
  itemName: string;
  qty: number;
  specification?: string | null;
};

export type HourlyTrendRow = {
  amount: number;
  count: number;
  trendHour: number;
};

export type CashflowTrendRow = {
  count: number;
  inAmount: number;
  outAmount: number;
  trendDate: string;
};

export type CashflowEntry = {
  amount: number;
  direction: 'in' | 'out' | 'transfer';
  modeOfPayment: string | null;
  name: string | null;
  party: string | null;
  partyType: string | null;
  postingDate: string | null;
  referenceNo: string | null;
};

export type PaymentEntryReference = {
  account: string | null;
  allocatedAmount: number;
  dueDate: string | null;
  exchangeRate: number;
  isReturn: boolean;
  outstandingAmount: number;
  referenceDoctype: string | null;
  referenceName: string | null;
  returnAgainst: string | null;
  totalAmount: number;
};

export type PaymentEntryDeduction = {
  account: string | null;
  amount: number;
  costCenter: string | null;
  description: string | null;
};

export type PaymentEntryDetail = {
  actions: {
    canCancel: boolean;
    cancelHint: string;
  };
  amount: number;
  businessType: string;
  company: string | null;
  currency: string | null;
  deductions: PaymentEntryDeduction[];
  differenceAmount: number;
  direction: 'in' | 'out' | 'transfer';
  docstatus: number;
  documentStatus: string;
  links: {
    purchaseInvoices: string[];
    purchaseOrders: string[];
    returnInvoices: string[];
    salesInvoices: string[];
    salesOrders: string[];
  };
  modeOfPayment: string | null;
  name: string;
  paidAmount: number;
  paidFrom: string | null;
  paidTo: string | null;
  party: string | null;
  partyName: string | null;
  partyType: string | null;
  paymentType: string | null;
  postingDate: string | null;
  receivedAmount: number;
  referenceDate: string | null;
  referenceNo: string | null;
  references: PaymentEntryReference[];
  remarks: string | null;
  unallocatedAmount: number;
};

export type BusinessReport = {
  meta: {
    company: string | null;
    dateFrom: string;
    dateTo: string;
    limit: number;
  };
  overview: BusinessOverview;
  tables: {
    cashflowTrend: CashflowTrendRow[];
    payableSummary: PartySummaryRow[];
    purchaseProductSummary: ProductSummaryRow[];
    purchaseSummary: PartySummaryRow[];
    purchaseTrend: TrendRow[];
    purchaseTrendHourly: HourlyTrendRow[];
    receivableSummary: PartySummaryRow[];
    salesProductSummary: ProductSummaryRow[];
    salesSummary: PartySummaryRow[];
    salesTrend: TrendRow[];
    salesTrendHourly: HourlyTrendRow[];
  };
};

function buildPayload(filter: ReportFilter = {}) {
  return compactPayload({
    company: toOptionalText(filter.company),
    date_from: toOptionalText(filter.dateFrom),
    date_to: toOptionalText(filter.dateTo),
    limit: filter.limit,
  });
}

function emptyOverview(): BusinessOverview {
  return {
    netCashflowTotal: 0,
    paidAmountTotal: 0,
    payableOutstandingTotal: 0,
    purchaseAmountTotal: 0,
    receivableOutstandingTotal: 0,
    receivedAmountTotal: 0,
    salesAmountTotal: 0,
  };
}

function emptyTables(): BusinessReport['tables'] {
  return {
    cashflowTrend: [],
    payableSummary: [],
    purchaseProductSummary: [],
    purchaseSummary: [],
    purchaseTrend: [],
    purchaseTrendHourly: [],
    receivableSummary: [],
    salesProductSummary: [],
    salesSummary: [],
    salesTrend: [],
    salesTrendHourly: [],
  };
}

function mapOverview(value: unknown): BusinessOverview {
  const row = readObject(value);
  return {
    netCashflowTotal: toNumber(row.net_cashflow_total),
    paidAmountTotal: toNumber(row.paid_amount_total),
    payableOutstandingTotal: toNumber(row.payable_outstanding_total),
    purchaseAmountTotal: toNumber(row.purchase_amount_total),
    receivableOutstandingTotal: toNumber(row.receivable_outstanding_total),
    receivedAmountTotal: toNumber(row.received_amount_total),
    salesAmountTotal: toNumber(row.sales_amount_total),
  };
}

function mapMeta(value: unknown, limit = 0) {
  const meta = readObject(value);
  return {
    company: typeof meta.company === 'string' ? meta.company : null,
    dateFrom: typeof meta.date_from === 'string' ? meta.date_from : '',
    dateTo: typeof meta.date_to === 'string' ? meta.date_to : '',
    limit: toNumber(meta.limit, limit),
  };
}

function mapPartyRow(value: unknown): PartySummaryRow | null {
  const row = readObject(value);
  const name = typeof row.name === 'string' ? row.name : '';
  if (!name) {
    return null;
  }

  return {
    amount: row.amount == null ? undefined : toNumber(row.amount),
    count: toNumber(row.count),
    name,
    outstandingAmount:
      row.outstanding_amount == null ? undefined : toNumber(row.outstanding_amount),
    paidAmount: row.paid_amount == null ? undefined : toNumber(row.paid_amount),
    totalAmount: row.total_amount == null ? undefined : toNumber(row.total_amount),
  };
}

function mapTrendRow(value: unknown): TrendRow | null {
  const row = readObject(value);
  const trendDate = typeof row.trend_date === 'string' ? row.trend_date : '';
  return trendDate
    ? {
        amount: toNumber(row.amount),
        count: toNumber(row.count),
        trendDate,
      }
    : null;
}

function mapProductRow(value: unknown): ProductSummaryRow | null {
  const row = readObject(value);
  const itemKey = typeof row.item_key === 'string' ? row.item_key : '';
  return itemKey
    ? {
        amount: toNumber(row.amount),
        itemKey,
        itemName:
          typeof row.item_name === 'string' && row.item_name ? row.item_name : itemKey,
        qty: toNumber(row.qty),
        specification:
          typeof row.specification === 'string'
            ? row.specification
            : typeof row.custom_specification === 'string'
              ? row.custom_specification
              : null,
      }
    : null;
}

function mapHourlyRow(value: unknown): HourlyTrendRow | null {
  const row = readObject(value);
  return {
    amount: toNumber(row.amount),
    count: toNumber(row.count),
    trendHour: toNumber(row.trend_hour),
  };
}

function mapCashflowTrendRow(value: unknown): CashflowTrendRow | null {
  const row = readObject(value);
  const trendDate = typeof row.trend_date === 'string' ? row.trend_date : '';
  return trendDate
    ? {
        count: toNumber(row.count),
        inAmount: toNumber(row.in_amount),
        outAmount: toNumber(row.out_amount),
        trendDate,
      }
    : null;
}

function mapCashflowEntry(value: unknown): CashflowEntry | null {
  const row = readObject(value);
  return {
    amount: toNumber(row.amount),
    direction: row.direction === 'out' || row.direction === 'transfer' ? row.direction : 'in',
    modeOfPayment: typeof row.mode_of_payment === 'string' ? row.mode_of_payment : null,
    name: typeof row.name === 'string' ? row.name : null,
    party: typeof row.party === 'string' ? row.party : null,
    partyType: typeof row.party_type === 'string' ? row.party_type : null,
    postingDate: typeof row.posting_date === 'string' ? row.posting_date : null,
    referenceNo: typeof row.reference_no === 'string' ? row.reference_no : null,
  };
}

function mapTextList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item))
    : [];
}

function mapPaymentEntryReference(value: unknown): PaymentEntryReference {
  const row = readObject(value);
  return {
    account: typeof row.account === 'string' ? row.account : null,
    allocatedAmount: toNumber(row.allocated_amount),
    dueDate: typeof row.due_date === 'string' ? row.due_date : null,
    exchangeRate: toNumber(row.exchange_rate),
    isReturn: Boolean(row.is_return),
    outstandingAmount: toNumber(row.outstanding_amount),
    referenceDoctype:
      typeof row.reference_doctype === 'string' ? row.reference_doctype : null,
    referenceName:
      typeof row.reference_name === 'string' ? row.reference_name : null,
    returnAgainst:
      typeof row.return_against === 'string' ? row.return_against : null,
    totalAmount: toNumber(row.total_amount),
  };
}

function mapPaymentEntryDeduction(value: unknown): PaymentEntryDeduction {
  const row = readObject(value);
  return {
    account: typeof row.account === 'string' ? row.account : null,
    amount: toNumber(row.amount),
    costCenter: typeof row.cost_center === 'string' ? row.cost_center : null,
    description: typeof row.description === 'string' ? row.description : null,
  };
}

function mapPaymentEntryDetail(value: unknown): PaymentEntryDetail {
  const row = readObject(value);
  const links = readObject(row.links);
  const actions = readObject(row.actions);

  return {
    actions: {
      canCancel: Boolean(actions.can_cancel),
      cancelHint: typeof actions.cancel_hint === 'string' ? actions.cancel_hint : '',
    },
    amount: toNumber(row.amount),
    businessType: typeof row.business_type === 'string' ? row.business_type : '',
    company: typeof row.company === 'string' ? row.company : null,
    currency: typeof row.currency === 'string' ? row.currency : null,
    deductions: (Array.isArray(row.deductions) ? row.deductions : []).map(
      mapPaymentEntryDeduction,
    ),
    differenceAmount: toNumber(row.difference_amount),
    direction: row.direction === 'out' || row.direction === 'transfer' ? row.direction : 'in',
    docstatus: toNumber(row.docstatus),
    documentStatus:
      typeof row.document_status === 'string' ? row.document_status : '',
    links: {
      purchaseInvoices: mapTextList(links.purchase_invoices),
      purchaseOrders: mapTextList(links.purchase_orders),
      returnInvoices: mapTextList(links.return_invoices),
      salesInvoices: mapTextList(links.sales_invoices),
      salesOrders: mapTextList(links.sales_orders),
    },
    modeOfPayment:
      typeof row.mode_of_payment === 'string' ? row.mode_of_payment : null,
    name: typeof row.name === 'string' ? row.name : '',
    paidAmount: toNumber(row.paid_amount),
    paidFrom: typeof row.paid_from === 'string' ? row.paid_from : null,
    paidTo: typeof row.paid_to === 'string' ? row.paid_to : null,
    party: typeof row.party === 'string' ? row.party : null,
    partyName: typeof row.party_name === 'string' ? row.party_name : null,
    partyType: typeof row.party_type === 'string' ? row.party_type : null,
    paymentType: typeof row.payment_type === 'string' ? row.payment_type : null,
    postingDate: typeof row.posting_date === 'string' ? row.posting_date : null,
    receivedAmount: toNumber(row.received_amount),
    referenceDate:
      typeof row.reference_date === 'string' ? row.reference_date : null,
    referenceNo: typeof row.reference_no === 'string' ? row.reference_no : null,
    references: (Array.isArray(row.references) ? row.references : []).map(
      mapPaymentEntryReference,
    ),
    remarks: typeof row.remarks === 'string' ? row.remarks : null,
    unallocatedAmount: toNumber(row.unallocated_amount),
  };
}

function mapReport(data: Record<string, any>, fallbackLimit = 0): BusinessReport {
  const tables = readObject(data.tables);
  return {
    meta: mapMeta(data.meta, fallbackLimit),
    overview: {
      ...emptyOverview(),
      ...mapOverview(data.overview),
    },
    tables: {
      ...emptyTables(),
      cashflowTrend: (Array.isArray(tables.cashflow_trend)
        ? tables.cashflow_trend
        : []
      )
        .map(mapCashflowTrendRow)
        .filter((row): row is CashflowTrendRow => Boolean(row)),
      payableSummary: (Array.isArray(tables.payable_summary)
        ? tables.payable_summary
        : []
      )
        .map(mapPartyRow)
        .filter((row): row is PartySummaryRow => Boolean(row)),
      purchaseProductSummary: (Array.isArray(tables.purchase_product_summary)
        ? tables.purchase_product_summary
        : []
      )
        .map(mapProductRow)
        .filter((row): row is ProductSummaryRow => Boolean(row)),
      purchaseSummary: (Array.isArray(tables.purchase_summary)
        ? tables.purchase_summary
        : []
      )
        .map(mapPartyRow)
        .filter((row): row is PartySummaryRow => Boolean(row)),
      purchaseTrend: (Array.isArray(tables.purchase_trend)
        ? tables.purchase_trend
        : []
      )
        .map(mapTrendRow)
        .filter((row): row is TrendRow => Boolean(row)),
      purchaseTrendHourly: (Array.isArray(tables.purchase_trend_hourly)
        ? tables.purchase_trend_hourly
        : []
      )
        .map(mapHourlyRow)
        .filter((row): row is HourlyTrendRow => Boolean(row)),
      receivableSummary: (Array.isArray(tables.receivable_summary)
        ? tables.receivable_summary
        : []
      )
        .map(mapPartyRow)
        .filter((row): row is PartySummaryRow => Boolean(row)),
      salesProductSummary: (Array.isArray(tables.sales_product_summary)
        ? tables.sales_product_summary
        : []
      )
        .map(mapProductRow)
        .filter((row): row is ProductSummaryRow => Boolean(row)),
      salesSummary: (Array.isArray(tables.sales_summary) ? tables.sales_summary : [])
        .map(mapPartyRow)
        .filter((row): row is PartySummaryRow => Boolean(row)),
      salesTrend: (Array.isArray(tables.sales_trend) ? tables.sales_trend : [])
        .map(mapTrendRow)
        .filter((row): row is TrendRow => Boolean(row)),
      salesTrendHourly: (Array.isArray(tables.sales_trend_hourly)
        ? tables.sales_trend_hourly
        : []
      )
        .map(mapHourlyRow)
        .filter((row): row is HourlyTrendRow => Boolean(row)),
    },
  };
}

export async function fetchBusinessReportOverview(filter?: ReportFilter) {
  const result = await callGatewayMethod<Record<string, any>>(
    'get_business_report_overview_v1',
    buildPayload(filter),
  );
  return mapReport(result.data ?? {}, filter?.limit ?? 0);
}

export async function fetchSalesReport(filter?: ReportFilter) {
  const result = await callGatewayMethod<Record<string, any>>(
    'get_sales_report_v1',
    buildPayload({ ...filter, limit: filter?.limit ?? 8 }),
  );
  return mapReport(result.data ?? {}, filter?.limit ?? 8);
}

export async function fetchPurchaseReport(filter?: ReportFilter) {
  const result = await callGatewayMethod<Record<string, any>>(
    'get_purchase_report_v1',
    buildPayload({ ...filter, limit: filter?.limit ?? 8 }),
  );
  return mapReport(result.data ?? {}, filter?.limit ?? 8);
}

export async function fetchReceivablePayableReport(filter?: ReportFilter) {
  const result = await callGatewayMethod<Record<string, any>>(
    'get_receivable_payable_report_v1',
    buildPayload({ ...filter, limit: filter?.limit ?? 8 }),
  );
  return mapReport(result.data ?? {}, filter?.limit ?? 8);
}

export async function fetchCashflowReport(filter?: ReportFilter) {
  const result = await callGatewayMethod<Record<string, any>>(
    'get_cashflow_report_v1',
    buildPayload(filter),
  );
  const data = result.data ?? {};
  return {
    meta: mapMeta(data.meta),
    overview: mapOverview(data.overview),
    trend: (Array.isArray(data.trend) ? data.trend : [])
      .map(mapCashflowTrendRow)
      .filter((row): row is CashflowTrendRow => Boolean(row)),
  };
}

export async function fetchCashflowEntries(
  filter?: ReportFilter & { page?: number; pageSize?: number },
): Promise<PageResult<CashflowEntry> & { meta: ReturnType<typeof mapMeta> }> {
  const result = await callGatewayMethod<Record<string, any>>(
    'list_cashflow_entries_v1',
    compactPayload({
      ...buildPayload(filter),
      page: filter?.page ?? 1,
      page_size: filter?.pageSize ?? 20,
      search_key: toOptionalText(filter?.searchKey),
    }),
  );
  const data = result.data ?? {};
  const pagination = readObject(data.pagination);
  const rows = (Array.isArray(data.rows) ? data.rows : [])
    .map(mapCashflowEntry)
    .filter((row): row is CashflowEntry => Boolean(row));

  return {
    hasMore: Boolean(pagination.has_more),
    items: rows,
    meta: mapMeta(data.meta),
    total: toNumber(pagination.total_count, rows.length),
  };
}

export async function getPaymentEntryDetail(
  paymentEntryName: string,
): Promise<PaymentEntryDetail> {
  const result = await callGatewayMethod<Record<string, any>>(
    'get_payment_entry_detail_v1',
    { payment_entry_name: paymentEntryName },
  );
  return mapPaymentEntryDetail(result.data ?? {});
}
