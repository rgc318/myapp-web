import { callGatewayMethod } from './api-client';
import { readObject, toNumber } from './api-utils';
import { runGatewayMutation } from './mutation';
import type { AiCitation } from './ai';

export const lifecycleOperationLabels: Record<string, string> = {
  enable: '启用商品', disable: '停用商品', delete: '删除商品',
};
export type LifecycleTarget = {
  itemCode: string; itemName: string; modified: string; disabled: boolean;
  blockers: Array<{ code: string; message: string }>;
};
export type LifecyclePlan = {
  name: string; version: number; status: string; expiresAt: string; expiresInSeconds: number;
  operation: string; reason: string; sourceContent: string; scopeWarning: string;
  executionAvailable: boolean; targets: LifecycleTarget[]; preserveTargets: LifecycleTarget[];
  groups: Array<{ id: string; role: string; query: string; evidence: string; candidates: LifecycleTarget[] }>;
  replacementPlanId: string | null;
  receipt: null | { executedAt: string; executedBy: string; requestId: string; operation: string; itemCodes: string[] };
};
const objects = (value: unknown) => Array.isArray(value) ? value.map(readObject) : [];
const target = (row: Record<string, unknown>): LifecycleTarget => ({
  itemCode: String(row.item_code ?? ''), itemName: String(row.item_name ?? ''),
  modified: String(row.item_modified ?? ''), disabled: Boolean(row.disabled),
  blockers: objects(row.blockers).map((issue) => ({ code: String(issue.code ?? ''), message: String(issue.message ?? '') })),
});
export function mapLifecyclePlan(value: unknown): LifecyclePlan {
  const row = readObject(value), preview = readObject(row.preview), source = readObject(preview.source);
  const receipt = readObject(row.receipt);
  return {
    name: String(row.name ?? ''), version: toNumber(row.version, 1), status: String(row.status ?? ''),
    expiresAt: String(row.expires_at ?? ''), expiresInSeconds: toNumber(row.expires_in_seconds, 0),
    operation: String(preview.operation ?? ''), reason: String(preview.reason ?? ''),
    sourceContent: String(source.content ?? preview.reason ?? ''), scopeWarning: String(preview.scope_warning ?? ''),
    executionAvailable: preview.execution_available === true,
    targets: objects(preview.targets).map(target), preserveTargets: objects(preview.preserve_targets).map(target),
    groups: objects(preview.resolution_groups).map((group) => ({ id: String(group.id), role: String(group.role),
      query: String(group.query), evidence: String(group.evidence), candidates: objects(group.candidates).map(target) })),
    replacementPlanId: typeof preview.replacement_plan_id === 'string' ? preview.replacement_plan_id : null,
    receipt: row.receipt ? { executedAt: String(receipt.executed_at ?? ''), executedBy: String(receipt.executed_by ?? ''),
      requestId: String(receipt.request_id ?? ''), operation: String(receipt.operation ?? ''),
      itemCodes: objects(receipt.targets).map((item) => String(item.item_code ?? '')) } : null,
  };
}
export async function getLifecyclePlan(planId: string) {
  const response = await callGatewayMethod('get_product_lifecycle_plan_v1', { plan_id: planId });
  return mapLifecyclePlan(response.data);
}
export async function listLifecyclePlans() {
  const response = await callGatewayMethod('list_product_lifecycle_plans_v1', { limit: 50 });
  return objects(readObject(response.data).items).map(mapLifecyclePlan);
}
export async function discardLifecyclePlan(planId: string) {
  const response = await runGatewayMutation('discard_product_lifecycle_plan_v1', { payload: { plan_id: planId }, notifyError: false });
  return mapLifecyclePlan(response.data);
}
export async function resolveLifecyclePlan(plan: LifecyclePlan, selections: Record<string, string>) {
  const response = await runGatewayMutation('resolve_product_lifecycle_plan_v1', { notifyError: false,
    payload: { plan_id: plan.name, expected_version: plan.version, selections } });
  return mapLifecyclePlan(response.data);
}
export async function executeLifecyclePlan(plan: LifecyclePlan, confirmations: { targets: boolean; sharedScope: boolean; deletion: boolean }) {
  await runGatewayMutation('execute_product_lifecycle_plan_v1', { notifyError: false,
    idempotencyKey: `web-product-lifecycle-${plan.name}-v${plan.version}`,
    payload: { plan_id: plan.name, expected_version: plan.version, confirmed: confirmations.targets,
      shared_scope_confirmed: confirmations.sharedScope, deletion_confirmed: confirmations.deletion } });
  return getLifecyclePlan(plan.name);
}
export async function generateAiLifecyclePlan(payload: { content: string; company?: string | null;
  conversationId?: string | null; modelAlias?: string | null; scenarioResolutionId?: string | null }) {
  const response = await callGatewayMethod('generate_ai_product_lifecycle_plan_v1', {
    content: payload.content, company: payload.company, conversation_id: payload.conversationId,
    model_alias: payload.modelAlias, scenario_resolution_id: payload.scenarioResolutionId,
  });
  const data = readObject(response.data), message = readObject(data.message);
  const plan = mapLifecyclePlan(data.plan);
  const citations: AiCitation[] = [{ type: 'product_lifecycle_plan', id: plan.name, label: '商品操作计划', data: { plan_id: plan.name }, href: null }];
  return { conversationId: String(data.conversation_id), plan, content: String(message.content ?? ''), citations };
}
