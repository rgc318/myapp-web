import {
  CheckCircleOutlined,
  CloudSyncOutlined,
  ExperimentOutlined,
  HistoryOutlined,
  PlusOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import {
  type ActionType,
  PageContainer,
  type ProColumns,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { useAccess, useRequest } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useMemo, useRef, useState } from 'react';
import {
  type AiAuditEvent,
  type AiModel,
  type AiPolicy,
  type AiPolicyDraftInput,
  type AiPolicyVersion,
  type AiUsageDaily,
  approveAiPolicy,
  getAiGovernanceOverview,
  getAiPolicy,
  getAiUsage,
  listAiModels,
  listAiPolicies,
  publishAiPolicy,
  rollbackAiPolicy,
  saveAiPolicyDraft,
  syncAiModels,
  updateAiModel,
  validateAiPolicy,
} from '@/services/myapp/ai-governance';
import { notifyMutationError } from '@/services/myapp/mutation';
import VectorReleases from './VectorReleases';

const { Paragraph, Text } = Typography;

const MODEL_STATUS: Record<string, { color: string; text: string }> = {
  active: { color: 'success', text: '启用' },
  degraded: { color: 'warning', text: '降级' },
  disabled: { color: 'default', text: '停用' },
  discovered: { color: 'processing', text: '已发现' },
  retired: { color: 'default', text: '已退役' },
  validated: { color: 'cyan', text: '已验证' },
};

const POLICY_STATUS: Record<string, { color: string; text: string }> = {
  active: { color: 'success', text: '已发布' },
  approved: { color: 'cyan', text: '已审批' },
  draft: { color: 'default', text: '草稿' },
  review_required: { color: 'processing', text: '待审批' },
  superseded: { color: 'default', text: '已替代' },
};

const SCENARIOS = [
  'general',
  'product_search',
  'order_query',
  'report_summary',
  'sales_order_draft',
  'purchase_order_draft',
  'inventory_adjustment_draft',
];
const CAPABILITIES = [
  'fast_chat',
  'reasoning',
  'structured',
  'vision',
  'embedding',
  'rerank',
];

function StatusTag({
  status,
  policy = false,
}: {
  status: string;
  policy?: boolean;
}) {
  const item = (policy ? POLICY_STATUS : MODEL_STATUS)[status] ?? {
    color: 'default',
    text: status || '未知',
  };
  return <Tag color={item.color}>{item.text}</Tag>;
}

function formatCost(value: number, currency?: string | null) {
  return `${value.toFixed(6)} ${currency || '-'}/百万 Token`;
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <Paragraph
      copyable
      style={{ marginBottom: 0, maxHeight: 240, overflow: 'auto' }}
    >
      <pre style={{ whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(value ?? {}, null, 2)}
      </pre>
    </Paragraph>
  );
}

export default function AiModelGovernancePage() {
  const access = useAccess() as Record<string, boolean>;
  const modelActionRef = useRef<ActionType | undefined>(undefined);
  const policyActionRef = useRef<ActionType | undefined>(undefined);
  const usageActionRef = useRef<ActionType | undefined>(undefined);
  const [modelForm] = Form.useForm();
  const [policyForm] = Form.useForm();
  const [actionForm] = Form.useForm();
  const [editingModel, setEditingModel] = useState<AiModel | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<AiPolicy | null>(null);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [policyDetail, setPolicyDetail] = useState<{
    policy: AiPolicy;
    versions: AiPolicyVersion[];
  } | null>(null);
  const [policyAction, setPolicyAction] = useState<{
    kind: 'approve' | 'publish' | 'rollback';
    policy: AiPolicy;
    targetVersion?: number;
  } | null>(null);

  const {
    data: overview,
    refresh: refreshOverview,
    loading: overviewLoading,
  } = useRequest(getAiGovernanceOverview, {
    formatResult: (result) => result,
  });
  const { data: modelOptionsResult, refresh: refreshModelOptions } = useRequest(
    () => listAiModels({ current: 1, pageSize: 100 }),
    { formatResult: (result) => result },
  );
  const modelOptions = useMemo(
    () =>
      (modelOptionsResult?.items ?? []).map((model) => ({
        label: `${model.modelAlias} · ${model.capability}`,
        value: model.modelAlias,
      })),
    [modelOptionsResult],
  );

  const reloadGovernance = () => {
    refreshOverview();
    refreshModelOptions();
    modelActionRef.current?.reload();
    policyActionRef.current?.reload();
    usageActionRef.current?.reload();
  };

  const openPolicyDetail = async (policy: AiPolicy) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      setPolicyDetail(await getAiPolicy(policy.policyCode));
    } catch (error) {
      notifyMutationError(error);
    } finally {
      setDetailLoading(false);
    }
  };

  const openPolicyEditor = (policy?: AiPolicy) => {
    setEditingPolicy(policy ?? null);
    policyForm.setFieldsValue(
      policy
        ? {
            ...policy,
            effectiveRange:
              policy.effectiveFrom || policy.effectiveTo
                ? [
                    policy.effectiveFrom ? dayjs(policy.effectiveFrom) : null,
                    policy.effectiveTo ? dayjs(policy.effectiveTo) : null,
                  ]
                : undefined,
          }
        : {
            budgetAction: 'warn',
            capability: 'fast_chat',
            companyScope: [],
            dailyBudget: 0,
            environment: 'development',
            fallbackModelAliases: [],
            maxCompletionTokens: 2048,
            maxConcurrency: 0,
            monthlyBudget: 0,
            reasoningEffort: 'none',
            requestsPerMinute: 0,
            roleScope: [],
            rolloutPercentage: 100,
            scenario: 'general',
            timeoutSeconds: 60,
            tokensPerMinute: 0,
          },
    );
    setPolicyModalOpen(true);
  };

  const executePolicyAction = async (values: { reason: string }) => {
    if (!policyAction) return;
    try {
      if (policyAction.kind === 'approve') {
        await approveAiPolicy(policyAction.policy.policyCode, values.reason);
      } else if (policyAction.kind === 'publish') {
        await publishAiPolicy(policyAction.policy.policyCode, values.reason);
      } else if (policyAction.targetVersion) {
        await rollbackAiPolicy(
          policyAction.policy.policyCode,
          policyAction.targetVersion,
          values.reason,
        );
      }
      setPolicyAction(null);
      actionForm.resetFields();
      reloadGovernance();
      if (detailOpen) {
        await openPolicyDetail(policyAction.policy);
      }
    } catch (error) {
      notifyMutationError(error);
    }
  };

  const modelColumns: ProColumns<AiModel>[] = [
    { title: '模型', dataIndex: 'search', hideInTable: true },
    {
      title: '模型别名',
      dataIndex: 'modelAlias',
      width: 220,
      search: false,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{row.modelAlias}</Text>
          <Text type="secondary">
            {row.providerModelDisplay || row.providerFamily || '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: '能力',
      dataIndex: 'capability',
      valueType: 'select',
      valueEnum: Object.fromEntries(
        CAPABILITIES.map((value) => [value, { text: value }]),
      ),
      width: 130,
      render: (_, row) => <Tag color="blue">{row.capability}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: Object.fromEntries(
        Object.entries(MODEL_STATUS).map(([key, value]) => [
          key,
          { text: value.text },
        ]),
      ),
      width: 110,
      render: (_, row) => <StatusTag status={row.status} />,
    },
    {
      title: '治理元数据',
      search: false,
      width: 230,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Text>区域：{row.dataRegion || '未复核'}</Text>
          <Text>留存：{row.retentionPolicy || '未登记'}</Text>
          <Text type={row.sensitiveDataAllowed ? 'danger' : 'secondary'}>
            敏感数据：{row.sensitiveDataAllowed ? '允许' : '禁止'}
          </Text>
        </Space>
      ),
    },
    {
      title: '成本',
      search: false,
      width: 220,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Text>输入：{formatCost(row.inputCost, row.currency)}</Text>
          <Text>输出：{formatCost(row.outputCost, row.currency)}</Text>
        </Space>
      ),
    },
    {
      title: '健康',
      search: false,
      width: 180,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Text>{row.lastHealthStatus || '-'}</Text>
          <Text type="secondary">{row.lastHealthAt || '-'}</Text>
        </Space>
      ),
    },
    { title: '版本', dataIndex: 'registryVersion', search: false, width: 80 },
    {
      title: '操作',
      valueType: 'option',
      width: 90,
      render: (_, row) =>
        access.canManageAiGovernance
          ? [
              <a
                key="edit"
                onClick={() => {
                  setEditingModel(row);
                  modelForm.setFieldsValue({
                    ...row,
                    reason: undefined,
                  });
                }}
              >
                编辑
              </a>,
            ]
          : [],
    },
  ];

  const policyColumns: ProColumns<AiPolicy>[] = [
    { title: '策略', dataIndex: 'search', hideInTable: true },
    {
      title: '策略',
      dataIndex: 'policyName',
      search: false,
      width: 240,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <a onClick={() => openPolicyDetail(row)}>{row.policyName}</a>
          <Text type="secondary">{row.policyCode}</Text>
        </Space>
      ),
    },
    { title: '场景', dataIndex: 'scenario', search: false, width: 180 },
    { title: '环境', dataIndex: 'environment', search: false, width: 110 },
    {
      title: '模型链',
      search: false,
      width: 250,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{row.primaryModelAlias}</Text>
          <Text type="secondary">
            {row.fallbackModelAliases.length
              ? `降级：${row.fallbackModelAliases.join(' → ')}`
              : '无降级模型'}
          </Text>
        </Space>
      ),
    },
    {
      title: '预算与限流',
      search: false,
      width: 230,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Text>
            日/月：{row.dailyBudget}/{row.monthlyBudget}{' '}
            {row.budgetCurrency || '-'}
          </Text>
          <Text type="secondary">
            RPM {row.requestsPerMinute || '-'} / TPM{' '}
            {row.tokensPerMinute || '-'} / 并发 {row.maxConcurrency || '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: Object.fromEntries(
        Object.entries(POLICY_STATUS).map(([key, value]) => [
          key,
          { text: value.text },
        ]),
      ),
      width: 110,
      render: (_, row) => <StatusTag policy status={row.status} />,
    },
    {
      title: '版本',
      search: false,
      width: 110,
      render: (_, row) =>
        `v${row.currentVersion}${row.publishedVersion ? ` / 发布 v${row.publishedVersion}` : ''}`,
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 220,
      render: (_, row) => {
        const actions = [
          <a key="detail" onClick={() => openPolicyDetail(row)}>
            版本
          </a>,
        ];
        if (access.canManageAiGovernance) {
          actions.push(
            <a key="edit" onClick={() => openPolicyEditor(row)}>
              编辑
            </a>,
          );
          actions.push(
            <a
              key="validate"
              onClick={async () => {
                try {
                  await validateAiPolicy(row.policyCode);
                  reloadGovernance();
                } catch (error) {
                  notifyMutationError(error);
                }
              }}
            >
              校验
            </a>,
          );
        }
        if (access.canApproveAiGovernance && row.status === 'review_required') {
          actions.push(
            <a
              key="approve"
              onClick={() => setPolicyAction({ kind: 'approve', policy: row })}
            >
              审批
            </a>,
          );
        }
        if (access.canPublishAiGovernance && row.status === 'approved') {
          actions.push(
            <a
              key="publish"
              onClick={() => setPolicyAction({ kind: 'publish', policy: row })}
            >
              发布
            </a>,
          );
        }
        return actions;
      },
    },
  ];

  const usageColumns: ProColumns<AiUsageDaily>[] = [
    {
      title: '日期',
      dataIndex: 'usageRange',
      valueType: 'dateRange',
      hideInTable: true,
    },
    {
      title: '环境',
      dataIndex: 'environment',
      valueType: 'select',
      valueEnum: {
        development: { text: 'development' },
        production: { text: 'production' },
        staging: { text: 'staging' },
        test: { text: 'test' },
      },
      width: 120,
    },
    { title: '公司', dataIndex: 'company', width: 150 },
    { title: '日期', dataIndex: 'usageDate', search: false, width: 110 },
    { title: '场景', dataIndex: 'scenario', search: false, width: 180 },
    { title: '模型', dataIndex: 'modelAlias', search: false, width: 210 },
    {
      title: '请求',
      search: false,
      width: 130,
      render: (_, row) => `${row.successCount}/${row.requestCount} 成功`,
    },
    { title: 'Token', dataIndex: 'totalTokens', search: false, width: 120 },
    {
      title: '成本',
      search: false,
      width: 130,
      render: (_, row) =>
        `${row.estimatedCost.toFixed(6)} ${row.costCurrency || '-'}`,
    },
    {
      title: '总延迟',
      search: false,
      width: 190,
      render: (_, row) =>
        `平均 ${row.latencyAvgMs?.toFixed(0) ?? '-'} / p50 ${row.latencyP50Ms ?? '-'} / p95 ${row.latencyP95Ms ?? '-'} ms`,
    },
    {
      title: '首 Token',
      search: false,
      width: 190,
      render: (_, row) =>
        `平均 ${row.firstTokenAvgMs?.toFixed(0) ?? '-'} / p50 ${row.firstTokenP50Ms ?? '-'} / p95 ${row.firstTokenP95Ms ?? '-'} ms`,
    },
    {
      title: '反馈',
      search: false,
      width: 150,
      render: (_, row) =>
        `${row.positiveFeedbackCount}👍 / ${row.negativeFeedbackCount}👎 / ${row.positiveFeedbackRate == null ? '-' : `${(row.positiveFeedbackRate * 100).toFixed(1)}%`}`,
    },
    { title: '降级', dataIndex: 'fallbackCount', search: false, width: 80 },
  ];

  const auditColumns: ProColumns<AiAuditEvent>[] = [
    { title: '时间', dataIndex: 'creation', valueType: 'dateTime', width: 180 },
    { title: '操作者', dataIndex: 'actor', width: 180 },
    { title: '动作', dataIndex: 'action', width: 180 },
    {
      title: '对象',
      render: (_, row) => `${row.objectType} / ${row.objectName}`,
    },
    {
      title: '级别',
      dataIndex: 'priority',
      width: 90,
      render: (_, row) => (
        <Tag color={row.priority === 'critical' ? 'red' : 'blue'}>
          {row.priority}
        </Tag>
      ),
    },
    { title: '原因', dataIndex: 'reason', ellipsis: true },
  ];

  const totalModels = Object.values(overview?.registryCounts ?? {}).reduce(
    (sum, count) => sum + count,
    0,
  );
  const totalPolicies = Object.values(overview?.policyCounts ?? {}).reduce(
    (sum, count) => sum + count,
    0,
  );

  return (
    <PageContainer
      title="AI 模型治理"
      subTitle="模型注册、策略版本、预算、发布回滚、用量与审计"
      extra={[
        <Button
          key="refresh"
          icon={<ReloadOutlined />}
          onClick={reloadGovernance}
        >
          刷新
        </Button>,
      ]}
    >
      <Space orientation="vertical" size="large" style={{ display: 'flex' }}>
        <Alert
          showIcon
          type="info"
          title="模型密钥不进入本页面；AI 不能越过 Frappe 权限或直接写正式业务单据。生产策略必须通过完整评测、双人审批和可回滚发布。"
        />
        <Row gutter={[16, 16]}>
          <Col xl={6} sm={12} xs={24}>
            <StatisticCard
              loading={overviewLoading}
              statistic={{
                title: '注册模型',
                value: totalModels,
                icon: <CloudSyncOutlined />,
              }}
            />
          </Col>
          <Col xl={6} sm={12} xs={24}>
            <StatisticCard
              loading={overviewLoading}
              statistic={{
                title: '已发布策略',
                value: overview?.policyCounts.active ?? 0,
                icon: <SafetyCertificateOutlined />,
              }}
            />
          </Col>
          <Col xl={6} sm={12} xs={24}>
            <StatisticCard
              loading={overviewLoading}
              statistic={{
                title: '待处理策略',
                value:
                  (overview?.policyCounts.draft ?? 0) +
                  (overview?.policyCounts.review_required ?? 0) +
                  (overview?.policyCounts.approved ?? 0),
                description: `策略总数 ${totalPolicies}`,
                icon: <ExperimentOutlined />,
              }}
            />
          </Col>
          <Col xl={6} sm={12} xs={24}>
            <StatisticCard
              loading={overviewLoading}
              statistic={{
                title: '近期关键审计',
                value:
                  overview?.recentAudits.filter(
                    (item) => item.priority === 'critical',
                  ).length ?? 0,
                icon: <HistoryOutlined />,
              }}
            />
          </Col>
        </Row>

        <Card variant="borderless">
          <Tabs
            items={[
              {
                key: 'models',
                label: '模型注册表',
                children: (
                  <ProTable<AiModel>
                    actionRef={modelActionRef}
                    rowKey="modelAlias"
                    columns={modelColumns}
                    cardBordered={false}
                    scroll={{ x: 1500 }}
                    request={async (params) => {
                      const result = await listAiModels({
                        capability: params.capability,
                        current: params.current,
                        pageSize: params.pageSize,
                        search: params.search,
                        status: params.status,
                      });
                      return {
                        data: result.items,
                        success: true,
                        total: result.total,
                      };
                    }}
                    toolBarRender={() =>
                      access.canManageAiGovernance
                        ? [
                            <Button
                              key="sync"
                              icon={<CloudSyncOutlined />}
                              onClick={async () => {
                                try {
                                  await syncAiModels();
                                  reloadGovernance();
                                } catch (error) {
                                  notifyMutationError(error);
                                }
                              }}
                            >
                              同步 LiteLLM
                            </Button>,
                          ]
                        : []
                    }
                  />
                ),
              },
              {
                key: 'policies',
                label: '场景策略',
                children: (
                  <ProTable<AiPolicy>
                    actionRef={policyActionRef}
                    rowKey="policyCode"
                    columns={policyColumns}
                    cardBordered={false}
                    scroll={{ x: 1650 }}
                    request={async (params) => {
                      const result = await listAiPolicies({
                        current: params.current,
                        pageSize: params.pageSize,
                        search: params.search,
                        status: params.status,
                      });
                      return {
                        data: result.items,
                        success: true,
                        total: result.total,
                      };
                    }}
                    toolBarRender={() =>
                      access.canManageAiGovernance
                        ? [
                            <Button
                              key="new"
                              type="primary"
                              icon={<PlusOutlined />}
                              onClick={() => openPolicyEditor()}
                            >
                              新建策略草稿
                            </Button>,
                          ]
                        : []
                    }
                  />
                ),
              },
              {
                key: 'usage',
                label: '预算与用量',
                children: (
                  <ProTable<AiUsageDaily>
                    actionRef={usageActionRef}
                    rowKey={(row) =>
                      `${row.usageDate}-${row.environment}-${row.company}-${row.scenario}-${row.policyCode}-${row.policyVersion}-${row.modelAlias}`
                    }
                    columns={usageColumns}
                    cardBordered={false}
                    scroll={{ x: 1750 }}
                    pagination={false}
                    request={async (params) => {
                      const range = params.usageRange as unknown as
                        | string[]
                        | undefined;
                      const items = await getAiUsage({
                        company: params.company,
                        dateFrom: range?.[0],
                        dateTo: range?.[1],
                        environment: params.environment,
                      });
                      return {
                        data: items,
                        success: true,
                        total: items.length,
                      };
                    }}
                  />
                ),
              },
              {
                key: 'vector-releases',
                label: 'Embedding 发布',
                children: (
                  <VectorReleases
                    access={access}
                    models={modelOptionsResult?.items ?? []}
                    onChanged={reloadGovernance}
                  />
                ),
              },
              {
                key: 'audit',
                label: '近期审计',
                children: (
                  <ProTable<AiAuditEvent>
                    rowKey={(row) =>
                      `${row.creation}-${row.action}-${row.objectName}`
                    }
                    columns={auditColumns}
                    cardBordered={false}
                    dataSource={overview?.recentAudits ?? []}
                    search={false}
                    pagination={false}
                  />
                ),
              },
            ]}
          />
        </Card>
      </Space>

      <Modal
        title={`维护模型治理元数据 · ${editingModel?.modelAlias ?? ''}`}
        open={Boolean(editingModel)}
        onCancel={() => setEditingModel(null)}
        onOk={() => modelForm.submit()}
        destroyOnHidden
      >
        <Form
          form={modelForm}
          layout="vertical"
          onFinish={async (values) => {
            if (!editingModel) return;
            try {
              await updateAiModel(
                editingModel.modelAlias,
                values,
                values.reason,
              );
              setEditingModel(null);
              modelForm.resetFields();
              reloadGovernance();
            } catch (error) {
              notifyMutationError(error);
            }
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="status"
                label="治理状态"
                rules={[{ required: true }]}
              >
                <Select
                  options={[
                    'validated',
                    'active',
                    'degraded',
                    'disabled',
                    'retired',
                  ].map((value) => ({
                    label: MODEL_STATUS[value]?.text ?? value,
                    value,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="currency" label="成本币种">
                <Input placeholder="CNY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="dataRegion"
                label="数据区域"
                rules={[{ required: true }]}
              >
                <Input placeholder="例如 cn-east / ap-southeast" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="retentionPolicy"
                label="留存策略"
                rules={[{ required: true }]}
              >
                <Input placeholder="例如 no-training-30d" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="inputCost" label="输入成本 / 百万 Token">
                <InputNumber min={0} precision={9} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="outputCost" label="输出成本 / 百万 Token">
                <InputNumber min={0} precision={9} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="sensitiveDataAllowed"
                label="允许敏感数据"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="reason"
                label="变更原因"
                rules={[{ required: true }]}
              >
                <Input.TextArea rows={3} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={
          editingPolicy
            ? `编辑策略 · ${editingPolicy.policyCode}`
            : '新建策略草稿'
        }
        width={960}
        open={policyModalOpen}
        onCancel={() => setPolicyModalOpen(false)}
        onOk={() => policyForm.submit()}
        destroyOnHidden
      >
        <Form
          form={policyForm}
          layout="vertical"
          onFinish={async (values) => {
            const effectiveRange = values.effectiveRange as
              | [Dayjs | null, Dayjs | null]
              | undefined;
            const draft: AiPolicyDraftInput = {
              budgetAction: values.budgetAction,
              budgetCurrency: values.budgetCurrency || null,
              capability: values.capability,
              companyScope: values.companyScope ?? [],
              dailyBudget: values.dailyBudget ?? 0,
              effectiveFrom: effectiveRange?.[0]?.toISOString() ?? null,
              effectiveTo: effectiveRange?.[1]?.toISOString() ?? null,
              environment: values.environment,
              fallbackModelAliases: values.fallbackModelAliases ?? [],
              maxCompletionTokens: values.maxCompletionTokens ?? 0,
              maxConcurrency: values.maxConcurrency ?? 0,
              monthlyBudget: values.monthlyBudget ?? 0,
              policyCode: values.policyCode,
              policyName: values.policyName,
              primaryModelAlias: values.primaryModelAlias,
              reasoningEffort: values.reasoningEffort || null,
              requestsPerMinute: values.requestsPerMinute ?? 0,
              roleScope: values.roleScope ?? [],
              rolloutPercentage: values.rolloutPercentage ?? 100,
              rolloutSeed: values.rolloutSeed || null,
              scenario: values.scenario,
              timeoutSeconds: values.timeoutSeconds ?? 60,
              tokensPerMinute: values.tokensPerMinute ?? 0,
            };
            try {
              await saveAiPolicyDraft(draft, values.reason);
              setPolicyModalOpen(false);
              policyForm.resetFields();
              reloadGovernance();
            } catch (error) {
              notifyMutationError(error);
            }
          }}
        >
          <Row gutter={16}>
            <Col md={12} xs={24}>
              <Form.Item
                name="policyCode"
                label="策略编码"
                rules={[{ required: true }]}
              >
                <Input disabled={Boolean(editingPolicy)} />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item
                name="policyName"
                label="策略名称"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col md={8} xs={24}>
              <Form.Item
                name="scenario"
                label="场景"
                rules={[{ required: true }]}
              >
                <Select
                  options={SCENARIOS.map((value) => ({ label: value, value }))}
                />
              </Form.Item>
            </Col>
            <Col md={8} xs={24}>
              <Form.Item
                name="capability"
                label="能力"
                rules={[{ required: true }]}
              >
                <Select
                  options={CAPABILITIES.map((value) => ({
                    label: value,
                    value,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col md={8} xs={24}>
              <Form.Item
                name="environment"
                label="环境"
                rules={[{ required: true }]}
              >
                <Select
                  options={['development', 'test', 'staging', 'production'].map(
                    (value) => ({
                      label: value,
                      value,
                    }),
                  )}
                />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item name="companyScope" label="公司范围">
                <Select mode="tags" tokenSeparators={[',']} />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item name="roleScope" label="角色范围">
                <Select mode="tags" tokenSeparators={[',']} />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item
                name="primaryModelAlias"
                label="主模型"
                rules={[{ required: true }]}
              >
                <Select showSearch options={modelOptions} />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item name="fallbackModelAliases" label="降级链">
                <Select mode="multiple" showSearch options={modelOptions} />
              </Form.Item>
            </Col>
            <Col md={8} xs={24}>
              <Form.Item name="reasoningEffort" label="推理等级">
                <Select
                  options={['none', 'low', 'medium', 'high'].map((value) => ({
                    label: value,
                    value,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col md={8} xs={24}>
              <Form.Item name="maxCompletionTokens" label="最大输出 Token">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col md={8} xs={24}>
              <Form.Item name="timeoutSeconds" label="超时秒数">
                <InputNumber min={1} max={600} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col md={8} xs={24}>
              <Form.Item name="maxConcurrency" label="最大并发">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col md={8} xs={24}>
              <Form.Item name="requestsPerMinute" label="RPM">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col md={8} xs={24}>
              <Form.Item name="tokensPerMinute" label="TPM">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col md={8} xs={24}>
              <Form.Item name="dailyBudget" label="日预算">
                <InputNumber min={0} precision={6} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col md={8} xs={24}>
              <Form.Item name="monthlyBudget" label="月预算">
                <InputNumber min={0} precision={6} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col md={8} xs={24}>
              <Form.Item name="budgetCurrency" label="预算币种">
                <Input placeholder="CNY" />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item name="budgetAction" label="预算动作">
                <Select
                  options={[
                    { label: '告警但继续', value: 'warn' },
                    {
                      label: '切换低成本模型',
                      value: 'use_lower_cost_fallback',
                    },
                    { label: '拒绝非关键请求', value: 'reject_noncritical' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item name="rolloutPercentage" label="灰度比例 %">
                <InputNumber
                  min={0}
                  max={100}
                  precision={2}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item name="rolloutSeed" label="灰度种子">
                <Input />
              </Form.Item>
            </Col>
            <Col md={12} xs={24}>
              <Form.Item name="effectiveRange" label="生效区间">
                <DatePicker.RangePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="reason"
                label="版本变更原因"
                rules={[{ required: true }]}
              >
                <Input.TextArea rows={3} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Drawer
        title={`策略版本 · ${policyDetail?.policy.policyCode ?? ''}`}
        width={900}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        loading={detailLoading}
      >
        {policyDetail ? (
          <Space
            orientation="vertical"
            size="large"
            style={{ display: 'flex' }}
          >
            <Descriptions
              bordered
              column={2}
              items={[
                {
                  key: 'name',
                  label: '策略',
                  children: policyDetail.policy.policyName,
                },
                {
                  key: 'status',
                  label: '状态',
                  children: (
                    <StatusTag policy status={policyDetail.policy.status} />
                  ),
                },
                {
                  key: 'scenario',
                  label: '场景',
                  children: policyDetail.policy.scenario,
                },
                {
                  key: 'env',
                  label: '环境',
                  children: policyDetail.policy.environment,
                },
                {
                  key: 'model',
                  label: '模型链',
                  span: 2,
                  children: [
                    policyDetail.policy.primaryModelAlias,
                    ...policyDetail.policy.fallbackModelAliases,
                  ].join(' → '),
                },
                {
                  key: 'scope',
                  label: '影响范围',
                  span: 2,
                  children: `公司 ${policyDetail.policy.companyScope.join(', ') || '全部'}；角色 ${policyDetail.policy.roleScope.join(', ') || '全部'}`,
                },
              ]}
            />
            <Table<AiPolicyVersion>
              rowKey="version"
              pagination={false}
              expandable={{
                expandedRowRender: (version) => (
                  <Tabs
                    size="small"
                    items={[
                      {
                        key: 'snapshot',
                        label: '策略快照',
                        children: <JsonBlock value={version.snapshot} />,
                      },
                      {
                        key: 'validation',
                        label: '校验',
                        children: <JsonBlock value={version.validation} />,
                      },
                      {
                        key: 'evaluation',
                        label: '评测',
                        children: <JsonBlock value={version.evaluation} />,
                      },
                    ]}
                  />
                ),
              }}
              columns={[
                {
                  title: '版本',
                  dataIndex: 'version',
                  render: (value) => `v${value}`,
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  render: (value) => (
                    <StatusTag policy status={String(value)} />
                  ),
                },
                { title: '创建人', dataIndex: 'createdBy' },
                {
                  title: '变更原因',
                  dataIndex: 'changeReason',
                  ellipsis: true,
                },
                { title: '发布时间', dataIndex: 'publishedAt' },
                {
                  title: '操作',
                  render: (_, version) =>
                    access.canPublishAiGovernance &&
                    version.version !== policyDetail.policy.publishedVersion &&
                    ['active', 'superseded'].includes(version.status) ? (
                      <Button
                        size="small"
                        icon={<RollbackOutlined />}
                        onClick={() =>
                          setPolicyAction({
                            kind: 'rollback',
                            policy: policyDetail.policy,
                            targetVersion: version.version,
                          })
                        }
                      >
                        回滚到此版本
                      </Button>
                    ) : null,
                },
              ]}
              dataSource={policyDetail.versions}
            />
          </Space>
        ) : null}
      </Drawer>

      <Modal
        title={
          policyAction?.kind === 'approve'
            ? '审批策略'
            : policyAction?.kind === 'publish'
              ? '发布策略'
              : `回滚到 v${policyAction?.targetVersion ?? ''}`
        }
        open={Boolean(policyAction)}
        onCancel={() => setPolicyAction(null)}
        onOk={() => actionForm.submit()}
        okButtonProps={{
          danger: policyAction?.kind === 'rollback',
          icon:
            policyAction?.kind === 'rollback' ? (
              <RollbackOutlined />
            ) : policyAction?.kind === 'publish' ? (
              <SafetyCertificateOutlined />
            ) : (
              <CheckCircleOutlined />
            ),
        }}
        destroyOnHidden
      >
        <Form
          form={actionForm}
          layout="vertical"
          onFinish={executePolicyAction}
        >
          <Alert
            type={policyAction?.kind === 'rollback' ? 'warning' : 'info'}
            showIcon
            title={`策略 ${policyAction?.policy.policyCode ?? ''}；操作会写入关键审计。`}
            style={{ marginBottom: 16 }}
          />
          <Form.Item
            name="reason"
            label="操作原因"
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
