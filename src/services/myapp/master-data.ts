import { callGatewayMethod } from './api-client';
import { resolveMediaUrl } from './media-url';
import { runGatewayMutation } from './mutation';
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
  enabled?: 0 | 1 | boolean;
  limit?: number;
  searchKey?: string;
  start?: number;
};

export type ProductListOptions = ListOptions & {
  brand?: string;
  company?: string;
  inStockOnly?: boolean;
  itemGroup?: string;
  itemContext?: 'sales' | 'purchase' | 'inventory' | 'any';
  warehouse?: string;
};

export type ProductWarehouseStockDetail = {
  company: string;
  qty: number | null;
  warehouse: string;
};

export type ProductPriceEntry = {
  currency: string;
  priceList: string;
  rate: number | null;
};

export type ProductBarcode = {
  barcode: string;
  idx: number;
  isPrimary: boolean;
  name: string | null;
};

export type ProductSummary = {
  allUomDisplays: Record<string, string>;
  allUoms: string[];
  barcode: string;
  barcodes: ProductBarcode[];
  brand: string;
  description: string;
  disabled: boolean;
  imageUrl: string;
  isPurchaseItem?: boolean;
  isSalesItem?: boolean;
  itemCode: string;
  itemGroup: string;
  itemName: string;
  modified: string | null;
  nickname?: string | null;
  price: number | null;
  priceSummary: {
    currentPriceList?: string | null;
    currentRate?: number | null;
    retailRate?: number | null;
    buyingPrices?: ProductPriceEntry[];
    sellingPrices?: ProductPriceEntry[];
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

export type SaveProductPayload = {
  barcode?: string | null;
  brand?: string | null;
  currency?: string | null;
  description?: string | null;
  disabled?: boolean;
  image?: string | null;
  itemCode?: string | null;
  itemGroup?: string | null;
  itemName: string;
  retailDefaultUom?: string | null;
  retailRate?: number | null;
  standardBuyingRate?: number | null;
  standardSellingRate?: number | null;
  stockUom?: string | null;
  valuationRate?: number | null;
  wholesaleDefaultUom?: string | null;
  wholesaleRate?: number | null;
};

export type UpdateProductPayload = Partial<SaveProductPayload>;

export type PartySummary = {
  defaultCurrency: string | null;
  disabled: boolean;
  displayName: string;
  email: string | null;
  group: string | null;
  mobileNo: string | null;
  name: string;
  remarks: string | null;
  type: string | null;
};

export type SavePartyPayload = {
  defaultCurrency?: string | null;
  disabled?: boolean;
  email?: string | null;
  group?: string | null;
  mobileNo?: string | null;
  name: string;
  remarks?: string | null;
  type?: string | null;
};

export type UomSummary = {
  description: string | null;
  disabled: boolean;
  displayName: string;
  enabled: boolean;
  mustBeWholeNumber: boolean;
  name: string;
  symbol: string | null;
  uomName: string;
};

export type WarehouseSummary = {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  company: string;
  disabled: boolean;
  isGroup: boolean;
  modified: string | null;
  name: string;
  parentWarehouse: string | null;
  pin: string | null;
  state: string | null;
  warehouseName: string;
};

export type SaveUomPayload = {
  description?: string | null;
  enabled?: boolean;
  mustBeWholeNumber?: boolean;
  symbol?: string | null;
  uomName: string;
};

export type SaveWarehousePayload = {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  company: string;
  disabled?: boolean;
  isGroup?: boolean;
  parentWarehouse?: string | null;
  pin?: string | null;
  state?: string | null;
  warehouseName: string;
};

export type LinkOption = {
  description: string | null;
  label: string;
  value: string;
};

export type LinkOptionFilters = Record<string, string | number | boolean | null | undefined>;

function mapProduct(row: Record<string, any>): ProductSummary {
  const allUoms = mapUomNames(row.all_uoms);
  const stockUom = String(row.stock_uom ?? row.uom ?? '');

  return {
    allUomDisplays: mapUomDisplays(row.all_uoms),
    allUoms,
    barcode: String(row.barcode ?? ''),
    barcodes: mapProductBarcodes(row.barcodes, row.barcode),
    brand: String(row.brand ?? ''),
    description: String(row.description ?? ''),
    disabled: Boolean(row.disabled),
    imageUrl: resolveMediaUrl(
      typeof row.image === 'string'
        ? row.image
        : typeof row.image_url === 'string'
          ? row.image_url
          : '',
    ),
    isPurchaseItem:
      row.is_purchase_item === undefined || row.is_purchase_item === null
        ? undefined
        : Boolean(Number(row.is_purchase_item)),
    isSalesItem:
      row.is_sales_item === undefined || row.is_sales_item === null
        ? undefined
        : Boolean(Number(row.is_sales_item)),
    itemCode: String(row.item_code ?? ''),
    itemGroup: String(row.item_group ?? ''),
    itemName: String(row.item_name ?? row.item_code ?? ''),
    modified: typeof row.modified === 'string' ? row.modified : null,
    nickname: typeof row.nickname === 'string' ? row.nickname : null,
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

function mapProductBarcodes(value: unknown, primaryBarcode: unknown) {
  const rows = Array.isArray(value) ? value : [];
  const primaryText = toOptionalText(primaryBarcode);
  const mapped = rows
    .map((entry, index): ProductBarcode | null => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const row = entry as Record<string, unknown>;
      const barcode = toOptionalText(row.barcode);
      if (!barcode) {
        return null;
      }
      return {
        barcode,
        idx: Number(row.idx ?? index + 1),
        isPrimary:
          row.is_primary === true ||
          Number(row.is_primary ?? 0) === 1 ||
          barcode === primaryText,
        name: toOptionalText(row.name) ?? null,
      };
    })
    .filter((entry): entry is ProductBarcode => Boolean(entry));

  if (!mapped.length && primaryText) {
    return [{ barcode: primaryText, idx: 1, isPrimary: true, name: null }];
  }

  return mapped;
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
    buyingPrices: mapPriceEntries(row.buying_prices),
    currentPriceList:
      typeof row.current_price_list === 'string'
        ? row.current_price_list
        : null,
    currentRate: toOptionalNumber(row.current_rate),
    retailRate: toOptionalNumber(row.retail_rate),
    sellingPrices: mapPriceEntries(row.selling_prices),
    standardBuyingRate: toOptionalNumber(row.standard_buying_rate),
    standardSellingRate: toOptionalNumber(row.standard_selling_rate),
    valuationRate: toOptionalNumber(row.valuation_rate),
    wholesaleRate: toOptionalNumber(row.wholesale_rate),
  };
}

function mapPriceEntries(value: unknown): ProductPriceEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry): ProductPriceEntry | null => {
      const row = readObject(entry);
      const priceList = toOptionalText(row.price_list);
      if (!priceList) {
        return null;
      }
      return {
        currency: String(row.currency ?? ''),
        priceList,
        rate: toOptionalNumber(row.rate ?? row.price_list_rate),
      };
    })
    .filter((entry): entry is ProductPriceEntry => Boolean(entry));
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
    defaultCurrency:
      typeof row.default_currency === 'string' ? row.default_currency : null,
    disabled: Boolean(row.disabled),
    displayName: String(row.customer_name ?? row.display_name ?? row.name ?? ''),
    email: typeof row.email_id === 'string' ? row.email_id : null,
    group: typeof row.customer_group === 'string' ? row.customer_group : null,
    mobileNo: typeof row.mobile_no === 'string' ? row.mobile_no : null,
    name: String(row.customer ?? row.name ?? ''),
    remarks: typeof row.remarks === 'string' ? row.remarks : null,
    type: typeof row.customer_type === 'string' ? row.customer_type : null,
  };
}

