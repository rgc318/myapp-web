import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  StarOutlined,
  StopOutlined,
} from '@ant-design/icons';
import {
  PageContainer,
  ProCard,
  type ProColumns,
  ProDescriptions,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { history, Link, useLocation, useParams, useRequest } from '@umijs/max';
import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  message,
  Popconfirm,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
} from 'antd';
import React, { useEffect, useState } from 'react';
import { BarcodeScannerButton } from '@/components/BarcodeScannerButton';
import { PriceListName } from '@/components/PriceListName';
import { ProductImage } from '@/components/ProductImage';
import {
  listStockLedgerEntries,
  type StockLedgerEntry,
} from '@/services/myapp/inventory';
import {
  addProductBarcode,
  deleteProductBarcode,
  getProductDetail,
  listProductPrices,
  type ProductBarcode,
  type ProductPriceEntry,
  type ProductPriceRecord,
  type ProductSummary,
  type ProductWarehouseStockDetail,
  setPrimaryProductBarcode,
  setProductDisabled,
  terminateProductPrice,
} from '@/services/myapp/master-data';
import { formatCurrencyValue, resolveDisplayUom } from '@/utils/myapp-display';
import {
  assessProductQuality,
  type ProductQualityAction,
} from '@/utils/product-quality';
import { isDocumentVersionConflict } from '@/utils/product-version-conflict';
import { ProductPriceEditorModal } from './ProductPriceEditorModal';
import { ProductUomMigrationModal } from './ProductUomMigrationModal';

type BarcodeFormValues = {
  barcode: string;
  uom: string;
};

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function productUomDisplay(
  uom: string | null | undefined,
  displayName?: string | null,
) {
  return resolveDisplayUom(uom, displayName);
}

function ledgerPath(itemCode: string, warehouse?: string) {
  const params = new URLSearchParams({ itemCode });
  if (warehouse) {
    params.set('warehouse', warehouse);
  }
  return `/inventory/ledger?${params.toString()}`;
}

function stockDetailPath(
  itemCode: string,
  company?: string,
  warehouse?: string,
) {
  const params = new URLSearchParams();
  if (company) {
    params.set('company', company);
  }
  if (warehouse) {
    params.set('warehouse', warehouse);
  }
  const query = params.toString();
  return `/inventory/stock/${encodeURIComponent(itemCode)}${query ? `?${query}` : ''}`;
}

function signedText(value: number) {
  const color = value > 0 ? '#15803d' : value < 0 ? '#b45309' : undefined;
  const prefix = value > 0 ? '+' : '';
  return <span style={{ color }}>{`${prefix}${formatNumber(value)}`}</span>;
}

function qualityActionLabel(action: ProductQualityAction) {
  const labels: Record<ProductQualityAction, string> = {
    basic: '完善资料',
    units: '检查单位',
    'selling-prices': '维护销售价格',
    'buying-prices': '维护采购价格',
    barcodes: '维护条码',
    inventory: '处理库存',
    ledger: '查看流水',
  };
  return labels[action];
}

function WarehouseStockTable({
  itemCode,
  rows,
}: {
  itemCode: string;
  rows: ProductWarehouseStockDetail[];
}) {
  return (
    <Table<ProductWarehouseStockDetail>
      columns={[
        {
          dataIndex: 'warehouse',
          title: '仓库',
          render: (_, record) => (
            <Link to={ledgerPath(itemCode, record.warehouse)}>
              {record.warehouse}
            </Link>
          ),
        },
        {
          dataIndex: 'company',
          title: '公司',
        },
        {
          align: 'right',
          dataIndex: 'qty',
          title: '库存数量',
          render: (_, record) => formatNumber(record.qty),
        },
      ]}
      dataSource={rows}
      locale={{ emptyText: '暂无仓库库存记录' }}
      pagination={false}
      rowKey={(record) => record.warehouse}
      size="small"
    />
  );
}

