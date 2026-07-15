import { callGatewayMethod } from '../api-client';
import {
  analyzeAiProductData,
  createAiDataTask,
  getAiPolicy,
  getAiDataTask,
  getAiUsage,
  listAiDataTasks,
  listAiVectorReleases,
  listAiModels,
  reviewAiDataTask,
  updateAiModel,
} from '../ai-governance';
import { runGatewayMutation } from '../mutation';

jest.mock('../api-client', () => ({
  callGatewayMethod: jest.fn(),
}));

jest.mock('../mutation', () => ({
  runGatewayMutation: jest.fn(),
}));

const mockedCallGatewayMethod = jest.mocked(callGatewayMethod);
const mockedRunGatewayMutation = jest.mocked(runGatewayMutation);

describe('AI governance domain service', () => {
  beforeEach(() => {
    mockedCallGatewayMethod.mockReset();
    mockedRunGatewayMutation.mockReset();
  });

  it('maps model registry fields and pagination', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: {
        items: [
          {
            model_alias: 'erp-fast-chat',
            capability: 'fast_chat',
            status: 'active',
            provider_family: 'litellm',
            data_region: 'cn-east',
            retention_policy: 'no-training-30d',
            input_cost: '1.25',
            output_cost: '4.5',
            currency: 'CNY',
            registry_version: 3,
          },
        ],
        pagination: { total: 1 },
      },
      meta: {},
      raw: {},
    });

    const result = await listAiModels({ current: 2, pageSize: 20 });

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'list_ai_models_v1',
      expect.objectContaining({ start: 20, limit: 20 }),
    );
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      modelAlias: 'erp-fast-chat',
      dataRegion: 'cn-east',
      inputCost: 1.25,
      registryVersion: 3,
    });
  });

  it('maps policy version snapshots and validation evidence', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: {
        policy: {
          policy_code: 'general-prod',
          policy_name: '生产通用策略',
          scenario: 'general',
          capability: 'fast_chat',
          environment: 'production',
          primary_model_alias: 'erp-fast-chat',
          fallback_model_aliases: ['erp-cheap-chat'],
          status: 'approved',
          current_version: 2,
        },
        versions: [
          {
            policy_code: 'general-prod',
            version: 2,
            status: 'approved',
            snapshot: { rollout_percentage: '10' },
            validation: { valid: true, release_gate_eligible: true },
            content_hash: 'abc',
            created_by: 'manager@example.com',
          },
        ],
      },
      meta: {},
      raw: {},
    });

    const result = await getAiPolicy('general-prod');

    expect(result.policy.policyCode).toBe('general-prod');
    expect(result.versions[0].validation).toMatchObject({
      release_gate_eligible: true,
    });
    expect(result.versions[0].snapshot).toMatchObject({
      rollout_percentage: '10',
    });
  });

  it('maps daily latency, first-token and feedback metrics', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: {
        items: [
          {
            usage_date: '2026-07-15',
            environment: 'production',
            company: 'Demo Company',
            scenario: 'general',
            model_alias: 'erp-fast-chat',
            request_count: 10,
            success_count: 9,
            error_count: 1,
            latency_avg_ms: 1200,
            latency_p50_ms: 900,
            latency_p95_ms: 2500,
            first_token_avg_ms: 320,
            first_token_p50_ms: 280,
            first_token_p95_ms: 700,
            positive_feedback_count: 7,
            negative_feedback_count: 1,
            positive_feedback_rate: 0.875,
          },
        ],
      },
      meta: {},
      raw: {},
    });

    const result = await getAiUsage({ environment: 'production' });

    expect(result[0]).toMatchObject({
      latencyP95Ms: 2500,
      firstTokenP50Ms: 280,
      positiveFeedbackRate: 0.875,
    });
  });

  it('keeps governance writes in the mutation layer with snake-case payloads', async () => {
    mockedRunGatewayMutation.mockResolvedValue({ data: {}, idempotencyKey: 'idem-1' });

    await updateAiModel(
      'erp-fast-chat',
      {
        dataRegion: 'cn-east',
        retentionPolicy: 'no-training-30d',
        sensitiveDataAllowed: false,
      },
      '完成供应商复核',
    );

    expect(mockedRunGatewayMutation).toHaveBeenCalledWith(
      'update_ai_model_registry_v1',
      expect.objectContaining({
        payload: expect.objectContaining({
          model_alias: 'erp-fast-chat',
          reason: '完成供应商复核',
          payload: expect.objectContaining({
            data_region: 'cn-east',
            retention_policy: 'no-training-30d',
            sensitive_data_allowed: 0,
          }),
        }),
      }),
    );
  });

  it('maps embedding release progress and immutable collection fields', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: {
        items: [
          {
            release_code: 'products-v2',
            alias_name: 'myapp-products-live',
            collection_name: 'myapp-products-v2',
            embedding_model: 'erp-embedding-v2',
            index_version: 'product-semantic-v2',
            environment: 'production',
            status: 'building',
            total_items: 582,
            indexed_count: 512,
            failed_count: 2,
            vector_size: 1024,
          },
        ],
        pagination: { total: 1 },
      },
      meta: {},
      raw: {},
    });

    const result = await listAiVectorReleases();

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      releaseCode: 'products-v2',
      aliasName: 'myapp-products-live',
      collectionName: 'myapp-products-v2',
      indexedCount: 512,
      failedCount: 2,
    });
  });

  it('maps AI data tasks and sends list filters with pagination', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: {
        tasks: [
          {
            name: 'AI-DATA-1',
            task_type: 'product_completeness',
            target_doctype: 'Item',
            target_name: 'ITEM-001',
            status: 'review_required',
            risk_level: 'low',
            before_value: { description: '' },
            proposed_value: { description: '测试商品 · 默认品牌' },
            evidence: { rule: 'missing_description' },
            analysis: { formal_document_write: false },
            requested_by: 'steward@example.com',
            version: 2,
          },
        ],
        total: 41,
      },
      meta: {},
      raw: {},
    });

    const result = await listAiDataTasks({
      current: 3,
      pageSize: 20,
      riskLevel: 'low',
      status: 'review_required',
      taskType: 'product_completeness',
    });

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'list_ai_data_tasks_v1',
      expect.objectContaining({
        limit: 20,
        risk_level: 'low',
        start: 40,
        status: 'review_required',
        task_type: 'product_completeness',
      }),
    );
    expect(result.total).toBe(41);
    expect(result.items[0]).toMatchObject({
      name: 'AI-DATA-1',
      targetName: 'ITEM-001',
      beforeValue: { description: '' },
      proposedValue: { description: '测试商品 · 默认品牌' },
      requestedBy: 'steward@example.com',
      version: 2,
    });
  });

  it('maps a data task detail response', async () => {
    mockedCallGatewayMethod.mockResolvedValue({
      data: {
        task: {
          name: 'AI-DATA-2',
          target_doctype: 'Item',
          target_name: 'ITEM-002',
          task_type: 'product_field_update',
          status: 'executed',
          risk_level: 'medium',
          before_value: { brand: '旧品牌' },
          proposed_value: { brand: '新品牌' },
          execution_result: { service: 'update_product_v2' },
          executed_by: 'steward@example.com',
        },
      },
      meta: {},
      raw: {},
    });

    const result = await getAiDataTask('AI-DATA-2');

    expect(mockedCallGatewayMethod).toHaveBeenCalledWith(
      'get_ai_data_task_v1',
      { task_name: 'AI-DATA-2' },
    );
    expect(result).toMatchObject({
      executionResult: { service: 'update_product_v2' },
      executedBy: 'steward@example.com',
      targetName: 'ITEM-002',
    });
  });

  it('keeps data task create, scan and review writes in the mutation layer', async () => {
    mockedRunGatewayMutation.mockResolvedValue({
      data: {},
      idempotencyKey: 'idem-data-1',
    });

    await createAiDataTask(
      {
        proposedValue: { description: '新的商品描述' },
        targetName: 'ITEM-001',
      },
      '补齐资料',
    );
    await analyzeAiProductData(['ITEM-001'], 25);
    await reviewAiDataTask('AI-DATA-1', 'approve', '证据充分');

    expect(mockedRunGatewayMutation).toHaveBeenNthCalledWith(
      1,
      'create_ai_data_task_v1',
      expect.objectContaining({
        payload: {
          payload: expect.objectContaining({
            proposed_value: { description: '新的商品描述' },
            target_name: 'ITEM-001',
          }),
          reason: '补齐资料',
        },
        transform: expect.any(Function),
      }),
    );
    expect(mockedRunGatewayMutation).toHaveBeenNthCalledWith(
      2,
      'analyze_ai_product_data_v1',
      expect.objectContaining({
        payload: { item_codes: ['ITEM-001'], limit: 25 },
      }),
    );
    expect(mockedRunGatewayMutation).toHaveBeenNthCalledWith(
      3,
      'review_ai_data_task_v1',
      expect.objectContaining({
        payload: {
          action: 'approve',
          reason: '证据充分',
          task_name: 'AI-DATA-1',
        },
      }),
    );
  });
});
