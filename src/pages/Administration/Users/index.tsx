import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { history } from '@umijs/max';
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tag,
} from 'antd';
import { useEffect, useRef, useState } from 'react';
import {
  createUser,
  listRoles,
  listUsers,
  type RoleSummary,
  setUserEnabled,
  type UserProfile,
} from '@/services/myapp/users';

export default function UserListPage() {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [form] = Form.useForm();

  useEffect(() => {
    listRoles().then(setRoles);
  }, []);

  const columns: ProColumns<UserProfile>[] = [
    { title: '用户', dataIndex: 'search', hideInTable: true },
    {
      title: '姓名',
      dataIndex: 'fullName',
      render: (_, row) => (
        <a
          onClick={() =>
            history.push(
              `/administration/users/${encodeURIComponent(row.name)}`,
            )
          }
        >
          {row.fullName}
        </a>
      ),
    },
    { title: '账号', dataIndex: 'email', search: false, copyable: true },
    { title: '手机', dataIndex: 'mobileNo', search: false },
    {
      title: '用户类型',
      dataIndex: 'userType',
      valueType: 'select',
      valueEnum: {
        'System User': { text: '系统用户' },
        'Website User': { text: '网站用户' },
      },
    },
    {
      title: '角色',
      dataIndex: 'role',
      valueType: 'select',
      fieldProps: {
        options: roles
          .filter((role) => !role.automatic)
          .map((role) => ({ label: role.name, value: role.name })),
      },
      render: (_, row) => (
        <Space wrap>
          {row.roles.slice(0, 3).map((role) => (
            <Tag key={role}>{role}</Tag>
          ))}
          {row.roles.length > 3 ? <Tag>+{row.roles.length - 3}</Tag> : null}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      valueType: 'select',
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
    },
    {
      title: '操作',
      valueType: 'option',
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
            await setUserEnabled(row.name, !row.enabled);
            actionRef.current?.reload();
          }}
        >
          <a>{row.enabled ? '停用' : '启用'}</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <PageContainer title="用户管理" subTitle="管理账号生命周期、角色和数据范围">
      <ProTable<UserProfile>
        actionRef={actionRef}
        rowKey="name"
        columns={columns}
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
      <Modal
        title="新建系统用户"
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
            const { data: user } = await createUser(values);
            setOpen(false);
            form.resetFields();
            actionRef.current?.reload();
            history.push(
              `/administration/users/${encodeURIComponent(user.name)}`,
            );
          }}
        >
          <Form.Item
            name="email"
            label="登录邮箱"
            rules={[{ required: true, type: 'email' }]}
          >
            <Input />
          </Form.Item>
          <Space align="start">
            <Form.Item
              name="firstName"
              label="名字"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="lastName" label="姓氏">
              <Input />
            </Form.Item>
          </Space>
          <Form.Item name="mobileNo" label="手机">
            <Input />
          </Form.Item>
          <Form.Item name="roles" label="初始角色">
            <Select
              mode="multiple"
              options={roles
                .filter((role) => !role.automatic)
                .map((role) => ({ label: role.name, value: role.name }))}
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="初始密码"
            tooltip="留空时可通过欢迎邮件设置密码"
          >
            <Input.Password />
          </Form.Item>
          <Space>
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
