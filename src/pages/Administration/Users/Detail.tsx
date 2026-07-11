import { DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import {
  PageContainer,
  ProCard,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { history, useParams } from '@umijs/max';
import {
  Button,
  Descriptions,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Timeline,
} from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { RemoteLinkSelect } from '@/components/RemoteLinkSelect';
import {
  addUserPermission,
  deleteUserPermission,
  getUserDetail,
  listRoles,
  type RoleSummary,
  setUserEnabled,
  type UserPermission,
  type UserProfile,
  updateUser,
  updateUserRoles,
} from '@/services/myapp/users';

export default function UserDetailPage() {
  const params = useParams<{ user: string }>();
  const user = decodeURIComponent(params.user || '');
  const [profile, setProfile] = useState<UserProfile>();
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [profileForm] = Form.useForm();
  const [roleForm] = Form.useForm();
  const [permissionForm] = Form.useForm();
  const permissionDoctype = Form.useWatch('allow', permissionForm);

  const load = async () => {
    const next = await getUserDetail(user);
    setProfile(next);
    profileForm.setFieldsValue(next);
    roleForm.setFieldsValue({ roles: next.roles });
  };
  useEffect(() => {
    load();
    listRoles().then(setRoles);
  }, [user]);
  if (!profile) return <Spin fullscreen tip="正在加载用户详情" />;

  const permissionColumns: ProColumns<UserPermission>[] = [
    { title: '授权类型', dataIndex: 'allow' },
    { title: '授权值', dataIndex: 'forValue' },
    {
      title: '适用范围',
      render: (_, row) =>
        row.applyToAllDoctypes ? '全部相关单据' : row.applicableFor || '-',
    },
    {
      title: '默认值',
      render: (_, row) => (row.isDefault ? <Tag color="gold">是</Tag> : '否'),
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, row) => (
        <Popconfirm
          title="确认删除该数据权限？"
          onConfirm={async () => {
            await deleteUserPermission(user, row.name);
            load();
          }}
        >
          <a>
            <DeleteOutlined /> 删除
          </a>
        </Popconfirm>
      ),
    },
  ];

  return (
    <PageContainer
      title={profile.fullName}
      subTitle={profile.email}
      onBack={() => history.push('/administration/users')}
      extra={[
        <Popconfirm
          key="status"
          title={`确认${profile.enabled ? '停用' : '启用'}该用户？`}
          onConfirm={async () => {
            await setUserEnabled(user, !profile.enabled);
            load();
          }}
        >
          <Button danger={profile.enabled}>
            {profile.enabled ? '停用账号' : '启用账号'}
          </Button>
        </Popconfirm>,
      ]}
    >
      <ProCard
        tabs={{
          items: [
            {
              key: 'overview',
              label: '账号概览',
              children: (
                <Space
                  orientation="vertical"
                  size="large"
                  style={{ width: '100%' }}
                >
                  <Descriptions bordered column={{ md: 3, xs: 1 }}>
                    <Descriptions.Item label="状态">
                      <Tag color={profile.enabled ? 'success' : 'error'}>
                        {profile.enabled ? '启用' : '停用'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="用户类型">
                      {profile.userType}
                    </Descriptions.Item>
                    <Descriptions.Item label="用户名">
                      {profile.username || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="手机">
                      {profile.mobileNo || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="最近登录">
                      {profile.lastLogin
                        ? dayjs(profile.lastLogin).format('YYYY-MM-DD HH:mm')
                        : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="最近 IP">
                      {profile.lastIp || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="默认公司">
                      {profile.workspacePreferences.defaultCompany || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="默认仓库">
                      {profile.workspacePreferences.defaultWarehouse || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="密码更新">
                      {profile.lastPasswordResetDate || '-'}
                    </Descriptions.Item>
                  </Descriptions>
                  <Form
                    form={profileForm}
                    layout="vertical"
                    onFinish={async (values) => {
                      await updateUser(user, values);
                      load();
                    }}
                  >
                    <Space wrap align="start">
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
                      <Form.Item name="username" label="用户名">
                        <Input />
                      </Form.Item>
                      <Form.Item name="mobileNo" label="手机">
                        <Input />
                      </Form.Item>
                      <Form.Item name="phone" label="电话">
                        <Input />
                      </Form.Item>
                      <Form.Item name="location" label="所在地">
                        <Input />
                      </Form.Item>
                    </Space>
                    <Form.Item name="bio" label="简介">
                      <Input.TextArea rows={3} />
                    </Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<SaveOutlined />}
                    >
                      保存资料
                    </Button>
                  </Form>
                </Space>
              ),
            },
            {
              key: 'roles',
              label: `角色 (${profile.roles.length})`,
              children: (
                <Form
                  form={roleForm}
                  layout="vertical"
                  onFinish={async ({ roles: nextRoles }) => {
                    await updateUserRoles(user, nextRoles || []);
                    load();
                  }}
                >
                  <Form.Item
                    name="roles"
                    label="功能角色"
                    extra="角色决定可使用的功能，最终权限仍由后端 DocPerm 校验。"
                  >
                    <Select
                      mode="multiple"
                      style={{ maxWidth: 720 }}
                      options={roles
                        .filter((role) => !role.automatic)
                        .map((role) => ({
                          label: `${role.name} (${role.userCount})`,
                          value: role.name,
                        }))}
                    />
                  </Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                  >
                    保存角色
                  </Button>
                </Form>
              ),
            },
            {
              key: 'permissions',
              label: `数据权限 (${profile.userPermissions.length})`,
              children: (
                <>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setPermissionOpen(true)}
                    style={{ marginBottom: 16 }}
                  >
                    添加数据权限
                  </Button>
                  <ProTable<UserPermission>
                    rowKey="name"
                    search={false}
                    options={false}
                    pagination={false}
                    dataSource={profile.userPermissions}
                    columns={permissionColumns}
                  />
                </>
              ),
            },
            {
              key: 'audit',
              label: '变更记录',
              children: profile.auditLog.length ? (
                <Timeline
                  items={profile.auditLog.map((entry) => ({
                    children: (
                      <List
                        size="small"
                        header={
                          <Space>
                            <strong>{entry.changedBy}</strong>
                            <span>
                              {entry.creation
                                ? dayjs(entry.creation).format(
                                    'YYYY-MM-DD HH:mm:ss',
                                  )
                                : ''}
                            </span>
                          </Space>
                        }
                        dataSource={entry.changes}
                        renderItem={(change) => (
                          <List.Item>
                            {change.field}: {String(change.oldValue ?? '-')} →{' '}
                            {String(change.newValue ?? '-')}
                          </List.Item>
                        )}
                      />
                    ),
                  }))}
                />
              ) : (
                <div>暂无变更记录</div>
              ),
            },
          ],
        }}
      />
      <Modal
        title="添加数据权限"
        open={permissionOpen}
        onCancel={() => setPermissionOpen(false)}
        onOk={() => permissionForm.submit()}
        destroyOnHidden
      >
        <Form
          form={permissionForm}
          layout="vertical"
          initialValues={{ allow: 'Company', applyToAllDoctypes: true }}
          onFinish={async (values) => {
            await addUserPermission({ ...values, user });
            setPermissionOpen(false);
            permissionForm.resetFields();
            load();
          }}
        >
          <Form.Item name="allow" label="授权类型" rules={[{ required: true }]}>
            <Select
              options={['Company', 'Warehouse', 'Customer', 'Supplier'].map(
                (value) => ({ label: value, value }),
              )}
            />
          </Form.Item>
          <Form.Item
            name="forValue"
            label="授权值"
            rules={[{ required: true }]}
          >
            <RemoteLinkSelect
              doctype={permissionDoctype || 'Company'}
              placeholder="搜索授权值"
            />
          </Form.Item>
          <Form.Item
            name="isDefault"
            label="作为默认值"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="applyToAllDoctypes"
            label="应用到全部相关单据"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(before, after) =>
              before.applyToAllDoctypes !== after.applyToAllDoctypes
            }
          >
            {({ getFieldValue }) =>
              !getFieldValue('applyToAllDoctypes') ? (
                <Form.Item
                  name="applicableFor"
                  label="限定单据类型"
                  rules={[{ required: true }]}
                >
                  <Select
                    showSearch
                    options={[
                      'Sales Order',
                      'Sales Invoice',
                      'Delivery Note',
                      'Purchase Order',
                      'Purchase Invoice',
                      'Purchase Receipt',
                      'Payment Entry',
                    ].map((value) => ({ label: value, value }))}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
