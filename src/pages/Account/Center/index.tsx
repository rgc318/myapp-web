import {
  ApartmentOutlined,
  ClockCircleOutlined,
  EditOutlined,
  EnvironmentOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  GridContent,
  PageContainer,
  StatisticCard,
} from '@ant-design/pro-components';
import { history, useRequest } from '@umijs/max';
import {
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  List,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { getCurrentUserProfile } from '@/services/myapp/users';
import { useAccountStyles } from '../styles';

const { Paragraph, Text, Title } = Typography;

const capabilityLabels: Record<string, string> = {
  can_manage_roles: '角色治理',
  can_manage_users: '用户管理',
  can_view_finance: '财务中心',
  can_view_inventory: '库存管理',
  can_view_purchase: '采购管理',
  can_view_sales: '销售管理',
};

export default function AccountCenterPage() {
  const { styles } = useAccountStyles();
  const { data: profile, loading } = useRequest(getCurrentUserProfile, {
    formatResult: (result) => result,
  });

  if (loading || !profile) {
    return <Spin fullscreen tip="正在加载个人资料" />;
  }

  const enabledCapabilities = Object.entries(profile.capabilities).filter(
    ([, enabled]) => enabled,
  );

  return (
    <PageContainer
      title="个人中心"
      subTitle="集中查看身份、授权范围和账号安全状态"
      extra={[
        <Button
          key="edit"
          type="primary"
          icon={<EditOutlined />}
          onClick={() => history.push('/account/settings')}
        >
          编辑个人资料
        </Button>,
      ]}
    >
      <GridContent>
        <Row gutter={[24, 24]}>
          <Col lg={7} md={24} xs={24}>
            <Card variant="borderless" className={styles.profileCard}>
              <div className={styles.profileBanner} />
              <div className={styles.profileHeader}>
                <Avatar
                  size={96}
                  src={profile.userImage}
                  icon={<UserOutlined />}
                />
                <Title level={3} style={{ margin: '14px 0 2px' }}>
                  {profile.fullName}
                </Title>
                <Text type="secondary">{profile.email}</Text>
                <div style={{ marginTop: 12 }}>
                  <Tag color={profile.enabled ? 'success' : 'error'}>
                    {profile.enabled ? '账号正常' : '账号停用'}
                  </Tag>
                  <Tag color="blue">{profile.userType || '系统用户'}</Tag>
                </div>
              </div>
              <Paragraph
                type="secondary"
                style={{ margin: '20px 0', textAlign: 'center' }}
              >
                {profile.bio || '暂未填写个人简介，可在个人设置中补充。'}
              </Paragraph>
              <Divider dashed />
              <Space orientation="vertical" size={14} style={{ width: '100%' }}>
                <div className={styles.infoRow}>
                  <MailOutlined /> <span>{profile.email}</span>
                </div>
                <div className={styles.infoRow}>
                  <PhoneOutlined />
                  <span>
                    {profile.mobileNo || profile.phone || '未填写联系电话'}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <EnvironmentOutlined />
                  <span>{profile.location || '未填写所在地'}</span>
                </div>
                <div className={styles.infoRow}>
                  <ClockCircleOutlined />
                  <span>{profile.timeZone || '使用系统默认时区'}</span>
                </div>
              </Space>
              <Divider dashed />
              <Text strong>角色标签</Text>
              <div style={{ marginTop: 12 }}>
                <Space wrap>
                  {profile.roles.slice(0, 8).map((role) => (
                    <Tag key={role}>{role}</Tag>
                  ))}
                  {profile.roles.length > 8 ? (
                    <Tag>+{profile.roles.length - 8}</Tag>
                  ) : null}
                </Space>
              </div>
            </Card>
          </Col>

          <Col lg={17} md={24} xs={24}>
            <Space orientation="vertical" size={24} style={{ width: '100%' }}>
              <StatisticCard.Group direction="row">
                <StatisticCard
                  className={styles.statCard}
                  statistic={{ title: '功能角色', value: profile.roles.length }}
                />
                <StatisticCard
                  className={styles.statCard}
                  statistic={{
                    title: '数据范围',
                    value: profile.userPermissions.length,
                  }}
                />
                <StatisticCard
                  className={styles.statCard}
                  statistic={{
                    title: '已授权模块',
                    value: enabledCapabilities.length,
                  }}
                />
                <StatisticCard
                  className={styles.statCard}
                  statistic={{
                    title: '最近登录',
                    value: profile.lastLogin
                      ? dayjs(profile.lastLogin).format('MM-DD HH:mm')
                      : '从未登录',
                  }}
                />
              </StatisticCard.Group>

              <Card title="账号与工作空间" variant="borderless">
                <Descriptions column={{ lg: 3, md: 2, xs: 1 }}>
                  <Descriptions.Item label="用户名">
                    {profile.username || profile.name}
                  </Descriptions.Item>
                  <Descriptions.Item label="默认公司">
                    {profile.workspacePreferences.defaultCompany || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="默认仓库">
                    {profile.workspacePreferences.defaultWarehouse || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="最近活跃">
                    {profile.lastActive
                      ? dayjs(profile.lastActive).format('YYYY-MM-DD HH:mm')
                      : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="最近登录 IP">
                    {profile.lastIp || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="密码最后更新">
                    {profile.lastPasswordResetDate || '-'}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              <Card title="功能授权概览" variant="borderless">
                <Row gutter={[12, 12]}>
                  {enabledCapabilities.map(([capability]) => (
                    <Col lg={8} sm={12} xs={24} key={capability}>
                      <div className={styles.capabilityItem}>
                        <Space>
                          <SafetyCertificateOutlined
                            style={{ color: '#1677ff' }}
                          />
                          <Text strong>
                            {capabilityLabels[capability] || capability}
                          </Text>
                        </Space>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Card>

              <Card
                title="数据可见范围"
                variant="borderless"
                extra={<ApartmentOutlined />}
              >
                {profile.userPermissions.length ? (
                  <List
                    itemLayout="horizontal"
                    dataSource={profile.userPermissions}
                    renderItem={(permission) => (
                      <List.Item
                        extra={
                          <Space>
                            {permission.isDefault ? (
                              <Tag color="gold">默认值</Tag>
                            ) : null}
                            <Tag color="processing">{permission.allow}</Tag>
                          </Space>
                        }
                      >
                        <List.Item.Meta
                          avatar={<Avatar icon={<ApartmentOutlined />} />}
                          title={permission.forValue}
                          description={
                            permission.applyToAllDoctypes
                              ? '应用到全部相关业务单据'
                              : `仅应用到 ${permission.applicableFor || '-'}`
                          }
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="未设置专属数据范围，按角色权限执行"
                  />
                )}
              </Card>

              <Card title="安全状态" variant="borderless">
                <List
                  dataSource={[
                    {
                      title: '账户密码',
                      description: profile.lastPasswordResetDate
                        ? `最后更新于 ${profile.lastPasswordResetDate}`
                        : '尚未记录密码更新时间',
                      action: '修改密码',
                    },
                    {
                      title: '登录活动',
                      description: profile.lastLogin
                        ? `最近登录 ${dayjs(profile.lastLogin).format('YYYY-MM-DD HH:mm')}`
                        : '该账号尚未登录',
                      action: '查看设置',
                    },
                  ]}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        <a
                          key={item.action}
                          onClick={() => history.push('/account/settings')}
                        >
                          {item.action}
                        </a>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<Avatar icon={<LockOutlined />} />}
                        title={item.title}
                        description={item.description}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Space>
          </Col>
        </Row>
      </GridContent>
    </PageContainer>
  );
}
