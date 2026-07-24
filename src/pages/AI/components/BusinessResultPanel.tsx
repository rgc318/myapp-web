import {
  ExportOutlined,
  FileSearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProCard, ProTable } from '@ant-design/pro-components';
import { Alert, Button, Space, Tabs, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import type {
  AiBusinessDocumentResult,
  AiBusinessResultGroup,
  AiBusinessResultSet,
} from '@/services/myapp/ai';
import { formatCurrencyValue, StatusTag } from '@/utils/myapp-display';

const SORT_LABELS: Record<string, string> = {
  amount_asc: '金额从低到高',
  amount_desc: '金额从高到低',
  latest: '最新优先',
  oldest: '最早优先',
};

const STATUS_LABELS: Record<string, string> = {
  all: '全部有效状态',
  cancelled: '已作废',
  completed: '已完成',
  delivering: '发货中',
  paying: '待收付款',
  receiving: '收货中',
  unfinished: '未完成',
};

function formatDateScope(resultSet: AiBusinessResultSet) {
  const { dateFrom, dateTo } = resultSet.scope;
  if (dateFrom && dateTo) return `${dateFrom} 至 ${dateTo}`;
  if (dateFrom) return `${dateFrom} 起`;
  if (dateTo) return `截至 ${dateTo}`;
  return '全部日期';
}

function groupNotice(group: AiBusinessResultGroup) {
  if (group.status === 'empty') {
    return `${group.label}没有返回符合当前条件的记录。`;
  }
  if (
    group.status === 'partial' &&
    group.requestedCount !== null &&
    group.returnedCount < group.requestedCount
  ) {
    return `${group.label}请求 ${group.requestedCount} 条，实际返回 ${group.returnedCount} 条。`;
  }
  return null;
}

function formatSnapshotTime(value: string | null) {
  if (!value) return '历史结果未记录查询时间';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : value;
}

function groupCoverageTags(group: AiBusinessResultGroup) {
  return [
    <Tag bordered={false} key="returned">
      返回 {group.returnedCount} 条
    </Tag>,
    <Tag bordered={false} key="available">
      {group.availableCount === null
        ? '可见总量未知'
        : `当前可见 ${group.availableCount} 条`}
    </Tag>,
    <Tag
      bordered={false}
      color={group.truncated === true ? 'warning' : undefined}
      key="truncated"
    >
      {group.truncated === true
        ? '结果已截断'
        : group.truncated === false
          ? '结果未截断'
          : '截断状态未知'}
    </Tag>,
  ];
}

function buildColumns(
  onOpenDocument?: (document: AiBusinessDocumentResult) => void,
): ProColumns<AiBusinessDocumentResult>[] {
  return [
    {
      dataIndex: 'id',
      fixed: 'left',
      title: '单据编号',
      width: 190,
      render: (_, row) =>
        onOpenDocument ? (
          <Button onClick={() => onOpenDocument(row)} type="link">
            {row.id}
          </Button>
        ) : row.href ? (
          <Typography.Link href={row.href}>{row.id}</Typography.Link>
        ) : (
          row.id
        ),
    },
    {
      dataIndex: 'party',
      ellipsis: true,
      title: '客户 / 供应商',
      width: 220,
      renderText: (value) => value || '-',
    },
    {
      dataIndex: 'transactionDate',
      title: '交易日期',
      width: 120,
      renderText: (value) => value || '-',
    },
    {
      dataIndex: 'documentStatus',
      title: '状态',
      width: 110,
      render: (_, row) => <StatusTag value={row.documentStatus} />,
    },
    {
      align: 'right',
      dataIndex: 'amount',
      title: '金额',
      width: 140,
      render: (_, row) => formatCurrencyValue(row.amount, row.currency),
    },
    {
      align: 'right',
      dataIndex: 'outstandingAmount',
      title: '未结金额',
      width: 140,
      render: (_, row) =>
        row.outstandingAmount > 0 ? (
          <Typography.Text type="danger">
            {formatCurrencyValue(row.outstandingAmount, row.currency)}
          </Typography.Text>
        ) : (
          <Typography.Text type="success">已结清</Typography.Text>
        ),
    },
  ];
}

export function BusinessResultPanel({
  onOpenDocument,
  onRefresh,
  resultSet,
}: {
  onOpenDocument?: (document: AiBusinessDocumentResult) => void;
  onRefresh?: () => Promise<void>;
  resultSet: AiBusinessResultSet;
}) {
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const columns = buildColumns(onOpenDocument);
  const scopeTags = [
    resultSet.scope.company
      ? { key: 'company', label: `公司：${resultSet.scope.company}` }
      : null,
    { key: 'date', label: `日期：${formatDateScope(resultSet)}` },
    resultSet.scope.statusFilter
      ? {
          key: 'status',
          label: `状态：${STATUS_LABELS[resultSet.scope.statusFilter] ?? resultSet.scope.statusFilter}`,
        }
      : null,
    resultSet.scope.sortBy
      ? {
          key: 'sort',
          label: `排序：${SORT_LABELS[resultSet.scope.sortBy] ?? resultSet.scope.sortBy}`,
        }
      : null,
    resultSet.scope.limitPerGroup
      ? {
          key: 'limit',
          label: `每类最多 ${resultSet.scope.limitPerGroup} 条`,
        }
      : null,
    resultSet.scope.minAmount !== null
      ? {
          key: 'amount',
          label: `最低金额：${formatCurrencyValue(resultSet.scope.minAmount, 'CNY')}`,
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string }>;

  const refresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshError(null);
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (caught) {
      setRefreshError(
        caught instanceof Error ? caught.message : '当前业务数据刷新失败。',
      );
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ProCard
      extra={
        <Space wrap>
          <Typography.Text type="secondary">
            共{' '}
            {resultSet.groups.reduce(
              (total, group) => total + group.returnedCount,
              0,
            )}{' '}
            条
          </Typography.Text>
          {onRefresh ? (
            <Button
              icon={<ReloadOutlined />}
              loading={refreshing}
              onClick={() => void refresh()}
              size="small"
            >
              刷新当前数据
            </Button>
          ) : null}
        </Space>
      }
      size="small"
      title={
        <Space>
          <FileSearchOutlined />
          <span>业务查询结果</span>
        </Space>
      }
      variant="outlined"
    >
      <Space
        orientation="vertical"
        size={4}
        style={{ marginBottom: 12, width: '100%' }}
      >
        <Typography.Text strong>
          {resultSet.snapshotSource === 'refresh'
            ? '当前刷新数据'
            : '回答时数据'}
        </Typography.Text>
        <Typography.Text type="secondary">
          {resultSet.snapshotSource === 'refresh' ? '刷新时间' : '查询时间'}：
          {formatSnapshotTime(resultSet.queriedAt)}
        </Typography.Text>
      </Space>
      {refreshError ? (
        <Alert
          closable
          onClose={() => setRefreshError(null)}
          showIcon
          style={{ marginBottom: 12 }}
          title={refreshError}
          type="error"
        />
      ) : null}
      <Space size={[6, 6]} style={{ marginBottom: 12 }} wrap>
        {scopeTags.map((tag) => (
          <Tag bordered={false} key={tag.key}>
            {tag.label}
          </Tag>
        ))}
        <Tag bordered={false} color="success">
          {resultSet.permissionFiltered
            ? '已按当前账号权限过滤'
            : '当前账号可见范围'}
        </Tag>
      </Space>
      <Tabs
        items={resultSet.groups.map((group) => {
          const notice = groupNotice(group);
          return {
            children: (
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                <Space size={[6, 6]} wrap>
                  {groupCoverageTags(group)}
                  {group.moduleHref ? (
                    <Button
                      href={group.moduleHref}
                      icon={<ExportOutlined />}
                      size="small"
                      type="link"
                    >
                      在业务模块查看完整结果
                    </Button>
                  ) : null}
                </Space>
                {notice ? (
                  <Alert
                    showIcon
                    title={notice}
                    type={group.status === 'empty' ? 'info' : 'warning'}
                  />
                ) : null}
                <ProTable<AiBusinessDocumentResult>
                  columns={columns}
                  dataSource={group.items}
                  locale={{ emptyText: `暂无${group.label}` }}
                  options={false}
                  pagination={false}
                  rowKey={(row) => `${row.type}-${row.id}`}
                  search={false}
                  size="small"
                  tableAlertRender={false}
                  toolBarRender={false}
                  scroll={{ x: 920 }}
                />
              </Space>
            ),
            key: group.entity,
            label: (
              <Space size={6}>
                <span>{group.label}</span>
                <Tag
                  bordered={false}
                  color={
                    group.status === 'partial'
                      ? 'warning'
                      : group.status === 'empty'
                        ? 'default'
                        : 'processing'
                  }
                >
                  {group.returnedCount}
                </Tag>
              </Space>
            ),
          };
        })}
      />
    </ProCard>
  );
}
