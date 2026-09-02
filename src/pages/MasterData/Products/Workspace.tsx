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
  ProDescriptions,
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
import React, { useEffect, useMemo, useState } from 'react';
import { BarcodeScannerButton } from '@/components/BarcodeScannerButton';
import { ItemImageUpload } from '@/components/ItemImageUpload';
import { ProductUomFields } from '@/components/ProductUomFields';
import { RemoteLinkSelect } from '@/components/RemoteLinkSelect';
import {
  addProductBarcode,
  deleteProductBarcode,
  getProductDetail,
  listProductPrices,
  type ProductBarcode,
  type ProductPriceRecord,
  type ProductSummary,
  type SaveProductPayload,
  setPrimaryProductBarcode,
  terminateProductPrice,
  updateProduct,
} from '@/services/myapp/master-data';
import { formatCurrencyValue, resolveDisplayUom } from '@/utils/myapp-display';
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
            { dataIndex: 'priceList', title: '价格表' },
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
          scroll={{ x: 900 }}
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
  product,
  refreshProduct,
}: {
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
        uom: values.uom,
      });
      form.setFieldsValue({ barcode: '', uom: product.stockUom });
      message.success('条码已新增');
      refreshProduct();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '新增条码失败');
    } finally {
      setAction(undefined);
    }
  };

  const handlePrimary = async (record: ProductBarcode) => {
    setAction(`primary:${record.barcode}`);
    try {
      await setPrimaryProductBarcode(product.itemCode, record.barcode);
      message.success('主条码已更新');
      refreshProduct();
    } catch (caught) {
      message.error(
        caught instanceof Error ? caught.message : '设置主条码失败',
      );
    } finally {
      setAction(undefined);
    }
  };

  const handleDelete = async (record: ProductBarcode) => {
    setAction(`delete:${record.barcode}`);
    try {
      await deleteProductBarcode(product.itemCode, record.barcode);
      message.success('条码已删除');
      refreshProduct();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '删除条码失败');
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
              <Input placeholder="新增条码" />
              <BarcodeScannerButton
                buttonProps={{ title: '扫描新增条码' }}
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
              options={product.allUoms.map((uom) => ({
                label: resolveDisplayUom(uom, product.allUomDisplays[uom]),
                value: uom,
              }))}
              style={{ width: 180 }}
            />
          </Form.Item>
          <Button htmlType="submit" loading={action === 'add'} type="primary">
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
                    disabled={record.isPrimary}
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
    if (!data) return;
    setSaving(true);
    try {
      await updateProduct(data.itemCode, values);
      setDirty(false);
      message.success('商品资料已保存');
      refresh();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '商品保存失败');
    } finally {
      setSaving(false);
    }
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
                  itemCode={data.itemCode}
                  value={data.imageUrl}
                />
              </Form.Item>
              <Form.Item
                label="商品名称"
                name="itemName"
                rules={[{ required: true, message: '请输入商品名称' }]}
              >
                <Input />
              </Form.Item>
              <Space size={16} style={{ width: '100%' }} wrap>
                <Form.Item
                  label="商品分类"
                  name="itemGroup"
                  style={{ minWidth: 260 }}
                >
                  <RemoteLinkSelect
                    doctype="Item Group"
                    placeholder="搜索商品分类"
                  />
                </Form.Item>
                <Form.Item label="品牌" name="brand" style={{ minWidth: 220 }}>
                  <RemoteLinkSelect doctype="Brand" placeholder="搜索品牌" />
                </Form.Item>
                <Form.Item
                  label="主条码兼容字段"
                  name="barcode"
                  style={{ minWidth: 300 }}
                >
                  <Space.Compact block>
                    <Input placeholder="主条码" />
                    <BarcodeScannerButton
                      buttonProps={{ title: '扫描主条码' }}
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
                <Input.TextArea autoSize={{ maxRows: 6, minRows: 3 }} />
              </Form.Item>
              <Form.Item label="停用" name="disabled" valuePropName="checked">
                <Switch />
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
                  icon={<WarningOutlined />}
                  onClick={() => setUomMigrationOpen(true)}
                >
                  单位风险纠正
                </Button>
              }
              title="单位与包装"
            >
              <ProductUomFields
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
          <ProductBarcodeSection product={data} refreshProduct={refresh} />
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
                <InputNumber min={0} precision={6} style={{ width: 260 }} />
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
        children: (
          <ProCard title="变更与治理记录">
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
              <Alert
                description="当前阶段保留 Frappe 文档版本、价格有效期和商品纠正审计作为正式来源。下一阶段会在这里聚合普通资料、价格、条码和单位纠正的完整时间线。"
                showIcon
                title="统一变更时间线建设中"
                type="info"
              />
              <ProDescriptions bordered column={2}>
                <ProDescriptions.Item label="商品编码">
                  {data.itemCode}
                </ProDescriptions.Item>
                <ProDescriptions.Item label="当前状态">
                  {data.disabled ? (
                    <Tag>停用</Tag>
                  ) : (
                    <Tag color="green">启用</Tag>
                  )}
                </ProDescriptions.Item>
                <ProDescriptions.Item label="最后修改">
                  {data.modified || '-'}
                </ProDescriptions.Item>
                <ProDescriptions.Item label="价格记录">
                  进入销售/采购价格页签查看有效期和版本
                </ProDescriptions.Item>
              </ProDescriptions>
            </Space>
          </ProCard>
        ),
        key: 'history',
        label: '变更历史',
      },
    ];
  }, [data, form, refresh]);

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
        onValuesChange={() => setDirty(true)}
      >
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
              {dirty ? '有未保存修改' : '当前资料已保存'}
            </Typography.Text>
            <Button
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
        open={uomMigrationOpen}
      />
    </PageContainer>
  );
};

export default ProductMaintenanceWorkspace;
