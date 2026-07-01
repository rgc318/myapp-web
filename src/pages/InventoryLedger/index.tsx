import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Link, useLocation } from '@umijs/max';
import { Button, Tag } from 'antd';
import dayjs from 'dayjs';
import React, { useRef } from 'react';
import { RemoteLinkSelect } from '@/components';
import { useWorkspacePreferences } from '@/hooks/useWorkspacePreferences';
import { toOptionalText } from '@/services/myapp/api-utils';
import {
  listStockLedgerEntries,
  type StockLedgerEntry,
} from '@/services/myapp/inventory';
import { formatCurrencyValue } from '@/utils/myapp-display';

const PAGE_SIZE = 20;

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function last30DaysRange() {
  return [
    dayjs().subtract(29, 'day').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD'),
  ];
}

function formatDateParam(value: unknown) {
  if (!value) {
    return undefined;
  }
  if (dayjs.isDayjs(value)) {
    return value.format('YYYY-MM-DD');
  }
  const parsed = dayjs(String(value));
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : String(value);
}

function signedText(value: number) {
  const color = value > 0 ? '#15803d' : value < 0 ? '#b45309' : undefined;
  const prefix = value > 0 ? '+' : '';
  return <span style={{ color }}>{`${prefix}${formatNumber(value)}`}</span>;
}

function signedCurrencyText(value: number | null | undefined) {
  const amount = value ?? 0;
  const color = amount > 0 ? '#15803d' : amount < 0 ? '#b45309' : undefined;
  const prefix = amount > 0 ? '+' : '';
  return (
    <span style={{ color }}>{`${prefix}${formatCurrencyValue(amount)}`}</span>
  );
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

function voucherLink(record: StockLedgerEntry) {
  if (!record.voucherNo) {
    return '-';
  }

  const routeMap: Record<string, string> = {
    'Delivery Note': '/sales/delivery-notes',
    'Purchase Invoice': '/purchase/invoices',
    'Purchase Receipt': '/purchase/receipts',
    'Purchase Order': '/purchase/orders',
    'Sales Invoice': '/sales/invoices',
    'Sales Order': '/sales/orders',
  };
  const basePath = routeMap[record.voucherType];
  if (!basePath) {
    return record.voucherNo;
  }

  return (
    <Link to={`${basePath}/${encodeURIComponent(record.voucherNo)}`}>
      {record.voucherNo}
    </Link>
  );
}

function buildColumns(defaultCompany: string): ProColumns<StockLedgerEntry>[] {
  return [
    {
      title: '公司',
      dataIndex: 'company',
      hideInTable: true,
      initialValue: defaultCompany,
      formItemRender: (_, { onChange, value }, form) => (
        <RemoteLinkSelect
          doctype="Company"
          onChange={(nextValue) => {
            const company = toOptionalText(nextValue);
            form.setFieldValue?.('company', company);
            onChange?.(company);
          }}
          placeholder="搜索公司"
          style={{ width: '100%' }}
          value={
            toOptionalText(value) ??
            toOptionalText(form.getFieldValue?.('company'))
          }
        />
      ),
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
      initialValue: last30DaysRange(),
    },
    {
      title: '凭证类型',
      dataIndex: 'voucherType',
      valueType: 'select',
      hideInTable: true,
      valueEnum: {
        'Delivery Note': { text: '销售发货单' },
        'Purchase Receipt': { text: '采购收货单' },
        'Sales Invoice': { text: '销售发票' },
        'Purchase Invoice': { text: '采购发票' },
        'Sales Order': { text: '销售订单' },
        'Purchase Order': { text: '采购订单' },
        'Stock Entry': { text: '库存调整' },
        'Stock Reconciliation': { text: '库存盘点' },
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
      render: (_, record) => signedText(record.actualQty),
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
      render: (_, record) => formatCurrencyValue(record.incomingRate),
    },
    {
      title: '库存价值变动',
      dataIndex: 'stockValueDifference',
      align: 'right',
      search: false,
      width: 140,
      render: (_, record) => signedCurrencyText(record.stockValueDifference),
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
      render: (_, record) => voucherLink(record),
    },
  ];
}

const InventoryLedgerPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const { defaultCompany } = useWorkspacePreferences();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const initialItemCode = query.get('itemCode') ?? undefined;
  const initialWarehouse = query.get('warehouse') ?? undefined;
  const initialVoucherType = query.get('voucherType') ?? undefined;
  const initialVoucherNo = query.get('voucherNo') ?? undefined;
  const tableColumns = buildColumns(defaultCompany).map((column) => {
    if (column.dataIndex === 'itemCode') {
      return { ...column, initialValue: initialItemCode };
    }
    if (column.dataIndex === 'warehouse') {
      return { ...column, initialValue: initialWarehouse };
    }
    if (column.dataIndex === 'voucherType') {
      return { ...column, initialValue: initialVoucherType };
    }
    if (column.dataIndex === 'voucherNo') {
      return { ...column, initialValue: initialVoucherNo };
    }
    return column;
  });

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
        columns={tableColumns}
        key={`${defaultCompany}:${initialItemCode ?? ''}:${initialWarehouse ?? ''}:${initialVoucherType ?? ''}:${initialVoucherNo ?? ''}`}
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
            company: toOptionalText(params.company),
            dateFrom: formatDateParam(dateRange[0]),
            dateTo: formatDateParam(dateRange[1]),
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
