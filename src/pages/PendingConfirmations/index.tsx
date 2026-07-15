import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { history, Link } from '@umijs/max';
import { Alert, Button, Modal, message, Space, Tag, Typography } from 'antd';
import React, { useRef, useState } from 'react';
import { RemoteLinkSelect } from '@/components';
import { toOptionalText } from '@/services/myapp/api-utils';
import {
  confirmPendingDocument,
  listPendingConfirmations,
  type PendingConfirmationDoctype,
  type PendingConfirmationItem,
} from '@/services/myapp/pending-confirmations';
import { formatCurrencyValue } from '@/utils/myapp-display';

const PAGE_SIZE = 20;

const DOCTYPE_LABELS: Record<string, string> = {
  'Delivery Note': '销售发货单',
  'Sales Invoice': '销售发票',
  'Purchase Receipt': '采购收货单',
  'Purchase Invoice': '采购发票',
};

function doctypeTag(doctype: string) {
  if (doctype.startsWith('Sales') || doctype === 'Delivery Note') {
    return <Tag color="blue">{DOCTYPE_LABELS[doctype] ?? doctype}</Tag>;
  }
  return <Tag color="green">{DOCTYPE_LABELS[doctype] ?? doctype}</Tag>;
}

function buildColumns(
  onConfirm: (record: PendingConfirmationItem) => void,
): ProColumns<PendingConfirmationItem>[] {
  return [
    {
      title: '关键词',
      dataIndex: 'searchKey',
      hideInTable: true,
      fieldProps: {
        allowClear: true,
        placeholder: '单号 / 往来方 / 公司',
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
      title: '单据类型',
      dataIndex: 'doctype',
      valueType: 'select',
      hideInTable: true,
      initialValue: 'all',
      valueEnum: {
        all: { text: '全部' },
        'Delivery Note': { text: '销售发货单' },
        'Sales Invoice': { text: '销售发票' },
        'Purchase Receipt': { text: '采购收货单' },
        'Purchase Invoice': { text: '采购发票' },
      },
    },
    {
      title: '单据',
      dataIndex: 'name',
      width: 180,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Link to={record.detailPath}>{record.name}</Link>
          <Typography.Text type="secondary">
            {record.postingDate || '-'}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'doctype',
      search: false,
      width: 130,
      render: (_, record) => doctypeTag(record.doctype),
    },
    {
      title: '往来方',
      dataIndex: 'partyName',
      search: false,
      ellipsis: true,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text>
            {record.partyName || record.party || '-'}
          </Typography.Text>
          {record.party ? (
            <Typography.Text type="secondary">{record.party}</Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: '公司',
      dataIndex: 'company',
      search: false,
      ellipsis: true,
      width: 180,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      align: 'right',
      search: false,
      width: 120,
      render: (_, record) =>
        record.amount === null ? '-' : formatCurrencyValue(record.amount),
    },
    {
      title: '业务状态',
      dataIndex: 'businessStatus',
      search: false,
      width: 120,
      render: (_, record) => record.businessStatus || record.documentStatus,
    },
    {
      title: '更新时间',
      dataIndex: 'modified',
      search: false,
      width: 180,
      renderText: (value) => value || '-',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 140,
      fixed: 'right',
      render: (_, record) => [
        <Link key="detail" to={record.detailPath}>
          查看
        </Link>,
        <Button key="confirm" type="link" onClick={() => onConfirm(record)}>
          确认
        </Button>,
      ],
    },
  ];
}

const PendingConfirmationsPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);

  const handleConfirm = (record: PendingConfirmationItem) => {
    Modal.confirm({
      title: '确认提交单据？',
      content: `${DOCTYPE_LABELS[record.doctype] ?? record.doctype} ${record.name} 将提交为正式单据。`,
      okText: '确认提交',
      cancelText: '取消',
      onOk: async () => {
        setConfirmingKey(`${record.doctype}:${record.name}`);
        try {
          await confirmPendingDocument({
            docname: record.name,
            doctype: record.doctype,
          });
          actionRef.current?.reload();
        } catch (caught) {
          message.error(
            caught instanceof Error ? caught.message : '确认单据失败',
          );
          throw caught;
        } finally {
          setConfirmingKey(null);
        }
      },
    });
  };

  const columns = buildColumns(handleConfirm);

  return (
    <PageContainer
      title="待处理确认"
      extra={[
        <Button key="refresh" onClick={() => actionRef.current?.reload()}>
          刷新
        </Button>,
      ]}
    >
      <Alert
        showIcon
        style={{ marginBottom: 16 }}
        type="info"
        message="这里汇总销售发货单、销售发票、采购收货单和采购发票的草稿单据。确认后会调用后端正式提交接口。"
      />
      <ProTable<PendingConfirmationItem>
        actionRef={actionRef}
        columns={columns}
        rowKey={(record) => `${record.doctype}:${record.name}`}
        scroll={{ x: 1180 }}
        search={{ labelWidth: 90 }}
        options={{ density: true, fullScreen: true, reload: true }}
        pagination={{
          defaultPageSize: PAGE_SIZE,
          showSizeChanger: true,
        }}
        loading={Boolean(confirmingKey)}
        request={async (params) => {
          const pageSize = params.pageSize ?? PAGE_SIZE;
          const current = params.current ?? 1;
          const doctype = String(
            params.doctype ?? 'all',
          ) as PendingConfirmationDoctype;
          const result = await listPendingConfirmations({
            company: toOptionalText(params.company),
            doctype,
            limit: pageSize,
            searchKey: toOptionalText(params.searchKey),
            start: (current - 1) * pageSize,
          });

          return {
            data: result.items,
            success: true,
            total: result.total,
          };
        }}
        toolbar={{
          title: '待确认草稿单据',
          actions: [
            <Button key="sales" onClick={() => history.push('/sales/orders')}>
              销售订单
            </Button>,
            <Button
              key="purchase"
              onClick={() => history.push('/purchase/orders')}
            >
              采购订单
            </Button>,
          ],
        }}
      />
    </PageContainer>
  );
};

export default PendingConfirmationsPage;
