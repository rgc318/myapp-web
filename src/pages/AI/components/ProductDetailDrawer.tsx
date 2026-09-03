import {
  EditOutlined,
  ExportOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { ProCard } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ItemImageUpload } from '@/components/ItemImageUpload';
import { PriceListName } from '@/components/PriceListName';
import { ProductImage } from '@/components/ProductImage';
import type { AiCitation } from '@/services/myapp/ai';
import {
  getProductDetail,
  listProductPrices,
  type ProductPriceCollection,
  type ProductSummary,
} from '@/services/myapp/master-data';
import { resolveMediaUrl } from '@/services/myapp/media-url';
import { formatCurrencyValue, resolveDisplayUom } from '@/utils/myapp-display';

export function ProductDetailDrawer({
  citation,
  onClose,
}: {
  citation: AiCitation | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<ProductSummary | null>(null);
  const [prices, setPrices] = useState<ProductPriceCollection | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [readAt, setReadAt] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const loadCurrentData = useCallback(
    async (clearDetail = false) => {
      if (!citation?.id) return;
      const requestId = ++requestSequence.current;
      if (clearDetail) setDetail(null);
      setError(null);
      setPriceError(null);
      setLoading(true);
      try {
        let currentPriceError: string | null = null;
        const [result, priceResult] = await Promise.all([
          getProductDetail(citation.id, {
            company:
              typeof citation.data.company === 'string'
                ? citation.data.company
                : undefined,
          }),
          listProductPrices(citation.id).catch((caught) => {
            currentPriceError =
              caught instanceof Error ? caught.message : '完整价目表加载失败';
            return null;
          }),
        ]);
        if (requestId !== requestSequence.current) return;
        setDetail(result);
        setPrices(priceResult);
        setPriceError(currentPriceError);
        setReadAt(dayjs().format('YYYY-MM-DD HH:mm:ss'));
        if (!result) setError('未能读取当前商品详情。');
      } catch (caught) {
        if (requestId !== requestSequence.current) return;
        setError(caught instanceof Error ? caught.message : '商品详情加载失败');
      } finally {
        if (requestId === requestSequence.current) setLoading(false);
      }
    },
    [citation],
  );

  useEffect(() => {
    requestSequence.current += 1;
    setDetail(null);
    setPrices(null);
    setError(null);
    setPriceError(null);
    setReadAt(null);
    setLoading(false);
    if (citation?.id) void loadCurrentData(true);
    return () => {
      requestSequence.current += 1;
    };
  }, [citation, loadCurrentData]);

  const snapshotAt =
    typeof citation?.data.queried_at === 'string'
      ? citation.data.queried_at
      : null;
  const snapshotUom = String(
    citation?.data.uom_display ?? citation?.data.uom ?? '',
  );

  return (
    <Drawer
      extra={
        <Space wrap>
          {citation?.id ? (
            <Button
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={() => void loadCurrentData(false)}
            >
              刷新当前数据
            </Button>
          ) : null}
          {citation?.id ? (
            <Button
              href={`/master-data/products/${encodeURIComponent(citation.id)}/edit?section=basic`}
              icon={<EditOutlined />}
              type="primary"
            >
              维护商品
            </Button>
          ) : null}
          {citation?.id ? (
            <Button
              href={`/master-data/products/${encodeURIComponent(citation.id)}`}
              icon={<ExportOutlined />}
            >
              在商品模块打开
            </Button>
          ) : null}
        </Space>
      }
      onClose={onClose}
      open={Boolean(citation)}
      size="large"
      title={citation ? `商品详情 ${citation.label}` : '商品详情'}
    >
      <Spin spinning={loading}>
        {error ? <Alert showIcon title={error} type="error" /> : null}
        {citation ? (
          <ProCard
            headerBordered
            style={{ marginBottom: 16 }}
            title={
              <Space wrap>
                <span>回答时数据</span>
                <Tag color="blue">生成时快照</Tag>
              </Space>
            }
            variant="outlined"
          >
            <Descriptions
              column={{ lg: 2, md: 2, sm: 1, xs: 1 }}
              items={[
                {
                  key: 'snapshotAt',
                  label: '查询时间',
                  children: snapshotAt || '历史记录未保存查询时间',
                },
                {
                  key: 'scope',
                  label: '数据范围',
                  children: `${String(citation.data.company ?? '未记录公司')} · 当前账号权限`,
                },
                {
                  key: 'qty',
                  label: '回答时库存',
                  children:
                    `${Number(citation.data.qty ?? 0).toLocaleString('zh-CN')} ${snapshotUom}`.trim(),
                },
                {
                  key: 'price',
                  label: '回答时参考价',
                  children: formatCurrencyValue(
                    Number(citation.data.price ?? 0),
                    'CNY',
                  ),
                },
                {
                  key: 'image',
                  label: '回答时图片',
                  span: 2,
                  children: (
                    <ProductImage
                      alt={citation.label}
                      emptyText="当时无图片"
                      height={96}
                      preview
                      src={resolveMediaUrl(
                        typeof citation.data.image === 'string'
                          ? citation.data.image
                          : '',
                      )}
                      width={96}
                    />
                  ),
                },
              ]}
              size="small"
            />
          </ProCard>
        ) : null}
        {detail ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Space orientation="vertical" size={2}>
              <Space wrap>
                <Typography.Title level={5} style={{ margin: 0 }}>
                  当前数据
                </Typography.Title>
                <Tag color="success">实时读取</Tag>
              </Space>
              <Typography.Text type="secondary">
                读取时间：{readAt ?? '-'}
                {detail.modified ? ` · 商品最近修改：${detail.modified}` : ''}
              </Typography.Text>
            </Space>
            <ProCard title="商品图片" variant="outlined">
              <Space orientation="vertical" size={12}>
                <Typography.Text type="secondary">
                  在这里上传、替换或删除后会直接保存到当前商品，并记录正式商品修改时间。
                </Typography.Text>
                <ItemImageUpload
                  commitMode="immediate"
                  itemCode={detail.itemCode}
                  onChange={() => void loadCurrentData(false)}
                  value={detail.imageUrl}
                />
              </Space>
            </ProCard>
            <Descriptions
              bordered
              column={{ lg: 2, md: 2, sm: 1, xs: 1 }}
              items={[
                { key: 'code', label: '商品编码', children: detail.itemCode },
                { key: 'name', label: '商品名称', children: detail.itemName },
                {
                  key: 'group',
                  label: '商品分类',
                  children: detail.itemGroup || '-',
                },
                { key: 'brand', label: '品牌', children: detail.brand || '-' },
                {
                  key: 'uom',
                  label: '库存基准单位',
                  children: resolveDisplayUom(
                    detail.stockUom,
                    detail.stockUomDisplay,
                  ),
                },
                {
                  key: 'price',
                  label: '当前参考价',
                  children: formatCurrencyValue(detail.price, 'CNY'),
                },
                {
                  key: 'qty',
                  label: '当前范围库存',
                  children: detail.totalQty ?? 0,
                },
                {
                  key: 'status',
                  label: '状态',
                  children: detail.disabled ? (
                    <Tag color="default">已停用</Tag>
                  ) : (
                    <Tag color="success">启用</Tag>
                  ),
                },
                {
                  key: 'description',
                  label: '描述',
                  span: 2,
                  children: detail.description || '-',
                },
              ]}
              size="small"
            />
            <ProCard
              extra={<Tag>{detail.uomConversions.length} 个单位</Tag>}
              title="单位与包装"
              variant="outlined"
            >
              <Descriptions
                column={{ lg: 2, md: 2, sm: 1, xs: 1 }}
                items={[
                  {
                    key: 'stockUom',
                    label: '库存基准单位',
                    children: resolveDisplayUom(
                      detail.stockUom,
                      detail.stockUomDisplay,
                    ),
                  },
                  {
                    key: 'wholesaleUom',
                    label: '批发默认单位',
                    children: resolveDisplayUom(
                      detail.wholesaleDefaultUom,
                      detail.wholesaleDefaultUomDisplay,
                    ),
                  },
                  {
                    key: 'retailUom',
                    label: '零售默认单位',
                    children: resolveDisplayUom(
                      detail.retailDefaultUom,
                      detail.retailDefaultUomDisplay,
                    ),
                  },
                ]}
                size="small"
              />
              <Table
                columns={[
                  {
                    dataIndex: 'uom',
                    title: '单位',
                    render: (value) =>
                      resolveDisplayUom(value, detail.allUomDisplays[value]),
                  },
                  {
                    align: 'right' as const,
                    dataIndex: 'conversionFactor',
                    title: `换算为 ${resolveDisplayUom(detail.stockUom)}`,
                  },
                ]}
                dataSource={detail.uomConversions}
                pagination={false}
                rowKey="uom"
                size="small"
              />
            </ProCard>
            <ProCard
              extra={<Tag>{prices?.prices.length ?? 0} 条</Tag>}
              title="完整价目表"
              variant="outlined"
            >
              {priceError ? (
                <Alert
                  description="商品基础资料仍可正常查看；可刷新重试或进入商品模块维护价目表。"
                  showIcon
                  title={priceError}
                  type="warning"
                />
              ) : null}
              <Table
                columns={[
                  {
                    dataIndex: 'priceList',
                    render: (value) => <PriceListName code={value} />,
                    title: '价格表',
                    width: 120,
                  },
                  {
                    dataIndex: 'priceListType',
                    render: (value) =>
                      value === 'buying'
                        ? '采购'
                        : value === 'both'
                          ? '销售 / 采购'
                          : '销售',
                    title: '类型',
                    width: 110,
                  },
                  {
                    dataIndex: 'uom',
                    render: (value) => resolveDisplayUom(value),
                    title: '计价单位',
                    width: 110,
                  },
                  { dataIndex: 'currency', title: '币种', width: 80 },
                  {
                    align: 'right' as const,
                    dataIndex: 'rate',
                    render: (value) => formatCurrencyValue(value),
                    title: '价格',
                    width: 120,
                  },
                  { dataIndex: 'validFrom', title: '生效日期', width: 110 },
                  { dataIndex: 'validUpto', title: '失效日期', width: 110 },
                ]}
                dataSource={prices?.prices ?? []}
                locale={{
                  emptyText: priceError ? '价目表读取失败' : '暂无价格',
                }}
                pagination={false}
                rowKey="name"
                scroll={{ x: 820 }}
                size="small"
              />
            </ProCard>
            <ProCard
              extra={<Tag>{detail.barcodes.length} 条</Tag>}
              title="条码"
              variant="outlined"
            >
              <Table
                columns={[
                  { dataIndex: 'barcode', title: '条码' },
                  {
                    dataIndex: 'uom',
                    render: (value) => resolveDisplayUom(value),
                    title: '对应单位',
                  },
                  {
                    dataIndex: 'isPrimary',
                    render: (value) =>
                      value ? <Tag color="green">主条码</Tag> : '-',
                    title: '主条码',
                    width: 100,
                  },
                ]}
                dataSource={detail.barcodes}
                locale={{ emptyText: '暂无条码' }}
                pagination={false}
                rowKey={(row) => row.name || row.barcode}
                size="small"
              />
            </ProCard>
            <Table
              columns={[
                { dataIndex: 'warehouse', key: 'warehouse', title: '仓库' },
                {
                  align: 'right' as const,
                  dataIndex: 'qty',
                  key: 'qty',
                  title: '库存数量',
                },
                { dataIndex: 'company', key: 'company', title: '公司' },
              ]}
              dataSource={detail.warehouseStockDetails}
              pagination={false}
              rowKey={(row) => `${row.company}-${row.warehouse}`}
              size="small"
            />
          </Space>
        ) : null}
      </Spin>
    </Drawer>
  );
}
