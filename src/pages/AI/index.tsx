import {
  AppstoreOutlined,
  BarChartOutlined,
  ClearOutlined,
  DashboardOutlined,
  EditOutlined,
  FileTextOutlined,
  InboxOutlined,
  LockOutlined,
  MenuOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
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
  Badge,
  Button,
  Drawer,
  Form,
  Input,
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
  type AiAgentApproval,
  type AiBusinessDocumentResult,
  type AiBusinessResultSet,
  type AiChatMessage,
  type AiChatResult,
  type AiCitation,
  type AiConversation,
  type AiConversationContext,
  type AiConversationMessage,
  type AiConversationMessagePagination,
  type AiDraft,
  type AiRunSummary,
  type AiScenario,
  type AiSelectableModel,
  type AiWorkspaceCapabilities,
  archiveAiConversation,
  cancelAiRun,
  discardAiDraft,
  generateAiInventoryAdjustmentDraft,
  generateAiProductSetupDraft,
  generateAiPurchaseOrderDraft,
  generateAiSalesOrderDraft,
  getAiConversation,
  getAiErrorCode,
  getAiErrorModelDetails,
  listAiAgentApprovals,
  listAiConversations,
  listAiDraftVersions,
  listAiSelectableModels,
  prepareAiDraftHandoff,
  refreshAiBusinessResult,
  renameAiConversation,
  resetAiConversationContext,
  resolveAiScenario,
  restoreAiDraftVersion,
  reviewAiAgentApproval,
  streamAiChatMessage,
  submitAiFeedback,
} from '@/services/myapp/ai';
import { AiDraftEditorModal } from './components/AiDraftEditorModal';
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
import { BusinessDocumentDrawer } from './components/BusinessDocumentDrawer';
import { ProductDetailDrawer } from './components/ProductDetailDrawer';
import { useAiWorkspaceStyles } from './styles';

type ChatRow = AiMessageRow & {
  approval?: AiAgentApproval | null;
  creation?: string | null;
  run?: AiRunSummary | null;
  runResult?: AiChatResult | null;
  runStatus?: AiRunDisplayStatus;
  runStream?: AiChatResult['stream'];
  runTools?: AiToolProgress[];
  runWarnings?: string[];
  scenario?: AiScenario | null;
  sequence?: number | null;
  modelAlias?: string | null;
  modelSelection?: 'auto' | 'fixed';
  requestedModelDisplay?: string | null;
};

const AI_MESSAGE_PAGE_SIZE = 40;
const NEW_CONVERSATION_DRAFT_KEY = '__new_ai_conversation__';

const EMPTY_MESSAGE_PAGINATION: AiConversationMessagePagination = {
  hasMore: false,
  limit: AI_MESSAGE_PAGE_SIZE,
  nextBeforeSequence: null,
  returnedCount: 0,
  total: 0,
};

const BUSINESS_RESULT_CITATION_TYPES = new Set([
  'business_result_set',
  'sales_order',
  'sales_invoice',
  'purchase_order',
  'purchase_invoice',
]);

function isDraftScenario(value: AiScenario) {
  return [
    'sales_order_draft',
    'purchase_order_draft',
    'inventory_adjustment_draft',
    'product_setup_draft',
  ].includes(value);
}

function resolveRunDisplayStatus(
  status: string | null | undefined,
): AiRunDisplayStatus {
  if (status === 'running') return 'running';
  if (status === 'waiting_approval') return 'waiting_approval';
  if (status === 'failed') return 'failed';
  if (status === 'stopped') return 'stopped';
  if (status === 'completed') return 'completed';
  return 'idle';
}

function buildMessageRunResult(
  messageRow: ChatRow | null,
  conversationId: string | null,
): AiChatResult | null {
  if (!messageRow?.run || !messageRow.runId) return null;
  return {
    conversationId: conversationId ?? '',
    events: [],
    message: {
      citations: messageRow.citations,
      content: messageRow.content,
      role: 'assistant',
    },
    model: messageRow.run.model,
    modelAlias: messageRow.run.modelAlias,
    modelDisplay: messageRow.run.modelDisplay,
    run: messageRow.run,
    runId: messageRow.runId,
    stream: messageRow.runStream ?? { deltaCount: 0, streamedChars: 0 },
    traceId: messageRow.run.traceId,
    usage: messageRow.run.usage,
    warnings: messageRow.runWarnings ?? [],
  };
}

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
  {
    content: '新增商品“传承结晶”，库存基准单位为个，标准售价 9999 元。',
    scenario: 'product_setup_draft',
  },
];

