import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  type ActionType,
  PageContainer,
  type ProColumns,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { history, useRequest } from '@umijs/max';
import {
  Avatar,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import type { Key } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  getMutationErrorMessage,
  notifyMutationError,
} from '@/services/myapp/mutation';
import {
  batchSetUsersEnabled,
  createUser,
  getUserManagementOverview,
  listRoles,
  listUsers,
  type RoleSummary,
  setUserEnabled,
  type UserProfile,
} from '@/services/myapp/users';
import { useAdministrationStyles } from '../styles';

const { Text } = Typography;

export default function UserListPage() {
  const { styles } = useAdministrationStyles();
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [form] = Form.useForm();
  const { data: overview, refresh: refreshOverview } = useRequest(
    getUserManagementOverview,
    { formatResult: (result) => result },
  );

  useEffect(() => {
    listRoles().then(setRoles);
  }, []);

  const reload = () => {
    setSelectedRowKeys([]);
    actionRef.current?.reload();
    refreshOverview();
  };

  const batchUpdate = (enabled: boolean) => {
    Modal.confirm({
      title: `批量${enabled ? '启用' : '停用'}用户`,
      content: `将更新已选择的 ${selectedRowKeys.length} 个账号。系统保留账号和最后一个系统管理员会受到后端保护。`,
      okText: '确认执行',
      okButtonProps: { danger: !enabled },
      onOk: async () => {
        try {
          await batchSetUsersEnabled(selectedRowKeys.map(String), enabled);
          reload();
        } catch (error) {
          notifyMutationError(error);
        }
      },
    });
  };

  const columns: ProColumns<UserProfile>[] = [
    { title: '用户', dataIndex: 'search', hideInTable: true },
    {
      title: '用户身份',
      dataIndex: 'fullName',
      width: 260,
      render: (_, row) => (
        <div className={styles.identityCell}>
          <Avatar src={row.userImage} icon={<UserOutlined />} />
          <div>
            <a
              onClick={() =>
                history.push(
                  `/administration/users/${encodeURIComponent(row.name)}`,
                )
              }
            >
              {row.fullName}
            </a>
            <div className={styles.muted}>{row.email}</div>
          </div>
        </div>
      ),
    },
    { title: '手机', dataIndex: 'mobileNo', search: false, width: 140 },
    {
      title: '用户类型',
      dataIndex: 'userType',
      valueType: 'select',
      width: 120,
      valueEnum: {
        'System User': { text: '系统用户' },
        'Website User': { text: '网站用户' },
      },
    },
    {
      title: '角色',
      dataIndex: 'role',
      valueType: 'select',
      width: 280,
      fieldProps: {
        options: roles
          .filter((role) => !role.automatic)
          .map((role) => ({ label: role.name, value: role.name })),
      },
      render: (_, row) => (
        <Space wrap size={[4, 4]}>
          {row.roles.slice(0, 2).map((role) => (
            <Tag color="blue" key={role}>
              {role}
            </Tag>
          ))}
          {row.roles.length > 2 ? <Tag>+{row.roles.length - 2}</Tag> : null}
          {!row.roles.length ? <Text type="secondary">未分配</Text> : null}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      valueType: 'select',
      width: 100,
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '停用', status: 'Error' },
      },
      render: (_, row) => (
        <Tag color={row.enabled ? 'success' : 'error'}>
          {row.enabled ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '最近登录',
      dataIndex: 'lastLogin',
      valueType: 'dateTime',
      search: false,
      width: 170,
      renderText: (value) => value || '从未登录',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 120,
      fixed: 'right',
      render: (_, row) => [
        <a
          key="detail"
          onClick={() =>
            history.push(
              `/administration/users/${encodeURIComponent(row.name)}`,
            )
          }
        >
          详情
        </a>,
        <Popconfirm
          key="status"
          title={`确认${row.enabled ? '停用' : '启用'}该用户？`}
          onConfirm={async () => {
            try {
              await setUserEnabled(row.name, !row.enabled);
              reload();
            } catch (error) {
              notifyMutationError(error);
            }
          }}
        >
          <a>{row.enabled ? '停用' : '启用'}</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer
      title="用户管理"
      subTitle="统一管理账号生命周期、功能角色和数据可见范围"
    >
      <div className={styles.pageStack}>
        <Row gutter={[16, 16]}>
          <Col xl={6} sm={12} xs={24}>
            <StatisticCard
              className={styles.summaryCard}
              statistic={{
                title: '用户总数',
                value: overview?.totalUsers || 0,
                icon: <TeamOutlined />,
              }}
            />
          </Col>
          <Col xl={6} sm={12} xs={24}>
            <StatisticCard
              className={styles.summaryCard}
              statistic={{
                title: '启用账号',
                value: overview?.enabledUsers || 0,
                icon: <CheckCircleOutlined />,
                description: `${overview?.disabledUsers || 0} 个账号已停用`,
              }}
            />
          </Col>
          <Col xl={6} sm={12} xs={24}>
            <StatisticCard
              className={styles.summaryCard}
              statistic={{
                title: '系统管理员',
                value: overview?.systemManagers || 0,
                icon: <SafetyCertificateOutlined />,
                description: `${overview?.usersWithoutRoles || 0} 个启用账号未分配角色`,
              }}
            />
          </Col>
          <Col xl={6} sm={12} xs={24}>
            <StatisticCard
              className={styles.summaryCard}
              statistic={{
                title: '从未登录',
                value: overview?.neverLoggedIn || 0,
                icon: <ClockCircleOutlined />,
                description: `${overview?.systemUsers || 0} 系统用户 / ${overview?.websiteUsers || 0} 网站用户`,
              }}
            />
          </Col>
        </Row>

        <Card variant="borderless" styles={{ body: { padding: 0 } }}>
          <ProTable<UserProfile>
            actionRef={actionRef}
            rowKey="name"
            columns={columns}
            cardBordered={false}
            scroll={{ x: 1300 }}
            rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
            tableAlertRender={({ selectedRowKeys: keys }) => (
              <Space>
                <span>已选择 {keys.length} 个用户</span>
                <a onClick={() => setSelectedRowKeys([])}>取消选择</a>
              </Space>
            )}
            tableAlertOptionRender={() => (
              <Space>
                <Button
                  size="small"
                  icon={<CheckCircleOutlined />}
                  onClick={() => batchUpdate(true)}
                >
                  批量启用
                </Button>
                <Button
                  size="small"
                  danger
                  icon={<StopOutlined />}
                  onClick={() => batchUpdate(false)}
                >
                  批量停用
                </Button>
              </Space>
            )}
            request={async (params) => {
              const result = await listUsers({
                current: params.current,
                pageSize: params.pageSize,
                search: params.search,
                role: params.role,
                userType: params.userType,
                enabled:
                  typeof params.enabled === 'boolean'
                    ? params.enabled
                    : params.enabled === 'true'
                      ? true
                      : params.enabled === 'false'
                        ? false
                        : undefined,
              });
              return { data: result.users, success: true, total: result.total };
            }}
            pagination={{ defaultPageSize: 20, showSizeChanger: true }}
            toolBarRender={() => [
              <Button
                key="create"
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setOpen(true)}
              >
                新建用户
              </Button>,
            ]}
          />
        </Card>
      </div>

      <Modal
        title="新建系统用户"
        width={640}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ enabled: true, sendWelcomeEmail: false }}
          onFinish={async (values) => {
            try {
              const { data: user } = await createUser(values);
              setOpen(false);
              form.resetFields();
              reload();
              history.push(
                `/administration/users/${encodeURIComponent(user.name)}`,
              );
            } catch (error) {
              const errorMessage = getMutationErrorMessage(error);
              if (errorMessage.includes('密码')) {
                form.setFields([{ name: 'password', errors: [errorMessage] }]);
              }
              notifyMutationError(error);
            }
          }}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="email"
                label="登录邮箱"
                rules={[{ required: true, type: 'email' }]}
              >
                <Input placeholder="name@company.com" />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item
                name="firstName"
                label="名字"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item name="lastName" label="姓氏">
                <Input />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item name="mobileNo" label="手机">
                <Input />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item
                name="password"
                label="初始密码"
                tooltip="留空时可通过欢迎邮件设置密码"
              >
                <Input.Password />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="roles" label="初始角色">
                <Select
                  mode="multiple"
                  placeholder="选择一个或多个业务角色"
                  options={roles
                    .filter((role) => !role.automatic)
                    .map((role) => ({ label: role.name, value: role.name }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Space size="large">
            <Form.Item name="enabled" label="立即启用" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item
              name="sendWelcomeEmail"
              label="发送欢迎邮件"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </PageContainer>
  );
}
