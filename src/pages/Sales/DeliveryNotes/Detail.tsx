import {
  PageContainer,
  ProCard,
  ProDescriptions,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { Link, useParams, useRequest } from '@umijs/max';
import { Alert, Button, Empty, Modal, message, Skeleton, Space } from 'antd';
import React, { useState } from 'react';
import {
  cancelDeliveryNote,
  getDeliveryNoteDetail,
  type SalesOrderDetailItem,
} from '@/services/myapp/sales';
import {
  formatCurrencyCode,
  formatCurrencyValue,
  formatDisplayUom,
  StatusTag,
} from '@/utils/myapp-display';

function docLinks(values: string[], basePath: string) {
  return values.length
    ? values.map((name, index) => (
        <React.Fragment key={name}>
          {index > 0 ? '、' : null}
          <Link to={`${basePath}/${encodeURIComponent(name)}`}>{name}</Link>
        </React.Fragment>
      ))
    : '无';
}

const itemColumns = [
  {
    title: '商品编码',
    dataIndex: 'itemCode',
    width: 160,
  },
  {
    title: '商品名称',
    dataIndex: 'itemName',
    ellipsis: true,
  },
  {
    title: '数量',
    dataIndex: 'qty',
    align: 'right' as const,
    width: 100,
  },
  {
    title: '单位',
    dataIndex: 'uom',
    width: 90,
    render: (_: unknown, record: SalesOrderDetailItem) =>
      formatDisplayUom(record.uom),
  },
  {
    title: '单价',
    dataIndex: 'rate',
    align: 'right' as const,
    width: 120,
    render: (_: unknown, record: SalesOrderDetailItem) =>
      formatCurrencyValue(record.rate),
  },
  {
    title: '金额',
    dataIndex: 'amount',
    align: 'right' as const,
    width: 120,
    render: (_: unknown, record: SalesOrderDetailItem) =>
      formatCurrencyValue(record.amount),
  },
  {
    title: '仓库',
    dataIndex: 'warehouse',
    ellipsis: true,
    width: 180,
  },
];

const DeliveryNoteDetailPage: React.FC = () => {
  const params = useParams();
  const deliveryNoteName = decodeURIComponent(String(params.name ?? ''));
  const [cancelLoading, setCancelLoading] = useState(false);
  const { data, error, loading, refresh } = useRequest(
    () => getDeliveryNoteDetail(deliveryNoteName),
    {
      refreshDeps: [deliveryNoteName],
    },
  );

  const confirmCancel = () => {
    Modal.confirm({
      cancelText: '取消',
      okText: '确认取消',
      okType: 'danger',
      onOk: async () => {
        setCancelLoading(true);
        try {
          await cancelDeliveryNote(deliveryNoteName);
          refresh();
        } catch (caught) {
          message.error(caught instanceof Error ? caught.message : '操作失败');
          throw caught;
        } finally {
          setCancelLoading(false);
        }
      },
      title: '取消销售发货单？',
    });
  };

  return (
    <PageContainer
      title={deliveryNoteName || '销售发货单详情'}
      extra={[
        <Button key="back">
          <Link to="/sales/orders">返回销售订单</Link>
        </Button>,
        <Button key="refresh" loading={loading} onClick={refresh}>
          刷新
        </Button>,
        <Button
          danger
          disabled={!data?.canCancelDeliveryNote}
          key="cancel"
          loading={cancelLoading}
          onClick={confirmCancel}
        >
          取消发货单
        </Button>,
      ]}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {error && (
          <Alert
            action={
              <Button size="small" onClick={refresh}>
                重试
              </Button>
            }
            description={
              error instanceof Error ? error.message : '请稍后重试。'
            }
            message="销售发货单详情加载失败"
            showIcon
            type="error"
          />
        )}

        {loading && !data ? (
          <ProCard>
            <Skeleton active paragraph={{ rows: 8 }} />
          </ProCard>
        ) : null}

        {!loading && !error && !data ? (
          <ProCard>
            <Empty description="未找到销售发货单" />
          </ProCard>
        ) : null}

        {data ? (
          <>
            <StatisticCard.Group direction="row">
              <StatisticCard
                statistic={{
                  title: '发货金额',
                  value: formatCurrencyValue(data.grandTotal, data.currency),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '发货数量',
                  value: data.totalQty ?? 0,
                }}
              />
            </StatisticCard.Group>

            <ProCard split="vertical">
              <ProCard title="基本信息">
                <ProDescriptions column={2} dataSource={data}>
                  <ProDescriptions.Item label="公司" dataIndex="company" />
                  <ProDescriptions.Item
                    label="过账日期"
                    dataIndex="postingDate"
                  />
                  <ProDescriptions.Item
                    label="过账时间"
                    dataIndex="postingTime"
                  />
                  <ProDescriptions.Item label="币种">
                    {formatCurrencyCode(data.currency)}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="单据状态">
                    <StatusTag value={data.documentStatus} />
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="可取消">
                    {data.canCancelDeliveryNote ? '是' : '否'}
                  </ProDescriptions.Item>
                </ProDescriptions>
              </ProCard>

              <ProCard title="收货信息">
                <ProDescriptions column={1} dataSource={data}>
                  <ProDescriptions.Item
                    label="联系人"
                    dataIndex="contactDisplay"
                  />
                  <ProDescriptions.Item
                    label="联系电话"
                    dataIndex="contactPhone"
                  />
                  <ProDescriptions.Item
                    label="收货地址"
                    dataIndex="addressDisplay"
                  />
                  <ProDescriptions.Item label="备注" dataIndex="remarks" />
                </ProDescriptions>
              </ProCard>
            </ProCard>

            <ProCard title="关联单据">
              <ProDescriptions column={2}>
                <ProDescriptions.Item label="销售订单">
                  {docLinks(data.salesOrders, '/sales/orders')}
                </ProDescriptions.Item>
                <ProDescriptions.Item label="销售发票">
                  {docLinks(data.salesInvoices, '/sales/invoices')}
                </ProDescriptions.Item>
              </ProDescriptions>
            </ProCard>

            <ProTable<SalesOrderDetailItem>
              columns={itemColumns}
              dataSource={data.items}
              pagination={false}
              rowKey={(record) => `${record.itemCode}-${record.warehouse}`}
              search={false}
              toolBarRender={false}
            />
          </>
        ) : null}
      </Space>
    </PageContainer>
  );
};

export default DeliveryNoteDetailPage;
