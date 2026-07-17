import { callGatewayMethod } from './api-client';
import { buildMyAppApiUrl } from './api-base';
import { readObject, toNumber, toStringList } from './api-utils';
import { getMyAppAuthHeaders } from './auth-storage';

export type AiChatRole = 'user' | 'assistant';

export type AiScenario =
  | 'general'
  | 'product_search'
  | 'order_query'
  | 'report_summary'
  | 'sales_order_draft'
  | 'purchase_order_draft'
  | 'inventory_adjustment_draft';

export type AiDraft = {
  company: string | null;
  conversationId: string | null;
  creation: string | null;
  draftType: 'sales_order' | 'purchase_order' | 'inventory_adjustment';
  modified: string | null;
  name: string;
  title: string;
  status: string;
  sourceRun: string | null;
  version: number;
  validation: { readyForHandoff: boolean; errors: string[]; warnings: string[] };
  payload: Record<string, unknown>;
};

export type AiSalesOrderDraft = AiDraft;

export type AiCitation = {
  type: string;
  id: string | null;
  label: string;
  href: string | null;
  data: Record<string, unknown>;
};

export type AiChatMessage = {
  role: AiChatRole;
  content: string;
  citations?: AiCitation[];
};

export type AiConversation = {
  name: string;
  title: string;
  status: 'active' | 'archived';
  company: string | null;
  messageCount: number;
  lastMessageAt: string | null;
  creation: string | null;
  modified: string | null;
};

export type AiConversationMessage = AiChatMessage & {
  name: string;
  sequence: number;
  scenario: AiScenario | null;
  runId: string | null;
  promptVersion: string | null;
  run: AiRunSummary | null;
  feedback: AiPersistedFeedback | null;
  creation: string | null;
};

export type AiTokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens: number;
};

export type AiRunSummary = {
  error: string | null;
  errorCode: string | null;
  firstTokenMs: number | null;
  latencyMs: number;
  model: string | null;
  modelAlias: string | null;
  status: string;
  traceId: string | null;
  usage: AiTokenUsage;
};

export type AiPersistedFeedback = {
  category: string | null;
  comment: string | null;
  rating: 'positive' | 'negative';
};

export type AiEvent = {
  type: string;
  [key: string]: unknown;
};

export type AiChatResult = {
  conversationId: string;
  runId: string | null;
  message: AiChatMessage;
  model: string | null;
  modelAlias: string | null;
  traceId: string | null;
  run: AiRunSummary;
  stream: {
    deltaCount: number;
    streamedChars: number;
  };
  usage: AiTokenUsage;
  warnings: string[];
  events: AiEvent[];
};

function mapChatResult(value: unknown): AiChatResult {
  const data = readObject(value);
  const responseMessage = readObject(data.message);
  const usage = readObject(data.usage);
  const run = readObject(data.run);
  const stream = readObject(data.stream);
  return {
    conversationId: String(data.conversation ?? ''),
    runId: typeof data.run_id === 'string' ? data.run_id : null,
    message: {
      role: 'assistant',
      content: String(responseMessage.content ?? ''),
      citations: Array.isArray(responseMessage.citations)
        ? responseMessage.citations.map(mapCitation)
        : Array.isArray(data.citations)
          ? data.citations.map(mapCitation)
          : [],
    },
    model: typeof data.model === 'string' ? data.model : null,
    modelAlias: typeof data.model_alias === 'string' ? data.model_alias : null,
    traceId: typeof data.trace_id === 'string' ? data.trace_id : null,
    run: {
      error: typeof run.error === 'string' ? run.error : null,
      errorCode:
        typeof run.error_code === 'string' ? run.error_code : null,
      firstTokenMs:
        run.first_token_ms === null || run.first_token_ms === undefined
          ? null
          : toNumber(run.first_token_ms),
      latencyMs: toNumber(run.latency_ms),
      model: typeof data.model === 'string' ? data.model : null,
      modelAlias:
        typeof data.model_alias === 'string' ? data.model_alias : null,
      status: String(run.status ?? 'completed'),
      traceId: typeof data.trace_id === 'string' ? data.trace_id : null,
      usage: {
        promptTokens: toNumber(usage.prompt_tokens),
        completionTokens: toNumber(usage.completion_tokens),
        totalTokens: toNumber(usage.total_tokens),
        reasoningTokens: toNumber(usage.reasoning_tokens),
      },
    },
    stream: {
      deltaCount: toNumber(stream.delta_count),
      streamedChars: toNumber(stream.streamed_chars),
    },
    usage: {
      promptTokens: toNumber(usage.prompt_tokens),
      completionTokens: toNumber(usage.completion_tokens),
      totalTokens: toNumber(usage.total_tokens),
      reasoningTokens: toNumber(usage.reasoning_tokens),
    },
    warnings: toStringList(data.warnings),
    events: Array.isArray(data.events)
      ? data.events.map((event) => readObject(event) as AiEvent)
      : [],
  };
}

