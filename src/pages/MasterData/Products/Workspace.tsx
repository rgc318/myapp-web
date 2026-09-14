import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SaveOutlined,
  StarOutlined,
  StopOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  PageContainer,
  ProCard,
  StatisticCard,
} from '@ant-design/pro-components';
import { history, useLocation, useParams, useRequest } from '@umijs/max';
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Popconfirm,
  Result,
  Select,
  Skeleton,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarcodeScannerButton } from '@/components/BarcodeScannerButton';
import { ItemImageUpload } from '@/components/ItemImageUpload';
import { PriceListName } from '@/components/PriceListName';
import { ProductUomFields } from '@/components/ProductUomFields';
import { RemoteLinkSelect } from '@/components/RemoteLinkSelect';
import {
  addProductBarcode,
  deleteProductBarcode,
  getProductDetail,
  listProductChangeHistory,
  listProductPrices,
  type ProductBarcode,
  type ProductChangeHistoryEvent,
  type ProductPriceRecord,
  type ProductSummary,
  type SaveProductPayload,
  setPrimaryProductBarcode,
  terminateProductPrice,
  updateProduct,
} from '@/services/myapp/master-data';
import { formatCurrencyValue, resolveDisplayUom } from '@/utils/myapp-display';
import { resolvePriceListReferenceDisplay } from '@/utils/price-list-display';
import { isDocumentVersionConflict } from '@/utils/product-version-conflict';
import { ProductPriceEditorModal } from './ProductPriceEditorModal';
import { ProductUomMigrationModal } from './ProductUomMigrationModal';

type ProductFormValues = SaveProductPayload;
type BarcodeFormValues = { barcode: string; uom: string };
type WorkspaceSection =
  | 'basic'
  | 'units'
  | 'selling-prices'
  | 'buying-prices'
  | 'barcodes'
  | 'inventory'
  | 'history';

const WORKSPACE_SECTIONS = new Set<WorkspaceSection>([
  'basic',
  'units',
  'selling-prices',
  'buying-prices',
  'barcodes',
  'inventory',
  'history',
]);

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 6 }).format(
    value ?? 0,
  );
}

function workspacePath(itemCode: string, section: WorkspaceSection) {
  return `/master-data/products/${encodeURIComponent(itemCode)}/edit?section=${section}`;
}

function detailPath(itemCode: string) {
  return `/master-data/products/${encodeURIComponent(itemCode)}`;
}

