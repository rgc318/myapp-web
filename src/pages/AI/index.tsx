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
import {
  Alert,
  Avatar,
  Button,
  Col,
  Empty,
  Input,
  List,
  message,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import React, { useCallback, useEffect, useState } from 'react';
import { useWorkspacePreferences } from '@/hooks/useWorkspacePreferences';
import {
  type AiChatMessage,
  type AiChatResult,
  type AiConversation,
  type AiScenario,
  archiveAiConversation,
  getAiConversation,
  listAiConversations,
  streamAiChatMessage,
  submitAiFeedback,
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
];

const SCENARIO_OPTIONS: { label: string; value: AiScenario }[] = [
  { label: '通用对话', value: 'general' },
  { label: '商品搜索', value: 'product_search' },
  { label: '订单查询', value: 'order_query' },
  { label: '报表解释', value: 'report_summary' },
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
    if (resolvedScenario === 'product_search' && !defaultCompany) {
      message.warning('请先在工作偏好中选择默认公司，再搜索商品。');
      return;
    }

    const userMessage = createMessage('user', content);
    const assistantMessage = createMessage('assistant', '');
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setDraft('');
    setScenario(resolvedScenario);
    setLoading(true);
    try {
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
              description="AI 只开放受控商品、订单和经营报表读取工具，不能创建、提交、取消、付款或调整库存。业务卡片来自后端真实查询；正式动作仍由用户执行。"
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
    </PageContainer>
  );
}
