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
  | 'sales_order_draft';

export type AiSalesOrderDraft = {
  name: string;
  title: string;
  status: string;
  validation: { readyForHandoff: boolean; errors: string[]; warnings: string[] };
  payload: Record<string, unknown>;
};

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
  creation: string | null;
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
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    reasoningTokens: number;
  };
  warnings: string[];
  events: AiEvent[];
};

function mapChatResult(value: unknown): AiChatResult {
  const data = readObject(value);
  const responseMessage = readObject(data.message);
  const usage = readObject(data.usage);
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
    name: String(row.name ?? ''),
    title: String(row.title ?? '销售订单草稿'),
    status: String(row.status ?? 'draft'),
    payload: readObject(row.payload),
    validation: {
      readyForHandoff: Boolean(validation.ready_for_handoff),
      errors: toStringList(validation.errors),
      warnings: toStringList(validation.warnings),
    },
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

export async function prepareAiDraftHandoff(
  draftId: string,
): Promise<Record<string, unknown>> {
  const result = await callGatewayMethod<Record<string, unknown>>(
    'prepare_ai_draft_handoff_v1',
    { draft_id: draftId },
  );
  return readObject(readObject(result.data).payload);
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