function ProductPriceSection({
  product,
  refreshProduct,
  type,
}: {
  product: ProductSummary;
  refreshProduct: () => void;
  type: 'selling' | 'buying';
}) {
  const [editingPrice, setEditingPrice] = useState<ProductPriceRecord>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [terminating, setTerminating] = useState<string>();
  const { data, error, loading, refresh } = useRequest(
    () => listProductPrices(product.itemCode),
    { formatResult: (result) => result, refreshDeps: [product.itemCode] },
  );
  const rows = (data?.prices ?? []).filter((row) =>
    type === 'buying'
      ? row.priceListType === 'buying' || row.priceListType === 'both'
      : row.priceListType === 'selling' || row.priceListType === 'both',
  );

  const handleTerminate = async (record: ProductPriceRecord) => {
    setTerminating(record.name);
    try {
      await terminateProductPrice(product.itemCode, record);
      refresh();
      refreshProduct();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '终止价格失败');
    } finally {
      setTerminating(undefined);
    }
  };

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        description="完整价格以价格表、币种、计价单位和有效期为独立记录。修改现有价格时定位键保持不变；单位或价格表错误时，请新增正确记录后终止旧记录。"
        showIcon
        title={type === 'buying' ? '采购价格矩阵' : '销售价格矩阵'}
        type="info"
      />
      {error ? (
        <Alert
          action={<Button onClick={refresh}>重试</Button>}
          showIcon
          title={error instanceof Error ? error.message : '价目表加载失败'}
          type="error"
        />
      ) : null}
      <ProCard
        extra={
          <Button
            disabled={!data?.canCreate}
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingPrice(undefined);
              setEditorOpen(true);
            }}
            type="primary"
          >
            新增{type === 'buying' ? '采购' : '销售'}价格
          </Button>
        }
        title={`${type === 'buying' ? '采购' : '销售'}价格（${rows.length} 条）`}
      >
        <Table<ProductPriceRecord>
          columns={[
            {
              dataIndex: 'priceList',
              render: (value) => <PriceListName code={value} />,
              title: '价格表',
              width: 130,
            },
            {
              dataIndex: 'uom',
              render: (value) =>
                resolveDisplayUom(value, product.allUomDisplays[value]),
              title: '计价单位',
              width: 130,
            },
            { dataIndex: 'currency', title: '币种', width: 90 },
            {
              align: 'right',
              dataIndex: 'rate',
              render: (value) => formatCurrencyValue(value),
              title: '金额',
              width: 140,
            },
            {
              dataIndex: 'validFrom',
              render: (value) => value || '不限',
              title: '生效日期',
              width: 120,
            },
            {
              dataIndex: 'validUpto',
              render: (value) => value || '长期有效',
              title: '失效日期',
              width: 120,
            },
            {
              fixed: 'right',
              render: (_, record) =>
                data?.canWrite ? (
                  <Space size={4}>
                    <Button
                      icon={<EditOutlined />}
                      onClick={() => {
                        setEditingPrice(record);
                        setEditorOpen(true);
                      }}
                      type="link"
                    >
                      修改
                    </Button>
                    <Popconfirm
                      cancelText="取消"
                      description="终止会设置失效日期并保留正式记录，不会物理删除。"
                      okText="终止价格"
                      onConfirm={() => handleTerminate(record)}
                      title="终止这条价格？"
                    >
                      <Button
                        danger
                        icon={<StopOutlined />}
                        loading={terminating === record.name}
                        type="link"
                      >
                        终止
                      </Button>
                    </Popconfirm>
                  </Space>
                ) : (
                  <Typography.Text type="secondary">只读</Typography.Text>
                ),
              title: '操作',
              width: 160,
            },
          ]}
          dataSource={rows}
          loading={loading}
          pagination={false}
          rowKey="name"
          scroll={{ x: 990 }}
          size="small"
        />
      </ProCard>
      <ProductPriceEditorModal
        collection={data}
        defaultType={type}
        editingPrice={editingPrice}
        onClose={() => {
          setEditorOpen(false);
          setEditingPrice(undefined);
        }}
        onSaved={() => {
          refresh();
          refreshProduct();
        }}
        open={editorOpen}
        product={product}
      />
    </Space>
  );
}