function mapCitation(value: unknown): AiCitation {
  const row = readObject(value);
  return {
    type: typeof row.type === 'string' ? row.type : 'unknown',
    id: typeof row.id === 'string' ? row.id : null,
    label: typeof row.label === 'string' ? row.label : '',
    href: typeof row.href === 'string' ? row.href : null,
    data: readObject(row.data),
  };
}

function mapSalesOrderDraft(value: unknown): AiSalesOrderDraft {
  const row = readObject(value);
  const validation = readObject(row.validation);
  return {
    company: typeof row.company === 'string' ? row.company : null,
    conversationId:
      typeof row.conversation === 'string' ? row.conversation : null,
    creation: typeof row.creation === 'string' ? row.creation : null,
    draftType:
      row.draft_type === 'purchase_order'
        ? 'purchase_order'
        : row.draft_type === 'inventory_adjustment'
          ? 'inventory_adjustment'
          : 'sales_order',
    modified: typeof row.modified === 'string' ? row.modified : null,
    name: String(row.name ?? ''),
    title: String(row.title ?? '销售订单草稿'),
    status: String(row.status ?? 'draft'),
    sourceRun: typeof row.source_run === 'string' ? row.source_run : null,
    version: toNumber(row.version, 1),
    payload: readObject(row.payload),
    validation: {
      readyForHandoff: Boolean(validation.ready_for_handoff),
      errors: toStringList(validation.errors),
      warnings: toStringList(validation.warnings),
    },
  };
}

export async function getAiDraft(draftId: string): Promise<AiDraft> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'get_ai_draft_v1',
    { draft_id: draftId },
  );
  return mapSalesOrderDraft(result.data);
}

export async function listAiDrafts(params: {
  current?: number;
  draftType?: AiDraft['draftType'];
  pageSize?: number;
  status?: 'draft' | 'handed_off' | 'discarded' | 'all';
} = {}): Promise<{ items: AiDraft[]; total: number }> {
  const pageSize = params.pageSize ?? 20;
  const start = Math.max(0, ((params.current ?? 1) - 1) * pageSize);
  const result = await callGatewayMethod<Record<string, unknown>>(
    'list_ai_drafts_v1',
    {
      draft_type: params.draftType,
      limit: pageSize,
      start,
      status: params.status ?? 'draft',
    },
  );
  const data = readObject(result.data);
  return {
    items: Array.isArray(data.items)
      ? data.items.map(mapSalesOrderDraft)
      : [],
    total: toNumber(readObject(data.pagination).total),
  };
}

function mapConversation(value: unknown): AiConversation {
  const row = readObject(value);
  return {
    name: String(row.name ?? ''),
    title: String(row.title ?? '新会话'),
    status: row.status === 'archived' ? 'archived' : 'active',
    company: typeof row.company === 'string' ? row.company : null,
    messageCount: toNumber(row.message_count),
    lastMessageAt:
      typeof row.last_message_at === 'string' ? row.last_message_at : null,
    creation: typeof row.creation === 'string' ? row.creation : null,
    modified: typeof row.modified === 'string' ? row.modified : null,
  };
}

export async function listAiConversations(params?: {
  status?: 'active' | 'archived' | 'all';
  start?: number;
  limit?: number;
}): Promise<{ items: AiConversation[]; total: number }> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'list_ai_conversations_v1',
    {
      status: params?.status ?? 'active',
      start: params?.start ?? 0,
      limit: params?.limit ?? 50,
    },
  );
  const data = readObject(result.data);
  const pagination = readObject(data.pagination);
  return {
    items: Array.isArray(data.items) ? data.items.map(mapConversation) : [],
    total: toNumber(pagination.total),
  };
}

