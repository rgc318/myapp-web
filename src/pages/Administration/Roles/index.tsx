import {
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { Tag } from 'antd';
import { listRoles, type RoleSummary } from '@/services/myapp/users';

export default function RoleListPage() {
  const columns: ProColumns<RoleSummary>[] = [
    { title: '角色名称', dataIndex: 'name', copyable: true },
    {
      title: '类型',
      dataIndex: 'automatic',
      search: false,
      render: (_, row) =>
        row.automatic ? <Tag>系统自动</Tag> : <Tag color="blue">可分配</Tag>,
    },
    {
      title: 'Desk 访问',
      dataIndex: 'deskAccess',
      search: false,
      render: (_, row) =>
        row.deskAccess ? <Tag color="success">允许</Tag> : <Tag>不允许</Tag>,
    },
    {
      title: '限制域',
      dataIndex: 'restrictToDomain',
      search: false,
      renderText: (value) => value || '-',
    },
    {
      title: '已分配用户',
      dataIndex: 'userCount',
      search: false,
      valueType: 'digit',
      sorter: (a, b) => a.userCount - b.userCount,
    },
  ];
  return (
    <PageContainer
      title="角色目录"
      subTitle="角色权限规则由 Frappe DocPerm 统一裁决"
    >
      <ProTable<RoleSummary>
        rowKey="name"
        columns={columns}
        search={{ labelWidth: 'auto' }}
        pagination={false}
        request={async (params) => ({
          data: await listRoles(params.name),
          success: true,
        })}
      />
    </PageContainer>
  );
}