function ProductBarcodeSection({
  onVersionConflict,
  product,
  refreshProduct,
}: {
  onVersionConflict: (error: unknown) => boolean;
  product: ProductSummary;
  refreshProduct: () => void;
}) {
  const [form] = Form.useForm<BarcodeFormValues>();
  const [action, setAction] = useState<string>();

  useEffect(() => {
    form.setFieldsValue({ barcode: '', uom: product.stockUom });
  }, [form, product.itemCode, product.stockUom]);

  const handleAdd = async (values: BarcodeFormValues) => {
    setAction('add');
    try {
      await addProductBarcode(product.itemCode, values.barcode, {
        itemModified: product.modified,
        uom: values.uom,
      });
      form.setFieldsValue({ barcode: '', uom: product.stockUom });
      message.success('条码已新增');
      refreshProduct();
    } catch (caught) {
      if (!onVersionConflict(caught)) {
        message.error(
          caught instanceof Error ? caught.message : '新增条码失败',
        );
      }
    } finally {
      setAction(undefined);
    }
  };

  const handlePrimary = async (record: ProductBarcode) => {
    setAction(`primary:${record.barcode}`);
    try {
      await setPrimaryProductBarcode(product.itemCode, record.barcode, {
        itemModified: product.modified,
      });
      message.success('主条码已更新');
      refreshProduct();
    } catch (caught) {
      if (!onVersionConflict(caught)) {
        message.error(
          caught instanceof Error ? caught.message : '设置主条码失败',
        );
      }
    } finally {
      setAction(undefined);
    }
  };

  const handleDelete = async (record: ProductBarcode) => {
    setAction(`delete:${record.barcode}`);
    try {
      await deleteProductBarcode(product.itemCode, record.barcode, {
        itemModified: product.modified,
      });
      message.success('条码已删除');
      refreshProduct();
    } catch (caught) {
      if (!onVersionConflict(caught)) {
        message.error(
          caught instanceof Error ? caught.message : '删除条码失败',
        );
      }
    } finally {
      setAction(undefined);
    }
  };

  return (
    <ProCard title={`条码（${product.barcodes.length} 条）`}>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          description="条码必须明确对应商品已配置单位，用于区分单件码、内包装码和整箱码。"
          showIcon
          title="条码与单位绑定"
          type="info"
        />
        {!product.canWrite ? (
          <Alert
            description="你可以查看条码与对应单位，但当前账号不能新增、设为主条码或删除。"
            showIcon
            title="商品条码只读"
            type="warning"
          />
        ) : null}
        <Form<BarcodeFormValues>
          form={form}
          layout="inline"
          onFinish={handleAdd}
        >
          <Form.Item
            name="barcode"
            rules={[{ required: true, message: '请输入条码' }]}
          >
            <Space.Compact style={{ width: 340 }}>
              <Input disabled={!product.canWrite} placeholder="新增条码" />
              <BarcodeScannerButton
                buttonProps={{
                  disabled: !product.canWrite,
                  title: '扫描新增条码',
                }}
                label={null}
                onScanned={(barcode) => form.setFieldValue('barcode', barcode)}
                title="扫描新增商品条码"
              />
            </Space.Compact>
          </Form.Item>
          <Form.Item
            name="uom"
            rules={[{ required: true, message: '请选择对应单位' }]}
          >
            <Select
              disabled={!product.canWrite}
              options={product.allUoms.map((uom) => ({
                label: resolveDisplayUom(uom, product.allUomDisplays[uom]),
                value: uom,
              }))}
              style={{ width: 180 }}
            />
          </Form.Item>
          <Button
            disabled={!product.canWrite}
            htmlType="submit"
            loading={action === 'add'}
            type="primary"
          >
            新增条码
          </Button>
        </Form>
        <Table<ProductBarcode>
          columns={[
            { dataIndex: 'barcode', title: '条码' },
            {
              dataIndex: 'uom',
              render: (value) =>
                resolveDisplayUom(value, product.allUomDisplays[value]),
              title: '对应单位',
            },
            {
              dataIndex: 'isPrimary',
              render: (value) =>
                value ? <Tag color="green">主条码</Tag> : '-',
              title: '主条码',
              width: 100,
            },
            {
              render: (_, record) => (
                <Space size={4}>
                  <Button
                    disabled={!product.canWrite || record.isPrimary}
                    icon={<StarOutlined />}
                    loading={action === `primary:${record.barcode}`}
                    onClick={() => handlePrimary(record)}
                    type="link"
                  >
                    设为主条码
                  </Button>
                  <Popconfirm
                    cancelText="取消"
                    okText="删除"
                    onConfirm={() => handleDelete(record)}
                    title={`删除条码 ${record.barcode}？`}
                  >
                    <Button
                      danger
                      disabled={!product.canWrite}
                      icon={<DeleteOutlined />}
                      loading={action === `delete:${record.barcode}`}
                      type="link"
                    >
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              ),
              title: '操作',
              width: 220,
            },
          ]}
          dataSource={product.barcodes}
          pagination={false}
          rowKey={(row) => row.name || row.barcode}
          size="small"
        />
      </Space>
    </ProCard>
  );
}

const HISTORY_CATEGORY_META: Record<
  ProductChangeHistoryEvent['category'],
  { color: string; label: string }
> = {
  barcode: { color: 'cyan', label: '条码' },
  price: { color: 'gold', label: '价格' },
  product: { color: 'blue', label: '商品资料' },
  uom: { color: 'purple', label: '单位治理' },
  valuation: { color: 'orange', label: '库存估值' },
};

function formatHistoryValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '未设置';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function ProductHistorySection({ product }: { product: ProductSummary }) {
  const { data, error, loading, refresh } = useRequest(
    () => listProductChangeHistory(product.itemCode, { limit: 100 }),
    { formatResult: (result) => result, refreshDeps: [product.itemCode] },
  );

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        description="时间线聚合 Frappe 商品版本、正式 Item Price 版本和商品单位纠正审计；记录按当前商品读取权限返回，不允许前端自行拼接或改写。"
        showIcon
        title="正式变更审计"
        type="info"
      />
      {error ? (
        <Alert
          action={<Button onClick={refresh}>重试</Button>}
          showIcon
          title={error instanceof Error ? error.message : '变更历史加载失败'}
          type="error"
        />
      ) : null}
      {data?.hasMore ? (
        <Alert
          showIcon
          title="当前显示最近 100 条记录；更早记录可在后续分页中继续加载。"
          type="warning"
        />
      ) : null}
      <Table<ProductChangeHistoryEvent>
        columns={[
          {
            dataIndex: 'occurredAt',
            title: '发生时间',
            width: 170,
          },
          {
            render: (_, record) => {
              const meta = HISTORY_CATEGORY_META[record.category];
              return <Tag color={meta.color}>{meta.label}</Tag>;
            },
            title: '类型',
            width: 110,
          },
          {
            render: (_, record) => (
              <Space orientation="vertical" size={0}>
                <Typography.Text strong>{record.title}</Typography.Text>
                <Typography.Text type="secondary">
                  {record.category === 'price'
                    ? resolvePriceListReferenceDisplay(
                        record.summary || record.sourceName,
                      )
                    : record.summary || record.sourceName}
                </Typography.Text>
              </Space>
            ),
            title: '事件',
            width: 220,
          },
          {
            render: (_, record) =>
              record.changes.length ? (
                <Space orientation="vertical" size={2}>
                  {record.changes.map((change) => (
                    <Typography.Text
                      key={`${change.field}:${change.rowAction ?? ''}:${formatHistoryValue(change.oldValue)}:${formatHistoryValue(change.newValue)}`}
                    >
                      {change.label || change.field}：
                      <Typography.Text
                        delete={change.oldValue !== null}
                        type="secondary"
                      >
                        {formatHistoryValue(change.oldValue)}
                      </Typography.Text>
                      {' → '}
                      {formatHistoryValue(change.newValue)}
                    </Typography.Text>
                  ))}
                </Space>
              ) : (
                <Typography.Text type="secondary">无字段级差异</Typography.Text>
              ),
            title: '变更内容',
          },
          {
            dataIndex: 'actor',
            render: (value) => value || '系统',
            title: '操作人',
            width: 190,
          },
        ]}
        dataSource={data?.events ?? []}
        loading={loading}
        locale={{ emptyText: '暂无可见变更记录' }}
        pagination={false}
        rowKey="id"
        scroll={{ x: 1050 }}
        size="small"
      />
    </Space>
  );
}

