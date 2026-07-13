import {
  DeleteOutlined,
  DislikeOutlined,
  InboxOutlined,
  LikeOutlined,
  RobotOutlined,
  SendOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { PageContainer, ProCard } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import {
  Alert,
  Avatar,
  Button,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  message,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useState } from 'react';
import { RemoteLinkSelect } from '@/components';
import { useWorkspacePreferences } from '@/hooks/useWorkspacePreferences';
import {
  type AiChatMessage,
  type AiChatResult,
  type AiConversation,
  type AiScenario,
  archiveAiConversation,
  discardAiDraft,
  generateAiPurchaseOrderDraft,
  generateAiSalesOrderDraft,
  getAiConversation,
  listAiConversations,
  listAiDraftVersions,
  prepareAiDraftHandoff,
  restoreAiDraftVersion,
  streamAiChatMessage,
  submitAiFeedback,
  updateAiDraft,
} from '@/services/myapp/ai';

type ChatRow = AiChatMessage & { id: string; runId?: string | null };

const EXAMPLE_PROMPTS: { content: string; scenario: AiScenario }[] = [
  { content: '你目前可以帮助我做什么？', scenario: 'general' },
  {
    content: '查询近30天未完成的大额采购订单，前5条。',
    scenario: 'order_query',
  },
  {
    content: '帮我找蓝色包装、适合整箱销售的饮料。',
    scenario: 'product_search',
  },
  { content: '解释本月销售表现和主要客户。', scenario: 'report_summary' },
  {
    content: '给客户A开2箱数码相机销售订单草稿。',
    scenario: 'sales_order_draft',
  },
  {
    content: '向供应商A采购2箱数码相机，生成采购订单草稿。',
    scenario: 'purchase_order_draft',
  },
];

const SCENARIO_OPTIONS: { label: string; value: AiScenario }[] = [
  { label: '通用对话', value: 'general' },
  { label: '商品搜索', value: 'product_search' },
  { label: '订单查询', value: 'order_query' },
  { label: '报表解释', value: 'report_summary' },
  { label: '销售订单草稿', value: 'sales_order_draft' },
  { label: '采购订单草稿', value: 'purchase_order_draft' },
];

const REPORT_METRIC_LABELS: Record<string, string> = {
  sales_amount_total: '销售额',
  purchase_amount_total: '采购额',
  received_amount_total: '实收',
  paid_amount_total: '实付',
  net_cashflow_total: '净现金流',
  receivable_outstanding_total: '应收未结',
  payable_outstanding_total: '应付未结',
};

function createMessage(
  role: AiChatMessage['role'],
  content: string,
  citations: AiChatMessage['citations'] = [],
  runId?: string | null,
): ChatRow {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    citations,
    runId,
  };
}

