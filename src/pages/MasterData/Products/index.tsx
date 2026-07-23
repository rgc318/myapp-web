import {
  CheckCircleOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Link } from '@umijs/max';
import {
  Alert,
  Button,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  message,
  Popconfirm,
  Space,
  Switch,
  Tag,
  Typography,
  Upload,
} from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { CurrencySelect } from '@/components/CurrencySelect';
import { ItemImageUpload } from '@/components/ItemImageUpload';
import { RemoteLinkSelect } from '@/components/RemoteLinkSelect';
import { UomSelect } from '@/components/UomSelect';
import { toOptionalText } from '@/services/myapp/api-utils';
import {
  bulkSetProductsDisabled,
  bulkUpdateProducts,
  createProduct,
  listProducts,
  type ProductSummary,
  type SaveProductPayload,
  setProductDisabled,
  updateProduct,
} from '@/services/myapp/master-data';
import { formatCurrencyValue, resolveDisplayUom } from '@/utils/myapp-display';

const PAGE_SIZE = 20;
const EXPORT_LIMIT = 1000;

type ProductFormValues = SaveProductPayload;
type ProductListQuery = {
  brandFilter?: string;
  company?: string;
  disabledFilter?: string;
  itemGroupFilter?: string;
  searchKey?: string;
  stockScope?: string;
  warehouseFilter?: string;
};
type ProductBulkFormValues = {
  brand?: string | null;
  itemGroup?: string | null;
};
type ProductImportAction = 'create' | 'update';
type ProductImportStatus = 'pending' | 'success' | 'error';
type ProductImportRowBase = {
  action: ProductImportAction;
  error?: string;
  itemCode?: string | null;
  itemName: string;
  line: number;
  status: ProductImportStatus;
};
type ProductImportRow =
  | (ProductImportRowBase & {
      action: 'create';
      payload: SaveProductPayload;
    })
  | (ProductImportRowBase & {
      action: 'update';
      payload: Partial<SaveProductPayload>;
    });

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function formatBarcodeList(record: ProductSummary) {
  const barcodes = record.barcodes.map((row) => row.barcode).filter(Boolean);
  if (barcodes.length) {
    return barcodes.join(' / ');
  }
  return record.barcode || '';
}

function normalizeCsvHeader(value: string) {
  return value
    .trim()
    .replace(/^\uFEFF/, '')
    .toLowerCase();
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];
    if (char === '"' && quoted && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(text: string) {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim());
  if (lines.length < 2) {
    return [];
  }
  const headers = splitCsvLine(lines[0]).map(normalizeCsvHeader);
  return lines.slice(1).map((line, index) => {
    const cells = splitCsvLine(line);
    return headers.reduce<Record<string, string>>(
      (row, header, cellIndex) => {
        row[header] = cells[cellIndex]?.trim() ?? '';
        return row;
      },
      { __line: String(index + 2) },
    );
  });
}

