import type { ProColumns } from '@ant-design/pro-components';
import { Link } from '@umijs/max';
import {
  Card,
  Col,
  Empty,
  Image,
  Progress,
  Row,
  Space,
  Statistic,
  Timeline,
  Typography,
} from 'antd';
import React from 'react';
import { businessDocumentPath, toPercent } from '@/utils/business-document';
import {
  formatCurrencyValue,
  resolveDisplayUom,
  StatusTag,
} from '@/utils/myapp-display';

type TransactionItem = {
  amount: number | null;
  imageUrl?: string | null;
  itemCode: string;
  itemName: string;
  qty: number | null;
  rate: number | null;
  specification?: string | null;
  uom?: string | null;
  uomDisplay?: string | null;
  warehouse?: string | null;
};

type TransactionTimelineEvent = {
  amount?: number | null;
  date?: string;
  description?: string;
  docname: string;
  doctype: string;
  modeOfPayment?: string;
  referenceNo?: string;
  relatedDocname?: string;
  relatedDoctype?: string;
  status?: string;
  title?: string;
  type: string;
};

function toQty(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function buildTransactionItemColumns<T extends TransactionItem>({
  completedQtyKey,
  completedTitle,
  pendingTitle,
}: {
  completedQtyKey: keyof T;
  completedTitle: string;
  pendingTitle: string;
}): ProColumns<T>[] {
  return [
    {
      title: '商品信息',
      dataIndex: 'itemName',
      width: 320,
      render: (_, record) => (
        <Space align="start" size={12}>
          {record.imageUrl ? (
            <Image
              alt={record.itemName || record.itemCode}
              height={56}
              preview={false}
              src={record.imageUrl}
              style={{ objectFit: 'cover' }}
              width={56}
            />
          ) : (
            <div
              style={{
                alignItems: 'center',
                background: '#f5f5f5',
                border: '1px solid #f0f0f0',
                color: 'rgba(0, 0, 0, 0.45)',
                display: 'flex',
                height: 56,
                justifyContent: 'center',
                width: 56,
              }}
            >
              无图
            </div>
          )}
          <Space orientation="vertical" size={0}>
            <Typography.Text strong>{record.itemName}</Typography.Text>
            <Typography.Text type="secondary">
              {record.itemCode}
            </Typography.Text>
            {record.specification ? (
              <Typography.Text type="secondary">
                {record.specification}
              </Typography.Text>
            ) : null}
            {record.warehouse ? (
              <Typography.Text type="secondary">
                {record.warehouse}
              </Typography.Text>
            ) : null}
          </Space>
        </Space>
      ),
    },
    {
      title: '数量',
      dataIndex: 'qty',
      align: 'right',
      width: 100,
    },
    {
      title: completedTitle,
      dataIndex: String(completedQtyKey),
      align: 'right',
      width: 110,
    },
    {
      title: pendingTitle,
      dataIndex: 'pendingQty',
      align: 'right',
      width: 110,
      render: (_, record) =>
        Math.max(
          toQty(record.qty) - toQty(record[completedQtyKey] as number),
          0,
        ),
    },
    {
      title: '单位',
      dataIndex: 'uom',
      width: 90,
      render: (_, record) => resolveDisplayUom(record.uom, record.uomDisplay),
    },
    {
      title: '单价',
      dataIndex: 'rate',
      align: 'right',
      width: 120,
      render: (_, record) => formatCurrencyValue(record.rate),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      align: 'right',
      width: 120,
      render: (_, record) => formatCurrencyValue(record.amount),
    },
  ];
}

export function buildInvoiceItemColumns<
  T extends TransactionItem,
>(): ProColumns<T>[] {
  return [
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
      align: 'right',
      width: 100,
    },
    {
      title: '单位',
      dataIndex: 'uom',
      width: 90,
      render: (_, record) => resolveDisplayUom(record.uom, record.uomDisplay),
    },
    {
      title: '单价',
      dataIndex: 'rate',
      align: 'right',
      width: 120,
      render: (_, record) => formatCurrencyValue(record.rate),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      align: 'right',
      width: 120,
      render: (_, record) => formatCurrencyValue(record.amount),
    },
    {
      title: '仓库',
      dataIndex: 'warehouse',
      ellipsis: true,
      width: 180,
    },
  ];
}

