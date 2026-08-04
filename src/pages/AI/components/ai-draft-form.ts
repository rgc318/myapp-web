import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import type { AiDraft } from '@/services/myapp/ai';

export type AiDraftItemFormValues = {
  itemCode?: string;
  price?: number;
  qty?: number;
  uom?: string;
  warehouse?: string;
};

export type AiDraftFormValues = {
  adjustmentType?: 'set_target' | 'increase' | 'decrease';
  brand?: string;
  company?: string;
  currency?: string;
  defaultMode?: 'wholesale' | 'retail';
  description?: string;
  image?: string;
  itemCode?: string;
  itemGroup?: string;
  itemName?: string;
  items?: AiDraftItemFormValues[];
  openingQty?: number;
  party?: string;
  postingDate?: Dayjs;
  quantity?: number;
  reason?: string;
  remarks?: string;
  retailRate?: number;
  standardBuyingRate?: number;
  standardSellingRate?: number;
  stockUom?: string;
  supplierRef?: string;
  targetDate?: Dayjs;
  transactionDate?: Dayjs;
  uom?: string;
  warehouse?: string;
  wholesaleRate?: number;
};

export type AiDraftConflictField = {
  baseDisplay: string;
  key: keyof AiDraftFormValues;
  label: string;
  latestChanged: boolean;
  latestDisplay: string;
  localChanged: boolean;
  localDisplay: string;
};

export type AiDraftFormFieldIssue = {
  message: string;
  name:
    | keyof AiDraftFormValues
    | ['items', number, keyof AiDraftItemFormValues];
};

const FIELD_LABELS: Record<keyof AiDraftFormValues, string> = {
  adjustmentType: '调整方式',
  brand: '品牌',
  company: '公司',
  currency: '币种',
  defaultMode: '业务模式',
  description: '商品描述',
  image: '商品图片',
  itemCode: '商品编码',
  itemGroup: '商品分类',
  itemName: '商品名称',
  items: '商品明细',
  openingQty: '初始库存数量',
  party: '往来单位',
  postingDate: '过账日期',
  quantity: '数量',
  reason: '调整原因',
  remarks: '备注',
  retailRate: '零售价',
  standardBuyingRate: '成本价（默认采购价）',
  standardSellingRate: '标准售价（默认单价）',
  stockUom: '库存基准单位',
  supplierRef: '供应商参考号',
  targetDate: '交货/到货日期',
  transactionDate: '单据日期',
  uom: '单位',
  warehouse: '仓库',
  wholesaleRate: '批发价',
};

const PRODUCT_FIELDS: (keyof AiDraftFormValues)[] = [
  'company',
  'itemName',
  'itemCode',
  'image',
  'itemGroup',
  'brand',
  'stockUom',
  'currency',
  'standardSellingRate',
  'wholesaleRate',
  'retailRate',
  'standardBuyingRate',
  'openingQty',
  'warehouse',
  'description',
];

const INVENTORY_FIELDS: (keyof AiDraftFormValues)[] = [
  'company',
  'postingDate',
  'warehouse',
  'itemCode',
  'adjustmentType',
  'quantity',
  'uom',
  'reason',
];

const ORDER_FIELDS: (keyof AiDraftFormValues)[] = [
  'company',
  'party',
  'warehouse',
  'transactionDate',
  'targetDate',
  'defaultMode',
  'remarks',
  'items',
];

