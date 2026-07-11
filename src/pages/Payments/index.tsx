import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  FooterToolbar,
  PageContainer,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { Link, useLocation, useRequest } from '@umijs/max';
import { Button, Space, Tag, Typography } from 'antd';
import React, { useRef, useState } from 'react';
import { RemoteLinkSelect } from '@/components';
import { PrintBatchAction } from '@/components/printing/PrintBatchAction';
import { useWorkspacePreferences } from '@/hooks/useWorkspacePreferences';
import { toOptionalText } from '@/services/myapp/api-utils';
import {
  type CashflowEntry,
  fetchCashflowEntries,
  fetchCashflowReport,
  type ReportFilter,
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

function buildReportFilter(params: Record<string, any>): ReportFilter {
  const dateRange = Array.isArray(params.dateRange) ? params.dateRange : [];
  return {
    company: toOptionalText(params.company),
    dateFrom: dateRange[0] ? String(dateRange[0]) : undefined,
    dateTo: dateRange[1] ? String(dateRange[1]) : undefined,
  };
}

function reportFilterKey(filter: ReportFilter) {
  return JSON.stringify({
    company: filter.company ?? '',
    dateFrom: filter.dateFrom ?? '',
    dateTo: filter.dateTo ?? '',
  });
}

function buildColumns(
  defaultCompany: string,
  initialSearchKey: string,
): ProColumns<CashflowEntry>[] {
  return [
    {
      title: '关键词',
      dataIndex: 'searchKey',
      hideInTable: true,
      initialValue: initialSearchKey,
      fieldProps: {
        allowClear: true,
        placeholder: '收付款单号 / 往来方 / 参考号',
      },
    },
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
      render: (_, record) =>
        record.name ? (
          <Link to={`/payments/${encodeURIComponent(record.name)}`}>
            {record.name}
          </Link>
        ) : (
          '-'
        ),
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
      render: (_, record) => (
        <Typography.Text
          style={{
            color: record.direction === 'in' ? '#389e0d' : undefined,
          }}
          type={record.direction === 'out' ? 'danger' : undefined}
        >
          {formatCurrencyValue(record.amount)}
        </Typography.Text>
      ),
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
  const location = useLocation();
  const { defaultCompany } = useWorkspacePreferences();
  const initialSearchKey =
    new URLSearchParams(location.search).get('search') ?? '';
  const columns = buildColumns(defaultCompany, initialSearchKey);
  const [selectedRows, setSelectedRows] = useState<CashflowEntry[]>([]);
  const [activeReportFilter, setActiveReportFilter] = useState<ReportFilter>({
    company: defaultCompany,
  });
  const activeReportFilterKey = reportFilterKey(activeReportFilter);
  const activeReportFilterKeyRef = useRef(activeReportFilterKey);
  const {
    data: cashflowReport,
    loading: cashflowReportLoading,
    refresh: refreshCashflowReport,
  } = useRequest(() => fetchCashflowReport(activeReportFilter), {
    formatResult: (result) => result,
    refreshDeps: [activeReportFilterKey],
  });

  return (
    <PageContainer
      title="收付款流水"
      extra={[
        <Button
          key="refresh"
          onClick={() => {
            actionRef.current?.reload();
            refreshCashflowReport();
          }}
        >
          刷新
        </Button>,
      ]}
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <StatisticCard.Group direction="row">
          <StatisticCard
            loading={cashflowReportLoading}
            statistic={{
              title: '收款合计',
              value: formatCurrencyValue(
                cashflowReport?.overview.receivedAmountTotal,
              ),
            }}
          />
          <StatisticCard
            loading={cashflowReportLoading}
            statistic={{
              title: '付款合计',
              value: formatCurrencyValue(
                cashflowReport?.overview.paidAmountTotal,
              ),
            }}
          />
          <StatisticCard
            loading={cashflowReportLoading}
            statistic={{
              title: '净现金流',
              value: formatCurrencyValue(
                cashflowReport?.overview.netCashflowTotal,
              ),
            }}
          />
        </StatisticCard.Group>

        <ProTable<CashflowEntry>
          actionRef={actionRef}
          columns={columns}
          key={`${defaultCompany}-${initialSearchKey}`}
          pagination={{
            defaultPageSize: PAGE_SIZE,
            showSizeChanger: false,
          }}
          request={async (params) => {
            const current = Number(params.current ?? 1);
            const pageSize = Number(params.pageSize ?? PAGE_SIZE);
            const nextReportFilter = buildReportFilter(params);
            const nextReportFilterKey = reportFilterKey(nextReportFilter);
            if (activeReportFilterKeyRef.current !== nextReportFilterKey) {
              activeReportFilterKeyRef.current = nextReportFilterKey;
              setActiveReportFilter(nextReportFilter);
            }
            const result = await fetchCashflowEntries({
              ...nextReportFilter,
              page: current,
              pageSize,
              searchKey: toOptionalText(params.searchKey),
            });
            setSelectedRows([]);

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
          rowSelection={{
            getCheckboxProps: (record) => ({ disabled: !record.name }),
            onChange: (_, rows) => setSelectedRows(rows),
            selectedRowKeys: selectedRows.map((record) =>
              [
                record.name,
                record.postingDate,
                record.party,
                record.referenceNo,
                record.amount,
              ]
                .filter(Boolean)
                .join('-'),
            ),
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
                已选 <strong>{selectedRows.length}</strong> 笔收付款
              </span>
            }
          >
            <PrintBatchAction
              documents={selectedRows
                .filter((row) => row.name)
                .map((row) => ({
                  docname: row.name || '',
                  doctype: 'Payment Entry',
                }))}
              sourcePage="payments"
            />
          </FooterToolbar>
        ) : null}
      </Space>
    </PageContainer>
  );
};

export default PaymentsPage;