export async function createAiConversation(payload: {
  title?: string;
  company?: string | null;
}): Promise<AiConversation> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'create_ai_conversation_v1',
    {
      ...(payload.title ? { title: payload.title } : {}),
      ...(payload.company ? { company: payload.company } : {}),
    },
  );
  return mapConversation(result.data);
}

export async function getAiConversation(
  conversationId: string,
): Promise<{ conversation: AiConversation; messages: AiConversationMessage[] }> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'get_ai_conversation_v1',
    { conversation_id: conversationId },
  );
  const data = readObject(result.data);
  return {
    conversation: mapConversation(data.conversation),
    messages: Array.isArray(data.messages)
      ? data.messages.map((value) => {
          const row = readObject(value);
          return {
            name: String(row.name ?? ''),
            sequence: toNumber(row.sequence),
            role: row.role === 'assistant' ? 'assistant' : 'user',
            content: String(row.content ?? ''),
            scenario:
              typeof row.scenario === 'string'
                ? (row.scenario as AiScenario)
                : null,
            runId: typeof row.run_id === 'string' ? row.run_id : null,
            citations: Array.isArray(row.citations)
              ? row.citations.map(mapCitation)
              : [],
            promptVersion:
              typeof row.prompt_version === 'string'
                ? row.prompt_version
                : null,
            run: (() => {
              const run = readObject(row.run);
              if (!Object.keys(run).length) return null;
              const usage = readObject(run.usage);
              return {
                error: typeof run.error === 'string' ? run.error : null,
                errorCode:
                  typeof run.error_code === 'string' ? run.error_code : null,
                firstTokenMs:
                  run.first_token_ms === null ||
                  run.first_token_ms === undefined
                    ? null
                    : toNumber(run.first_token_ms),
                latencyMs: toNumber(run.latency_ms),
                model: typeof run.model === 'string' ? run.model : null,
                modelAlias:
                  typeof run.model_alias === 'string' ? run.model_alias : null,
                status: String(run.status ?? ''),
                traceId:
                  typeof run.trace_id === 'string' ? run.trace_id : null,
                usage: {
                  promptTokens: toNumber(usage.prompt_tokens),
                  completionTokens: toNumber(usage.completion_tokens),
                  totalTokens: toNumber(usage.total_tokens),
                  reasoningTokens: toNumber(usage.reasoning_tokens),
                },
              };
            })(),
            feedback: (() => {
              const feedback = readObject(row.feedback);
              if (
                feedback.rating !== 'positive' &&
                feedback.rating !== 'negative'
              ) {
                return null;
              }
              return {
                category:
                  typeof feedback.category === 'string'
                    ? feedback.category
                    : null,
                comment:
                  typeof feedback.comment === 'string' ? feedback.comment : null,
                rating: feedback.rating,
              };
            })(),
            creation: typeof row.creation === 'string' ? row.creation : null,
          };
        })
      : [],
  };
}

export async function archiveAiConversation(
  conversationId: string,
): Promise<AiConversation> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'archive_ai_conversation_v1',
    { conversation_id: conversationId },
  );
  return mapConversation(result.data);
}

export async function submitAiFeedback(payload: {
  runId: string;
  rating: 'positive' | 'negative';
  category?: 'helpful' | 'incorrect' | 'incomplete' | 'unsafe' | 'other';
  comment?: string;
}): Promise<void> {
  await callGatewayMethod('submit_ai_feedback_v1', {
    run_id: payload.runId,
    rating: payload.rating,
    ...(payload.category ? { category: payload.category } : {}),
    ...(payload.comment ? { comment: payload.comment } : {}),
  });
}

export async function sendAiChatMessage(payload: {
  content: string;
  conversationId?: string | null;
  scenario?: AiScenario;
  company?: string | null;
}): Promise<AiChatResult> {
  const result = await callGatewayMethod<Record<string, unknown>>('chat_ai_v1', {
    content: payload.content,
    scenario: payload.scenario ?? 'general',
    ...(payload.conversationId
      ? { conversation_id: payload.conversationId }
      : {}),
    ...(payload.company ? { company: payload.company } : {}),
  });
  return mapChatResult(result.data);
}