export default function AiPage() {
  const [draftForm] = Form.useForm();
  const { defaultCompany } = useWorkspacePreferences();
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [messages, setMessages] = useState<ChatRow[]>([]);
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [scenario, setScenario] = useState<AiScenario>('general');
  const [lastResult, setLastResult] = useState<AiChatResult | null>(null);
  const [feedbackByRun, setFeedbackByRun] = useState<
    Record<string, 'positive' | 'negative'>
  >({});
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editingDraftType, setEditingDraftType] = useState<
    'sales_order' | 'purchase_order'
  >('sales_order');
  const [draftSaving, setDraftSaving] = useState(false);
  const [historyDraftId, setHistoryDraftId] = useState<string | null>(null);
  const [draftVersions, setDraftVersions] = useState<Record<string, unknown>[]>(
    [],
  );
  const [versionLoading, setVersionLoading] = useState(false);

  const refreshConversations = useCallback(async () => {
    try {
      const result = await listAiConversations();
      setConversations(result.items);
    } catch (caught) {
      message.error(
        caught instanceof Error ? caught.message : '会话列表加载失败',
      );
    }
  }, []);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  const openConversation = async (targetId: string) => {
    if (loading || conversationLoading) {
      return;
    }
    setConversationLoading(true);
    try {
      const result = await getAiConversation(targetId);
      setConversationId(result.conversation.name);
      setMessages(
        result.messages.map((item) => ({
          id: item.name,
          role: item.role,
          content: item.content,
          citations: item.citations,
          runId: item.runId,
        })),
      );
      const latestScenario = [...result.messages]
        .reverse()
        .find((item) => item.scenario)?.scenario;
      if (latestScenario) {
        setScenario(latestScenario);
      }
      setLastResult(null);
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '会话加载失败');
    } finally {
      setConversationLoading(false);
    }
  };

  const submit = async (contentValue?: string, scenarioValue?: AiScenario) => {
    const content = (contentValue ?? draft).trim();
    const resolvedScenario = scenarioValue ?? scenario;
    if (!content || loading) {
      return;
    }
    if (
      [
        'product_search',
        'order_query',
        'report_summary',
        'sales_order_draft',
        'purchase_order_draft',
      ].includes(resolvedScenario) &&
      !defaultCompany
    ) {
      message.warning('请先在工作偏好中选择默认公司。');
      return;
    }

    const userMessage = createMessage('user', content);
    const assistantMessage = createMessage('assistant', '');
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setDraft('');
    setScenario(resolvedScenario);
    setLoading(true);
    try {
      if (
        resolvedScenario === 'sales_order_draft' ||
        resolvedScenario === 'purchase_order_draft'
      ) {
        const draftPayload = {
          company: defaultCompany as string,
          content,
          conversationId,
        };
        const result =
          resolvedScenario === 'sales_order_draft'
            ? await generateAiSalesOrderDraft(draftPayload)
            : await generateAiPurchaseOrderDraft(draftPayload);
        setConversationId(result.conversationId);
        setLastResult(result);
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantMessage.id
              ? {
                  ...item,
                  content: result.message.content,
                  citations: result.message.citations,
                  runId: result.runId,
                }
              : item,
          ),
        );
        await refreshConversations();
        return;
      }
      const result = await streamAiChatMessage(
        {
          company: defaultCompany,
          content,
          conversationId,
          scenario: resolvedScenario,
        },
        (event) => {
          if (event.type === 'run_started') {
            const nextConversationId = String(event.conversation ?? '');
            if (nextConversationId) {
              setConversationId(nextConversationId);
            }
            const nextRunId = String(event.run_id ?? '');
            if (nextRunId) {
              setMessages((current) =>
                current.map((item) =>
                  item.id === assistantMessage.id
                    ? { ...item, runId: nextRunId }
                    : item,
                ),
              );
            }
          }
          if (event.type === 'message_delta') {
            const delta = String(event.delta ?? '');
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantMessage.id
                  ? { ...item, content: `${item.content}${delta}` }
                  : item,
              ),
            );
          }
          if (event.type === 'citation') {
            const citation = event.citation as
              | NonNullable<AiChatMessage['citations']>[number]
              | undefined;
            if (citation) {
              setMessages((current) =>
                current.map((item) =>
                  item.id === assistantMessage.id
                    ? {
                        ...item,
                        citations: [...(item.citations ?? []), citation],
                      }
                    : item,
                ),
              );
            }
          }
        },
      );
      setConversationId(result.conversationId);
      setLastResult(result);
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessage.id
            ? {
                ...item,
                content: result.message.content,
                citations: result.message.citations,
                runId: result.runId,
              }
            : item,
        ),
      );
      await refreshConversations();
    } catch (caught) {
      setMessages((current) =>
        current.filter((item) => item.id !== assistantMessage.id),
      );
      message.error(
        caught instanceof Error ? caught.message : 'AI 服务调用失败',
      );
    } finally {
      setLoading(false);
    }
  };

  const handoffDraft = async (draftId: string) => {
    try {
      const { draftType, payload } = await prepareAiDraftHandoff(draftId);
      const isPurchase = draftType === 'purchase_order';
      sessionStorage.setItem(
        `myapp:ai-${isPurchase ? 'purchase' : 'sales'}-draft:${draftId}`,
        JSON.stringify(payload),
      );
      history.push(
        `${isPurchase ? '/purchase/orders/new' : '/sales/orders/new'}?ai_draft=${encodeURIComponent(draftId)}`,
      );
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '草稿交接失败');
    }
  };

  const discardDraft = async (draftId: string) => {
    try {
      await discardAiDraft(draftId);
      setMessages((current) =>
        current.map((item) => ({
          ...item,
          citations: item.citations?.map((citation) =>
            citation.id === draftId
              ? { ...citation, data: { ...citation.data, status: 'discarded' } }
              : citation,
          ),
        })),
      );
      message.success('AI 草稿已放弃');
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '草稿放弃失败');
    }
  };

  const openDraftEditor = (
    citation: NonNullable<AiChatMessage['citations']>[number],
  ) => {
    const payload = citation.data.payload as Record<string, any>;
    const draftType =
      citation.data.draft_type === 'purchase_order'
        ? 'purchase_order'
        : 'sales_order';
    setEditingDraftId(String(citation.id ?? ''));
    setEditingDraftType(draftType);
    draftForm.setFieldsValue({
      party:
        draftType === 'purchase_order'
          ? (payload?.supplier ?? payload?.supplier_query)
          : (payload?.customer ?? payload?.customer_query),
      company: payload?.company,
      transactionDate: payload?.transaction_date
        ? dayjs(payload.transaction_date)
        : undefined,
      targetDate: (
        draftType === 'purchase_order'
          ? payload?.schedule_date
          : payload?.delivery_date
      )
        ? dayjs(
            draftType === 'purchase_order'
              ? payload.schedule_date
              : payload.delivery_date,
          )
        : undefined,
      defaultMode:
        (draftType === 'purchase_order'
          ? payload?.default_purchase_mode
          : payload?.default_sales_mode) ?? 'wholesale',
      warehouse: payload?.warehouse,
      remarks: payload?.remarks,
      items: Array.isArray(payload?.items)
        ? payload.items.map((row: Record<string, unknown>) => ({
            itemCode: row.item_code ?? row.item_query,
            qty: row.qty,
            uom: row.uom,
            price: row.price,
            warehouse: row.warehouse,
          }))
        : [],
    });
  };

  const saveDraftChanges = async () => {
    if (!editingDraftId) return;
    const values = await draftForm.validateFields();
    setDraftSaving(true);
    try {
      const updated = await updateAiDraft(editingDraftId, {
        ...(editingDraftType === 'purchase_order'
          ? { supplier: values.party }
          : { customer: values.party }),
        company: values.company,
        transaction_date: values.transactionDate?.format('YYYY-MM-DD'),
        ...(editingDraftType === 'purchase_order'
          ? {
              schedule_date: values.targetDate?.format('YYYY-MM-DD'),
              default_purchase_mode: values.defaultMode,
            }
          : {
              delivery_date: values.targetDate?.format('YYYY-MM-DD'),
              default_sales_mode: values.defaultMode,
            }),
        warehouse: values.warehouse,
        remarks: values.remarks,
        items: (values.items ?? []).map((row: Record<string, unknown>) => ({
          item_code: row.itemCode,
          qty: row.qty,
          uom: row.uom,
          price: row.price,
          warehouse: row.warehouse,
        })),
      });
      setMessages((current) =>
        current.map((item) => ({
          ...item,
          citations: item.citations?.map((citation) =>
            citation.id === editingDraftId
              ? { ...citation, data: updated }
              : citation,
          ),
        })),
      );
      setEditingDraftId(null);
      message.success(`草稿已更新至版本 ${Number(updated.version ?? 0)}`);
    } finally {
      setDraftSaving(false);
    }
  };

  const openVersionHistory = async (draftId: string) => {
    setHistoryDraftId(draftId);
    setVersionLoading(true);
    try {
      setDraftVersions(await listAiDraftVersions(draftId));
    } finally {
      setVersionLoading(false);
    }
  };

  const restoreVersion = async (version: number) => {
    if (!historyDraftId) return;
    setVersionLoading(true);
    try {
      const updated = await restoreAiDraftVersion(historyDraftId, version);
      setMessages((current) =>
        current.map((item) => ({
          ...item,
          citations: item.citations?.map((citation) =>
            citation.id === historyDraftId
              ? { ...citation, data: updated }
              : citation,
          ),
        })),
      );
      setDraftVersions(await listAiDraftVersions(historyDraftId));
      message.success(`版本 ${version} 已重新校验并恢复为新版本`);
    } finally {
      setVersionLoading(false);
    }
  };

  const resetConversation = () => {
    setConversationId(null);
    setMessages([]);
    setLastResult(null);
    setDraft('');
    setScenario('general');
  };

  const archiveCurrentConversation = async () => {
    if (!conversationId || loading) {
      return;
    }
    try {
      await archiveAiConversation(conversationId);
      resetConversation();
      await refreshConversations();
      message.success('会话已归档');
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '会话归档失败');
    }
  };

  const submitFeedback = async (
    runId: string,
    rating: 'positive' | 'negative',
  ) => {
    try {
      await submitAiFeedback({
        runId,
        rating,
        category: rating === 'positive' ? 'helpful' : 'incorrect',
      });
      setFeedbackByRun((current) => ({ ...current, [runId]: rating }));
      message.success('感谢反馈');
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '反馈提交失败');
    }
  };

  return (
    <PageContainer
      title="AI Copilot"
      subTitle="企业业务助手"
      extra={<Tag color="blue">只读试运行</Tag>}
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={5}>
          <ProCard title="我的会话">
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              <Button
                block
                icon={<DeleteOutlined />}
                onClick={resetConversation}
              >
                新建会话
              </Button>
              <List
                dataSource={conversations}
                locale={{ emptyText: '暂无历史会话' }}
                loading={conversationLoading}
                renderItem={(item) => (
                  <List.Item
                    onClick={() => void openConversation(item.name)}
                    style={{ cursor: 'pointer', paddingInline: 0 }}
                  >
                    <List.Item.Meta
                      description={`${item.messageCount} 条消息${item.company ? ` · ${item.company}` : ''}`}
                      title={
                        <Typography.Text
                          ellipsis
                          strong={conversationId === item.name}
                        >
                          {item.title}
                        </Typography.Text>
                      }
                    />
                  </List.Item>
                )}
                size="small"
              />
              <Typography.Text type="secondary">示例问题</Typography.Text>
              <List
                dataSource={EXAMPLE_PROMPTS}
                renderItem={(item) => (
                  <List.Item style={{ paddingInline: 0 }}>
                    <Button
                      block
                      disabled={loading}
                      onClick={() => void submit(item.content, item.scenario)}
                      style={{
                        height: 'auto',
                        textAlign: 'left',
                        whiteSpace: 'normal',
                      }}
                      type="text"
                    >
                      {item.content}
                    </Button>
                  </List.Item>
                )}
                size="small"
              />
            </Space>
          </ProCard>
        </Col>

        <Col xs={24} xl={13}>
          <ProCard
            title="对话"
            extra={
              <Space>
                {defaultCompany ? <Tag>{defaultCompany}</Tag> : null}
                {conversationId ? (
                  <Button
                    icon={<InboxOutlined />}
                    onClick={() => void archiveCurrentConversation()}
                    size="small"
                  >
                    归档
                  </Button>
                ) : null}
              </Space>
            }
          >
            <div style={{ minHeight: 480, maxHeight: 620, overflowY: 'auto' }}>
              {messages.length ? (
                <Space
                  orientation="vertical"
                  size={16}
                  style={{ width: '100%' }}
                >
                  {messages.map((item) => {
                    const isUser = item.role === 'user';
                    const runId = item.runId;
                    return (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          flexDirection: isUser ? 'row-reverse' : 'row',
                          gap: 12,
                        }}
                      >
                        <Avatar
                          icon={isUser ? <UserOutlined /> : <RobotOutlined />}
                          style={{ background: isUser ? '#1677ff' : '#52c41a' }}
                        />
                        <Space
                          orientation="vertical"
                          size={8}
                          style={{ maxWidth: '78%' }}
                        >
                          <div
                            style={{
                              background: isUser ? '#e6f4ff' : '#f5f5f5',
                              borderRadius: 8,
                              padding: '10px 14px',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            <Typography.Text>{item.content}</Typography.Text>
                          </div>
                          {item.citations?.map((citation) => (
                            <ProCard
                              key={`${item.id}-${citation.type}-${citation.id}`}
                              size="small"
                              title={citation.label}
                              extra={
                                citation.href ? (
                                  <Button
                                    href={citation.href}
                                    size="small"
                                    type="link"
                                  >
                                    {citation.type === 'product'
                                      ? '查看商品'
                                      : citation.type === 'ai_draft'
                                        ? '草稿详情'
                                        : citation.type === 'business_report'
                                          ? '查看报表'
                                          : '查看订单'}
                                  </Button>
                                ) : null
                              }
                            >
                              {citation.type === 'product' ? (
                                <Space size={[8, 4]} wrap>
                                  {citation.id ? (
                                    <Tag>{citation.id}</Tag>
                                  ) : null}
                                  {citation.data.specification ? (
                                    <Tag>
                                      {String(citation.data.specification)}
                                    </Tag>
                                  ) : null}
                                  <Typography.Text>
                                    库存 {Number(citation.data.qty ?? 0)}{' '}
                                    {String(
                                      citation.data.uom_display ??
                                        citation.data.uom ??
                                        '',
                                    )}
                                  </Typography.Text>
                                  <Typography.Text>
                                    参考价 {Number(citation.data.price ?? 0)}
                                  </Typography.Text>
                                </Space>
                              ) : citation.type === 'ai_draft' ? (
                                <Space orientation="vertical" size={8}>
                                  <Space wrap>
                                    <Tag>
                                      版本 {Number(citation.data.version ?? 1)}
                                    </Tag>
                                    <Tag
                                      color={
                                        citation.data.status === 'draft'
                                          ? 'blue'
                                          : 'default'
                                      }
                                    >
                                      {String(citation.data.status ?? 'draft')}
                                    </Tag>
                                  </Space>
                                  <Typography.Text>
                                    {(
                                      citation.data.validation as Record<
                                        string,
                                        unknown
                                      >
                                    )?.ready_for_handoff
                                      ? `草稿已通过后端校验，可进入${citation.data.draft_type === 'purchase_order' ? '采购' : '销售'}订单编辑器复核。`
                                      : '草稿仍有客户、商品、数量、单位或仓库需要人工确认。'}
                                  </Typography.Text>
                                  {Array.isArray(
                                    (
                                      citation.data.validation as Record<
                                        string,
                                        unknown
                                      >
                                    )?.errors,
                                  )
                                    ? (
                                        (
                                          citation.data.validation as Record<
                                            string,
                                            unknown
                                          >
                                        ).errors as unknown[]
                                      ).map((error) => (
                                        <Typography.Text
                                          key={String(error)}
                                          type="danger"
                                        >
                                          {String(error)}
                                        </Typography.Text>
                                      ))
                                    : null}
                                  <Button
                                    disabled={citation.data.status !== 'draft'}
                                    onClick={() => openDraftEditor(citation)}
                                  >
                                    编辑并重新校验
                                  </Button>
                                  <Button
                                    onClick={() =>
                                      void openVersionHistory(
                                        String(citation.id ?? ''),
                                      )
                                    }
                                  >
                                    版本历史
                                  </Button>
                                  <Button
                                    disabled={
                                      citation.data.status === 'discarded' ||
                                      !(
                                        citation.data.validation as Record<
                                          string,
                                          unknown
                                        >
                                      )?.ready_for_handoff
                                    }
                                    onClick={() =>
                                      void handoffDraft(
                                        String(citation.id ?? ''),
                                      )
                                    }
                                    type="primary"
                                  >
                                    在
                                    {citation.data.draft_type ===
                                    'purchase_order'
                                      ? '采购'
                                      : '销售'}
                                    订单编辑器中继续
                                  </Button>
                                  <Button
                                    danger
                                    disabled={
                                      citation.data.status === 'discarded'
                                    }
                                    onClick={() =>
                                      void discardDraft(
                                        String(citation.id ?? ''),
                                      )
                                    }
                                  >
                                    {citation.data.status === 'discarded'
                                      ? '已放弃'
                                      : '放弃草稿'}
                                  </Button>
                                </Space>
                              ) : citation.type === 'business_report' ? (
                                <Space size={[8, 4]} wrap>
                                  {Object.entries(
                                    (citation.data.overview as Record<
                                      string,
                                      unknown
                                    >) ?? {},
                                  ).map(([key, value]) => (
                                    <Tag key={key}>
                                      {REPORT_METRIC_LABELS[key] ?? key}:{' '}
                                      {Number(value ?? 0).toLocaleString(
                                        'zh-CN',
                                      )}
                                    </Tag>
                                  ))}
                                </Space>
                              ) : (
                                <Space size={[8, 4]} wrap>
                                  {citation.id ? (
                                    <Tag>{citation.id}</Tag>
                                  ) : null}
                                  {citation.data.document_status ? (
                                    <Tag>
                                      {String(citation.data.document_status)}
                                    </Tag>
                                  ) : null}
                                  <Typography.Text>
                                    {String(citation.data.party ?? '')}
                                  </Typography.Text>
                                  <Typography.Text>
                                    日期{' '}
                                    {String(
                                      citation.data.transaction_date ?? '-',
                                    )}
                                  </Typography.Text>
                                  <Typography.Text>
                                    金额 {Number(citation.data.amount ?? 0)}
                                  </Typography.Text>
                                  <Typography.Text>
                                    未结{' '}
                                    {Number(
                                      citation.data.outstanding_amount ?? 0,
                                    )}
                                  </Typography.Text>
                                </Space>
                              )}
                            </ProCard>
                          ))}
                          {!isUser && runId && item.content ? (
                            <Space size={4}>
                              <Button
                                aria-label="有帮助"
                                icon={<LikeOutlined />}
                                onClick={() =>
                                  void submitFeedback(runId, 'positive')
                                }
                                size="small"
                                type={
                                  feedbackByRun[runId] === 'positive'
                                    ? 'primary'
                                    : 'text'
                                }
                              />
                              <Button
                                aria-label="不准确"
                                danger={feedbackByRun[runId] === 'negative'}
                                icon={<DislikeOutlined />}
                                onClick={() =>
                                  void submitFeedback(runId, 'negative')
                                }
                                size="small"
                                type="text"
                              />
                            </Space>
                          ) : null}
                        </Space>
                      </div>
                    );
                  })}
                  {loading ? <Spin tip="AI 正在处理..." /> : null}
                </Space>
              ) : (
                <Empty description="开始一次安全的业务对话" />
              )}
            </div>
            <Space.Compact style={{ marginTop: 16, width: '100%' }}>
              <Select
                disabled={loading}
                onChange={setScenario}
                options={SCENARIO_OPTIONS}
                style={{ width: 150 }}
                value={scenario}
              />
              <Input.TextArea
                autoSize={{ minRows: 2, maxRows: 5 }}
                disabled={loading}
                maxLength={8000}
                onChange={(event) => setDraft(event.target.value)}
                onPressEnter={(event) => {
                  if (!event.shiftKey) {
                    event.preventDefault();
                    void submit();
                  }
                }}
                placeholder="输入问题；Enter 发送，Shift+Enter 换行"
                value={draft}
              />
              <Button
                disabled={!draft.trim()}
                icon={<SendOutlined />}
                loading={loading}
                onClick={() => void submit()}
                type="primary"
              >
                发送
              </Button>
            </Space.Compact>
          </ProCard>
        </Col>

        <Col xs={24} xl={6}>
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              showIcon
              title="当前安全边界"
              description="AI 可使用受控商品、订单和经营报表读取工具，并生成销售或采购订单草稿；AI 不能创建、提交、取消、付款或调整库存。正式单据只能由用户在业务编辑器中复核后创建。"
              type="info"
            />
            <ProCard title="运行信息">
              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                <Typography.Text type="secondary">能力模型</Typography.Text>
                <Typography.Text>
                  {lastResult?.modelAlias || '等待首次调用'}
                </Typography.Text>
                <Typography.Text type="secondary">实际模型</Typography.Text>
                <Typography.Text>{lastResult?.model || '-'}</Typography.Text>
                <Typography.Text type="secondary">Token</Typography.Text>
                <Typography.Text>
                  {lastResult?.usage.totalTokens ?? 0}
                </Typography.Text>
                <Typography.Text type="secondary">推理 Token</Typography.Text>
                <Typography.Text>
                  {lastResult?.usage.reasoningTokens ?? 0}
                </Typography.Text>
                <Typography.Text type="secondary">Run</Typography.Text>
                <Typography.Text copyable={Boolean(lastResult?.runId)}>
                  {lastResult?.runId || '-'}
                </Typography.Text>
              </Space>
            </ProCard>
            {lastResult?.warnings.map((warning) => (
              <Alert key={warning} showIcon title={warning} type="warning" />
            ))}
          </Space>
        </Col>
      </Row>
      <Modal
        destroyOnHidden
        okButtonProps={{ loading: draftSaving }}
        onCancel={() => setEditingDraftId(null)}
        onOk={() => void saveDraftChanges()}
        open={Boolean(editingDraftId)}
        title={`编辑${editingDraftType === 'purchase_order' ? '采购' : '销售'}订单草稿`}
        width={900}
      >
        <Alert
          showIcon
          title="保存后将重新查询真实客户、商品、仓库、单位和当前参考价，并生成新版本。"
          type="info"
          style={{ marginBottom: 16 }}
        />
        <Form form={draftForm} layout="vertical">
          <Form.Item name="company" hidden>
            <Input />
          </Form.Item>
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(2, 1fr)',
            }}
          >
            <Form.Item
              label={editingDraftType === 'purchase_order' ? '供应商' : '客户'}
              name="party"
              rules={[{ required: true }]}
            >
              <RemoteLinkSelect
                doctype={
                  editingDraftType === 'purchase_order'
                    ? 'Supplier'
                    : 'Customer'
                }
                placeholder={
                  editingDraftType === 'purchase_order'
                    ? '选择供应商'
                    : '选择客户'
                }
              />
            </Form.Item>
            <Form.Item
              label="默认仓库"
              name="warehouse"
              rules={[{ required: true }]}
            >
              <RemoteLinkSelect doctype="Warehouse" placeholder="选择仓库" />
            </Form.Item>
            <Form.Item
              label="订单日期"
              name="transactionDate"
              rules={[{ required: true }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label={
                editingDraftType === 'purchase_order'
                  ? '预计到货日期'
                  : '交货日期'
              }
              name="targetDate"
              rules={[{ required: true }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label={
                editingDraftType === 'purchase_order'
                  ? '采购取值模式'
                  : '销售模式'
              }
              name="defaultMode"
            >
              <Select
                options={[
                  { label: '批发', value: 'wholesale' },
                  { label: '零售', value: 'retail' },
                ]}
              />
            </Form.Item>
          </div>
          <Form.Item label="备注" name="remarks">
            <Input.TextArea maxLength={1000} />
          </Form.Item>
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <Space orientation="vertical" style={{ width: '100%' }}>
                {fields.map((field) => (
                  <ProCard
                    key={field.key}
                    size="small"
                    title={`商品行 ${field.name + 1}`}
                    extra={
                      <Button danger onClick={() => remove(field.name)}>
                        删除
                      </Button>
                    }
                  >
                    <div
                      style={{
                        display: 'grid',
                        gap: 12,
                        gridTemplateColumns: '2fr 1fr 1fr 1fr',
                      }}
                    >
                      <Form.Item
                        name={[field.name, 'itemCode']}
                        rules={[{ required: true }]}
                      >
                        <RemoteLinkSelect doctype="Item" placeholder="商品" />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'qty']}
                        rules={[{ required: true }]}
                      >
                        <InputNumber
                          min={0.000001}
                          placeholder="数量"
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                      <Form.Item name={[field.name, 'uom']}>
                        <RemoteLinkSelect doctype="UOM" placeholder="单位" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'warehouse']}>
                        <RemoteLinkSelect
                          doctype="Warehouse"
                          placeholder="仓库"
                        />
                      </Form.Item>
                    </div>
                  </ProCard>
                ))}
                <Button onClick={() => add()} block>
                  添加商品行
                </Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>
      <Modal
        footer={null}
        loading={versionLoading}
        onCancel={() => setHistoryDraftId(null)}
        open={Boolean(historyDraftId)}
        title="草稿版本历史"
        width={820}
      >
        <List
          dataSource={draftVersions}
          locale={{ emptyText: '暂无版本快照' }}
          renderItem={(version) => {
            const diff = version.diff as Record<string, unknown>;
            const fieldChanges = Array.isArray(diff?.fields) ? diff.fields : [];
            const itemChanges = Array.isArray(diff?.items) ? diff.items : [];
            return (
              <List.Item
                actions={[
                  <Button
                    disabled={
                      Number(version.version) ===
                      Number(draftVersions[0]?.version)
                    }
                    key="restore"
                    onClick={() => void restoreVersion(Number(version.version))}
                  >
                    恢复为新版本
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space wrap>
                      <Typography.Text strong>
                        版本 {Number(version.version)}
                      </Typography.Text>
                      <Tag>{String(version.change_source ?? 'unknown')}</Tag>
                      <Typography.Text type="secondary">
                        {String(version.creation ?? '')}
                      </Typography.Text>
                    </Space>
                  }
                  description={
                    <Space orientation="vertical" size={4}>
                      <Typography.Text>
                        字段变化 {fieldChanges.length} 项，商品行变化{' '}
                        {itemChanges.length} 项
                      </Typography.Text>
                      {fieldChanges.map((change) => {
                        const row = change as Record<string, unknown>;
                        return (
                          <Typography.Text
                            key={String(row.field)}
                            type="secondary"
                          >
                            {String(row.field)}：{String(row.before ?? '-')} →{' '}
                            {String(row.after ?? '-')}
                          </Typography.Text>
                        );
                      })}
                      {itemChanges.map((change) => {
                        const row = change as Record<string, unknown>;
                        return (
                          <Typography.Text
                            key={`${String(row.key)}-${String(row.change)}-${JSON.stringify(row.fields ?? [])}`}
                            type="secondary"
                          >
                            商品 {String(row.key)}：{String(row.change)}
                            {Array.isArray(row.fields)
                              ? `（${row.fields.join('、')}）`
                              : ''}
                          </Typography.Text>
                        );
                      })}
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
        />
      </Modal>
    </PageContainer>
  );
}
