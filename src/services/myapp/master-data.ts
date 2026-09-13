import { sortUomsByBusinessPriority } from '@/utils/display-uom';
import { callGatewayMethod } from './api-client';
import {
  compactPayload,
  type PageResult,
  readObject,
  readPaginationMeta,
  readRows,
  toOptionalNumber,
  toOptionalText,
} from './api-utils';
import { resolveMediaUrl } from './media-url';
import { runGatewayMutation } from './mutation';

export type ListOptions = {
  disabled?: 0 | 1 | boolean;
  enabled?: 0 | 1 | boolean;
  group?: string;
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
  sortBy?: 'modified' | 'creation' | 'item_name' | 'name';
  sortOrder?: 'asc' | 'desc';
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
  uom?: string | null;
};

export type ProductPriceRecord = ProductPriceEntry & {
  modified: string | null;
  name: string;
  priceListType: 'selling' | 'buying' | 'both';
  validFrom: string | null;
  validUpto: string | null;
};

export type ProductPriceListOption = {
  buying: boolean;
  currency: string | null;
  name: string;
  selling: boolean;
};

export type ProductPriceCollection = {
  canCreate: boolean;
  canWrite: boolean;
  itemCode: string;
  itemModified: string | null;
  priceLists: ProductPriceListOption[];
  prices: ProductPriceRecord[];
};

export type ProductChangeHistoryChange = {
  field: string;
  label: string;
  newValue: unknown;
  oldValue: unknown;
  rowAction?: 'added' | 'removed' | null;
};

export type ProductChangeHistoryEvent = {
  action: 'created' | 'updated' | 'terminated' | 'corrected';
  actor: string | null;
  category: 'product' | 'price' | 'barcode' | 'uom' | 'valuation';
  changes: ProductChangeHistoryChange[];
  id: string;
  occurredAt: string;
  sourceDoctype: string;
  sourceName: string;
  summary: string;
  title: string;
};

export type ProductChangeHistory = {
  events: ProductChangeHistoryEvent[];
  hasMore: boolean;
  itemCode: string;
  limit: number;
  start: number;
};

export type SaveProductPricePayload = {
  currency?: string | null;
  itemCode: string;
  itemModified?: string | null;
  priceList: string;
  priceModified?: string | null;
  priceName?: string | null;
  rate: number;
  uom: string;
  validFrom?: string | null;
  validUpto?: string | null;
};

export type ProductBarcode = {
  barcode: string;
  idx: number;
  isPrimary: boolean;
  name: string | null;
  uom?: string | null;
};

export type ProductUomMigrationIssue = {
  code: string;
  message: string;
};

export type ProductUomMigrationPrice = ProductPriceEntry & {
  name: string;
};

export type ProductUomMigrationAssessment = {
  alternatives: {
    alternativeItemCode: string;
    name: string;
    twoWay: boolean;
  }[];
  barcodes: ProductBarcode[];
  blockers: ProductUomMigrationIssue[];
  canExecute: boolean;
  canExecuteWithInventoryConversion: boolean;
  history: {
    latestStockLedgerEntry: {
      postingDate: string | null;
      postingTime: string | null;
      voucherNo: string | null;
      voucherType: string | null;
    } | null;
    stockLedgerEntryCount: number;
  };
  inventory: {
    bins: {
      actualQty: number | null;
      committedQty: number | null;
      company: string;
      projectedQty: number | null;
      warehouse: string;
    }[];
    totalActualQty: number | null;
    totalCommittedQty: number | null;
  };
  openTransactions: {
    purchaseOrderCount: number;
    salesOrderCount: number;
  };
  prices: ProductUomMigrationPrice[];
  recommendedStrategy: 'in_place' | 'replacement' | null;
  strategies: {
    inPlace: { available: boolean; reason: string };
    replacement: { available: boolean; reason: string };
  };
  suggestedNewItemCode: string;
  source: {
    disabled: boolean;
    itemCode: string;
    itemName: string;
    modified: string;
    retailDefaultUom: string | null;
    stockUom: string;
    stockUomDisplay: string | null;
    uomConversions: ProductSummary['uomConversions'];
    wholesaleDefaultUom: string | null;
  };
  warnings: ProductUomMigrationIssue[];
};

export type ExecuteProductUomMigrationPayload = {
  barcodeMappings: {
    action: 'move' | 'keep';
    sourceName: string;
    targetUom?: string | null;
  }[];
  confirmDisableSource: boolean;
  confirmHistoryPreserved: boolean;
  confirmInPlaceCorrection?: boolean;
  confirmInventoryConversion?: boolean;
  correctionReason?: string | null;
  itemCode: string;
  inventoryMappings?: {
    sourceQty: number;
    targetQty: number;
    warehouse: string;
  }[];
  newItemCode?: string | null;
  newItemName?: string | null;
  newPrices?: {
    currency?: string | null;
    priceList: string;
    rate: number;
    targetUom: string;
  }[];
  priceMappings: {
    action: 'copy' | 'manual' | 'skip';
    sourceName: string;
    targetRate?: number | null;
    targetUom?: string | null;
  }[];
  retailDefaultUom?: string | null;
  sourceModified: string;
  stockUom: string;
  strategy?: 'in_place' | 'replacement';
  uomConversions: {
    conversionFactor?: number | null;
    uom?: string | null;
  }[];
  wholesaleDefaultUom?: string | null;
};

export type ActiveProductResolution = {
  activeDisabled: boolean;
  activeItemCode: string;
  chain: {
    source: 'correction_record' | 'legacy_item_alternative';
    sourceItem: string;
    targetItem: string;
  }[];
  changed: boolean;
  requestedItemCode: string;
  requiresConfirmation: boolean;
  resolutionSource: 'correction_record' | 'legacy_item_alternative' | null;
};

export type ProductSummary = {
  allUomDisplays: Record<string, string>;
  allUoms: string[];
  barcode: string;
  barcodes: ProductBarcode[];
  brand: string;
  canWrite: boolean;
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
  company?: string | null;
  currency?: string | null;
  description?: string | null;
  disabled?: boolean;
  image?: string | null;
  itemCode?: string | null;
  itemGroup?: string | null;
  itemName: string;
  postingDate?: string | null;
  retailDefaultUom?: string | null;
  retailRate?: number | null;
  standardBuyingRate?: number | null;
  standardSellingRate?: number | null;
  stockUom?: string | null;
  uomConversions?: {
    conversionFactor?: number | null;
    uom?: string | null;
  }[];
  valuationRate?: number | null;
  warehouse?: string | null;
  warehouseStockQty?: number | null;
  warehouseStockUom?: string | null;
  wholesaleDefaultUom?: string | null;
  wholesaleRate?: number | null;
};

