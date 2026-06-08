import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { history, Link } from '@umijs/max';
import { Button, Image, Space, Table, Tag } from 'antd';
import React, { useRef } from 'react';
import {
  listProducts,
  type ProductSummary,
  type ProductWarehouseStockDetail,
} from '@/services/myapp/master-data';
import { formatCurrencyValue, formatDisplayUom } from '@/utils/myapp-display';

const DEFAULT_COMPANY = 'rgc (Demo)';
const PAGE_SIZE = 20;

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function stockStatusTag(value: number | null | undefined) {
  const qty = value ?? 0;
  if (qty > 0) {
    return <Tag color="green">有库存</Tag>;
  }
  if (qty < 0) {
    return <Tag color="red">负库存</Tag>;
  }
  return <Tag>无库存</Tag>;
}

function ledgerPath(itemCode?: string, warehouse?: string) {
  const params = new URLSearchParams();
  if (itemCode) {
    params.set('itemCode', itemCode);
  }
  if (warehouse) {
    params.set('warehouse', warehouse);
  }
  return `/inventory-ledger?${params.toString()}`;
}

function warehouseStockTable(
  itemCode: string,
  details: ProductWarehouseStockDetail[],
) {
  if (!details.length) {
    return <span>暂无仓库库存记录</span>;
  }

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
          title: '数量',
          render: (_, record) => formatNumber(record.qty),
        },
      ]}
      dataSource={details}
      pagination={false}
      rowKey={(record) => record.warehouse}
      size="small"
    />
  );
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
    dataIndex: 'warehouse',
    hideInTable: true,
    fieldProps: {
      allowClear: true,
      placeholder: '仓库',
    },
  },
  {
    title: '库存状态',
    dataIndex: 'inStockOnly',
    valueType: 'select',
    hideInTable: true,
    initialValue: 'all',
    valueEnum: {
      all: { text: '全部' },
      in_stock: { text: '仅有库存' },
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
    title: '当前库存',
    dataIndex: 'stockQty',
    align: 'right',
    search: false,
    width: 120,
    render: (_, record) => formatNumber(record.stockQty),
  },
  {
    title: '公司总库存',
    dataIndex: 'totalQty',
    align: 'right',
    search: false,
    width: 120,
    render: (_, record) => formatNumber(record.totalQty),
  },
  {
    title: '单位',
    dataIndex: 'stockUom',
    search: false,
    width: 100,
    render: (_, record) => formatDisplayUom(record.stockUom),
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
    title: '零售价',
    dataIndex: ['priceSummary', 'retailRate'],
    align: 'right',
    search: false,
    width: 120,
    render: (_, record) => formatCurrencyValue(record.priceSummary?.retailRate),
  },
  {
    title: '状态',
    dataIndex: 'stockStatus',
    search: false,
    width: 100,
    render: (_, record) => stockStatusTag(record.stockQty),
  },
  {
    title: '操作',
    valueType: 'option',
    width: 120,
    render: (_, record) => [
      <Link key="ledger" to={ledgerPath(record.itemCode, record.warehouse)}>
        查看流水
      </Link>,
    ],
  },
];

const InventoryStockPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);

  return (
    <PageContainer
      title="商品库存"
      extra={[
        <Button key="ledger" onClick={() => history.push('/inventory/ledger')}>
          库存流水
        </Button>,
        <Button key="refresh" onClick={() => actionRef.current?.reload()}>
          刷新
        </Button>,
      ]}
    >
      <ProTable<ProductSummary>
        actionRef={actionRef}
        columns={columns}
        expandable={{
          expandedRowRender: (record) => (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <strong>仓库库存</strong>
              {warehouseStockTable(
                record.itemCode,
                record.warehouseStockDetails,
              )}
            </Space>
          ),
        }}
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
            inStockOnly: params.inStockOnly === 'in_stock',
            limit: pageSize,
            searchKey: String(params.searchKey ?? ''),
            start: (current - 1) * pageSize,
            warehouse: String(params.warehouse ?? ''),
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

export default InventoryStockPage;
