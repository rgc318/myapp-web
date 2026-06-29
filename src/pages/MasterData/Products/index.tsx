import {
  CheckCircleOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Link } from '@umijs/max';
import {
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
} from 'antd';
import React, { useRef, useState } from 'react';
import { ItemImageUpload } from '@/components/ItemImageUpload';
import { RemoteLinkSelect } from '@/components/RemoteLinkSelect';
import { UomSelect } from '@/components/UomSelect';
import { useWorkspacePreferences } from '@/hooks/useWorkspacePreferences';
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

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
  }).format(value ?? 0);
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
  defaultCompany,
  onEdit,
  onToggleDisabled,
  togglingProduct,
}: {
  defaultCompany: string;
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
      initialValue: defaultCompany,
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
      width: 80,
      render: (_, record) =>
        record.imageUrl ? (
          <Image height={48} src={record.imageUrl} width={48} />
        ) : (
          '-'
        ),
    },
    {
      title: '商品编码',
      dataIndex: 'itemCode',
      search: false,
      width: 160,
      render: (_, record) => (
        <Link
          to={`/master-data/products/${encodeURIComponent(record.itemCode)}`}
        >
          {record.itemCode}
        </Link>
      ),
    },
    {
      title: '商品名称',
      dataIndex: 'itemName',
      search: false,
      ellipsis: true,
    },
    {
      title: '规格',
      dataIndex: 'specification',
      search: false,
      ellipsis: true,
      width: 160,
      renderText: (value) => value || '-',
    },
    {
      title: '分类',
      dataIndex: 'itemGroup',
      search: false,
      ellipsis: true,
      width: 140,
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
      dataIndex: ['priceSummary', 'wholesaleRate'],
      align: 'right',
      search: false,
      width: 120,
      render: (_, record) =>
        formatCurrencyValue(record.priceSummary?.wholesaleRate),
    },
    {
      title: '零售价',
      dataIndex: ['priceSummary', 'retailRate'],
      align: 'right',
      search: false,
      width: 120,
      render: (_, record) =>
        formatCurrencyValue(record.priceSummary?.retailRate),
    },
    {
      title: '采购价',
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
      valueType: 'option',
      width: 150,
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
  const { defaultCompany } = useWorkspacePreferences();
  const [editingProduct, setEditingProduct] = useState<ProductSummary | null>(
    null,
  );
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [lastQuery, setLastQuery] = useState<ProductListQuery>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [togglingProduct, setTogglingProduct] = useState<string>();
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>();

  const selectedItemCodes = selectedRowKeys.map(String);

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

  const columns = buildColumns({
    defaultCompany,
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
          onClick={openCreateModal}
        >
          新增商品
        </Button>,
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
        key={defaultCompany}
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
            <Form.Item label="条码" name="barcode" style={{ minWidth: 200 }}>
              <Input placeholder="主条码" />
            </Form.Item>
          </Space>
          <Space size={16} style={{ width: '100%' }}>
            <Form.Item
              label="库存单位"
              name="stockUom"
              rules={[{ required: true, message: '请选择库存单位' }]}
              style={{ minWidth: 200 }}
            >
              <UomSelect />
            </Form.Item>
            <Form.Item
              label="批发默认单位"
              name="wholesaleDefaultUom"
              style={{ minWidth: 200 }}
            >
              <UomSelect />
            </Form.Item>
            <Form.Item
              label="零售默认单位"
              name="retailDefaultUom"
              style={{ minWidth: 200 }}
            >
              <UomSelect />
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
              <Input placeholder="CNY" />
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
