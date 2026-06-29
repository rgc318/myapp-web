import { DeleteOutlined, PlusOutlined, StarOutlined } from '@ant-design/icons';
import {
  PageContainer,
  ProCard,
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
  Image,
  Input,
  InputNumber,
  Modal,
  message,
  Popconfirm,
  Skeleton,
  Space,
  Switch,
  Table,
  Tag,
} from 'antd';
import React, { useState } from 'react';
import { ItemImageUpload } from '@/components/ItemImageUpload';
import { RemoteLinkSelect } from '@/components/RemoteLinkSelect';
import { UomSelect } from '@/components/UomSelect';
import { useWorkspacePreferences } from '@/hooks/useWorkspacePreferences';
import {
  listStockLedgerEntries,
  type StockLedgerEntry,
} from '@/services/myapp/inventory';
import {
  addProductBarcode,
  deleteProductBarcode,
  getProductDetail,
  type ProductBarcode,
  type ProductPriceEntry,
  type ProductSummary,
  type ProductWarehouseStockDetail,
  type SaveProductPayload,
  setPrimaryProductBarcode,
  setProductDisabled,
  updateProduct,
} from '@/services/myapp/master-data';
import { formatCurrencyValue, resolveDisplayUom } from '@/utils/myapp-display';

type ProductFormValues = SaveProductPayload;
type BarcodeFormValues = {
  barcode: string;
};
type ProductQualityIssue = {
  action?: 'edit' | 'inventory';
  description: string;
  key: string;
  title: string;
  type: 'error' | 'warning' | 'info';
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

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function hasPositiveAmount(value: number | null | undefined) {
  return Number(value ?? 0) > 0;
}

function buildProductQualityIssues(
  product: ProductSummary,
): ProductQualityIssue[] {
  const issues: ProductQualityIssue[] = [];
  const totalQty = Number(product.totalQty ?? product.stockQty ?? 0);

  if (!hasText(product.imageUrl)) {
    issues.push({
      action: 'edit',
      description: '缺少商品图片会降低选品和现场识别效率。',
      key: 'image',
      title: '未维护商品图片',
      type: 'info',
    });
  }
  if (!hasText(product.itemGroup)) {
    issues.push({
      action: 'edit',
      description: '商品分类会影响筛选、选品和经营报表分层。',
      key: 'item-group',
      title: '未维护商品分类',
      type: 'warning',
    });
  }
  if (!hasText(product.brand)) {
    issues.push({
      action: 'edit',
      description: '品牌信息缺失会影响采购、销售和商品分析维度。',
      key: 'brand',
      title: '未维护品牌',
      type: 'info',
    });
  }
  if (!hasText(product.barcode)) {
    issues.push({
      action: 'edit',
      description: '缺少主条码会影响扫码选品和移动端现场操作。',
      key: 'barcode',
      title: '未维护主条码',
      type: 'warning',
    });
  }
  if (!hasText(product.stockUom)) {
    issues.push({
      action: 'edit',
      description: '库存单位是销售、采购、库存换算的基础字段。',
      key: 'stock-uom',
      title: '未维护库存单位',
      type: 'error',
    });
  }
  if (!product.uomConversions.length) {
    issues.push({
      action: 'edit',
      description: '缺少单位换算会影响多单位销售、采购和库存核算。',
      key: 'uom-conversion',
      title: '未维护单位换算',
      type: 'warning',
    });
  }
  if (!hasPositiveAmount(product.priceSummary?.standardSellingRate)) {
    issues.push({
      action: 'edit',
      description: '缺少标准售价会影响销售录单和报价参考。',
      key: 'selling-price',
      title: '未维护标准售价',
      type: 'warning',
    });
  }
  if (!hasPositiveAmount(product.priceSummary?.standardBuyingRate)) {
    issues.push({
      action: 'edit',
      description: '缺少采购价会影响采购录单、成本估算和毛利分析。',
      key: 'buying-price',
      title: '未维护标准采购价',
      type: 'warning',
    });
  }
  if (product.disabled && totalQty > 0) {
    issues.push({
      action: 'inventory',
      description: '停用商品仍有库存，建议确认是否需要清仓、调拨或继续启用。',
      key: 'disabled-with-stock',
      title: '停用商品仍有库存',
      type: 'warning',
    });
  }
  if (totalQty < 0) {
    issues.push({
      action: 'inventory',
      description: '负库存会影响成本和可售库存判断，应优先核对库存流水。',
      key: 'negative-stock',
      title: '存在负库存',
      type: 'error',
    });
  }

  return issues;
}

function qualityScore(issues: ProductQualityIssue[]) {
  const penalty = issues.reduce((total, issue) => {
    if (issue.type === 'error') {
      return total + 25;
    }
    if (issue.type === 'warning') {
      return total + 15;
    }
    return total + 8;
  }, 0);
  return Math.max(0, 100 - penalty);
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
  rows,
  title,
}: {
  rows: ProductPriceEntry[];
  title: string;
}) {
  return (
    <Table<ProductPriceEntry>
      columns={[
        {
          dataIndex: 'priceList',
          title: '价格表',
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
      ]}
      dataSource={rows}
      locale={{ emptyText: '暂无价格记录' }}
      pagination={false}
      rowKey={(record) => record.priceList}
      size="small"
      title={() => title}
    />
  );
}

function BarcodeTable({
  loading,
  onDelete,
  onSetPrimary,
  rows,
}: {
  loading?: string;
  onDelete: (record: ProductBarcode) => void;
  onSetPrimary: (record: ProductBarcode) => void;
  rows: ProductBarcode[];
}) {
  return (
    <Table<ProductBarcode>
      columns={[
        {
          dataIndex: 'barcode',
          title: '条码',
        },
        {
          dataIndex: 'isPrimary',
          title: '主条码',
          width: 100,
          render: (_, record) =>
            record.isPrimary ? <Tag color="green">主条码</Tag> : '-',
        },
        {
          title: '操作',
          width: 180,
          render: (_, record) => [
            <Button
              disabled={record.isPrimary}
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
      ]}
      dataSource={rows}
      locale={{ emptyText: '暂无条码' }}
      pagination={false}
      rowKey={(record) => record.barcode}
      size="small"
    />
  );
}

const ProductDetailPage: React.FC = () => {
  const params = useParams();
  const location = useLocation();
  const [form] = Form.useForm<ProductFormValues>();
  const [barcodeForm] = Form.useForm<BarcodeFormValues>();
  const { defaultCompany } = useWorkspacePreferences();
  const query = new URLSearchParams(location.search);
  const itemCode = decodeURIComponent(String(params.itemCode ?? ''));
  const company = query.get('company') || defaultCompany;
  const warehouse = query.get('warehouse') || undefined;
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [barcodeSubmitting, setBarcodeSubmitting] = useState<string>();

  const { data, error, loading, refresh } = useRequest(
    () => getProductDetail(itemCode, { company, warehouse }),
    {
      formatResult: (result) => result,
      refreshDeps: [itemCode, company, warehouse],
    },
  );

  const openEdit = () => {
    if (!data) {
      return;
    }
    form.setFieldsValue({
      barcode: data.barcode,
      brand: data.brand,
      currency: 'CNY',
      description: data.description,
      disabled: data.disabled,
      image: data.imageUrl || undefined,
      itemGroup: data.itemGroup,
      itemName: data.itemName,
      retailDefaultUom: data.retailDefaultUom ?? data.stockUom,
      standardBuyingRate: data.priceSummary?.standardBuyingRate ?? undefined,
      standardSellingRate:
        data.priceSummary?.standardSellingRate ??
        data.priceSummary?.currentRate ??
        undefined,
      retailRate: data.priceSummary?.retailRate ?? undefined,
      stockUom: data.stockUom,
      valuationRate: data.priceSummary?.valuationRate ?? undefined,
      wholesaleDefaultUom: data.wholesaleDefaultUom ?? data.stockUom,
      wholesaleRate: data.priceSummary?.wholesaleRate ?? undefined,
    });
    setEditOpen(true);
  };

  const handleEditSubmit = async (values: ProductFormValues) => {
    if (!data) {
      return;
    }
    setSubmitting(true);
    try {
      await updateProduct(data.itemCode, values);
      setEditOpen(false);
      refresh();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleDisabled = async () => {
    if (!data) {
      return;
    }
    setToggling(true);
    try {
      await setProductDisabled(data.itemCode, !data.disabled);
      refresh();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '操作失败');
    } finally {
      setToggling(false);
    }
  };

  const handleAddBarcode = async (values: BarcodeFormValues) => {
    if (!data) {
      return;
    }
    const barcode = values.barcode?.trim();
    if (!barcode) {
      message.warning('请输入条码');
      return;
    }
    setBarcodeSubmitting('add');
    try {
      await addProductBarcode(data.itemCode, barcode);
      barcodeForm.resetFields();
      refresh();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '新增条码失败');
    } finally {
      setBarcodeSubmitting(undefined);
    }
  };

  const handleSetPrimaryBarcode = async (record: ProductBarcode) => {
    if (!data) {
      return;
    }
    setBarcodeSubmitting(`primary:${record.barcode}`);
    try {
      await setPrimaryProductBarcode(data.itemCode, record.barcode);
      refresh();
    } catch (caught) {
      message.error(
        caught instanceof Error ? caught.message : '设置主条码失败',
      );
    } finally {
      setBarcodeSubmitting(undefined);
    }
  };

  const handleDeleteBarcode = async (record: ProductBarcode) => {
    if (!data) {
      return;
    }
    setBarcodeSubmitting(`delete:${record.barcode}`);
    try {
      await deleteProductBarcode(data.itemCode, record.barcode);
      refresh();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '删除条码失败');
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
        <Button disabled={!data} key="edit" onClick={openEdit} type="primary">
          编辑商品
        </Button>,
        data ? (
          <Popconfirm
            cancelText="取消"
            key="toggle"
            okText={data.disabled ? '启用' : '停用'}
            onConfirm={handleToggleDisabled}
            title={`${data.disabled ? '启用' : '停用'}商品 ${data.itemName || data.itemCode}？`}
          >
            <Button danger={!data.disabled} loading={toggling}>
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
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
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
            message="商品详情加载失败"
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
                const issues = buildProductQualityIssues(data);
                const score = qualityScore(issues);
                return (
                  <Space
                    direction="vertical"
                    size={12}
                    style={{ width: '100%' }}
                  >
                    <Space wrap>
                      <Tag
                        color={
                          score >= 85 ? 'green' : score >= 70 ? 'gold' : 'red'
                        }
                      >
                        资料完整度 {score}%
                      </Tag>
                      <Tag
                        color={
                          issues.some((issue) => issue.type === 'error')
                            ? 'red'
                            : 'blue'
                        }
                      >
                        {issues.length
                          ? `${issues.length} 项待处理`
                          : '无需处理'}
                      </Tag>
                      <Button size="small" onClick={openEdit}>
                        编辑资料
                      </Button>
                      <Button
                        size="small"
                        onClick={() => history.push('/inventory/adjustments')}
                      >
                        库存处理
                      </Button>
                    </Space>
                    {issues.length ? (
                      <Space
                        direction="vertical"
                        size={8}
                        style={{ width: '100%' }}
                      >
                        {issues.map((issue) => (
                          <Alert
                            action={
                              issue.action === 'inventory' ? (
                                <Button
                                  size="small"
                                  onClick={() =>
                                    history.push(
                                      issue.key === 'negative-stock'
                                        ? ledgerPath(data.itemCode, warehouse)
                                        : '/inventory/adjustments',
                                    )
                                  }
                                >
                                  处理库存
                                </Button>
                              ) : (
                                <Button size="small" onClick={openEdit}>
                                  补充资料
                                </Button>
                              )
                            }
                            description={issue.description}
                            key={issue.key}
                            message={issue.title}
                            showIcon
                            type={issue.type}
                          />
                        ))}
                      </Space>
                    ) : (
                      <Alert
                        description="商品主档案、价格、单位和库存状态未发现明显缺口。"
                        message="资料状态良好"
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
                {data.imageUrl ? (
                  <Image src={data.imageUrl} width={240} />
                ) : (
                  <Empty
                    description="暂无图片"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                )}
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
                  <ProDescriptions.Item label="条码" dataIndex="barcode" />
                  <ProDescriptions.Item label="销售商品">
                    {data.isSalesItem === false ? '否' : '是'}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="采购商品">
                    {data.isPurchaseItem === false ? '否' : '是'}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="最后修改" dataIndex="modified" />
                  <ProDescriptions.Item label="描述" span={2}>
                    {data.description || '-'}
                  </ProDescriptions.Item>
                </ProDescriptions>
              </ProCard>
            </ProCard>

            <ProCard title="条码">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Form<BarcodeFormValues>
                  form={barcodeForm}
                  layout="inline"
                  onFinish={handleAddBarcode}
                >
                  <Form.Item
                    name="barcode"
                    rules={[{ required: true, message: '请输入条码' }]}
                  >
                    <Input placeholder="新增条码" style={{ width: 260 }} />
                  </Form.Item>
                  <Form.Item>
                    <Button
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
                  loading={barcodeSubmitting}
                  onDelete={handleDeleteBarcode}
                  onSetPrimary={handleSetPrimaryBarcode}
                  rows={data.barcodes}
                />
              </Space>
            </ProCard>

            <ProCard split="vertical">
              <ProCard title="价格">
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <ProDescriptions column={2}>
                    <ProDescriptions.Item label="当前价格表">
                      {data.priceSummary?.currentPriceList || '-'}
                    </ProDescriptions.Item>
                    <ProDescriptions.Item label="当前价格">
                      {formatCurrencyValue(data.priceSummary?.currentRate)}
                    </ProDescriptions.Item>
                    <ProDescriptions.Item label="标准售价">
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
                    <ProDescriptions.Item label="采购价">
                      {formatCurrencyValue(
                        data.priceSummary?.standardBuyingRate,
                      )}
                    </ProDescriptions.Item>
                    <ProDescriptions.Item label="估值价">
                      {formatCurrencyValue(data.priceSummary?.valuationRate)}
                    </ProDescriptions.Item>
                  </ProDescriptions>
                  <PriceEntriesTable
                    rows={data.priceSummary?.sellingPrices ?? []}
                    title="销售价格表"
                  />
                  <PriceEntriesTable
                    rows={data.priceSummary?.buyingPrices ?? []}
                    title="采购价格表"
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
                  <ProDescriptions.Item label="零售默认单位">
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
      <Modal
        confirmLoading={submitting}
        destroyOnHidden
        onCancel={() => setEditOpen(false)}
        onOk={() => form.submit()}
        open={editOpen}
        title={data ? `编辑商品 ${data.itemCode}` : '编辑商品'}
        width={760}
      >
        <Form<ProductFormValues>
          form={form}
          layout="vertical"
          onFinish={handleEditSubmit}
        >
          <Form.Item label="商品图片" name="image">
            <ItemImageUpload itemCode={data?.itemCode} value={data?.imageUrl} />
          </Form.Item>
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

export default ProductDetailPage;