function mapSupplier(row: Record<string, any>): PartySummary {
  return {
    defaultCurrency:
      typeof row.default_currency === 'string' ? row.default_currency : null,
    disabled: Boolean(row.disabled),
    displayName: String(row.supplier_name ?? row.display_name ?? row.name ?? ''),
    email: typeof row.email_id === 'string' ? row.email_id : null,
    group: typeof row.supplier_group === 'string' ? row.supplier_group : null,
    mobileNo: typeof row.mobile_no === 'string' ? row.mobile_no : null,
    name: String(row.supplier ?? row.name ?? ''),
    remarks: typeof row.remarks === 'string' ? row.remarks : null,
    type: typeof row.supplier_type === 'string' ? row.supplier_type : null,
  };
}

function mapUom(row: Record<string, any>): UomSummary {
  const hasEnabled = row.enabled !== undefined && row.enabled !== null;
  const enabled = hasEnabled ? Boolean(Number(row.enabled)) : !Boolean(row.disabled);
  const name = String(row.name ?? row.uom_name ?? '');
  const uomName = String(row.uom_name ?? row.name ?? '');
  const displayName =
    typeof row.display_name === 'string' && row.display_name.trim()
      ? row.display_name
      : uomName || name;

  return {
    description:
      typeof row.description === 'string' && row.description.trim()
        ? row.description
        : null,
    disabled: !enabled,
    displayName,
    enabled,
    mustBeWholeNumber: Boolean(toOptionalNumber(row.must_be_whole_number)),
    name,
    symbol:
      typeof row.symbol === 'string' && row.symbol.trim() ? row.symbol : null,
    uomName,
  };
}

