import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  EditOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  RollbackOutlined,
  ScanOutlined,
} from '@ant-design/icons';
import {
  type ActionType,
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import {
  Alert,
  Button,
  Checkbox,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useMemo, useRef, useState } from 'react';
import { RemoteLinkSelect } from '@/components/RemoteLinkSelect';
import {
  type AiDataTask,
  analyzeAiProductData,
  createAiDataTask,
  executeAiDataTask,
  getAiDataTask,
  listAiDataTasks,
  reviewAiDataTask,
  rollbackAiDataTask,
} from '@/services/myapp/ai-governance';
import { notifyMutationError } from '@/services/myapp/mutation';

const { Paragraph, Text } = Typography;

const TASK_STATUS: Record<string, { color: string; text: string }> = {
  analyzed: { color: 'processing', text: '已分析' },
  approved: { color: 'cyan', text: '已审批' },
  executed: { color: 'success', text: '已执行' },
  failed: { color: 'error', text: '执行失败' },
  queued: { color: 'default', text: '排队中' },
  rejected: { color: 'error', text: '已驳回' },
  review_required: { color: 'warning', text: '待审批' },
  rolled_back: { color: 'default', text: '已回滚' },
};

const RISK_LEVEL: Record<string, { color: string; text: string }> = {
  high: { color: 'error', text: '高风险' },
  low: { color: 'success', text: '低风险' },
  medium: { color: 'warning', text: '中风险' },
};

const TASK_TYPE: Record<string, string> = {
  product_completeness: '商品资料完整性',
  product_field_update: '商品字段建议',
};

const FIELD_LABELS: Record<string, string> = {
  brand: '品牌',
  description: '商品描述',
  item_group: '商品组',
  item_name: '商品名称',
};

type CreateTaskFormValues = {
  brand?: string;
  description?: string;
  fields: string[];
  itemGroup?: string;
  itemName?: string;
  reason: string;
  targetName: string;
};

type ReviewFormValues = {
  reason: string;
};

type ScanFormValues = {
  itemCodes?: string;
  limit: number;
};

function StatusTag({ status }: { status: string }) {
  const item = TASK_STATUS[status] ?? {
    color: 'default',
    text: status || '未知',
  };
  return <Tag color={item.color}>{item.text}</Tag>;
}

function RiskTag({ risk }: { risk: string }) {
  const item = RISK_LEVEL[risk] ?? { color: 'default', text: risk || '未知' };
  return <Tag color={item.color}>{item.text}</Tag>;
}

function valueText(value: unknown) {
  if (value === undefined || value === null || value === '') return '（空）';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <Paragraph
      copyable
      style={{ marginBottom: 0, maxHeight: 260, overflow: 'auto' }}
    >
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(value ?? {}, null, 2)}
      </pre>
    </Paragraph>
  );
}