const SCENARIO_OPTIONS: { label: string; value: AiScenario }[] = [
  { label: '自动识别', value: 'auto' },
  { label: '通用对话', value: 'general' },
  { label: '商品搜索', value: 'product_search' },
  { label: '订单查询', value: 'order_query' },
  { label: '报表解释', value: 'report_summary' },
  { label: '销售订单草稿', value: 'sales_order_draft' },
  { label: '采购订单草稿', value: 'purchase_order_draft' },
  { label: '库存调整草稿', value: 'inventory_adjustment_draft' },
  { label: '商品建档草稿', value: 'product_setup_draft' },
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

function mapConversationMessages(items: AiConversationMessage[]): ChatRow[] {
  return items.map((item) => ({
    id: item.name,
    role: item.role,
    content: item.content,
    citations: item.citations,
    error:
      item.run?.status === 'failed'
        ? (item.run.error ?? 'AI 服务调用失败')
        : null,
    errorCode: item.run?.status === 'failed' ? item.run.errorCode : null,
    modelAlias: item.run?.modelAlias ?? null,
    modelDisplay: item.run?.modelDisplay ?? null,
    modelSelection: item.run?.modelSelection ?? 'auto',
    requestedModelDisplay: item.run?.requestedModelDisplay ?? null,
    creation: item.creation,
    run: item.run,
    runId: item.runId,
    runStatus: resolveRunDisplayStatus(item.run?.status),
    runStream: { deltaCount: 0, streamedChars: 0 },
    runTools: [],
    runWarnings: [],
    scenario: item.scenario,
    sequence: item.sequence,
  }));
}

function getConversationDraftKey(conversationId: string | null) {
  return conversationId ?? NEW_CONVERSATION_DRAFT_KEY;
}

export default function AiPage() {
  const { styles } = useAiWorkspaceStyles();
  const [feedbackForm] = Form.useForm<{
    category: 'incorrect' | 'incomplete' | 'unsafe' | 'other';
    comment?: string;
  }>();
  const { defaultCompany } = useWorkspacePreferences();
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [olderMessagesLoading, setOlderMessagesLoading] = useState(false);
  const [messages, setMessages] = useState<ChatRow[]>([]);
  const [messagePagination, setMessagePagination] =
    useState<AiConversationMessagePagination>(EMPTY_MESSAGE_PAGINATION);
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [conversationTotal, setConversationTotal] = useState(0);
  const [pendingDraftTotal, setPendingDraftTotal] = useState(0);
  const [conversationSearchInput, setConversationSearchInput] = useState('');
  const [conversationSearch, setConversationSearch] = useState('');
  const [conversationStatus, setConversationStatus] = useState<
    'active' | 'archived'
  >('active');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [selectedConversationStatus, setSelectedConversationStatus] = useState<
    'active' | 'archived' | null
  >(null);
  const [conversationCompany, setConversationCompany] = useState<string | null>(
    null,
  );
  const [conversationContext, setConversationContext] =
    useState<AiConversationContext | null>(null);
  const [scenario, setScenario] = useState<AiScenario>('auto');
  const [selectedCompany, setSelectedCompany] = useState<string | null>(
    defaultCompany ?? null,
  );
  const [lastResult, setLastResult] = useState<AiChatResult | null>(null);
  const [runStatus, setRunStatus] = useState<AiRunDisplayStatus>('idle');
  const [runProgress, setRunProgress] = useState<{
    message: string;
    phase: string;
    startedAt: number | null;
  } | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runErrorCode, setRunErrorCode] = useState<string | null>(null);
  const [runWarnings, setRunWarnings] = useState<string[]>([]);
  const [toolProgress, setToolProgress] = useState<AiToolProgress[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<AiAgentApproval[]>(
    [],
  );
  const [approvalActionId, setApprovalActionId] = useState<string | null>(null);
  const [retryRequest, setRetryRequest] = useState<{
    content: string;
    messageId: string;
    runId: string | null;
    scenario: AiScenario;
  } | null>(null);
  const [selectableModels, setSelectableModels] = useState<AiSelectableModel[]>(
    [],
  );
  const [workspaceCapabilities, setWorkspaceCapabilities] =
    useState<AiWorkspaceCapabilities>({
      canSelectFixedModel: false,
      canViewAdvancedDiagnostics: false,
    });
  const [modelsLoading, setModelsLoading] = useState(false);
  const [selectedModelAlias, setSelectedModelAlias] = useState<string | null>(
    null,
  );
  const [feedbackByRun, setFeedbackByRun] = useState<
    Record<string, 'positive' | 'negative'>
  >({});
  const [negativeFeedbackRunId, setNegativeFeedbackRunId] = useState<
    string | null
  >(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [historyDraftId, setHistoryDraftId] = useState<string | null>(null);
  const [draftVersions, setDraftVersions] = useState<Record<string, unknown>[]>(
    [],
  );
  const [versionLoading, setVersionLoading] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectedMessageId, setInspectedMessageId] = useState<string | null>(
    null,
  );
  const [conversationDrawerOpen, setConversationDrawerOpen] = useState(false);
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<AiConversation | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [businessDocument, setBusinessDocument] =
    useState<AiBusinessDocumentResult | null>(null);
  const [productCitation, setProductCitation] = useState<AiCitation | null>(
    null,
  );
  const streamAbortRef = useRef<AbortController | null>(null);
  const approvalRefreshSequenceRef = useRef(0);
  const activeConversationIdRef = useRef<string | null>(null);
  const draftByConversationRef = useRef<Record<string, string>>({});
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const pendingPrependScrollRef = useRef<{
    previousHeight: number;
    previousTop: number;
    scrollBox: HTMLElement;
  } | null>(null);
  const effectiveCompany = conversationId
    ? conversationCompany || defaultCompany
    : selectedCompany || defaultCompany;
  const latestAssistantMessage = [...messages]
    .reverse()
    .find((item) => item.role === 'assistant');
  const automaticModelLabel =
    latestAssistantMessage?.modelSelection === 'auto' &&
    latestAssistantMessage.modelDisplay
      ? `自动模型（${latestAssistantMessage.modelDisplay}）`
      : '自动模型（由策略选择）';
  const modelSelectOptions = [
    { label: automaticModelLabel, value: 'auto' },
    ...selectableModels.map((model) => ({
      disabled: model.lastHealthStatus === 'unavailable',
      label: `${
        model.displayName === model.modelAlias
          ? model.displayName
          : `${model.displayName} · ${model.modelAlias}`
      }${model.lastHealthStatus === 'unavailable' ? ' · 不可用' : ''}`,
      value: model.modelAlias,
    })),
  ];

  const setComposerDraft = useCallback(
    (value: string, targetConversationId?: string | null) => {
      const resolvedConversationId =
        targetConversationId === undefined
          ? activeConversationIdRef.current
          : targetConversationId;
      draftByConversationRef.current[
        getConversationDraftKey(resolvedConversationId)
      ] = value;
      setDraft(value);
    },
    [],
  );

  const rememberCurrentComposerDraft = useCallback(() => {
    draftByConversationRef.current[
      getConversationDraftKey(activeConversationIdRef.current)
    ] = draft;
  }, [draft]);

  useEffect(() => {
    if (!conversationId && !selectedCompany && defaultCompany) {
      setSelectedCompany(defaultCompany);
    }
  }, [conversationId, defaultCompany, selectedCompany]);

  useEffect(() => {
    activeConversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    const pending = pendingPrependScrollRef.current;
    if (!pending) return;
    pendingPrependScrollRef.current = null;
    const frame = window.requestAnimationFrame(() => {
      const heightDelta =
        pending.scrollBox.scrollHeight - pending.previousHeight;
      pending.scrollBox.scrollTop =
        pending.previousTop + Math.max(0, heightDelta);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages.length]);

  useEffect(() => {
    let active = true;
    setModelsLoading(true);
    void listAiSelectableModels()
      .then(({ capabilities, models }) => {
        if (!active) return;
        setWorkspaceCapabilities(capabilities);
        setSelectableModels(models);
        setSelectedModelAlias((current) =>
          capabilities.canSelectFixedModel &&
          current &&
          models.some(
            (model) =>
              model.modelAlias === current &&
              model.lastHealthStatus !== 'unavailable',
          )
            ? current
            : null,
        );
      })
      .catch(() => {
        if (active) {
          setSelectableModels([]);
          setWorkspaceCapabilities({
            canSelectFixedModel: false,
            canViewAdvancedDiagnostics: false,
          });
        }
      })
      .finally(() => {
        if (active) setModelsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const refreshConversations = useCallback(async () => {
    try {
      const result = await listAiConversations({
        limit: 50,
        search: conversationSearch,
        status: conversationStatus,
      });
      setConversations(result.items);
      setConversationTotal(result.total);
      setPendingDraftTotal(result.pendingDraftTotal);
    } catch (caught) {
      message.error(
        caught instanceof Error ? caught.message : '会话列表加载失败',
      );
    }
  }, [conversationSearch, conversationStatus]);

  const refreshPendingApprovals = useCallback(async () => {
    const refreshSequence = approvalRefreshSequenceRef.current + 1;
    approvalRefreshSequenceRef.current = refreshSequence;
    try {
      const result = await listAiAgentApprovals({
        status: 'pending',
        limit: 100,
      });
      if (approvalRefreshSequenceRef.current === refreshSequence) {
        setPendingApprovals(result.items);
      }
    } catch {}
  }, []);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    void refreshPendingApprovals();
  }, [refreshPendingApprovals]);

  const openConversation = async (targetId: string, force = false) => {
    if (!force && (loading || conversationLoading)) {
      return;
    }
    setConversationLoading(true);
    rememberCurrentComposerDraft();
    setInspectorOpen(false);
    setInspectedMessageId(null);
    try {
      const result = await getAiConversation(targetId, {
        limit: AI_MESSAGE_PAGE_SIZE,
      });
      const openedConversationStatus =
        result.conversation.status === 'archived' ? 'archived' : 'active';
      setConversationId(result.conversation.name);
      activeConversationIdRef.current = result.conversation.name;
      setComposerDraft(
        draftByConversationRef.current[
          getConversationDraftKey(result.conversation.name)
        ] ?? '',
        result.conversation.name,
      );
      setConversationCompany(result.conversation.company);
      setConversationContext(result.context ?? null);
      setConversationStatus(openedConversationStatus);
      setSelectedConversationStatus(openedConversationStatus);
      const restoredMessages = mapConversationMessages(result.messages);
      setMessages(restoredMessages);
      setMessagePagination(
        result.pagination ?? {
          ...EMPTY_MESSAGE_PAGINATION,
          returnedCount: result.messages.length,
          total: result.conversation.messageCount,
        },
      );
      const restoredFeedback: Record<string, 'positive' | 'negative'> = {};
      result.messages.forEach((item) => {
        if (item.runId && item.feedback) {
          restoredFeedback[item.runId] = item.feedback.rating;
        }
      });
      setFeedbackByRun(restoredFeedback);
      // 历史消息保存的是每次请求最终执行的场景，不代表用户希望把后续
      // 问题永久锁定到该场景。重新打开会话时恢复自动识别，避免上一轮
      // 订单查询把后续商品创建等不同意图继续错误路由到 order_query。
      setScenario('auto');
      const latestRunIndex = result.messages.findLastIndex(
        (item) => item.runId && item.run,
      );
      const latestRunMessage =
        latestRunIndex >= 0 ? result.messages[latestRunIndex] : null;
      const failedRequestMessage =
        latestRunIndex >= 0 && latestRunMessage?.run?.status === 'failed'
          ? [...result.messages.slice(0, latestRunIndex)]
              .reverse()
              .find((item) => item.role === 'user')
          : null;
      setActiveRunId(latestRunMessage?.runId ?? null);
      setRunWarnings([]);
      setToolProgress([]);
      setRunProgress(null);
      setRunError(latestRunMessage?.run?.error ?? null);
      setRunErrorCode(latestRunMessage?.run?.errorCode ?? null);
      setRunStatus(
        latestRunMessage?.run
          ? latestRunMessage.run.status === 'failed'
            ? 'failed'
            : 'completed'
          : 'idle',
      );
      setRetryRequest(
        openedConversationStatus === 'active' &&
          latestRunMessage?.run?.status === 'failed' &&
          failedRequestMessage
          ? {
              content: failedRequestMessage.content,
              messageId: latestRunMessage.name,
              runId: latestRunMessage.runId,
              scenario: latestRunMessage.scenario ?? 'auto',
            }
          : null,
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
              modelDisplay: latestRunMessage.run.modelDisplay,
              runId: latestRunMessage.runId,
              run: latestRunMessage.run,
              stream: { deltaCount: 0, streamedChars: 0 },
              traceId: latestRunMessage.run.traceId,
              usage: latestRunMessage.run.usage,
              warnings: [],
            }
          : null,
      );
      await refreshPendingApprovals();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '会话加载失败');
    } finally {
      setConversationLoading(false);
    }
  };

  const loadOlderMessages = async () => {
    const targetId = conversationId;
    const beforeSequence = messagePagination.nextBeforeSequence;
    if (
      !targetId ||
      !beforeSequence ||
      !messagePagination.hasMore ||
      loading ||
      conversationLoading ||
      olderMessagesLoading
    ) {
      return;
    }

    const scrollBox = messagesViewportRef.current?.querySelector<HTMLElement>(
      '.ant-bubble-list-scroll-box',
    );
    if (scrollBox) {
      pendingPrependScrollRef.current = {
        previousHeight: scrollBox.scrollHeight,
        previousTop: scrollBox.scrollTop,
        scrollBox,
      };
    }

    setOlderMessagesLoading(true);
    try {
      const result = await getAiConversation(targetId, {
        beforeSequence,
        limit: AI_MESSAGE_PAGE_SIZE,
      });
      if (activeConversationIdRef.current !== targetId) return;

      const olderMessages = mapConversationMessages(result.messages);
      setMessages((current) => {
        const existingIds = new Set(current.map((item) => item.id));
        return [
          ...olderMessages.filter((item) => !existingIds.has(item.id)),
          ...current,
        ];
      });
      setMessagePagination(result.pagination);

      const restoredFeedback: Record<string, 'positive' | 'negative'> = {};
      result.messages.forEach((item) => {
        if (item.runId && item.feedback) {
          restoredFeedback[item.runId] = item.feedback.rating;
        }
      });
      setFeedbackByRun((current) => ({ ...current, ...restoredFeedback }));
    } catch (caught) {
      pendingPrependScrollRef.current = null;
      message.error(
        caught instanceof Error ? caught.message : '更早消息加载失败',
      );
    } finally {
      if (activeConversationIdRef.current === targetId) {
        setOlderMessagesLoading(false);
      }
    }
  };

  useEffect(() => {
    const targetId = new URLSearchParams(history.location.search).get(
      'conversation',
    );
    if (targetId) void openConversation(targetId);
  }, []);

  const submit = async (
    contentValue?: string,
    scenarioValue?: AiScenario,
    modelAliasValue?: string | null,
    retryContext?: { messageId: string; runId: string } | null,
  ) => {
    const content = (contentValue ?? draft).trim();
    const requestedScenario = scenarioValue ?? scenario;
    const requestedModelAlias =
      modelAliasValue === undefined ? selectedModelAlias : modelAliasValue;
    if (!content || loading) {
      return;
    }
    if (selectedConversationStatus === 'archived' && conversationId) {
      message.warning('已归档会话为只读状态，请新建会话后继续提问。');
      return;
    }
    let resolvedScenario = requestedScenario;
    let requestScenario = requestedScenario;
    if (requestedScenario === 'auto') {
      try {
        resolvedScenario = await resolveAiScenario(content);
        requestScenario = [
          'sales_order_draft',
          'purchase_order_draft',
          'inventory_adjustment_draft',
          'product_setup_draft',
        ].includes(resolvedScenario)
          ? resolvedScenario
          : 'auto';
      } catch (caught) {
        message.error(
          caught instanceof Error ? caught.message : 'AI 场景识别失败',
        );
        return;
      }
    }
    if (
      [
        'product_search',
        'order_query',
        'report_summary',
        'auto',
        'sales_order_draft',
        'purchase_order_draft',
        'inventory_adjustment_draft',
        'product_setup_draft',
      ].includes(resolvedScenario) &&
      !effectiveCompany
    ) {
      message.warning('请先在工作偏好中选择默认公司。');
      return;
    }

    const userMessage = createMessage('user', content);
    const assistantMessage: ChatRow = {
      ...createMessage('assistant', ''),
      ...(retryContext ? { id: retryContext.messageId } : {}),
      creation: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      runStatus: 'running',
      runStream: { deltaCount: 0, streamedChars: 0 },
      runTools: [],
      runWarnings: [],
      scenario: resolvedScenario,
      modelAlias: requestedModelAlias,
      modelSelection: requestedModelAlias ? 'fixed' : 'auto',
      requestedModelDisplay:
        selectableModels.find(
          (model) => model.modelAlias === requestedModelAlias,
        )?.displayName ?? null,
      modelDisplay:
        selectableModels.find(
          (model) => model.modelAlias === requestedModelAlias,
        )?.displayName ?? null,
    };
    setMessages((current) =>
      retryContext
        ? current.map((item) =>
            item.id === retryContext.messageId ? assistantMessage : item,
          )
        : [...current, userMessage, assistantMessage],
    );
    setInspectorOpen(false);
    setInspectedMessageId(null);
    setComposerDraft('', conversationId);
    // 显式场景只约束当前这一次请求。下一条消息重新回到自动识别，
    // 避免订单查询或草稿模式在同一打开会话中持续污染后续意图。
    setScenario('auto');
    setLastResult(null);
    setActiveRunId(null);
    setRunError(null);
    setRunErrorCode(null);
    setRunWarnings([]);
    setToolProgress([]);
    setRunProgress({
      message: '正在准备当前账号的业务查询上下文',
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
        resolvedScenario === 'inventory_adjustment_draft' ||
        resolvedScenario === 'product_setup_draft'
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
          modelAlias: requestedModelAlias,
        };
        const result =
          resolvedScenario === 'sales_order_draft'
            ? await generateAiSalesOrderDraft(draftPayload)
            : resolvedScenario === 'purchase_order_draft'
              ? await generateAiPurchaseOrderDraft(draftPayload)
              : resolvedScenario === 'inventory_adjustment_draft'
                ? await generateAiInventoryAdjustmentDraft(draftPayload)
                : await generateAiProductSetupDraft(draftPayload);
        setConversationId(result.conversationId);
        activeConversationIdRef.current = result.conversationId;
        if (!conversationId) {
          draftByConversationRef.current[
            getConversationDraftKey(result.conversationId)
          ] = '';
        }
        setConversationCompany((current) => current || effectiveCompany);
        setLastResult(result);
        setActiveRunId(result.runId);
        setRunWarnings(result.warnings);
        setRunError(null);
        setRunErrorCode(null);
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
                  run: result.run,
                  runId: result.runId,
                  runResult: result,
                  runStatus: 'completed',
                  modelAlias: result.modelAlias,
                  modelDisplay: result.modelDisplay,
                  modelSelection: result.run.modelSelection,
                  requestedModelDisplay: result.run.requestedModelDisplay,
                  runStream: result.stream,
                  runWarnings: result.warnings,
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
          modelAlias: requestedModelAlias,
          retryRunId: retryContext?.runId ?? null,
          scenario: requestScenario,
        },
        (event) => {
          if (event.type === 'run_started') {
            setRunProgress((current) => ({
              message: '会话已建立，正在准备业务查询上下文',
              phase: 'context_ready',
              startedAt: current?.startedAt ?? Date.now(),
            }));
            const nextConversationId = String(event.conversation ?? '');
            if (nextConversationId) {
              setConversationId(nextConversationId);
              activeConversationIdRef.current = nextConversationId;
              if (!conversationId) {
                draftByConversationRef.current[
                  getConversationDraftKey(nextConversationId)
                ] = '';
              }
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
            const eventModelDisplay = String(event.model_display ?? '').trim();
            const eventModelAlias = String(event.model_alias ?? '').trim();
            if (eventModelDisplay || eventModelAlias) {
              setMessages((current) =>
                current.map((item) =>
                  item.id === assistantMessage.id
                    ? {
                        ...item,
                        modelAlias: eventModelAlias || item.modelAlias,
                        modelDisplay:
                          eventModelDisplay ||
                          eventModelAlias ||
                          item.modelDisplay,
                      }
                    : item,
                ),
              );
            }
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
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantMessage.id
                  ? {
                      ...item,
                      runTools: [
                        ...(item.runTools ?? []).filter(
                          (tool) => tool.name !== toolName,
                        ),
                        { name: toolName, status: 'running' },
                      ],
                    }
                  : item,
              ),
            );
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
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantMessage.id
                  ? {
                      ...item,
                      runTools: [
                        ...(item.runTools ?? []).filter(
                          (tool) => tool.name !== toolName,
                        ),
                        {
                          name: toolName,
                          resultCount:
                            event.result_count === undefined
                              ? undefined
                              : Number(event.result_count),
                          status: 'completed',
                        },
                      ],
                    }
                  : item,
              ),
            );
          }
          if (event.type === 'warning') {
            const warning = String(event.message ?? '').trim();
            if (warning) {
              setRunWarnings((current) =>
                current.includes(warning) ? current : [...current, warning],
              );
              setMessages((current) =>
                current.map((item) =>
                  item.id === assistantMessage.id
                    ? {
                        ...item,
                        runWarnings: item.runWarnings?.includes(warning)
                          ? item.runWarnings
                          : [...(item.runWarnings ?? []), warning],
                      }
                    : item,
                ),
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
                  ? {
                      ...item,
                      content: `${item.content}${delta}`,
                      runStream: {
                        deltaCount: (item.runStream?.deltaCount ?? 0) + 1,
                        streamedChars:
                          (item.runStream?.streamedChars ?? 0) + delta.length,
                      },
                    }
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
      if (result.run.status === 'waiting_approval' && result.approval) {
        setConversationId(result.conversationId);
        activeConversationIdRef.current = result.conversationId;
        setConversationCompany((current) => current || effectiveCompany);
        setLastResult(result);
        setActiveRunId(result.runId);
        setRunWarnings([]);
        setRunError(null);
        setRunErrorCode(null);
        setRetryRequest(null);
        setRunStatus('waiting_approval');
        setRunProgress(null);
        approvalRefreshSequenceRef.current += 1;
        setPendingApprovals((current) => [
          result.approval as AiAgentApproval,
          ...current.filter(
            (item) => item.approvalId !== result.approval?.approvalId,
          ),
        ]);
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantMessage.id
              ? {
                  ...item,
                  approval: result.approval,
                  content: result.message.content,
                  run: result.run,
                  runId: result.runId,
                  runResult: result,
                  runStatus: 'waiting_approval',
                  modelAlias: result.modelAlias,
                  modelDisplay: result.modelDisplay,
                  modelSelection: result.run.modelSelection,
                  requestedModelDisplay: result.run.requestedModelDisplay,
                }
              : item,
          ),
        );
        await refreshConversations();
        return;
      }
      setConversationId(result.conversationId);
      activeConversationIdRef.current = result.conversationId;
      if (!conversationId) {
        draftByConversationRef.current[
          getConversationDraftKey(result.conversationId)
        ] = '';
      }
      setConversationStatus('active');
      setSelectedConversationStatus('active');
      setConversationCompany((current) => current || effectiveCompany);
      setLastResult(result);
      setActiveRunId(result.runId);
      setRunWarnings(result.warnings);
      setRunError(null);
      setRunErrorCode(null);
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
                run: result.run,
                runId: result.runId,
                runResult: result,
                runStatus: 'completed',
                modelAlias: result.modelAlias,
                modelDisplay: result.modelDisplay,
                modelSelection: result.run.modelSelection,
                requestedModelDisplay: result.run.requestedModelDisplay,
                runStream: result.stream,
                runWarnings: Array.from(
                  new Set([...(item.runWarnings ?? []), ...result.warnings]),
                ),
              }
            : item,
        ),
      );
      await refreshConversations();
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        setRunStatus('stopped');
        setRunProgress(null);
        setRetryRequest({
          content,
          messageId: assistantMessage.id,
          runId: null,
          scenario: resolvedScenario,
        });
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantMessage.id
              ? { ...item, runStatus: 'stopped' }
              : item,
          ),
        );
        message.info('已停止本次生成，当前已接收内容会保留。');
      } else {
        setRunStatus('failed');
        setRunProgress(null);
        const errorMessage =
          caught instanceof Error ? caught.message : 'AI 服务调用失败';
        const errorCode = getAiErrorCode(caught);
        const errorModel = getAiErrorModelDetails(caught);
        const failedRunId =
          caught &&
          typeof caught === 'object' &&
          typeof (caught as { runId?: unknown }).runId === 'string'
            ? (caught as { runId: string }).runId || null
            : null;
        if (failedRunId) setActiveRunId(failedRunId);
        setRunError(errorMessage);
        setRunErrorCode(errorCode);
        setRetryRequest({
          content,
          messageId: assistantMessage.id,
          runId: failedRunId ?? null,
          scenario: resolvedScenario,
        });
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantMessage.id
              ? {
                  ...item,
                  error: errorMessage,
                  errorCode,
                  modelAlias: errorModel.modelAlias ?? item.modelAlias,
                  modelDisplay:
                    errorModel.modelDisplay ??
                    errorModel.modelAlias ??
                    item.modelDisplay,
                  runId: failedRunId ?? item.runId,
                  runStatus: 'failed',
                }
              : item,
          ),
        );
        message.error(errorMessage);
      }
    } finally {
      streamAbortRef.current = null;
      setLoading(false);
    }
  };

  const stopGeneration = () => {
    const runId = activeRunId;
    if (runId) {
      void cancelAiRun(runId).catch(() => {
        message.warning('生成已停止，但运行状态确认失败，请稍后刷新。');
      });
    }
    streamAbortRef.current?.abort();
  };

  const applyApprovalDecision = async (
    approval: AiAgentApproval,
    decision: 'approved' | 'rejected',
    reason?: string,
  ) => {
    setApprovalActionId(approval.approvalId);
    try {
      await reviewAiAgentApproval(approval, decision, reason);
      approvalRefreshSequenceRef.current += 1;
      setPendingApprovals((current) =>
        current.filter((item) => item.approvalId !== approval.approvalId),
      );
      await refreshPendingApprovals();
      if (approval.conversationId) {
        await openConversation(approval.conversationId, true);
      }
    } catch (caught) {
      message.error(
        caught instanceof Error ? caught.message : 'Agent 审批处理失败',
      );
    } finally {
      setApprovalActionId(null);
    }
  };

  const approveAgentCall = (approval: AiAgentApproval) => {
    Modal.confirm({
      title: '批准并继续此工具调用？',
      content: '系统只会恢复原 Run，并执行审批时绑定的原始工具参数。',
      okText: '批准并继续',
      cancelText: '取消',
      onOk: () => applyApprovalDecision(approval, 'approved'),
    });
  };

  const rejectAgentCall = (approval: AiAgentApproval) => {
    let reason = '';
    Modal.confirm({
      title: '拒绝此工具调用？',
      content: (
        <Input.TextArea
          aria-label="拒绝 Agent 工具调用的原因"
          onChange={(event) => {
            reason = event.target.value;
          }}
          placeholder="请填写拒绝原因"
          rows={3}
        />
      ),
      okButtonProps: { danger: true },
      okText: '拒绝并继续',
      cancelText: '取消',
      onOk: () => {
        if (!reason.trim()) {
          message.warning('拒绝工具调用时必须填写原因。');
          return Promise.reject();
        }
        return applyApprovalDecision(approval, 'rejected', reason.trim());
      },
    });
  };

  const editFailedRequest = () => {
    if (!retryRequest) return;
    setComposerDraft(retryRequest.content, conversationId);
    setScenario(retryRequest.scenario);
    message.info('已恢复上次问题；发送时将使用页头当前选择的模型。');
  };

  const handoffDraft = async (draftId: string) => {
    try {
      const { draftType, payload } = await prepareAiDraftHandoff(draftId);
      const isProduct = draftType === 'product_setup';
      const isPurchase = draftType === 'purchase_order';
      const isInventory = draftType === 'inventory_adjustment';
      sessionStorage.setItem(
        `myapp:ai-${isProduct ? 'product-setup' : isInventory ? 'inventory-adjustment' : isPurchase ? 'purchase' : 'sales'}-draft:${draftId}`,
        JSON.stringify(payload),
      );
      history.push(
        `${isProduct ? '/master-data/products' : isInventory ? '/inventory/adjustments' : isPurchase ? '/purchase/orders/new' : '/sales/orders/new'}?ai_draft=${encodeURIComponent(draftId)}`,
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
      await refreshConversations();
      message.success('AI 草稿已放弃');
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '草稿放弃失败');
    }
  };

  const applyUpdatedDraft = (updated: AiDraft) => {
    setMessages((current) =>
      current.map((item) => ({
        ...item,
        citations: item.citations?.map((citation) =>
          citation.id === updated.name
            ? {
                ...citation,
                data: {
                  ...citation.data,
                  execution: updated.execution
                    ? {
                        executed_at: updated.execution.executedAt,
                        executed_by: updated.execution.executedBy,
                        request_id: updated.execution.requestId,
                        result: updated.execution.result,
                        target_doctype: updated.execution.targetDoctype,
                        target_name: updated.execution.targetName,
                      }
                    : null,
                  payload: updated.payload,
                  modified: updated.modified,
                  status: updated.status,
                  validation: {
                    errors: updated.validation.errors,
                    ready_for_handoff: updated.validation.readyForHandoff,
                    warnings: updated.validation.warnings,
                  },
                  version: updated.version,
                },
              }
            : citation,
        ),
      })),
    );
    if (updated.status !== 'draft') {
      void refreshConversations();
    }
  };

  const refreshBusinessResult = async (
    messageId: string,
    resultSet: AiBusinessResultSet,
  ) => {
    const refreshed = await refreshAiBusinessResult(resultSet);
    setMessages((current) =>
      current.map((item) =>
        item.id === messageId
          ? {
              ...item,
              citations: [
                ...(item.citations ?? []).filter(
                  (citation) =>
                    !BUSINESS_RESULT_CITATION_TYPES.has(citation.type),
                ),
                ...refreshed.citations,
              ],
            }
          : item,
      ),
    );
    message.success('已按当前账号权限刷新业务数据');
  };

  const openDraftEditor = (
    citation: NonNullable<AiChatMessage['citations']>[number],
  ) => {
    const draftId = String(citation.id ?? '');
    setEditingDraftId(draftId);
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
    const expectedVersion = Number(draftVersions[0]?.version ?? 0);
    if (expectedVersion < 1) {
      message.error('当前草稿版本不可用，请重新打开版本历史。');
      return;
    }
    setVersionLoading(true);
    try {
      const updated = await restoreAiDraftVersion(
        historyDraftId,
        version,
        expectedVersion,
      );
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
    rememberCurrentComposerDraft();
    setConversationId(null);
    activeConversationIdRef.current = null;
    setSelectedConversationStatus(null);
    setConversationCompany(null);
    setConversationContext(null);
    setMessages([]);
    setMessagePagination(EMPTY_MESSAGE_PAGINATION);
    setOlderMessagesLoading(false);
    pendingPrependScrollRef.current = null;
    setFeedbackByRun({});
    setLastResult(null);
    setActiveRunId(null);
    setRunError(null);
    setRunErrorCode(null);
    setRunWarnings([]);
    setToolProgress([]);
    setRunProgress(null);
    setRetryRequest(null);
    setRunStatus('idle');
    setInspectorOpen(false);
    setInspectedMessageId(null);
    setComposerDraft(
      draftByConversationRef.current[NEW_CONVERSATION_DRAFT_KEY] ?? '',
      null,
    );
    setScenario('auto');
  };

  const archiveCurrentConversation = async () => {
    if (!conversationId || loading) {
      return;
    }
    try {
      await archiveAiConversation(conversationId);
      resetConversation();
      delete draftByConversationRef.current[
        getConversationDraftKey(conversationId)
      ];
      await refreshConversations();
      message.success('会话已归档');
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '会话归档失败');
    }
  };

  const clearCurrentConversationContext = () => {
    if (!conversationId || loading || selectedConversationStatus !== 'active') {
      return;
    }
    Modal.confirm({
      title: '清除当前会话上下文？',
      content:
        '只清除后续提问会继承的商品、筛选和结果集状态，历史消息仍会保留。',
      okText: '清除上下文',
      cancelText: '取消',
      onOk: async () => {
        const context = await resetAiConversationContext(conversationId);
        if (activeConversationIdRef.current === conversationId) {
          setConversationContext(context);
        }
        message.success('会话上下文已清除');
      },
    });
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

  const openConversationRename = (targetId: string) => {
    const target = conversations.find((item) => item.name === targetId);
    if (!target) return;
    setRenameTarget(target);
    setRenameTitle(target.title);
  };

  const submitConversationRename = async () => {
    if (!renameTarget) return;
    const title = renameTitle.trim();
    if (!title) {
      message.warning('请输入会话名称');
      return;
    }
    setRenaming(true);
    try {
      await renameAiConversation(renameTarget.name, title);
      setRenameTarget(null);
      setRenameTitle('');
      await refreshConversations();
      message.success('会话名称已更新');
    } catch (caught) {
      message.error(
        caught instanceof Error ? caught.message : '会话重命名失败',
      );
    } finally {
      setRenaming(false);
    }
  };

  const archiveConversationById = async (targetId: string) => {
    try {
      await archiveAiConversation(targetId);
      if (conversationId === targetId) resetConversation();
      delete draftByConversationRef.current[getConversationDraftKey(targetId)];
      await refreshConversations();
      message.success('会话已归档');
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '会话归档失败');
    }
  };

  const buildConversationMenu = (target: { key: string }) => ({
    items: [
      {
        icon: <EditOutlined />,
        key: 'rename',
        label: '重命名',
      },
      ...(conversationStatus === 'active'
        ? [
            {
              icon: <InboxOutlined />,
              key: 'archive',
              label: '归档会话',
            },
          ]
        : []),
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'rename') openConversationRename(target.key);
      if (key === 'archive') void archiveConversationById(target.key);
    },
  });

  const conversationItems = conversations.map((item) => {
    const lastMessageAt = item.lastMessageAt ? dayjs(item.lastMessageAt) : null;
    const group = lastMessageAt?.isSame(dayjs(), 'day')
      ? '今天'
      : lastMessageAt?.isSame(dayjs().subtract(1, 'day'), 'day')
        ? '昨天'
        : '更早';
    const updatedAt = lastMessageAt
      ? lastMessageAt.isSame(dayjs(), 'day')
        ? lastMessageAt.format('HH:mm')
        : lastMessageAt.format('MM-DD HH:mm')
      : '暂无消息';
    return {
      key: item.name,
      className: styles.conversationItem,
      group,
      label: (
        <Space
          className={styles.conversationLabel}
          orientation="vertical"
          size={0}
        >
          <Typography.Text className={styles.conversationTitle} ellipsis>
            {item.title}
          </Typography.Text>
          <Typography.Text className={styles.conversationMeta} type="secondary">
            {item.messageCount} 条消息 · {updatedAt}
            {item.company ? ` · ${item.company}` : ''}
          </Typography.Text>
          {item.pendingDraftCount > 0 ? (
            <Tag
              className={styles.conversationDraftTag}
              color="orange"
              variant="filled"
            >
              待复核草稿 {item.pendingDraftCount}
            </Tag>
          ) : null}
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

  const openMessageRun = (messageId: string) => {
    setInspectedMessageId(messageId);
    setInspectorOpen(true);
  };

  const openCurrentRun = () => {
    const currentMessage = [...messages]
      .reverse()
      .find(
        (item) => item.role === 'assistant' && item.runStatus === 'running',
      );
    setInspectedMessageId(currentMessage?.id ?? null);
    setInspectorOpen(true);
  };

  const inspectedMessageIndex = inspectedMessageId
    ? messages.findIndex((item) => item.id === inspectedMessageId)
    : -1;
  const inspectedMessage =
    inspectedMessageIndex >= 0 ? messages[inspectedMessageIndex] : null;
  const inspectedResult = inspectedMessage
    ? (inspectedMessage.runResult ??
      buildMessageRunResult(inspectedMessage, conversationId))
    : lastResult;
  const inspectedStatus =
    inspectedMessage?.runStatus ??
    (inspectedMessage
      ? resolveRunDisplayStatus(inspectedMessage.run?.status)
      : runStatus);
  const inspectedRunId = inspectedMessage
    ? (inspectedMessage.runId ?? null)
    : activeRunId;
  const inspectedError = inspectedMessage
    ? (inspectedMessage.error ?? inspectedMessage.run?.error ?? null)
    : runError;
  const inspectedErrorCode = inspectedMessage
    ? (inspectedMessage.errorCode ?? inspectedMessage.run?.errorCode ?? null)
    : runErrorCode;
  const inspectedTools = inspectedMessage?.runTools ?? toolProgress;
  const inspectedWarnings = inspectedMessage?.runWarnings ?? runWarnings;
  const canRecoverInspectedRun = Boolean(
    inspectedMessage?.error &&
      inspectedMessageIndex === messages.length - 1 &&
      selectedConversationStatus !== 'archived' &&
      retryRequest,
  );
  const activeApproval = pendingApprovals.find(
    (approval) =>
      approval.status === 'pending' &&
      ((conversationId && approval.conversationId === conversationId) ||
        (!conversationId && approval.runId === activeRunId)),
  );

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
          error={item.error}
          errorCode={item.errorCode}
          feedback={item.runId ? feedbackByRun[item.runId] : undefined}
          onDiscardDraft={(draftId) => void discardDraft(draftId)}
          onEditDraft={openDraftEditor}
          onEditRequest={
            selectedConversationStatus !== 'archived' &&
            item.error &&
            retryRequest &&
            index === messages.length - 1
              ? editFailedRequest
              : undefined
          }
          onFeedback={(rating) =>
            item.runId
              ? rating === 'positive'
                ? void submitFeedback(item.runId, rating)
                : setNegativeFeedbackRunId(item.runId)
              : undefined
          }
          onHandoffDraft={(draftId) => void handoffDraft(draftId)}
          onOpenBusinessDocument={setBusinessDocument}
          onOpenDraftHistory={(draftId) => void openVersionHistory(draftId)}
          onOpenProduct={setProductCitation}
          onRefreshBusinessResult={
            loading && index === messages.length - 1
              ? undefined
              : (resultSet) => refreshBusinessResult(item.id, resultSet)
          }
          onRetry={
            selectedConversationStatus !== 'archived' &&
            item.error &&
            retryRequest &&
            index === messages.length - 1
              ? () =>
                  void submit(
                    retryRequest.content,
                    retryRequest.scenario,
                    selectedModelAlias,
                    retryRequest.runId &&
                      !isDraftScenario(retryRequest.scenario)
                      ? {
                          messageId: retryRequest.messageId,
                          runId: retryRequest.runId,
                        }
                      : null,
                  )
              : undefined
          }
          onViewDiagnostics={
            item.error ? () => openMessageRun(item.id) : undefined
          }
          onViewRun={item.runId ? () => openMessageRun(item.id) : undefined}
          modelDisplay={item.modelDisplay}
          modelSelection={item.modelSelection}
          requestedModelDisplay={item.requestedModelDisplay}
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
                <Tag color="processing" variant="filled">
                  {conversationTotal}
                </Tag>
              </div>
              <Input.Search
                allowClear
                aria-label="搜索 AI 会话"
                onChange={(event) => {
                  const value = event.target.value;
                  setConversationSearchInput(value);
                  if (!value) setConversationSearch('');
                }}
                onSearch={(value) => setConversationSearch(value.trim())}
                placeholder="搜索标题或消息内容"
                value={conversationSearchInput}
              />
              <Select
                onChange={(value) => {
                  setConversationStatus(value);
                  resetConversation();
                }}
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
                  menu={buildConversationMenu}
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
                <Badge
                  count={pendingDraftTotal}
                  overflowCount={99}
                  size="small"
                >
                  <Button onClick={() => history.push('/ai/drafts')}>
                    我的草稿
                  </Button>
                </Badge>
                {loading ? (
                  <Button
                    aria-label="当前运行"
                    icon={<DashboardOutlined />}
                    onClick={openCurrentRun}
                  >
                    当前运行
                  </Button>
                ) : null}
              </Space>
            </div>
            <div className={styles.contextBar}>
              <Space wrap>
                <Tag color={scenario === 'auto' ? 'processing' : 'blue'}>
                  {SCENARIO_OPTIONS.find((option) => option.value === scenario)
                    ?.label ?? '智能模式'}
                  {scenario !== 'auto' ? ' · 仅本次发送' : ''}
                </Tag>
                {workspaceCapabilities.canSelectFixedModel ? (
                  <Space size={6}>
                    <Typography.Text id="ai-quick-model-label" type="secondary">
                      运行模型
                    </Typography.Text>
                    <Select
                      aria-labelledby="ai-quick-model-label"
                      className="ai-quick-model-select"
                      disabled={loading}
                      loading={modelsLoading}
                      onChange={(value) =>
                        setSelectedModelAlias(value === 'auto' ? null : value)
                      }
                      optionFilterProp="label"
                      options={modelSelectOptions}
                      showSearch
                      style={{ minWidth: 240 }}
                      value={selectedModelAlias ?? 'auto'}
                    />
                  </Space>
                ) : (
                  <Tag color="purple">{automaticModelLabel}</Tag>
                )}
                <Button
                  icon={<SettingOutlined />}
                  onClick={() => setAdvancedSettingsOpen(true)}
                  size="small"
                >
                  高级设置
                </Button>
                {conversationId && effectiveCompany ? (
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
                    <LockOutlined /> 会话公司：{effectiveCompany}
                  </Tag>
                ) : (
                  <Space size={6}>
                    <Typography.Text type="secondary">查询公司</Typography.Text>
                    <RemoteLinkSelect
                      doctype="Company"
                      onChange={(value) => setSelectedCompany(value || null)}
                      placeholder="选择公司"
                      style={{ width: 220 }}
                      value={effectiveCompany ?? undefined}
                    />
                  </Space>
                )}
              </Space>
              <Space wrap>
                <Tag
                  color="success"
                  icon={<SafetyCertificateOutlined />}
                  variant="filled"
                >
                  按当前账号权限查询 · 写操作需确认
                </Tag>
                {conversationId && conversationContext ? (
                  <Tag
                    color={
                      conversationContext.status === 'active'
                        ? 'cyan'
                        : conversationContext.status === 'expired'
                          ? 'gold'
                          : undefined
                    }
                  >
                    {conversationContext.status === 'active'
                      ? '会话上下文有效'
                      : conversationContext.status === 'expired'
                        ? '会话上下文已过期'
                        : '会话上下文已清除'}
                  </Tag>
                ) : null}
                {conversationId && selectedConversationStatus === 'active' ? (
                  <Space size={6}>
                    <Button
                      icon={<ClearOutlined />}
                      onClick={clearCurrentConversationContext}
                      size="small"
                    >
                      清除上下文
                    </Button>
                    <Button
                      icon={<InboxOutlined />}
                      onClick={() => void archiveCurrentConversation()}
                      size="small"
                    >
                      归档
                    </Button>
                  </Space>
                ) : null}
              </Space>
            </div>

            {messages.length ? (
              <div className={styles.messages} ref={messagesViewportRef}>
                {messagePagination.hasMore ? (
                  <div className={styles.messageHistoryBar}>
                    <Button
                      disabled={loading || conversationLoading}
                      loading={olderMessagesLoading}
                      onClick={() => void loadOlderMessages()}
                      size="small"
                    >
                      加载更早消息（已显示 {messages.length} /{' '}
                      {Math.max(messagePagination.total, messages.length)}）
                    </Button>
                  </div>
                ) : messagePagination.total > messages.length ? (
                  <Typography.Text
                    className={styles.messageHistoryBar}
                    type="secondary"
                  >
                    已显示最近 {messages.length} 条消息
                  </Typography.Text>
                ) : null}
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
                {selectedConversationStatus !== 'archived' ? (
                  <Prompts
                    className={styles.promptGrid}
                    items={promptItems}
                    onItemClick={({ data }) => {
                      const prompt = EXAMPLE_PROMPTS[Number(data.key)];
                      if (prompt) {
                        setComposerDraft(prompt.content, conversationId);
                        setScenario(prompt.scenario);
                      }
                    }}
                    title="常用能力"
                    wrap
                  />
                ) : null}
              </div>
            )}

            <div className={styles.composer}>
              <div className={styles.composerInner}>
                {activeApproval ? (
                  <Alert
                    action={
                      <Space wrap>
                        <Button
                          danger
                          disabled={Boolean(approvalActionId)}
                          onClick={() => rejectAgentCall(activeApproval)}
                          size="small"
                        >
                          拒绝
                        </Button>
                        <Button
                          loading={
                            approvalActionId === activeApproval.approvalId
                          }
                          onClick={() => approveAgentCall(activeApproval)}
                          size="small"
                          type="primary"
                        >
                          批准并继续
                        </Button>
                      </Space>
                    }
                    description={
                      <Space orientation="vertical" size={4}>
                        <Typography.Text>
                          工具：{activeApproval.tool} · 风险等级：
                          {activeApproval.riskLevel || '未标记'}
                        </Typography.Text>
                        <Typography.Text code ellipsis>
                          {JSON.stringify(activeApproval.argumentsSummary)}
                        </Typography.Text>
                        <Typography.Text type="secondary">
                          审批绑定原 Run、call_id
                          和参数哈希，批准后不能替换参数。
                        </Typography.Text>
                      </Space>
                    }
                    showIcon
                    style={{ marginBottom: 8 }}
                    title="AI Run 正在等待人工审批"
                    type="warning"
                  />
                ) : null}
                {selectedConversationStatus === 'archived' && conversationId ? (
                  <Alert
                    action={
                      <Button
                        onClick={() => {
                          setConversationStatus('active');
                          resetConversation();
                        }}
                        size="small"
                        type="primary"
                      >
                        新建会话
                      </Button>
                    }
                    description="归档会话保留历史记录，不能继续追加消息。"
                    showIcon
                    style={{ marginBottom: 8 }}
                    title="当前会话为只读状态"
                    type="info"
                  />
                ) : null}
                <Sender
                  autoSize={{ minRows: 2, maxRows: 7 }}
                  disabled={
                    (selectedConversationStatus === 'archived' &&
                      Boolean(conversationId)) ||
                    Boolean(activeApproval)
                  }
                  loading={loading}
                  onCancel={stopGeneration}
                  onChange={(value) => setComposerDraft(value, conversationId)}
                  onSubmit={(value) => void submit(value)}
                  placeholder={
                    selectedConversationStatus === 'archived' && conversationId
                      ? '归档会话为只读状态'
                      : activeApproval
                        ? '请先处理当前 Run 的工具审批'
                        : '输入业务问题；Enter 发送，Shift+Enter 换行'
                  }
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
          size={360}
        >
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Input.Search
              allowClear
              aria-label="移动端搜索 AI 会话"
              onChange={(event) => {
                const value = event.target.value;
                setConversationSearchInput(value);
                if (!value) setConversationSearch('');
              }}
              onSearch={(value) => setConversationSearch(value.trim())}
              placeholder="搜索标题或消息内容"
              value={conversationSearchInput}
            />
            <Select
              onChange={(value) => {
                setConversationStatus(value);
                resetConversation();
              }}
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
                menu={buildConversationMenu}
                onActiveChange={(key) => {
                  setConversationDrawerOpen(false);
                  void openConversation(key);
                }}
              />
            </Spin>
          </Space>
        </Drawer>
        <Drawer
          onClose={() => setAdvancedSettingsOpen(false)}
          open={advancedSettingsOpen}
          title="AI 高级设置"
          size={420}
        >
          <Space orientation="vertical" size={20} style={{ width: '100%' }}>
            <Alert
              description="默认智能模式会在每次发送前由 Frappe 根据问题识别业务场景。固定场景只影响下一次发送，不会改变会话权限或公司范围。"
              showIcon
              title="保持智能模式更适合日常使用"
              type="info"
            />
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              <Typography.Text strong>本次业务场景</Typography.Text>
              <Select
                aria-label="AI 场景"
                disabled={loading}
                onChange={setScenario}
                options={SCENARIO_OPTIONS}
                style={{ width: '100%' }}
                value={scenario}
              />
              <Typography.Text type="secondary">
                发送开始后自动恢复智能模式，避免固定场景影响后续问题。
              </Typography.Text>
            </Space>
            {workspaceCapabilities.canSelectFixedModel ? (
              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                <Typography.Text strong>运行模型</Typography.Text>
                <Select
                  aria-label="AI 模型"
                  disabled={loading}
                  loading={modelsLoading}
                  onChange={(value) =>
                    setSelectedModelAlias(value === 'auto' ? null : value)
                  }
                  optionFilterProp="label"
                  options={modelSelectOptions}
                  showSearch
                  style={{ width: '100%' }}
                  value={selectedModelAlias ?? 'auto'}
                />
                <Typography.Text type="secondary">
                  友好名称优先显示，技术 alias 仅用于治理人员核对。
                </Typography.Text>
              </Space>
            ) : (
              <Alert
                description="当前账号使用已发布模型策略，浏览器不会获得内部模型清单或提交固定模型覆盖。"
                showIcon
                title="模型由策略自动选择"
                type="success"
              />
            )}
          </Space>
        </Drawer>
        <BusinessDocumentDrawer
          document={businessDocument}
          onClose={() => setBusinessDocument(null)}
        />
        <ProductDetailDrawer
          citation={productCitation}
          onClose={() => setProductCitation(null)}
        />
        <Drawer
          onClose={() => {
            setInspectorOpen(false);
            setInspectedMessageId(null);
          }}
          open={inspectorOpen}
          title={inspectedStatus === 'running' ? '当前运行' : '运行详情'}
          size={440}
        >
          <div className={styles.drawerContent}>
            <Alert
              description="AI 只生成并校验候选；正式商品、订单或库存调整必须由当前用户明确确认，并继续通过既有业务权限、幂等和审计服务执行。"
              icon={<SafetyCertificateOutlined />}
              showIcon
              title="安全边界"
              type="info"
            />
            <AiRunInspector
              activeRunId={inspectedRunId}
              company={effectiveCompany}
              createdAt={inspectedMessage?.creation}
              error={inspectedError}
              errorCode={inspectedErrorCode}
              modelAlias={inspectedMessage?.modelAlias ?? null}
              modelDisplay={inspectedMessage?.modelDisplay ?? null}
              onEditRequest={
                canRecoverInspectedRun ? editFailedRequest : undefined
              }
              onRetry={
                canRecoverInspectedRun && retryRequest
                  ? () =>
                      void submit(
                        retryRequest.content,
                        retryRequest.scenario,
                        selectedModelAlias,
                        retryRequest.runId &&
                          !isDraftScenario(retryRequest.scenario)
                          ? {
                              messageId: retryRequest.messageId,
                              runId: retryRequest.runId,
                            }
                          : null,
                      )
                  : undefined
              }
              result={inspectedResult}
              scenario={inspectedMessage?.scenario}
              showAdvancedDiagnostics={
                workspaceCapabilities.canViewAdvancedDiagnostics
              }
              status={inspectedStatus}
              tools={inspectedTools}
              warnings={inspectedWarnings}
            />
          </div>
        </Drawer>
      </XProvider>
      <Modal
        confirmLoading={renaming}
        okText="保存名称"
        onCancel={() => {
          if (renaming) return;
          setRenameTarget(null);
          setRenameTitle('');
        }}
        onOk={() => void submitConversationRename()}
        open={Boolean(renameTarget)}
        title="重命名会话"
      >
        <Input
          aria-label="会话名称"
          maxLength={120}
          onChange={(event) => setRenameTitle(event.target.value)}
          onPressEnter={() => void submitConversationRename()}
          placeholder="输入便于识别的会话名称"
          showCount
          value={renameTitle}
        />
      </Modal>
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
      <AiDraftEditorModal
        draftId={editingDraftId}
        onClose={() => setEditingDraftId(null)}
        onLoaded={applyUpdatedDraft}
        onUpdated={applyUpdatedDraft}
      />
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