function readCsvField(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeCsvHeader(key)]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function readCsvNumber(row: Record<string, string>, keys: string[]) {
  const value = readCsvField(row, keys);
  if (!value) {
    return undefined;
  }
  const parsed = Number(value.replaceAll(',', ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readCsvBoolean(row: Record<string, string>, keys: string[]) {
  const value = readCsvField(row, keys)?.toLowerCase();
  if (!value) {
    return undefined;
  }
  if (['1', 'true', 'yes', 'y', '停用', '禁用', 'disabled'].includes(value)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', '启用', 'enabled'].includes(value)) {
    return false;
  }
  return undefined;
}

function mapImportAction(value?: string): ProductImportAction {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'update' || normalized === '更新') {
    return 'update';
  }
  return 'create';
}

function setOptionalTextPayload<K extends keyof SaveProductPayload>(
  payload: Partial<SaveProductPayload>,
  key: K,
  value: SaveProductPayload[K] | undefined,
) {
  if (value !== undefined) {
    payload[key] = value;
  }
}

function setOptionalNumberPayload<K extends keyof SaveProductPayload>(
  payload: Partial<SaveProductPayload>,
  key: K,
  value: SaveProductPayload[K] | undefined,
) {
  if (value !== undefined) {
    payload[key] = value;
  }
}

function buildImportRows(
  rawRows: Record<string, string>[],
): ProductImportRow[] {
  return rawRows.map((row) => {
    const action = mapImportAction(readCsvField(row, ['action', '导入动作']));
    const itemCode = readCsvField(row, ['itemCode', 'item_code', '商品编码']);
    const itemName =
      readCsvField(row, ['itemName', 'item_name', '商品名称']) ?? '';
    const stockUom =
      readCsvField(row, ['stockUom', 'stock_uom', '库存单位']) ?? 'Nos';
    const barcode = readCsvField(row, ['barcode', '主条码', '条码']);
    const brand = readCsvField(row, ['brand', '品牌']);
    const currency = readCsvField(row, ['currency', '币种']);
    const description = readCsvField(row, ['description', '描述']);
    const disabled = readCsvBoolean(row, ['disabled', '停用']);
    const itemGroup = readCsvField(row, [
      'itemGroup',
      'item_group',
      '商品分类',
    ]);
    const retailDefaultUom = readCsvField(row, [
      'retailDefaultUom',
      'retail_default_uom',
      '零售默认单位',
    ]);
    const retailRate = readCsvNumber(row, [
      'retailRate',
      'retail_rate',
      '零售价',
    ]);
    const standardBuyingRate = readCsvNumber(row, [
      'standardBuyingRate',
      'standard_buying_rate',
      '标准采购价',
      '采购价',
    ]);
    const standardSellingRate = readCsvNumber(row, [
      'standardSellingRate',
      'standard_rate',
      '标准售价',
    ]);
    const valuationRate = readCsvNumber(row, [
      'valuationRate',
      'valuation_rate',
      '估值价',
    ]);
    const wholesaleDefaultUom = readCsvField(row, [
      'wholesaleDefaultUom',
      'wholesale_default_uom',
      '批发默认单位',
    ]);
    const wholesaleRate = readCsvNumber(row, [
      'wholesaleRate',
      'wholesale_rate',
      '批发价',
    ]);

    if (action === 'update') {
      const payload: Partial<SaveProductPayload> = {};
      setOptionalTextPayload(payload, 'barcode', barcode);
      setOptionalTextPayload(payload, 'brand', brand);
      setOptionalTextPayload(payload, 'currency', currency);
      setOptionalTextPayload(payload, 'description', description);
      setOptionalTextPayload(payload, 'itemGroup', itemGroup);
      setOptionalTextPayload(payload, 'itemName', itemName || undefined);
      setOptionalTextPayload(payload, 'retailDefaultUom', retailDefaultUom);
      setOptionalTextPayload(
        payload,
        'stockUom',
        readCsvField(row, ['stockUom', 'stock_uom', '库存单位']),
      );
      setOptionalTextPayload(
        payload,
        'wholesaleDefaultUom',
        wholesaleDefaultUom,
      );
      setOptionalNumberPayload(payload, 'retailRate', retailRate);
      setOptionalNumberPayload(
        payload,
        'standardBuyingRate',
        standardBuyingRate,
      );
      setOptionalNumberPayload(
        payload,
        'standardSellingRate',
        standardSellingRate,
      );
      setOptionalNumberPayload(payload, 'valuationRate', valuationRate);
      setOptionalNumberPayload(payload, 'wholesaleRate', wholesaleRate);
      if (disabled !== undefined) {
        payload.disabled = disabled;
      }
      const error = !itemCode
        ? '更新商品必须填写商品编码'
        : Object.keys(payload).length === 0
          ? '更新商品必须至少填写一个更新字段'
          : undefined;
      return {
        action,
        error,
        itemCode,
        itemName,
        line: Number(row.__line ?? 0),
        payload,
        status: error ? 'error' : 'pending',
      };
    }

    const payload: SaveProductPayload = {
      barcode: barcode ?? null,
      brand: brand ?? null,
      currency: currency ?? 'CNY',
      description: description ?? null,
      disabled,
      itemCode: itemCode ?? null,
      itemGroup: itemGroup ?? null,
      itemName,
      retailDefaultUom: retailDefaultUom ?? stockUom,
      retailRate,
      standardBuyingRate,
      standardSellingRate,
      stockUom,
      valuationRate,
      wholesaleDefaultUom: wholesaleDefaultUom ?? stockUom,
      wholesaleRate,
    };
    const error =
      !itemName && action === 'create' ? '新增商品必须填写商品名称' : undefined;
    return {
      action,
      error,
      itemCode,
      itemName,
      line: Number(row.__line ?? 0),
      payload,
      status: error ? 'error' : 'pending',
    };
  });
}

function buildProductListOptions(
  params: ProductListQuery,
  pageSize: number,
  current: number,
) {
  const disabledFilter = String(params.disabledFilter ?? 'enabled');
  const stockScope = String(params.stockScope ?? 'all');

  return {
    brand: toOptionalText(params.brandFilter),
    company: toOptionalText(params.company),
    disabled:
      disabledFilter === 'enabled'
        ? (0 as const)
        : disabledFilter === 'disabled'
          ? (1 as const)
          : undefined,
    inStockOnly: stockScope === 'in_stock',
    itemGroup: toOptionalText(params.itemGroupFilter),
    limit: pageSize,
    searchKey: String(params.searchKey ?? ''),
    start: (current - 1) * pageSize,
    warehouse: toOptionalText(params.warehouseFilter),
  };
}

function normalizeProductListQuery(
  params: Record<string, unknown>,
): ProductListQuery {
  return {
    brandFilter: toOptionalText(params.brandFilter) ?? undefined,
    company: toOptionalText(params.company) ?? undefined,
    disabledFilter: String(params.disabledFilter ?? 'enabled'),
    itemGroupFilter: toOptionalText(params.itemGroupFilter) ?? undefined,
    searchKey: String(params.searchKey ?? ''),
    stockScope: String(params.stockScope ?? 'all'),
    warehouseFilter: toOptionalText(params.warehouseFilter) ?? undefined,
  };
}

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const content = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${content}`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildColumns({
  onEdit,
  onToggleDisabled,
  togglingProduct,
}: {
  onEdit: (record: ProductSummary) => void;
  onToggleDisabled: (record: ProductSummary) => void;
  togglingProduct?: string;
}): ProColumns<ProductSummary>[] {
  return [
    {
      title: '关键词',
      dataIndex: 'searchKey',
      hideInTable: true,
      fieldProps: {
        allowClear: true,
        placeholder: '商品编码 / 名称 / 条码',
      },
    },
    {
      title: '公司',
      dataIndex: 'company',
      hideInTable: true,
      formItemRender: (_, { onChange, value }, form) => (
        <RemoteLinkSelect
          doctype="Company"
          onChange={(nextValue) => {
            const company = toOptionalText(nextValue);
            form.setFieldValue?.('company', company);
            onChange?.(company);
          }}
          placeholder="搜索公司"
          style={{ width: '100%' }}
          value={
            toOptionalText(value) ??
            toOptionalText(form.getFieldValue?.('company'))
          }
        />
      ),
    },
    {
      title: '仓库',
      dataIndex: 'warehouseFilter',
      hideInTable: true,
      formItemRender: (_, { onChange, value }, form) => (
        <RemoteLinkSelect
          doctype="Warehouse"
          onChange={(nextValue) => {
            const warehouse = toOptionalText(nextValue);
            form.setFieldValue?.('warehouseFilter', warehouse);
            onChange?.(warehouse);
          }}
          placeholder="搜索仓库"
          style={{ width: '100%' }}
          value={
            toOptionalText(value) ??
            toOptionalText(form.getFieldValue?.('warehouseFilter'))
          }
        />
      ),
    },
    {
      title: '商品分类',
      dataIndex: 'itemGroupFilter',
      hideInTable: true,
      formItemRender: (_, { onChange, value }, form) => (
        <RemoteLinkSelect
          doctype="Item Group"
          onChange={(nextValue) => {
            const itemGroup = toOptionalText(nextValue);
            form.setFieldValue?.('itemGroupFilter', itemGroup);
            onChange?.(itemGroup);
          }}
          placeholder="搜索商品分类"
          style={{ width: '100%' }}
          value={
            toOptionalText(value) ??
            toOptionalText(form.getFieldValue?.('itemGroupFilter'))
          }
        />
      ),
    },
    {
      title: '品牌',
      dataIndex: 'brandFilter',
      hideInTable: true,
      formItemRender: (_, { onChange, value }, form) => (
        <RemoteLinkSelect
          doctype="Brand"
          onChange={(nextValue) => {
            const brand = toOptionalText(nextValue);
            form.setFieldValue?.('brandFilter', brand);
            onChange?.(brand);
          }}
          placeholder="搜索品牌"
          style={{ width: '100%' }}
          value={
            toOptionalText(value) ??
            toOptionalText(form.getFieldValue?.('brandFilter'))
          }
        />
      ),
    },
    {
      title: '库存范围',
      dataIndex: 'stockScope',
      hideInTable: true,
      initialValue: 'all',
      valueEnum: {
        all: { text: '全部' },
        in_stock: { text: '仅有库存' },
      },
    },
    {
      title: '状态',
      dataIndex: 'disabledFilter',
      hideInTable: true,
      initialValue: 'enabled',
      valueEnum: {
        all: { text: '全部' },
        enabled: { text: '启用' },
        disabled: { text: '停用' },
      },
    },
    {
      title: '图片',
      dataIndex: 'imageUrl',
      search: false,
      width: 64,
      render: (_, record) =>
        record.imageUrl ? (
          <Image height={40} src={record.imageUrl} width={40} />
        ) : (
          '-'
        ),
    },
    {
      title: '商品编码',
      dataIndex: 'itemCode',
      search: false,
      fixed: 'left',
      width: 180,
      render: (_, record) => (
        <Link
          style={{ display: 'inline-block', maxWidth: 164 }}
          to={`/master-data/products/${encodeURIComponent(record.itemCode)}`}
        >
          <Typography.Text
            ellipsis={{ tooltip: record.itemCode }}
            style={{ maxWidth: 164, whiteSpace: 'nowrap' }}
          >
            {record.itemCode}
          </Typography.Text>
        </Link>
      ),
    },
    {
      title: '商品名称',
      dataIndex: 'itemName',
      search: false,
      ellipsis: true,
      width: 220,
    },
    {
      title: '规格',
      dataIndex: 'specification',
      search: false,
      ellipsis: true,
      width: 140,
      renderText: (value) => value || '-',
    },
    {
      title: '分类',
      dataIndex: 'itemGroup',
      search: false,
      ellipsis: true,
      width: 120,
      renderText: (value) => value || '-',
    },
    {
      title: '品牌',
      dataIndex: 'brand',
      search: false,
      ellipsis: true,
      width: 120,
      renderText: (value) => value || '-',
    },
    {
      title: '条码',
      dataIndex: 'barcode',
      search: false,
      ellipsis: true,
      width: 160,
      render: (_, record) => {
        const count = record.barcodes.length;
        return (
          <Space size={4} wrap>
            <Typography.Text
              ellipsis={{ tooltip: record.barcode }}
              style={{ maxWidth: count > 1 ? 92 : 132, whiteSpace: 'nowrap' }}
            >
              {record.barcode || '-'}
            </Typography.Text>
            {count > 1 ? <Tag>{count} 条</Tag> : null}
          </Space>
        );
      },
    },
    {
      title: '库存',
      dataIndex: 'stockQty',
      align: 'right',
      search: false,
      width: 110,
      render: (_, record) => formatNumber(record.stockQty),
    },
    {
      title: '单位',
      dataIndex: 'stockUom',
      search: false,
      width: 100,
      render: (_, record) =>
        resolveDisplayUom(record.stockUom, record.stockUomDisplay),
    },
    {
      title: '价格',
      dataIndex: 'price',
      align: 'right',
      search: false,
      width: 120,
      render: (_, record) => formatCurrencyValue(record.price),
    },
    {
      title: '批发价',
      key: 'wholesaleRate',
      dataIndex: ['priceSummary', 'wholesaleRate'],
      align: 'right',
      search: false,
      width: 120,
      render: (_, record) =>
        formatCurrencyValue(record.priceSummary?.wholesaleRate),
    },
    {
      title: '零售价',
      key: 'retailRate',
      dataIndex: ['priceSummary', 'retailRate'],
      align: 'right',
      search: false,
      width: 120,
      render: (_, record) =>
        formatCurrencyValue(record.priceSummary?.retailRate),
    },
    {
      title: '采购价',
      key: 'standardBuyingRate',
      dataIndex: ['priceSummary', 'standardBuyingRate'],
      align: 'right',
      search: false,
      width: 120,
      render: (_, record) =>
        formatCurrencyValue(record.priceSummary?.standardBuyingRate),
    },
    {
      title: '状态',
      dataIndex: 'disabled',
      search: false,
      width: 90,
      render: (_, record) =>
        record.disabled ? <Tag>停用</Tag> : <Tag color="green">启用</Tag>,
    },
    {
      title: '操作',
      fixed: 'right',
      valueType: 'option',
      width: 136,
      render: (_, record) => [
        <Button key="view" type="link">
          <Link
            to={`/master-data/products/${encodeURIComponent(record.itemCode)}`}
          >
            查看
          </Link>
        </Button>,
        <Button key="edit" type="link" onClick={() => onEdit(record)}>
          编辑
        </Button>,
        <Popconfirm
          key="toggle"
          cancelText="取消"
          okText={record.disabled ? '启用' : '停用'}
          onConfirm={() => onToggleDisabled(record)}
          title={`${record.disabled ? '启用' : '停用'}商品 ${record.itemName || record.itemCode}？`}
        >
          <Button
            danger={!record.disabled}
            loading={togglingProduct === record.itemCode}
            type="link"
          >
            {record.disabled ? '启用' : '停用'}
          </Button>
        </Popconfirm>,
      ],
    },
  ];
}

const ProductsPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [form] = Form.useForm<ProductFormValues>();
  const [bulkForm] = Form.useForm<ProductBulkFormValues>();
  const [editingProduct, setEditingProduct] = useState<ProductSummary | null>(
    null,
  );
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [lastQuery, setLastQuery] = useState<ProductListQuery>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importRows, setImportRows] = useState<ProductImportRow[]>([]);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [togglingProduct, setTogglingProduct] = useState<string>();
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>();

  const selectedItemCodes = selectedRowKeys.map(String);
  const validImportRows = importRows.filter((row) => !row.error);

  useEffect(() => {
    const draftId = new URLSearchParams(window.location.search).get('ai_draft');
    if (!draftId) return;
    const storageKey = `myapp:ai-product-setup-draft:${draftId}`;
    const stored = sessionStorage.getItem(storageKey);
    if (!stored) return;
    try {
      const payload = JSON.parse(stored) as Record<string, unknown>;
      setEditingProduct(null);
      setUploadedImageUrl(undefined);
      form.resetFields();
      form.setFieldsValue({
        brand: typeof payload.brand === 'string' ? payload.brand : undefined,
        company:
          typeof payload.company === 'string' ? payload.company : undefined,
        currency:
          typeof payload.currency === 'string' ? payload.currency : 'CNY',
        description:
          typeof payload.description === 'string'
            ? payload.description
            : undefined,
        disabled: false,
        itemCode:
          typeof payload.item_code === 'string' ? payload.item_code : undefined,
        itemGroup:
          typeof payload.item_group === 'string'
            ? payload.item_group
            : undefined,
        itemName: String(payload.item_name ?? ''),
        standardSellingRate:
          payload.standard_selling_rate === null ||
          payload.standard_selling_rate === undefined
            ? undefined
            : Number(payload.standard_selling_rate),
        standardBuyingRate:
          payload.standard_buying_rate === null ||
          payload.standard_buying_rate === undefined
            ? undefined
            : Number(payload.standard_buying_rate),
        wholesaleRate:
          payload.wholesale_rate === null ||
          payload.wholesale_rate === undefined
            ? undefined
            : Number(payload.wholesale_rate),
        retailRate:
          payload.retail_rate === null || payload.retail_rate === undefined
            ? undefined
            : Number(payload.retail_rate),
        stockUom:
          typeof payload.stock_uom === 'string' ? payload.stock_uom : 'Nos',
        valuationRate:
          payload.valuation_rate === null ||
          payload.valuation_rate === undefined
            ? payload.standard_buying_rate === null ||
              payload.standard_buying_rate === undefined
              ? undefined
              : Number(payload.standard_buying_rate)
            : Number(payload.valuation_rate),
        warehouse:
          typeof payload.warehouse === 'string' ? payload.warehouse : undefined,
        warehouseStockQty:
          payload.warehouse_stock_qty === null ||
          payload.warehouse_stock_qty === undefined
            ? undefined
            : Number(payload.warehouse_stock_qty),
        warehouseStockUom:
          typeof payload.warehouse_stock_uom === 'string'
            ? payload.warehouse_stock_uom
            : typeof payload.stock_uom === 'string'
              ? payload.stock_uom
              : 'Nos',
      });
      setModalOpen(true);
      sessionStorage.removeItem(storageKey);
    } catch {
      message.error('AI 商品草稿载荷格式不正确');
    }
  }, [form]);

  const reload = () => {
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setUploadedImageUrl(undefined);
    form.resetFields();
    form.setFieldsValue({
      currency: 'CNY',
      disabled: false,
      stockUom: 'Nos',
    });
    setModalOpen(true);
  };

  const openEditModal = (record: ProductSummary) => {
    setEditingProduct(record);
    setUploadedImageUrl(undefined);
    form.setFieldsValue({
      barcode: record.barcode,
      brand: record.brand,
      currency: 'CNY',
      description: record.description,
      disabled: record.disabled,
      itemGroup: record.itemGroup,
      itemName: record.itemName,
      retailDefaultUom: record.retailDefaultUom ?? record.stockUom,
      standardBuyingRate: record.priceSummary?.standardBuyingRate ?? undefined,
      standardSellingRate:
        record.priceSummary?.standardSellingRate ??
        record.priceSummary?.currentRate ??
        undefined,
      retailRate: record.priceSummary?.retailRate ?? undefined,
      stockUom: record.stockUom,
      valuationRate: record.priceSummary?.valuationRate ?? undefined,
      wholesaleDefaultUom: record.wholesaleDefaultUom ?? record.stockUom,
      wholesaleRate: record.priceSummary?.wholesaleRate ?? undefined,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: ProductFormValues) => {
    setSubmitting(true);
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.itemCode, values);
      } else {
        await createProduct({
          ...values,
          image: uploadedImageUrl,
        });
      }
      setModalOpen(false);
      setUploadedImageUrl(undefined);
      reload();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleDisabled = async (record: ProductSummary) => {
    setTogglingProduct(record.itemCode);
    try {
      await setProductDisabled(record.itemCode, !record.disabled);
      reload();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '操作失败');
    } finally {
      setTogglingProduct(undefined);
    }
  };

  const handleBulkDisabled = async (disabled: boolean) => {
    if (!selectedItemCodes.length) {
      message.warning('请先选择商品');
      return;
    }
    setBulkSubmitting(true);
    try {
      await bulkSetProductsDisabled(selectedItemCodes, disabled);
      message.success(
        `${selectedItemCodes.length} 个商品已${disabled ? '停用' : '启用'}`,
      );
      reload();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '批量操作失败');
    } finally {
      setBulkSubmitting(false);
    }
  };

  const openBulkModal = () => {
    if (!selectedItemCodes.length) {
      message.warning('请先选择商品');
      return;
    }
    bulkForm.resetFields();
    setBulkModalOpen(true);
  };

  const handleBulkUpdate = async (values: ProductBulkFormValues) => {
    const itemGroup = toOptionalText(values.itemGroup);
    const brand = toOptionalText(values.brand);
    if (!itemGroup && !brand) {
      message.warning('请选择要修改的分类或品牌');
      return;
    }
    setBulkSubmitting(true);
    try {
      await bulkUpdateProducts(selectedItemCodes, {
        ...(itemGroup ? { itemGroup } : {}),
        ...(brand ? { brand } : {}),
      });
      message.success(`${selectedItemCodes.length} 个商品已更新`);
      setBulkModalOpen(false);
      reload();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '批量更新失败');
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await listProducts({
        ...buildProductListOptions(lastQuery, EXPORT_LIMIT, 1),
        limit: EXPORT_LIMIT,
        start: 0,
      });
      downloadCsv('products.csv', [
        [
          '商品编码',
          '商品名称',
          '规格',
          '分类',
          '品牌',
          '主条码',
          '全部条码',
          '库存',
          '总库存',
          '单位',
          '标准售价',
          '批发价',
          '零售价',
          '采购价',
          '状态',
        ],
        ...result.items.map((item) => [
          item.itemCode,
          item.itemName,
          item.specification,
          item.itemGroup,
          item.brand,
          item.barcode,
          formatBarcodeList(item),
          String(item.stockQty ?? ''),
          String(item.totalQty ?? ''),
          resolveDisplayUom(item.stockUom, item.stockUomDisplay),
          String(item.priceSummary?.standardSellingRate ?? ''),
          String(item.priceSummary?.wholesaleRate ?? ''),
          String(item.priceSummary?.retailRate ?? ''),
          String(item.priceSummary?.standardBuyingRate ?? ''),
          item.disabled ? '停用' : '启用',
        ]),
      ]);
      message.success(`已导出 ${result.items.length} 条商品`);
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const downloadImportTemplate = () => {
    downloadCsv('products-import-template.csv', [
      [
        '导入动作',
        '商品编码',
        '商品名称',
        '商品分类',
        '品牌',
        '主条码',
        '库存单位',
        '批发默认单位',
        '零售默认单位',
        '标准售价',
        '批发价',
        '零售价',
        '标准采购价',
        '估值价',
        '币种',
        '停用',
        '描述',
      ],
      [
        'create',
        'ITEM-001',
        '示例商品',
        'All Item Groups',
        '示例品牌',
        '690000000001',
        'Nos',
        'Nos',
        'Nos',
        '12.00',
        '10.00',
        '13.00',
        '8.00',
        '8.00',
        'CNY',
        '0',
        '示例描述',
      ],
      [
        'update',
        'ITEM-001',
        '示例商品-更新',
        '',
        '',
        '',
        'Nos',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'CNY',
        '',
        '',
      ],
    ]);
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const rows = buildImportRows(parseCsv(text));
      setImportRows(rows);
      setImportModalOpen(true);
      if (!rows.length) {
        message.warning('未读取到可导入的商品行');
      }
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '读取 CSV 失败');
    }
    return Upload.LIST_IGNORE;
  };

  const handleRunImport = async () => {
    if (!validImportRows.length) {
      message.warning('没有可执行的导入行');
      return;
    }
    setImportSubmitting(true);
    const nextRows = [...importRows];
    try {
      for (const row of nextRows) {
        if (row.error) {
          continue;
        }
        try {
          if (row.action === 'update') {
            await updateProduct(String(row.itemCode), row.payload);
          } else {
            await createProduct(row.payload);
          }
          row.status = 'success';
          row.error = undefined;
        } catch (caught) {
          row.status = 'error';
          row.error = caught instanceof Error ? caught.message : '导入失败';
        }
        setImportRows([...nextRows]);
      }
      const successCount = nextRows.filter(
        (row) => row.status === 'success',
      ).length;
      const errorCount = nextRows.filter(
        (row) => row.status === 'error',
      ).length;
      message.success(
        `导入完成：成功 ${successCount} 行，失败 ${errorCount} 行`,
      );
      reload();
    } finally {
      setImportSubmitting(false);
    }
  };

  const columns = buildColumns({
    onEdit: openEditModal,
    onToggleDisabled: handleToggleDisabled,
    togglingProduct,
  });

  return (
    <PageContainer
      title="商品"
      extra={[
        <Button
          icon={<PlusOutlined />}
          key="create"
          type="primary"
          onClick={() => openCreateModal()}
        >
          新增商品
        </Button>,
        <Upload
          accept=".csv,text/csv"
          beforeUpload={handleImportFile}
          key="import"
          maxCount={1}
          showUploadList={false}
        >
          <Button icon={<UploadOutlined />}>导入</Button>
        </Upload>,
        <Button
          icon={<ReloadOutlined />}
          key="refresh"
          onClick={() => actionRef.current?.reload()}
        >
          刷新
        </Button>,
      ]}
    >
      <ProTable<ProductSummary>
        actionRef={actionRef}
        columns={columns}
        columnsState={{
          defaultValue: {
            retailRate: { show: false },
            standardBuyingRate: { show: false },
            wholesaleRate: { show: false },
          },
        }}
        pagination={{
          defaultPageSize: PAGE_SIZE,
          showSizeChanger: false,
        }}
        request={async (params) => {
          const current = Number(params.current ?? 1);
          const pageSize = Number(params.pageSize ?? PAGE_SIZE);
          const query = normalizeProductListQuery(params);
          setLastQuery(query);
          const result = await listProducts(
            buildProductListOptions(query, pageSize, current),
          );

          return {
            data: result.items,
            success: true,
            total: result.total,
          };
        }}
        rowKey="itemCode"
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        scroll={{ x: 1460 }}
        search={{
          defaultCollapsed: false,
          labelWidth: 88,
        }}
        tableAlertRender={({ selectedRowKeys: keys }) =>
          `已选择 ${keys.length} 个商品`
        }
        toolBarRender={() => [
          <Button
            disabled={!selectedItemCodes.length}
            icon={<EditOutlined />}
            key="bulk-edit"
            onClick={openBulkModal}
          >
            批量修改
          </Button>,
          <Popconfirm
            key="bulk-enable"
            cancelText="取消"
            disabled={!selectedItemCodes.length}
            okText="启用"
            onConfirm={() => handleBulkDisabled(false)}
            title={`启用选中的 ${selectedItemCodes.length} 个商品？`}
          >
            <Button
              disabled={!selectedItemCodes.length}
              icon={<CheckCircleOutlined />}
              loading={bulkSubmitting}
            >
              批量启用
            </Button>
          </Popconfirm>,
          <Popconfirm
            key="bulk-disable"
            cancelText="取消"
            disabled={!selectedItemCodes.length}
            okText="停用"
            onConfirm={() => handleBulkDisabled(true)}
            title={`停用选中的 ${selectedItemCodes.length} 个商品？`}
          >
            <Button
              danger
              disabled={!selectedItemCodes.length}
              icon={<StopOutlined />}
              loading={bulkSubmitting}
            >
              批量停用
            </Button>
          </Popconfirm>,
          <Button
            icon={<DownloadOutlined />}
            key="export"
            loading={exporting}
            onClick={handleExport}
          >
            导出
          </Button>,
        ]}
      />
      <Modal
        cancelText="关闭"
        confirmLoading={importSubmitting}
        destroyOnHidden
        okButtonProps={{
          disabled: !validImportRows.length,
        }}
        okText="开始导入"
        onCancel={() => setImportModalOpen(false)}
        onOk={handleRunImport}
        open={importModalOpen}
        title="批量导入商品"
        width={1040}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            message="CSV 导入按行执行；导入动作为 create 时创建商品，为 update 时按商品编码更新商品。"
            showIcon
            type="info"
          />
          <Space wrap>
            <Button
              icon={<DownloadOutlined />}
              onClick={downloadImportTemplate}
            >
              下载模板
            </Button>
            <Typography.Text type="secondary">
              已读取 {importRows.length} 行，可执行 {validImportRows.length} 行
            </Typography.Text>
          </Space>
          <ProTable<ProductImportRow>
            columns={[
              {
                title: '行号',
                dataIndex: 'line',
                width: 72,
              },
              {
                title: '动作',
                dataIndex: 'action',
                width: 88,
                render: (_, record) =>
                  record.action === 'update' ? (
                    <Tag color="blue">更新</Tag>
                  ) : (
                    <Tag color="green">新增</Tag>
                  ),
              },
              {
                title: '商品编码',
                dataIndex: 'itemCode',
                ellipsis: true,
                width: 160,
                renderText: (value) => value || '-',
              },
              {
                title: '商品名称',
                dataIndex: 'itemName',
                ellipsis: true,
              },
              {
                title: '分类',
                renderText: (_, record) => record.payload.itemGroup || '-',
                width: 140,
              },
              {
                title: '品牌',
                renderText: (_, record) => record.payload.brand || '-',
                width: 120,
              },
              {
                title: '主条码',
                renderText: (_, record) => record.payload.barcode || '-',
                width: 150,
              },
              {
                title: '状态',
                dataIndex: 'status',
                width: 100,
                render: (_, record) => {
                  if (record.status === 'success') {
                    return <Tag color="green">成功</Tag>;
                  }
                  if (record.status === 'error') {
                    return <Tag color="red">失败</Tag>;
                  }
                  return <Tag>待导入</Tag>;
                },
              },
              {
                title: '提示',
                dataIndex: 'error',
                ellipsis: true,
                renderText: (value) => value || '-',
              },
            ]}
            dataSource={importRows}
            pagination={{ defaultPageSize: 8, showSizeChanger: false }}
            rowKey={(record) =>
              `${record.line}:${record.itemCode ?? record.itemName}`
            }
            search={false}
            size="small"
            toolBarRender={false}
          />
        </Space>
      </Modal>
      <Modal
        confirmLoading={bulkSubmitting}
        destroyOnHidden
        onCancel={() => setBulkModalOpen(false)}
        onOk={() => bulkForm.submit()}
        open={bulkModalOpen}
        title={`批量修改 ${selectedItemCodes.length} 个商品`}
        width={520}
      >
        <Form<ProductBulkFormValues>
          form={bulkForm}
          layout="vertical"
          onFinish={handleBulkUpdate}
        >
          <Form.Item label="商品分类" name="itemGroup">
            <RemoteLinkSelect doctype="Item Group" placeholder="搜索商品分类" />
          </Form.Item>
          <Form.Item label="品牌" name="brand">
            <RemoteLinkSelect doctype="Brand" placeholder="搜索品牌" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        confirmLoading={submitting}
        destroyOnHidden
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        open={modalOpen}
        title={
          editingProduct ? `编辑商品 ${editingProduct.itemCode}` : '新增商品'
        }
        width={720}
      >
        <Form<ProductFormValues>
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item label="商品图片">
            <ItemImageUpload
              itemCode={editingProduct?.itemCode}
              onChange={(fileUrl) => {
                setUploadedImageUrl(fileUrl || undefined);
              }}
              value={editingProduct?.imageUrl}
            />
          </Form.Item>
          {!editingProduct && (
            <Form.Item label="商品编码" name="itemCode">
              <Input placeholder="不填则后端自动生成" />
            </Form.Item>
          )}
          {!editingProduct ? (
            <Form.Item label="公司" name="company">
              <RemoteLinkSelect doctype="Company" placeholder="选择公司" />
            </Form.Item>
          ) : null}
          <Form.Item
            label="商品名称"
            name="itemName"
            rules={[{ required: true, message: '请输入商品名称' }]}
          >
            <Input placeholder="商品名称" />
          </Form.Item>
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item
              label="商品分类"
              name="itemGroup"
              style={{ minWidth: 220 }}
            >
              <RemoteLinkSelect
                doctype="Item Group"
                placeholder="搜索商品分类"
              />
            </Form.Item>
            <Form.Item label="品牌" name="brand" style={{ minWidth: 180 }}>
              <RemoteLinkSelect doctype="Brand" placeholder="搜索品牌" />
            </Form.Item>
            <Form.Item label="主条码" name="barcode" style={{ minWidth: 200 }}>
              <Input placeholder="主条码" />
            </Form.Item>
          </Space>
          {!editingProduct ? (
            <Space size={16} style={{ width: '100%' }}>
              <Form.Item
                label="初始库存数量"
                name="warehouseStockQty"
                style={{ minWidth: 180 }}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                label="初始库存单位"
                name="warehouseStockUom"
                style={{ minWidth: 180 }}
              >
                <UomSelect />
              </Form.Item>
              <Form.Item
                label="入库仓库"
                name="warehouse"
                style={{ minWidth: 240 }}
              >
                <RemoteLinkSelect
                  doctype="Warehouse"
                  filters={{
                    company: form.getFieldValue('company'),
                    disabled: 0,
                    is_group: 0,
                  }}
                  placeholder="有初始库存时必须选择"
                />
              </Form.Item>
            </Space>
          ) : null}
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item
              label="库存单位"
              name="stockUom"
              rules={[{ required: true, message: '请选择库存单位' }]}
              style={{ minWidth: 200 }}
            >
              <UomSelect displayValue={editingProduct?.stockUomDisplay} />
            </Form.Item>
            <Form.Item
              label="批发默认单位"
              name="wholesaleDefaultUom"
              style={{ minWidth: 200 }}
            >
              <UomSelect
                displayValue={editingProduct?.wholesaleDefaultUomDisplay}
              />
            </Form.Item>
            <Form.Item
              label="零售默认单位"
              name="retailDefaultUom"
              style={{ minWidth: 200 }}
            >
              <UomSelect
                displayValue={editingProduct?.retailDefaultUomDisplay}
              />
            </Form.Item>
          </Space>
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item
              label="标准售价"
              name="standardSellingRate"
              style={{ minWidth: 160 }}
            >
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="标准采购价"
              name="standardBuyingRate"
              style={{ minWidth: 160 }}
            >
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="批发价"
              name="wholesaleRate"
              style={{ minWidth: 160 }}
            >
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="零售价"
              name="retailRate"
              style={{ minWidth: 160 }}
            >
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item
              label="估值价"
              name="valuationRate"
              style={{ minWidth: 160 }}
            >
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="币种" name="currency" style={{ minWidth: 120 }}>
              <CurrencySelect />
            </Form.Item>
          </Space>
          <Form.Item label="描述" name="description">
            <Input.TextArea autoSize={{ maxRows: 4, minRows: 2 }} />
          </Form.Item>
          <Form.Item label="停用" name="disabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default ProductsPage;
