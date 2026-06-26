import { SearchOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Button, Image, Modal, Space, Tag, Typography } from 'antd';
import React, { useMemo, useState } from 'react';
import {
  type ProductSummary,
  searchProducts,
} from '@/services/myapp/master-data';
import { formatCurrencyValue } from '@/utils/myapp-display';
import { formatQty, resolveUomDisplay } from '@/utils/sales-order-editor';

type ProductContext = 'sales' | 'purchase' | 'inventory' | 'any';

function productLabel(record: ProductSummary) {
  return record.nickname?.trim() || record.itemName || record.itemCode;
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

export function ProductSelect({
  company,
  itemContext = 'any',
  placeholder = '选择商品',
  style,
  warehouse,
  onSelectProduct,
}: {
  company?: string;
  itemContext?: ProductContext;
  placeholder?: string;
  style?: React.CSSProperties;
  warehouse?: string;
  onSelectProduct: (product: ProductSummary) => void;
}) {
  const [open, setOpen] = useState(false);

  const columns = useMemo<ProColumns<ProductSummary>[]>(
    () => [
      {
        dataIndex: 'searchKey',
        hideInTable: true,
        title: '关键词',
      },
      {
        dataIndex: 'itemName',
        title: '商品',
        width: 320,
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
            <Space direction="vertical" size={0}>
              <Typography.Text strong>{productLabel(record)}</Typography.Text>
              {record.nickname && record.itemName !== record.nickname ? (
                <Typography.Text type="secondary">
                  {record.itemName}
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
        title: '分类',
        width: 140,
        search: false,
      },
      {
        dataIndex: 'stockUom',
        title: '单位',
        width: 120,
        search: false,
        render: (_, record) =>
          resolveUomDisplay(
            record.stockUom,
            record.allUomDisplays,
            record.stockUomDisplay,
          ),
      },
      {
        title: '库存',
        width: 180,
        search: false,
        render: (_, record) => {
          const { stockUomDisplay, totalQty, warehouseQty } = stockLabel(
            record,
            warehouse,
          );
          return (
            <Space direction="vertical" size={0}>
              <Typography.Text>
                总库存 {formatQty(totalQty)} {stockUomDisplay}
              </Typography.Text>
              <Typography.Text type="secondary">
                当前仓 {formatQty(warehouseQty)} {stockUomDisplay}
              </Typography.Text>
            </Space>
          );
        },
      },
      {
        title: itemContext === 'purchase' ? '采购参考价' : '销售参考价',
        width: 140,
        search: false,
        render: (_, record) => {
          const price = contextPrice(record, itemContext);
          return price == null ? (
            <Typography.Text type="secondary">未设置</Typography.Text>
          ) : (
            <Typography.Text strong>
              {formatCurrencyValue(price)}
            </Typography.Text>
          );
        },
      },
      {
        title: '状态',
        width: 120,
        search: false,
        render: (_, record) => (
          <Space size={4} wrap>
            {record.disabled ? <Tag color="default">停用</Tag> : null}
            {record.isSalesItem ? <Tag color="blue">销售</Tag> : null}
            {record.isPurchaseItem ? <Tag color="green">采购</Tag> : null}
          </Space>
        ),
      },
      {
        title: '操作',
        valueType: 'option',
        width: 90,
        render: (_, record) => [
          <Button
            key="select"
            onClick={() => {
              onSelectProduct(record);
              setOpen(false);
            }}
            type="link"
          >
            选择
          </Button>,
        ],
      },
    ],
    [itemContext, onSelectProduct, warehouse],
  );

  return (
    <>
      <Button
        icon={<SearchOutlined />}
        onClick={() => setOpen(true)}
        style={style}
        type="primary"
      >
        {placeholder}
      </Button>
      <Modal
        destroyOnClose
        footer={null}
        onCancel={() => setOpen(false)}
        open={open}
        title="选择商品"
        width={1080}
      >
        <ProTable<ProductSummary>
          columns={columns}
          options={false}
          pagination={{ pageSize: 10 }}
          request={async (params) => {
            const searchKey = String(params.searchKey ?? '').trim();
            if (!searchKey) {
              return {
                data: [],
                success: true,
                total: 0,
              };
            }
            const result = await searchProducts({
              company,
              itemContext,
              limit: params.pageSize,
              searchKey,
              start: ((params.current ?? 1) - 1) * (params.pageSize ?? 10),
              warehouse,
            });
            return {
              data: result.items,
              success: true,
              total: result.total,
            };
          }}
          rowKey="itemCode"
          scroll={{ x: 1120 }}
          search={{
            labelWidth: 72,
          }}
          size="small"
          locale={{
            emptyText: '请输入商品名称、编码、条码、别名或规格搜索商品',
          }}
        />
      </Modal>
    </>
  );
}
