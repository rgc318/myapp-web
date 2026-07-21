import { message } from 'antd';
import { callFrappeMethod } from '../api-client';
import {
  listTestDatasetRuns,
  listTestDatasets,
  previewCompanyTransactionReset,
  previewTestDataset,
  requestCompanyTransactionReset,
  requestTestDatasetRun,
} from '../test-data';

jest.mock('../api-client', () => {
  class MyAppApiError extends Error {}
  return { MyAppApiError, callFrappeMethod: jest.fn() };
});

jest.mock('../mutation', () => ({
  notifyMutationError: jest.fn(),
}));

jest.mock('antd', () => {
  const actual = jest.requireActual('antd');
  return { ...actual, message: { success: jest.fn() } };
});

const mockedCallFrappeMethod = callFrappeMethod as unknown as jest.Mock;
const mockedMessageSuccess = message.success as unknown as jest.Mock;

describe('test data domain service', () => {
  beforeEach(() => {
    mockedCallFrappeMethod.mockReset();
    mockedMessageSuccess.mockReset();
  });

  it('maps the versioned dataset catalog', async () => {
    mockedCallFrappeMethod.mockResolvedValueOnce({
      data: {
        items: [
          {
            code: 'standard-wholesale-small',
            customers: [{ key: 'retail' }],
            description: 'standard dataset',
            items: [{ key: 'rice' }],
            label: 'Standard Wholesale',
            scale: 'small',
            scenarios: [{ key: 'sales-open' }],
            suppliers: [{ key: 'local' }],
            version: '2026.07-v1',
          },
        ],
      },
      status: 'success',
    });

    const result = await listTestDatasets();

    expect(result[0]).toMatchObject({
      code: 'standard-wholesale-small',
      label: 'Standard Wholesale',
      version: '2026.07-v1',
    });
  });

  it('maps preview safety, conflicts and expected counts', async () => {
    mockedCallFrappeMethod.mockResolvedValueOnce({
      data: {
        action: 'reset',
        active_generated_object_count: 38,
        allowed: true,
        base_date: '2026-07-20',
        blockers: [],
        company: 'rgc (Demo)',
        confirmation_text: 'RESET rgc (Demo)',
        conflicts: [{ doctype: 'Item', name: 'TDM-ITEM' }],
        dataset: {
          code: 'standard-wholesale-small',
          label: 'Standard Wholesale',
          version: '2026.07-v1',
        },
        expected_counts: { Item: 4, 'Sales Order': 5 },
        safety: {
          allowed_companies: ['rgc (Demo)'],
          enabled: true,
          environment_type: 'development',
        },
        seed: 1,
        scale: 'medium',
        scenario_copies: 5,
        scenario_instance_count: 40,
        selected_scenario_keys: ['sales-unpaid'],
        unowned_conflicts: [],
        warehouse: 'Main - R',
      },
      status: 'success',
    });

    const result = await previewTestDataset({
      action: 'reset',
      company: 'rgc (Demo)',
      datasetCode: 'standard-wholesale-small',
      warehouse: 'Main - R',
    });

    expect(result).toMatchObject({
      action: 'reset',
      activeGeneratedObjectCount: 38,
      allowed: true,
      confirmationText: 'RESET rgc (Demo)',
      expectedCounts: { Item: 4, 'Sales Order': 5 },
      scale: 'medium',
      scenarioCopies: 5,
      scenarioInstanceCount: 40,
      selectedScenarioKeys: ['sales-unpaid'],
    });
  });

  it('submits snake case mutation payload and returns the queued run', async () => {
    mockedCallFrappeMethod.mockResolvedValueOnce({
      data: {
        preview: {
          action: 'supplement',
          allowed: true,
          dataset: { code: 'standard-wholesale-small' },
          selected_scenario_keys: ['sales-unpaid'],
          safety: {},
        },
        queued: true,
        run_name: 'TDM-RUN-1',
      },
      status: 'success',
    });

    const result = await requestTestDatasetRun({
      action: 'supplement',
      baseDate: '2026-07-20',
      company: 'rgc (Demo)',
      confirmationText: 'SUPPLEMENT rgc (Demo)',
      datasetCode: 'standard-wholesale-small',
      seed: 7,
      scale: 'medium',
      scenarioKeys: ['sales-unpaid'],
      warehouse: 'Main - R',
    });

    expect(mockedCallFrappeMethod).toHaveBeenCalledWith(
      'myapp.api.test_data_api.request_test_dataset_run_v1',
      {
        action: 'supplement',
        base_date: '2026-07-20',
        company: 'rgc (Demo)',
        confirmation_text: 'SUPPLEMENT rgc (Demo)',
        dataset_code: 'standard-wholesale-small',
        seed: 7,
        scale: 'medium',
        scenario_keys: ['sales-unpaid'],
        warehouse: 'Main - R',
      },
      { method: 'POST' },
    );
    expect(result).toMatchObject({ queued: true, runName: 'TDM-RUN-1' });
    expect(mockedMessageSuccess).toHaveBeenCalledWith('测试数据任务已创建');
  });

  it('maps paginated run history totals', async () => {
    mockedCallFrappeMethod.mockResolvedValueOnce({
      data: {
        items: [
          {
            action: 'generate',
            company: 'rgc (Demo)',
            dataset_code: 'standard-wholesale-small',
            dataset_version: '2026.07-v1',
            name: 'TDM-RUN-1',
            requested_by: 'Administrator',
            progress: {
              current: 2,
              message: '测试数据完整性验证通过',
              total: 2,
            },
            scale: 'medium',
            scenario_copies: 5,
            scenario_keys: ['sales-unpaid'],
            status: 'completed',
            warehouse: 'Main - R',
          },
        ],
        total: 2,
      },
      status: 'success',
    });

    const result = await listTestDatasetRuns({ current: 1, pageSize: 10 });

    expect(result.total).toBe(2);
    expect(result.items[0]).toMatchObject({
      datasetCode: 'standard-wholesale-small',
      name: 'TDM-RUN-1',
      progress: { current: 2, total: 2 },
      scale: 'medium',
      scenarioCopies: 5,
      scenarioKeys: ['sales-unpaid'],
      status: 'completed',
    });
  });

  it('maps company transaction reset preview', async () => {
    mockedCallFrappeMethod.mockResolvedValueOnce({
      data: {
        active_template_object_count: 38,
        allowed: false,
        blockers: ['reset disabled'],
        company: 'rgc (Demo)',
        confirmation_text: 'DELETE ALL TRANSACTIONS rgc (Demo)',
        doctype_count: 2,
        estimated_document_references: 120,
        plan: [
          {
            company_field: 'company',
            document_count: 80,
            doctype: 'GL Entry',
          },
        ],
        retained_master_doctypes: ['Company', 'Customer'],
        safety: {
          allowed_companies: [],
          enabled: false,
          environment_type: 'development',
        },
      },
      status: 'success',
    });

    const result = await previewCompanyTransactionReset('rgc (Demo)');

    expect(result).toMatchObject({
      activeTemplateObjectCount: 38,
      allowed: false,
      doctypeCount: 2,
      estimatedDocumentReferences: 120,
      plan: [
        {
          companyField: 'company',
          documentCount: 80,
          doctype: 'GL Entry',
        },
      ],
    });
  });

  it('submits irreversible company reset acknowledgement', async () => {
    mockedCallFrappeMethod.mockResolvedValueOnce({
      data: {
        preview: { company: 'rgc (Demo)', safety: {} },
        record: {
          company: 'rgc (Demo)',
          name: 'TDL.0001',
          progress: { processed: 0, total: 120 },
          status: 'Queued',
          task_statuses: {},
          to_delete: [],
        },
      },
      status: 'success',
    });

    const result = await requestCompanyTransactionReset({
      acknowledgeIrreversible: true,
      company: 'rgc (Demo)',
      confirmationText: 'DELETE ALL TRANSACTIONS rgc (Demo)',
    });

    expect(mockedCallFrappeMethod).toHaveBeenCalledWith(
      'myapp.api.test_data_api.request_company_transaction_reset_v1',
      {
        acknowledge_irreversible: 1,
        company: 'rgc (Demo)',
        confirmation_text: 'DELETE ALL TRANSACTIONS rgc (Demo)',
      },
      { method: 'POST' },
    );
    expect(result.record).toMatchObject({
      name: 'TDL.0001',
      progress: { processed: 0, total: 120 },
      status: 'Queued',
    });
  });
});
