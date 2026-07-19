import { ExportOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Space,
  Spin,
  Table,
  Tag,
} from 'antd';
import React, { useEffect, useState } from 'react';
import type { AiCitation } from '@/services/myapp/ai';
import {
  getProductDetail,
  type ProductSummary,
} from '@/services/myapp/master-data';
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

  useEffect(() => {
    let active = true;
    setDetail(null);
    setError(null);
    if (!citation?.id) return () => undefined;
    setLoading(true);
    void getProductDetail(citation.id, {
      company:
        typeof citation.data.company === 'string'
          ? citation.data.company
          : undefined,
    })
      .then((result) => {
        if (!active) return;
        setDetail(result);
        if (!result) setError('未能读取当前商品详情。');
      })
      .catch((caught) => {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : '商品详情加载失败',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [citation]);

  return (
    <Drawer
      extra={
        citation?.id ? (
          <Button
            href={`/master-data/products/${encodeURIComponent(citation.id)}`}
            icon={<ExportOutlined />}
          >
            在商品模块打开
          </Button>
        ) : null
      }
      onClose={onClose}
      open={Boolean(citation)}
      size="large"
      title={citation ? `商品详情 ${citation.label}` : '商品详情'}
    >
      <Spin spinning={loading}>
        {error ? <Alert showIcon title={error} type="error" /> : null}
        {detail ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
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