export async function generateAiSalesOrderDraft(payload: {
  content: string;
  conversationId?: string | null;
  company: string;
}): Promise<AiChatResult & { draft: AiSalesOrderDraft }> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'generate_ai_sales_order_draft_v1',
    {
      content: payload.content,
      company: payload.company,
      ...(payload.conversationId
        ? { conversation_id: payload.conversationId }
        : {}),
    },
  );
  const data = readObject(result.data);
  return { ...mapChatResult(data), draft: mapSalesOrderDraft(data.draft) };
}

export async function generateAiPurchaseOrderDraft(payload: {
  content: string;
  conversationId?: string | null;
  company: string;
}): Promise<AiChatResult & { draft: AiSalesOrderDraft }> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'generate_ai_purchase_order_draft_v1',
    {
      content: payload.content,
      company: payload.company,
      ...(payload.conversationId ? { conversation_id: payload.conversationId } : {}),
    },
  );
  const data = readObject(result.data);
  return { ...mapChatResult(data), draft: mapSalesOrderDraft(data.draft) };
}

export async function generateAiInventoryAdjustmentDraft(payload: {
  content: string;
  conversationId?: string | null;
  company: string;
}): Promise<AiChatResult & { draft: AiSalesOrderDraft }> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'generate_ai_inventory_adjustment_draft_v1',
    {
      content: payload.content,
      company: payload.company,
      ...(payload.conversationId
        ? { conversation_id: payload.conversationId }
        : {}),
    },
  );
  const data = readObject(result.data);
  return { ...mapChatResult(data), draft: mapSalesOrderDraft(data.draft) };
}

export async function prepareAiDraftHandoff(
  draftId: string,
): Promise<{ draftType: string; payload: Record<string, unknown> }> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'prepare_ai_draft_handoff_v1',
    { draft_id: draftId },
  );
  const data = readObject(result.data);
  return { draftType: String(data.draft_type ?? ''), payload: readObject(data.payload) };
}

export async function discardAiDraft(draftId: string): Promise<void> {
  await callGatewayMethod('discard_ai_draft_v1', { draft_id: draftId });
}

export async function updateAiDraft(
  draftId: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'update_ai_draft_v1',
    { draft_id: draftId, payload },
  );
  return readObject(result.data);
}

export async function listAiDraftVersions(
  draftId: string,
): Promise<Record<string, unknown>[]> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'list_ai_draft_versions_v1',
    { draft_id: draftId },
  );
  const data = readObject(result.data);
  return Array.isArray(data.items) ? data.items.map(readObject) : [];
}

export async function restoreAiDraftVersion(
  draftId: string,
  version: number,
): Promise<Record<string, unknown>> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'restore_ai_draft_version_v1',
    { draft_id: draftId, version },
  );
  return readObject(result.data);
}

export async function streamAiChatMessage(
  payload: {
    content: string;
    conversationId?: string | null;
    scenario?: AiScenario;
    company?: string | null;
  },
  onEvent: (event: AiEvent) => void,
  signal?: AbortSignal,
): Promise<AiChatResult> {
  const response = await fetch(
    buildMyAppApiUrl(
      '/api/method/myapp.api.gateway.stream_ai_message_v1',
    ),
    {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        ...(getMyAppAuthHeaders() ?? {}),
      },
      body: JSON.stringify({
        content: payload.content,
        scenario: payload.scenario ?? 'general',
        ...(payload.conversationId
          ? { conversation_id: payload.conversationId }
          : {}),
        ...(payload.company ? { company: payload.company } : {}),
      }),
      signal,
    },
  );
  if (!response.ok) {
    throw new Error(`AI 流式请求失败（HTTP ${response.status}）`);
  }
  if (!response.body) {
    throw new Error('当前浏览器不支持 AI 流式响应。');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed: AiEvent | null = null;

  const consumeBlock = (block: string) => {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('');
    if (!data) {
      return;
    }
    const event = readObject(JSON.parse(data)) as AiEvent;
    onEvent(event);
    if (event.type === 'error') {
      throw new Error(String(event.message ?? 'AI 流式服务调用失败'));
    }
    if (event.type === 'completed') {
      completed = event;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? '';
    blocks.forEach(consumeBlock);
    if (done) {
      break;
    }
  }
  if (buffer.trim()) {
    consumeBlock(buffer);
  }
  if (!completed) {
    throw new Error('AI 流式响应未正常完成。');
  }
  return mapChatResult(completed);
}
