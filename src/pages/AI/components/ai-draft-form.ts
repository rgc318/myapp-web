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
  barcode?: string;
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
  operation?: 'create' | 'update';
  orderNumber?: string;
  party?: string;
  postingDate?: Dayjs;
  quantity?: number;
  reason?: string;
  remarks?: string;
  retailRate?: number;
  standardBuyingRate?: number;
  standardSellingRate?: number;
  specification?: string;
  stockUom?: string;
  supplierRef?: string;
  targetDate?: Dayjs;
  transactionDate?: Dayjs;
  uom?: string;
  valuationInputRate?: number;
  valuationInputUom?: string;
  valuationRate?: number;
  valuationRateSource?: 'buying_price_reference' | 'current_valuation' | 'user';
  valuationReferenceId?: string;
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
  barcode: '条码',
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
  operation: '处理方式',
  orderNumber: '订单号',
  party: '往来单位',
  postingDate: '过账日期',
  quantity: '数量',
  reason: '调整原因',
  remarks: '备注',
  retailRate: '零售价',
  standardBuyingRate: '标准采购参考价',
  standardSellingRate: '标准销售参考价',
  specification: '规格',
  stockUom: '库存基准单位',
  supplierRef: '供应商参考号',
  targetDate: '交货/到货日期',
  transactionDate: '单据日期',
  uom: '单位',
  valuationInputRate: '计价单位价格',
  valuationInputUom: '计价单位',
  valuationRate: '执行后库存估值单价',
  valuationRateSource: '库存估值来源',
  valuationReferenceId: '采购价格来源',
  warehouse: '仓库',
  wholesaleRate: '批发价',
};

const PRODUCT_FIELDS: (keyof AiDraftFormValues)[] = [
  'company',
  'operation',
  'itemName',
  'itemCode',
  'barcode',
  'specification',
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
  'valuationInputRate',
  'valuationRate',
  'reason',
];

