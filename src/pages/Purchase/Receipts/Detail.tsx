import {
  PageContainer,
  ProCard,
  ProDescriptions,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { history, Link, useParams, useRequest } from '@umijs/max';
import {
  Alert,
  Button,
  DatePicker,
  Empty,
  Input,
  Modal,
  message,
  Skeleton,
  Space,
} from 'antd';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import { PrintDocumentButton } from '@/components/PrintDocumentButton';
import {
  cancelPurchaseReceipt,
  createPurchaseInvoiceFromReceipt,
  getPurchaseReceiptDetail,
  type PurchaseDocumentItem,
} from '@/services/myapp/purchase';
import {
  formatCurrencyCode,
  formatCurrencyValue,
  resolveDisplayUom,
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
    render: (_: unknown, record: PurchaseDocumentItem) =>
      resolveDisplayUom(record.uom, record.uomDisplay),
  },
  {
    title: '单价',
    dataIndex: 'rate',
    align: 'right' as const,
    width: 120,
    render: (_: unknown, record: PurchaseDocumentItem) =>
      formatCurrencyValue(record.rate),
  },
  {
    title: '金额',
    dataIndex: 'amount',
    align: 'right' as const,
    width: 120,
    render: (_: unknown, record: PurchaseDocumentItem) =>
      formatCurrencyValue(record.amount),
  },
  {
    title: '仓库',
    dataIndex: 'warehouse',
    ellipsis: true,
    width: 180,
  },
];

const PurchaseReceiptDetailPage: React.FC = () => {
  const params = useParams();
  const receiptName = decodeURIComponent(String(params.name ?? ''));
  const [cancelLoading, setCancelLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const { data, error, loading, refresh } = useRequest(
    () => getPurchaseReceiptDetail(receiptName),
    {
      formatResult: (result) => result,
      refreshDeps: [receiptName],
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
          await cancelPurchaseReceipt(receiptName);
          refresh();
        } catch (caught) {
          message.error(caught instanceof Error ? caught.message : '操作失败');
          throw caught;
        } finally {
          setCancelLoading(false);
        }
      },
      title: '取消采购收货单？',
    });
  };

  const confirmCreateInvoice = () => {
    let dueDate = dayjs().format('YYYY-MM-DD');
    let remarks = '';
    Modal.confirm({
      cancelText: '取消',
      content: (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <DatePicker
            defaultValue={dayjs(dueDate)}
            onChange={(value) => {
              dueDate = value?.format('YYYY-MM-DD') ?? '';
            }}
            style={{ width: '100%' }}
          />
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 4 }}
            onChange={(event) => {
              remarks = event.target.value;
            }}
            placeholder="备注"
          />
        </Space>
      ),
      okText: '创建采购发票',
      onOk: async () => {
        setInvoiceLoading(true);
        try {
          const result = await createPurchaseInvoiceFromReceipt(receiptName, {
            dueDate,
            remarks,
          });
          const invoiceName = result.data.purchase_invoice;
          if (invoiceName) {
            history.push(
              `/purchase/invoices/${encodeURIComponent(invoiceName)}`,
            );
          } else {
            refresh();
          }
        } catch (caught) {
          message.error(caught instanceof Error ? caught.message : '操作失败');
          throw caught;
        } finally {
          setInvoiceLoading(false);
        }
      },
      title: `基于收货单 ${receiptName} 创建采购发票`,
    });
  };

  return (
    <PageContainer
      title={receiptName || '采购收货单详情'}
      extra={[
        <Button key="back">
          <Link to="/purchase/orders">返回采购订单</Link>
        </Button>,
        <Button key="refresh" loading={loading} onClick={refresh}>
          刷新
        </Button>,
        <PrintDocumentButton
          disabled={!receiptName}
          docname={receiptName}
          doctype="Purchase Receipt"
          key="print"
        />,
        <Button
          disabled={!data?.canCreateInvoice}
          key="invoice"
          loading={invoiceLoading}
          onClick={confirmCreateInvoice}
          type="primary"
        >
          创建采购发票
        </Button>,
        data?.documentStatus !== 'cancelled' ? (
          <Button
            key="return"
            onClick={() => {
              const params = new URLSearchParams({
                sourceDoctype: 'Purchase Receipt',
                sourceName: receiptName,
              });
              history.push(`/purchase/returns/new?${params.toString()}`);
            }}
          >
            采购退货
          </Button>
        ) : null,
        <Button
          danger
          disabled={!data?.canCancel}
          key="cancel"
          loading={cancelLoading}
          onClick={confirmCancel}
        >
          取消收货单
        </Button>,
      ]}
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
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
            message="采购收货单详情加载失败"
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
            <Empty description="未找到采购收货单" />
          </ProCard>
        ) : null}

        {data ? (
          <>
            <StatisticCard.Group direction="row">
              <StatisticCard
                statistic={{
                  title: '收货金额',
                  value: formatCurrencyValue(data.amount, data.currency),
                }}
              />
              <StatisticCard
                statistic={{
                  title: '收货数量',
                  value: data.totalQty ?? 0,
                }}
              />
            </StatisticCard.Group>

            <ProCard split="vertical">
              <ProCard title="基本信息">
                <ProDescriptions column={2} dataSource={data}>
                  <ProDescriptions.Item
                    label="供应商"
                    dataIndex="supplierName"
                  />
                  <ProDescriptions.Item label="公司" dataIndex="company" />
                  <ProDescriptions.Item
                    label="过账日期"
                    dataIndex="postingDate"
                  />
                  <ProDescriptions.Item label="币种">
                    {formatCurrencyCode(data.currency)}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="单据状态">
                    <StatusTag value={data.documentStatus} />
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="收货状态">
                    <StatusTag value={data.receivingStatus} />
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="可开票">
                    {data.canCreateInvoice ? '是' : '否'}
                  </ProDescriptions.Item>
                  <ProDescriptions.Item label="可取消">
                    {data.canCancel ? '是' : '否'}
                  </ProDescriptions.Item>
                </ProDescriptions>
              </ProCard>

              <ProCard title="备注">
                <ProDescriptions column={1} dataSource={data}>
                  <ProDescriptions.Item label="备注" dataIndex="remarks" />
                </ProDescriptions>
              </ProCard>
            </ProCard>

            <ProCard title="关联单据">
              <ProDescriptions column={2}>
                <ProDescriptions.Item label="采购订单">
                  {docLinks(data.purchaseOrders, '/purchase/orders')}
                </ProDescriptions.Item>
                <ProDescriptions.Item label="采购发票">
                  {docLinks(data.purchaseInvoices, '/purchase/invoices')}
                </ProDescriptions.Item>
              </ProDescriptions>
            </ProCard>

            <ProTable<PurchaseDocumentItem>
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

export default PurchaseReceiptDetailPage;
