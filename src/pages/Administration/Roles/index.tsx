import {
  AppstoreOutlined,
  EditOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  PageContainer,
  type ProColumns,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import { Avatar, Card, Col, Progress, Row, Space, Tag, Typography } from 'antd';
import { listRoles, type RoleSummary } from '@/services/myapp/users';
import { useAdministrationStyles } from '../styles';

const { Text } = Typography;

export default function RoleListPage() {
  const { styles } = useAdministrationStyles();
  const { data: roles = [], loading } = useRequest(() => listRoles(), {
    formatResult: (result) => result,
  });
  const assignableRoles = roles.filter((role) => !role.automatic);
  const totalAssignments = roles.reduce((sum, role) => sum + role.userCount, 0);
  const coveredDoctypes = Math.max(
    ...roles.map((role) => role.doctypeCount),
    0,
  );

  const columns: ProColumns<RoleSummary>[] = [
    {
      title: '角色',
      dataIndex: 'name',
      copyable: true,
      render: (_, row) => (
        <div className={styles.roleName}>
          <Avatar icon={<SafetyCertificateOutlined />} />
          <div>
            <Text strong>{row.name}</Text>
            <div className={styles.muted}>
              {row.automatic ? '系统自动角色' : '可分配业务角色'}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '访问类型',
      dataIndex: 'automatic',
      search: false,
      width: 130,
      render: (_, row) =>
        row.automatic ? <Tag>系统自动</Tag> : <Tag color="blue">可分配</Tag>,
    },
    {
      title: 'Desk 访问',
      dataIndex: 'deskAccess',
      search: false,
      width: 110,
      render: (_, row) =>
        row.deskAccess ? <Tag color="success">允许</Tag> : <Tag>不允许</Tag>,
    },
    {
      title: '权限规则',
      dataIndex: 'permissionCount',
      search: false,
      width: 110,
      sorter: (a, b) => a.permissionCount - b.permissionCount,
    },
    {
      title: 'DocType 覆盖',
      dataIndex: 'doctypeCount',
      search: false,
      width: 180,
      sorter: (a, b) => a.doctypeCount - b.doctypeCount,
      render: (_, row) => (
        <Space orientation="vertical" size={0} style={{ width: '100%' }}>
          <Text>{row.doctypeCount} 个</Text>
          <Progress
            percent={
              coveredDoctypes
                ? Math.round((row.doctypeCount / coveredDoctypes) * 100)
                : 0
            }
            showInfo={false}
            size="small"
          />
        </Space>
      ),
    },
    {
      title: '可写范围',
      dataIndex: 'writeDoctypeCount',
      search: false,
      width: 110,
      render: (_, row) => (
        <Tag color={row.writeDoctypeCount ? 'orange' : 'default'}>
          {row.writeDoctypeCount} 个
        </Tag>
      ),
    },
    {
      title: '已分配用户',
      dataIndex: 'userCount',
      search: false,
      width: 120,
      valueType: 'digit',
      sorter: (a, b) => a.userCount - b.userCount,
    },
    {
      title: '限制域',
      dataIndex: 'restrictToDomain',
      search: false,
      width: 140,
      renderText: (value) => value || '-',
    },
  ];

  return (
    <PageContainer
      title="角色目录"
      subTitle="查看角色使用情况和 Frappe DocPerm 权限覆盖摘要"
    >
      <div className={styles.pageStack}>
        <Row gutter={[16, 16]}>
          <Col xl={6} sm={12} xs={24}>
            <StatisticCard
              statistic={{
                title: '角色总数',
                value: roles.length,
                icon: <SafetyCertificateOutlined />,
              }}
            />
          </Col>
          <Col xl={6} sm={12} xs={24}>
            <StatisticCard
              statistic={{
                title: '可分配角色',
                value: assignableRoles.length,
                icon: <EditOutlined />,
              }}
            />
          </Col>
          <Col xl={6} sm={12} xs={24}>
            <StatisticCard
              statistic={{
                title: '累计用户分配',
                value: totalAssignments,
                icon: <TeamOutlined />,
              }}
            />
          </Col>
          <Col xl={6} sm={12} xs={24}>
            <StatisticCard
              statistic={{
                title: '最大 DocType 覆盖',
                value: coveredDoctypes,
                icon: <AppstoreOutlined />,
              }}
            />
          </Col>
        </Row>
        <Card variant="borderless" styles={{ body: { padding: 0 } }}>
          <ProTable<RoleSummary>
            rowKey="name"
            loading={loading}
            columns={columns}
            dataSource={roles}
            search={false}
            pagination={{ defaultPageSize: 20, showSizeChanger: true }}
            scroll={{ x: 1150 }}
            options={{
              density: true,
              fullScreen: true,
              reload: false,
              setting: true,
            }}
            headerTitle="角色权限概览"
          />
        </Card>
      </div>
    </PageContainer>
  );
}
