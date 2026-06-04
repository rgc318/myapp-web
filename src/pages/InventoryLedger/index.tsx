import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Button, Tag } from 'antd';
import React, { useRef } from 'react';
import {
  listStockLedgerEntries,
  type StockLedgerEntry,
} from '@/services/myapp/inventory';

const DEFAULT_COMPANY = 'rgc (Demo)';
const PAGE_SIZE = 20;

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function qtyTag(value: number) {
  if (value > 0) {
    return <Tag color="green">入库</Tag>;
  }
  if (value < 0) {
    return <Tag color="orange">出库</Tag>;
  }
  return <Tag>无变化</Tag>;
}

const columns: ProColumns<StockLedgerEntry>[] = [
  {
    title: '公司',
    dataIndex: 'company',
    hideInTable: true,
    initialValue: DEFAULT_COMPANY,
  },
  {
    title: '商品编码',
    dataIndex: 'itemCode',
    hideInTable: true,
    fieldProps: {
      allowClear: true,
      placeholder: '商品编码',
    },
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
    title: '日期',
    dataIndex: 'dateRange',
    valueType: 'dateRange',
    hideInTable: true,
  },
  {
    title: '凭证类型',
    dataIndex: 'voucherType',
    hideInTable: true,
    fieldProps: {
      allowClear: true,
      placeholder: 'Delivery Note / Purchase Receipt',
    },
  },
  {
    title: '凭证编号',
    dataIndex: 'voucherNo',
    hideInTable: true,
    fieldProps: {
      allowClear: true,
      placeholder: '凭证编号',
    },
  },
  {
    title: '日期',
    dataIndex: 'postingDate',
    search: false,
    width: 120,
  },
  {
    title: '时间',
    dataIndex: 'postingTime',
    search: false,
    width: 100,
    renderText: (value) => value || '-',
  },
  {
    title: '商品名称',
    dataIndex: 'itemName',
    search: false,
    ellipsis: true,
  },
  {
    title: '商品编码',
    dataIndex: 'itemCode',
    search: false,
    width: 160,
  },
  {
    title: '仓库',
    dataIndex: 'warehouse',
    search: false,
    ellipsis: true,
    width: 180,
  },
  {
    title: '方向',
    dataIndex: 'actualQtyDirection',
    search: false,
    width: 90,
    render: (_, record) => qtyTag(record.actualQty),
  },
  {
    title: '变动数量',
    dataIndex: 'actualQty',
    align: 'right',
    search: false,
    width: 110,
    render: (_, record) => formatNumber(record.actualQty),
  },
  {
    title: '变动后数量',
    dataIndex: 'qtyAfterTransaction',
    align: 'right',
    search: false,
    width: 120,
    render: (_, record) => formatNumber(record.qtyAfterTransaction),
  },
  {
    title: '入库单价',
    dataIndex: 'incomingRate',
    align: 'right',
    search: false,
    width: 120,
    render: (_, record) => formatNumber(record.incomingRate),
  },
  {
    title: '库存价值变动',
    dataIndex: 'stockValueDifference',
    align: 'right',
    search: false,
    width: 140,
    render: (_, record) => formatNumber(record.stockValueDifference),
  },
  {
    title: '凭证类型',
    dataIndex: 'voucherType',
    search: false,
    width: 150,
  },
  {
    title: '凭证编号',
    dataIndex: 'voucherNo',
    search: false,
    ellipsis: true,
    width: 180,
  },
];

const InventoryLedgerPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);

  return (
    <PageContainer
      title="库存流水"
      extra={[
        <Button key="refresh" onClick={() => actionRef.current?.reload()}>
          刷新
        </Button>,
      ]}
    >
      <ProTable<StockLedgerEntry>
        actionRef={actionRef}
        columns={columns}
        pagination={{
          defaultPageSize: PAGE_SIZE,
          showSizeChanger: false,
        }}
        request={async (params) => {
          const current = Number(params.current ?? 1);
          const pageSize = Number(params.pageSize ?? PAGE_SIZE);
          const dateRange = Array.isArray(params.dateRange)
            ? params.dateRange
            : [];
          const result = await listStockLedgerEntries({
            company: String(params.company ?? DEFAULT_COMPANY),
            dateFrom: dateRange[0] ? String(dateRange[0]) : undefined,
            dateTo: dateRange[1] ? String(dateRange[1]) : undefined,
            itemCode: String(params.itemCode ?? ''),
            page: current,
            pageSize,
            voucherNo: String(params.voucherNo ?? ''),
            voucherType: String(params.voucherType ?? ''),
            warehouse: String(params.warehouse ?? ''),
          });

          return {
            data: result.items,
            success: true,
            total: result.total,
          };
        }}
        rowKey="name"
        search={{
          defaultCollapsed: false,
          labelWidth: 88,
        }}
        toolBarRender={false}
      />
    </PageContainer>
  );
};

export default InventoryLedgerPage;
