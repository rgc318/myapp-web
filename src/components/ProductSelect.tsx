import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import type {
  ActionType,
  ProColumns,
  ProFormInstance,
} from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import {
  Badge,
  Button,
  Divider,
  Drawer,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  message,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createProductAndStock,
  listProducts,
  type ProductSummary,
  searchProducts,
} from '@/services/myapp/master-data';
import {
  calculateLineAmount,
  formatCurrencyValue,
} from '@/utils/myapp-display';
import { getProductPurchaseDefaultPrice } from '@/utils/purchase-order-editor';
import {
  convertQtyToStockQty,
  formatQty,
  getProductAvailableUoms,
  getProductModeDefaultPrice,
  getProductModeDefaultUom,
  resolveUomDisplay,
} from '@/utils/sales-order-editor';
import { RemoteLinkSelect } from './RemoteLinkSelect';
import { UomSelect } from './UomSelect';

type ProductContext = 'sales' | 'purchase' | 'inventory' | 'any';
type ProductSelectSalesMode = 'wholesale' | 'retail';

type QuickCreateProductValues = {
  defaultWarehouse?: string;
  description?: string;
  itemName: string;
  nickname?: string;
  openingQty?: number | null;
  openingUom?: string;
  standardRate?: number | null;
};

export type ProductSelectLine = {
  key: string;
  price: number | null;
  product: ProductSummary;
  qty: number;
  salesMode?: ProductSelectSalesMode;
  uom: string | null;
  warehouse: string;
};

export type SelectedProductLineSummary = {
  allUomDisplays?: Record<string, string>;
  amount?: number | null;
  itemCode: string;
  itemName?: string;
  price?: number | null;
  qty?: number;
  salesMode?: ProductSelectSalesMode;
  stockUom?: string | null;
  stockUomDisplay?: string | null;
  uom?: string | null;
  uomConversions?: ProductSummary['uomConversions'];
  uomDisplay?: string | null;
  warehouse?: string | null;
};

function productLabel(record: ProductSummary) {
  return record.itemName || record.itemCode;
}

function productNicknameLabel(record: ProductSummary) {
  const nickname = record.nickname?.trim();
  if (
    !nickname ||
    nickname === record.itemName ||
    nickname === record.description?.trim()
  ) {
    return null;
  }
  return nickname;
}

function stockLabel(record: ProductSummary, warehouse?: string) {
  const stockUomDisplay = resolveUomDisplay(
    record.stockUom,
    record.allUomDisplays,
    record.stockUomDisplay,
  );
  const warehouseQty = warehouse
    ? record.warehouseStockDetails.find((row) => row.warehouse === warehouse)
        ?.qty
    : record.warehouseStockQty;

  return {
    stockUomDisplay,
    totalQty: record.totalQty ?? record.stockQty,
    warehouseQty: warehouseQty ?? record.stockQty,
  };
}

function contextPrice(record: ProductSummary, itemContext: ProductContext) {
  if (itemContext === 'purchase') {
    return record.priceSummary?.standardBuyingRate ?? record.price;
  }
  if (itemContext === 'sales') {
    return (
      record.priceSummary?.wholesaleRate ??
      record.priceSummary?.standardSellingRate ??
      record.price
    );
  }
  return record.priceSummary?.currentRate ?? record.price;
}

function uniqueText(values: (string | null | undefined)[]) {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean),
    ),
  );
}

function warehouseOptions(record: ProductSummary, defaultWarehouse?: string) {
  return uniqueText([
    defaultWarehouse,
    record.warehouse,
    ...(record.warehouseStockDetails ?? []).map((entry) => entry.warehouse),
    ...(record.globalWarehouseStockDetails ?? []).map(
      (entry) => entry.warehouse,
    ),
  ]).map((value) => ({ label: value, value }));
}

function productMatchesContext(
  record: ProductSummary,
  itemContext: ProductContext,
) {
  if (itemContext === 'sales') {
    return record.isSalesItem !== false;
  }
  if (itemContext === 'purchase') {
    return record.isPurchaseItem !== false;
  }
  return true;
}

function buildLineKey(options: {
  itemCode: string;
  itemContext: ProductContext;
  price: number | null;
  salesMode?: ProductSelectSalesMode;
  uom: string | null;
  warehouse: string;
}) {
  return [
    options.itemCode,
    options.warehouse || '',
    options.itemContext === 'sales' ? (options.salesMode ?? '') : '',
    options.uom || '',
    options.price ?? '',
  ].join('::');
}

function lineLabel(line: ProductSelectLine) {
  const uomDisplay = resolveUomDisplay(
    line.uom,
    line.product.allUomDisplays,
    line.product.uomDisplay,
  );
  const modeText =
    line.salesMode === 'retail'
      ? '零售'
      : line.salesMode === 'wholesale'
        ? '批发'
        : '';
  return [
    line.warehouse || '未指定仓库',
    uomDisplay || '未设置单位',
    modeText,
    line.price == null ? '未设置价格' : formatCurrencyValue(line.price),
  ]
    .filter(Boolean)
    .join(' · ');
}

function selectedLineSummaryLabel(
  line: SelectedProductLineSummary,
  itemContext: ProductContext,
) {
  const uomDisplay = resolveUomDisplay(
    line.uom,
    line.allUomDisplays,
    line.uomDisplay,
  );
  const modeText =
    itemContext === 'sales'
      ? line.salesMode === 'retail'
        ? '零售'
        : '批发'
      : '';
  return [
    line.warehouse || '未指定仓库',
    uomDisplay || '未设置单位',
    modeText,
    line.price == null ? '未设置价格' : formatCurrencyValue(line.price),
  ]
    .filter(Boolean)
    .join(' · ');
}

function selectedLineQtyLabel(line: SelectedProductLineSummary) {
  const qty = Number.isFinite(line.qty) ? Number(line.qty) : 0;
  const uomDisplay = resolveUomDisplay(
    line.uom,
    line.allUomDisplays,
    line.uomDisplay,
  );
  return `${formatQty(qty)} ${uomDisplay || '未设置单位'}`;
}