export type UpdateProductPayload = Partial<SaveProductPayload> & {
  itemModified?: string | null;
};

export type ProductBulkMutationTarget = {
  itemCode: string;
  itemModified?: string | null;
};

export type ProductBulkMutationResult = {
  failed: { error: string; itemCode: string }[];
  succeeded: ProductSummary[];
};

export type CreateProductAndStockPayload = {
  defaultWarehouse?: string | null;
  description?: string | null;
  itemName: string;
  nickname?: string | null;
  openingQty?: number | null;
  openingUom?: string | null;
  standardRate?: number | null;
  stockUom?: string | null;
  uomConversions?: {
    conversionFactor?: number | null;
    uom?: string | null;
  }[];
};

export type PartySummary = {
  creation: string | null;
  defaultAddress: PartyAddressSummary | null;
  defaultContact: PartyContactSummary | null;
  defaultCurrency: string | null;
  defaultPriceList: string | null;
  disabled: boolean;
  displayName: string;
  email: string | null;
  group: string | null;
  mobileNo: string | null;
  modified: string | null;
  name: string;
  paymentTerms: string | null;
  recentAddresses: PartyRecentAddress[];
  remarks: string | null;
  taxCategory: string | null;
  taxId: string | null;
  type: string | null;
};

export type PartyContactSummary = {
  displayName: string | null;
  email: string | null;
  name: string | null;
  phone: string | null;
};

export type PartyAddressSummary = {
  addressDisplay: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  country: string | null;
  county: string | null;
  name: string | null;
  pincode: string | null;
  state: string | null;
};

export type PartyRecentAddress = {
  addressDisplay: string | null;
  name: string | null;
};

export type SavePartyPayload = {
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressType?: string | null;
  city?: string | null;
  contactName?: string | null;
  country?: string | null;
  county?: string | null;
  defaultCurrency?: string | null;
  defaultPriceList?: string | null;
  disabled?: boolean;
  email?: string | null;
  group?: string | null;
  mobileNo?: string | null;
  name: string;
  paymentTerms?: string | null;
  pincode?: string | null;
  remarks?: string | null;
  state?: string | null;
  taxCategory?: string | null;
  taxId?: string | null;
  type?: string | null;
};

export type UomSummary = {
  businessSelectable: boolean;
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
  account: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  company: string;
  customer: string | null;
  defaultInTransitWarehouse: string | null;
  disabled: boolean;
  emailId: string | null;
  isGroup: boolean;
  isRejectedWarehouse: boolean;
  modified: string | null;
  mobileNo: string | null;
  name: string;
  parentWarehouse: string | null;
  phoneNo: string | null;
  pin: string | null;
  state: string | null;
  warehouseName: string;
  warehouseType: string | null;
};

export type SaveUomPayload = {
  businessSelectable?: boolean;
  description?: string | null;
  enabled?: boolean;
  mustBeWholeNumber?: boolean;
  symbol?: string | null;
  uomName: string;
};

export type SaveWarehousePayload = {
  account?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  company: string;
  customer?: string | null;
  defaultInTransitWarehouse?: string | null;
  disabled?: boolean;
  emailId?: string | null;
  isGroup?: boolean;
  isRejectedWarehouse?: boolean;
  mobileNo?: string | null;
  parentWarehouse?: string | null;
  phoneNo?: string | null;
  pin?: string | null;
  state?: string | null;
  warehouseName: string;
  warehouseType?: string | null;
};

export type LinkOption = {
  description: string | null;
  label: string;
  value: string;
};

export type LinkOptionFilters = Record<
  string,
  string | number | boolean | null | undefined
>;

