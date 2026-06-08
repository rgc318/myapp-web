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
  inStockOnly?: boolean;
  warehouse?: string;
};

export type ProductWarehouseStockDetail = {
  company: string;
  qty: number | null;
  warehouse: string;
};

export type ProductSummary = {
  allUomDisplays: Record<string, string>;
  allUoms: string[];
  barcode: string;
  brand: string;
  disabled: boolean;
  imageUrl: string;
  itemCode: string;
  itemGroup: string;
  itemName: string;
  modified: string | null;
  price: number | null;
  priceSummary: {
    currentPriceList?: string | null;
    currentRate?: number | null;
    retailRate?: number | null;
    standardBuyingRate?: number | null;
    standardSellingRate?: number | null;
    valuationRate?: number | null;
    wholesaleRate?: number | null;
  } | null;
  retailDefaultUom?: string | null;
  retailDefaultUomDisplay?: string | null;
  salesProfiles: {
    defaultUom?: string | null;
    defaultUomDisplay?: string | null;
    modeCode: 'wholesale' | 'retail';
    priceList?: string | null;
  }[];
  specification: string;
  stockQty: number | null;
  stockUomDisplay?: string | null;
  stockUom: string;
  totalQty: number | null;
  uom: string | null;
  uomConversions: {
    conversionFactor: number | null;
    uom: string;
  }[];
  uomDisplay?: string | null;
  warehouse: string;
  warehouseStockDetails: ProductWarehouseStockDetail[];
  warehouseStockQty: number | null;
  warehouseStockUom?: string | null;
  warehouseStockUomDisplay?: string | null;
  wholesaleDefaultUom?: string | null;
  wholesaleDefaultUomDisplay?: string | null;
  globalWarehouseStockDetails: ProductWarehouseStockDetail[];
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

export type LinkOption = {
  description: string | null;
  label: string;
  value: string;
};

function mapProduct(row: Record<string, any>): ProductSummary {
  const allUoms = mapUomNames(row.all_uoms);
  const stockUom = String(row.stock_uom ?? row.uom ?? '');

  return {
    allUomDisplays: mapUomDisplays(row.all_uoms),
    allUoms,
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
    priceSummary: mapPriceSummary(row.price_summary),
    retailDefaultUom:
      typeof row.retail_default_uom === 'string'
        ? row.retail_default_uom
        : null,
    retailDefaultUomDisplay:
      typeof row.retail_default_uom_display === 'string'
        ? row.retail_default_uom_display
        : null,
    salesProfiles: mapSalesProfiles(row.sales_profiles),
    specification: String(row.specification ?? row.custom_specification ?? ''),
    stockQty: toOptionalNumber(row.qty ?? row.stock_qty),
    stockUom,
    stockUomDisplay:
      typeof row.stock_uom_display === 'string' ? row.stock_uom_display : null,
    totalQty: toOptionalNumber(row.total_qty ?? row.global_total_qty),
    uom: typeof row.uom === 'string' ? row.uom : stockUom || null,
    uomConversions: mapUomConversions(row.all_uoms),
    uomDisplay: typeof row.uom_display === 'string' ? row.uom_display : null,
    warehouse: String(row.warehouse ?? ''),
    warehouseStockDetails: mapWarehouseStockDetails(
      row.warehouse_stock_details,
    ),
    warehouseStockQty: toOptionalNumber(row.warehouse_stock_qty),
    warehouseStockUom:
      typeof row.warehouse_stock_uom === 'string'
        ? row.warehouse_stock_uom
        : null,
    warehouseStockUomDisplay:
      typeof row.warehouse_stock_uom_display === 'string'
        ? row.warehouse_stock_uom_display
        : null,
    wholesaleDefaultUom:
      typeof row.wholesale_default_uom === 'string'
        ? row.wholesale_default_uom
        : null,
    wholesaleDefaultUomDisplay:
      typeof row.wholesale_default_uom_display === 'string'
        ? row.wholesale_default_uom_display
        : null,
    globalWarehouseStockDetails: mapWarehouseStockDetails(
      row.global_warehouse_stock_details,
    ),
  };
}

function mapWarehouseStockDetails(
  value: unknown,
): ProductWarehouseStockDetail[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const row = entry as Record<string, unknown>;
      const warehouse =
        typeof row.warehouse === 'string' ? row.warehouse.trim() : '';
      if (!warehouse) {
        return null;
      }
      return {
        company: typeof row.company === 'string' ? row.company : '',
        qty: toOptionalNumber(row.qty ?? row.total_qty),
        warehouse,
      };
    })
    .filter((entry): entry is ProductWarehouseStockDetail => Boolean(entry));
}