function selectedLineStockQtyLabel(line: SelectedProductLineSummary) {
  const stockQty = convertQtyToStockQty({
    qty: Number.isFinite(line.qty) ? Number(line.qty) : 0,
    stockUom: line.stockUom ?? null,
    uom: line.uom ?? null,
    uomConversions: line.uomConversions,
  });
  const stockUomDisplay = resolveUomDisplay(
    line.stockUom,
    line.allUomDisplays,
    line.stockUomDisplay,
  );
  if (
    !stockUomDisplay ||
    stockUomDisplay ===
      resolveUomDisplay(line.uom, line.allUomDisplays, line.uomDisplay)
  ) {
    return '';
  }
  return `库存单位约 ${formatQty(stockQty)} ${stockUomDisplay}`;
}

function selectedLineAmount(line: SelectedProductLineSummary) {
  if (typeof line.amount === 'number' && Number.isFinite(line.amount)) {
    return line.amount;
  }
  return calculateLineAmount({ price: line.price, qty: line.qty });
}

function selectedLineQty(line: SelectedProductLineSummary) {
  return Number.isFinite(line.qty) ? Number(line.qty) : 0;
}

export function ProductSelect({
  company,
  defaultSalesMode = 'wholesale',
  itemContext = 'any',
  placeholder = '选择商品',
  selectedProductKeys = [],
  selectedProductLines = [],
  style,
  warehouse,
  onSelectProduct,
  onSelectLines,
  onSelectProducts,
}: {
  company?: string;
  defaultSalesMode?: ProductSelectSalesMode;
  itemContext?: ProductContext;
  placeholder?: string;
  selectedProductKeys?: string[];
  selectedProductLines?: SelectedProductLineSummary[];
  style?: React.CSSProperties;
  warehouse?: string;
  onSelectProduct: (product: ProductSummary) => void;
  onSelectLines?: (lines: ProductSelectLine[]) => void;
  onSelectProducts?: (products: ProductSummary[]) => void;
}) {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const formRef = useRef<ProFormInstance | undefined>(undefined);
  const [quickCreateForm] = Form.useForm<QuickCreateProductValues>();
  const [open, setOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] =
    useState<ProductSummary | null>(null);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [keepOpen, setKeepOpen] = useState(false);
  const [selectedMap, setSelectedMap] = useState<
    Record<string, ProductSelectLine>
  >({});
  const [rowQtyMap, setRowQtyMap] = useState<Record<string, number>>({});
  const [rowPriceMap, setRowPriceMap] = useState<Record<string, number | null>>(
    {},
  );
  const [rowSalesModeMap, setRowSalesModeMap] = useState<
    Record<string, ProductSelectSalesMode>
  >({});
  const [rowUomMap, setRowUomMap] = useState<Record<string, string | null>>({});
  const [rowWarehouseMap, setRowWarehouseMap] = useState<
    Record<string, string>
  >({});
  const [activeWarehouseFilter, setActiveWarehouseFilter] = useState('');
  const enableTransactionPicker =
    itemContext === 'sales' || itemContext === 'purchase';
  const enableBatch = itemContext !== 'inventory' && !enableTransactionPicker;
  const confirmText =
    itemContext === 'inventory'
      ? '使用商品'
      : itemContext === 'purchase'
        ? '加入采购明细'
        : '加入订单明细';
  const selectedRows = Object.values(selectedMap);
  const selectedProductCountMap = useMemo(
    () =>
      selectedProductKeys.reduce<Record<string, number>>((acc, itemCode) => {
        acc[itemCode] = (acc[itemCode] ?? 0) + 1;
        return acc;
      }, {}),
    [selectedProductKeys],
  );
  const selectedLineSummaryMap = useMemo(() => {
    return selectedProductLines.reduce<{
      byItem: Record<string, { qty: number; rows: number }>;
      byKey: Record<string, { qty: number; rows: number }>;
    }>(
      (acc, line) => {
        const qty = Number.isFinite(line.qty) ? Number(line.qty) : 1;
        const itemBucket = acc.byItem[line.itemCode] ?? { qty: 0, rows: 0 };
        itemBucket.qty += qty;
        itemBucket.rows += 1;
        acc.byItem[line.itemCode] = itemBucket;

        const key = buildLineKey({
          itemCode: line.itemCode,
          itemContext,
          price: line.price ?? null,
          salesMode: line.salesMode,
          uom: line.uom ?? null,
          warehouse: line.warehouse ?? '',
        });
        const keyBucket = acc.byKey[key] ?? { qty: 0, rows: 0 };
        keyBucket.qty += qty;
        keyBucket.rows += 1;
        acc.byKey[key] = keyBucket;
        return acc;
      },
      { byItem: {}, byKey: {} },
    );
  }, [itemContext, selectedProductLines]);
  const selectedQty = selectedRows.reduce((sum, row) => sum + row.qty, 0);
  const selectedAmount = selectedRows.reduce(
    (sum, row) => sum + calculateLineAmount({ price: row.price, qty: row.qty }),
    0,
  );
  const currentOrderQty = selectedProductLines.reduce(
    (sum, line) => sum + selectedLineQty(line),
    0,
  );
  const currentOrderAmount = selectedProductLines.reduce(
    (sum, line) => sum + selectedLineAmount(line),
    0,
  );

  useEffect(() => {
    if (!open || !enableTransactionPicker) {
      return;
    }
    const timer = window.setTimeout(() => {
      actionRef.current?.reloadAndRest?.();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [enableTransactionPicker, open]);

  const resetPickerFilters = () => {
    setActiveWarehouseFilter('');
    setRowQtyMap({});
    setRowPriceMap({});
    setRowSalesModeMap({});
    setRowUomMap({});
    setRowWarehouseMap({});
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      brand: undefined,
      inStockOnly: 'all',
      itemGroup: undefined,
      searchKey: undefined,
      warehouseFilter: undefined,
    });
  };

  const updateSelectedRows = (rows: ProductSummary[]) => {
    setSelectedMap((current) => {
      const next = { ...current };
      const nextKeys = new Set(rows.map((row) => buildDraftLine(row).key));
      Object.keys(next).forEach((key) => {
        if (!nextKeys.has(key)) {
          delete next[key];
        }
      });
      rows.forEach((row) => {
        const line = buildDraftLine(row);
        next[line.key] = line;
      });
      return next;
    });
  };

  const rowQty = (itemCode: string) => rowQtyMap[itemCode] ?? 1;
  const rowSalesMode = (record: ProductSummary) =>
    rowSalesModeMap[record.itemCode] ?? defaultSalesMode;
  const rowUom = (record: ProductSummary) => {
    if (rowUomMap[record.itemCode]) {
      return rowUomMap[record.itemCode];
    }
    if (itemContext === 'sales') {
      return (
        getProductModeDefaultUom(record, rowSalesMode(record)) ||
        record.stockUom
      );
    }
    if (itemContext === 'purchase') {
      return (
        getProductModeDefaultUom(record, rowSalesMode(record)) ||
        record.uom ||
        record.stockUom ||
        getProductAvailableUoms(record)[0] ||
        null
      );
    }
    return (
      record.uom ||
      record.stockUom ||
      getProductAvailableUoms(record)[0] ||
      null
    );
  };
  const rowPrice = (record: ProductSummary) => {
    if (Object.hasOwn(rowPriceMap, record.itemCode)) {
      return rowPriceMap[record.itemCode];
    }
    if (itemContext === 'sales') {
      return getProductModeDefaultPrice(record, rowSalesMode(record));
    }
    if (itemContext === 'purchase') {
      return getProductPurchaseDefaultPrice(record);
    }
    return contextPrice(record, itemContext);
  };
  const rowWarehouse = (record: ProductSummary) =>
    rowWarehouseMap[record.itemCode] ||
    record.warehouse ||
    activeWarehouseFilter ||
    warehouse ||
    '';

  const buildDraftLine = (product: ProductSummary): ProductSelectLine => {
    const price = rowPrice(product);
    const salesMode =
      itemContext === 'sales' || itemContext === 'purchase'
        ? rowSalesMode(product)
        : undefined;
    const uom = rowUom(product);
    const nextWarehouse = rowWarehouse(product);
    return {
      key: buildLineKey({
        itemCode: product.itemCode,
        itemContext,
        price,
        salesMode,
        uom,
        warehouse: nextWarehouse,
      }),
      price,
      product,
      qty: enableTransactionPicker
        ? Math.max(1, Math.floor(rowQty(product.itemCode)))
        : 1,
      salesMode,
      uom,
      warehouse: nextWarehouse,
    };
  };

  const productWithLineOverrides = (
    line: ProductSelectLine,
  ): ProductSummary => ({
    ...line.product,
    price: line.price,
    uom: line.uom,
    warehouse: line.warehouse,
  });

  const selectLines = (lines: ProductSelectLine[], closeAfterSelect = true) => {
    if (!lines.length) {
      return;
    }
    if (onSelectLines) {
      onSelectLines(lines);
    } else {
      const expandedProducts = lines.flatMap((line) => {
        const product = productWithLineOverrides(line);
        return Array.from({ length: line.qty }, () => product);
      });
      if (onSelectProducts) {
        onSelectProducts(expandedProducts);
      } else {
        expandedProducts.forEach((product) => {
          onSelectProduct(product);
        });
      }
    }
    setSelectedMap({});
    if (enableTransactionPicker) {
      const totalQty = lines.reduce((sum, line) => sum + line.qty, 0);
      message.success(`已加入 ${totalQty} 件商品明细，可继续选择`);
    }
    if (closeAfterSelect && !keepOpen) {
      setOpen(false);
    }
  };

  const stageLine = (product: ProductSummary) => {
    const line = buildDraftLine(product);
    setSelectedMap((current) => {
      const existing = current[line.key];
      return {
        ...current,
        [line.key]: existing
          ? { ...existing, qty: existing.qty + line.qty }
          : line,
      };
    });
  };

  const selectProductNow = (product: ProductSummary) => {
    selectLines([buildDraftLine(product)], !enableTransactionPicker);
  };

  const openQuickCreate = () => {
    quickCreateForm.setFieldsValue({
      defaultWarehouse: warehouse || undefined,
      openingQty: 0,
      openingUom: 'Nos',
    });
    setQuickCreateOpen(true);
  };

  const submitQuickCreate = async () => {
    const values = await quickCreateForm.validateFields();
    const openingUom = values.openingUom || 'Nos';
    setCreatingProduct(true);
    try {
      const result = await createProductAndStock({
        defaultWarehouse: values.defaultWarehouse || warehouse || null,
        description: values.description,
        itemName: values.itemName,
        nickname: values.nickname,
        openingQty: Number(values.openingQty ?? 0),
        openingUom,
        standardRate:
          typeof values.standardRate === 'number' &&
          Number.isFinite(values.standardRate)
            ? values.standardRate
            : null,
        stockUom: openingUom,
        uomConversions: [{ conversionFactor: 1, uom: openingUom }],
      });
      const createdProduct = result.data;
      setQuickCreateOpen(false);
      quickCreateForm.resetFields();
      actionRef.current?.reloadAndRest?.();
      selectProductNow({
        ...createdProduct,
        warehouse:
          createdProduct.warehouse ||
          values.defaultWarehouse ||
          activeWarehouseFilter ||
          warehouse ||
          '',
      });
    } finally {
      setCreatingProduct(false);
    }
  };

  const currentLineSummary = (record: ProductSummary) =>
    selectedLineSummaryMap.byKey[buildDraftLine(record).key];

  const totalLineSummary = (record: ProductSummary) =>
    selectedLineSummaryMap.byItem[record.itemCode];

  const groupedSelectedRows = useMemo(() => {
    const groups = new Map<
      string,
      { itemCode: string; itemName: string; rows: ProductSelectLine[] }
    >();
    selectedRows.forEach((line) => {
      const existing = groups.get(line.product.itemCode);
      if (existing) {
        existing.rows.push(line);
        return;
      }
      groups.set(line.product.itemCode, {
        itemCode: line.product.itemCode,
        itemName: productLabel(line.product),
        rows: [line],
      });
    });
    return Array.from(groups.values());
  }, [selectedRows]);

  const columns = useMemo<ProColumns<ProductSummary>[]>(
    () => [
      {
        dataIndex: 'searchKey',
        hideInTable: true,
        title: '关键词',
      },
      {
        dataIndex: 'itemName',
        search: false,
        title: '商品',
        width: 320,
        fixed: 'left',
        render: (_, record) => (
          <Space align="start" size={12}>
            {record.imageUrl ? (
              <Image
                alt={productLabel(record)}
                height={48}
                preview={false}
                src={record.imageUrl}
                style={{ objectFit: 'cover' }}
                width={48}
              />
            ) : (
              <div
                style={{
                  alignItems: 'center',
                  background: '#f5f5f5',
                  border: '1px solid #f0f0f0',
                  color: 'rgba(0, 0, 0, 0.45)',
                  display: 'flex',
                  height: 48,
                  justifyContent: 'center',
                  width: 48,
                }}
              >
                无图
              </div>
            )}
            <Space orientation="vertical" size={0}>
              <Space size={6} wrap>
                <Typography.Text strong>{productLabel(record)}</Typography.Text>
                {selectedProductCountMap[record.itemCode] ? (
                  <Tag color="processing">
                    本单 {selectedProductCountMap[record.itemCode]} 行
                  </Tag>
                ) : null}
                {totalLineSummary(record) ? (
                  <Tag color="blue">
                    总已加 {formatQty(totalLineSummary(record)?.qty)}
                  </Tag>
                ) : null}
                {record.disabled ? <Tag color="default">停用</Tag> : null}
                {record.isSalesItem ? <Tag color="blue">销售</Tag> : null}
                {record.isPurchaseItem ? <Tag color="green">采购</Tag> : null}
              </Space>
              {productNicknameLabel(record) ? (
                <Typography.Text type="secondary">
                  昵称：{productNicknameLabel(record)}
                </Typography.Text>
              ) : null}
              <Typography.Text type="secondary">
                {record.itemCode}
              </Typography.Text>
              {record.specification ? (
                <Typography.Text type="secondary">
                  {record.specification}
                </Typography.Text>
              ) : null}
            </Space>
          </Space>
        ),
      },
      {
        dataIndex: 'itemGroup',
        hideInTable: true,
        title: '分类',
        width: 140,
        formItemRender: (_, { onChange, value }, form) => (
          <RemoteLinkSelect
            doctype="Item Group"
            filters={{ is_group: 0 }}
            onChange={(nextValue) => {
              const itemGroup = String(nextValue ?? '').trim();
              form.setFieldValue?.('itemGroup', itemGroup || undefined);
              onChange?.(itemGroup);
            }}
            placeholder="选择分类"
            value={String(value ?? form.getFieldValue?.('itemGroup') ?? '')}
          />
        ),
      },
      {
        dataIndex: 'brand',
        hideInTable: true,
        title: '品牌',
        width: 120,
        formItemRender: (_, { onChange, value }, form) => (
          <RemoteLinkSelect
            doctype="Brand"
            onChange={(nextValue) => {
              const brand = String(nextValue ?? '').trim();
              form.setFieldValue?.('brand', brand || undefined);
              onChange?.(brand);
            }}
            placeholder="选择品牌"
            value={String(value ?? form.getFieldValue?.('brand') ?? '')}
          />
        ),
      },
      {
        title: enableTransactionPicker ? '默认选品参数' : '单位',
        width: enableTransactionPicker ? 260 : 120,
        search: false,
        render: (_, record) => {
          if (!enableTransactionPicker) {
            return resolveUomDisplay(
              record.stockUom,
              record.allUomDisplays,
              record.stockUomDisplay,
            );
          }

          const line = buildDraftLine(record);
          const modeText =
            itemContext === 'sales' || itemContext === 'purchase'
              ? line.salesMode === 'retail'
                ? '零售'
                : '批发'
              : '';
          const uomText = resolveUomDisplay(
            line.uom,
            record.allUomDisplays,
            record.uomDisplay,
          );
          return (
            <Space orientation="vertical" size={2}>
              <Space size={[4, 4]} wrap>
                {modeText ? <Tag color="blue">{modeText}</Tag> : null}
                <Tag>{uomText || '未设置单位'}</Tag>
                <Tag>{line.warehouse || '未指定仓库'}</Tag>
              </Space>
              <Typography.Text type="secondary">
                {line.price == null
                  ? '未设置价格'
                  : formatCurrencyValue(line.price)}
                {' · 数量 '}
                {line.qty}
              </Typography.Text>
            </Space>
          );
        },
      },
      {
        dataIndex: 'inStockOnly',
        hideInTable: true,
        initialValue: 'all',
        title: '库存范围',
        valueEnum: {
          all: { text: '全部商品' },
          in_stock: { text: '仅有库存' },
        },
        valueType: 'select',
      },
      {
        dataIndex: 'warehouseFilter',
        hideInTable: true,
        title: '库存仓库',
        formItemRender: (_, { onChange, value }, form) => (
          <RemoteLinkSelect
            doctype="Warehouse"
            extraFields={['company']}
            filters={{ company, disabled: 0, is_group: 0 }}
            onChange={(nextValue) => {
              const nextWarehouse = String(nextValue ?? '').trim();
              form.setFieldValue?.(
                'warehouseFilter',
                nextWarehouse || undefined,
              );
              onChange?.(nextWarehouse);
              setActiveWarehouseFilter(nextWarehouse);
            }}
            placeholder="全部仓库"
            value={String(
              value ?? form.getFieldValue?.('warehouseFilter') ?? '',
            )}
          />
        ),
      },
      {
        title: '库存',
        width: 170,
        search: false,
        render: (_, record) => {
          const { stockUomDisplay, totalQty, warehouseQty } = stockLabel(
            record,
            activeWarehouseFilter,
          );
          const warehouseQtyLabel = activeWarehouseFilter
            ? '当前仓'
            : '可用库存';
          const stockWarning =
            typeof warehouseQty === 'number' && warehouseQty <= 0;
          return (
            <Space orientation="vertical" size={0}>
              <Typography.Text>
                总库存 {formatQty(totalQty)} {stockUomDisplay}
              </Typography.Text>
              <Typography.Text type={stockWarning ? 'danger' : 'secondary'}>
                {warehouseQtyLabel} {formatQty(warehouseQty)} {stockUomDisplay}
              </Typography.Text>
            </Space>
          );
        },
      },
      {
        title: itemContext === 'purchase' ? '采购参考价' : '销售参考价',
        width: 120,
        search: false,
        render: (_, record) =>
          rowPrice(record) == null ? (
            <Typography.Text type="secondary">未设置</Typography.Text>
          ) : (
            <Typography.Text strong>
              {formatCurrencyValue(rowPrice(record))}
            </Typography.Text>
          ),
      },
      ...(enableTransactionPicker
        ? [
            {
              title: '已选',
              width: 110,
              search: false,
              render: (_: unknown, record: ProductSummary) => {
                const currentSummary = currentLineSummary(record);
                const totalSummary = totalLineSummary(record);
                return (
                  <Space orientation="vertical" size={0}>
                    <Typography.Text type="secondary">
                      当前维度 {formatQty(currentSummary?.qty ?? 0)}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      同 SKU {formatQty(totalSummary?.qty ?? 0)}
                    </Typography.Text>
                  </Space>
                );
              },
            } satisfies ProColumns<ProductSummary>,
          ]
        : []),
      {
        title: '操作',
        valueType: 'option',
        fixed: 'right',
        width: enableTransactionPicker ? 140 : 112,
        render: (_, record) => [
          <Space key="actions" size={4}>
            <Button
              onClick={() => {
                selectProductNow(record);
              }}
              size="small"
              type="link"
            >
              加入
            </Button>
            {enableBatch ? (
              <Button
                onClick={() => {
                  stageLine(record);
                }}
                size="small"
                type="link"
              >
                暂存
              </Button>
            ) : null}
            {enableTransactionPicker ? (
              <Button
                onClick={() => setAdjustingProduct(record)}
                size="small"
                type="link"
              >
                调整
              </Button>
            ) : null}
          </Space>,
        ],
      },
    ],
    [
      enableBatch,
      enableTransactionPicker,
      defaultSalesMode,
      itemContext,
      rowQtyMap,
      rowPriceMap,
      rowSalesModeMap,
      rowUomMap,
      rowWarehouseMap,
      selectProductNow,
      selectedMap,
      selectedLineSummaryMap,
      selectedProductCountMap,
      activeWarehouseFilter,
      warehouse,
    ],
  );

  const pickerFooter = enableBatch ? (
    <Space style={{ justifyContent: 'space-between', width: '100%' }}>
      <Space size={16}>
        <Badge count={selectedRows.length} showZero>
          <Typography.Text strong>暂存商品</Typography.Text>
        </Badge>
        <Typography.Text type="secondary">
          合计数量 {selectedQty}
        </Typography.Text>
        <Typography.Text type="secondary">
          预计金额 {formatCurrencyValue(selectedAmount)}
        </Typography.Text>
        {enableTransactionPicker ? null : (
          <Space size={8}>
            <Typography.Text type="secondary">连续选择</Typography.Text>
            <Switch checked={keepOpen} onChange={setKeepOpen} size="small" />
          </Space>
        )}
      </Space>
      <Space>
        {enableTransactionPicker ? null : (
          <Button
            disabled={!selectedRows.length}
            onClick={() => setDetailOpen(true)}
          >
            已选明细
          </Button>
        )}
        <Button
          disabled={!selectedRows.length}
          onClick={() => setSelectedMap({})}
        >
          清空暂存
        </Button>
        <Button
          disabled={!selectedRows.length}
          onClick={() => selectLines(selectedRows, !enableTransactionPicker)}
          type="primary"
        >
          {confirmText}
        </Button>
      </Space>
    </Space>
  ) : null;

  const pickerTitle = (
    <Space>
      <span>选择商品</span>
      <Typography.Text type="secondary">
        支持按名称、编码、条码、分类和品牌搜索
      </Typography.Text>
    </Space>
  );

  const transactionSidePanel = enableTransactionPicker ? (
    <div
      style={{
        borderLeft: '1px solid #f0f0f0',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minHeight: 'calc(100vh - 210px)',
        minWidth: 360,
        paddingLeft: 16,
        width: 380,
      }}
    >
      <Space
        orientation="vertical"
        size={8}
        style={{ flex: 1, minHeight: 0, width: '100%' }}
      >
        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <Typography.Text strong>本单已加入</Typography.Text>
          <Badge
            count={selectedProductLines.length}
            overflowCount={99}
            showZero
          />
        </Space>
        <div
          style={{
            border: '1px solid #f0f0f0',
            flex: 1,
            minHeight: 280,
            overflow: 'auto',
            padding: 8,
          }}
        >
          {selectedProductLines.length ? (
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              {selectedProductLines.map((line, index) => (
                <div
                  key={buildLineKey({
                    itemCode: line.itemCode,
                    itemContext,
                    price: line.price ?? null,
                    salesMode: line.salesMode,
                    uom: line.uom ?? null,
                    warehouse: line.warehouse ?? '',
                  })}
                  style={{
                    borderBottom:
                      index === selectedProductLines.length - 1
                        ? undefined
                        : '1px solid #f5f5f5',
                    paddingBottom:
                      index === selectedProductLines.length - 1 ? 0 : 8,
                  }}
                >
                  <Space
                    align="start"
                    style={{ justifyContent: 'space-between', width: '100%' }}
                  >
                    <Space orientation="vertical" size={0}>
                      <Typography.Text strong>
                        {line.itemName || line.itemCode}
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        {line.itemCode}
                      </Typography.Text>
                    </Space>
                    <Typography.Text
                      strong
                      style={{ color: '#f5222d', fontSize: 16 }}
                    >
                      {formatCurrencyValue(selectedLineAmount(line))}
                    </Typography.Text>
                  </Space>
                  <Space
                    size={[8, 4]}
                    style={{ marginTop: 4, width: '100%' }}
                    wrap
                  >
                    <Tag color="blue">数量 {selectedLineQtyLabel(line)}</Tag>
                    {selectedLineStockQtyLabel(line) ? (
                      <Tag>{selectedLineStockQtyLabel(line)}</Tag>
                    ) : null}
                  </Space>
                  <Typography.Text type="secondary">
                    {selectedLineSummaryLabel(line, itemContext)}
                  </Typography.Text>
                </div>
              ))}
            </Space>
          ) : (
            <Typography.Text type="secondary">
              暂无商品明细，点击左侧“加入”后会立即显示在订单中。
            </Typography.Text>
          )}
        </div>
        <div
          style={{
            background: '#fafafa',
            border: '1px solid #f0f0f0',
            borderRadius: 6,
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            padding: '10px 12px',
          }}
        >
          <Space orientation="vertical" size={0}>
            <Typography.Text type="secondary">商品行</Typography.Text>
            <Typography.Text strong style={{ color: '#1677ff', fontSize: 18 }}>
              {selectedProductLines.length}
            </Typography.Text>
          </Space>
          <Space orientation="vertical" size={0}>
            <Typography.Text type="secondary">数量</Typography.Text>
            <Typography.Text strong style={{ color: '#1677ff', fontSize: 18 }}>
              {formatQty(currentOrderQty)}
            </Typography.Text>
          </Space>
          <Space orientation="vertical" size={0}>
            <Typography.Text type="secondary">金额</Typography.Text>
            <Typography.Text strong style={{ color: '#f5222d', fontSize: 18 }}>
              {formatCurrencyValue(currentOrderAmount)}
            </Typography.Text>
          </Space>
        </div>
      </Space>
    </div>
  ) : null;

  const pickerContent = (
    <div
      style={
        enableTransactionPicker
          ? {
              display: 'flex',
              gap: 16,
              minHeight: 520,
            }
          : undefined
      }
    >
      <div
        style={enableTransactionPicker ? { flex: 1, minWidth: 0 } : undefined}
      >
        {selectedRows.length && !enableTransactionPicker ? (
          <>
            <Space size={[8, 8]} wrap>
              {selectedRows.map((row) => (
                <Tag
                  closable
                  key={row.key}
                  onClose={(event) => {
                    event.preventDefault();
                    setSelectedMap((current) => {
                      const next = { ...current };
                      delete next[row.key];
                      return next;
                    });
                  }}
                >
                  {productLabel(row.product)} x {row.qty} · {lineLabel(row)}
                </Tag>
              ))}
            </Space>
            <Divider style={{ margin: '12px 0' }} />
          </>
        ) : null}
        <ProTable<ProductSummary>
          actionRef={actionRef}
          tableAlertOptionRender={false}
          tableAlertRender={({ selectedRowKeys }) => (
            <Space>
              <Typography.Text>
                已选择 {selectedRowKeys.length} 个商品
              </Typography.Text>
              <Button
                disabled={!selectedRows.length}
                onClick={() =>
                  selectLines(selectedRows, !enableTransactionPicker)
                }
                type="link"
              >
                {confirmText}
              </Button>
            </Space>
          )}
          rowSelection={
            enableBatch
              ? {
                  fixed: true,
                  onChange: (_, rows) => updateSelectedRows(rows),
                  selectedRowKeys: selectedRows.map(
                    (row) => row.product.itemCode,
                  ),
                }
              : undefined
          }
          toolbar={{
            actions: [
              <Button
                icon={<PlusOutlined />}
                key="quick-create"
                onClick={openQuickCreate}
              >
                新增商品
              </Button>,
              <Tooltip
                key="tip"
                title={
                  enableTransactionPicker
                    ? '操作列已固定在右侧；点击加入后会直接写入订单明细并保持面板打开。'
                    : '操作列已固定在右侧；可以勾选多行后用底部按钮批量加入。'
                }
              >
                <Typography.Text type="secondary">高效选品模式</Typography.Text>
              </Tooltip>,
            ],
          }}
          columns={columns}
          formRef={formRef}
          options={false}
          pagination={{ pageSize: 10 }}
          request={async (params) => {
            const searchKey = String(params.searchKey ?? '').trim();
            const itemGroup = String(params.itemGroup ?? '').trim();
            const brand = String(params.brand ?? '').trim();
            const stockRange = String(params.inStockOnly ?? 'all');
            const warehouseFilter =
              activeWarehouseFilter ||
              String(params.warehouseFilter ?? '').trim();
            const normalizedWarehouseFilter = warehouseFilter || '';
            const inStockOnly =
              params.inStockOnly === true ||
              stockRange === 'in_stock' ||
              Boolean(normalizedWarehouseFilter);
            setActiveWarehouseFilter((current) =>
              current === normalizedWarehouseFilter
                ? current
                : normalizedWarehouseFilter,
            );
            if (
              !enableTransactionPicker &&
              !searchKey &&
              !itemGroup &&
              !brand
            ) {
              return {
                data: [],
                success: true,
                total: 0,
              };
            }
            if (enableTransactionPicker && !searchKey && !itemGroup && !brand) {
              const result = await listProducts({
                brand,
                company: warehouseFilter ? undefined : company,
                disabled: 0,
                inStockOnly,
                itemGroup,
                limit: params.pageSize,
                searchKey: '',
                start: ((params.current ?? 1) - 1) * (params.pageSize ?? 10),
                warehouse: warehouseFilter,
              });
              const filteredItems = result.items.filter((record) =>
                productMatchesContext(record, itemContext),
              );
              return {
                data: filteredItems,
                success: true,
                total: filteredItems.length,
              };
            }
            const result = await searchProducts({
              brand,
              company: warehouseFilter ? undefined : company,
              inStockOnly,
              itemGroup,
              itemContext,
              limit: params.pageSize,
              searchKey,
              start: ((params.current ?? 1) - 1) * (params.pageSize ?? 10),
              warehouse: warehouseFilter,
            });
            return {
              data: result.items,
              success: true,
              total: result.total,
            };
          }}
          rowKey="itemCode"
          scroll={{ x: enableTransactionPicker ? 1180 : 1120, y: '55vh' }}
          search={{
            collapseRender: false,
            defaultCollapsed: false,
            labelWidth: 72,
          }}
          size="small"
          locale={{
            emptyText: enableTransactionPicker
              ? '当前筛选下没有可显示商品'
              : '请输入关键词，或选择商品分类/品牌后搜索商品',
          }}
        />
      </div>
      {transactionSidePanel}
    </div>
  );

  const closePicker = () => {
    setSelectedMap({});
    resetPickerFilters();
    setOpen(false);
  };

  const openPicker = () => {
    resetPickerFilters();
    setOpen(true);
  };

  return (
    <>
      <Button
        icon={<SearchOutlined />}
        onClick={openPicker}
        style={style}
        type="primary"
      >
        {placeholder}
      </Button>
      {enableTransactionPicker ? (
        <Drawer
          destroyOnClose
          footer={pickerFooter}
          onClose={closePicker}
          open={open}
          placement="right"
          title={pickerTitle}
          width="min(1180px, 88vw)"
        >
          {pickerContent}
        </Drawer>
      ) : (
        <Modal
          destroyOnClose
          footer={pickerFooter}
          onCancel={closePicker}
          open={open}
          title={pickerTitle}
          width="min(1280px, 92vw)"
        >
          {pickerContent}
        </Modal>
      )}
      <Modal
        destroyOnClose
        okButtonProps={{ loading: creatingProduct }}
        okText="新增并加入"
        onCancel={() => setQuickCreateOpen(false)}
        onOk={() => void submitQuickCreate()}
        open={quickCreateOpen}
        title="新增商品"
        width={560}
      >
        <Form<QuickCreateProductValues>
          form={quickCreateForm}
          initialValues={{
            defaultWarehouse: warehouse || undefined,
            openingQty: 0,
            openingUom: 'Nos',
          }}
          layout="vertical"
        >
          <Form.Item
            label="商品名称"
            name="itemName"
            rules={[{ required: true, message: '请输入商品名称' }]}
          >
            <Input placeholder="输入商品名称" />
          </Form.Item>
          <Form.Item label="商品昵称" name="nickname">
            <Input placeholder="用于别名、简称或搜索" />
          </Form.Item>
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            }}
          >
            <Form.Item label="入库仓库" name="defaultWarehouse">
              <RemoteLinkSelect
                doctype="Warehouse"
                extraFields={['company']}
                filters={{ company, disabled: 0, is_group: 0 }}
                placeholder="默认仓库"
              />
            </Form.Item>
            <Form.Item label="入库单位" name="openingUom">
              <UomSelect placeholder="选择单位" />
            </Form.Item>
            <Form.Item label="初始库存" name="openingQty">
              <InputNumber min={0} precision={3} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="参考售价" name="standardRate">
              <InputNumber
                min={0}
                precision={2}
                prefix="¥"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </div>
          <Form.Item label="备注" name="description">
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
          <Typography.Text type="secondary">
            新增成功后会自动加入当前订单明细；初始库存会落入所选仓库。
          </Typography.Text>
        </Form>
      </Modal>
      <Drawer
        destroyOnClose
        onClose={() => setAdjustingProduct(null)}
        open={Boolean(adjustingProduct)}
        title={
          adjustingProduct
            ? `调整 ${productLabel(adjustingProduct)}`
            : '调整选品参数'
        }
        width={460}
      >
        {adjustingProduct ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Space orientation="vertical" size={4}>
              <Typography.Text strong>
                {productLabel(adjustingProduct)}
              </Typography.Text>
              <Typography.Text type="secondary">
                {adjustingProduct.itemCode}
                {adjustingProduct.specification
                  ? ` · ${adjustingProduct.specification}`
                  : ''}
              </Typography.Text>
            </Space>

            {itemContext === 'sales' || itemContext === 'purchase' ? (
              <Space orientation="vertical" size={6} style={{ width: '100%' }}>
                <Typography.Text type="secondary">
                  {itemContext === 'purchase' ? '取值模式' : '销售模式'}
                </Typography.Text>
                <Select
                  onChange={(value: ProductSelectSalesMode) => {
                    setRowSalesModeMap((current) => ({
                      ...current,
                      [adjustingProduct.itemCode]: value,
                    }));
                    setRowUomMap((current) => ({
                      ...current,
                      [adjustingProduct.itemCode]:
                        getProductModeDefaultUom(adjustingProduct, value) ??
                        null,
                    }));
                    if (itemContext === 'sales') {
                      setRowPriceMap((current) => ({
                        ...current,
                        [adjustingProduct.itemCode]: getProductModeDefaultPrice(
                          adjustingProduct,
                          value,
                        ),
                      }));
                    }
                  }}
                  options={[
                    { label: '批发', value: 'wholesale' },
                    { label: '零售', value: 'retail' },
                  ]}
                  value={rowSalesMode(adjustingProduct)}
                  style={{ width: '100%' }}
                />
              </Space>
            ) : null}

            <Space orientation="vertical" size={6} style={{ width: '100%' }}>
              <Typography.Text type="secondary">单位</Typography.Text>
              <Select
                onChange={(value) => {
                  setRowUomMap((current) => ({
                    ...current,
                    [adjustingProduct.itemCode]: value,
                  }));
                }}
                options={getProductAvailableUoms(adjustingProduct).map(
                  (uom) => ({
                    label: resolveUomDisplay(
                      uom,
                      adjustingProduct.allUomDisplays,
                    ),
                    value: uom,
                  }),
                )}
                value={rowUom(adjustingProduct) ?? undefined}
                style={{ width: '100%' }}
              />
            </Space>

            <Space orientation="vertical" size={6} style={{ width: '100%' }}>
              <Typography.Text type="secondary">
                {itemContext === 'purchase' ? '入库仓' : '仓库'}
              </Typography.Text>
              <Select
                onChange={(value) => {
                  setRowWarehouseMap((current) => ({
                    ...current,
                    [adjustingProduct.itemCode]: value,
                  }));
                }}
                options={warehouseOptions(adjustingProduct, warehouse)}
                placeholder="选择仓库"
                showSearch
                value={rowWarehouse(adjustingProduct) || undefined}
                style={{ width: '100%' }}
              />
            </Space>

            <Space size={12} style={{ width: '100%' }}>
              <Space orientation="vertical" size={6} style={{ flex: 1 }}>
                <Typography.Text type="secondary">数量</Typography.Text>
                <InputNumber
                  min={1}
                  onChange={(value) => {
                    setRowQtyMap((current) => ({
                      ...current,
                      [adjustingProduct.itemCode]: Number(value ?? 1),
                    }));
                  }}
                  precision={0}
                  value={rowQty(adjustingProduct.itemCode)}
                  style={{ width: '100%' }}
                />
              </Space>
              <Space orientation="vertical" size={6} style={{ flex: 1 }}>
                <Typography.Text type="secondary">单价</Typography.Text>
                <InputNumber
                  min={0}
                  onChange={(value) => {
                    setRowPriceMap((current) => ({
                      ...current,
                      [adjustingProduct.itemCode]:
                        typeof value === 'number' && Number.isFinite(value)
                          ? value
                          : null,
                    }));
                  }}
                  precision={2}
                  prefix="¥"
                  value={rowPrice(adjustingProduct) ?? undefined}
                  style={{ width: '100%' }}
                />
              </Space>
            </Space>

            <Divider style={{ margin: '4px 0' }} />
            <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
              <Button onClick={() => setAdjustingProduct(null)}>取消</Button>
              {enableBatch ? (
                <Button
                  onClick={() => {
                    stageLine(adjustingProduct);
                    setAdjustingProduct(null);
                  }}
                >
                  暂存
                </Button>
              ) : null}
              <Button
                onClick={() => {
                  selectProductNow(adjustingProduct);
                  setAdjustingProduct(null);
                }}
                type="primary"
              >
                加入明细
              </Button>
            </Space>
          </Space>
        ) : null}
      </Drawer>
      <Drawer
        onClose={() => setDetailOpen(false)}
        open={detailOpen}
        title="已选业务明细"
        width={720}
      >
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          {groupedSelectedRows.map((group) => (
            <div
              key={group.itemCode}
              style={{
                border: '1px solid #f0f0f0',
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  background: '#fafafa',
                  padding: '10px 12px',
                }}
              >
                <Space>
                  <Typography.Text strong>{group.itemName}</Typography.Text>
                  <Typography.Text type="secondary">
                    {group.itemCode}
                  </Typography.Text>
                  <Tag color="blue">{group.rows.length} 行</Tag>
                </Space>
              </div>
              <Table<ProductSelectLine>
                columns={[
                  {
                    dataIndex: 'warehouse',
                    title: '仓库',
                    width: 180,
                  },
                  {
                    dataIndex: 'uom',
                    render: (_, line) =>
                      resolveUomDisplay(
                        line.uom,
                        line.product.allUomDisplays,
                        line.product.uomDisplay,
                      ),
                    title: '单位',
                    width: 90,
                  },
                  ...(itemContext === 'sales' || itemContext === 'purchase'
                    ? [
                        {
                          dataIndex: 'salesMode',
                          render: (value: ProductSelectSalesMode) =>
                            value === 'retail' ? '零售' : '批发',
                          title: itemContext === 'purchase' ? '取值' : '模式',
                          width: 80,
                        },
                      ]
                    : []),
                  {
                    dataIndex: 'price',
                    render: (value) =>
                      value == null ? '未设置' : formatCurrencyValue(value),
                    title: '单价',
                    width: 110,
                  },
                  {
                    dataIndex: 'qty',
                    render: (_, line) => (
                      <InputNumber
                        min={1}
                        onChange={(value) => {
                          setSelectedMap((current) => ({
                            ...current,
                            [line.key]: {
                              ...line,
                              qty: Math.max(1, Number(value ?? 1)),
                            },
                          }));
                        }}
                        precision={0}
                        size="small"
                        value={line.qty}
                        style={{ width: 82 }}
                      />
                    ),
                    title: '数量',
                    width: 100,
                  },
                  {
                    render: (_, line) => (
                      <Button
                        danger
                        onClick={() => {
                          setSelectedMap((current) => {
                            const next = { ...current };
                            delete next[line.key];
                            return next;
                          });
                        }}
                        size="small"
                        type="link"
                      >
                        删除
                      </Button>
                    ),
                    title: '操作',
                    width: 80,
                  },
                ]}
                dataSource={group.rows}
                pagination={false}
                rowKey="key"
                size="small"
              />
            </div>
          ))}
        </Space>
      </Drawer>
    </>
  );
}
