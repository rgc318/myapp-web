import {
  PageContainer,
  ProCard,
  ProDescriptions,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { history, Link, useLocation, useParams, useRequest } from '@umijs/max';
import { Alert, Button, Empty, Image, Skeleton, Space, Table } from 'antd';
import React from 'react';
import {
  listStockLedgerEntries,
  type StockLedgerEntry,
} from '@/services/myapp/inventory';
import {
  getProductDetail,
  type ProductSummary,
  type ProductWarehouseStockDetail,
} from '@/services/myapp/master-data';
import { formatCurrencyValue, formatDisplayUom } from '@/utils/myapp-display';

const DEFAULT_COMPANY = 'rgc (Demo)';

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function ledgerPath(itemCode: string, warehouse?: string) {
  const params = new URLSearchParams({ itemCode });
  if (warehouse) {
    params.set('warehouse', warehouse);
  }
  return `/inventory/ledger?${params.toString()}`;
}

function signedText(value: number) {
  const color = value > 0 ? '#15803d' : value < 0 ? '#b45309' : undefined;
  const prefix = value > 0 ? '+' : '';
  return <span style={{ color }}>{`${prefix}${formatNumber(value)}`}</span>;
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

const InventoryStockDetailPage: React.FC = () => {
  const params = useParams();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const itemCode = decodeURIComponent(String(params.itemCode ?? ''));
  const company = query.get('company') || DEFAULT_COMPANY;
  const warehouse = query.get('warehouse') || undefined;

  const { data, error, loading, refresh } = useRequest(
    () => getProductDetail(itemCode, { company, warehouse }),
    {
      formatResult: (result) => result,
      refreshDeps: [itemCode, company, warehouse],
    },
  );

  return (
    <PageContainer
      title={data?.itemName || itemCode || '商品库存详情'}
      extra={[
        <Button key="back" onClick={() => history.push('/inventory/stock')}>
          返回商品库存
        </Button>,
        <Button
          key="ledger"
          onClick={() => history.push(ledgerPath(itemCode, warehouse))}
        >
          查看流水
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
            message="商品库存详情加载失败"
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
                  title: warehouse ? '当前仓库库存' : '当前库存',
                  value: formatNumber(data.stockQty),
                  suffix: formatDisplayUom(data.stockUom),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '公司总库存',
                  value: formatNumber(data.totalQty),
                  suffix: formatDisplayUom(data.stockUom),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '采购价',
                  value: formatCurrencyValue(
                    data.priceSummary?.standardBuyingRate,
                  ),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '零售价',
                  value: formatCurrencyValue(data.priceSummary?.retailRate),
                }}
              />
            </StatisticCard.Group>

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
              <ProCard title="基本信息">
                <ProDescriptions column={2} dataSource={data}>
                  <ProDescriptions.Item label="商品编码" dataIndex="itemCode" />
                  <ProDescriptions.Item label="商品名称" dataIndex="itemName" />
                  <ProDescriptions.Item
                    label="规格"
                    dataIndex="specification"
                  />
                  <ProDescriptions.Item label="品牌" dataIndex="brand" />
                  <ProDescriptions.Item label="商品组" dataIndex="itemGroup" />
                  <ProDescriptions.Item label="条码" dataIndex="barcode" />
                  <ProDescriptions.Item label="库存单位">
                    {formatDisplayUom(data.stockUom)}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="批发默认单位">
                    {formatDisplayUom(data.wholesaleDefaultUom)}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="零售默认单位">
                    {formatDisplayUom(data.retailDefaultUom)}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="最后修改" dataIndex="modified" />
                </ProDescriptions>
              </ProCard>
            </ProCard>

            <ProCard title="仓库库存">
              <WarehouseStockTable
                itemCode={data.itemCode}
                rows={data.warehouseStockDetails}
              />
            </ProCard>

            <ProCard title="单位换算">
              <Table<ProductSummary['uomConversions'][number]>
                columns={[
                  {
                    dataIndex: 'uom',
                    title: '单位',
                    render: (value) => formatDisplayUom(value),
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
    </PageContainer>
  );
};

export default InventoryStockDetailPage;
