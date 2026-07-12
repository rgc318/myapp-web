import {
  ApartmentOutlined,
  LockOutlined,
  ProfileOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { GridContent, PageContainer } from '@ant-design/pro-components';
import { history, useModel, useRequest } from '@umijs/max';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Menu,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';
import { RemoteLinkSelect } from '@/components/RemoteLinkSelect';
import {
  logoutMyAppJwt,
  mapMyAppUserToCurrentUser,
} from '@/services/myapp/auth';
import {
  getMutationErrorMessage,
  notifyMutationError,
} from '@/services/myapp/mutation';
import {
  changeCurrentUserPassword,
  getCurrentUserProfile,
  getUserSecurity,
  revokeUserSessions,
  updateCurrentUserProfile,
} from '@/services/myapp/users';
import {
  getCurrentUserWorkspacePreferences,
  updateCurrentUserWorkspacePreferences,
} from '@/services/myapp/workspace';
import { AvatarUpload } from '../AvatarUpload';
import { useAccountStyles } from '../styles';

const { Paragraph, Text, Title } = Typography;
type SettingKey = 'profile' | 'workspace' | 'security';

export default function AccountSettingsPage() {
  const { styles } = useAccountStyles();
  const [activeKey, setActiveKey] = useState<SettingKey>('profile');
  const [profileForm] = Form.useForm();
  const [workspaceForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const defaultCompany = Form.useWatch('defaultCompany', workspaceForm);
  const userImage = Form.useWatch('userImage', profileForm);
  const { setInitialState } = useModel('@@initialState');
  const {
    data: profile,
    loading,
    refresh,
  } = useRequest(getCurrentUserProfile, { formatResult: (result) => result });
  const { data: workspace } = useRequest(getCurrentUserWorkspacePreferences, {
    formatResult: (result) => result,
  });
  const { data: security, refresh: refreshSecurity } = useRequest(
    () => getUserSecurity(),
    { formatResult: (result) => result },
  );

  useEffect(() => {
    if (profile) profileForm.setFieldsValue(profile);
  }, [profile, profileForm]);
  useEffect(() => {
    if (workspace) workspaceForm.setFieldsValue(workspace);
  }, [workspace, workspaceForm]);

  if (loading || !profile) return <Spin fullscreen tip="正在加载个人设置" />;

  const content = {
    profile: (
      <Card variant="borderless" className={styles.contentCard}>
        <Title level={4}>基本资料</Title>
        <Paragraph className={styles.sectionDescription}>
          这些信息会用于系统头像菜单、操作审计和业务协作展示。
        </Paragraph>
        <Row gutter={[40, 24]}>
          <Col lg={16} xs={24}>
            <Form
              form={profileForm}
              layout="vertical"
              onFinish={async (values) => {
                try {
                  const { data: next } = await updateCurrentUserProfile(values);
                  setInitialState((state) => ({
                    ...state,
                    currentUser: mapMyAppUserToCurrentUser(
                      {
                        avatar: next.userImage || undefined,
                        email: next.email,
                        fullName: next.fullName,
                        location: next.location || undefined,
                        phone: next.mobileNo || next.phone || undefined,
                        roles: next.roles,
                        user: next.name,
                      },
                      state?.currentUser,
                    ),
                  }));
                  refresh();
                } catch (error) {
                  notifyMutationError(error);
                }
              }}
            >
              <Row gutter={16}>
                <Form.Item name="userImage" hidden>
                  <Input />
                </Form.Item>
                <Col md={8} xs={24}>
                  <Form.Item
                    name="firstName"
                    label="名字"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="请输入名字" />
                  </Form.Item>
                </Col>
                <Col md={8} xs={24}>
                  <Form.Item name="middleName" label="中间名">
                    <Input placeholder="可选" />
                  </Form.Item>
                </Col>
                <Col md={8} xs={24}>
                  <Form.Item name="lastName" label="姓氏">
                    <Input placeholder="请输入姓氏" />
                  </Form.Item>
                </Col>
                <Col md={8} xs={24}>
                  <Form.Item name="mobileNo" label="手机">
                    <Input placeholder="手机号码" />
                  </Form.Item>
                </Col>
                <Col md={8} xs={24}>
                  <Form.Item name="phone" label="办公电话">
                    <Input placeholder="办公电话" />
                  </Form.Item>
                </Col>
                <Col md={8} xs={24}>
                  <Form.Item name="location" label="所在地">
                    <Input placeholder="城市或办公地点" />
                  </Form.Item>
                </Col>
                <Col md={8} xs={24}>
                  <Form.Item name="language" label="界面语言">
                    <Select
                      allowClear
                      options={[
                        { label: '简体中文', value: 'zh' },
                        { label: 'English', value: 'en' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col md={8} xs={24}>
                  <Form.Item name="timeZone" label="时区">
                    <Input placeholder="Asia/Shanghai" />
                  </Form.Item>
                </Col>
                <Col md={8} xs={24}>
                  <Form.Item name="gender" label="性别">
                    <Input placeholder="可选" />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name="bio" label="个人简介">
                    <Input.TextArea
                      rows={4}
                      maxLength={280}
                      showCount
                      placeholder="介绍职责、岗位或专业方向"
                    />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name="interest" label="兴趣与专长">
                    <Input.TextArea rows={2} maxLength={180} showCount />
                  </Form.Item>
                </Col>
              </Row>
              <Button type="primary" htmlType="submit">
                保存基本资料
              </Button>
            </Form>
          </Col>
          <Col lg={8} xs={24} style={{ textAlign: 'center' }}>
            <Text strong>个人头像</Text>
            <div style={{ margin: '20px 0' }}>
              <AvatarUpload
                value={userImage || profile.userImage}
                onChange={(fileUrl) => {
                  profileForm.setFieldValue('userImage', fileUrl);
                  setInitialState((state) => ({
                    ...state,
                    currentUser: state?.currentUser
                      ? { ...state.currentUser, avatar: fileUrl }
                      : state?.currentUser,
                  }));
                  refresh();
                }}
              />
            </div>
          </Col>
        </Row>
      </Card>
    ),
    workspace: (
      <Card variant="borderless" className={styles.contentCard}>
        <Title level={4}>工作空间偏好</Title>
        <Paragraph className={styles.sectionDescription}>
          默认公司和仓库将作为开单、库存和报表页面的优先筛选条件。
        </Paragraph>
        <Alert
          title="偏好只影响默认取值，不会扩大当前账号的数据访问权限。"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
        <Form
          form={workspaceForm}
          layout="vertical"
          style={{ maxWidth: 640 }}
          onFinish={async (values) => {
            try {
              await updateCurrentUserWorkspacePreferences(values);
            } catch (error) {
              notifyMutationError(error);
            }
          }}
        >
          <Form.Item name="defaultCompany" label="默认公司">
            <RemoteLinkSelect doctype="Company" placeholder="搜索公司" />
          </Form.Item>
          <Form.Item name="defaultWarehouse" label="默认仓库">
            <RemoteLinkSelect
              doctype="Warehouse"
              extraFields={['company']}
              filters={{ company: defaultCompany }}
              placeholder="搜索仓库"
            />
          </Form.Item>
          <Divider />
          <Space wrap>
            <Tag icon={<ApartmentOutlined />} color="blue">
              当前公司：{workspace?.defaultCompany || '未设置'}
            </Tag>
            <Tag color="cyan">
              当前仓库：{workspace?.defaultWarehouse || '未设置'}
            </Tag>
          </Space>
          <div style={{ marginTop: 24 }}>
            <Button type="primary" htmlType="submit">
              保存工作偏好
            </Button>
          </div>
        </Form>
      </Card>
    ),
    security: (
      <Card variant="borderless" className={styles.contentCard}>
        <Title level={4}>账号安全</Title>
        <Paragraph className={styles.sectionDescription}>
          查看登录状态并定期更新密码，降低共享账号和凭据泄露风险。
        </Paragraph>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col md={8} xs={24}>
            <Card size="small">
              <Text type="secondary">JWT 刷新会话</Text>
              <div>
                <Text strong>{security?.jwtRefreshSessionCount || 0}</Text>
              </div>
            </Card>
          </Col>
          <Col md={8} xs={24}>
            <Card size="small">
              <Text type="secondary">Frappe Session</Text>
              <div>
                <Text strong>{security?.frappeSessionCount || 0}</Text>
              </div>
            </Card>
          </Col>
          <Col md={8} xs={24}>
            <Card size="small">
              <Text type="secondary">双因素认证</Text>
              <div>
                <Text strong>
                  {security?.twoFactorEnabled
                    ? security.twoFactorMethod || '已启用'
                    : '未启用'}
                </Text>
              </div>
            </Card>
          </Col>
        </Row>
        <Alert
          title="修改密码后将注销当前登录，需要使用新密码重新认证。"
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
        <Form
          form={passwordForm}
          layout="vertical"
          style={{ maxWidth: 520 }}
          onFinish={async (values) => {
            try {
              await changeCurrentUserPassword({
                oldPassword: values.oldPassword,
                newPassword: values.newPassword,
                logoutAllSessions: true,
              });
              await logoutMyAppJwt();
              history.replace('/user/login');
            } catch (error) {
              const errorMessage = getMutationErrorMessage(error);
              const fieldName = errorMessage.includes('旧密码')
                ? 'oldPassword'
                : 'newPassword';
              passwordForm.setFields([
                { name: fieldName, errors: [errorMessage] },
              ]);
              notifyMutationError(error);
            }
          }}
        >
          <Form.Item
            name="oldPassword"
            label="当前密码"
            rules={[{ required: true }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            extra="至少 8 位，并需满足服务端密码强度策略。"
            rules={[{ required: true, min: 8 }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value || getFieldValue('newPassword') === value
                    ? Promise.resolve()
                    : Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button
            danger
            type="primary"
            htmlType="submit"
            icon={<LockOutlined />}
          >
            修改密码并重新登录
          </Button>
        </Form>
        <Divider />
        <Title level={5}>设备与会话</Title>
        <Paragraph type="secondary">
          注销全部会话会立即提升账号授权代次，使现有 access token、refresh token
          和 Frappe Session 全部失效。
        </Paragraph>
        <Space wrap>
          <Button
            danger
            onClick={async () => {
              try {
                const { data } = await revokeUserSessions();
                await refreshSecurity();
                if (data.reauthenticationRequired) {
                  await logoutMyAppJwt();
                  history.replace('/user/login');
                }
              } catch (error) {
                notifyMutationError(error);
              }
            }}
          >
            注销我的全部设备
          </Button>
          <Text type="secondary">最近登录 IP：{security?.lastIp || '-'}</Text>
        </Space>
      </Card>
    ),
  } satisfies Record<SettingKey, React.ReactNode>;

  return (
    <PageContainer title="个人设置" subTitle="维护个人资料、工作空间与账号安全">
      <GridContent>
        <div className={styles.settingsShell}>
          <Card variant="borderless" className={styles.settingsMenu}>
            <div style={{ marginBottom: 20, textAlign: 'center' }}>
              <Avatar
                size={64}
                src={profile.userImage}
                icon={<ProfileOutlined />}
              />
              <Title level={5} style={{ margin: '10px 0 0' }}>
                {profile.fullName}
              </Title>
              <Text type="secondary">{profile.email}</Text>
            </div>
            <Menu
              mode="inline"
              selectedKeys={[activeKey]}
              onClick={({ key }) => setActiveKey(key as SettingKey)}
              items={[
                {
                  key: 'profile',
                  icon: <ProfileOutlined />,
                  label: '基本资料',
                },
                {
                  key: 'workspace',
                  icon: <ApartmentOutlined />,
                  label: '工作空间',
                },
                {
                  key: 'security',
                  icon: <SafetyCertificateOutlined />,
                  label: '账号安全',
                },
              ]}
            />
          </Card>
          {content[activeKey]}
        </div>
      </GridContent>
    </PageContainer>
  );
}
