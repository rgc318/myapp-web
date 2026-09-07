import { callGatewayMethod } from '../api-client';
import { runGatewayMutation } from '../mutation';
import { executeLifecyclePlan, generateAiLifecyclePlan, mapLifecyclePlan, resolveLifecyclePlan } from '../product-lifecycle';

jest.mock('../api-client', () => ({ callGatewayMethod: jest.fn() }));
jest.mock('../mutation', () => ({ runGatewayMutation: jest.fn() }));
const raw = { name: 'PLAN-1', version: 1, status: 'pending', expires_in_seconds: 900,
  preview: { operation: 'delete', execution_available: true, targets: [{ item_code: 'A' }],
    preserve_targets: [{ item_code: 'B' }], source: { content: '删除 A，保留 B' } } };
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(callGatewayMethod).mockResolvedValue({ data: raw, meta: {}, raw: {} });
  jest.mocked(runGatewayMutation).mockResolvedValue({ data: raw, idempotencyKey: 'KEY' });
});

it('maps persisted targets, preservation, source and server TTL', () => {
  const plan = mapLifecyclePlan(raw);
  expect(plan.sourceContent).toBe('删除 A，保留 B');
  expect(plan.targets[0].itemCode).toBe('A');
  expect(plan.preserveTargets[0].itemCode).toBe('B');
  expect(plan.expiresInSeconds).toBe(900);
  expect(mapLifecyclePlan({ preview: { execution_available: 'true' } }).executionAvailable).toBe(false);
});

it('reuses one idempotency key after an uncertain execution and never forwards editable targets', async () => {
  const plan = mapLifecyclePlan(raw);
  const confirmations = { targets: true, sharedScope: true, deletion: true };
  await executeLifecyclePlan(plan, confirmations);
  await executeLifecyclePlan(plan, confirmations);
  expect(runGatewayMutation).toHaveBeenNthCalledWith(1, 'execute_product_lifecycle_plan_v1', {
    notifyError: false, idempotencyKey: 'web-product-lifecycle-PLAN-1-v1',
    payload: { plan_id: 'PLAN-1', expected_version: 1, confirmed: true,
      shared_scope_confirmed: true, deletion_confirmed: true },
  });
  expect(jest.mocked(runGatewayMutation).mock.calls[1]).toEqual(jest.mocked(runGatewayMutation).mock.calls[0]);
  expect(callGatewayMethod).toHaveBeenLastCalledWith('get_product_lifecycle_plan_v1', { plan_id: 'PLAN-1' });
});

it('forwards complete candidate selections and original model resolution credential', async () => {
  await resolveLifecyclePlan(mapLifecyclePlan(raw), { 'target-0': 'A', 'preserve-0': 'B' });
  expect(runGatewayMutation).toHaveBeenLastCalledWith('resolve_product_lifecycle_plan_v1', expect.objectContaining({
    payload: { plan_id: 'PLAN-1', expected_version: 1, selections: { 'target-0': 'A', 'preserve-0': 'B' } },
  }));
  jest.mocked(callGatewayMethod).mockResolvedValue({ data: { plan: raw, conversation_id: 'CONV', message: { content: '请确认' } }, meta: {}, raw: {} });
  const result = await generateAiLifecyclePlan({ content: '删除 A', company: 'C', conversationId: 'CONV', modelAlias: 'MODEL', scenarioResolutionId: 'PROOF' });
  expect(callGatewayMethod).toHaveBeenLastCalledWith('generate_ai_product_lifecycle_plan_v1', {
    content: '删除 A', company: 'C', conversation_id: 'CONV', model_alias: 'MODEL', scenario_resolution_id: 'PROOF',
  });
  expect(result.citations[0].type).toBe('product_lifecycle_plan');
});
