import {
  ClockCircleOutlined,
  EnvironmentOutlined,
  MailOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { PageContainer, ProCard } from '@ant-design/pro-components';
import { useRequest } from '@umijs/max';
import {
  Avatar,
  Descriptions,
  Empty,
  List,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { getCurrentUserProfile } from '@/services/myapp/users';

const { Paragraph, Text, Title } = Typography;

export default function AccountCenterPage() {
  const { data: profile, loading } = useRequest(getCurrentUserProfile, {
    formatResult: (result) => result,
  });

  if (loading || !profile) {
    return <Spin fullscreen tip="正在加载个人资料" />;
  }

  return (
    <PageContainer title="个人中心" subTitle="查看身份、授权范围与账号活动">
      <ProCard gutter={[16, 16]} wrap>
        <ProCard colSpan={{ md: 8, xs: 24 }}>
          <Space
            orientation="vertical"
            align="center"
            style={{ width: '100%' }}
            size="large"
          >
            <Avatar size={96} src={profile.userImage} icon={<UserOutlined />} />
            <div style={{ textAlign: 'center' }}>
              <Title level={3} style={{ marginBottom: 4 }}>
                {profile.fullName}
              </Title>
              <Text type="secondary">{profile.email}</Text>
            </div>
            <Paragraph type="secondary" style={{ textAlign: 'center' }}>
              {profile.bio || profile.shortBio || '暂未填写个人简介'}
            </Paragraph>
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Text>
                <MailOutlined /> {profile.email}
              </Text>
              <Text>
                <PhoneOutlined />{' '}
                {profile.mobileNo || profile.phone || '未填写电话'}
              </Text>
              <Text>
                <EnvironmentOutlined /> {profile.location || '未填写所在地'}
              </Text>
              <Text>
                <ClockCircleOutlined /> {profile.timeZone || '使用系统时区'}
              </Text>
            </Space>
          </Space>
        </ProCard>
        <ProCard colSpan={{ md: 16, xs: 24 }}>
          <Space orientation="vertical" size="large" style={{ width: '100%' }}>
            <ProCard title="账号概览" headerBordered>
              <Descriptions column={{ md: 2, xs: 1 }}>
                <Descriptions.Item label="账号状态">
                  <Tag color={profile.enabled ? 'success' : 'error'}>
                    {profile.enabled ? '启用' : '停用'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="用户类型">
                  {profile.userType || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="最近登录">
                  {profile.lastLogin
                    ? dayjs(profile.lastLogin).format('YYYY-MM-DD HH:mm')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="最近活跃">
                  {profile.lastActive
                    ? dayjs(profile.lastActive).format('YYYY-MM-DD HH:mm')
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="默认公司">
                  {profile.workspacePreferences.defaultCompany || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="默认仓库">
                  {profile.workspacePreferences.defaultWarehouse || '-'}
                </Descriptions.Item>
              </Descriptions>
            </ProCard>
            <ProCard title="功能角色" headerBordered>
              <Space wrap>
                {profile.roles.length ? (
                  profile.roles.map((role) => (
                    <Tag color="blue" key={role}>
                      <SafetyCertificateOutlined /> {role}
                    </Tag>
                  ))
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="未分配业务角色"
                  />
                )}
              </Space>
            </ProCard>
            <ProCard title="数据可见范围" headerBordered>
              <List
                locale={{ emptyText: '未设置专属数据范围，按角色权限执行' }}
                dataSource={profile.userPermissions}
                renderItem={(permission) => (
                  <List.Item
                    extra={
                      permission.isDefault ? (
                        <Tag color="gold">默认值</Tag>
                      ) : null
                    }
                  >
                    <List.Item.Meta
                      title={`${permission.allow}：${permission.forValue}`}
                      description={
                        permission.applyToAllDoctypes
                          ? '应用到全部相关单据'
                          : `仅应用到 ${permission.applicableFor || '-'}`
                      }
                    />
                  </List.Item>
                )}
              />
            </ProCard>
          </Space>
        </ProCard>
      </ProCard>
    </PageContainer>
  );
}
