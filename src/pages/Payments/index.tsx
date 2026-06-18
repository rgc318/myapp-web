import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Button, Tag } from 'antd';
import React, { useRef } from 'react';
import { RemoteLinkSelect } from '@/components';
import { useWorkspacePreferences } from '@/hooks/useWorkspacePreferences';
import { toOptionalText } from '@/services/myapp/api-utils';
import {
  type CashflowEntry,
  fetchCashflowEntries,
} from '@/services/myapp/reports';
import { formatCurrencyValue } from '@/utils/myapp-display';

const PAGE_SIZE = 20;

function directionTag(value: CashflowEntry['direction']) {
  const map: Record<
    CashflowEntry['direction'],
    { color: string; text: string }
  > = {
    in: { color: 'green', text: '收款' },
    out: { color: 'orange', text: '付款' },
    transfer: { color: 'blue', text: '转账' },
  };
  const item = map[value] ?? { color: 'default', text: '未知' };
  return <Tag color={item.color}>{item.text}</Tag>;
}

function buildColumns(defaultCompany: string): ProColumns<CashflowEntry>[] {
  return [
    {
      title: '公司',
      dataIndex: 'company',
      hideInTable: true,
      initialValue: defaultCompany,
      formItemRender: (_, { onChange, value }) => (
        <RemoteLinkSelect
          doctype="Company"
          onChange={onChange}
          placeholder="搜索公司"
          style={{ width: '100%' }}
          value={value}
        />
      ),
    },
    {
      title: '日期',
      dataIndex: 'dateRange',
      valueType: 'dateRange',
      hideInTable: true,
    },
    {
      title: '日期',
      dataIndex: 'postingDate',
      search: false,
      width: 120,
    },
    {
      title: '方向',
      dataIndex: 'direction',
      search: false,
      width: 90,
      render: (_, record) => directionTag(record.direction),
    },
    {
      title: '收付款单号',
      dataIndex: 'name',
      search: false,
      width: 180,
      renderText: (value) => value || '-',
    },
    {
      title: '往来方类型',
      dataIndex: 'partyType',
      search: false,
      width: 120,
      renderText: (value) => value || '-',
    },
    {
      title: '往来方',
      dataIndex: 'party',
      search: false,
      ellipsis: true,
      renderText: (value) => value || '-',
    },
    {
      title: '付款方式',
      dataIndex: 'modeOfPayment',
      search: false,
      width: 130,
      renderText: (value) => value || '-',
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
      title: '参考号',
      dataIndex: 'referenceNo',
      search: false,
      ellipsis: true,
      width: 160,
      renderText: (value) => value || '-',
    },
  ];
}

const PaymentsPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const { defaultCompany } = useWorkspacePreferences();
  const columns = buildColumns(defaultCompany);

  return (
    <PageContainer
      title="收付款流水"
      extra={[
        <Button key="refresh" onClick={() => actionRef.current?.reload()}>
          刷新
        </Button>,
      ]}
    >
      <ProTable<CashflowEntry>
        actionRef={actionRef}
        columns={columns}
        key={defaultCompany}
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
          const result = await fetchCashflowEntries({
            company: toOptionalText(params.company),
            dateFrom: dateRange[0] ? String(dateRange[0]) : undefined,
            dateTo: dateRange[1] ? String(dateRange[1]) : undefined,
            page: current,
            pageSize,
          });

          return {
            data: result.items,
            success: true,
            total: result.total,
          };
        }}
        rowKey={(record) =>
          [
            record.name,
            record.postingDate,
            record.party,
            record.referenceNo,
            record.amount,
          ]
            .filter(Boolean)
            .join('-')
        }
        search={{
          defaultCollapsed: false,
          labelWidth: 88,
        }}
        toolBarRender={false}
      />
    </PageContainer>
  );
};

export default PaymentsPage;