function mapProduct(row: Record<string, any>): ProductSummary {
  const allUoms = mapUomNames(row.all_uoms);
  const permissions = readObject(row.permissions);
  const stockUom = String(row.stock_uom ?? row.uom ?? '');

  return {
    allUomDisplays: mapUomDisplays(row.all_uoms),
    allUoms,
    barcode: String(row.barcode ?? ''),
    barcodes: mapProductBarcodes(row.barcodes, row.barcode),
    brand: String(row.brand ?? ''),
    canWrite: Boolean(permissions.can_write),
    description: String(row.description ?? ''),
    disabled: Boolean(row.disabled),
    imageUrl: resolveMediaUrl(
      typeof row.image === 'string'
        ? row.image
        : typeof row.image_url === 'string'
          ? row.image_url
          : '',
      { version: typeof row.modified === 'string' ? row.modified : null },
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

function mapProductUomMigrationAssessment(
  value: unknown,
): ProductUomMigrationAssessment {
  const row = readObject(value);
  const source = readObject(row.source);
  const inventory = readObject(row.inventory);
  const history = readObject(row.history);
  const latestStockLedgerEntry = readObject(history.latest_stock_ledger_entry);
  const openTransactions = readObject(row.open_transactions);
  const committedBinFields = [
    'reserved_qty',
    'reserved_stock',
    'reserved_qty_for_production',
    'reserved_qty_for_sub_contract',
    'reserved_qty_for_production_plan',
    'ordered_qty',
    'planned_qty',
    'indented_qty',
  ];
  const mapIssues = (input: unknown) =>
    (Array.isArray(input) ? input : [])
      .map((entry): ProductUomMigrationIssue | null => {
        const issue = readObject(entry);
        const code = toOptionalText(issue.code);
        const issueMessage = toOptionalText(issue.message);
        return code && issueMessage ? { code, message: issueMessage } : null;
      })
      .filter((entry): entry is ProductUomMigrationIssue => Boolean(entry));

  return {
    alternatives: (Array.isArray(row.alternatives) ? row.alternatives : [])
      .map((entry) => {
        const alternative = readObject(entry);
        const name = toOptionalText(alternative.name);
        const alternativeItemCode = toOptionalText(
          alternative.alternative_item_code,
        );
        return name && alternativeItemCode
          ? {
              alternativeItemCode,
              name,
              twoWay: Boolean(alternative.two_way),
            }
          : null;
      })
      .filter(
        (
          entry,
        ): entry is ProductUomMigrationAssessment['alternatives'][number] =>
          Boolean(entry),
      ),
    barcodes: mapProductBarcodes(row.barcodes, null),
    blockers: mapIssues(row.blockers),
    canExecute: Boolean(row.can_execute),
    canExecuteWithInventoryConversion: Boolean(
      row.can_execute_with_inventory_conversion,
    ),
    history: {
      latestStockLedgerEntry: Object.keys(latestStockLedgerEntry).length
        ? {
            postingDate:
              toOptionalText(latestStockLedgerEntry.posting_date) ?? null,
            postingTime:
              toOptionalText(latestStockLedgerEntry.posting_time) ?? null,
            voucherNo:
              toOptionalText(latestStockLedgerEntry.voucher_no) ?? null,
            voucherType:
              toOptionalText(latestStockLedgerEntry.voucher_type) ?? null,
          }
        : null,
      stockLedgerEntryCount: Number(history.stock_ledger_entry_count ?? 0),
    },
    inventory: {
      bins: (Array.isArray(inventory.bins) ? inventory.bins : [])
        .map(
          (
            entry,
          ):
            | ProductUomMigrationAssessment['inventory']['bins'][number]
            | null => {
            const bin = readObject(entry);
            const warehouse = toOptionalText(bin.warehouse);
            if (!warehouse) return null;
            return {
              actualQty: toOptionalNumber(bin.actual_qty),
              committedQty: committedBinFields.reduce(
                (total, fieldname) =>
                  total + Math.abs(toOptionalNumber(bin[fieldname]) ?? 0),
                0,
              ),
              company: toOptionalText(bin.company) ?? '',
              projectedQty: toOptionalNumber(bin.projected_qty),
              warehouse,
            };
          },
        )
        .filter(
          (
            entry,
          ): entry is ProductUomMigrationAssessment['inventory']['bins'][number] =>
            Boolean(entry),
        ),
      totalActualQty: toOptionalNumber(inventory.total_actual_qty),
      totalCommittedQty: toOptionalNumber(inventory.total_committed_qty),
    },
    openTransactions: {
      purchaseOrderCount: Number(openTransactions.purchase_order_count ?? 0),
      salesOrderCount: Number(openTransactions.sales_order_count ?? 0),
    },
    prices: (Array.isArray(row.prices) ? row.prices : [])
      .map((entry): ProductUomMigrationPrice | null => {
        const price = readObject(entry);
        const name = toOptionalText(price.name);
        const priceList = toOptionalText(price.price_list);
        if (!name || !priceList) return null;
        return {
          currency: toOptionalText(price.currency) ?? '',
          name,
          priceList,
          rate: toOptionalNumber(price.rate),
          uom: toOptionalText(price.uom),
        };
      })
      .filter((entry): entry is ProductUomMigrationPrice => Boolean(entry)),
    recommendedStrategy:
      row.recommended_strategy === 'in_place' ||
      row.recommended_strategy === 'replacement'
        ? row.recommended_strategy
        : null,
    strategies: {
      inPlace: {
        available: Boolean(
          readObject(readObject(row.strategies).in_place).available,
        ),
        reason:
          toOptionalText(
            readObject(readObject(row.strategies).in_place).reason,
          ) ?? '',
      },
      replacement: {
        available: Boolean(
          readObject(readObject(row.strategies).replacement).available,
        ),
        reason:
          toOptionalText(
            readObject(readObject(row.strategies).replacement).reason,
          ) ?? '',
      },
    },
    suggestedNewItemCode: toOptionalText(row.suggested_new_item_code) ?? '',
    source: {
      disabled: Boolean(source.disabled),
      itemCode: toOptionalText(source.item_code) ?? '',
      itemName: toOptionalText(source.item_name) ?? '',
      modified: toOptionalText(source.modified) ?? '',
      retailDefaultUom: toOptionalText(source.retail_default_uom) ?? null,
      stockUom: toOptionalText(source.stock_uom) ?? '',
      stockUomDisplay: toOptionalText(source.stock_uom_display) ?? null,
      uomConversions: mapUomConversions(source.uom_conversions),
      wholesaleDefaultUom: toOptionalText(source.wholesale_default_uom) ?? null,
    },
    warnings: mapIssues(row.warnings),
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
      const uom = toOptionalText(row.uom);
      return {
        barcode,
        idx: Number(row.idx ?? index + 1),
        isPrimary:
          row.is_primary === true ||
          Number(row.is_primary ?? 0) === 1 ||
          barcode === primaryText,
        name: toOptionalText(row.name) ?? null,
        ...(uom ? { uom } : {}),
      };
    })
    .filter((entry): entry is ProductBarcode => Boolean(entry));

  if (!mapped.length && primaryText) {
    return [
      {
        barcode: primaryText,
        idx: 1,
        isPrimary: true,
        name: null,
      },
    ];
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

  return sortUomsByBusinessPriority(
    value
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
      .filter(Boolean),
    (uom) => uom,
  );
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

  return sortUomsByBusinessPriority(
    value
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
      .filter((entry): entry is ProductSummary['uomConversions'][number] =>
        Boolean(entry),
      ),
    (entry) => entry.uom,
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
      const uom = toOptionalText(row.uom);
      return {
        currency: String(row.currency ?? ''),
        priceList,
        rate: toOptionalNumber(row.rate ?? row.price_list_rate),
        ...(uom ? { uom } : {}),
      };
    })
    .filter((entry): entry is ProductPriceEntry => Boolean(entry));
}

function mapProductPriceRecord(value: unknown): ProductPriceRecord | null {
  const row = readObject(value);
  const name = toOptionalText(row.name);
  const priceList = toOptionalText(row.price_list);
  if (!name || !priceList) return null;
  const priceListType =
    row.price_list_type === 'buying' || row.price_list_type === 'both'
      ? row.price_list_type
      : 'selling';
  return {
    currency: toOptionalText(row.currency) ?? '',
    modified: toOptionalText(row.modified) ?? null,
    name,
    priceList,
    priceListType,
    rate: toOptionalNumber(row.rate ?? row.price_list_rate),
    uom: toOptionalText(row.uom),
    validFrom: toOptionalText(row.valid_from) ?? null,
    validUpto: toOptionalText(row.valid_upto) ?? null,
  };
}

function mapProductPriceCollection(value: unknown): ProductPriceCollection {
  const row = readObject(value);
  const permissions = readObject(row.permissions);
  return {
    canCreate: Boolean(permissions.can_create),
    canWrite: Boolean(permissions.can_write),
    itemCode: toOptionalText(row.item_code) ?? '',
    itemModified: toOptionalText(row.item_modified) ?? null,
    priceLists: (Array.isArray(row.price_lists) ? row.price_lists : [])
      .map((entry): ProductPriceListOption | null => {
        const priceList = readObject(entry);
        const name = toOptionalText(priceList.name);
        if (!name) return null;
        return {
          buying: Boolean(Number(priceList.buying ?? 0)),
          currency: toOptionalText(priceList.currency) ?? null,
          name,
          selling: Boolean(Number(priceList.selling ?? 0)),
        };
      })
      .filter((entry): entry is ProductPriceListOption => Boolean(entry)),
    prices: (Array.isArray(row.prices) ? row.prices : [])
      .map(mapProductPriceRecord)
      .filter((entry): entry is ProductPriceRecord => Boolean(entry)),
  };
}

function mapProductChangeHistory(value: unknown): ProductChangeHistory {
  const row = readObject(value);
  const pagination = readObject(row.pagination);
  const categories = new Set([
    'product',
    'price',
    'barcode',
    'uom',
    'valuation',
  ]);
  const actions = new Set(['created', 'updated', 'terminated', 'corrected']);
  return {
    events: (Array.isArray(row.events) ? row.events : []).map((entry) => {
      const event = readObject(entry);
      const category = String(event.category ?? 'product');
      const action = String(event.action ?? 'updated');
      return {
        action: (actions.has(action)
          ? action
          : 'updated') as ProductChangeHistoryEvent['action'],
        actor: toOptionalText(event.actor) ?? null,
        category: (categories.has(category)
          ? category
          : 'product') as ProductChangeHistoryEvent['category'],
        changes: (Array.isArray(event.changes) ? event.changes : []).map(
          (change) => {
            const changeRow = readObject(change);
            const rowAction =
              changeRow.row_action === 'added' ||
              changeRow.row_action === 'removed'
                ? changeRow.row_action
                : null;
            return {
              field: toOptionalText(changeRow.field) ?? '',
              label: toOptionalText(changeRow.label) ?? '',
              newValue: changeRow.new_value,
              oldValue: changeRow.old_value,
              rowAction,
            };
          },
        ),
        id: toOptionalText(event.id) ?? '',
        occurredAt: toOptionalText(event.occurred_at) ?? '',
        sourceDoctype: toOptionalText(event.source_doctype) ?? '',
        sourceName: toOptionalText(event.source_name) ?? '',
        summary: toOptionalText(event.summary) ?? '',
        title: toOptionalText(event.title) ?? '商品变更',
      };
    }),
    hasMore: Boolean(pagination.has_more),
    itemCode: toOptionalText(row.item_code) ?? '',
    limit: toOptionalNumber(pagination.limit) ?? 50,
    start: toOptionalNumber(pagination.start) ?? 0,
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
        priceList: typeof row.price_list === 'string' ? row.price_list : null,
      };
    })
    .filter((entry): entry is ProductSummary['salesProfiles'][number] =>
      Boolean(entry),
    );
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function mapPartyContact(raw: unknown): PartyContactSummary | null {
  const row = readObject(raw);
  if (!Object.keys(row).length) {
    return null;
  }
  return {
    displayName: optionalString(row.display_name),
    email: optionalString(row.email),
    name: optionalString(row.name),
    phone: optionalString(row.phone),
  };
}

function mapPartyAddress(raw: unknown): PartyAddressSummary | null {
  const row = readObject(raw);
  if (!Object.keys(row).length) {
    return null;
  }
  return {
    addressDisplay: optionalString(row.address_display),
    addressLine1: optionalString(row.address_line1),
    addressLine2: optionalString(row.address_line2),
    city: optionalString(row.city),
    country: optionalString(row.country),
    county: optionalString(row.county),
    name: optionalString(row.name),
    pincode: optionalString(row.pincode),
    state: optionalString(row.state),
  };
}

function mapRecentAddresses(value: unknown): PartyRecentAddress[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      const row = readObject(entry);
      return {
        addressDisplay: optionalString(row.address_display),
        name: optionalString(row.name),
      };
    })
    .filter((entry) => entry.name || entry.addressDisplay);
}

