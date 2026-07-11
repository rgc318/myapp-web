import {
  LockOutlined,
  ProfileOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { PageContainer, ProCard } from '@ant-design/pro-components';
import { history, useModel, useRequest } from '@umijs/max';
import { Alert, Button, Form, Input, Select, Space, Spin, Tabs } from 'antd';
import { useEffect } from 'react';
import { RemoteLinkSelect } from '@/components/RemoteLinkSelect';
import {
  logoutMyAppJwt,
  mapMyAppUserToCurrentUser,
} from '@/services/myapp/auth';
import {
  changeCurrentUserPassword,
  getCurrentUserProfile,
  updateCurrentUserProfile,
} from '@/services/myapp/users';
import {
  getCurrentUserWorkspacePreferences,
  updateCurrentUserWorkspacePreferences,
} from '@/services/myapp/workspace';

export default function AccountSettingsPage() {
  const [profileForm] = Form.useForm();
  const [workspaceForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const defaultCompany = Form.useWatch('defaultCompany', workspaceForm);
  const { setInitialState } = useModel('@@initialState');
  const {
    data: profile,
    loading,
    refresh,
  } = useRequest(getCurrentUserProfile, { formatResult: (result) => result });
  const { data: workspace } = useRequest(getCurrentUserWorkspacePreferences, {
    formatResult: (result) => result,
  });

  useEffect(() => {
    if (profile) profileForm.setFieldsValue(profile);
  }, [profile, profileForm]);
  useEffect(() => {
    if (workspace) workspaceForm.setFieldsValue(workspace);
  }, [workspace, workspaceForm]);

  if (loading || !profile) return <Spin fullscreen tip="正在加载个人设置" />;

  return (
    <PageContainer title="个人设置" subTitle="维护个人资料、工作偏好与账号安全">
      <ProCard>
        <Tabs
          tabPosition="left"
          items={[
            {
              key: 'profile',
              label: (
                <span>
                  <ProfileOutlined />
                  基本资料
                </span>
              ),
              children: (
                <Form
                  form={profileForm}
                  layout="vertical"
                  style={{ maxWidth: 720 }}
                  onFinish={async (values) => {
                    const { data: next } =
                      await updateCurrentUserProfile(values);
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
                  }}
                >
                  <Space align="start" wrap style={{ width: '100%' }}>
                    <Form.Item
                      name="firstName"
                      label="名字"
                      rules={[{ required: true }]}
                    >
                      <Input />
                    </Form.Item>
                    <Form.Item name="middleName" label="中间名">
                      <Input />
                    </Form.Item>
                    <Form.Item name="lastName" label="姓氏">
                      <Input />
                    </Form.Item>
                  </Space>
                  <Space align="start" wrap style={{ width: '100%' }}>
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
                  <Space align="start" wrap style={{ width: '100%' }}>
                    <Form.Item name="language" label="语言">
                      <Select
                        allowClear
                        style={{ width: 180 }}
                        options={[
                          { label: '简体中文', value: 'zh' },
                          { label: 'English', value: 'en' },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item name="timeZone" label="时区">
                      <Input placeholder="Asia/Shanghai" />
                    </Form.Item>
                    <Form.Item name="gender" label="性别">
                      <Input />
                    </Form.Item>
                  </Space>
                  <Form.Item
                    name="userImage"
                    label="头像地址"
                    tooltip="支持 Frappe 文件地址或公开图片地址"
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item name="bio" label="个人简介">
                    <Input.TextArea rows={4} />
                  </Form.Item>
                  <Form.Item name="interest" label="兴趣与专长">
                    <Input.TextArea rows={2} />
                  </Form.Item>
                  <Button type="primary" htmlType="submit">
                    保存资料
                  </Button>
                </Form>
              ),
            },
            {
              key: 'workspace',
              label: (
                <span>
                  <SettingOutlined />
                  工作偏好
                </span>
              ),
              children: (
                <Form
                  form={workspaceForm}
                  layout="vertical"
                  style={{ maxWidth: 560 }}
                  onFinish={updateCurrentUserWorkspacePreferences}
                >
                  <Alert
                    title="默认公司和仓库会作为开单、库存与报表页面的优先筛选值。"
                    type="info"
                    showIcon
                    style={{ marginBottom: 24 }}
                  />
                  <Form.Item name="defaultCompany" label="默认公司">
                    <RemoteLinkSelect
                      doctype="Company"
                      placeholder="搜索公司"
                    />
                  </Form.Item>
                  <Form.Item name="defaultWarehouse" label="默认仓库">
                    <RemoteLinkSelect
                      doctype="Warehouse"
                      extraFields={['company']}
                      filters={{ company: defaultCompany }}
                      placeholder="搜索仓库"
                    />
                  </Form.Item>
                  <Button type="primary" htmlType="submit">
                    保存工作偏好
                  </Button>
                </Form>
              ),
            },
            {
              key: 'security',
              label: (
                <span>
                  <LockOutlined />
                  账号安全
                </span>
              ),
              children: (
                <Form
                  form={passwordForm}
                  layout="vertical"
                  style={{ maxWidth: 480 }}
                  onFinish={async (values) => {
                    await changeCurrentUserPassword({
                      oldPassword: values.oldPassword,
                      newPassword: values.newPassword,
                      logoutAllSessions: true,
                    });
                    await logoutMyAppJwt();
                    history.replace('/user/login');
                  }}
                >
                  <Alert
                    title="修改密码后将退出当前账号，需要使用新密码重新登录。"
                    type="warning"
                    showIcon
                    style={{ marginBottom: 24 }}
                  />
                  <Form.Item
                    name="oldPassword"
                    label="当前密码"
                    rules={[{ required: true }]}
                  >
                    <Input.Password />
                  </Form.Item>
                  <Form.Item
                    name="newPassword"
                    label="新密码"
                    rules={[{ required: true, min: 8 }]}
                  >
                    <Input.Password />
                  </Form.Item>
                  <Form.Item
                    name="confirmPassword"
                    label="确认新密码"
                    dependencies={['newPassword']}
                    rules={[
                      { required: true },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          return !value ||
                            getFieldValue('newPassword') === value
                            ? Promise.resolve()
                            : Promise.reject(new Error('两次输入的密码不一致'));
                        },
                      }),
                    ]}
                  >
                    <Input.Password />
                  </Form.Item>
                  <Button danger type="primary" htmlType="submit">
                    修改密码并重新登录
                  </Button>
                </Form>
              ),
            },
          ]}
        />
      </ProCard>
    </PageContainer>
  );
}