const recentLedgerColumns = [
  {
    title: '日期',
    dataIndex: 'postingDate',
    width: 120,
  },
  {
    title: '时间',
    dataIndex: 'postingTime',
    width: 100,
    render: (_: unknown, record: StockLedgerEntry) => record.postingTime || '-',
  },
  {
    title: '仓库',
    dataIndex: 'warehouse',
    ellipsis: true,
  },
  {
    title: '变动数量',
    dataIndex: 'actualQty',
    align: 'right' as const,
    width: 110,
    render: (_: unknown, record: StockLedgerEntry) =>
      signedText(record.actualQty),
  },
  {
    title: '变动后数量',
    dataIndex: 'qtyAfterTransaction',
    align: 'right' as const,
    width: 120,
    render: (_: unknown, record: StockLedgerEntry) =>
      formatNumber(record.qtyAfterTransaction),
  },
  {
    title: '凭证类型',
    dataIndex: 'voucherType',
    width: 150,
  },
  {
    title: '凭证编号',
    dataIndex: 'voucherNo',
    ellipsis: true,
    width: 180,
  },
];

function PriceEntriesTable({
  loadingPrice,
  onEdit,
  onTerminate,
  rows,
  title,
}: {
  loadingPrice?: string;
  onEdit?: (record: ProductPriceRecord) => void;
  onTerminate?: (record: ProductPriceRecord) => void;
  rows: (ProductPriceEntry | ProductPriceRecord)[];
  title: string;
}) {
  return (
    <Table<ProductPriceEntry | ProductPriceRecord>
      columns={[
        {
          dataIndex: 'priceList',
          render: (value) => <PriceListName code={value} />,
          title: '价格表',
          width: 112,
        },
        {
          dataIndex: 'uom',
          title: '计价单位',
          width: 120,
          render: (value) => productUomDisplay(value),
        },
        {
          dataIndex: 'currency',
          title: '币种',
          width: 90,
          render: (value) => value || '-',
        },
        {
          align: 'right',
          dataIndex: 'rate',
          title: '价格',
          width: 120,
          render: (value) => formatCurrencyValue(value),
        },
        {
          dataIndex: 'validFrom',
          title: '生效日期',
          width: 120,
          render: (value) => value || '不限',
        },
        {
          dataIndex: 'validUpto',
          title: '失效日期',
          width: 120,
          render: (value) => value || '长期有效',
        },
        ...(onEdit && onTerminate
          ? [
              {
                fixed: 'right' as const,
                render: (
                  _: unknown,
                  record: ProductPriceEntry | ProductPriceRecord,
                ) => {
                  if (!('name' in record)) return null;
                  return (
                    <Space size={4}>
                      <Button
                        icon={<EditOutlined />}
                        onClick={() => onEdit(record)}
                        size="small"
                        type="link"
                      >
                        修改
                      </Button>
                      <Popconfirm
                        cancelText="取消"
                        description="系统会把失效日期设置为今天并保留价格记录，不会物理删除。"
                        okText="终止价格"
                        onConfirm={() => onTerminate(record)}
                        title="终止这条价格？"
                      >
                        <Button
                          danger
                          icon={<StopOutlined />}
                          loading={loadingPrice === record.name}
                          size="small"
                          type="link"
                        >
                          终止
                        </Button>
                      </Popconfirm>
                    </Space>
                  );
                },
                title: '操作',
                width: 150,
              },
            ]
          : []),
      ]}
      dataSource={rows}
      locale={{ emptyText: '暂无价格记录' }}
      pagination={false}
      rowKey={(record) =>
        `${record.priceList}:${record.uom ?? ''}:${record.currency}`
      }
      scroll={{ x: 832 }}
      size="small"
      title={() => title}
    />
  );
}