function mapCustomer(row: Record<string, any>): PartySummary {
  const defaultContact = mapPartyContact(row.default_contact);
  const defaultAddress = mapPartyAddress(row.default_address);
  return {
    creation: optionalString(row.creation),
    defaultAddress,
    defaultContact,
    defaultCurrency: optionalString(row.default_currency),
    defaultPriceList: optionalString(row.default_price_list),
    disabled: Boolean(toOptionalNumber(row.disabled)),
    displayName: String(
      row.customer_name ?? row.display_name ?? row.name ?? '',
    ),
    email: optionalString(row.email_id) ?? defaultContact?.email ?? null,
    group: optionalString(row.customer_group),
    mobileNo: optionalString(row.mobile_no) ?? defaultContact?.phone ?? null,
    modified: optionalString(row.modified),
    name: String(row.customer ?? row.name ?? ''),
    paymentTerms: optionalString(row.payment_terms),
    recentAddresses: mapRecentAddresses(row.recent_addresses),
    remarks: optionalString(row.remarks),
    taxCategory: optionalString(row.tax_category),
    taxId: optionalString(row.tax_id),
    type: optionalString(row.customer_type),
  };
}

function mapSupplier(row: Record<string, any>): PartySummary {
  const defaultContact = mapPartyContact(row.default_contact);
  const defaultAddress = mapPartyAddress(row.default_address);
  return {
    creation: optionalString(row.creation),
    defaultAddress,
    defaultContact,
    defaultCurrency: optionalString(row.default_currency),
    defaultPriceList: optionalString(row.default_price_list),
    disabled: Boolean(toOptionalNumber(row.disabled)),
    displayName: String(
      row.supplier_name ?? row.display_name ?? row.name ?? '',
    ),
    email: optionalString(row.email_id) ?? defaultContact?.email ?? null,
    group: optionalString(row.supplier_group),
    mobileNo: optionalString(row.mobile_no) ?? defaultContact?.phone ?? null,
    modified: optionalString(row.modified),
    name: String(row.supplier ?? row.name ?? ''),
    paymentTerms: optionalString(row.payment_terms),
    recentAddresses: mapRecentAddresses(row.recent_addresses),
    remarks: optionalString(row.remarks),
    taxCategory: optionalString(row.tax_category),
    taxId: optionalString(row.tax_id),
    type: optionalString(row.supplier_type),
  };
}

function mapUom(row: Record<string, any>): UomSummary {
  const hasEnabled = row.enabled !== undefined && row.enabled !== null;
  const enabled = hasEnabled ? Boolean(Number(row.enabled)) : !row.disabled;
  const name = String(row.name ?? row.uom_name ?? '');
  const uomName = String(row.uom_name ?? row.name ?? '');
  const displayName =
    typeof row.display_name === 'string' && row.display_name.trim()
      ? row.display_name
      : uomName || name;

  return {
    businessSelectable: Boolean(toOptionalNumber(row.business_selectable)),
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
    account:
      typeof row.account === 'string' && row.account.trim()
        ? row.account
        : null,
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
    customer:
      typeof row.customer === 'string' && row.customer.trim()
        ? row.customer
        : null,
    defaultInTransitWarehouse:
      typeof row.default_in_transit_warehouse === 'string' &&
      row.default_in_transit_warehouse.trim()
        ? row.default_in_transit_warehouse
        : null,
    disabled: Boolean(toOptionalNumber(row.disabled)),
    emailId:
      typeof row.email_id === 'string' && row.email_id.trim()
        ? row.email_id
        : null,
    isGroup: Boolean(toOptionalNumber(row.is_group)),
    isRejectedWarehouse: Boolean(toOptionalNumber(row.is_rejected_warehouse)),
    modified: typeof row.modified === 'string' ? row.modified : null,
    mobileNo:
      typeof row.mobile_no === 'string' && row.mobile_no.trim()
        ? row.mobile_no
        : null,
    name: String(row.name ?? ''),
    parentWarehouse:
      typeof row.parent_warehouse === 'string' && row.parent_warehouse.trim()
        ? row.parent_warehouse
        : null,
    pin: typeof row.pin === 'string' && row.pin.trim() ? row.pin : null,
    phoneNo:
      typeof row.phone_no === 'string' && row.phone_no.trim()
        ? row.phone_no
        : null,
    state: typeof row.state === 'string' && row.state.trim() ? row.state : null,
    warehouseName: String(row.warehouse_name ?? row.name ?? ''),
    warehouseType:
      typeof row.warehouse_type === 'string' && row.warehouse_type.trim()
        ? row.warehouse_type
        : null,
  };
}

