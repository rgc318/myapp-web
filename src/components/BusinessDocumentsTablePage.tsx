import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  FooterToolbar,
  PageContainer,
  ProCard,
  ProTable,
} from '@ant-design/pro-components';
import { Link } from '@umijs/max';
import { Button, Space, Statistic } from 'antd';
import dayjs from 'dayjs';
import React, { useRef, useState } from 'react';
import { toOptionalText } from '@/services/myapp/api-utils';
import {
  type BusinessDocumentDoctype,
  type BusinessDocumentSummary,
  listBusinessDocuments,
} from '@/services/myapp/documents';
import { formatCurrencyValue, StatusTag } from '@/utils/myapp-display';
import { PrintBatchAction } from './printing/PrintBatchAction';
import { RemoteLinkSelect } from './RemoteLinkSelect';

const PAGE_SIZE = 20;

type Props = {
  doctype: BusinessDocumentDoctype;
  partyLabel: string;
  searchPlaceholder: string;
  title: string;
};

function buildColumns(
  partyLabel: string,
  searchPlaceholder: string,
): ProColumns<BusinessDocumentSummary>[] {
  return [
    {
      title: '关键词',
      dataIndex: 'searchKey',
      hideInTable: true,
      fieldProps: {
        allowClear: true,
        placeholder: searchPlaceholder,
      },
    },
    {
      title: '单据号',
      dataIndex: 'name',
      search: false,
      width: 180,
      render: (_, record) => (
        <Link to={`${record.detailPath}/${encodeURIComponent(record.name)}`}>
          {record.name}
        </Link>
      ),
    },
    {
      title: partyLabel,
      dataIndex: 'partyName',
      search: false,
      ellipsis: true,
    },
    {
      title: partyLabel,
      dataIndex: 'party',
      hideInTable: true,
      fieldProps: {
        allowClear: true,
        placeholder: `${partyLabel}编码`,
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
      title: '日期范围',
      dataIndex: 'dateRange',
      valueType: 'dateRange',
      hideInTable: true,
    },
    {
      title: '过账日期',
      dataIndex: 'postingDate',
      search: false,
      width: 120,
    },
    {
      title: '单据状态',
      dataIndex: 'docstatus',
      valueType: 'select',
      hideInTable: true,
      initialValue: 'submitted',
      valueEnum: {
        all: { text: '全部' },
        draft: { text: '草稿' },
        submitted: { text: '已提交' },
        cancelled: { text: '已作废' },
      },
    },
    {
      title: '单据',
      dataIndex: 'documentStatus',
      search: false,
      width: 100,
      render: (_, record) => <StatusTag value={record.documentStatus} />,
    },
    {
      title: '业务状态',
      dataIndex: 'businessStatus',
      search: false,
      width: 120,
      render: (_, record) => <StatusTag value={record.businessStatus} />,
    },
    {
      title: '退货',
      dataIndex: 'isReturn',
      search: false,
      width: 80,
      render: (_, record) => (record.isReturn ? '是' : '-'),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      align: 'right',
      search: false,
      width: 130,
      render: (_, record) => formatCurrencyValue(record.amount),
    },
    {
      title: '未结金额',
      dataIndex: 'outstandingAmount',
      align: 'right',
      search: false,
      width: 130,
      render: (_, record) =>
        record.outstandingAmount === null
          ? '-'
          : formatCurrencyValue(record.outstandingAmount),
    },
    {
      title: '排序',
      dataIndex: 'sortBy',
      valueType: 'select',
      hideInTable: true,
      initialValue: 'latest',
      valueEnum: {
        latest: { text: '最近更新' },
        oldest: { text: '最早过账' },
        amount_desc: { text: '金额从高到低' },
        amount_asc: { text: '金额从低到高' },
      },
    },
    {
      title: '最近更新',
      dataIndex: 'modified',
      search: false,
      width: 170,
      render: (_, record) =>
        record.modified
          ? dayjs(record.modified).format('YYYY-MM-DD HH:mm')
          : '-',
    },
  ];
}

const BusinessDocumentsTablePage: React.FC<Props> = ({
  doctype,
  partyLabel,
  searchPlaceholder,
  title,
}) => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedRows, setSelectedRows] = useState<BusinessDocumentSummary[]>(
    [],
  );
  const columns = buildColumns(partyLabel, searchPlaceholder);

  return (
    <PageContainer
      title={title}
      extra={[
        <Button key="refresh" onClick={() => actionRef.current?.reload()}>
          刷新
        </Button>,
      ]}
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <ProCard>
          <Statistic title="匹配单据" value={totalCount} />
        </ProCard>

        <ProTable<BusinessDocumentSummary>
          actionRef={actionRef}
          columns={columns}
          key={doctype}
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
            const result = await listBusinessDocuments({
              company: toOptionalText(params.company),
              dateFrom: dateRange[0] ? String(dateRange[0]) : undefined,
              dateTo: dateRange[1] ? String(dateRange[1]) : undefined,
              docstatus: params.docstatus as any,
              doctype,
              limit: pageSize,
              party: String(params.party ?? ''),
              searchKey: String(params.searchKey ?? ''),
              sortBy: params.sortBy as any,
              start: (current - 1) * pageSize,
            });

            setTotalCount(result.summary.visibleCount);
            setSelectedRows([]);

            return {
              data: result.items,
              success: true,
              total: result.summary.visibleCount,
            };
          }}
          rowKey="name"
          rowSelection={{
            onChange: (_, rows) => setSelectedRows(rows),
            selectedRowKeys: selectedRows.map((row) => row.name),
          }}
          search={{
            defaultCollapsed: false,
            labelWidth: 88,
          }}
          toolBarRender={false}
        />
        {selectedRows.length ? (
          <FooterToolbar
            extra={
              <span>
                已选 <strong>{selectedRows.length}</strong> 项
              </span>
            }
          >
            <PrintBatchAction
              documents={selectedRows.map((row) => ({
                docname: row.name,
                doctype,
              }))}
              sourcePage={rowSourcePage(doctype)}
            />
          </FooterToolbar>
        ) : null}
      </Space>
    </PageContainer>
  );
};

function rowSourcePage(doctype: BusinessDocumentDoctype) {
  return `business_documents:${doctype}`;
}

export default BusinessDocumentsTablePage;
