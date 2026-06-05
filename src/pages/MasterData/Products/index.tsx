import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Button, Image, Tag } from 'antd';
import React, { useRef } from 'react';
import {
  listProducts,
  type ProductSummary,
} from '@/services/myapp/master-data';
import { formatCurrencyValue, formatDisplayUom } from '@/utils/myapp-display';

const DEFAULT_COMPANY = 'rgc (Demo)';
const PAGE_SIZE = 20;

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

const columns: ProColumns<ProductSummary>[] = [
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
    initialValue: DEFAULT_COMPANY,
  },
  {
    title: '仓库',
    dataIndex: 'warehouseFilter',
    hideInTable: true,
    fieldProps: {
      allowClear: true,
      placeholder: '仓库',
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
    render: (_, record) => formatDisplayUom(record.stockUom),
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
    title: '状态',
    dataIndex: 'disabled',
    search: false,
    width: 90,
    render: (_, record) =>
      record.disabled ? <Tag>停用</Tag> : <Tag color="green">启用</Tag>,
  },
];

const ProductsPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);

  return (
    <PageContainer
      title="商品"
      extra={[
        <Button key="refresh" onClick={() => actionRef.current?.reload()}>
          刷新
        </Button>,
      ]}
    >
      <ProTable<ProductSummary>
        actionRef={actionRef}
        columns={columns}
        pagination={{
          defaultPageSize: PAGE_SIZE,
          showSizeChanger: false,
        }}
        request={async (params) => {
          const current = Number(params.current ?? 1);
          const pageSize = Number(params.pageSize ?? PAGE_SIZE);
          const result = await listProducts({
            company: String(params.company ?? DEFAULT_COMPANY),
            disabled: 0,
            limit: pageSize,
            searchKey: String(params.searchKey ?? ''),
            start: (current - 1) * pageSize,
            warehouse: String(params.warehouseFilter ?? ''),
          });

          return {
            data: result.items,
            success: true,
            total: result.total,
          };
        }}
        rowKey="itemCode"
        search={{
          defaultCollapsed: false,
          labelWidth: 88,
        }}
        toolBarRender={false}
      />
    </PageContainer>
  );
};

export default ProductsPage;