function readPayloadRow(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function textValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function dateValue(value: unknown): Dayjs | undefined {
  return typeof value === 'string' && value ? dayjs(value) : undefined;
}

function unresolvedQuery(
  payload: Record<string, unknown>,
  resolvedKey: string,
  queryKey: string,
): string | undefined {
  return textValue(payload[resolvedKey])
    ? undefined
    : textValue(payload[queryKey]);
}

function draftFields(
  draftType: AiDraft['draftType'],
): (keyof AiDraftFormValues)[] {
  if (draftType === 'product_setup') return PRODUCT_FIELDS;
  if (draftType === 'inventory_adjustment') return INVENTORY_FIELDS;
  return draftType === 'purchase_order'
    ? [
        ...ORDER_FIELDS.slice(0, 2),
        'currency',
        ...ORDER_FIELDS.slice(2, 3),
        'supplierRef',
        ...ORDER_FIELDS.slice(3),
      ]
    : ORDER_FIELDS;
}

function normalizeItem(item: AiDraftItemFormValues) {
  return {
    itemCode: item.itemCode || null,
    price: item.price ?? null,
    qty: item.qty ?? null,
    uom: item.uom || null,
    warehouse: item.warehouse || null,
  };
}

function normalizeValue(
  key: keyof AiDraftFormValues,
  value: AiDraftFormValues[keyof AiDraftFormValues],
) {
  if (key === 'items') {
    return Array.isArray(value)
      ? (value as AiDraftItemFormValues[]).map(normalizeItem)
      : [];
  }
  if (dayjs.isDayjs(value)) return value.format('YYYY-MM-DD');
  if (value === undefined || value === null || value === '') return null;
  return value;
}

function valuesEqual(
  key: keyof AiDraftFormValues,
  left: AiDraftFormValues[keyof AiDraftFormValues],
  right: AiDraftFormValues[keyof AiDraftFormValues],
) {
  return (
    JSON.stringify(normalizeValue(key, left)) ===
    JSON.stringify(normalizeValue(key, right))
  );
}

function displayItems(value: unknown) {
  if (!Array.isArray(value) || !value.length) return '无商品明细';
  return value
    .map((item, index) => {
      const row = readPayloadRow(item);
      const quantity = row.qty ?? '-';
      const unit = row.uom ? ` ${row.uom}` : '';
      const price =
        row.price === null || row.price === undefined ? '-' : row.price;
      const warehouse = row.warehouse ? ` · ${row.warehouse}` : '';
      return `${index + 1}. ${row.itemCode ?? '未选择商品'} × ${quantity}${unit} @ ${price}${warehouse}`;
    })
    .join('\n');
}

function displayValue(
  key: keyof AiDraftFormValues,
  value: AiDraftFormValues[keyof AiDraftFormValues],
) {
  const normalized = normalizeValue(key, value);
  if (key === 'items') return displayItems(normalized);
  if (normalized === null) return '未填写';
  if (key === 'defaultMode') return normalized === 'retail' ? '零售' : '批发';
  if (key === 'adjustmentType') {
    if (normalized === 'increase') return '增加库存';
    if (normalized === 'decrease') return '减少库存';
    return '调整到目标库存';
  }
  return String(normalized);
}

function cloneFieldValue(
  key: keyof AiDraftFormValues,
  value: AiDraftFormValues[keyof AiDraftFormValues],
) {
  if (key === 'items' && Array.isArray(value)) {
    return value.map((item) => ({ ...item }));
  }
  return value;
}

export function getAiDraftFormValues(draft: AiDraft): AiDraftFormValues {
  const payload = draft.payload;
  if (draft.draftType === 'product_setup') {
    return {
      brand: textValue(payload.brand),
      company: textValue(payload.company) ?? draft.company ?? undefined,
      currency: textValue(payload.currency) ?? 'CNY',
      description: textValue(payload.description),
      image: typeof payload.image === 'string' ? payload.image : undefined,
      itemCode: textValue(payload.item_code),
      itemGroup: textValue(payload.item_group),
      itemName: textValue(payload.item_name),
      openingQty: numberValue(payload.opening_qty),
      standardBuyingRate:
        numberValue(payload.standard_buying_rate) ??
        numberValue(payload.valuation_rate),
      retailRate: numberValue(payload.retail_rate),
      standardSellingRate: numberValue(payload.standard_selling_rate),
      stockUom: textValue(payload.stock_uom),
      warehouse: textValue(payload.warehouse),
      wholesaleRate: numberValue(payload.wholesale_rate),
    };
  }
  if (draft.draftType === 'inventory_adjustment') {
    const item = readPayloadRow(
      Array.isArray(payload.items) ? payload.items[0] : undefined,
    );
    const rawAdjustmentType = textValue(payload.adjustment_type);
    return {
      adjustmentType:
        rawAdjustmentType === 'increase' || rawAdjustmentType === 'decrease'
          ? rawAdjustmentType
          : 'set_target',
      company: textValue(payload.company) ?? draft.company ?? undefined,
      // item_query is only the AI's search text. Treating it as itemCode makes
      // an unresolved product look selected and lets required validation pass.
      itemCode: textValue(item.item_code),
      postingDate: dateValue(payload.posting_date),
      quantity: numberValue(item.qty),
      reason: textValue(payload.reason) ?? textValue(payload.remarks),
      uom: textValue(item.uom),
      warehouse: textValue(payload.warehouse),
    };
  }
  return {
    company: textValue(payload.company) ?? draft.company ?? undefined,
    defaultMode:
      (draft.draftType === 'purchase_order'
        ? textValue(payload.default_purchase_mode)
        : textValue(payload.default_sales_mode)) === 'retail'
        ? 'retail'
        : 'wholesale',
    items: Array.isArray(payload.items)
      ? payload.items.map((value) => {
          const row = readPayloadRow(value);
          return {
            itemCode: textValue(row.item_code),
            price: numberValue(row.price),
            qty: numberValue(row.qty),
            uom: textValue(row.uom),
            warehouse: textValue(row.warehouse),
          };
        })
      : [],
    party:
      draft.draftType === 'purchase_order'
        ? textValue(payload.supplier)
        : textValue(payload.customer),
    currency:
      draft.draftType === 'purchase_order'
        ? textValue(payload.currency)
        : undefined,
    remarks: textValue(payload.remarks),
    supplierRef:
      draft.draftType === 'purchase_order'
        ? textValue(payload.supplier_ref)
        : undefined,
    targetDate: dateValue(
      draft.draftType === 'purchase_order'
        ? payload.schedule_date
        : payload.delivery_date,
    ),
    transactionDate: dateValue(payload.transaction_date),
    warehouse: textValue(payload.warehouse),
  };
}

function matchingValidationError(
  draft: AiDraft,
  terms: string[],
): string | undefined {
  return draft.validation.errors.find((error) =>
    terms.some((term) => error.includes(term)),
  );
}

export function getAiDraftFormFieldIssues(
  draft: AiDraft,
): AiDraftFormFieldIssue[] {
  if (draft.validation.readyForHandoff) return [];

  if (draft.draftType === 'product_setup') {
    const payload = draft.payload;
    const issues: AiDraftFormFieldIssue[] = [];
    const mappings: Array<{
      name: keyof AiDraftFormValues;
      terms: string[];
    }> = [
      { name: 'itemName', terms: ['请填写商品名称'] },
      {
        name: 'itemCode',
        terms: ['未找到唯一的现有商品', '商品名称匹配到多条', '商品编码'],
      },
      { name: 'itemGroup', terms: ['商品分类'] },
      { name: 'brand', terms: ['品牌'] },
      { name: 'currency', terms: ['币种'] },
      { name: 'stockUom', terms: ['库存单位', '库存基准单位'] },
      { name: 'warehouse', terms: ['仓库'] },
      { name: 'openingQty', terms: ['初始库存', '当前库存作为初始库存'] },
      { name: 'standardSellingRate', terms: ['标准售价'] },
      { name: 'wholesaleRate', terms: ['批发价'] },
      { name: 'retailRate', terms: ['零售价'] },
      { name: 'standardBuyingRate', terms: ['成本价', '默认采购价'] },
    ];
    for (const mapping of mappings) {
      const error = matchingValidationError(draft, mapping.terms);
      if (error && !issues.some((issue) => issue.name === mapping.name)) {
        issues.push({ message: error, name: mapping.name });
      }
    }
    const itemGroupQuery = unresolvedQuery(
      payload,
      'item_group',
      'item_group_query',
    );
    if (itemGroupQuery) {
      const issue = issues.find((value) => value.name === 'itemGroup');
      if (issue) {
        issue.message = `“${itemGroupQuery}”尚未匹配到唯一商品分类，请从下拉结果中选择。`;
      }
    }
    const brandQuery = unresolvedQuery(payload, 'brand', 'brand_query');
    if (brandQuery) {
      const issue = issues.find((value) => value.name === 'brand');
      if (issue) {
        issue.message = `“${brandQuery}”尚未匹配到唯一品牌，请从下拉结果中选择。`;
      }
    }
    const warehouseQuery = unresolvedQuery(
      payload,
      'warehouse',
      'warehouse_query',
    );
    if (warehouseQuery) {
      const issue = issues.find((value) => value.name === 'warehouse');
      if (issue) {
        issue.message = `“${warehouseQuery}”尚未匹配到当前公司的可用仓库，请重新选择。`;
      }
    }
    return issues;
  }

  if (
    draft.draftType === 'sales_order' ||
    draft.draftType === 'purchase_order'
  ) {
    const payload = draft.payload;
    const issues: AiDraftFormFieldIssue[] = [];
    const isPurchase = draft.draftType === 'purchase_order';
    const party = textValue(payload[isPurchase ? 'supplier' : 'customer']);
    const partyQuery = textValue(
      payload[isPurchase ? 'supplier_query' : 'customer_query'],
    );
    if (!party) {
      issues.push({
        message: partyQuery
          ? `“${partyQuery}”尚未匹配到唯一${isPurchase ? '供应商' : '客户'}，请从下拉结果中选择。`
          : `请选择具体${isPurchase ? '供应商' : '客户'}。`,
        name: 'party',
      });
    }
    if (matchingValidationError(draft, ['日期'])) {
      const message = matchingValidationError(draft, ['日期']) as string;
      issues.push({ message, name: 'transactionDate' });
      issues.push({ message, name: 'targetDate' });
    }
    const defaultWarehouse = textValue(payload.warehouse);
    const defaultWarehouseQuery = unresolvedQuery(
      payload,
      'warehouse',
      'warehouse_query',
    );
    if (defaultWarehouseQuery) {
      issues.push({
        message: `“${defaultWarehouseQuery}”尚未匹配到当前公司的可用默认仓库，请重新选择或为每行选择仓库。`,
        name: 'warehouse',
      });
    }
    const rows = Array.isArray(payload.items) ? payload.items : [];
    rows.forEach((value, index) => {
      const row = readPayloadRow(value);
      const query = textValue(row.item_query);
      if (!textValue(row.item_code)) {
        issues.push({
          message: query
            ? `“${query}”尚未匹配到唯一商品，请从下拉结果中选择具体商品。`
            : `第 ${index + 1} 行请选择具体商品。`,
          name: ['items', index, 'itemCode'],
        });
      }
      if ((numberValue(row.qty) ?? 0) <= 0) {
        issues.push({
          message: `第 ${index + 1} 行数量必须大于 0。`,
          name: ['items', index, 'qty'],
        });
      }
      if (!textValue(row.warehouse) && !defaultWarehouse) {
        const warehouseQuery = textValue(row.warehouse_query);
        issues.push({
          message: warehouseQuery
            ? `“${warehouseQuery}”尚未匹配到当前公司的可用${isPurchase ? '收货' : '明细'}仓库，请重新选择。`
            : `第 ${index + 1} 行请选择${isPurchase ? '收货' : '明细'}仓库。`,
          name: ['items', index, 'warehouse'],
        });
      }
    });
    return issues;
  }

  const payload = draft.payload;
  const item = readPayloadRow(
    Array.isArray(payload.items) ? payload.items[0] : undefined,
  );
  const issues: AiDraftFormFieldIssue[] = [];
  const itemQuery = textValue(item.item_query);

  if (!textValue(item.item_code)) {
    issues.push({
      message: itemQuery
        ? `“${itemQuery}”尚未匹配到唯一商品，请从下拉结果中选择具体商品。`
        : (matchingValidationError(draft, ['商品']) ?? '请选择具体商品。'),
      name: 'itemCode',
    });
  }
  if (!textValue(payload.warehouse)) {
    const warehouseQuery = textValue(payload.warehouse_query);
    issues.push({
      message: warehouseQuery
        ? `“${warehouseQuery}”尚未匹配到当前公司的可用仓库，请重新选择。`
        : (matchingValidationError(draft, ['仓库']) ?? '请选择具体仓库。'),
      name: 'warehouse',
    });
  }
  const quantity = numberValue(item.qty);
  const adjustmentType = textValue(payload.adjustment_type);
  const quantityError = matchingValidationError(draft, ['数量', '目标库存']);
  if (
    quantity === undefined ||
    (['increase', 'decrease'].includes(adjustmentType ?? '') &&
      quantity <= 0) ||
    Boolean(quantityError?.includes('负数'))
  ) {
    issues.push({
      message: quantityError ?? '请填写库存调整数量。',
      name: 'quantity',
    });
  }
  if (!textValue(payload.reason) && !textValue(payload.remarks)) {
    issues.push({
      message:
        matchingValidationError(draft, ['原因', '盘点差异']) ??
        '请填写盘点差异或业务原因。',
      name: 'reason',
    });
  }

  return issues;
}

export function buildAiDraftPayload(draft: AiDraft, values: AiDraftFormValues) {
  if (draft.draftType === 'product_setup') {
    const operation =
      draft.payload.operation === 'update' ? 'update' : 'create';
    return {
      _state: draft.payload._state,
      brand: values.brand,
      brand_query: values.brand
        ? undefined
        : unresolvedQuery(draft.payload, 'brand', 'brand_query'),
      company: values.company,
      currency: values.currency,
      description: values.description,
      image: values.image ?? '',
      item_code: values.itemCode,
      item_group: values.itemGroup,
      item_group_query: values.itemGroup
        ? undefined
        : unresolvedQuery(draft.payload, 'item_group', 'item_group_query'),
      item_name: values.itemName,
      operation,
      opening_qty: operation === 'create' ? values.openingQty : undefined,
      opening_uom: operation === 'create' ? values.stockUom : undefined,
      retail_rate: values.retailRate,
      standard_buying_rate: values.standardBuyingRate,
      standard_selling_rate: values.standardSellingRate,
      stock_uom: values.stockUom,
      warehouse: operation === 'create' ? values.warehouse : undefined,
      warehouse_query:
        operation === 'create' && !values.warehouse
          ? unresolvedQuery(draft.payload, 'warehouse', 'warehouse_query')
          : undefined,
      wholesale_rate: values.wholesaleRate,
    };
  }
  if (draft.draftType === 'inventory_adjustment') {
    return {
      adjustment_type: values.adjustmentType,
      company: values.company,
      item_code: values.itemCode,
      item_query: values.itemCode
        ? undefined
        : unresolvedQuery(
            readPayloadRow(
              Array.isArray(draft.payload.items)
                ? draft.payload.items[0]
                : undefined,
            ),
            'item_code',
            'item_query',
          ),
      posting_date: values.postingDate?.format('YYYY-MM-DD'),
      quantity: values.quantity,
      reason: values.reason,
      uom: values.uom,
      warehouse: values.warehouse,
      warehouse_query: values.warehouse
        ? undefined
        : unresolvedQuery(draft.payload, 'warehouse', 'warehouse_query'),
    };
  }
  const originalItems = Array.isArray(draft.payload.items)
    ? draft.payload.items.map(readPayloadRow)
    : [];
  return {
    ...(draft.draftType === 'purchase_order'
      ? {
          supplier: values.party,
          supplier_query: values.party
            ? undefined
            : unresolvedQuery(draft.payload, 'supplier', 'supplier_query'),
        }
      : {
          customer: values.party,
          customer_query: values.party
            ? undefined
            : unresolvedQuery(draft.payload, 'customer', 'customer_query'),
        }),
    company: values.company,
    ...(draft.draftType === 'purchase_order'
      ? {
          currency: values.currency,
          default_purchase_mode: values.defaultMode,
          schedule_date: values.targetDate?.format('YYYY-MM-DD'),
          supplier_ref: values.supplierRef,
        }
      : {
          default_sales_mode: values.defaultMode,
          delivery_date: values.targetDate?.format('YYYY-MM-DD'),
        }),
    items: (values.items ?? []).map((row, index) => {
      const original =
        originalItems.find((item) => item.item_code === row.itemCode) ??
        originalItems[index] ??
        {};
      return {
        _state: readPayloadRow(original?._state),
        item_code: row.itemCode,
        item_query: row.itemCode
          ? undefined
          : unresolvedQuery(original, 'item_code', 'item_query'),
        price: row.price,
        qty: row.qty,
        uom: row.uom,
        warehouse: row.warehouse,
        warehouse_query: row.warehouse
          ? undefined
          : unresolvedQuery(original, 'warehouse', 'warehouse_query'),
      };
    }),
    remarks: values.remarks,
    transaction_date: values.transactionDate?.format('YYYY-MM-DD'),
    warehouse: values.warehouse,
    warehouse_query: values.warehouse
      ? undefined
      : unresolvedQuery(draft.payload, 'warehouse', 'warehouse_query'),
  };
}

export function buildAiDraftConflictFields(
  draftType: AiDraft['draftType'],
  baseValues: AiDraftFormValues,
  localValues: AiDraftFormValues,
  latestValues: AiDraftFormValues,
): AiDraftConflictField[] {
  return draftFields(draftType).flatMap((key) => {
    const baseValue = baseValues[key];
    const localValue = localValues[key];
    const latestValue = latestValues[key];
    if (valuesEqual(key, localValue, latestValue)) return [];
    return [
      {
        baseDisplay: displayValue(key, baseValue),
        key,
        label: FIELD_LABELS[key],
        latestChanged: !valuesEqual(key, baseValue, latestValue),
        latestDisplay: displayValue(key, latestValue),
        localChanged: !valuesEqual(key, baseValue, localValue),
        localDisplay: displayValue(key, localValue),
      },
    ];
  });
}

export function mergeAiDraftConflictValues(
  latestValues: AiDraftFormValues,
  localValues: AiDraftFormValues,
  selectedLocalKeys: Iterable<string>,
) {
  const selected = new Set(selectedLocalKeys);
  const merged: AiDraftFormValues = { ...latestValues };
  for (const key of Object.keys(FIELD_LABELS) as (keyof AiDraftFormValues)[]) {
    if (!selected.has(key)) continue;
    Object.assign(merged, { [key]: cloneFieldValue(key, localValues[key]) });
  }
  return merged;
}