function mapUomNames(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry.trim();
      }
      if (entry && typeof entry === 'object') {
        const row = entry as Record<string, unknown>;
        return typeof row.uom === 'string' ? row.uom.trim() : '';
      }
      return '';
    })
    .filter(Boolean);
}

function mapUomDisplays(value: unknown) {
  if (!Array.isArray(value)) {
    return {} as Record<string, string>;
  }

  return value.reduce<Record<string, string>>((acc, entry) => {
    if (!entry || typeof entry !== 'object') {
      return acc;
    }
    const row = entry as Record<string, unknown>;
    const uom = typeof row.uom === 'string' ? row.uom.trim() : '';
    const display =
      typeof row.uom_display === 'string' ? row.uom_display.trim() : '';
    if (uom && display) {
      acc[uom] = display;
    }
    return acc;
  }, {});
}

function mapUomConversions(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as ProductSummary['uomConversions'];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const row = entry as Record<string, unknown>;
      const uom = typeof row.uom === 'string' ? row.uom.trim() : '';
      if (!uom) {
        return null;
      }
      return {
        conversionFactor: toOptionalNumber(row.conversion_factor),
        uom,
      };
    })
    .filter(
      (entry): entry is ProductSummary['uomConversions'][number] =>
        Boolean(entry),
    );
}

function mapPriceSummary(value: unknown): ProductSummary['priceSummary'] {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  return {
    currentPriceList:
      typeof row.current_price_list === 'string'
        ? row.current_price_list
        : null,
    currentRate: toOptionalNumber(row.current_rate),
    retailRate: toOptionalNumber(row.retail_rate),
    standardBuyingRate: toOptionalNumber(row.standard_buying_rate),
    standardSellingRate: toOptionalNumber(row.standard_selling_rate),
    valuationRate: toOptionalNumber(row.valuation_rate),
    wholesaleRate: toOptionalNumber(row.wholesale_rate),
  };
}

function mapSalesProfiles(value: unknown): ProductSummary['salesProfiles'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry): ProductSummary['salesProfiles'][number] | null => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const row = entry as Record<string, unknown>;
      let modeCode: ProductSummary['salesProfiles'][number]['modeCode'] | null =
        null;
      if (row.mode_code === 'retail') {
        modeCode = 'retail';
      }
      if (row.mode_code === 'wholesale') {
        modeCode = 'wholesale';
      }
      if (!modeCode) {
        return null;
      }
      return {
        defaultUom:
          typeof row.default_uom === 'string' ? row.default_uom : null,
        defaultUomDisplay:
          typeof row.default_uom_display === 'string'
            ? row.default_uom_display
            : null,
        modeCode,
        priceList:
          typeof row.price_list === 'string' ? row.price_list : null,
      };
    })
    .filter((entry): entry is ProductSummary['salesProfiles'][number] =>
      Boolean(entry),
    );
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
      in_stock_only: options.inStockOnly ? 1 : undefined,
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

export async function searchLinkOptions(
  doctype: string,
  query = '',
  extraFields: string[] = [],
) {
  const result = await callGatewayMethod<unknown>(
    'search_link_options_v1',
    compactPayload({
      doctype,
      extra_fields: extraFields,
      limit: 20,
      query: toOptionalText(query),
    }),
  );
  const rows = Array.isArray(result.data) ? result.data : [];

  return rows
    .map((row: any) => ({
      description:
        typeof row.description === 'string' ? row.description : null,
      label: String(row.label ?? row.value ?? ''),
      value: String(row.value ?? row.label ?? ''),
    }))
    .filter((option) => option.value) satisfies LinkOption[];
}