function BarcodeTable({
  canWrite,
  loading,
  onDelete,
  onSetPrimary,
  rows,
  uomDisplays,
}: {
  canWrite: boolean;
  loading?: string;
  onDelete: (record: ProductBarcode) => void;
  onSetPrimary: (record: ProductBarcode) => void;
  rows: ProductBarcode[];
  uomDisplays: Record<string, string>;
}) {
  const columns: ProColumns<ProductBarcode>[] = [
    {
      dataIndex: 'barcode',
      title: '条码',
      copyable: true,
      ellipsis: true,
    },
    {
      dataIndex: 'uom',
      title: '对应单位',
      width: 120,
      render: (value) => {
        const uom = typeof value === 'string' ? value : '';
        return productUomDisplay(uom, uomDisplays[uom] || null);
      },
    },
    {
      dataIndex: 'isPrimary',
      title: '主条码',
      width: 100,
      render: (_, record) =>
        record.isPrimary ? <Tag color="green">主条码</Tag> : '-',
      sorter: (left, right) => Number(right.isPrimary) - Number(left.isPrimary),
    },
    {
      dataIndex: 'idx',
      title: '顺序',
      width: 80,
      align: 'right',
      sorter: (left, right) => left.idx - right.idx,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      render: (_, record) => [
        <Button
          disabled={!canWrite || record.isPrimary}
          icon={<StarOutlined />}
          key="primary"
          loading={loading === `primary:${record.barcode}`}
          size="small"
          type="link"
          onClick={() => onSetPrimary(record)}
        >
          设为主条码
        </Button>,
        <Popconfirm
          cancelText="取消"
          key="delete"
          okText="删除"
          onConfirm={() => onDelete(record)}
          title={`删除条码 ${record.barcode}？`}
        >
          <Button
            danger
            disabled={!canWrite}
            icon={<DeleteOutlined />}
            loading={loading === `delete:${record.barcode}`}
            size="small"
            type="link"
          >
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <ProTable<ProductBarcode>
      columns={columns}
      dataSource={rows}
      pagination={false}
      rowKey={(record) => record.barcode}
      search={false}
      size="small"
      toolBarRender={false}
    />
  );
}

const ProductDetailPage: React.FC = () => {
  const params = useParams();
  const location = useLocation();
  const [barcodeForm] = Form.useForm<BarcodeFormValues>();
  const query = new URLSearchParams(location.search);
  const itemCode = decodeURIComponent(String(params.itemCode ?? ''));
  const company = query.get('company') || undefined;
  const warehouse = query.get('warehouse') || undefined;
  const [uomMigrationOpen, setUomMigrationOpen] = useState(false);
  const [priceEditorOpen, setPriceEditorOpen] = useState(false);
  const [priceEditorType, setPriceEditorType] = useState<'selling' | 'buying'>(
    'selling',
  );
  const [editingPrice, setEditingPrice] = useState<ProductPriceRecord>();
  const [terminatingPrice, setTerminatingPrice] = useState<string>();
  const [toggling, setToggling] = useState(false);
  const [barcodeSubmitting, setBarcodeSubmitting] = useState<string>();
  const [versionConflict, setVersionConflict] = useState<string>();

  const { data, error, loading, refresh } = useRequest(
    () => getProductDetail(itemCode, { company, warehouse }),
    {
      formatResult: (result) => result,
      refreshDeps: [itemCode, company, warehouse],
    },
  );

  const {
    data: priceCollection,
    error: priceError,
    loading: priceLoading,
    refresh: refreshPrices,
  } = useRequest(() => listProductPrices(itemCode), {
    formatResult: (result) => result,
    refreshDeps: [itemCode],
  });

  const openPriceEditor = (
    type: 'selling' | 'buying',
    record?: ProductPriceRecord,
  ) => {
    setPriceEditorType(type);
    setEditingPrice(record);
    setPriceEditorOpen(true);
  };

  const handleTerminatePrice = async (record: ProductPriceRecord) => {
    setTerminatingPrice(record.name);
    try {
      await terminateProductPrice(itemCode, record);
      refreshPrices();
      refresh();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '终止价格失败');
    } finally {
      setTerminatingPrice(undefined);
    }
  };

  useEffect(() => {
    if (
      data &&
      new URLSearchParams(location.search).get('uom_migration') === '1'
    ) {
      setUomMigrationOpen(true);
    }
  }, [data, location.search]);

  useEffect(() => {
    if (!data) return;
    barcodeForm.setFieldsValue({ barcode: '', uom: data.stockUom });
    setVersionConflict(undefined);
  }, [barcodeForm, data]);

  const closeUomMigration = () => {
    setUomMigrationOpen(false);
    const nextQuery = new URLSearchParams(location.search);
    nextQuery.delete('uom_migration');
    history.replace(
      `${location.pathname}${nextQuery.toString() ? `?${nextQuery.toString()}` : ''}`,
    );
  };

  const openWorkspaceSection = (section: string) => {
    if (!data) return;
    history.push(
      `/master-data/products/${encodeURIComponent(data.itemCode)}/edit?section=${section}`,
    );
  };

  const openEdit = () => {
    if (!data?.canWrite) return;
    openWorkspaceSection('basic');
  };

  const canHandleQualityAction = (action: ProductQualityAction) => {
    if (!data) return false;
    if (action === 'inventory' || action === 'ledger') return true;
    if (action === 'selling-prices' || action === 'buying-prices') {
      return Boolean(priceCollection?.canCreate || priceCollection?.canWrite);
    }
    return data.canWrite;
  };

  const handleQualityAction = (action: ProductQualityAction) => {
    if (!data) return;
    if (action === 'ledger') {
      history.push(ledgerPath(data.itemCode, warehouse));
      return;
    }
    if (action === 'inventory') {
      history.push('/inventory/adjustments');
      return;
    }
    openWorkspaceSection(action);
  };

  const handleToggleDisabled = async () => {
    if (!data?.canWrite) {
      return;
    }
    setToggling(true);
    try {
      await setProductDisabled(data.itemCode, !data.disabled, data.modified);
      refresh();
    } catch (caught) {
      if (isDocumentVersionConflict(caught)) {
        setVersionConflict(
          caught instanceof Error ? caught.message : '商品资料已发生变化。',
        );
      } else {
        message.error(caught instanceof Error ? caught.message : '操作失败');
      }
    } finally {
      setToggling(false);
    }
  };

  const handleAddBarcode = async (values: BarcodeFormValues) => {
    if (!data?.canWrite) {
      return;
    }
    const barcode = values.barcode?.trim();
    if (!barcode) {
      message.warning('请输入条码');
      return;
    }
    setBarcodeSubmitting('add');
    try {
      await addProductBarcode(data.itemCode, barcode, {
        itemModified: data.modified,
        uom: values.uom,
      });
      barcodeForm.resetFields();
      barcodeForm.setFieldsValue({ barcode: '', uom: data.stockUom });
      refresh();
    } catch (caught) {
      if (isDocumentVersionConflict(caught)) {
        setVersionConflict(
          caught instanceof Error ? caught.message : '商品资料已发生变化。',
        );
      } else {
        message.error(
          caught instanceof Error ? caught.message : '新增条码失败',
        );
      }
    } finally {
      setBarcodeSubmitting(undefined);
    }
  };

  const handleSetPrimaryBarcode = async (record: ProductBarcode) => {
    if (!data?.canWrite) {
      return;
    }
    setBarcodeSubmitting(`primary:${record.barcode}`);
    try {
      await setPrimaryProductBarcode(data.itemCode, record.barcode, {
        itemModified: data.modified,
      });
      refresh();
    } catch (caught) {
      if (isDocumentVersionConflict(caught)) {
        setVersionConflict(
          caught instanceof Error ? caught.message : '商品资料已发生变化。',
        );
      } else {
        message.error(
          caught instanceof Error ? caught.message : '设置主条码失败',
        );
      }
    } finally {
      setBarcodeSubmitting(undefined);
    }
  };

  const handleDeleteBarcode = async (record: ProductBarcode) => {
    if (!data?.canWrite) {
      return;
    }
    setBarcodeSubmitting(`delete:${record.barcode}`);
    try {
      await deleteProductBarcode(data.itemCode, record.barcode, {
        itemModified: data.modified,
      });
      refresh();
    } catch (caught) {
      if (isDocumentVersionConflict(caught)) {
        setVersionConflict(
          caught instanceof Error ? caught.message : '商品资料已发生变化。',
        );
      } else {
        message.error(
          caught instanceof Error ? caught.message : '删除条码失败',
        );
      }
    } finally {
      setBarcodeSubmitting(undefined);
    }
  };

  return (
    <PageContainer
      title={data?.itemName || itemCode || '商品详情'}
      extra={[
        <Button
          key="back"
          onClick={() => history.push('/master-data/products')}
        >
          返回商品列表
        </Button>,
        <Button
          disabled={!data?.canWrite}
          key="edit"
          onClick={openEdit}
          type="primary"
        >
          编辑商品
        </Button>,
        <Button
          danger
          disabled={!data?.canWrite}
          key="uom-migration"
          onClick={() => setUomMigrationOpen(true)}
        >
          单位错误纠正
        </Button>,
        data ? (
          <Popconfirm
            cancelText="取消"
            key="toggle"
            okText={data.disabled ? '启用' : '停用'}
            onConfirm={handleToggleDisabled}
            title={`${data.disabled ? '启用' : '停用'}商品 ${data.itemName || data.itemCode}？`}
          >
            <Button
              danger={!data.disabled}
              disabled={!data.canWrite}
              loading={toggling}
            >
              {data.disabled ? '启用商品' : '停用商品'}
            </Button>
          </Popconfirm>
        ) : null,
        <Button
          key="stock"
          onClick={() =>
            history.push(stockDetailPath(itemCode, company, warehouse))
          }
        >
          库存详情
        </Button>,
        <Button
          key="ledger"
          onClick={() => history.push(ledgerPath(itemCode, warehouse))}
        >
          库存流水
        </Button>,
        <Button
          key="adjust"
          onClick={() => history.push('/inventory/adjustments')}
        >
          库存调整
        </Button>,
        <Button key="refresh" loading={loading} onClick={refresh}>
          刷新
        </Button>,
      ]}
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {error ? (
          <Alert
            action={
              <Button size="small" onClick={refresh}>
                重试
              </Button>
            }
            description={
              error instanceof Error ? error.message : '请稍后重试。'
            }
            title="商品详情加载失败"
            showIcon
            type="error"
          />
        ) : null}

        {data && !data.canWrite ? (
          <Alert
            description="当前账号可以查看商品资料、库存与价格；编辑、启停、条码和单位纠正操作已禁用。价格维护仍按独立的 Item Price 权限判断。"
            title="当前商品为只读"
            showIcon
            type="warning"
          />
        ) : null}

        {versionConflict ? (
          <Alert
            action={
              <Button
                onClick={() => {
                  setVersionConflict(undefined);
                  refresh();
                }}
                type="primary"
              >
                刷新最新资料
              </Button>
            }
            description="本次操作已被阻止，避免覆盖其他人的修改。"
            title={versionConflict}
            showIcon
            type="error"
          />
        ) : null}

        {loading && !data ? (
          <ProCard>
            <Skeleton active paragraph={{ rows: 8 }} />
          </ProCard>
        ) : null}

        {!loading && !error && !data ? (
          <ProCard>
            <Empty description="未找到商品" />
          </ProCard>
        ) : null}

        {data ? (
          <>
            <StatisticCard.Group direction="row">
              <StatisticCard
                statistic={{
                  title: warehouse ? '当前仓库存' : '当前库存',
                  value: formatNumber(data.stockQty),
                  suffix: productUomDisplay(
                    data.stockUom,
                    data.stockUomDisplay,
                  ),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '总库存',
                  value: formatNumber(data.totalQty),
                  suffix: productUomDisplay(
                    data.stockUom,
                    data.stockUomDisplay,
                  ),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '标准售价',
                  value: formatCurrencyValue(
                    data.priceSummary?.standardSellingRate,
                  ),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '标准采购价',
                  value: formatCurrencyValue(
                    data.priceSummary?.standardBuyingRate,
                  ),
                }}
              />
            </StatisticCard.Group>

            <ProCard title="资料质量">
              {(() => {
                const assessment = assessProductQuality(data, {
                  prices: priceCollection?.prices,
                });
                return (
                  <Space
                    orientation="vertical"
                    size={12}
                    style={{ width: '100%' }}
                  >
                    <Space wrap>
                      <Tag
                        color={
                          assessment.status === 'healthy'
                            ? 'green'
                            : assessment.status === 'attention'
                              ? 'gold'
                              : 'red'
                        }
                      >
                        {assessment.status === 'healthy'
                          ? '治理状态良好'
                          : assessment.status === 'attention'
                            ? '治理状态需关注'
                            : '治理状态异常'}
                      </Tag>
                      {assessment.errorCount ? (
                        <Tag color="red">
                          {assessment.errorCount} 项数据错误
                        </Tag>
                      ) : null}
                      {assessment.warningCount ? (
                        <Tag color="gold">
                          {assessment.warningCount} 项业务风险
                        </Tag>
                      ) : null}
                      {assessment.suggestionCount ? (
                        <Tag color="blue">
                          {assessment.suggestionCount} 项可选完善建议
                        </Tag>
                      ) : null}
                      <Button
                        disabled={!data.canWrite}
                        size="small"
                        onClick={openEdit}
                      >
                        编辑资料
                      </Button>
                      <Button
                        size="small"
                        onClick={() => history.push('/inventory/adjustments')}
                      >
                        库存处理
                      </Button>
                    </Space>
                    {assessment.issues.length ? (
                      <Space
                        orientation="vertical"
                        size={8}
                        style={{ width: '100%' }}
                      >
                        {assessment.issues.map((issue) => (
                          <Alert
                            action={
                              <Button
                                disabled={!canHandleQualityAction(issue.action)}
                                size="small"
                                onClick={() =>
                                  handleQualityAction(issue.action)
                                }
                              >
                                {qualityActionLabel(issue.action)}
                              </Button>
                            }
                            description={issue.description}
                            key={issue.key}
                            title={issue.title}
                            showIcon
                            type={issue.severity}
                          />
                        ))}
                      </Space>
                    ) : (
                      <Alert
                        description="商品主档案、价格、单位和库存状态未发现明显缺口。"
                        title="资料状态良好"
                        showIcon
                        type="success"
                      />
                    )}
                  </Space>
                );
              })()}
            </ProCard>

            <ProCard split="vertical">
              <ProCard colSpan="320px" title="商品图片">
                <ProductImage
                  alt={data.itemName || data.itemCode}
                  emptyText="暂无图片"
                  height={240}
                  objectFit="contain"
                  preview
                  src={data.imageUrl}
                  width={240}
                />
              </ProCard>
              <ProCard title="基础信息">
                <ProDescriptions column={2} dataSource={data}>
                  <ProDescriptions.Item label="商品编码" dataIndex="itemCode" />
                  <ProDescriptions.Item label="商品名称" dataIndex="itemName" />
                  <ProDescriptions.Item label="状态">
                    {data.disabled ? (
                      <Tag>停用</Tag>
                    ) : (
                      <Tag color="green">启用</Tag>
                    )}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item
                    label="规格"
                    dataIndex="specification"
                  />
                  <ProDescriptions.Item label="昵称" dataIndex="nickname" />
                  <ProDescriptions.Item
                    label="商品分类"
                    dataIndex="itemGroup"
                  />
                  <ProDescriptions.Item label="品牌" dataIndex="brand" />
                  <ProDescriptions.Item label="主条码" dataIndex="barcode" />
                  <ProDescriptions.Item label="销售商品">
                    {data.isSalesItem === false ? '否' : '是'}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="采购商品">
                    {data.isPurchaseItem === false ? '否' : '是'}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item
                    label="最后修改"
                    dataIndex="modified"
                    span={2}
                  />
                  <ProDescriptions.Item label="描述" span={2}>
                    {data.description || '-'}
                  </ProDescriptions.Item>
                </ProDescriptions>
              </ProCard>
            </ProCard>

            <ProCard extra={<Tag>{data.barcodes.length} 条</Tag>} title="条码">
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                <Form<BarcodeFormValues>
                  form={barcodeForm}
                  layout="inline"
                  onFinish={handleAddBarcode}
                >
                  <Form.Item
                    name="barcode"
                    rules={[{ required: true, message: '请输入条码' }]}
                  >
                    <Space.Compact style={{ width: 300 }}>
                      <Input disabled={!data.canWrite} placeholder="新增条码" />
                      <BarcodeScannerButton
                        buttonProps={{
                          disabled: !data.canWrite,
                          title: '扫描新增条码',
                        }}
                        label={null}
                        onScanned={(barcode) =>
                          barcodeForm.setFieldValue('barcode', barcode)
                        }
                        title="扫描新增商品条码"
                      />
                    </Space.Compact>
                  </Form.Item>
                  <Form.Item
                    name="uom"
                    rules={[{ required: true, message: '请选择条码对应单位' }]}
                  >
                    <Select
                      disabled={!data.canWrite}
                      options={data.allUoms.map((uom) => ({
                        label: productUomDisplay(uom, data.allUomDisplays[uom]),
                        value: uom,
                      }))}
                      placeholder="条码对应单位"
                      style={{ width: 160 }}
                    />
                  </Form.Item>
                  <Form.Item>
                    <Button
                      disabled={!data.canWrite}
                      htmlType="submit"
                      icon={<PlusOutlined />}
                      loading={barcodeSubmitting === 'add'}
                      type="primary"
                    >
                      新增条码
                    </Button>
                  </Form.Item>
                </Form>
                <BarcodeTable
                  canWrite={data.canWrite}
                  loading={barcodeSubmitting}
                  onDelete={handleDeleteBarcode}
                  onSetPrimary={handleSetPrimaryBarcode}
                  rows={data.barcodes}
                  uomDisplays={data.allUomDisplays}
                />
              </Space>
            </ProCard>

            <ProCard split="vertical">
              <ProCard
                extra={
                  <Space wrap>
                    <Button
                      disabled={!priceCollection?.canCreate}
                      icon={<PlusOutlined />}
                      onClick={() => openPriceEditor('selling')}
                      size="small"
                    >
                      新增销售价格
                    </Button>
                    <Button
                      disabled={!priceCollection?.canCreate}
                      icon={<PlusOutlined />}
                      onClick={() => openPriceEditor('buying')}
                      size="small"
                    >
                      新增采购价格
                    </Button>
                  </Space>
                }
                title="价格"
              >
                <Space
                  orientation="vertical"
                  size={12}
                  style={{ width: '100%' }}
                >
                  <ProDescriptions column={2}>
                    <ProDescriptions.Item label="当前价格表">
                      <PriceListName
                        code={data.priceSummary?.currentPriceList}
                      />
                    </ProDescriptions.Item>
                    <ProDescriptions.Item label="当前价格">
                      {formatCurrencyValue(data.priceSummary?.currentRate)}
                    </ProDescriptions.Item>
                    <ProDescriptions.Item label="标准销售参考价">
                      {formatCurrencyValue(
                        data.priceSummary?.standardSellingRate,
                      )}
                    </ProDescriptions.Item>
                    <ProDescriptions.Item label="批发价">
                      {formatCurrencyValue(data.priceSummary?.wholesaleRate)}
                    </ProDescriptions.Item>
                    <ProDescriptions.Item label="零售价">
                      {formatCurrencyValue(data.priceSummary?.retailRate)}
                    </ProDescriptions.Item>
                    <ProDescriptions.Item label="标准采购参考价">
                      {formatCurrencyValue(
                        data.priceSummary?.standardBuyingRate,
                      )}
                    </ProDescriptions.Item>
                    <ProDescriptions.Item label="库存估值成本" span={2}>
                      {formatCurrencyValue(data.priceSummary?.valuationRate)}
                    </ProDescriptions.Item>
                  </ProDescriptions>
                  <Alert
                    description="上方单值只是常用价格表的摘要；下方价格矩阵才是完整正式记录，同一价格表可以分别维护件价、箱价等不同单位价格。"
                    showIcon
                    title="价格按价格表、币种和计价单位分别维护"
                    type="info"
                  />
                  {priceError ? (
                    <Alert
                      action={
                        <Button onClick={refreshPrices} size="small">
                          重试
                        </Button>
                      }
                      showIcon
                      title={
                        priceError instanceof Error
                          ? priceError.message
                          : '完整价目表加载失败'
                      }
                      type="error"
                    />
                  ) : null}
                  <PriceEntriesTable
                    loadingPrice={terminatingPrice}
                    onEdit={
                      priceCollection?.canWrite
                        ? (record) => openPriceEditor('selling', record)
                        : undefined
                    }
                    onTerminate={
                      priceCollection?.canWrite
                        ? handleTerminatePrice
                        : undefined
                    }
                    rows={
                      priceCollection?.prices.filter(
                        (row) =>
                          row.priceListType === 'selling' ||
                          row.priceListType === 'both',
                      ) ?? []
                    }
                    title={`销售价格矩阵${priceLoading ? '（加载中）' : ''}`}
                  />
                  <PriceEntriesTable
                    loadingPrice={terminatingPrice}
                    onEdit={
                      priceCollection?.canWrite
                        ? (record) => openPriceEditor('buying', record)
                        : undefined
                    }
                    onTerminate={
                      priceCollection?.canWrite
                        ? handleTerminatePrice
                        : undefined
                    }
                    rows={
                      priceCollection?.prices.filter(
                        (row) =>
                          row.priceListType === 'buying' ||
                          row.priceListType === 'both',
                      ) ?? []
                    }
                    title={`采购价格矩阵${priceLoading ? '（加载中）' : ''}`}
                  />
                </Space>
              </ProCard>
              <ProCard title="单位">
                <ProDescriptions column={2}>
                  <ProDescriptions.Item label="库存单位">
                    {productUomDisplay(data.stockUom, data.stockUomDisplay)}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="批发默认单位">
                    {productUomDisplay(
                      data.wholesaleDefaultUom,
                      data.wholesaleDefaultUomDisplay,
                    )}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="零售默认单位" span={2}>
                    {productUomDisplay(
                      data.retailDefaultUom,
                      data.retailDefaultUomDisplay,
                    )}
                  </ProDescriptions.Item>
                </ProDescriptions>
                <Table<ProductSummary['uomConversions'][number]>
                  columns={[
                    {
                      dataIndex: 'uom',
                      title: '单位',
                      render: (value) =>
                        productUomDisplay(value, data.allUomDisplays[value]),
                    },
                    {
                      align: 'right',
                      dataIndex: 'conversionFactor',
                      title: '换算系数',
                      render: (value) => formatNumber(Number(value ?? 0)),
                    },
                  ]}
                  dataSource={data.uomConversions}
                  pagination={false}
                  rowKey={(record) => record.uom}
                  size="small"
                />
              </ProCard>
            </ProCard>

            <ProCard title="分仓库存">
              <WarehouseStockTable
                itemCode={data.itemCode}
                rows={
                  data.globalWarehouseStockDetails.length
                    ? data.globalWarehouseStockDetails
                    : data.warehouseStockDetails
                }
              />
            </ProCard>

            <ProCard title="最近库存流水">
              <ProTable<StockLedgerEntry>
                columns={recentLedgerColumns}
                pagination={false}
                request={async () => {
                  const result = await listStockLedgerEntries({
                    company,
                    itemCode: data.itemCode,
                    page: 1,
                    pageSize: 8,
                    warehouse,
                  });
                  return {
                    data: result.items,
                    success: true,
                    total: result.total,
                  };
                }}
                rowKey="name"
                search={false}
                size="small"
                toolBarRender={false}
              />
            </ProCard>
          </>
        ) : null}
      </Space>
      {data ? (
        <ProductPriceEditorModal
          collection={priceCollection}
          defaultType={priceEditorType}
          editingPrice={editingPrice}
          onClose={() => {
            setPriceEditorOpen(false);
            setEditingPrice(undefined);
          }}
          onSaved={() => {
            refreshPrices();
            refresh();
          }}
          open={priceEditorOpen}
          product={data}
        />
      ) : null}
      <ProductUomMigrationModal
        itemCode={data?.itemCode || itemCode}
        onClose={closeUomMigration}
        onCompleted={(newItemCode) => {
          setUomMigrationOpen(false);
          history.push(
            `/master-data/products/${encodeURIComponent(newItemCode)}`,
          );
        }}
        open={Boolean(data?.canWrite && uomMigrationOpen)}
      />
    </PageContainer>
  );
};

export default ProductDetailPage;