function pageResult<T>(
  raw: unknown,
  mapper: (row: Record<string, any>) => T,
): PageResult<T> {
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
    Object.entries(payload).filter(
      ([, value]) => value !== undefined && value !== null,
    ),
  ) as Partial<T>;
}

function buildPartyContactPayload(payload: SavePartyPayload) {
  const contactPayload = compactPayload({
    display_name:
      toOptionalText(payload.contactName) ?? toOptionalText(payload.name),
    email: toOptionalText(payload.email),
    phone: toOptionalText(payload.mobileNo),
  });
  return Object.keys(contactPayload).length ? contactPayload : undefined;
}

function buildPartyAddressPayload(payload: SavePartyPayload) {
  const addressPayload = compactPayload({
    address_line1: toOptionalText(payload.addressLine1),
    address_line2: toOptionalText(payload.addressLine2),
    address_type: toOptionalText(payload.addressType),
    city: toOptionalText(payload.city),
    country: toOptionalText(payload.country),
    county: toOptionalText(payload.county),
    pincode: toOptionalText(payload.pincode),
    state: toOptionalText(payload.state),
  });
  return Object.keys(addressPayload).length ? addressPayload : undefined;
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
      sort_by: options.sortBy,
      sort_order: options.sortOrder,
      start: options.start ?? 0,
      warehouse: toOptionalText(options.warehouse),
    }),
  );
  return pageResult(result.data, mapProduct);
}