export default function AiDataTasksPage() {
  const access = useAccess() as Record<string, boolean>;
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [createForm] = Form.useForm<CreateTaskFormValues>();
  const [reviewForm] = Form.useForm<ReviewFormValues>();
  const [scanForm] = Form.useForm<ScanFormValues>();
  const [createOpen, setCreateOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<AiDataTask | null>(null);
  const [reviewAction, setReviewAction] = useState<{
    kind: 'approve' | 'reject' | 'rollback';
    task: AiDataTask;
  } | null>(null);
  const selectedFields = Form.useWatch('fields', createForm) ?? [];

  const comparisonRows = useMemo(() => {
    if (!detail) return [];
    const fields = Array.from(
      new Set([
        ...Object.keys(detail.beforeValue),
        ...Object.keys(detail.proposedValue),
      ]),
    );
    return fields.map((field) => ({
      before: detail.beforeValue[field],
      field,
      proposed: detail.proposedValue[field],
    }));
  }, [detail]);

  const refresh = () => actionRef.current?.reload();

  const openDetail = async (task: AiDataTask) => {
    setDetailOpen(true);
    setDetail(task);
    setDetailLoading(true);
    try {
      setDetail(await getAiDataTask(task.name));
    } catch (error) {
      notifyMutationError(error);
    } finally {
      setDetailLoading(false);
    }
  };

  const applyTaskResult = (task: AiDataTask) => {
    setDetail(task);
    refresh();
  };

  const executeTask = (task: AiDataTask) => {
    Modal.confirm({
      content:
        '系统会再次核对源数据是否漂移，并通过正式商品服务执行；审批人与执行人必须分离。',
      okText: '确认执行',
      onOk: async () => {
        try {
          const result = await executeAiDataTask(task.name);
          applyTaskResult(result.data);
        } catch (error) {
          notifyMutationError(error);
          throw error;
        }
      },
      title: `执行数据治理任务 ${task.name}？`,
    });
  };

  const taskActions = (task: AiDataTask) => (
    <Space size={4} wrap>
      <Button
        icon={<EyeOutlined />}
        onClick={() => void openDetail(task)}
        type="link"
      >
        详情
      </Button>
      {task.status === 'review_required' &&
      access.canApproveAiDataGovernance ? (
        <>
          <Button
            icon={<CheckCircleOutlined />}
            onClick={() => setReviewAction({ kind: 'approve', task })}
            type="link"
          >
            批准
          </Button>
          <Button
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => setReviewAction({ kind: 'reject', task })}
            type="link"
          >
            驳回
          </Button>
        </>
      ) : null}
      {task.status === 'approved' && access.canManageAiDataGovernance ? (
        <Button
          icon={<PlayCircleOutlined />}
          onClick={() => executeTask(task)}
          type="link"
        >
          执行
        </Button>
      ) : null}
      {task.status === 'executed' && access.canRollbackAiDataGovernance ? (
        <Button
          danger
          icon={<RollbackOutlined />}
          onClick={() => setReviewAction({ kind: 'rollback', task })}
          type="link"
        >
          回滚
        </Button>
      ) : null}
    </Space>
  );

  const columns: ProColumns<AiDataTask>[] = [
    {
      dataIndex: 'name',
      search: false,
      title: '任务',
      width: 250,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Text copyable strong>
            {row.name}
          </Text>
          <Text type="secondary">
            v{row.version} · {TASK_TYPE[row.taskType] ?? row.taskType}
          </Text>
        </Space>
      ),
    },
    {
      dataIndex: 'targetName',
      search: false,
      title: '目标商品',
      width: 190,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{row.targetName}</Text>
          <Text type="secondary">{row.targetDoctype}</Text>
        </Space>
      ),
    },
    {
      dataIndex: 'status',
      title: '状态',
      valueEnum: Object.fromEntries(
        Object.entries(TASK_STATUS).map(([key, value]) => [
          key,
          { text: value.text },
        ]),
      ),
      valueType: 'select',
      width: 115,
      render: (_, row) => <StatusTag status={row.status} />,
    },
    {
      dataIndex: 'riskLevel',
      title: '风险',
      valueEnum: Object.fromEntries(
        Object.entries(RISK_LEVEL).map(([key, value]) => [
          key,
          { text: value.text },
        ]),
      ),
      valueType: 'select',
      width: 110,
      render: (_, row) => <RiskTag risk={row.riskLevel} />,
    },
    {
      dataIndex: 'taskType',
      title: '任务类型',
      valueEnum: Object.fromEntries(
        Object.entries(TASK_TYPE).map(([key, value]) => [key, { text: value }]),
      ),
      valueType: 'select',
      width: 155,
      render: (_, row) => TASK_TYPE[row.taskType] ?? row.taskType,
    },
    {
      search: false,
      title: '建议字段',
      width: 220,
      render: (_, row) => (
        <Space size={[4, 4]} wrap>
          {Object.keys(row.proposedValue).map((field) => (
            <Tag key={field}>{FIELD_LABELS[field] ?? field}</Tag>
          ))}
        </Space>
      ),
    },
    {
      search: false,
      title: '职责链',
      width: 250,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Text>发起：{row.requestedBy || '-'}</Text>
          <Text>审批：{row.reviewer || '-'}</Text>
          <Text>执行：{row.executedBy || '-'}</Text>
        </Space>
      ),
    },
    {
      dataIndex: 'modified',
      search: false,
      title: '最后更新',
      valueType: 'dateTime',
      width: 180,
    },
    {
      fixed: 'right',
      search: false,
      title: '操作',
      valueType: 'option',
      width: 250,
      render: (_, row) => taskActions(row),
    },
  ];

  const submitCreate = async () => {
    const values = await createForm.validateFields();
    const proposedValue: Record<string, string> = {};
    for (const field of values.fields) {
      if (field === 'item_name') proposedValue[field] = values.itemName ?? '';
      if (field === 'description')
        proposedValue[field] = values.description ?? '';
      if (field === 'brand') proposedValue[field] = values.brand ?? '';
      if (field === 'item_group') proposedValue[field] = values.itemGroup ?? '';
    }
    try {
      await createAiDataTask(
        { proposedValue, targetName: values.targetName },
        values.reason,
      );
      setCreateOpen(false);
      createForm.resetFields();
      refresh();
    } catch (error) {
      notifyMutationError(error);
    }
  };

  const submitScan = async () => {
    const values = await scanForm.validateFields();
    const itemCodes = (values.itemCodes ?? '')
      .split(/[\s,，]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    try {
      await analyzeAiProductData(itemCodes, values.limit);
      setScanOpen(false);
      scanForm.resetFields();
      refresh();
    } catch (error) {
      notifyMutationError(error);
    }
  };

  const submitReview = async (values: ReviewFormValues) => {
    if (!reviewAction) return;
    try {
      const result =
        reviewAction.kind === 'rollback'
          ? await rollbackAiDataTask(reviewAction.task.name, values.reason)
          : await reviewAiDataTask(
              reviewAction.task.name,
              reviewAction.kind,
              values.reason,
            );
      applyTaskResult(result.data);
      setReviewAction(null);
      reviewForm.resetFields();
    } catch (error) {
      notifyMutationError(error);
    }
  };

  return (
    <PageContainer
      extra={[
        <Button icon={<ReloadOutlined />} key="reload" onClick={refresh}>
          刷新
        </Button>,
      ]}
      title="AI 数据治理任务"
    >
      <Alert
        description="首期仅治理 Item 的商品名称、描述、品牌和商品组。任务必须经过发起、审批、执行职责分离；AI 不直接写价格、库存、订单、发票或收付款数据。"
        message="受控建议、人工审批、正式服务执行、可审计回滚"
        showIcon
        style={{ marginBottom: 16 }}
        type="info"
      />

      <ProTable<AiDataTask>
        actionRef={actionRef}
        cardBordered
        columns={columns}
        request={async (params) => {
          const result = await listAiDataTasks({
            current: params.current,
            pageSize: params.pageSize,
            riskLevel: params.riskLevel,
            status: params.status,
            taskType: params.taskType,
          });
          return { data: result.items, success: true, total: result.total };
        }}
        rowKey="name"
        scroll={{ x: 1700 }}
        search={{ labelWidth: 'auto' }}
        toolBarRender={() =>
          access.canManageAiDataGovernance
            ? [
                <Button
                  icon={<ScanOutlined />}
                  key="scan"
                  onClick={() => {
                    scanForm.setFieldsValue({ limit: 50 });
                    setScanOpen(true);
                  }}
                >
                  扫描缺失描述
                </Button>,
                <Button
                  icon={<EditOutlined />}
                  key="create"
                  onClick={() => {
                    createForm.setFieldsValue({ fields: ['description'] });
                    setCreateOpen(true);
                  }}
                  type="primary"
                >
                  新建字段建议
                </Button>,
              ]
            : []
        }
      />

      <Drawer
        extra={detail ? taskActions(detail) : null}
        loading={detailLoading}
        onClose={() => setDetailOpen(false)}
        open={detailOpen}
        title={detail ? `数据治理任务 ${detail.name}` : '数据治理任务'}
        width={960}
      >
        {detail ? (
          <Space orientation="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="状态">
                <StatusTag status={detail.status} />
              </Descriptions.Item>
              <Descriptions.Item label="风险">
                <RiskTag risk={detail.riskLevel} />
              </Descriptions.Item>
              <Descriptions.Item label="目标商品">
                {detail.targetName}
              </Descriptions.Item>
              <Descriptions.Item label="任务类型">
                {TASK_TYPE[detail.taskType] ?? detail.taskType}
              </Descriptions.Item>
              <Descriptions.Item label="发起人">
                {detail.requestedBy || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="审批人">
                {detail.reviewer || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="执行人">
                {detail.executedBy || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="回滚人">
                {detail.rollbackBy || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="模型 / 规则">
                {detail.modelAlias || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Prompt 版本">
                {detail.promptVersion || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="审批说明" span={2}>
                {detail.reviewReason || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="回滚说明" span={2}>
                {detail.rollbackReason || '-'}
              </Descriptions.Item>
            </Descriptions>

            <Table
              columns={[
                {
                  dataIndex: 'field',
                  title: '字段',
                  width: 150,
                  render: (field: string) => FIELD_LABELS[field] ?? field,
                },
                {
                  dataIndex: 'before',
                  title: '变更前',
                  render: (value: unknown) => (
                    <Paragraph
                      style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}
                    >
                      {valueText(value)}
                    </Paragraph>
                  ),
                },
                {
                  dataIndex: 'proposed',
                  title: '建议值',
                  render: (value: unknown) => (
                    <Paragraph
                      style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}
                    >
                      {valueText(value)}
                    </Paragraph>
                  ),
                },
              ]}
              dataSource={comparisonRows}
              pagination={false}
              rowKey="field"
              scroll={{ x: 720 }}
              size="small"
              title={() => <Text strong>字段变更对比</Text>}
            />

            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="证据">
                <JsonBlock value={detail.evidence} />
              </Descriptions.Item>
              <Descriptions.Item label="分析与安全边界">
                <JsonBlock value={detail.analysis} />
              </Descriptions.Item>
              {detail.executionResult ? (
                <Descriptions.Item label="执行结果">
                  <JsonBlock value={detail.executionResult} />
                </Descriptions.Item>
              ) : null}
              {detail.rollbackResult ? (
                <Descriptions.Item label="回滚结果">
                  <JsonBlock value={detail.rollbackResult} />
                </Descriptions.Item>
              ) : null}
            </Descriptions>
          </Space>
        ) : null}
      </Drawer>

      <Modal
        destroyOnHidden
        okText="创建并送审"
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
        }}
        onOk={() => void submitCreate()}
        open={createOpen}
        title="新建商品字段治理建议"
        width={720}
      >
        <Alert
          description="这里创建的是待审批建议，不会立即修改商品。可清空描述或品牌；商品名称和商品组选择后不能为空。"
          showIcon
          style={{ marginBottom: 16 }}
          type="warning"
        />
        <Form form={createForm} layout="vertical">
          <Form.Item
            label="目标商品"
            name="targetName"
            rules={[{ message: '请选择目标商品', required: true }]}
          >
            <RemoteLinkSelect doctype="Item" placeholder="搜索商品编码或名称" />
          </Form.Item>
          <Form.Item
            label="建议修改字段"
            name="fields"
            rules={[
              {
                message: '至少选择一个治理字段',
                required: true,
                type: 'array',
              },
            ]}
          >
            <Checkbox.Group
              options={[
                { label: '商品名称', value: 'item_name' },
                { label: '商品描述', value: 'description' },
                { label: '品牌', value: 'brand' },
                { label: '商品组', value: 'item_group' },
              ]}
            />
          </Form.Item>
          {selectedFields.includes('item_name') ? (
            <Form.Item
              label="建议商品名称"
              name="itemName"
              rules={[{ message: '商品名称不能为空', required: true }]}
            >
              <Input maxLength={255} />
            </Form.Item>
          ) : null}
          {selectedFields.includes('description') ? (
            <Form.Item label="建议商品描述" name="description">
              <Input.TextArea maxLength={2000} rows={4} showCount />
            </Form.Item>
          ) : null}
          {selectedFields.includes('brand') ? (
            <Form.Item label="建议品牌" name="brand">
              <RemoteLinkSelect
                doctype="Brand"
                placeholder="选择品牌；留空表示清空"
              />
            </Form.Item>
          ) : null}
          {selectedFields.includes('item_group') ? (
            <Form.Item
              label="建议商品组"
              name="itemGroup"
              rules={[{ message: '商品组不能为空', required: true }]}
            >
              <RemoteLinkSelect doctype="Item Group" placeholder="选择商品组" />
            </Form.Item>
          ) : null}
          <Form.Item
            label="创建原因"
            name="reason"
            rules={[{ message: '请说明建议依据和业务原因', required: true }]}
          >
            <Input.TextArea maxLength={1000} rows={3} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        destroyOnHidden
        okText="开始扫描"
        onCancel={() => {
          setScanOpen(false);
          scanForm.resetFields();
        }}
        onOk={() => void submitScan()}
        open={scanOpen}
        title="扫描缺失商品描述"
      >
        <Form form={scanForm} layout="vertical">
          <Form.Item
            extra="留空时扫描最近修改且描述为空的启用商品；多个编码可用逗号、空格或换行分隔。"
            label="限定商品编码"
            name="itemCodes"
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item
            label="最大任务数"
            name="limit"
            rules={[{ message: '请输入 1 到 100', required: true }]}
          >
            <InputNumber
              max={100}
              min={1}
              precision={0}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        destroyOnHidden
        okButtonProps={{ danger: reviewAction?.kind !== 'approve' }}
        okText={
          reviewAction?.kind === 'approve'
            ? '批准任务'
            : reviewAction?.kind === 'reject'
              ? '驳回任务'
              : '确认回滚'
        }
        onCancel={() => {
          setReviewAction(null);
          reviewForm.resetFields();
        }}
        onOk={() => reviewForm.submit()}
        open={Boolean(reviewAction)}
        title={
          reviewAction?.kind === 'approve'
            ? '审批通过数据治理任务'
            : reviewAction?.kind === 'reject'
              ? '驳回数据治理任务'
              : '回滚已执行的数据治理任务'
        }
      >
        <Alert
          description={
            reviewAction?.kind === 'rollback'
              ? '仅当商品仍保持任务建议值时才能自动回滚，后续人工变更不会被覆盖。'
              : '后端会校验任务发起人与审批人分离；批准后仍需由不同的数据管理员执行。'
          }
          icon={<DatabaseOutlined />}
          showIcon
          style={{ marginBottom: 16 }}
          type={reviewAction?.kind === 'approve' ? 'info' : 'warning'}
        />
        <Form
          form={reviewForm}
          layout="vertical"
          onFinish={(values) => void submitReview(values)}
        >
          <Form.Item
            label="原因与依据"
            name="reason"
            rules={[{ message: '请填写审批或回滚原因', required: true }]}
          >
            <Input.TextArea maxLength={1000} rows={4} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
