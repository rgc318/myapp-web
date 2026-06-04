import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Button, Tag } from 'antd';
import React, { useRef } from 'react';
import { listUoms, type UomSummary } from '@/services/myapp/master-data';

const PAGE_SIZE = 20;

const columns: ProColumns<UomSummary>[] = [
  {
    title: '关键词',
    dataIndex: 'searchKey',
    hideInTable: true,
    fieldProps: {
      allowClear: true,
      placeholder: '单位名称',
    },
  },
  {
    title: '单位',
    dataIndex: 'name',
    search: false,
  },
  {
    title: '显示名称',
    dataIndex: 'uomName',
    search: false,
  },
  {
    title: '整数单位',
    dataIndex: 'mustBeWholeNumber',
    search: false,
    width: 120,
    render: (_, record) =>
      record.mustBeWholeNumber ? <Tag color="blue">是</Tag> : <Tag>否</Tag>,
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

const UomsPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);

  return (
    <PageContainer
      title="计量单位"
      extra={[
        <Button key="refresh" onClick={() => actionRef.current?.reload()}>
          刷新
        </Button>,
      ]}
    >
      <ProTable<UomSummary>
        actionRef={actionRef}
        columns={columns}
        pagination={{
          defaultPageSize: PAGE_SIZE,
          showSizeChanger: false,
        }}
        request={async (params) => {
          const current = Number(params.current ?? 1);
          const pageSize = Number(params.pageSize ?? PAGE_SIZE);
          const result = await listUoms({
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

export default UomsPage;
