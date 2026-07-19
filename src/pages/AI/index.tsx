import {
  AppstoreOutlined,
  BarChartOutlined,
  DashboardOutlined,
  FileTextOutlined,
  InboxOutlined,
  LockOutlined,
  MenuOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
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
  type AiBusinessDocumentResult,
  type AiChatMessage,
  type AiChatResult,
  type AiCitation,
  type AiConversation,
  type AiDraft,
  type AiScenario,
  archiveAiConversation,
  discardAiDraft,
  executeAiDraft,
  generateAiInventoryAdjustmentDraft,
  generateAiProductSetupDraft,
  generateAiPurchaseOrderDraft,
  generateAiSalesOrderDraft,
  getAiConversation,
  listAiConversations,
  listAiDraftVersions,
  listAiSelectableModels,
  prepareAiDraftHandoff,
  resolveAiScenario,
  restoreAiDraftVersion,
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
  const [messages, setMessages] = useState<ChatRow[]>([]);
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [conversationStatus, setConversationStatus] = useState<
    'active' | 'archived'
  >('active');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationCompany, setConversationCompany] = useState<string | null>(
    null,
  );
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
  const [runWarnings, setRunWarnings] = useState<string[]>([]);
  const [toolProgress, setToolProgress] = useState<AiToolProgress[]>([]);
  const [retryRequest, setRetryRequest] = useState<{
    content: string;
    modelAlias: string | null;
    scenario: AiScenario;
  } | null>(null);
  const [selectableModels, setSelectableModels] = useState<
    Awaited<ReturnType<typeof listAiSelectableModels>>
  >([]);
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
  const [conversationDrawerOpen, setConversationDrawerOpen] = useState(false);
  const [businessDocument, setBusinessDocument] =
    useState<AiBusinessDocumentResult | null>(null);
  const [productCitation, setProductCitation] = useState<AiCitation | null>(
    null,
  );
  const streamAbortRef = useRef<AbortController | null>(null);
  const effectiveCompany = conversationId
    ? conversationCompany || defaultCompany
    : selectedCompany || defaultCompany;

  useEffect(() => {
    if (!conversationId && !selectedCompany && defaultCompany) {
      setSelectedCompany(defaultCompany);
    }
  }, [conversationId, defaultCompany, selectedCompany]);

  useEffect(() => {
    let active = true;
    setModelsLoading(true);
    void listAiSelectableModels()
      .then((models) => {
        if (!active) return;
        setSelectableModels(models);
        setSelectedModelAlias((current) =>
          current && models.some((model) => model.modelAlias === current)
            ? current
            : null,
        );
      })
      .catch(() => {
        if (active) setSelectableModels([]);
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
      // 历史消息保存的是每次请求最终执行的场景，不代表用户希望把后续
      // 问题永久锁定到该场景。重新打开会话时恢复自动识别，避免上一轮
      // 订单查询把后续商品创建等不同意图继续错误路由到 order_query。
      setScenario('auto');
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

  const submit = async (
    contentValue?: string,
    scenarioValue?: AiScenario,
    modelAliasValue?: string | null,
  ) => {
    const content = (contentValue ?? draft).trim();
    const requestedScenario = scenarioValue ?? scenario;
    const requestedModelAlias =
      modelAliasValue === undefined ? selectedModelAlias : modelAliasValue;
    if (!content || loading) {
      return;
    }
    if (conversationStatus === 'archived' && conversationId) {
      message.warning('已归档会话为只读状态，请新建会话后继续提问。');
      return;
    }
    let resolvedScenario = requestedScenario;
    if (requestedScenario === 'auto') {
      try {
        resolvedScenario = await resolveAiScenario(content);
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
    const assistantMessage = createMessage('assistant', '');
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setDraft('');
    // 显式场景只约束当前这一次请求。下一条消息重新回到自动识别，
    // 避免订单查询或草稿模式在同一打开会话中持续污染后续意图。
    setScenario('auto');
    setLastResult(null);
    setActiveRunId(null);
    setRunError(null);
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
          modelAlias: requestedModelAlias,
          scenario: resolvedScenario,
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
        setRetryRequest({
          content,
          modelAlias: requestedModelAlias,
          scenario: resolvedScenario,
        });
        message.info('已停止本次生成，当前已接收内容会保留。');
      } else {
        setRunStatus('failed');
        setRunProgress(null);
        setRunError(
          caught instanceof Error ? caught.message : 'AI 服务调用失败',
        );
        setRetryRequest({
          content,
          modelAlias: requestedModelAlias,
          scenario: resolvedScenario,
        });
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
      message.success('AI 草稿已放弃');
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '草稿放弃失败');
    }
  };

  const executeDraft = (draftId: string, version: number) => {
    const citation = messages
      .flatMap((item) => item.citations ?? [])
      .find((item) => item.id === draftId);
    const draftType = String(citation?.data.draft_type ?? 'business');
    const typeLabel =
      draftType === 'product_setup'
        ? '商品建档'
        : draftType === 'purchase_order'
          ? '采购订单'
          : draftType === 'inventory_adjustment'
            ? '库存调整'
            : '销售订单';
    Modal.confirm({
      content:
        '系统会使用当前草稿版本重新执行权限、主数据、单位、价格或库存校验，并调用正式业务服务。成功后将生成不可变业务回执。',
      okText: `确认执行${typeLabel}`,
      onOk: async () => {
        const result = await executeAiDraft(draftId, version);
        setMessages((current) =>
          current.map((item) => ({
            ...item,
            citations: item.citations?.map((currentCitation) =>
              currentCitation.id === draftId
                ? {
                    ...currentCitation,
                    data: {
                      ...currentCitation.data,
                      execution: {
                        executed_at: result.execution.executedAt,
                        executed_by: result.execution.executedBy,
                        request_id: result.execution.requestId,
                        result: result.execution.result,
                        target_doctype: result.execution.targetDoctype,
                        target_name: result.execution.targetName,
                      },
                      status: result.draft.status,
                      version: result.draft.version,
                    },
                  }
                : currentCitation,
            ),
          })),
        );
      },
      title: `确认执行草稿 ${draftId}？`,
    });
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
    setScenario('auto');
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
          onExecuteDraft={executeDraft}
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
                  aria-label="AI 场景"
                  disabled={loading}
                  onChange={setScenario}
                  options={SCENARIO_OPTIONS}
                  value={scenario}
                />
                <Select
                  aria-label="AI 模型"
                  loading={modelsLoading}
                  onChange={(value) =>
                    setSelectedModelAlias(value === 'auto' ? null : value)
                  }
                  optionFilterProp="label"
                  options={[
                    { label: '自动选择（策略）', value: 'auto' },
                    ...selectableModels.map((model) => ({
                      label: model.modelAlias,
                      value: model.modelAlias,
                    })),
                  ]}
                  showSearch
                  style={{ minWidth: 240 }}
                  value={selectedModelAlias ?? 'auto'}
                />
                {selectedModelAlias ? (
                  <Tag color="purple">固定模型：{selectedModelAlias}</Tag>
                ) : null}
                {scenario !== 'auto' ? (
                  <Tag color="blue">仅本次发送</Tag>
                ) : null}
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
                  bordered={false}
                  color="success"
                  icon={<SafetyCertificateOutlined />}
                >
                  按当前账号权限查询 · 写操作需确认
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
        <BusinessDocumentDrawer
          document={businessDocument}
          onClose={() => setBusinessDocument(null)}
        />
        <ProductDetailDrawer
          citation={productCitation}
          onClose={() => setProductCitation(null)}
        />
        <Drawer
          onClose={() => setInspectorOpen(false)}
          open={inspectorOpen}
          title="运行详情"
          width={440}
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
              activeRunId={activeRunId}
              error={runError}
              onRetry={
                retryRequest
                  ? () =>
                      void submit(
                        retryRequest.content,
                        retryRequest.scenario,
                        retryRequest.modelAlias,
                      )
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