function mapWarehouse(row: Record<string, any>): WarehouseSummary {
  return {
    addressLine1:
      typeof row.address_line_1 === 'string' && row.address_line_1.trim()
        ? row.address_line_1
        : null,
    addressLine2:
      typeof row.address_line_2 === 'string' && row.address_line_2.trim()
        ? row.address_line_2
        : null,
    city: typeof row.city === 'string' && row.city.trim() ? row.city : null,
    company: String(row.company ?? ''),
    disabled: Boolean(toOptionalNumber(row.disabled)),
    isGroup: Boolean(toOptionalNumber(row.is_group)),
    modified: typeof row.modified === 'string' ? row.modified : null,
    name: String(row.name ?? ''),
    parentWarehouse:
      typeof row.parent_warehouse === 'string' && row.parent_warehouse.trim()
        ? row.parent_warehouse
        : null,
    pin: typeof row.pin === 'string' && row.pin.trim() ? row.pin : null,
    state: typeof row.state === 'string' && row.state.trim() ? row.state : null,
    warehouseName: String(row.warehouse_name ?? row.name ?? ''),
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

function definedPayload<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null),
  ) as Partial<T>;
}

export async function listProducts(options: ProductListOptions = {}) {
  const result = await callGatewayMethod<unknown>(
    'list_products_v2',
    compactPayload({
      company: toOptionalText(options.company),
      brand: toOptionalText(options.brand),
      disabled: options.disabled ?? 0,
      in_stock_only: options.inStockOnly ? 1 : undefined,
      item_group: toOptionalText(options.itemGroup),
      limit: options.limit ?? 40,
      search_key: toOptionalText(options.searchKey),
      start: options.start ?? 0,
      warehouse: toOptionalText(options.warehouse),
    }),
  );
  return pageResult(result.data, mapProduct);
}