export function AmountOverview({
  amount,
  currency,
  outstandingAmount,
  outstandingTitle,
  paidAmount,
  paidTitle,
  payableAmount,
  payableTitle,
  settledText,
  unsettledText,
}: {
  amount: number | null;
  currency?: string;
  outstandingAmount: number | null;
  outstandingTitle: string;
  paidAmount: number | null;
  paidTitle: string;
  payableAmount: number | null;
  payableTitle: string;
  settledText: string;
  unsettledText: string;
}) {
  return (
    <Card title="金额概览" variant="borderless">
      <Row gutter={[24, 16]}>
        <Col lg={6} sm={12} xs={24}>
          <Statistic
            styles={{ content: { fontSize: 24, fontWeight: 600 } }}
            title="订单金额"
            value={formatCurrencyValue(amount, currency)}
          />
          <Typography.Text type="secondary">
            当前订单商品与税费合计
          </Typography.Text>
        </Col>
        <Col lg={6} sm={12} xs={24}>
          <Statistic
            styles={{ content: { fontSize: 22, fontWeight: 600 } }}
            title={payableTitle}
            value={formatCurrencyValue(payableAmount, currency)}
          />
          <Typography.Text type="secondary">
            按订单/发票口径汇总
          </Typography.Text>
        </Col>
        <Col lg={6} sm={12} xs={24}>
          <Statistic
            styles={{
              content: {
                color: '#389e0d',
                fontSize: 22,
                fontWeight: 600,
              },
            }}
            title={paidTitle}
            value={formatCurrencyValue(paidAmount, currency)}
          />
          <Progress
            percent={toPercent(paidAmount, payableAmount || amount)}
            size="small"
            status="success"
          />
        </Col>
        <Col lg={6} sm={12} xs={24}>
          <Statistic
            styles={{
              content: {
                color: (outstandingAmount ?? 0) > 0 ? '#cf1322' : '#389e0d',
                fontSize: 24,
                fontWeight: 700,
              },
            }}
            title={outstandingTitle}
            value={formatCurrencyValue(outstandingAmount, currency)}
          />
          <Typography.Text
            type={(outstandingAmount ?? 0) > 0 ? 'danger' : 'secondary'}
          >
            {(outstandingAmount ?? 0) > 0 ? unsettledText : settledText}
          </Typography.Text>
        </Col>
      </Row>
    </Card>
  );
}

export function BusinessTimeline<T extends TransactionTimelineEvent>({
  currency,
  events,
  getColor,
}: {
  currency?: string;
  events: T[];
  getColor: (event: T) => string;
}) {
  return (
    <Card title="业务时间线" variant="borderless">
      {events.length ? (
        <Timeline
          items={events.map((event) => {
            const path = businessDocumentPath(event.doctype, event.docname);
            const relatedPath = businessDocumentPath(
              event.relatedDoctype || '',
              event.relatedDocname || '',
            );
            const pieces = [
              event.date,
              event.description,
              event.amount != null
                ? formatCurrencyValue(event.amount, currency)
                : '',
              event.modeOfPayment,
              event.referenceNo ? `参考号 ${event.referenceNo}` : '',
            ].filter(Boolean);

            return {
              color: getColor(event),
              content: (
                <Space orientation="vertical" size={4}>
                  <Space wrap>
                    <Typography.Text strong>
                      {event.title || event.type}
                    </Typography.Text>
                    {path ? (
                      <Link to={path}>{event.docname}</Link>
                    ) : (
                      <Typography.Text>{event.docname}</Typography.Text>
                    )}
                    {event.status ? <StatusTag value={event.status} /> : null}
                  </Space>
                  <Typography.Text type="secondary">
                    {pieces.join(' · ')}
                  </Typography.Text>
                  {event.relatedDocname ? (
                    <Typography.Text type="secondary">
                      关联：
                      {relatedPath ? (
                        <Link to={relatedPath}>{event.relatedDocname}</Link>
                      ) : (
                        event.relatedDocname
                      )}
                    </Typography.Text>
                  ) : null}
                </Space>
              ),
            };
          })}
        />
      ) : (
        <Empty description="暂无业务时间线" />
      )}
    </Card>
  );
}
