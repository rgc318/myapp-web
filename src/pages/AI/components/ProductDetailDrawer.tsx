import { ExportOutlined, ReloadOutlined } from '@ant-design/icons';
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
import { ProductImage } from '@/components/ProductImage';
import type { AiCitation } from '@/services/myapp/ai';
import {
  getProductDetail,
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
      setLoading(true);
      try {
        const result = await getProductDetail(citation.id, {
          company:
            typeof citation.data.company === 'string'
              ? citation.data.company
              : undefined,
        });
        if (requestId !== requestSequence.current) return;
        setDetail(result);
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
    setError(null);
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
