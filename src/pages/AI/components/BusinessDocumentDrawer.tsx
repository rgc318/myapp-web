import { ExportOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import React, { useEffect, useState } from 'react';
import {
  type AiBusinessDocumentDetail,
  type AiBusinessDocumentResult,
  getAiBusinessDocumentDetail,
} from '@/services/myapp/ai';
import {
  formatCurrencyValue,
  resolveDisplayUom,
  StatusTag,
} from '@/utils/myapp-display';

const TYPE_LABELS: Record<AiBusinessDocumentResult['type'], string> = {
  purchase_invoice: '采购发票',
  purchase_order: '采购订单',
  sales_invoice: '销售发票',
  sales_order: '销售订单',
};

type DetailItem = AiBusinessDocumentDetail['items'][number];

const columns: ProColumns<DetailItem>[] = [
  { dataIndex: 'itemCode', title: '商品编码', width: 150 },
  { dataIndex: 'itemName', ellipsis: true, title: '商品名称', width: 220 },
  {
    align: 'right',
    dataIndex: 'qty',
    title: '数量',
    width: 100,
    render: (_, row) => Number(row.qty ?? 0).toLocaleString('zh-CN'),
  },
  {
    dataIndex: 'uomDisplay',
    title: '单位',
    width: 90,
    render: (_, row) => resolveDisplayUom(row.uom, row.uomDisplay),
  },
  {
    align: 'right',
    dataIndex: 'rate',
    title: '单价',
    width: 120,
    render: (_, row) => Number(row.rate ?? 0).toLocaleString('zh-CN'),
  },
  {
    align: 'right',
    dataIndex: 'amount',
    title: '金额',
    width: 130,
    render: (_, row) => Number(row.amount ?? 0).toLocaleString('zh-CN'),
  },
  { dataIndex: 'warehouse', ellipsis: true, title: '仓库', width: 180 },
];

export function BusinessDocumentDrawer({
  document,
  onClose,
}: {
  document: AiBusinessDocumentResult | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<AiBusinessDocumentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setDetail(null);
    setError(null);
    if (!document) return () => undefined;
    setLoading(true);
    void getAiBusinessDocumentDetail(document)
      .then((result) => {
        if (!active) return;
        setDetail(result);
        if (!result) setError('未能读取当前单据详情。');
      })
      .catch((caught) => {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : '单据详情加载失败',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [document]);

  return (
    <Drawer
      extra={
        document?.href ? (
          <Button href={document.href} icon={<ExportOutlined />}>
            在业务模块打开
          </Button>
        ) : null
      }
      onClose={onClose}
      open={Boolean(document)}
      size="large"
      title={
        document
          ? `${TYPE_LABELS[document.type]} ${document.id}`
          : '业务单据详情'
      }
    >
      <Spin spinning={loading}>
        {error ? <Alert showIcon title={error} type="error" /> : null}
        {detail ? (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions
              bordered
              column={{ lg: 2, md: 2, sm: 1, xs: 1 }}
              items={[
                {
                  key: 'id',
                  label: '单据编号',
                  children: (
                    <Typography.Text copyable>{detail.id}</Typography.Text>
                  ),
                },
                {
                  key: 'status',
                  label: '状态',
                  children: <StatusTag value={detail.documentStatus} />,
                },
                {
                  key: 'party',
                  label: '客户 / 供应商',
                  children: detail.party || '-',
                },
                {
                  key: 'company',
                  label: '公司',
                  children: detail.company || '-',
                },
                {
                  key: 'date',
                  label: '交易日期',
                  children: detail.date || '-',
                },
                {
                  key: 'targetDate',
                  label: '交付 / 到期日期',
                  children: detail.dueOrTargetDate || '-',
                },
                {
                  key: 'amount',
                  label: '金额',
                  children: formatCurrencyValue(detail.amount, detail.currency),
                },
                {
                  key: 'paid',
                  label: '已结金额',
                  children: formatCurrencyValue(
                    detail.paidAmount,
                    detail.currency,
                  ),
                },
                {
                  key: 'outstanding',
                  label: '未结金额',
                  children: formatCurrencyValue(
                    detail.outstandingAmount,
                    detail.currency,
                  ),
                },
                {
                  key: 'references',
                  label: '关联单据',
                  children: detail.references.length ? (
                    <Space size={[4, 4]} wrap>
                      {detail.references.map((reference) => (
                        <Tag key={reference}>{reference}</Tag>
                      ))}
                    </Space>
                  ) : (
                    '-'
                  ),
                },
                {
                  key: 'remarks',
                  label: '备注',
                  span: 2,
                  children: detail.remarks || '-',
                },
              ]}
              size="small"
            />
            <ProTable<DetailItem>
              columns={columns}
              dataSource={detail.items}
              options={false}
              pagination={false}
              rowKey={(row, index) => `${row.itemCode}-${index}`}
              search={false}
              size="small"
              toolBarRender={false}
              scroll={{ x: 1000 }}
            />
          </Space>
        ) : null}
      </Spin>
    </Drawer>
  );
}