export async function searchProducts(options: ProductListOptions = {}) {
  const result = await callGatewayMethod<unknown>(
    'search_product_v2',
    compactPayload({
      company: toOptionalText(options.company),
      brand: toOptionalText(options.brand),
      disabled: options.disabled ?? 0,
      in_stock_only: options.inStockOnly ? 1 : undefined,
      item_group: toOptionalText(options.itemGroup),
      item_context: options.itemContext ?? 'any',
      limit: options.limit ?? 20,
      search_fields: [
        'item_code',
        'item_name',
        'barcode',
        'nickname',
        'description',
        'specification',
      ],
      search_key: toOptionalText(options.searchKey),
      sort_by: 'relevance',
      sort_order: 'asc',
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

function productSavePayload(
  payload: UpdateProductPayload,
  options: { includeEmptyFields?: boolean } = {},
) {
  type PricePayloadEntry = {
    currency: string | undefined;
    price_list: string;
    rate: number;
  };
  const hasOwn = (key: keyof SaveProductPayload) =>
    Object.prototype.hasOwnProperty.call(payload, key);
  const optionalTextField = (key: keyof SaveProductPayload) => {
    if (!options.includeEmptyFields && !hasOwn(key)) {
      return undefined;
    }
    return payload[key] ?? '';
  };

  const sellingPrices = [
    payload.standardSellingRate === undefined || payload.standardSellingRate === null
      ? null
      : {
          currency: toOptionalText(payload.currency),
          price_list: 'Standard Selling',
          rate: payload.standardSellingRate,
        },
    payload.wholesaleRate === undefined || payload.wholesaleRate === null
      ? null
      : {
          currency: toOptionalText(payload.currency),
          price_list: 'Wholesale',
          rate: payload.wholesaleRate,
        },
    payload.retailRate === undefined || payload.retailRate === null
      ? null
      : {
          currency: toOptionalText(payload.currency),
          price_list: 'Retail',
          rate: payload.retailRate,
        },
  ].filter((entry): entry is PricePayloadEntry => Boolean(entry));
  const buyingPrices =
    payload.standardBuyingRate === undefined || payload.standardBuyingRate === null
      ? undefined
      : [
          {
            currency: toOptionalText(payload.currency),
            price_list: 'Standard Buying',
            rate: payload.standardBuyingRate,
          },
        ];
  const stockUom = toOptionalText(payload.stockUom);

  return definedPayload({
    barcode: optionalTextField('barcode'),
    brand: optionalTextField('brand'),
    currency: optionalTextField('currency'),
    description: optionalTextField('description'),
    disabled: payload.disabled === undefined ? undefined : payload.disabled ? 1 : 0,
    image: payload.image === undefined ? undefined : payload.image,
    item_group: optionalTextField('itemGroup'),
    item_name: payload.itemName,
    retail_default_uom:
      options.includeEmptyFields || hasOwn('retailDefaultUom')
        ? payload.retailDefaultUom ?? stockUom ?? ''
        : undefined,
    selling_prices: sellingPrices.length ? sellingPrices : undefined,
    standard_rate: payload.standardSellingRate ?? undefined,
    stock_uom: stockUom,
    uom_conversions: stockUom
      ? [{ conversion_factor: 1, uom: stockUom }]
      : undefined,
    valuation_rate: payload.valuationRate ?? undefined,
    wholesale_default_uom:
      options.includeEmptyFields || hasOwn('wholesaleDefaultUom')
        ? payload.wholesaleDefaultUom ?? stockUom ?? ''
        : undefined,
    buying_prices: buyingPrices,
  });
}

export async function createProduct(payload: SaveProductPayload) {
  return runGatewayMutation<ProductSummary>('create_product_v2', {
    payload: definedPayload({
      ...productSavePayload(payload, { includeEmptyFields: true }),
      item_code: payload.itemCode ?? undefined,
    }),
    successMessage: '商品已创建',
    transform: (raw) => mapProduct(readObject(raw)),
  });
}

export async function updateProduct(
  itemCode: string,
  payload: UpdateProductPayload,
) {
  return runGatewayMutation<ProductSummary>('update_product_v2', {
    payload: definedPayload({
      ...productSavePayload(payload),
      item_code: itemCode,
    }),
    successMessage: '商品已更新',
    transform: (raw) => mapProduct(readObject(raw)),
  });
}

export async function setProductDisabled(itemCode: string, disabled: boolean) {
  return runGatewayMutation<ProductSummary>('disable_product_v2', {
    payload: { disabled: disabled ? 1 : 0, item_code: itemCode },
    successMessage: disabled ? '商品已停用' : '商品已启用',
    transform: (raw) => mapProduct(readObject(raw)),
  });
}

export async function bulkSetProductsDisabled(
  itemCodes: string[],
  disabled: boolean,
) {
  const results: ProductSummary[] = [];
  for (const itemCode of itemCodes) {
    const result = await setProductDisabled(itemCode, disabled);
    results.push(result.data);
  }
  return results;
}

export async function bulkUpdateProducts(
  itemCodes: string[],
  payload: UpdateProductPayload,
) {
  const results: ProductSummary[] = [];
  for (const itemCode of itemCodes) {
    const result = await updateProduct(itemCode, payload);
    results.push(result.data);
  }
  return results;
}

export async function addProductBarcode(
  itemCode: string,
  barcode: string,
  options: { setPrimary?: boolean } = {},
) {
  return runGatewayMutation<ProductSummary>('add_product_barcode_v2', {
    payload: {
      barcode,
      item_code: itemCode,
      set_primary: options.setPrimary ? 1 : 0,
    },
    successMessage: '条码已新增',
    transform: (raw) => mapProduct(readObject(raw)),
  });
}

export async function setPrimaryProductBarcode(
  itemCode: string,
  barcode: string,
) {
  return runGatewayMutation<ProductSummary>('set_primary_product_barcode_v2', {
    payload: { barcode, item_code: itemCode },
    successMessage: '主条码已更新',
    transform: (raw) => mapProduct(readObject(raw)),
  });
}

export async function deleteProductBarcode(itemCode: string, barcode: string) {
  return runGatewayMutation<ProductSummary>('delete_product_barcode_v2', {
    payload: { barcode, item_code: itemCode },
    successMessage: '条码已删除',
    transform: (raw) => mapProduct(readObject(raw)),
  });
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

export async function createCustomer(payload: SavePartyPayload) {
  return runGatewayMutation<PartySummary>('create_customer_v2', {
    payload: compactPayload({
      customer_group: toOptionalText(payload.group),
      customer_name: payload.name,
      customer_type: toOptionalText(payload.type) ?? 'Company',
      contact_email: toOptionalText(payload.email),
      contact_phone: toOptionalText(payload.mobileNo),
      default_currency: toOptionalText(payload.defaultCurrency),
      disabled: payload.disabled ? 1 : 0,
      remarks: payload.remarks ?? '',
    }),
    successMessage: '客户已创建',
    transform: (raw) => mapCustomer(readObject(raw)),
  });
}

export async function updateCustomer(
  customer: string,
  payload: Omit<SavePartyPayload, 'name'> & { name?: string },
) {
  return runGatewayMutation<PartySummary>('update_customer_v2', {
    payload: definedPayload({
      customer,
      customer_group: payload.group ?? '',
      customer_name: payload.name,
      customer_type: payload.type ?? '',
      contact_email: payload.email ?? '',
      contact_phone: payload.mobileNo ?? '',
      default_currency: payload.defaultCurrency ?? '',
      disabled: payload.disabled === undefined ? undefined : payload.disabled ? 1 : 0,
      remarks: payload.remarks ?? '',
    }),
    successMessage: '客户已更新',
    transform: (raw) => mapCustomer(readObject(raw)),
  });
}

export async function setCustomerDisabled(customer: string, disabled: boolean) {
  return runGatewayMutation<PartySummary>('disable_customer_v2', {
    payload: { customer, disabled: disabled ? 1 : 0 },
    successMessage: disabled ? '客户已停用' : '客户已启用',
    transform: (raw) => mapCustomer(readObject(raw)),
  });
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

export async function createSupplier(payload: SavePartyPayload) {
  return runGatewayMutation<PartySummary>('create_supplier_v2', {
    payload: compactPayload({
      default_currency: toOptionalText(payload.defaultCurrency),
      disabled: payload.disabled ? 1 : 0,
      contact_email: toOptionalText(payload.email),
      contact_phone: toOptionalText(payload.mobileNo),
      email_id: toOptionalText(payload.email),
      mobile_no: toOptionalText(payload.mobileNo),
      remarks: payload.remarks ?? '',
      supplier_group: toOptionalText(payload.group),
      supplier_name: payload.name,
      supplier_type: toOptionalText(payload.type) ?? 'Company',
    }),
    successMessage: '供应商已创建',
    transform: (raw) => mapSupplier(readObject(raw)),
  });
}

export async function updateSupplier(
  supplier: string,
  payload: Omit<SavePartyPayload, 'name'> & { name?: string },
) {
  return runGatewayMutation<PartySummary>('update_supplier_v2', {
    payload: definedPayload({
      default_currency: payload.defaultCurrency ?? '',
      disabled: payload.disabled === undefined ? undefined : payload.disabled ? 1 : 0,
      contact_email: payload.email ?? '',
      contact_phone: payload.mobileNo ?? '',
      email_id: payload.email ?? '',
      mobile_no: payload.mobileNo ?? '',
      remarks: payload.remarks ?? '',
      supplier,
      supplier_group: payload.group ?? '',
      supplier_name: payload.name,
      supplier_type: payload.type ?? '',
    }),
    successMessage: '供应商已更新',
    transform: (raw) => mapSupplier(readObject(raw)),
  });
}

export async function setSupplierDisabled(supplier: string, disabled: boolean) {
  return runGatewayMutation<PartySummary>('disable_supplier_v2', {
    payload: { disabled: disabled ? 1 : 0, supplier },
    successMessage: disabled ? '供应商已停用' : '供应商已启用',
    transform: (raw) => mapSupplier(readObject(raw)),
  });
}

function mapMutationUom(raw: unknown) {
  return mapUom(readObject(raw));
}

export async function listUoms(options: ListOptions = {}) {
  const enabled =
    options.enabled === undefined && options.disabled !== undefined
      ? options.disabled
        ? 0
        : 1
      : options.enabled;
  const result = await callGatewayMethod<unknown>(
    'list_uoms_v2',
    compactPayload({
      enabled,
      limit: options.limit ?? 80,
      search_key: toOptionalText(options.searchKey),
      start: options.start ?? 0,
    }),
  );
  return pageResult(result.data, mapUom);
}

export async function createUom(payload: SaveUomPayload) {
  return runGatewayMutation<UomSummary>('create_uom_v2', {
    payload: compactPayload({
      description: toOptionalText(payload.description),
      enabled: payload.enabled === false ? 0 : 1,
      must_be_whole_number: payload.mustBeWholeNumber ? 1 : 0,
      symbol: toOptionalText(payload.symbol),
      uom_name: payload.uomName,
    }),
    successMessage: '单位已创建',
    transform: mapMutationUom,
  });
}

export async function updateUom(
  uom: string,
  payload: Omit<SaveUomPayload, 'uomName'>,
) {
  const updatePayload: Record<string, unknown> = { uom };
  if (payload.description !== undefined) {
    updatePayload.description = payload.description ?? '';
  }
  if (payload.enabled !== undefined) {
    updatePayload.enabled = payload.enabled ? 1 : 0;
  }
  if (payload.mustBeWholeNumber !== undefined) {
    updatePayload.must_be_whole_number = payload.mustBeWholeNumber ? 1 : 0;
  }
  if (payload.symbol !== undefined) {
    updatePayload.symbol = payload.symbol ?? '';
  }

  return runGatewayMutation<UomSummary>('update_uom_v2', {
    payload: updatePayload,
    successMessage: '单位已更新',
    transform: mapMutationUom,
  });
}

export async function setUomDisabled(uom: string, disabled: boolean) {
  return runGatewayMutation<UomSummary>('disable_uom_v2', {
    payload: { disabled: disabled ? 1 : 0, uom },
    successMessage: disabled ? '单位已停用' : '单位已启用',
    transform: mapMutationUom,
  });
}

function mapMutationWarehouse(raw: unknown) {
  return mapWarehouse(readObject(raw));
}

export async function listWarehouses(
  options: ListOptions & { company?: string; isGroup?: boolean | 0 | 1 | 'all' } = {},
) {
  const result = await callGatewayMethod<unknown>(
    'list_warehouses_v2',
    compactPayload({
      company: toOptionalText(options.company),
      disabled: options.disabled,
      is_group: options.isGroup === 'all' ? undefined : options.isGroup,
      limit: options.limit ?? 80,
      search_key: toOptionalText(options.searchKey),
      start: options.start ?? 0,
    }),
  );
  return pageResult(result.data, mapWarehouse);
}

export async function createWarehouse(payload: SaveWarehousePayload) {
  return runGatewayMutation<WarehouseSummary>('create_warehouse_v2', {
    payload: compactPayload({
      address_line_1: toOptionalText(payload.addressLine1),
      address_line_2: toOptionalText(payload.addressLine2),
      city: toOptionalText(payload.city),
      company: payload.company,
      disabled: payload.disabled ? 1 : 0,
      is_group: payload.isGroup ? 1 : 0,
      parent_warehouse: toOptionalText(payload.parentWarehouse),
      pin: toOptionalText(payload.pin),
      state: toOptionalText(payload.state),
      warehouse_name: payload.warehouseName,
    }),
    successMessage: '仓库已创建',
    transform: mapMutationWarehouse,
  });
}

export async function updateWarehouse(
  warehouse: string,
  payload: Partial<SaveWarehousePayload>,
) {
  const updatePayload: Record<string, unknown> = { warehouse };
  if (payload.addressLine1 !== undefined) {
    updatePayload.address_line_1 = payload.addressLine1 ?? '';
  }
  if (payload.addressLine2 !== undefined) {
    updatePayload.address_line_2 = payload.addressLine2 ?? '';
  }
  if (payload.city !== undefined) {
    updatePayload.city = payload.city ?? '';
  }
  if (payload.company !== undefined) {
    updatePayload.company = payload.company;
  }
  if (payload.disabled !== undefined) {
    updatePayload.disabled = payload.disabled ? 1 : 0;
  }
  if (payload.isGroup !== undefined) {
    updatePayload.is_group = payload.isGroup ? 1 : 0;
  }
  if (payload.parentWarehouse !== undefined) {
    updatePayload.parent_warehouse = payload.parentWarehouse ?? '';
  }
  if (payload.pin !== undefined) {
    updatePayload.pin = payload.pin ?? '';
  }
  if (payload.state !== undefined) {
    updatePayload.state = payload.state ?? '';
  }
  if (payload.warehouseName !== undefined) {
    updatePayload.warehouse_name = payload.warehouseName;
  }

  return runGatewayMutation<WarehouseSummary>('update_warehouse_v2', {
    payload: updatePayload,
    successMessage: '仓库已更新',
    transform: mapMutationWarehouse,
  });
}

export async function setWarehouseDisabled(
  warehouse: string,
  disabled: boolean,
) {
  return runGatewayMutation<WarehouseSummary>('disable_warehouse_v2', {
    payload: { disabled: disabled ? 1 : 0, warehouse },
    successMessage: disabled ? '仓库已停用' : '仓库已启用',
    transform: mapMutationWarehouse,
  });
}

export async function searchLinkOptions(
  doctype: string,
  query = '',
  extraFields: string[] = [],
  limit = 20,
  filters: LinkOptionFilters = {},
) {
  const result = await callGatewayMethod<unknown>(
    'search_link_options_v1',
    compactPayload({
      doctype,
      extra_fields: extraFields,
      filters,
      limit,
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
