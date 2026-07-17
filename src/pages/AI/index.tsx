import {
  AppstoreOutlined,
  BarChartOutlined,
  DashboardOutlined,
  FileTextOutlined,
  InboxOutlined,
  MenuOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { PageContainer, ProCard } from '@ant-design/pro-components';
import {
  Bubble,
  Conversations,
  Prompts,
  Sender,
  Welcome,
  XProvider,
} from '@ant-design/x';
import type { BubbleItemType } from '@ant-design/x/es/bubble/interface';
import { history } from '@umijs/max';
import {
  Alert,
  Avatar,
  Button,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RemoteLinkSelect } from '@/components';
import { useWorkspacePreferences } from '@/hooks/useWorkspacePreferences';
import {
  type AiChatMessage,
  type AiChatResult,
  type AiConversation,
  type AiScenario,
  archiveAiConversation,
  discardAiDraft,
  generateAiInventoryAdjustmentDraft,
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
import { AiDraftVersionList } from './components/AiDraftReview';
import {
  AiMessageContent,
  type AiMessageRow,
} from './components/AiMessageContent';
import {
  type AiRunDisplayStatus,
  AiRunInspector,
  type AiToolProgress,
} from './components/AiRunInspector';
import { useAiWorkspaceStyles } from './styles';

type ChatRow = AiMessageRow;

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
  {
    content: '把 Stores - RD 的 SKU010 库存调整到 8 个，原因是盘点差异。',
    scenario: 'inventory_adjustment_draft',
  },
];

const SCENARIO_OPTIONS: { label: string; value: AiScenario }[] = [
  { label: '通用对话', value: 'general' },
  { label: '商品搜索', value: 'product_search' },
  { label: '订单查询', value: 'order_query' },
  { label: '报表解释', value: 'report_summary' },
  { label: '销售订单草稿', value: 'sales_order_draft' },
  { label: '采购订单草稿', value: 'purchase_order_draft' },
  { label: '库存调整草稿', value: 'inventory_adjustment_draft' },
];

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
  const { styles } = useAiWorkspaceStyles();
  const [draftForm] = Form.useForm();
  const [feedbackForm] = Form.useForm<{
    category: 'incorrect' | 'incomplete' | 'unsafe' | 'other';
    comment?: string;
  }>();
  const { defaultCompany } = useWorkspacePreferences();
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [messages, setMessages] = useState<ChatRow[]>([]);
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [conversationStatus, setConversationStatus] = useState<
    'active' | 'archived'
  >('active');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationCompany, setConversationCompany] = useState<string | null>(
    null,
  );
  const [scenario, setScenario] = useState<AiScenario>('general');
  const [lastResult, setLastResult] = useState<AiChatResult | null>(null);
  const [runStatus, setRunStatus] = useState<AiRunDisplayStatus>('idle');
  const [runProgress, setRunProgress] = useState<{
    message: string;
    phase: string;
    startedAt: number | null;
  } | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runWarnings, setRunWarnings] = useState<string[]>([]);
  const [toolProgress, setToolProgress] = useState<AiToolProgress[]>([]);
  const [retryRequest, setRetryRequest] = useState<{
    content: string;
    scenario: AiScenario;
  } | null>(null);
  const [feedbackByRun, setFeedbackByRun] = useState<
    Record<string, 'positive' | 'negative'>
  >({});
  const [negativeFeedbackRunId, setNegativeFeedbackRunId] = useState<
    string | null
  >(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editingDraftType, setEditingDraftType] = useState<
    'sales_order' | 'purchase_order' | 'inventory_adjustment'
  >('sales_order');
  const [draftSaving, setDraftSaving] = useState(false);
  const [historyDraftId, setHistoryDraftId] = useState<string | null>(null);
  const [draftVersions, setDraftVersions] = useState<Record<string, unknown>[]>(
    [],
  );
  const [versionLoading, setVersionLoading] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [conversationDrawerOpen, setConversationDrawerOpen] = useState(false);
  const streamAbortRef = useRef<AbortController | null>(null);
  const effectiveCompany = conversationId
    ? conversationCompany || defaultCompany
    : defaultCompany;

  const refreshConversations = useCallback(async () => {
    try {
      const result = await listAiConversations({
        limit: 50,
        status: conversationStatus,
      });
      setConversations(result.items);
    } catch (caught) {
      message.error(
        caught instanceof Error ? caught.message : '会话列表加载失败',
      );
    }
  }, [conversationStatus]);

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
      setConversationCompany(result.conversation.company);
      const restoredMessages = result.messages.map((item) => ({
        id: item.name,
        role: item.role,
        content: item.content,
        citations: item.citations,
        runId: item.runId,
      }));
      setMessages(restoredMessages);
      const restoredFeedback: Record<string, 'positive' | 'negative'> = {};
      result.messages.forEach((item) => {
        if (item.runId && item.feedback) {
          restoredFeedback[item.runId] = item.feedback.rating;
        }
      });
      setFeedbackByRun(restoredFeedback);
      const latestScenario = [...result.messages]
        .reverse()
        .find((item) => item.scenario)?.scenario;
      if (latestScenario) {
        setScenario(latestScenario);
      }
      const latestRunMessage = [...result.messages]
        .reverse()
        .find((item) => item.runId && item.run);
      setActiveRunId(latestRunMessage?.runId ?? null);
      setRunWarnings([]);
      setToolProgress([]);
      setRunProgress(null);
      setRunError(latestRunMessage?.run?.error ?? null);
      setRunStatus(
        latestRunMessage?.run
          ? latestRunMessage.run.status === 'failed'
            ? 'failed'
            : 'completed'
          : 'idle',
      );
      setLastResult(
        latestRunMessage?.run
          ? {
              conversationId: result.conversation.name,
              events: [],
              message: {
                role: 'assistant',
                content: latestRunMessage.content,
                citations: latestRunMessage.citations,
              },
              model: latestRunMessage.run.model,
              modelAlias: latestRunMessage.run.modelAlias,
              runId: latestRunMessage.runId,
              run: latestRunMessage.run,
              stream: { deltaCount: 0, streamedChars: 0 },
              traceId: latestRunMessage.run.traceId,
              usage: latestRunMessage.run.usage,
              warnings: [],
            }
          : null,
      );
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '会话加载失败');
    } finally {
      setConversationLoading(false);
    }
  };

  useEffect(() => {
    const targetId = new URLSearchParams(history.location.search).get(
      'conversation',
    );
    if (targetId) void openConversation(targetId);
  }, []);

  const submit = async (contentValue?: string, scenarioValue?: AiScenario) => {
    const content = (contentValue ?? draft).trim();
    const resolvedScenario = scenarioValue ?? scenario;
    if (!content || loading) {
      return;
    }
    if (conversationStatus === 'archived' && conversationId) {
      message.warning('已归档会话为只读状态，请新建会话后继续提问。');
      return;
    }
    if (
      [
        'product_search',
        'order_query',
        'report_summary',
        'sales_order_draft',
        'purchase_order_draft',
        'inventory_adjustment_draft',
      ].includes(resolvedScenario) &&
      !effectiveCompany
    ) {
      message.warning('请先在工作偏好中选择默认公司。');
      return;
    }

    const userMessage = createMessage('user', content);
    const assistantMessage = createMessage('assistant', '');
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setDraft('');
    setScenario(resolvedScenario);
    setLastResult(null);
    setActiveRunId(null);
    setRunError(null);
    setRunWarnings([]);
    setToolProgress([]);
    setRunProgress({
      message: '正在建立安全会话与权限上下文',
      phase: 'preparing',
      startedAt: Date.now(),
    });
    setRetryRequest(null);
    setRunStatus('running');
    setLoading(true);
    try {
      if (
        resolvedScenario === 'sales_order_draft' ||
        resolvedScenario === 'purchase_order_draft' ||
        resolvedScenario === 'inventory_adjustment_draft'
      ) {
        setRunProgress((current) => ({
          message: '正在生成结构化草稿并执行后端业务校验',
          phase: 'validating',
          startedAt: current?.startedAt ?? Date.now(),
        }));
        const draftPayload = {
          company: effectiveCompany as string,
          content,
          conversationId,
        };
        const result =
          resolvedScenario === 'sales_order_draft'
            ? await generateAiSalesOrderDraft(draftPayload)
            : resolvedScenario === 'purchase_order_draft'
              ? await generateAiPurchaseOrderDraft(draftPayload)
              : await generateAiInventoryAdjustmentDraft(draftPayload);
        setConversationId(result.conversationId);
        setConversationCompany((current) => current || effectiveCompany);
        setLastResult(result);
        setActiveRunId(result.runId);
        setRunWarnings(result.warnings);
        setRunError(null);
        setRetryRequest(null);
        setRunStatus('completed');
        setRunProgress(null);
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
      const abortController = new AbortController();
      streamAbortRef.current = abortController;
      const result = await streamAiChatMessage(
        {
          company: effectiveCompany,
          content,
          conversationId,
          scenario: resolvedScenario,
        },
        (event) => {
          if (event.type === 'run_started') {
            setRunProgress((current) => ({
              message: '已建立会话，正在准备受控业务上下文',
              phase: 'context_ready',
              startedAt: current?.startedAt ?? Date.now(),
            }));
            const nextConversationId = String(event.conversation ?? '');
            if (nextConversationId) {
              setConversationId(nextConversationId);
              setConversationCompany((current) => current || effectiveCompany);
            }
            const nextRunId = String(event.run_id ?? '');
            if (nextRunId) {
              setActiveRunId(nextRunId);
              setMessages((current) =>
                current.map((item) =>
                  item.id === assistantMessage.id
                    ? { ...item, runId: nextRunId }
                    : item,
                ),
              );
            }
          }
          if (event.type === 'run_progress') {
            const progressMessage = String(event.message ?? '').trim();
            setRunProgress((current) => ({
              message: progressMessage || current?.message || '正在处理',
              phase: String(event.phase ?? current?.phase ?? 'running'),
              startedAt: current?.startedAt ?? Date.now(),
            }));
          }
          if (event.type === 'tool_started') {
            const toolName = String(event.tool ?? '业务工具');
            setRunProgress((current) => ({
              message: `正在执行 ${toolName}，读取受控业务数据`,
              phase: 'tool_running',
              startedAt: current?.startedAt ?? Date.now(),
            }));
            setToolProgress((current) => [
              ...current.filter((item) => item.name !== toolName),
              { name: toolName, status: 'running' },
            ]);
          }
          if (event.type === 'tool_completed') {
            const toolName = String(event.tool ?? '业务工具');
            setRunProgress((current) => ({
              message: '业务数据已就绪，正在组织回答',
              phase: 'tool_completed',
              startedAt: current?.startedAt ?? Date.now(),
            }));
            setToolProgress((current) => [
              ...current.filter((item) => item.name !== toolName),
              {
                name: toolName,
                resultCount:
                  event.result_count === undefined
                    ? undefined
                    : Number(event.result_count),
                status: 'completed',
              },
            ]);
          }
          if (event.type === 'warning') {
            const warning = String(event.message ?? '').trim();
            if (warning) {
              setRunWarnings((current) =>
                current.includes(warning) ? current : [...current, warning],
              );
            }
          }
          if (event.type === 'message_delta') {
            const delta = String(event.delta ?? '');
            setRunProgress((current) => ({
              message: '正在流式输出回答',
              phase: 'streaming',
              startedAt: current?.startedAt ?? Date.now(),
            }));
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
        abortController.signal,
      );
      setConversationId(result.conversationId);
      setConversationCompany((current) => current || effectiveCompany);
      setLastResult(result);
      setActiveRunId(result.runId);
      setRunWarnings(result.warnings);
      setRunError(null);
      setRetryRequest(null);
      setRunStatus('completed');
      setRunProgress(null);
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
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        setRunStatus('stopped');
        setRunProgress(null);
        setRetryRequest({ content, scenario: resolvedScenario });
        message.info('已停止本次生成，当前已接收内容会保留。');
      } else {
        setRunStatus('failed');
        setRunProgress(null);
        setRunError(
          caught instanceof Error ? caught.message : 'AI 服务调用失败',
        );
        setRetryRequest({ content, scenario: resolvedScenario });
        setMessages((current) =>
          current.filter((item) => item.id !== assistantMessage.id),
        );
        message.error(
          caught instanceof Error ? caught.message : 'AI 服务调用失败',
        );
      }
    } finally {
      streamAbortRef.current = null;
      setLoading(false);
    }
  };

  const stopGeneration = () => {
    streamAbortRef.current?.abort();
  };

  const handoffDraft = async (draftId: string) => {
    try {
      const { draftType, payload } = await prepareAiDraftHandoff(draftId);
      const isPurchase = draftType === 'purchase_order';
      const isInventory = draftType === 'inventory_adjustment';
      sessionStorage.setItem(
        `myapp:ai-${isInventory ? 'inventory-adjustment' : isPurchase ? 'purchase' : 'sales'}-draft:${draftId}`,
        JSON.stringify(payload),
      );
      history.push(
        `${isInventory ? '/inventory/adjustments' : isPurchase ? '/purchase/orders/new' : '/sales/orders/new'}?ai_draft=${encodeURIComponent(draftId)}`,
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
      citation.data.draft_type === 'inventory_adjustment'
        ? 'inventory_adjustment'
        : citation.data.draft_type === 'purchase_order'
          ? 'purchase_order'
          : 'sales_order';
    setEditingDraftId(String(citation.id ?? ''));
    setEditingDraftType(draftType);
    if (draftType === 'inventory_adjustment') {
      const item = Array.isArray(payload?.items) ? payload.items[0] : {};
      draftForm.setFieldsValue({
        company: payload?.company,
        postingDate: payload?.posting_date
          ? dayjs(payload.posting_date)
          : undefined,
        warehouse: payload?.warehouse,
        adjustmentType: payload?.adjustment_type ?? 'set_target',
        itemCode: item?.item_code ?? item?.item_query,
        quantity: item?.qty,
        uom: item?.uom,
        reason: payload?.reason ?? payload?.remarks,
      });
      return;
    }
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
      const updated = await updateAiDraft(
        editingDraftId,
        editingDraftType === 'inventory_adjustment'
          ? {
              company: values.company,
              posting_date: values.postingDate?.format('YYYY-MM-DD'),
              warehouse: values.warehouse,
              adjustment_type: values.adjustmentType,
              item_code: values.itemCode,
              quantity: values.quantity,
              uom: values.uom,
              reason: values.reason,
            }
          : {
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
              items: (values.items ?? []).map(
                (row: Record<string, unknown>) => ({
                  item_code: row.itemCode,
                  qty: row.qty,
                  uom: row.uom,
                  price: row.price,
                  warehouse: row.warehouse,
                }),
              ),
            },
      );
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
    setConversationCompany(null);
    setMessages([]);
    setLastResult(null);
    setActiveRunId(null);
    setRunError(null);
    setRunWarnings([]);
    setToolProgress([]);
    setRunProgress(null);
    setRetryRequest(null);
    setRunStatus('idle');
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
    details?: { category?: string; comment?: string },
  ) => {
    try {
      await submitAiFeedback({
        runId,
        rating,
        category:
          rating === 'positive'
            ? 'helpful'
            : ((details?.category ?? 'incorrect') as
                | 'incorrect'
                | 'incomplete'
                | 'unsafe'
                | 'other'),
        comment: details?.comment,
      });
      setFeedbackByRun((current) => ({ ...current, [runId]: rating }));
      setNegativeFeedbackRunId(null);
      feedbackForm.resetFields();
      message.success('感谢反馈');
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '反馈提交失败');
    }
  };

  const conversationItems = conversations.map((item) => {
    const lastMessageAt = item.lastMessageAt ? dayjs(item.lastMessageAt) : null;
    const group = lastMessageAt?.isSame(dayjs(), 'day')
      ? '今天'
      : lastMessageAt?.isSame(dayjs().subtract(1, 'day'), 'day')
        ? '昨天'
        : '更早';
    return {
      key: item.name,
      group,
      label: (
        <Space orientation="vertical" size={0}>
          <Typography.Text ellipsis>{item.title}</Typography.Text>
          <Typography.Text type="secondary">
            {item.messageCount} 条消息
            {item.company ? ` · ${item.company}` : ''}
          </Typography.Text>
        </Space>
      ),
    };
  });

  const promptItems = EXAMPLE_PROMPTS.map((item, index) => ({
    key: String(index),
    label: item.content,
    description: SCENARIO_OPTIONS.find(
      (option) => option.value === item.scenario,
    )?.label,
    icon:
      item.scenario === 'product_search' ? (
        <SearchOutlined />
      ) : item.scenario === 'order_query' ? (
        <ShoppingCartOutlined />
      ) : item.scenario === 'report_summary' ? (
        <BarChartOutlined />
      ) : item.scenario.endsWith('_draft') ? (
        <FileTextOutlined />
      ) : (
        <AppstoreOutlined />
      ),
  }));

  const bubbleItems: BubbleItemType[] = messages.map((item, index) => ({
    key: item.id,
    role: item.role === 'user' ? 'user' : 'ai',
    status:
      loading && item.role === 'assistant' && index === messages.length - 1
        ? 'updating'
        : 'success',
    content:
      item.role === 'user' ? (
        item.content
      ) : (
        <AiMessageContent
          citations={item.citations}
          content={item.content}
          feedback={item.runId ? feedbackByRun[item.runId] : undefined}
          onDiscardDraft={(draftId) => void discardDraft(draftId)}
          onEditDraft={openDraftEditor}
          onFeedback={(rating) =>
            item.runId
              ? rating === 'positive'
                ? void submitFeedback(item.runId, rating)
                : setNegativeFeedbackRunId(item.runId)
              : undefined
          }
          onHandoffDraft={(draftId) => void handoffDraft(draftId)}
          onOpenDraftHistory={(draftId) => void openVersionHistory(draftId)}
          progressMessage={
            loading && index === messages.length - 1
              ? runProgress?.message
              : undefined
          }
          progressStartedAt={
            loading && index === messages.length - 1
              ? runProgress?.startedAt
              : undefined
          }
          runId={item.runId}
          streaming={loading && index === messages.length - 1}
        />
      ),
  }));

  return (
    <PageContainer className={styles.page} ghost title={false}>
      <XProvider>
        <div className={styles.workspace}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <div className={styles.sidebarTitle}>
                <Typography.Title level={5}>对话</Typography.Title>
                <Tag bordered={false} color="processing">
                  {conversations.length}
                </Tag>
              </div>
              <Select
                onChange={setConversationStatus}
                options={[
                  { label: '活跃会话', value: 'active' },
                  { label: '已归档', value: 'archived' },
                ]}
                style={{ width: '100%' }}
                value={conversationStatus}
              />
            </div>
            <div className={styles.sidebarBody}>
              <Spin spinning={conversationLoading}>
                <Conversations
                  activeKey={conversationId ?? undefined}
                  creation={{
                    label: '新建会话',
                    onClick: () => {
                      setConversationStatus('active');
                      resetConversation();
                    },
                  }}
                  groupable
                  items={conversationItems}
                  menu={
                    conversationStatus === 'active'
                      ? (conversation) => ({
                          items: [
                            {
                              icon: <InboxOutlined />,
                              key: 'archive',
                              label: '归档会话',
                            },
                          ],
                          onClick: ({ key }) => {
                            if (key === 'archive') {
                              void archiveAiConversation(conversation.key).then(
                                () => {
                                  if (conversationId === conversation.key) {
                                    resetConversation();
                                  }
                                  void refreshConversations();
                                  message.success('会话已归档');
                                },
                              );
                            }
                          },
                        })
                      : undefined
                  }
                  onActiveChange={(key) => void openConversation(key)}
                />
              </Spin>
            </div>
          </aside>

          <main className={styles.main}>
            <div className={styles.workspaceHeader}>
              <div className={styles.brand}>
                <Button
                  className={styles.mobileOnly}
                  icon={<MenuOutlined />}
                  onClick={() => setConversationDrawerOpen(true)}
                  type="text"
                />
                <Avatar
                  className={styles.brandAvatar}
                  icon={<ThunderboltOutlined />}
                  shape="square"
                  size={42}
                />
                <div className={styles.brandCopy}>
                  <Typography.Title level={4}>AI 业务助手</Typography.Title>
                  <Typography.Text type="secondary">
                    可审计查询、经营解释与结构化草稿
                  </Typography.Text>
                </div>
              </div>
              <Space>
                <Button onClick={() => history.push('/ai/drafts')}>
                  我的草稿
                </Button>
                <Button
                  icon={<DashboardOutlined />}
                  onClick={() => setInspectorOpen(true)}
                >
                  运行详情
                </Button>
              </Space>
            </div>
            <div className={styles.contextBar}>
              <Space wrap>
                <Select
                  disabled={loading}
                  onChange={setScenario}
                  options={SCENARIO_OPTIONS}
                  value={scenario}
                />
                {effectiveCompany ? (
                  <Tag
                    color={
                      conversationId &&
                      conversationCompany &&
                      defaultCompany &&
                      conversationCompany !== defaultCompany
                        ? 'gold'
                        : undefined
                    }
                  >
                    {conversationId ? '会话公司' : '默认公司'}：
                    {effectiveCompany}
                  </Tag>
                ) : null}
              </Space>
              <Space wrap>
                <Tag
                  bordered={false}
                  color="success"
                  icon={<SafetyCertificateOutlined />}
                >
                  权限内只读 · 草稿需人工复核
                </Tag>
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
            </div>

            {messages.length ? (
              <div className={styles.messages}>
                <Bubble.List
                  autoScroll
                  items={bubbleItems}
                  role={{
                    ai: {
                      avatar: <Avatar icon={<RobotOutlined />} />,
                      placement: 'start',
                      variant: 'borderless',
                    },
                    user: {
                      avatar: <Avatar icon={<UserOutlined />} />,
                      placement: 'end',
                      shape: 'corner',
                    },
                  }}
                />
              </div>
            ) : (
              <div className={styles.emptyState}>
                <Welcome
                  description="通过 Frappe 权限边界查询业务数据、解释经营情况，或生成需要人工复核的业务草稿。"
                  icon={<RobotOutlined />}
                  title="今天想处理什么业务？"
                />
                <Prompts
                  className={styles.promptGrid}
                  items={promptItems}
                  onItemClick={({ data }) => {
                    const prompt = EXAMPLE_PROMPTS[Number(data.key)];
                    if (prompt) void submit(prompt.content, prompt.scenario);
                  }}
                  title="常用能力"
                  wrap
                />
              </div>
            )}

            <div className={styles.composer}>
              <div className={styles.composerInner}>
                <Sender
                  autoSize={{ minRows: 2, maxRows: 7 }}
                  loading={loading}
                  onCancel={stopGeneration}
                  onChange={setDraft}
                  onSubmit={(value) => void submit(value)}
                  placeholder="输入业务问题；Enter 发送，Shift+Enter 换行"
                  value={draft}
                />
              </div>
            </div>
          </main>
        </div>
        <Drawer
          onClose={() => setConversationDrawerOpen(false)}
          open={conversationDrawerOpen}
          placement="left"
          title="对话"
          width={360}
        >
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Select
              onChange={setConversationStatus}
              options={[
                { label: '活跃会话', value: 'active' },
                { label: '已归档', value: 'archived' },
              ]}
              style={{ width: '100%' }}
              value={conversationStatus}
            />
            <Spin spinning={conversationLoading}>
              <Conversations
                activeKey={conversationId ?? undefined}
                creation={{
                  label: '新建会话',
                  onClick: () => {
                    setConversationDrawerOpen(false);
                    setConversationStatus('active');
                    resetConversation();
                  },
                }}
                groupable
                items={conversationItems}
                onActiveChange={(key) => {
                  setConversationDrawerOpen(false);
                  void openConversation(key);
                }}
              />
            </Spin>
          </Space>
        </Drawer>
        <Drawer
          onClose={() => setInspectorOpen(false)}
          open={inspectorOpen}
          title="运行详情"
          width={440}
        >
          <div className={styles.drawerContent}>
            <Alert
              description="AI 只能读取受控数据并生成草稿，不能创建、提交、取消、付款或直接调整库存。"
              icon={<SafetyCertificateOutlined />}
              showIcon
              title="安全边界"
              type="info"
            />
            <AiRunInspector
              activeRunId={activeRunId}
              error={runError}
              onRetry={
                retryRequest
                  ? () =>
                      void submit(retryRequest.content, retryRequest.scenario)
                  : undefined
              }
              result={lastResult}
              status={runStatus}
              tools={toolProgress}
              warnings={runWarnings}
            />
          </div>
        </Drawer>
      </XProvider>
      <Modal
        destroyOnHidden
        okText="提交改进反馈"
        onCancel={() => {
          setNegativeFeedbackRunId(null);
          feedbackForm.resetFields();
        }}
        onOk={() => feedbackForm.submit()}
        open={Boolean(negativeFeedbackRunId)}
        title="这条回答需要如何改进？"
      >
        <Form
          form={feedbackForm}
          layout="vertical"
          initialValues={{ category: 'incorrect' }}
          onFinish={(values) =>
            negativeFeedbackRunId
              ? void submitFeedback(negativeFeedbackRunId, 'negative', values)
              : undefined
          }
        >
          <Form.Item
            label="问题类型"
            name="category"
            rules={[{ message: '请选择问题类型', required: true }]}
          >
            <Select
              options={[
                { label: '事实或结果不准确', value: 'incorrect' },
                { label: '回答不完整', value: 'incomplete' },
                { label: '存在安全或权限风险', value: 'unsafe' },
                { label: '其他问题', value: 'other' },
              ]}
            />
          </Form.Item>
          <Form.Item label="补充说明" name="comment">
            <Input.TextArea maxLength={1000} rows={4} showCount />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        destroyOnHidden
        okButtonProps={{ loading: draftSaving }}
        onCancel={() => setEditingDraftId(null)}
        onOk={() => void saveDraftChanges()}
        open={Boolean(editingDraftId)}
        title={
          editingDraftType === 'inventory_adjustment'
            ? '编辑库存调整草稿'
            : `编辑${editingDraftType === 'purchase_order' ? '采购' : '销售'}订单草稿`
        }
        width={900}
      >
        <Alert
          showIcon
          title={
            editingDraftType === 'inventory_adjustment'
              ? '保存后将重新查询真实商品、仓库、库存、单位和估值参考，并生成新版本；不会提交任何库存单据。'
              : '保存后将重新查询真实客户或供应商、商品、仓库、单位和当前参考价，并生成新版本。'
          }
          type="info"
          style={{ marginBottom: 16 }}
        />
        <Form form={draftForm} layout="vertical">
          <Form.Item name="company" hidden>
            <Input />
          </Form.Item>
          {editingDraftType === 'inventory_adjustment' ? (
            <>
              <div
                style={{
                  display: 'grid',
                  gap: 12,
                  gridTemplateColumns: 'repeat(2, 1fr)',
                }}
              >
                <Form.Item
                  label="仓库"
                  name="warehouse"
                  rules={[{ required: true }]}
                >
                  <RemoteLinkSelect
                    doctype="Warehouse"
                    filters={{
                      company: draftForm.getFieldValue('company'),
                      disabled: 0,
                      is_group: 0,
                    }}
                    placeholder="选择仓库"
                  />
                </Form.Item>
                <Form.Item
                  label="过账日期"
                  name="postingDate"
                  rules={[{ required: true }]}
                >
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  label="调整方式"
                  name="adjustmentType"
                  rules={[{ required: true }]}
                >
                  <Select
                    options={[
                      { label: '调整到目标库存', value: 'set_target' },
                      { label: '增加库存', value: 'increase' },
                      { label: '减少库存', value: 'decrease' },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  label="商品"
                  name="itemCode"
                  rules={[{ required: true }]}
                >
                  <RemoteLinkSelect
                    doctype="Item"
                    filters={{ disabled: 0, is_stock_item: 1 }}
                    placeholder="选择库存商品"
                  />
                </Form.Item>
                <Form.Item
                  label="目标或增减数量"
                  name="quantity"
                  rules={[{ required: true }]}
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item label="单位" name="uom">
                  <RemoteLinkSelect doctype="UOM" placeholder="选择单位" />
                </Form.Item>
              </div>
              <Form.Item
                label="调整原因"
                name="reason"
                rules={[
                  { required: true, message: '请填写盘点差异或业务原因' },
                ]}
              >
                <Input.TextArea maxLength={1000} />
              </Form.Item>
            </>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gap: 12,
                  gridTemplateColumns: 'repeat(2, 1fr)',
                }}
              >
                <Form.Item
                  label={
                    editingDraftType === 'purchase_order' ? '供应商' : '客户'
                  }
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
                  <RemoteLinkSelect
                    doctype="Warehouse"
                    placeholder="选择仓库"
                  />
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
                            <RemoteLinkSelect
                              doctype="Item"
                              placeholder="商品"
                            />
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
                            <RemoteLinkSelect
                              doctype="UOM"
                              placeholder="单位"
                            />
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
            </>
          )}
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
        <AiDraftVersionList
          currentVersion={Number(draftVersions[0]?.version ?? 0)}
          onRestore={(version) => void restoreVersion(version)}
          versions={draftVersions}
        />
      </Modal>
    </PageContainer>
  );
}
