import {
  ApartmentOutlined,
  DeleteOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  PageContainer,
  ProCard,
  type ProColumns,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { history, useParams } from '@umijs/max';
import {
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { RemoteLinkSelect } from '@/components/RemoteLinkSelect';
import { notifyMutationError } from '@/services/myapp/mutation';
import {
  addUserPermission,
  deleteUserPermission,
  getUserDetail,
  getUserPermissionSnapshot,
  getUserSecurity,
  listRoles,
  type RoleSummary,
  revokeUserSessions,
  setUserEnabled,
  type UserPermission,
  type UserPermissionSnapshotRow,
  type UserProfile,
  type UserSecurity,
  updateUser,
  updateUserRoles,
} from '@/services/myapp/users';
import { useAdministrationStyles } from '../styles';

const { Text, Title } = Typography;

export default function UserDetailPage() {
  const { styles } = useAdministrationStyles();
  const params = useParams<{ user: string }>();
  const user = decodeURIComponent(params.user || '');
  const [profile, setProfile] = useState<UserProfile>();
  const [security, setSecurity] = useState<UserSecurity>();
  const [permissionSnapshot, setPermissionSnapshot] = useState<
    UserPermissionSnapshotRow[]
  >([]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [profileForm] = Form.useForm();
  const [roleForm] = Form.useForm();
  const [permissionForm] = Form.useForm();
  const permissionDoctype = Form.useWatch('allow', permissionForm);

  const load = async () => {
    const [next, nextSecurity, snapshot] = await Promise.all([
      getUserDetail(user),
      getUserSecurity(user),
      getUserPermissionSnapshot(user),
    ]);
    setProfile(next);
    setSecurity(nextSecurity);
    setPermissionSnapshot(snapshot.permissions);
    profileForm.setFieldsValue(next);
    roleForm.setFieldsValue({ roles: next.roles });
  };
  const runAction = async (
    action: () => Promise<unknown>,
    onSuccess?: () => void | Promise<void>,
  ) => {
    try {
      await action();
      await onSuccess?.();
    } catch (error) {
      notifyMutationError(error);
    }
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
            await runAction(() => deleteUserPermission(user, row.name), load);
          }}
        >
          <a>
            <DeleteOutlined /> 删除
          </a>
        </Popconfirm>
      ),
    },
  ];
  const snapshotColumns: ProColumns<UserPermissionSnapshotRow>[] = [
    { title: 'DocType', dataIndex: 'doctype', fixed: 'left', width: 180 },
    ...(
      [
        'read',
        'write',
        'create',
        'delete',
        'submit',
        'cancel',
        'report',
        'export',
      ] as const
    ).map((field) => ({
      title: field,
      dataIndex: field,
      search: false,
      width: 82,
      render: (_: unknown, row: UserPermissionSnapshotRow) =>
        row[field] ? <Tag color="success">允许</Tag> : <Tag>—</Tag>,
    })),
    {
      title: '仅本人',
      dataIndex: 'ifOwner',
      width: 90,
      render: (_, row) => (row.ifOwner ? <Tag color="warning">是</Tag> : '否'),
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
            await runAction(() => setUserEnabled(user, !profile.enabled), load);
          }}
        >
          <Button danger={profile.enabled}>
            {profile.enabled ? '停用账号' : '启用账号'}
          </Button>
        </Popconfirm>,
      ]}
    >
      <div className={styles.pageStack}>
        <Card variant="borderless">
          <Row gutter={[24, 24]} align="middle">
            <Col flex="auto">
              <Space size={16} align="center">
                <Avatar
                  size={72}
                  src={profile.userImage}
                  icon={<UserOutlined />}
                />
                <div>
                  <Space wrap>
                    <Title level={4} style={{ margin: 0 }}>
                      {profile.fullName}
                    </Title>
                    <Tag color={profile.enabled ? 'success' : 'error'}>
                      {profile.enabled ? '账号正常' : '账号停用'}
                    </Tag>
                  </Space>
                  <div style={{ marginTop: 6 }}>
                    <Text type="secondary">{profile.email}</Text>
                  </div>
                  <Space wrap style={{ marginTop: 10 }}>
                    <Tag>{profile.userType}</Tag>
                    <Tag color="blue">
                      {profile.workspacePreferences.defaultCompany ||
                        '未设置默认公司'}
                    </Tag>
                  </Space>
                </div>
              </Space>
            </Col>
            <Col xl={12} lg={14} xs={24}>
              <StatisticCard.Group direction="row">
                <StatisticCard
                  statistic={{
                    title: '功能角色',
                    value: profile.roles.length,
                    icon: <SafetyCertificateOutlined />,
                  }}
                />
                <StatisticCard
                  statistic={{
                    title: '数据权限',
                    value: profile.userPermissions.length,
                    icon: <ApartmentOutlined />,
                  }}
                />
                <StatisticCard
                  statistic={{
                    title: '变更记录',
                    value: profile.auditLog.length,
                  }}
                />
              </StatisticCard.Group>
            </Col>
          </Row>
        </Card>
        <ProCard
          headerBordered
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
                        await runAction(() => updateUser(user, values), load);
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
                      await runAction(
                        () => updateUserRoles(user, nextRoles || []),
                        load,
                      );
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
              {
                key: 'snapshot',
                label: '权限快照',
                children: (
                  <ProTable<UserPermissionSnapshotRow>
                    rowKey="doctype"
                    search={false}
                    options={false}
                    pagination={false}
                    scroll={{ x: 950 }}
                    dataSource={permissionSnapshot}
                    columns={snapshotColumns}
                    headerTitle="核心业务 DocType 有效角色权限"
                  />
                ),
              },
              {
                key: 'security',
                label: '安全与会话',
                children: security ? (
                  <Space
                    orientation="vertical"
                    size="large"
                    style={{ width: '100%' }}
                  >
                    <Descriptions bordered column={{ md: 3, xs: 1 }}>
                      <Descriptions.Item label="双因素认证">
                        <Tag
                          color={
                            security.twoFactorEnabled ? 'success' : 'default'
                          }
                        >
                          {security.twoFactorEnabled
                            ? security.twoFactorMethod || '已启用'
                            : '未启用'}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="JWT 刷新会话">
                        {security.jwtRefreshSessionCount}
                      </Descriptions.Item>
                      <Descriptions.Item label="Frappe Session">
                        {security.frappeSessionCount}
                      </Descriptions.Item>
                      <Descriptions.Item label="允许并发会话">
                        {security.simultaneousSessions}
                      </Descriptions.Item>
                      <Descriptions.Item label="限制 IP">
                        {security.restrictIp || '未限制'}
                      </Descriptions.Item>
                      <Descriptions.Item label="授权代次">
                        {security.authGeneration}
                      </Descriptions.Item>
                    </Descriptions>
                    <List
                      header={<strong>活动 Frappe Session</strong>}
                      locale={{
                        emptyText:
                          '暂无 Frappe Session；Web JWT 会话数量见上方',
                      }}
                      dataSource={security.frappeSessions}
                      renderItem={(session) => (
                        <List.Item
                          extra={
                            session.isCurrent ? (
                              <Tag color="blue">当前</Tag>
                            ) : null
                          }
                        >
                          <List.Item.Meta
                            title={session.ipAddress || '未知 IP'}
                            description={`${session.userAgent || '未知设备'} · ${session.lastUpdated || '-'}`}
                          />
                        </List.Item>
                      )}
                    />
                    <Popconfirm
                      title="确认注销该用户的全部设备和 JWT 会话？"
                      description="现有 access token 和 refresh token 都将失效。"
                      onConfirm={async () => {
                        await runAction(() => revokeUserSessions(user), load);
                      }}
                    >
                      <Button danger>注销全部会话</Button>
                    </Popconfirm>
                  </Space>
                ) : null,
              },
            ],
          }}
        />
      </div>
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
            await runAction(
              () => addUserPermission({ ...values, user }),
              async () => {
                setPermissionOpen(false);
                permissionForm.resetFields();
                await load();
              },
            );
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