const ProductMaintenanceWorkspace: React.FC = () => {
  const params = useParams();
  const location = useLocation();
  const itemCode = decodeURIComponent(String(params.itemCode ?? ''));
  const query = new URLSearchParams(location.search);
  const requestedSection = query.get('section') as WorkspaceSection | null;
  const activeSection =
    requestedSection && WORKSPACE_SECTIONS.has(requestedSection)
      ? requestedSection
      : 'basic';
  const [form] = Form.useForm<ProductFormValues>();
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [versionConflict, setVersionConflict] = useState<string>();
  const [uomMigrationOpen, setUomMigrationOpen] = useState(
    query.get('uom_migration') === '1',
  );

  const { data, error, loading, refresh } = useRequest(
    () => getProductDetail(itemCode),
    { formatResult: (result) => result, refreshDeps: [itemCode] },
  );

  useEffect(() => {
    if (!data) return;
    form.resetFields();
    form.setFieldsValue({
      barcode: data.barcode,
      brand: data.brand,
      description: data.description,
      disabled: data.disabled,
      image: data.imageUrl || undefined,
      itemGroup: data.itemGroup,
      itemName: data.itemName,
      nickname: data.nickname,
      retailDefaultUom: data.retailDefaultUom ?? data.stockUom,
      stockUom: data.stockUom,
      uomConversions: data.uomConversions.map((row) => ({
        conversionFactor: row.conversionFactor,
        uom: row.uom,
      })),
      valuationRate: data.priceSummary?.valuationRate ?? undefined,
      wholesaleDefaultUom: data.wholesaleDefaultUom ?? data.stockUom,
    });
    setDirty(false);
    setVersionConflict(undefined);
  }, [data, form]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  const navigateSafely = (path: string) => {
    if (!dirty) {
      history.push(path);
      return;
    }
    Modal.confirm({
      cancelText: '继续编辑',
      content: '当前商品资料有尚未保存的修改，离开后这些修改会丢失。',
      okButtonProps: { danger: true },
      okText: '放弃修改并离开',
      onOk: () => history.push(path),
      title: '放弃未保存修改？',
    });
  };

  const handleSave = async (values: ProductFormValues) => {
    if (!data?.canWrite) return;
    setSaving(true);
    try {
      await updateProduct(data.itemCode, {
        ...values,
        itemModified: data.modified,
      });
      setDirty(false);
      setVersionConflict(undefined);
      message.success('商品资料已保存');
      refresh();
    } catch (caught) {
      if (isDocumentVersionConflict(caught)) {
        setVersionConflict(
          caught instanceof Error
            ? caught.message
            : '商品资料已发生变化，请刷新最新资料。',
        );
      } else {
        message.error(
          caught instanceof Error ? caught.message : '商品保存失败',
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleVersionConflict = useCallback((caught: unknown) => {
    if (!isDocumentVersionConflict(caught)) return false;
    setVersionConflict(
      caught instanceof Error
        ? caught.message
        : '商品资料已发生变化，请刷新最新资料。',
    );
    return true;
  }, []);

  const handleRefreshLatest = () => {
    setDirty(false);
    setVersionConflict(undefined);
    refresh();
  };

  const tabItems = useMemo(() => {
    if (!data) return [];
    return [
      {
        children: (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              description="这里只维护不会改变库存账本含义的商品资料。库存基准单位保持锁定；如发现基准单位错误，请进入“单位风险纠正”。"
              showIcon
              title="普通资料维护"
              type="info"
            />
            <ProCard title="基本资料">
              <Form.Item label="商品图片" name="image">
                <ItemImageUpload
                  disabled={!data.canWrite}
                  itemCode={data.itemCode}
                  value={data.imageUrl}
                />
              </Form.Item>
              <Form.Item
                label="商品名称"
                name="itemName"
                rules={[{ required: true, message: '请输入商品名称' }]}
              >
                <Input disabled={!data.canWrite} />
              </Form.Item>
              <Form.Item
                extra="仅供内部快速识别和搜索，例如“红盖”“老包装”；不会替代正式商品名称。"
                label="商品昵称"
                name="nickname"
              >
                <Input
                  allowClear
                  disabled={!data.canWrite}
                  placeholder="填写便于业务人员区分的简称或俗称"
                />
              </Form.Item>
              <Space size={16} style={{ width: '100%' }} wrap>
                <Form.Item
                  label="商品分类"
                  name="itemGroup"
                  style={{ minWidth: 260 }}
                >
                  <RemoteLinkSelect
                    disabled={!data.canWrite}
                    doctype="Item Group"
                    placeholder="搜索商品分类"
                  />
                </Form.Item>
                <Form.Item label="品牌" name="brand" style={{ minWidth: 220 }}>
                  <RemoteLinkSelect
                    disabled={!data.canWrite}
                    doctype="Brand"
                    placeholder="搜索品牌"
                  />
                </Form.Item>
                <Form.Item
                  label="主条码兼容字段"
                  name="barcode"
                  style={{ minWidth: 300 }}
                >
                  <Space.Compact block>
                    <Input disabled={!data.canWrite} placeholder="主条码" />
                    <BarcodeScannerButton
                      buttonProps={{
                        disabled: !data.canWrite,
                        title: '扫描主条码',
                      }}
                      label={null}
                      onScanned={(barcode) =>
                        form.setFieldValue('barcode', barcode)
                      }
                      title="扫描商品主条码"
                    />
                  </Space.Compact>
                </Form.Item>
              </Space>
              <Form.Item label="描述" name="description">
                <Input.TextArea
                  autoSize={{ maxRows: 6, minRows: 3 }}
                  disabled={!data.canWrite}
                />
              </Form.Item>
              <Form.Item label="停用" name="disabled" valuePropName="checked">
                <Switch disabled={!data.canWrite} />
              </Form.Item>
            </ProCard>
          </Space>
        ),
        key: 'basic',
        label: '基本资料',
      },
      {
        children: (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <ProCard
              extra={
                <Button
                  danger
                  disabled={!data.canWrite}
                  icon={<WarningOutlined />}
                  onClick={() => setUomMigrationOpen(true)}
                >
                  单位风险纠正
                </Button>
              }
              title="单位与包装"
            >
              <ProductUomFields
                disabled={!data.canWrite}
                form={form}
                lockStockUom
                stockUomDisplay={data.stockUomDisplay}
                uomDisplays={data.allUomDisplays}
              />
            </ProCard>
          </Space>
        ),
        key: 'units',
        label: '单位与包装',
      },
      {
        children: (
          <ProductPriceSection
            product={data}
            refreshProduct={refresh}
            type="selling"
          />
        ),
        key: 'selling-prices',
        label: '销售价格',
      },
      {
        children: (
          <ProductPriceSection
            product={data}
            refreshProduct={refresh}
            type="buying"
          />
        ),
        key: 'buying-prices',
        label: '采购价格',
      },
      {
        children: (
          <ProductBarcodeSection
            onVersionConflict={handleVersionConflict}
            product={data}
            refreshProduct={refresh}
          />
        ),
        key: 'barcodes',
        label: '条码',
      },
      {
        children: (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <StatisticCard.Group direction="row">
              <StatisticCard
                statistic={{
                  suffix: resolveDisplayUom(
                    data.stockUom,
                    data.stockUomDisplay,
                  ),
                  title: '当前权限范围库存',
                  value: formatNumber(data.stockQty),
                }}
              />
              <StatisticCard
                statistic={{
                  suffix: resolveDisplayUom(
                    data.stockUom,
                    data.stockUomDisplay,
                  ),
                  title: '总库存',
                  value: formatNumber(data.totalQty),
                }}
              />
              <StatisticCard
                statistic={{
                  prefix: '¥',
                  title: '库存估值成本',
                  value: formatNumber(data.priceSummary?.valuationRate),
                }}
              />
            </StatisticCard.Group>
            <ProCard title="库存估值设置">
              <Alert
                description="库存估值成本不同于采购价格。修改该字段会影响后续库存估值参考；实际库存流水仍由正式库存单据决定。"
                showIcon
                style={{ marginBottom: 16 }}
                title="库存与价格语义分离"
                type="warning"
              />
              <Form.Item label="库存估值成本" name="valuationRate">
                <InputNumber
                  disabled={!data.canWrite}
                  min={0}
                  precision={6}
                  style={{ width: 260 }}
                />
              </Form.Item>
            </ProCard>
            <ProCard title="分仓库存">
              <Table
                columns={[
                  { dataIndex: 'warehouse', title: '仓库' },
                  { dataIndex: 'company', title: '公司' },
                  {
                    align: 'right',
                    dataIndex: 'qty',
                    render: (value) => formatNumber(value),
                    title: `库存数量（${resolveDisplayUom(data.stockUom)}）`,
                  },
                ]}
                dataSource={data.warehouseStockDetails}
                pagination={false}
                rowKey={(row) => `${row.company}:${row.warehouse}`}
                size="small"
              />
            </ProCard>
          </Space>
        ),
        key: 'inventory',
        label: '库存与估值',
      },
      {
        children: <ProductHistorySection product={data} />,
        key: 'history',
        label: '变更历史',
      },
    ];
  }, [data, form, handleVersionConflict, refresh]);

  if (loading && !data) {
    return (
      <PageContainer title="商品维护工作区">
        <ProCard>
          <Skeleton active paragraph={{ rows: 12 }} />
        </ProCard>
      </PageContainer>
    );
  }

  if (error || !data) {
    return (
      <PageContainer title="商品维护工作区">
        <Result
          extra={
            <Button onClick={() => history.push('/master-data/products')}>
              返回商品列表
            </Button>
          }
          status="error"
          subTitle={error instanceof Error ? error.message : '未找到商品'}
          title="无法打开商品维护工作区"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      extra={[
        <Button
          icon={<ArrowLeftOutlined />}
          key="detail"
          onClick={() => navigateSafely(detailPath(data.itemCode))}
        >
          返回详情
        </Button>,
        <Button
          disabled={!data.canWrite}
          key="save"
          loading={saving}
          onClick={() => form.submit()}
          type="primary"
          icon={<SaveOutlined />}
        >
          保存商品资料
        </Button>,
      ]}
      subTitle={data.itemCode}
      title={`商品维护工作区 · ${data.itemName}`}
    >
      <Form<ProductFormValues>
        component={false}
        form={form}
        layout="vertical"
        onFinish={handleSave}
        onValuesChange={() => {
          if (data.canWrite) setDirty(true);
        }}
      >
        {!data.canWrite ? (
          <Alert
            banner
            description="你可以查看基本资料、单位、库存估值和变更历史；价格是否可维护仍以对应价目表权限为准。"
            showIcon
            style={{ marginBottom: 16 }}
            title="当前商品以只读模式打开"
            type="warning"
          />
        ) : null}
        {versionConflict ? (
          <Alert
            action={
              <Button onClick={handleRefreshLatest} type="primary">
                刷新最新资料
              </Button>
            }
            banner
            description="为避免覆盖其他人的修改，本次保存或条码操作已被阻止。刷新会放弃当前未保存内容并载入服务器最新版本。"
            showIcon
            style={{ marginBottom: 16 }}
            title={versionConflict}
            type="error"
          />
        ) : null}
        {dirty ? (
          <Alert
            banner
            message="当前有尚未保存的商品资料修改"
            showIcon
            style={{ marginBottom: 16 }}
            type="warning"
          />
        ) : null}
        <Tabs
          activeKey={activeSection}
          items={tabItems}
          onChange={(key) =>
            navigateSafely(
              workspacePath(data.itemCode, key as WorkspaceSection),
            )
          }
          tabBarExtraContent={
            <Space>
              <Tag color={data.disabled ? 'default' : 'green'}>
                {data.disabled ? '停用' : '启用'}
              </Tag>
              <Tag>
                {resolveDisplayUom(data.stockUom, data.stockUomDisplay)}
              </Tag>
            </Space>
          }
        />
        <div
          style={{
            background: '#fff',
            borderTop: '1px solid #f0f0f0',
            bottom: 0,
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: 16,
            padding: '12px 0',
            position: 'sticky',
            zIndex: 10,
          }}
        >
          <Space>
            <Typography.Text type="secondary">
              {!data.canWrite
                ? '当前为只读模式'
                : dirty
                  ? '有未保存修改'
                  : '当前资料已保存'}
            </Typography.Text>
            <Button
              disabled={!data.canWrite}
              loading={saving}
              onClick={() => form.submit()}
              type="primary"
              icon={<SaveOutlined />}
            >
              保存商品资料
            </Button>
          </Space>
        </div>
      </Form>
      <ProductUomMigrationModal
        itemCode={data.itemCode}
        onClose={() => setUomMigrationOpen(false)}
        onCompleted={(newItemCode) => {
          setUomMigrationOpen(false);
          history.push(workspacePath(newItemCode, 'units'));
        }}
        open={data.canWrite && uomMigrationOpen}
      />
    </PageContainer>
  );
};

export default ProductMaintenanceWorkspace;
