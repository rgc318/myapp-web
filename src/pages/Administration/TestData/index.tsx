import {
  CheckCircleOutlined,
  DatabaseOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import {
  type ActionType,
  PageContainer,
  ProCard,
  type ProColumns,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { useAccess } from '@umijs/max';
import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { RemoteLinkSelect } from '@/components/RemoteLinkSelect';
import { useWorkspacePreferences } from '@/hooks/useWorkspacePreferences';
import { notifyMutationError } from '@/services/myapp/mutation';
import {
  type CompanyTransactionResetPreview,
  type CompanyTransactionResetRecord,
  getCompanyTransactionReset,
  getTestDatasetRun,
  listTestDatasetRuns,
  listTestDatasets,
  previewCompanyTransactionReset,
  previewTestDataset,
  requestCompanyTransactionReset,
  requestTestDatasetRun,
  type TestDatasetAction,
  type TestDatasetDefinition,
  type TestDatasetPreview,
  type TestDatasetRun,
  type TestDatasetScale,
  type TestDatasetScenario,
  type TestDatasetValidation,
  validateTestDataset,
} from '@/services/myapp/test-data';

const { Paragraph, Text, Title } = Typography;

type FormValues = {
  action: TestDatasetAction;
  baseDate: Dayjs;
  company: string;
  datasetCode: string;
  seed: number;
  scale: TestDatasetScale;
  scenarioKeys?: string[];
  warehouse: string;
};

const STATUS: Record<string, { color: string; label: string }> = {
  cancelled: { color: 'default', label: '已取消' },
  completed: { color: 'success', label: '已完成' },
  failed: { color: 'error', label: '失败' },
  queued: { color: 'default', label: '排队中' },
  running: { color: 'processing', label: '执行中' },
  validating: { color: 'warning', label: '验证中' },
};

const CHECK_LABELS: Record<string, string> = {
  general_ledger_balanced: '总账借贷平衡',
  generated_stock_non_negative: '测试商品库存非负',
  invoice_outstanding_valid: '发票未结金额合法',
  registered_documents_exist: '登记对象完整存在',
  uom_conversion_consistent: '单位换算一致',
};

function StatusTag({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const value = STATUS[normalized] ?? {
    color: 'default',
    label: status || '未知',
  };
  return <Tag color={value.color}>{value.label}</Tag>;
}

function actionLabel(action: TestDatasetAction) {
  if (action === 'reset') return '清理并重建';
  if (action === 'supplement') return '补充场景';
  return '首次生成';
}

const SCENARIO_STATE_LABELS: Record<string, string> = {
  complete: '完整闭环',
  order_only: '仅订单',
  paid_invoice: '已开票已付款',
  partial_delivery: '部分发货',
  partial_paid: '部分付款',
  received: '已收货',
  unpaid_invoice: '已开票未付款',
};

const SCALE_OPTIONS: Array<{
  description: string;
  label: string;
  value: TestDatasetScale;
}> = [
  { description: '1 份场景，适合日常功能测试', label: '小型', value: 'small' },
  {
    description: '5 份场景，适合列表与批量测试',
    label: '中型',
    value: 'medium',
  },
  {
    description: '20 份场景，适合性能与容量测试',
    label: '大型',
    value: 'large',
  },
];

function scaleLabel(scale: TestDatasetScale) {
  return SCALE_OPTIONS.find((item) => item.value === scale)?.label ?? scale;
}

function scenarioLabel(scenario: TestDatasetScenario) {
  const domain = scenario.domain === 'purchase' ? '采购' : '销售';
  return `${domain} · ${SCENARIO_STATE_LABELS[scenario.state] ?? scenario.state} · ${scenario.key}`;
}

export default function TestDataPage() {
  const access = useAccess() as Record<string, boolean>;
  const { defaultCompany, defaultWarehouse } = useWorkspacePreferences();
  const [form] = Form.useForm<FormValues>();
  const company = Form.useWatch('company', form);
  const selectedAction = Form.useWatch('action', form);
  const selectedDatasetCode = Form.useWatch('datasetCode', form);
  const selectedScale = Form.useWatch('scale', form);
  const actionRef = useRef<ActionType | undefined>(undefined);
  const terminalRunRef = useRef<string | null>(null);
  const [datasets, setDatasets] = useState<TestDatasetDefinition[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [preview, setPreview] = useState<TestDatasetPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentRun, setCurrentRun] = useState<TestDatasetRun | null>(null);
  const [validation, setValidation] = useState<TestDatasetValidation | null>(
    null,
  );
  const [companyResetPreview, setCompanyResetPreview] =
    useState<CompanyTransactionResetPreview | null>(null);
  const [companyResetRecord, setCompanyResetRecord] =
    useState<CompanyTransactionResetRecord | null>(null);
  const [companyResetLoading, setCompanyResetLoading] = useState(false);
  const [companyResetModalOpen, setCompanyResetModalOpen] = useState(false);
  const [companyResetConfirmation, setCompanyResetConfirmation] = useState('');
  const [companyResetAcknowledged, setCompanyResetAcknowledged] =
    useState(false);
  const selectedDataset = useMemo(
    () => datasets.find((dataset) => dataset.code === selectedDatasetCode),
    [datasets, selectedDatasetCode],
  );

  useEffect(() => {
    setCatalogLoading(true);
    listTestDatasets()
      .then((items) => {
        setDatasets(items);
        if (!form.getFieldValue('datasetCode') && items[0]) {
          form.setFieldValue('datasetCode', items[0].code);
        }
      })
      .catch(notifyMutationError)
      .finally(() => setCatalogLoading(false));
  }, [form]);

  useEffect(() => {
    if (!form.getFieldValue('company') && defaultCompany) {
      form.setFieldValue('company', defaultCompany);
    }
    if (!form.getFieldValue('warehouse') && defaultWarehouse) {
      form.setFieldValue('warehouse', defaultWarehouse);
    }
  }, [defaultCompany, defaultWarehouse, form]);

  useEffect(() => {
    setPreview(null);
    setValidation(null);
    if (selectedAction !== 'supplement') {
      form.setFieldValue('scenarioKeys', undefined);
    }
  }, [form, selectedAction, selectedDatasetCode, selectedScale]);

  const loadPreview = async (values?: FormValues) => {
    const resolved = values ?? (await form.validateFields());
    setPreviewLoading(true);
    setValidation(null);
    try {
      const result = await previewTestDataset({
        action: resolved.action,
        baseDate: resolved.baseDate.format('YYYY-MM-DD'),
        company: resolved.company,
        datasetCode: resolved.datasetCode,
        seed: resolved.seed,
        scale: resolved.scale,
        scenarioKeys: resolved.scenarioKeys,
        warehouse: resolved.warehouse,
      });
      setPreview(result);
      return result;
    } catch (error) {
      notifyMutationError(error);
      return null;
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (!currentRun || ['completed', 'failed'].includes(currentRun.status)) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      getTestDatasetRun(currentRun.name)
        .then((run) => setCurrentRun(run))
        .catch(notifyMutationError);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [currentRun]);

  useEffect(() => {
    if (
      !companyResetRecord ||
      ['Completed', 'Failed', 'Cancelled'].includes(companyResetRecord.status)
    ) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      getCompanyTransactionReset(companyResetRecord.name)
        .then(setCompanyResetRecord)
        .catch(notifyMutationError);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [companyResetRecord]);

  const loadCompanyResetPreview = async () => {
    const values = await form.validateFields(['company']);
    setCompanyResetLoading(true);
    try {
      const result = await previewCompanyTransactionReset(values.company);
      setCompanyResetPreview(result);
      return result;
    } catch (error) {
      notifyMutationError(error);
      return null;
    } finally {
      setCompanyResetLoading(false);
    }
  };

  const openCompanyResetConfirmation = async () => {
    const result = await loadCompanyResetPreview();
    if (!result?.allowed) return;
    setCompanyResetConfirmation('');
    setCompanyResetAcknowledged(false);
    setCompanyResetModalOpen(true);
  };

  const submitCompanyReset = async () => {
    if (!companyResetPreview) return;
    setCompanyResetLoading(true);
    try {
      const result = await requestCompanyTransactionReset({
        acknowledgeIrreversible: companyResetAcknowledged,
        company: companyResetPreview.company,
        confirmationText: companyResetConfirmation,
      });
      setCompanyResetRecord(result.record);
      setCompanyResetModalOpen(false);
    } catch (error) {
      notifyMutationError(error);
    } finally {
      setCompanyResetLoading(false);
    }
  };

  useEffect(() => {
    if (!currentRun || !['completed', 'failed'].includes(currentRun.status)) {
      return;
    }
    if (terminalRunRef.current === currentRun.name) return;
    terminalRunRef.current = currentRun.name;
    actionRef.current?.reload();
    void loadPreview().catch(() => undefined);
    if (currentRun.status === 'failed') {
      Modal.error({
        content: currentRun.error || '后台任务执行失败，请查看运行记录。',
        title: `测试数据任务 ${currentRun.name} 失败`,
      });
    }
  }, [currentRun]);

  const expectedCountItems = useMemo(
    () =>
      Object.entries(preview?.expectedCounts ?? {}).map(([label, count]) => ({
        key: label,
        label,
        children: count,
      })),
    [preview],
  );

  const openConfirmation = async () => {
    const nextPreview = await loadPreview();
    if (!nextPreview?.allowed) return;
    setConfirmationText('');
    setConfirmationOpen(true);
  };

  const submitRun = async () => {
    if (!preview || confirmationText !== preview.confirmationText) return;
    setSubmitting(true);
    try {
      const result = await requestTestDatasetRun({
        action: preview.action,
        baseDate: preview.baseDate,
        company: preview.company,
        confirmationText,
        datasetCode: preview.dataset.code,
        seed: preview.seed,
        scale: preview.scale,
        scenarioKeys: preview.selectedScenarioKeys,
        warehouse: preview.warehouse,
      });
      terminalRunRef.current = null;
      setCurrentRun(await getTestDatasetRun(result.runName));
      setConfirmationOpen(false);
      actionRef.current?.reload();
    } catch (error) {
      notifyMutationError(error);
    } finally {
      setSubmitting(false);
    }
  };

  const runValidation = async () => {
    const values = await form.validateFields(['company', 'datasetCode']);
    try {
      const result = await validateTestDataset(
        values.company,
        values.datasetCode,
      );
      setValidation(result.validation);
    } catch (error) {
      notifyMutationError(error);
    }
  };

  const columns: ProColumns<TestDatasetRun>[] = [
    {
      dataIndex: 'name',
      search: false,
      title: '运行任务',
      width: 260,
      render: (_, row) => (
        <Space orientation="vertical" size={0}>
          <Text copyable strong>
            {row.name}
          </Text>
          <Text type="secondary">
            {row.datasetCode} · {row.datasetVersion}
          </Text>
        </Space>
      ),
    },
    {
      dataIndex: 'action',
      search: false,
      title: '动作',
      width: 110,
      render: (_, row) => actionLabel(row.action),
    },
    {
      dataIndex: 'status',
      search: false,
      title: '状态',
      width: 105,
      render: (_, row) => <StatusTag status={row.status} />,
    },
    { dataIndex: 'company', search: false, title: '公司', width: 150 },
    { dataIndex: 'warehouse', search: false, title: '仓库', width: 180 },
    { dataIndex: 'requestedBy', search: false, title: '操作人', width: 170 },
    {
      dataIndex: 'creation',
      search: false,
      title: '创建时间',
      valueType: 'dateTime',
      width: 175,
    },
    {
      fixed: 'right',
      search: false,
      title: '操作',
      width: 90,
      render: (_, row) => (
        <Button
          onClick={() => {
            setCurrentRun(row);
            terminalRunRef.current = null;
          }}
          type="link"
        >
          查看
        </Button>
      ),
    },
  ];

  return (
    <PageContainer
      title="测试数据管理"
      subTitle="版本化场景生成、精确重建、完整性验证与审计"
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          showIcon
          title="仅限开发、测试和演示环境"
          description="后端会再次校验环境开关、公司白名单、仓库归属、管理员角色和确认文本。当前重置只删除系统登记拥有的模板对象，不执行任意公司清库。"
          type="warning"
        />

        <ProCard title="任务配置">
          <Form<FormValues>
            form={form}
            initialValues={{
              action: 'reset',
              baseDate: dayjs(),
              scale: 'small',
              seed: 1,
            }}
            layout="vertical"
            onFinish={(values) => void loadPreview(values)}
          >
            <Space size={16} wrap align="start">
              <Form.Item
                label="数据集"
                name="datasetCode"
                rules={[{ required: true, message: '请选择数据集' }]}
                style={{ minWidth: 300 }}
              >
                <Select
                  loading={catalogLoading}
                  options={datasets.map((dataset) => ({
                    label: `${dataset.label} · ${dataset.version}`,
                    value: dataset.code,
                  }))}
                />
              </Form.Item>
              <Form.Item
                label="操作模式"
                name="action"
                rules={[{ required: true }]}
              >
                <Radio.Group
                  optionType="button"
                  options={[
                    { label: '仅生成', value: 'generate' },
                    { label: '补充指定场景', value: 'supplement' },
                    { label: '清理并重建', value: 'reset' },
                  ]}
                />
              </Form.Item>
              {selectedAction === 'supplement' ? (
                <Form.Item
                  label="补充场景"
                  name="scenarioKeys"
                  rules={[
                    {
                      required: true,
                      message: '至少选择一个需要补充的场景',
                      type: 'array',
                    },
                  ]}
                  style={{ minWidth: 380 }}
                >
                  <Select
                    mode="multiple"
                    options={(selectedDataset?.scenarios ?? []).map(
                      (scenario) => ({
                        label: scenarioLabel(scenario),
                        value: scenario.key,
                      }),
                    )}
                    placeholder="选择一个或多个业务场景"
                  />
                </Form.Item>
              ) : null}
              <Form.Item
                extra={
                  SCALE_OPTIONS.find((item) => item.value === selectedScale)
                    ?.description
                }
                label="数据量档位"
                name="scale"
                rules={[{ required: true }]}
                style={{ minWidth: 260 }}
              >
                <Select
                  options={SCALE_OPTIONS.map((item) => ({
                    label: `${item.label} · ${item.value}`,
                    value: item.value,
                  }))}
                />
              </Form.Item>
              <Form.Item
                label="公司"
                name="company"
                rules={[{ required: true, message: '请选择公司' }]}
                style={{ minWidth: 240 }}
              >
                <RemoteLinkSelect
                  doctype="Company"
                  onChange={() => {
                    form.setFieldValue('warehouse', undefined);
                    setPreview(null);
                  }}
                  placeholder="选择白名单测试公司"
                />
              </Form.Item>
              <Form.Item
                label="仓库"
                name="warehouse"
                rules={[{ required: true, message: '请选择仓库' }]}
                style={{ minWidth: 280 }}
              >
                <RemoteLinkSelect
                  disabled={!company}
                  doctype="Warehouse"
                  extraFields={['company']}
                  filters={{ company, disabled: 0, is_group: 0 }}
                  placeholder="选择非汇总仓库"
                />
              </Form.Item>
              <Form.Item
                label="基准日期"
                name="baseDate"
                rules={[{ required: true, message: '请选择基准日期' }]}
              >
                <DatePicker />
              </Form.Item>
              <Form.Item label="确定性 Seed" name="seed">
                <InputNumber min={1} precision={0} />
              </Form.Item>
            </Space>
            <Space>
              <Button
                htmlType="submit"
                icon={<SafetyCertificateOutlined />}
                loading={previewLoading}
              >
                执行预检
              </Button>
              <Button
                danger={preview?.action === 'reset'}
                disabled={!preview?.allowed || !access.canAdmin}
                icon={<DatabaseOutlined />}
                onClick={() => void openConfirmation()}
                type="primary"
              >
                {preview?.action === 'reset'
                  ? '清理并重建'
                  : preview?.action === 'supplement'
                    ? '补充场景'
                    : '生成数据'}
              </Button>
              <Button
                disabled={!preview}
                icon={<CheckCircleOutlined />}
                onClick={() => void runValidation()}
              >
                验证当前数据集
              </Button>
            </Space>
          </Form>
        </ProCard>

        <ProCard
          title="公司级交易重置"
          subTitle="保留公司与核心主数据，清理该公司的全部交易、库存流水和账务流水"
        >
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              showIcon
              title="高风险且不可逆"
              description="该操作使用 ERPNext Transaction Deletion Record。它不会只清理模板对象，而会删除白名单公司下所有来源的交易数据。执行后可使用上方“清理并重建”重新生成标准测试数据。"
              type="error"
            />
            <Space>
              <Button
                loading={companyResetLoading}
                onClick={() => void loadCompanyResetPreview()}
              >
                预检公司交易
              </Button>
              <Button
                danger
                disabled={!companyResetPreview?.allowed || !access.canAdmin}
                loading={companyResetLoading}
                onClick={() => void openCompanyResetConfirmation()}
                type="primary"
              >
                创建公司级重置任务
              </Button>
            </Space>

            {companyResetPreview ? (
              <>
                <StatisticCard.Group direction="row">
                  <StatisticCard
                    statistic={{
                      title: '预检状态',
                      value: companyResetPreview.allowed
                        ? '允许执行'
                        : '已阻断',
                    }}
                  />
                  <StatisticCard
                    statistic={{
                      title: '涉及 DocType',
                      value: companyResetPreview.doctypeCount,
                    }}
                  />
                  <StatisticCard
                    statistic={{
                      title: '预计记录引用',
                      value: companyResetPreview.estimatedDocumentReferences,
                    }}
                  />
                  <StatisticCard
                    statistic={{
                      title: '当前模板登记对象',
                      value: companyResetPreview.activeTemplateObjectCount,
                    }}
                  />
                </StatisticCard.Group>
                {companyResetPreview.blockers.length ? (
                  <Alert
                    showIcon
                    title="公司级重置预检未通过"
                    description={companyResetPreview.blockers.join('；')}
                    type="error"
                  />
                ) : null}
                <Table
                  columns={[
                    { dataIndex: 'doctype', title: 'DocType' },
                    { dataIndex: 'companyField', title: '公司字段' },
                    {
                      dataIndex: 'documentCount',
                      title: '预计记录数',
                    },
                  ]}
                  dataSource={companyResetPreview.plan}
                  pagination={{ pageSize: 10 }}
                  rowKey={(row) => `${row.doctype}:${row.companyField}`}
                  size="small"
                />
              </>
            ) : null}

            {companyResetRecord ? (
              <ProCard
                title={`删除任务 ${companyResetRecord.name}`}
                extra={<StatusTag status={companyResetRecord.status} />}
              >
                <Progress
                  percent={
                    companyResetRecord.progress.total
                      ? Math.min(
                          100,
                          Math.round(
                            (companyResetRecord.progress.processed /
                              companyResetRecord.progress.total) *
                              100,
                          ),
                        )
                      : 0
                  }
                  status={
                    companyResetRecord.status === 'Failed'
                      ? 'exception'
                      : companyResetRecord.status === 'Completed'
                        ? 'success'
                        : 'active'
                  }
                />
                <Text type="secondary">
                  已处理 {companyResetRecord.progress.processed} /{' '}
                  {companyResetRecord.progress.total} 条记录引用
                </Text>
                {companyResetRecord.status === 'Completed' ? (
                  <Alert
                    showIcon
                    title="公司交易已经清理"
                    description="请执行上方测试数据“清理并重建”，以清理失效登记并恢复标准测试数据。"
                    style={{ marginTop: 16 }}
                    type="success"
                  />
                ) : null}
                {companyResetRecord.error ? (
                  <Alert
                    showIcon
                    title="ERPNext 删除任务失败"
                    description={companyResetRecord.error}
                    style={{ marginTop: 16 }}
                    type="error"
                  />
                ) : null}
              </ProCard>
            ) : null}
          </Space>
        </ProCard>

        {preview ? (
          <ProCard title="预检结果">
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
              <StatisticCard.Group direction="row">
                <StatisticCard
                  statistic={{
                    title: '预检状态',
                    value: preview.allowed ? '允许执行' : '已阻断',
                    valueStyle: {
                      color: preview.allowed ? '#3f8600' : '#cf1322',
                    },
                  }}
                />
                <StatisticCard
                  statistic={{
                    title: '数据量档位',
                    value: `${scaleLabel(preview.scale)} · ${preview.scenarioCopies} 份`,
                  }}
                />
                <StatisticCard
                  statistic={{
                    title: '当前模板对象',
                    value: preview.activeGeneratedObjectCount,
                  }}
                />
                <StatisticCard
                  statistic={{
                    title: '预计生成对象',
                    value: Object.values(preview.expectedCounts).reduce(
                      (sum, count) => sum + count,
                      0,
                    ),
                  }}
                />
              </StatisticCard.Group>

              <Alert
                showIcon
                title={`${preview.scenarioInstanceCount} 个场景实例，主数据仅创建一次`}
                description={`环境：${preview.safety.environmentType || '未配置'}。每份场景使用独立登记键并错开业务日期，最多 20 份。`}
                type="info"
              />

              {preview.blockers.length ? (
                <Alert
                  showIcon
                  title="预检未通过"
                  description={preview.blockers.join('；')}
                  type="error"
                />
              ) : (
                <Alert
                  showIcon
                  title="预检通过"
                  description={`确认文本：${preview.confirmationText}`}
                  type="success"
                />
              )}

              <Descriptions
                bordered
                column={{ lg: 4, md: 3, sm: 2, xs: 1 }}
                items={expectedCountItems}
                size="small"
                title="预计对象数量"
              />

              {preview.conflicts.length ? (
                <Table
                  columns={[
                    { dataIndex: 'doctype', title: '类型' },
                    { dataIndex: 'name', title: '名称' },
                    {
                      title: '归属判断',
                      render: (_, row) =>
                        preview.unownedConflicts.some(
                          (item) =>
                            item.doctype === row.doctype &&
                            item.name === row.name,
                        ) ? (
                          <Tag color="error">非系统登记对象</Tag>
                        ) : (
                          <Tag color="success">可安全重建</Tag>
                        ),
                    },
                  ]}
                  dataSource={preview.conflicts}
                  pagination={false}
                  rowKey={(row) => `${row.doctype}:${row.name}`}
                  size="small"
                  title={() => '同名对象与归属检查'}
                />
              ) : null}
            </Space>
          </ProCard>
        ) : null}

        {currentRun ? (
          <ProCard
            title="当前任务"
            extra={<StatusTag status={currentRun.status} />}
          >
            <Descriptions
              column={{ lg: 4, md: 2, sm: 1 }}
              items={[
                { key: 'name', label: '任务', children: currentRun.name },
                {
                  key: 'dataset',
                  label: '数据集',
                  children: `${currentRun.datasetCode} · ${currentRun.datasetVersion}`,
                },
                {
                  key: 'action',
                  label: '动作',
                  children: actionLabel(currentRun.action),
                },
                {
                  key: 'scale',
                  label: '数据量档位',
                  children: `${scaleLabel(currentRun.scale)} · ${currentRun.scenarioCopies} 份`,
                },
                {
                  key: 'scenarios',
                  label: '指定场景',
                  children: currentRun.scenarioKeys.length
                    ? currentRun.scenarioKeys.join('、')
                    : '完整数据集',
                },
                { key: 'company', label: '公司', children: currentRun.company },
                {
                  key: 'warehouse',
                  label: '仓库',
                  children: currentRun.warehouse,
                },
                {
                  key: 'requestedBy',
                  label: '操作人',
                  children: currentRun.requestedBy,
                },
                {
                  key: 'startedAt',
                  label: '开始时间',
                  children: currentRun.startedAt || '等待执行',
                },
                {
                  key: 'completedAt',
                  label: '完成时间',
                  children: currentRun.completedAt || '—',
                },
              ]}
            />
            {currentRun.progress.total > 0 ? (
              <div style={{ marginTop: 16 }}>
                <Progress
                  percent={Math.min(
                    100,
                    Math.round(
                      (currentRun.progress.current /
                        currentRun.progress.total) *
                        100,
                    ),
                  )}
                  status={
                    currentRun.status === 'failed'
                      ? 'exception'
                      : currentRun.status === 'completed'
                        ? 'success'
                        : 'active'
                  }
                />
                <Text type="secondary">
                  {currentRun.progress.current}/{currentRun.progress.total} ·{' '}
                  {currentRun.progress.message || '等待后台任务'}
                </Text>
              </div>
            ) : null}
            {currentRun.error ? (
              <Alert
                showIcon
                title="执行错误"
                description={currentRun.error}
                style={{ marginTop: 16 }}
                type="error"
              />
            ) : null}
            {currentRun.result ? (
              <Paragraph
                copyable
                style={{
                  marginBottom: 0,
                  marginTop: 16,
                  maxHeight: 260,
                  overflow: 'auto',
                }}
              >
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(currentRun.result, null, 2)}
                </pre>
              </Paragraph>
            ) : null}
          </ProCard>
        ) : null}

        {validation ? (
          <ProCard title="完整性验证">
            <Alert
              showIcon
              title={validation.passed ? '全部检查通过' : '存在失败检查'}
              type={validation.passed ? 'success' : 'error'}
            />
            <Table
              columns={[
                {
                  dataIndex: 'name',
                  title: '检查项',
                  render: (value) => CHECK_LABELS[value] ?? value,
                },
                {
                  dataIndex: 'passed',
                  title: '结果',
                  render: (passed) => (
                    <Tag color={passed ? 'success' : 'error'}>
                      {passed ? '通过' : '失败'}
                    </Tag>
                  ),
                },
                {
                  dataIndex: 'details',
                  title: '详情',
                  render: (details) => (
                    <Text code>{JSON.stringify(details)}</Text>
                  ),
                },
              ]}
              dataSource={validation.checks}
              pagination={false}
              rowKey="name"
              size="small"
              style={{ marginTop: 16 }}
            />
          </ProCard>
        ) : null}

        <ProTable<TestDatasetRun>
          actionRef={actionRef}
          columns={columns}
          headerTitle="运行历史"
          options={{ density: false, fullScreen: false, setting: false }}
          pagination={{ defaultPageSize: 10, showSizeChanger: true }}
          request={async (params) => {
            try {
              const result = await listTestDatasetRuns({
                current: params.current,
                pageSize: params.pageSize,
              });
              return { data: result.items, success: true, total: result.total };
            } catch (error) {
              notifyMutationError(error);
              return { data: [], success: false, total: 0 };
            }
          }}
          rowKey="name"
          scroll={{ x: 1350 }}
          search={false}
          toolBarRender={() => [
            <Button
              icon={<ReloadOutlined />}
              key="refresh"
              onClick={() => actionRef.current?.reload()}
            >
              刷新
            </Button>,
          ]}
        />
      </Space>

      <Modal
        confirmLoading={submitting}
        okButtonProps={{
          danger: preview?.action === 'reset',
          disabled: confirmationText !== preview?.confirmationText,
        }}
        okText={
          preview?.action === 'reset'
            ? '确认清理并重建'
            : preview?.action === 'supplement'
              ? '确认补充场景'
              : '确认生成'
        }
        onCancel={() => setConfirmationOpen(false)}
        onOk={() => void submitRun()}
        open={confirmationOpen}
        title={
          <Space>
            <ExclamationCircleOutlined />
            确认测试数据操作
          </Space>
        }
      >
        <Title level={5}>目标范围</Title>
        <Paragraph>
          {preview?.company} / {preview?.warehouse} / {preview?.dataset.label}
        </Paragraph>
        <Alert
          showIcon
          title={
            preview?.action === 'reset'
              ? `系统将清理 ${preview.activeGeneratedObjectCount} 个登记对象并重新生成。`
              : preview?.action === 'supplement'
                ? `系统将在现有基线上追加 ${preview.scenarioInstanceCount} 个业务场景实例。`
                : `系统将创建一套主数据和 ${preview?.scenarioInstanceCount ?? 0} 个业务场景实例。`
          }
          type={preview?.action === 'reset' ? 'warning' : 'info'}
        />
        <Paragraph style={{ marginTop: 16 }}>
          请输入 <Text code>{preview?.confirmationText}</Text>：
        </Paragraph>
        <Input
          autoComplete="off"
          onChange={(event) => setConfirmationText(event.target.value)}
          value={confirmationText}
        />
      </Modal>

      <Modal
        confirmLoading={companyResetLoading}
        okButtonProps={{
          danger: true,
          disabled:
            !companyResetAcknowledged ||
            companyResetConfirmation !== companyResetPreview?.confirmationText,
        }}
        okText="不可逆删除全部公司交易"
        onCancel={() => setCompanyResetModalOpen(false)}
        onOk={() => void submitCompanyReset()}
        open={companyResetModalOpen}
        title="确认公司级交易重置"
      >
        <Alert
          showIcon
          title={`即将删除 ${companyResetPreview?.company ?? ''} 的全部交易数据`}
          description={`预计涉及 ${companyResetPreview?.estimatedDocumentReferences ?? 0} 条记录引用。客户、供应商、商品、仓库、科目和用户将保留。`}
          type="error"
        />
        <Paragraph style={{ marginTop: 16 }}>
          请输入 <Text code>{companyResetPreview?.confirmationText}</Text>：
        </Paragraph>
        <Input
          autoComplete="off"
          onChange={(event) => setCompanyResetConfirmation(event.target.value)}
          value={companyResetConfirmation}
        />
        <Checkbox
          checked={companyResetAcknowledged}
          onChange={(event) =>
            setCompanyResetAcknowledged(event.target.checked)
          }
          style={{ marginTop: 16 }}
        >
          我确认这是专用非生产测试公司，并已准备必要备份；该操作不可撤销。
        </Checkbox>
      </Modal>
    </PageContainer>
  );
}
