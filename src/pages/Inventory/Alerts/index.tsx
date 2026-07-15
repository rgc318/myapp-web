import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  PageContainer,
  ProCard,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { history, Link } from '@umijs/max';
import { Button, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { RemoteLinkSelect } from '@/components';
import { toOptionalText } from '@/services/myapp/api-utils';
import {
  type InventoryStockStatus,
  type InventoryStockSummary,
  type InventoryStockSummaryRow,
  listInventoryStockSummary,
} from '@/services/myapp/inventory';
import { formatCurrencyValue, resolveDisplayUom } from '@/utils/myapp-display';

const PAGE_SIZE = 20;
const DEFAULT_LOW_STOCK_THRESHOLD = 10;

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function emptySummary(): InventoryStockSummary {
  return {
    actualQtyTotal: 0,
    negativeCount: 0,
    outOfStockCount: 0,
    projectedQtyTotal: 0,
    reservedQtyTotal: 0,
    stockValueTotal: 0,
  };
}

function stockStatusTag(record: InventoryStockSummaryRow) {
  if (record.actualQty < 0) {
    return <Tag color="red">负库存</Tag>;
  }
  if (record.actualQty === 0) {
    return <Tag>无库存</Tag>;
  }
  return <Tag color="gold">低库存</Tag>;
}

function stockDetailPath(itemCode: string, company: string, warehouse: string) {
  const params = new URLSearchParams({ company, warehouse });
  return `/inventory/stock/${encodeURIComponent(itemCode)}?${params.toString()}`;
}

function ledgerPath(itemCode: string, warehouse: string) {
  const params = new URLSearchParams({ itemCode, warehouse });
  return `/inventory/ledger?${params.toString()}`;
}

function buildColumns(): ProColumns<InventoryStockSummaryRow>[] {
  return [
    {
      title: '关键词',
      dataIndex: 'searchKey',
      hideInTable: true,
      fieldProps: {
        allowClear: true,
        placeholder: '商品编码 / 名称',
      },
    },
    {
      title: '公司',
      dataIndex: 'company',
      hideInTable: true,
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
      title: '仓库',
      dataIndex: 'warehouse',
      hideInTable: true,
      fieldProps: {
        allowClear: true,
        placeholder: '仓库',
      },
    },
    {
      title: '预警类型',
      dataIndex: 'stockStatus',
      valueType: 'select',
      hideInTable: true,
      initialValue: 'low_stock',
      valueEnum: {
        low_stock: { text: '低库存' },
        out_of_stock: { text: '无库存' },
        negative: { text: '负库存' },
        all: { text: '全部库存' },
      },
    },
    {
      title: '低库存阈值',
      dataIndex: 'lowStockThreshold',
      valueType: 'digit',
      hideInTable: true,
      initialValue: DEFAULT_LOW_STOCK_THRESHOLD,
      fieldProps: {
        min: 1,
        precision: 0,
      },
    },
    {
      title: '商品编码',
      dataIndex: 'itemCode',
      search: false,
      width: 160,
      render: (_, record) => (
        <Link
          to={stockDetailPath(
            record.itemCode,
            record.company,
            record.warehouse,
          )}
        >
          {record.itemCode}
        </Link>
      ),
    },
    {
      title: '商品名称',
      dataIndex: 'itemName',
      search: false,
      ellipsis: true,
    },
    {
      title: '仓库',
      dataIndex: 'warehouse',
      search: false,
      ellipsis: true,
      width: 180,
    },
    {
      title: '实际库存',
      dataIndex: 'actualQty',
      align: 'right',
      search: false,
      width: 110,
      render: (_, record) => formatNumber(record.actualQty),
    },
    {
      title: '预留库存',
      dataIndex: 'reservedQty',
      align: 'right',
      search: false,
      width: 110,
      render: (_, record) => formatNumber(record.reservedQty),
    },
    {
      title: '预计库存',
      dataIndex: 'projectedQty',
      align: 'right',
      search: false,
      width: 110,
      render: (_, record) => formatNumber(record.projectedQty),
    },
    {
      title: '单位',
      dataIndex: 'stockUom',
      search: false,
      width: 90,
      render: (_, record) =>
        resolveDisplayUom(record.stockUom, record.stockUomDisplay),
    },
    {
      title: '库存价值',
      dataIndex: 'stockValue',
      align: 'right',
      search: false,
      width: 120,
      render: (_, record) => formatCurrencyValue(record.stockValue),
    },
    {
      title: '状态',
      dataIndex: 'status',
      search: false,
      width: 100,
      render: (_, record) => stockStatusTag(record),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 120,
      render: (_, record) => [
        <Link
          key="detail"
          to={stockDetailPath(
            record.itemCode,
            record.company,
            record.warehouse,
          )}
        >
          详情
        </Link>,
        <Link key="ledger" to={ledgerPath(record.itemCode, record.warehouse)}>
          流水
        </Link>,
      ],
    },
  ];
}

const InventoryAlertsPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [summary, setSummary] = useState<InventoryStockSummary>(emptySummary());
  const columns = buildColumns();

  return (
    <PageContainer
      title="库存预警"
      extra={[
        <Button key="stock" onClick={() => history.push('/inventory/stock')}>
          商品库存
        </Button>,
        <Button
          key="transfers"
          onClick={() => history.push('/inventory/transfers')}
        >
          库存转仓
        </Button>,
        <Button
          key="adjustments"
          onClick={() => history.push('/inventory/adjustments')}
        >
          库存调整
        </Button>,
        <Button key="counts" onClick={() => history.push('/inventory/counts')}>
          批量盘点
        </Button>,
        <Button key="refresh" onClick={() => actionRef.current?.reload()}>
          刷新
        </Button>,
      ]}
    >
      <ProCard style={{ marginBottom: 16 }}>
        <StatisticCard.Group direction="row">
          <StatisticCard
            statistic={{
              title: '实际库存合计',
              value: formatNumber(summary.actualQtyTotal),
            }}
          />
          <StatisticCard
            statistic={{
              title: '预留库存合计',
              value: formatNumber(summary.reservedQtyTotal),
            }}
          />
          <StatisticCard
            statistic={{
              title: '负库存项',
              value: summary.negativeCount,
            }}
          />
          <StatisticCard
            statistic={{
              title: '无库存项',
              value: summary.outOfStockCount,
            }}
          />
          <StatisticCard
            statistic={{
              title: '库存价值',
              value: formatCurrencyValue(summary.stockValueTotal),
            }}
          />
        </StatisticCard.Group>
      </ProCard>

      <ProTable<InventoryStockSummaryRow>
        actionRef={actionRef}
        columns={columns}
        pagination={{
          defaultPageSize: PAGE_SIZE,
          showSizeChanger: false,
        }}
        request={async (params) => {
          const current = Number(params.current ?? 1);
          const pageSize = Number(params.pageSize ?? PAGE_SIZE);
          const result = await listInventoryStockSummary({
            company: toOptionalText(params.company),
            lowStockThreshold: Number(
              params.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD,
            ),
            page: current,
            pageSize,
            searchKey: String(params.searchKey ?? ''),
            stockStatus: String(
              params.stockStatus ?? 'low_stock',
            ) as InventoryStockStatus,
            warehouse: String(params.warehouse ?? ''),
          });
          setSummary(result.summary);

          return {
            data: result.items,
            success: true,
            total: result.total,
          };
        }}
        rowKey={(record) => `${record.itemCode}:${record.warehouse}`}
        search={{
          defaultCollapsed: false,
          labelWidth: 88,
        }}
        toolBarRender={false}
      />
    </PageContainer>
  );
};

export default InventoryAlertsPage;