const ORDER_FIELDS: (keyof AiDraftFormValues)[] = [
  'company',
  'operation',
  'orderNumber',
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

function orderHeaderClearFields(
  draft: AiDraft,
  values: AiDraftFormValues,
  originalValues: AiDraftFormValues,
  operation: 'create' | 'update',
) {
  if (operation !== 'update') return [];
  const persisted = Array.isArray(draft.payload.header_clear_fields)
    ? draft.payload.header_clear_fields.filter(
        (field): field is string => typeof field === 'string',
      )
    : [];
  const clearFields = new Set(persisted);
  const editableFields: Array<{
    payloadKey: 'remarks' | 'supplier_ref';
    valueKey: 'remarks' | 'supplierRef';
  }> = [
    { payloadKey: 'remarks', valueKey: 'remarks' },
    ...(draft.draftType === 'purchase_order'
      ? ([{ payloadKey: 'supplier_ref', valueKey: 'supplierRef' }] as const)
      : []),
  ];
  editableFields.forEach(({ payloadKey, valueKey }) => {
    if (textValue(values[valueKey])) {
      clearFields.delete(payloadKey);
    } else if (
      clearFields.has(payloadKey) ||
      textValue(originalValues[valueKey])
    ) {
      clearFields.add(payloadKey);
    }
  });
  return [...clearFields]
    .filter(
      (field) =>
        field === 'remarks' ||
        (draft.draftType === 'purchase_order' && field === 'supplier_ref'),
    )
    .sort();
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
      barcode: textValue(payload.barcode),
      company: textValue(payload.company) ?? draft.company ?? undefined,
      currency: textValue(payload.currency) ?? 'CNY',
      description: textValue(payload.description),
      image: typeof payload.image === 'string' ? payload.image : undefined,
      itemCode: textValue(payload.item_code),
      itemGroup: textValue(payload.item_group),
      itemName: textValue(payload.item_name),
      openingQty: numberValue(payload.opening_qty),
      operation: payload.operation === 'update' ? 'update' : 'create',
      standardBuyingRate:
        numberValue(payload.standard_buying_rate) ??
        numberValue(payload.valuation_rate),
      retailRate: numberValue(payload.retail_rate),
      standardSellingRate: numberValue(payload.standard_selling_rate),
      stockUom: textValue(payload.stock_uom),
      specification: textValue(payload.specification),
      warehouse: textValue(payload.warehouse),
      wholesaleRate: numberValue(payload.wholesale_rate),
    };
  }
  if (draft.draftType === 'inventory_adjustment') {
    const item = readPayloadRow(
      Array.isArray(payload.items) ? payload.items[0] : undefined,
    );
    const rawAdjustmentType = textValue(payload.adjustment_type);
    const valuationRate = numberValue(item.valuation_rate);
    const valuationInputRate =
      numberValue(item.valuation_input_rate) ?? valuationRate;
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
      valuationInputRate:
        valuationInputRate !== undefined && valuationInputRate > 0
          ? valuationInputRate
          : undefined,
      valuationInputUom:
        textValue(item.valuation_input_uom) ?? textValue(item.uom),
      valuationRate:
        valuationRate !== undefined && valuationRate > 0
          ? valuationRate
          : undefined,
      valuationRateSource:
        textValue(item.valuation_rate_source) === 'standard_buying_reference'
          ? 'buying_price_reference'
          : (textValue(item.valuation_rate_source) as
              | 'buying_price_reference'
              | 'current_valuation'
              | 'user'
              | undefined),
      valuationReferenceId: textValue(item.valuation_rate_reference_id),
      warehouse: textValue(payload.warehouse),
    };
  }
  return {
    company: textValue(payload.company) ?? draft.company ?? undefined,
    operation: payload.operation === 'update' ? 'update' : 'create',
    orderNumber: textValue(payload.order_number),
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

const BACKEND_FIELD_TO_FORM_FIELD: Record<
  string,
  AiDraftFormFieldIssue['name']
> = {
  adjustment_type: 'adjustmentType',
  brand: 'brand',
  currency: 'currency',
  customer: 'party',
  delivery_date: 'targetDate',
  item_code: 'itemCode',
  item_group: 'itemGroup',
  item_name: 'itemName',
  opening_qty: 'openingQty',
  posting_date: 'postingDate',
  reason: 'reason',
  retail_rate: 'retailRate',
  schedule_date: 'targetDate',
  standard_buying_rate: 'standardBuyingRate',
  standard_selling_rate: 'standardSellingRate',
  stock_uom: 'stockUom',
  supplier: 'party',
  transaction_date: 'transactionDate',
  warehouse: 'warehouse',
  wholesale_rate: 'wholesaleRate',
};

function backendFieldIssueName(
  field: string | null,
  draftType: AiDraft['draftType'],
): AiDraftFormFieldIssue['name'] | null {
  if (!field) return null;
  const normalized = field.replace(/^patch\./, '').replace(/^target\./, '');
  const direct = BACKEND_FIELD_TO_FORM_FIELD[normalized];
  if (direct) return direct;
  const itemMatch =
    /^items\.(\d+)\.(item_code|qty|uom|warehouse|valuation_rate)$/.exec(
      normalized,
    );
  if (!itemMatch) return null;
  const index = Number(itemMatch[1]);
  const itemField = itemMatch[2];
  if (draftType === 'inventory_adjustment' && index === 0) {
    if (itemField === 'item_code') return 'itemCode';
    if (itemField === 'qty') return 'quantity';
    if (itemField === 'uom') return 'uom';
    if (itemField === 'warehouse') return 'warehouse';
  }
  if (itemField === 'valuation_rate') return 'valuationInputRate';
  const formField: keyof AiDraftItemFormValues =
    itemField === 'item_code'
      ? 'itemCode'
      : (itemField as keyof AiDraftItemFormValues);
  return ['items', index, formField];
}

function structuredBackendFieldIssues(draft: AiDraft): AiDraftFormFieldIssue[] {
  return (draft.validation.issues ?? []).flatMap((issue) => {
    const name = backendFieldIssueName(issue.field, draft.draftType);
    return name ? [{ message: issue.message, name }] : [];
  });
}

function addFieldIssue(
  issues: AiDraftFormFieldIssue[],
  issue: AiDraftFormFieldIssue,
) {
  const key = JSON.stringify(issue.name);
  if (!issues.some((value) => JSON.stringify(value.name) === key)) {
    issues.push(issue);
  }
}

export function getAiDraftFormFieldIssues(
  draft: AiDraft,
): AiDraftFormFieldIssue[] {
  if (draft.validation.readyForHandoff) return [];

  if (draft.draftType === 'product_setup') {
    const payload = draft.payload;
    const issues = structuredBackendFieldIssues(draft);
    if (payload.operation === 'update' && !textValue(payload.item_code)) {
      addFieldIssue(issues, {
        message:
          '尚未绑定要完善的现有商品，请在“选择现有商品”中搜索并选择目标商品。',
        name: 'itemCode',
      });
    }
    if (payload.operation === 'create' && !textValue(payload.item_name)) {
      addFieldIssue(issues, {
        message: '请填写商品名称。',
        name: 'itemName',
      });
    }
    if (!textValue(payload.stock_uom)) {
      addFieldIssue(issues, {
        message: '请选择库存基准单位。',
        name: 'stockUom',
      });
    }
    const itemGroupQuery = unresolvedQuery(
      payload,
      'item_group',
      'item_group_query',
    );
    if (itemGroupQuery) {
      addFieldIssue(issues, {
        message: `“${itemGroupQuery}”尚未匹配到唯一商品分类，请从下拉结果中选择。`,
        name: 'itemGroup',
      });
    }
    const brandQuery = unresolvedQuery(payload, 'brand', 'brand_query');
    if (brandQuery) {
      addFieldIssue(issues, {
        message: `“${brandQuery}”尚未匹配到唯一品牌，请从下拉结果中选择。`,
        name: 'brand',
      });
    }
    const warehouseQuery = unresolvedQuery(
      payload,
      'warehouse',
      'warehouse_query',
    );
    if (warehouseQuery) {
      addFieldIssue(issues, {
        message: `“${warehouseQuery}”尚未匹配到当前公司的可用仓库，请重新选择。`,
        name: 'warehouse',
      });
    }
    if (
      payload.operation === 'create' &&
      (numberValue(payload.opening_qty) ?? 0) > 0 &&
      numberValue(payload.standard_buying_rate) === undefined
    ) {
      addFieldIssue(issues, {
        message: '初始库存增加资产时，请核对并填写库存估值参考价。',
        name: 'standardBuyingRate',
      });
    }
    return issues;
  }

  if (
    draft.draftType === 'sales_order' ||
    draft.draftType === 'purchase_order'
  ) {
    const payload = draft.payload;
    const issues: AiDraftFormFieldIssue[] = structuredBackendFieldIssues(draft);
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
  const issues: AiDraftFormFieldIssue[] = structuredBackendFieldIssues(draft);
  const itemQuery = textValue(item.item_query);

  if (!textValue(item.item_code)) {
    addFieldIssue(issues, {
      message: itemQuery
        ? `“${itemQuery}”尚未匹配到唯一商品，请从下拉结果中选择具体商品。`
        : '请选择具体商品。',
      name: 'itemCode',
    });
  }
  if (!textValue(payload.warehouse)) {
    const warehouseQuery = textValue(payload.warehouse_query);
    addFieldIssue(issues, {
      message: warehouseQuery
        ? `“${warehouseQuery}”尚未匹配到当前公司的可用仓库，请重新选择。`
        : '请选择具体仓库。',
      name: 'warehouse',
    });
  }
  const quantity = numberValue(item.qty);
  const adjustmentType = textValue(payload.adjustment_type);
  if (
    quantity === undefined ||
    (['increase', 'decrease'].includes(adjustmentType ?? '') && quantity <= 0)
  ) {
    addFieldIssue(issues, {
      message: '请填写有效的库存调整数量。',
      name: 'quantity',
    });
  }
  if (!textValue(payload.reason) && !textValue(payload.remarks)) {
    addFieldIssue(issues, {
      message: '请填写盘点差异或业务原因。',
      name: 'reason',
    });
  }

  return issues;
}

export function buildAiDraftPayload(draft: AiDraft, values: AiDraftFormValues) {
  if (draft.draftType === 'product_setup') {
    const operation = values.operation === 'update' ? 'update' : 'create';
    return {
      _state: draft.payload._state,
      source_attachments: draft.payload.source_attachments,
      duplicate_candidates: draft.payload.duplicate_candidates,
      barcode: values.barcode,
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
      specification: values.specification,
      warehouse: operation === 'create' ? values.warehouse : undefined,
      warehouse_query:
        operation === 'create' && !values.warehouse
          ? unresolvedQuery(draft.payload, 'warehouse', 'warehouse_query')
          : undefined,
      wholesale_rate: values.wholesaleRate,
    };
  }
  if (draft.draftType === 'inventory_adjustment') {
    const valuationRateSource =
      values.valuationRateSource ??
      (values.valuationInputRate !== undefined ? 'user' : undefined);
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
      valuation_rate: values.valuationRate,
      valuation_input_rate: values.valuationInputRate,
      valuation_input_uom: values.valuationInputUom ?? values.uom,
      valuation_rate_source: valuationRateSource,
      valuation_rate_reference_id:
        valuationRateSource === 'buying_price_reference'
          ? values.valuationReferenceId
          : undefined,
      warehouse: values.warehouse,
      warehouse_query: values.warehouse
        ? undefined
        : unresolvedQuery(draft.payload, 'warehouse', 'warehouse_query'),
    };
  }
  const originalItems = Array.isArray(draft.payload.items)
    ? draft.payload.items.map(readPayloadRow)
    : [];
  const operation = values.operation === 'update' ? 'update' : 'create';
  const originalValues = getAiDraftFormValues(draft);
  const headerClearFields = orderHeaderClearFields(
    draft,
    values,
    originalValues,
    operation,
  );
  const updateItemsExplicit =
    operation === 'update' &&
    (draft.payload.update_items_explicit === true ||
      !valuesEqual('items', originalValues.items, values.items));
  return {
    source_attachments: draft.payload.source_attachments,
    operation,
    order_number: values.orderNumber,
    header_clear_fields: headerClearFields,
    source_document_type: draft.payload.source_document_type,
    update_items_explicit: updateItemsExplicit,
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
