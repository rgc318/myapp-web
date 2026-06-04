import { callGatewayMethod } from './api-client';
import { resolveMediaUrl } from './media-url';
import {
  compactPayload,
  readObject,
  readPaginationMeta,
  readRows,
  toOptionalNumber,
  toOptionalText,
  type PageResult,
} from './api-utils';

export type ListOptions = {
  disabled?: 0 | 1 | boolean;
  limit?: number;
  searchKey?: string;
  start?: number;
};

export type ProductListOptions = ListOptions & {
  company?: string;
  warehouse?: string;
};

export type ProductSummary = {
  barcode: string;
  brand: string;
  disabled: boolean;
  imageUrl: string;
  itemCode: string;
  itemGroup: string;
  itemName: string;
  modified: string | null;
  price: number | null;
  specification: string;
  stockQty: number | null;
  stockUom: string;
  totalQty: number | null;
  warehouse: string;
};

export type PartySummary = {
  disabled: boolean;
  displayName: string;
  email: string | null;
  group: string | null;
  mobileNo: string | null;
  name: string;
  type: string | null;
};

export type UomSummary = {
  disabled: boolean;
  mustBeWholeNumber: boolean;
  name: string;
  uomName: string;
};

function mapProduct(row: Record<string, any>): ProductSummary {
  return {
    barcode: String(row.barcode ?? ''),
    brand: String(row.brand ?? ''),
    disabled: Boolean(row.disabled),
    imageUrl: resolveMediaUrl(
      typeof row.image === 'string'
        ? row.image
        : typeof row.image_url === 'string'
          ? row.image_url
          : '',
    ),
    itemCode: String(row.item_code ?? ''),
    itemGroup: String(row.item_group ?? ''),
    itemName: String(row.item_name ?? row.item_code ?? ''),
    modified: typeof row.modified === 'string' ? row.modified : null,
    price: toOptionalNumber(row.price),
    specification: String(row.specification ?? row.custom_specification ?? ''),
    stockQty: toOptionalNumber(row.qty ?? row.stock_qty),
    stockUom: String(row.stock_uom_display ?? row.stock_uom ?? row.uom ?? ''),
    totalQty: toOptionalNumber(row.total_qty ?? row.global_total_qty),
    warehouse: String(row.warehouse ?? ''),
  };
}

function mapCustomer(row: Record<string, any>): PartySummary {
  return {
    disabled: Boolean(row.disabled),
    displayName: String(row.customer_name ?? row.display_name ?? row.name ?? ''),
    email: typeof row.email_id === 'string' ? row.email_id : null,
    group: typeof row.customer_group === 'string' ? row.customer_group : null,
    mobileNo: typeof row.mobile_no === 'string' ? row.mobile_no : null,
    name: String(row.customer ?? row.name ?? ''),
    type: typeof row.customer_type === 'string' ? row.customer_type : null,
  };
}

function mapSupplier(row: Record<string, any>): PartySummary {
  return {
    disabled: Boolean(row.disabled),
    displayName: String(row.supplier_name ?? row.display_name ?? row.name ?? ''),
    email: typeof row.email_id === 'string' ? row.email_id : null,
    group: typeof row.supplier_group === 'string' ? row.supplier_group : null,
    mobileNo: typeof row.mobile_no === 'string' ? row.mobile_no : null,
    name: String(row.supplier ?? row.name ?? ''),
    type: typeof row.supplier_type === 'string' ? row.supplier_type : null,
  };
}

function mapUom(row: Record<string, any>): UomSummary {
  return {
    disabled: Boolean(row.disabled),
    mustBeWholeNumber: Boolean(row.must_be_whole_number),
    name: String(row.name ?? row.uom_name ?? ''),
    uomName: String(row.uom_name ?? row.name ?? ''),
  };
}

function pageResult<T>(raw: unknown, mapper: (row: Record<string, any>) => T): PageResult<T> {
  const rows = readRows(raw);
  const meta = readPaginationMeta(raw, rows.length);
  return {
    hasMore: meta.hasMore,
    items: rows.map(mapper),
    total: meta.total,
  };
}

export async function listProducts(options: ProductListOptions = {}) {
  const result = await callGatewayMethod<unknown>(
    'list_products_v2',
    compactPayload({
      company: toOptionalText(options.company),
      disabled: options.disabled ?? 0,
      limit: options.limit ?? 40,
      search_key: toOptionalText(options.searchKey),
      start: options.start ?? 0,
      warehouse: toOptionalText(options.warehouse),
    }),
  );
  return pageResult(result.data, mapProduct);
}

export async function getProductDetail(
  itemCode: string,
  options: Pick<ProductListOptions, 'company' | 'warehouse'> = {},
) {
  const result = await callGatewayMethod<Record<string, any>>(
    'get_product_detail_v2',
    compactPayload({
      company: toOptionalText(options.company),
      item_code: itemCode,
      warehouse: toOptionalText(options.warehouse),
    }),
  );
  return result.data ? mapProduct(readObject(result.data)) : null;
}

export async function listCustomers(options: ListOptions = {}) {
  const result = await callGatewayMethod<unknown>(
    'list_customers_v2',
    compactPayload({
      disabled: options.disabled,
      limit: options.limit ?? 40,
      search_key: toOptionalText(options.searchKey),
      start: options.start ?? 0,
    }),
  );
  return pageResult(result.data, mapCustomer);
}

export async function getCustomerDetail(customer: string) {
  const result = await callGatewayMethod<Record<string, any>>(
    'get_customer_detail_v2',
    { customer },
  );
  return result.data ? mapCustomer(readObject(result.data)) : null;
}

export async function listSuppliers(options: ListOptions = {}) {
  const result = await callGatewayMethod<unknown>(
    'list_suppliers_v2',
    compactPayload({
      disabled: options.disabled,
      limit: options.limit ?? 40,
      search_key: toOptionalText(options.searchKey),
      start: options.start ?? 0,
    }),
  );
  return pageResult(result.data, mapSupplier);
}

export async function getSupplierDetail(supplier: string) {
  const result = await callGatewayMethod<Record<string, any>>(
    'get_supplier_detail_v2',
    { supplier },
  );
  return result.data ? mapSupplier(readObject(result.data)) : null;
}

export async function listUoms(options: ListOptions = {}) {
  const result = await callGatewayMethod<unknown>(
    'list_uoms_v2',
    compactPayload({
      disabled: options.disabled,
      limit: options.limit ?? 80,
      search_key: toOptionalText(options.searchKey),
      start: options.start ?? 0,
    }),
  );
  return pageResult(result.data, mapUom);
}
