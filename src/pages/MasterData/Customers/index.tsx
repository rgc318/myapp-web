import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Button, Tag } from 'antd';
import React, { useRef } from 'react';
import { listCustomers, type PartySummary } from '@/services/myapp/master-data';

const PAGE_SIZE = 20;

const columns: ProColumns<PartySummary>[] = [
  {
    title: '关键词',
    dataIndex: 'searchKey',
    hideInTable: true,
    fieldProps: {
      allowClear: true,
      placeholder: '客户编码 / 名称 / 手机',
    },
  },
  {
    title: '客户编码',
    dataIndex: 'name',
    search: false,
    width: 180,
  },
  {
    title: '客户名称',
    dataIndex: 'displayName',
    search: false,
    ellipsis: true,
  },
  {
    title: '类型',
    dataIndex: 'type',
    search: false,
    width: 110,
    renderText: (value) => value || '-',
  },
  {
    title: '分组',
    dataIndex: 'group',
    search: false,
    width: 140,
    renderText: (value) => value || '-',
  },
  {
    title: '手机',
    dataIndex: 'mobileNo',
    search: false,
    width: 140,
    renderText: (value) => value || '-',
  },
  {
    title: '邮箱',
    dataIndex: 'email',
    search: false,
    ellipsis: true,
    renderText: (value) => value || '-',
  },
  {
    title: '状态',
    dataIndex: 'disabled',
    search: false,
    width: 90,
    render: (_, record) =>
      record.disabled ? <Tag>停用</Tag> : <Tag color="green">启用</Tag>,
  },
];

const CustomersPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);

  return (
    <PageContainer
      title="客户"
      extra={[
        <Button key="refresh" onClick={() => actionRef.current?.reload()}>
          刷新
        </Button>,
      ]}
    >
      <ProTable<PartySummary>
        actionRef={actionRef}
        columns={columns}
        pagination={{
          defaultPageSize: PAGE_SIZE,
          showSizeChanger: false,
        }}
        request={async (params) => {
          const current = Number(params.current ?? 1);
          const pageSize = Number(params.pageSize ?? PAGE_SIZE);
          const result = await listCustomers({
            disabled: 0,
            limit: pageSize,
            searchKey: String(params.searchKey ?? ''),
            start: (current - 1) * pageSize,
          });

          return {
            data: result.items,
            success: true,
            total: result.total,
          };
        }}
        rowKey="name"
        search={{
          defaultCollapsed: false,
          labelWidth: 88,
        }}
        toolBarRender={false}
      />
    </PageContainer>
  );
};

export default CustomersPage;