export async function searchProducts(options: ProductListOptions = {}) {
  const result = await callGatewayMethod<unknown>(
    'search_product_v2',
    definedPayload({
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
      search_key:
        typeof options.searchKey === 'string' ? options.searchKey.trim() : '',
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

export async function listProductPrices(itemCode: string) {
  const result = await callGatewayMethod<unknown>('list_product_prices_v1', {
    item_code: itemCode,
  });
  return mapProductPriceCollection(result.data);
}

export async function listProductChangeHistory(
  itemCode: string,
  options: Pick<ListOptions, 'limit' | 'start'> = {},
) {
  const result = await callGatewayMethod<unknown>(
    'list_product_change_history_v1',
    {
      item_code: itemCode,
      limit: options.limit ?? 100,
      start: options.start ?? 0,
    },
  );
  return mapProductChangeHistory(result.data);
}

export async function saveProductPrice(payload: SaveProductPricePayload) {
  return runGatewayMutation<ProductPriceRecord>('upsert_product_price_v1', {
    payload: definedPayload({
      currency: toOptionalText(payload.currency),
      item_code: payload.itemCode,
      item_modified: toOptionalText(payload.itemModified),
      price_list: payload.priceList,
      price_modified: toOptionalText(payload.priceModified),
      price_name: toOptionalText(payload.priceName),
      rate: payload.rate,
      uom: payload.uom,
      valid_from: toOptionalText(payload.validFrom),
      valid_upto: toOptionalText(payload.validUpto),
    }),
    successMessage: payload.priceName ? '价格已更新' : '价格已新增',
    transform: (raw) => mapProductPriceRecord(raw) as ProductPriceRecord,
  });
}

export async function terminateProductPrice(
  itemCode: string,
  price: Pick<ProductPriceRecord, 'modified' | 'name'>,
  validUpto?: string | null,
) {
  return runGatewayMutation<ProductPriceRecord>('terminate_product_price_v1', {
    payload: definedPayload({
      item_code: itemCode,
      price_modified: toOptionalText(price.modified),
      price_name: price.name,
      valid_upto: toOptionalText(validUpto),
    }),
    successMessage: '价格已终止',
    transform: (raw) => mapProductPriceRecord(raw) as ProductPriceRecord,
  });
}

export async function assessProductUomMigration(itemCode: string) {
  const result = await callGatewayMethod<unknown>(
    'assess_product_uom_migration_v1',
    { item_code: itemCode },
  );
  return mapProductUomMigrationAssessment(result.data);
}

export async function resolveActiveProduct(
  itemCode: string,
): Promise<ActiveProductResolution> {
  const result = await callGatewayMethod<unknown>('resolve_active_product_v1', {
    item_code: itemCode,
  });
  const row = readObject(result.data);
  return {
    activeDisabled: Boolean(row.active_disabled),
    activeItemCode: toOptionalText(row.active_item_code) ?? itemCode,
    chain: (Array.isArray(row.chain) ? row.chain : []).map((entry) => {
      const chainRow = readObject(entry);
      return {
        source:
          chainRow.source === 'correction_record'
            ? 'correction_record'
            : 'legacy_item_alternative',
        sourceItem: toOptionalText(chainRow.source_item) ?? '',
        targetItem: toOptionalText(chainRow.target_item) ?? '',
      };
    }),
    changed: Boolean(row.changed),
    requestedItemCode: toOptionalText(row.requested_item_code) ?? itemCode,
    requiresConfirmation: Boolean(row.requires_confirmation),
    resolutionSource:
      row.resolution_source === 'correction_record' ||
      row.resolution_source === 'legacy_item_alternative'
        ? row.resolution_source
        : null,
  };
}

export async function executeProductUomMigration(
  payload: ExecuteProductUomMigrationPayload,
) {
  return runGatewayMutation<{
    alternative: {
      alternativeItemCode: string;
      itemCode: string;
      name: string;
    };
    copiedPriceNames: string[];
    createdPriceNames: string[];
    historyPreserved: boolean;
    movedBarcodes: string[];
    newItem: ProductSummary;
    repackEntries: {
      company: string;
      name: string;
      sourceQty: number;
      targetQty: number;
      warehouse: string;
    }[];
    sourceDisabled: boolean;
    sourceItemCode: string;
  }>('execute_product_uom_migration_v1', {
    payload: definedPayload({
      barcode_mappings: payload.barcodeMappings.map((mapping) => ({
        action: mapping.action,
        source_name: mapping.sourceName,
        target_uom: toOptionalText(mapping.targetUom),
      })),
      confirm_disable_source: payload.confirmDisableSource ? 1 : 0,
      confirm_history_preserved: payload.confirmHistoryPreserved ? 1 : 0,
      confirm_in_place_correction: payload.confirmInPlaceCorrection ? 1 : 0,
      confirm_inventory_conversion: payload.confirmInventoryConversion ? 1 : 0,
      correction_reason: toOptionalText(payload.correctionReason),
      item_code: payload.itemCode,
      inventory_mappings: (payload.inventoryMappings ?? []).map((mapping) => ({
        source_qty: mapping.sourceQty,
        target_qty: mapping.targetQty,
        warehouse: mapping.warehouse,
      })),
      new_item_code: payload.newItemCode,
      new_item_name: toOptionalText(payload.newItemName),
      new_prices: (payload.newPrices ?? []).map((price) => ({
        currency: toOptionalText(price.currency),
        price_list: price.priceList,
        rate: price.rate,
        target_uom: price.targetUom,
      })),
      price_mappings: payload.priceMappings.map((mapping) =>
        definedPayload({
          action: mapping.action,
          source_name: mapping.sourceName,
          target_rate: mapping.targetRate ?? undefined,
          target_uom: toOptionalText(mapping.targetUom),
        }),
      ),
      retail_default_uom: toOptionalText(payload.retailDefaultUom),
      source_modified: payload.sourceModified,
      stock_uom: payload.stockUom,
      strategy: payload.strategy,
      uom_conversions: payload.uomConversions
        .map((entry) => ({
          conversion_factor: entry.conversionFactor ?? undefined,
          uom: toOptionalText(entry.uom),
        }))
        .filter((entry) => entry.uom),
      wholesale_default_uom: toOptionalText(payload.wholesaleDefaultUom),
    }),
    successMessage: '商品单位纠正已完成',
    transform: (raw) => {
      const row = readObject(raw);
      const alternative = readObject(row.alternative);
      return {
        alternative: {
          alternativeItemCode:
            toOptionalText(alternative.alternative_item_code) ?? '',
          itemCode: toOptionalText(alternative.item_code) ?? '',
          name: toOptionalText(alternative.name) ?? '',
        },
        copiedPriceNames: Array.isArray(row.copied_price_names)
          ? row.copied_price_names
              .map((value) => toOptionalText(value))
              .filter((value): value is string => Boolean(value))
          : [],
        createdPriceNames: Array.isArray(row.created_price_names)
          ? row.created_price_names
              .map((value) => toOptionalText(value))
              .filter((value): value is string => Boolean(value))
          : [],
        historyPreserved: Boolean(row.history_preserved),
        movedBarcodes: Array.isArray(row.moved_barcodes)
          ? row.moved_barcodes
              .map((value) => toOptionalText(value))
              .filter((value): value is string => Boolean(value))
          : [],
        newItem: mapProduct(readObject(row.new_item)),
        repackEntries: (Array.isArray(row.repack_entries)
          ? row.repack_entries
          : []
        ).map((entry) => {
          const repack = readObject(entry);
          return {
            company: toOptionalText(repack.company) ?? '',
            name: toOptionalText(repack.name) ?? '',
            sourceQty: toOptionalNumber(repack.source_qty) ?? 0,
            targetQty: toOptionalNumber(repack.target_qty) ?? 0,
            warehouse: toOptionalText(repack.warehouse) ?? '',
          };
        }),
        sourceDisabled: Boolean(row.source_disabled),
        sourceItemCode: toOptionalText(row.source_item_code) ?? '',
      };
    },
  });
}

function productSavePayload(
  payload: UpdateProductPayload,
  options: { includeEmptyFields?: boolean } = {},
) {
  type PricePayloadEntry = {
    currency: string | undefined;
    price_list: string;
    rate: number;
    uom: string | undefined;
  };
  const hasOwn = (key: keyof SaveProductPayload) => Object.hasOwn(payload, key);
  const optionalTextField = (key: keyof SaveProductPayload) => {
    if (!options.includeEmptyFields && !hasOwn(key)) {
      return undefined;
    }
    return payload[key] ?? '';
  };

  const sellingPrices = [
    payload.standardSellingRate === undefined ||
    payload.standardSellingRate === null
      ? null
      : {
          currency: toOptionalText(payload.currency),
          price_list: 'Standard Selling',
          rate: payload.standardSellingRate,
          uom: toOptionalText(payload.stockUom),
        },
    payload.wholesaleRate === undefined || payload.wholesaleRate === null
      ? null
      : {
          currency: toOptionalText(payload.currency),
          price_list: 'Wholesale',
          rate: payload.wholesaleRate,
          uom: toOptionalText(payload.wholesaleDefaultUom ?? payload.stockUom),
        },
    payload.retailRate === undefined || payload.retailRate === null
      ? null
      : {
          currency: toOptionalText(payload.currency),
          price_list: 'Retail',
          rate: payload.retailRate,
          uom: toOptionalText(payload.retailDefaultUom ?? payload.stockUom),
        },
  ].filter((entry): entry is PricePayloadEntry => Boolean(entry));
  const buyingPrices =
    payload.standardBuyingRate === undefined ||
    payload.standardBuyingRate === null
      ? undefined
      : [
          {
            currency: toOptionalText(payload.currency),
            price_list: 'Standard Buying',
            rate: payload.standardBuyingRate,
            uom: toOptionalText(payload.stockUom),
          },
        ];
  const stockUom = toOptionalText(payload.stockUom);
  const uomConversions = payload.uomConversions
    ?.map((entry) => ({
      conversion_factor: entry.conversionFactor ?? undefined,
      uom: toOptionalText(entry.uom),
    }))
    .filter((entry) => entry.uom);

  return definedPayload({
    barcode: optionalTextField('barcode'),
    brand: optionalTextField('brand'),
    company: toOptionalText(payload.company),
    currency: optionalTextField('currency'),
    description: optionalTextField('description'),
    disabled:
      payload.disabled === undefined ? undefined : payload.disabled ? 1 : 0,
    image: payload.image === undefined ? undefined : payload.image,
    item_group: optionalTextField('itemGroup'),
    item_name: payload.itemName,
    posting_date: toOptionalText(payload.postingDate),
    retail_default_uom:
      options.includeEmptyFields || hasOwn('retailDefaultUom')
        ? (payload.retailDefaultUom ?? stockUom ?? '')
        : undefined,
    selling_prices: sellingPrices.length ? sellingPrices : undefined,
    standard_rate: payload.standardSellingRate ?? undefined,
    stock_uom: stockUom,
    uom_conversions:
      uomConversions ??
      (options.includeEmptyFields && stockUom
        ? [{ conversion_factor: 1, uom: stockUom }]
        : undefined),
    valuation_rate: payload.valuationRate ?? undefined,
    warehouse: toOptionalText(payload.warehouse),
    warehouse_stock_qty: payload.warehouseStockQty ?? undefined,
    warehouse_stock_uom: toOptionalText(payload.warehouseStockUom),
    wholesale_default_uom:
      options.includeEmptyFields || hasOwn('wholesaleDefaultUom')
        ? (payload.wholesaleDefaultUom ?? stockUom ?? '')
        : undefined,
    buying_prices: buyingPrices,
  });
}

type ProductMutationOptions = {
  idempotencyKey?: string;
  notifyError?: boolean;
  notifySuccess?: boolean;
};

export async function createProduct(
  payload: SaveProductPayload,
  options: ProductMutationOptions = {},
) {
  return runGatewayMutation<ProductSummary>('create_product_v2', {
    idempotencyKey: options.idempotencyKey,
    notifyError: options.notifyError,
    payload: definedPayload({
      ...productSavePayload(payload, { includeEmptyFields: true }),
      item_code: payload.itemCode ?? undefined,
    }),
    successMessage: options.notifySuccess === false ? undefined : '商品已创建',
    transform: (raw) => mapProduct(readObject(raw)),
  });
}

export async function createProductAndStock(
  payload: CreateProductAndStockPayload,
) {
  return runGatewayMutation<ProductSummary>('create_product_and_stock', {
    payload: definedPayload({
      default_warehouse: toOptionalText(payload.defaultWarehouse),
      description: toOptionalText(payload.description),
      item_name: payload.itemName,
      nickname: toOptionalText(payload.nickname),
      opening_qty: payload.openingQty ?? 0,
      opening_uom: toOptionalText(payload.openingUom),
      standard_rate: payload.standardRate ?? undefined,
      stock_uom: toOptionalText(payload.stockUom),
      uom_conversions: payload.uomConversions
        ?.map((entry) => ({
          conversion_factor: entry.conversionFactor ?? undefined,
          uom: toOptionalText(entry.uom),
        }))
        .filter((entry) => entry.uom),
    }),
    successMessage: '商品已创建并入库',
    transform: (raw) => mapProduct(readObject(raw)),
  });
}

export async function updateProduct(
  itemCode: string,
  payload: UpdateProductPayload,
  options: ProductMutationOptions = {},
) {
  return runGatewayMutation<ProductSummary>('update_product_v2', {
    idempotencyKey: options.idempotencyKey,
    notifyError: options.notifyError,
    payload: definedPayload({
      ...productSavePayload(payload),
      item_code: itemCode,
      item_modified: toOptionalText(payload.itemModified),
    }),
    successMessage: options.notifySuccess === false ? undefined : '商品已更新',
    transform: (raw) => mapProduct(readObject(raw)),
  });
}

export async function setProductDisabled(
  itemCode: string,
  disabled: boolean,
  itemModified?: string | null,
  options: ProductMutationOptions = {},
) {
  return runGatewayMutation<ProductSummary>('disable_product_v2', {
    idempotencyKey: options.idempotencyKey,
    notifyError: options.notifyError,
    payload: compactPayload({
      disabled: disabled ? 1 : 0,
      item_code: itemCode,
      item_modified: toOptionalText(itemModified),
    }),
    successMessage:
      options.notifySuccess === false
        ? undefined
        : disabled
          ? '商品已停用'
          : '商品已启用',
    transform: (raw) => mapProduct(readObject(raw)),
  });
}

export async function bulkSetProductsDisabled(
  targets: ProductBulkMutationTarget[],
  disabled: boolean,
): Promise<ProductBulkMutationResult> {
  const result: ProductBulkMutationResult = { failed: [], succeeded: [] };
  for (const target of targets) {
    try {
      const response = await setProductDisabled(
        target.itemCode,
        disabled,
        target.itemModified,
        { notifyError: false, notifySuccess: false },
      );
      result.succeeded.push(response.data);
    } catch (caught) {
      result.failed.push({
        error: caught instanceof Error ? caught.message : '操作失败',
        itemCode: target.itemCode,
      });
    }
  }
  return result;
}

export async function bulkUpdateProducts(
  targets: ProductBulkMutationTarget[],
  payload: UpdateProductPayload,
): Promise<ProductBulkMutationResult> {
  const result: ProductBulkMutationResult = { failed: [], succeeded: [] };
  for (const target of targets) {
    try {
      const response = await updateProduct(
        target.itemCode,
        {
          ...payload,
          itemModified: target.itemModified,
        },
        { notifyError: false, notifySuccess: false },
      );
      result.succeeded.push(response.data);
    } catch (caught) {
      result.failed.push({
        error: caught instanceof Error ? caught.message : '更新失败',
        itemCode: target.itemCode,
      });
    }
  }
  return result;
}

export async function addProductBarcode(
  itemCode: string,
  barcode: string,
  options: {
    itemModified?: string | null;
    setPrimary?: boolean;
    uom?: string | null;
  } = {},
) {
  return runGatewayMutation<ProductSummary>('add_product_barcode_v2', {
    payload: compactPayload({
      barcode,
      item_code: itemCode,
      item_modified: toOptionalText(options.itemModified),
      set_primary: options.setPrimary ? 1 : 0,
      uom: toOptionalText(options.uom),
    }),
    successMessage: '条码已新增',
    transform: (raw) => mapProduct(readObject(raw)),
  });
}

export async function setPrimaryProductBarcode(
  itemCode: string,
  barcode: string,
  options: { itemModified?: string | null } = {},
) {
  return runGatewayMutation<ProductSummary>('set_primary_product_barcode_v2', {
    payload: compactPayload({
      barcode,
      item_code: itemCode,
      item_modified: toOptionalText(options.itemModified),
    }),
    successMessage: '主条码已更新',
    transform: (raw) => mapProduct(readObject(raw)),
  });
}

export async function deleteProductBarcode(
  itemCode: string,
  barcode: string,
  options: { itemModified?: string | null } = {},
) {
  return runGatewayMutation<ProductSummary>('delete_product_barcode_v2', {
    payload: compactPayload({
      barcode,
      item_code: itemCode,
      item_modified: toOptionalText(options.itemModified),
    }),
    successMessage: '条码已删除',
    transform: (raw) => mapProduct(readObject(raw)),
  });
}

export async function listCustomers(options: ListOptions = {}) {
  const result = await callGatewayMethod<unknown>(
    'list_customers_v2',
    compactPayload({
      disabled: options.disabled,
      customer_group: toOptionalText(options.group),
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
      default_address: buildPartyAddressPayload(payload),
      default_contact: buildPartyContactPayload(payload),
      default_currency: toOptionalText(payload.defaultCurrency),
      default_price_list: toOptionalText(payload.defaultPriceList),
      disabled: payload.disabled ? 1 : 0,
      payment_terms: toOptionalText(payload.paymentTerms),
      remarks: payload.remarks ?? '',
      tax_category: toOptionalText(payload.taxCategory),
      tax_id: toOptionalText(payload.taxId),
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
      default_address: buildPartyAddressPayload(payload as SavePartyPayload),
      default_contact: buildPartyContactPayload(payload as SavePartyPayload),
      default_currency: payload.defaultCurrency ?? '',
      default_price_list: payload.defaultPriceList ?? '',
      disabled:
        payload.disabled === undefined ? undefined : payload.disabled ? 1 : 0,
      payment_terms: payload.paymentTerms ?? '',
      remarks: payload.remarks ?? '',
      tax_category: payload.taxCategory ?? '',
      tax_id: payload.taxId ?? '',
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
      supplier_group: toOptionalText(options.group),
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
      default_address: buildPartyAddressPayload(payload),
      default_contact: buildPartyContactPayload(payload),
      default_price_list: toOptionalText(payload.defaultPriceList),
      email_id: toOptionalText(payload.email),
      mobile_no: toOptionalText(payload.mobileNo),
      payment_terms: toOptionalText(payload.paymentTerms),
      remarks: payload.remarks ?? '',
      supplier_group: toOptionalText(payload.group),
      supplier_name: payload.name,
      supplier_type: toOptionalText(payload.type) ?? 'Company',
      tax_category: toOptionalText(payload.taxCategory),
      tax_id: toOptionalText(payload.taxId),
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
      disabled:
        payload.disabled === undefined ? undefined : payload.disabled ? 1 : 0,
      contact_email: payload.email ?? '',
      contact_phone: payload.mobileNo ?? '',
      default_address: buildPartyAddressPayload(payload as SavePartyPayload),
      default_contact: buildPartyContactPayload(payload as SavePartyPayload),
      default_price_list: payload.defaultPriceList ?? '',
      email_id: payload.email ?? '',
      mobile_no: payload.mobileNo ?? '',
      payment_terms: payload.paymentTerms ?? '',
      remarks: payload.remarks ?? '',
      supplier,
      supplier_group: payload.group ?? '',
      supplier_name: payload.name,
      supplier_type: payload.type ?? '',
      tax_category: payload.taxCategory ?? '',
      tax_id: payload.taxId ?? '',
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

export type UomListOptions = ListOptions & {
  businessSelectable?: boolean | 0 | 1;
};

export async function listUoms(options: UomListOptions = {}) {
  const enabled =
    options.enabled === undefined && options.disabled !== undefined
      ? options.disabled
        ? 0
        : 1
      : options.enabled;
  const result = await callGatewayMethod<unknown>(
    'list_uoms_v2',
    compactPayload({
      business_selectable:
        options.businessSelectable === undefined
          ? undefined
          : options.businessSelectable
            ? 1
            : 0,
      enabled,
      limit: options.limit ?? 80,
      search_key: toOptionalText(options.searchKey),
      start: options.start ?? 0,
    }),
  );
  const page = pageResult(result.data, mapUom);
  return {
    ...page,
    items: sortUomsByBusinessPriority(
      page.items,
      (uom) => uom.name,
      (uom) => uom.displayName,
    ),
  };
}

export async function createUom(payload: SaveUomPayload) {
  return runGatewayMutation<UomSummary>('create_uom_v2', {
    payload: compactPayload({
      business_selectable: payload.businessSelectable === false ? 0 : 1,
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
  if (payload.businessSelectable !== undefined) {
    updatePayload.business_selectable = payload.businessSelectable ? 1 : 0;
  }
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
  options: ListOptions & {
    company?: string;
    isGroup?: boolean | 0 | 1 | 'all';
  } = {},
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
      account: toOptionalText(payload.account),
      address_line_1: toOptionalText(payload.addressLine1),
      address_line_2: toOptionalText(payload.addressLine2),
      city: toOptionalText(payload.city),
      company: payload.company,
      customer: toOptionalText(payload.customer),
      default_in_transit_warehouse: toOptionalText(
        payload.defaultInTransitWarehouse,
      ),
      disabled: payload.disabled ? 1 : 0,
      email_id: toOptionalText(payload.emailId),
      is_group: payload.isGroup ? 1 : 0,
      is_rejected_warehouse: payload.isRejectedWarehouse ? 1 : 0,
      mobile_no: toOptionalText(payload.mobileNo),
      parent_warehouse: toOptionalText(payload.parentWarehouse),
      phone_no: toOptionalText(payload.phoneNo),
      pin: toOptionalText(payload.pin),
      state: toOptionalText(payload.state),
      warehouse_name: payload.warehouseName,
      warehouse_type: toOptionalText(payload.warehouseType),
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
  if (payload.account !== undefined) {
    updatePayload.account = payload.account ?? '';
  }
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
  if (payload.customer !== undefined) {
    updatePayload.customer = payload.customer ?? '';
  }
  if (payload.defaultInTransitWarehouse !== undefined) {
    updatePayload.default_in_transit_warehouse =
      payload.defaultInTransitWarehouse ?? '';
  }
  if (payload.disabled !== undefined) {
    updatePayload.disabled = payload.disabled ? 1 : 0;
  }
  if (payload.emailId !== undefined) {
    updatePayload.email_id = payload.emailId ?? '';
  }
  if (payload.isGroup !== undefined) {
    updatePayload.is_group = payload.isGroup ? 1 : 0;
  }
  if (payload.isRejectedWarehouse !== undefined) {
    updatePayload.is_rejected_warehouse = payload.isRejectedWarehouse ? 1 : 0;
  }
  if (payload.mobileNo !== undefined) {
    updatePayload.mobile_no = payload.mobileNo ?? '';
  }
  if (payload.parentWarehouse !== undefined) {
    updatePayload.parent_warehouse = payload.parentWarehouse ?? '';
  }
  if (payload.phoneNo !== undefined) {
    updatePayload.phone_no = payload.phoneNo ?? '';
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
  if (payload.warehouseType !== undefined) {
    updatePayload.warehouse_type = payload.warehouseType ?? '';
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
      description: typeof row.description === 'string' ? row.description : null,
      label: String(row.label ?? row.value ?? ''),
      value: String(row.value ?? row.label ?? ''),
    }))
    .filter((option) => option.value) satisfies LinkOption[];
}
