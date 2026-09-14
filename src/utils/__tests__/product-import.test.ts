import {
  buildProductImportRows,
  executeProductImportRows,
  getProductImportRowIssue,
  isProductImportRowExecutable,
  parseProductImportCsv,
  preflightProductImportRows,
} from '../product-import';

function buildRows(csv: string) {
  return buildProductImportRows(
    parseProductImportCsv(csv),
    ({ line }) => `import-row-${line}`,
  );
}

describe('product import governance', () => {
  it('validates required fields for create and update rows', () => {
    const rows = buildRows(`导入动作,商品编码,商品名称,品牌
create,,,
update,,更新名称,
update,ITEM-001,,`);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      status: 'invalid',
      validationError: '新增商品必须填写商品名称',
    });
    expect(rows[1]).toMatchObject({
      status: 'invalid',
      validationError: '更新商品必须填写商品编码',
    });
    expect(rows[2]).toMatchObject({
      status: 'invalid',
      validationError: '更新商品必须至少填写一个更新字段',
    });
  });

  it('does not turn blank update cells into destructive field clears', () => {
    const [row] = buildRows(`action,item_code,item_name,brand,stock_uom,currency
update,ITEM-001,更新名称,,,
`);

    expect(row.status).toBe('pending');
    expect(row.payload).toEqual({ itemName: '更新名称' });
    expect(row.payload).not.toHaveProperty('brand');
    expect(row.payload).not.toHaveProperty('stockUom');
    expect(row.payload).not.toHaveProperty('currency');
  });

  it('imports the product nickname for create and update rows', () => {
    const rows = buildRows(`action,item_code,item_name,nickname
update,ITEM-001,,红盖
create,ITEM-002,新增商品,餐饮装`);

    expect(rows[0].payload).toEqual({ nickname: '红盖' });
    expect(rows[1].payload).toMatchObject({
      itemName: '新增商品',
      nickname: '餐饮装',
    });
  });

  it('rejects unknown actions and malformed typed values instead of guessing', () => {
    const [row] = buildRows(`action,item_code,item_name,retail_rate,disabled
udpate,ITEM-001,更新名称,abc,maybe`);

    expect(row.status).toBe('invalid');
    expect(row.validationError).toContain(
      '导入动作只能填写 create/新增 或 update/更新',
    );
    expect(row.validationError).toContain('零售价必须是有效数字');
    expect(row.validationError).toContain(
      '停用只能填写启用/停用、0/1 或 true/false',
    );
  });

  it('preflights update permission and captures the current item version', async () => {
    const rows = buildRows(`action,item_code,item_name
update,ITEM-001,更新名称
create,ITEM-002,新增商品`);
    const getProduct = jest.fn().mockResolvedValue({
      canWrite: true,
      itemName: '现有商品',
      modified: '2026-09-03 12:00:00',
    });

    const result = await preflightProductImportRows(rows, {
      formatError: (error) => (error as Error).message,
      getProduct,
    });

    expect(getProduct).toHaveBeenCalledWith('ITEM-001');
    expect(result[0]).toMatchObject({
      itemModified: '2026-09-03 12:00:00',
      status: 'ready',
    });
    expect(result[1].status).toBe('ready');
  });

  it('fails closed when an update cannot be written or versioned', async () => {
    const rows = buildRows(`action,item_code,item_name
update,ITEM-001,更新名称`);
    const result = await preflightProductImportRows(rows, {
      formatError: (error) => (error as Error).message,
      getProduct: async () => ({
        canWrite: false,
        itemName: '现有商品',
        modified: '2026-09-03 12:00:00',
      }),
    });

    expect(result[0]).toMatchObject({
      itemModified: null,
      preflightError: '当前账号没有该商品的修改权限',
      status: 'error',
    });
    expect(isProductImportRowExecutable(result[0])).toBe(false);
  });

  it('continues after row failures and never reruns successful rows', async () => {
    const rows = await preflightProductImportRows(
      buildRows(`action,item_code,item_name
update,ITEM-001,更新名称
create,ITEM-002,新增商品`),
      {
        formatError: (error) => (error as Error).message,
        getProduct: async () => ({
          canWrite: true,
          itemName: '现有商品',
          modified: 'version-1',
        }),
      },
    );
    const updateProduct = jest.fn().mockRejectedValue(new Error('conflict'));
    const createProduct = jest.fn().mockResolvedValue({});
    const dependencies = {
      createProduct,
      formatError: (error: unknown) => (error as Error).message,
      isVersionConflict: (error: unknown) =>
        error instanceof Error && error.message === 'conflict',
      updateProduct,
    };

    const firstRun = await executeProductImportRows(rows, dependencies);

    expect(firstRun).toMatchObject({ failed: 1, skipped: 0, succeeded: 1 });
    expect(updateProduct).toHaveBeenCalledWith(
      'ITEM-001',
      { itemModified: 'version-1', itemName: '更新名称' },
      {
        idempotencyKey: 'import-row-2',
        notifyError: false,
        notifySuccess: false,
      },
    );
    expect(firstRun.rows[0]).toMatchObject({
      executionError: '商品已被其他用户修改，请重新预检更新行后重试',
      status: 'error',
    });
    expect(firstRun.rows[1].status).toBe('success');

    updateProduct.mockClear();
    createProduct.mockClear();
    const secondRun = await executeProductImportRows(
      firstRun.rows,
      dependencies,
    );
    expect(secondRun).toMatchObject({ failed: 0, skipped: 2, succeeded: 0 });
    expect(updateProduct).not.toHaveBeenCalled();
    expect(createProduct).not.toHaveBeenCalled();
  });

  it('refreshes a conflicted update version before allowing retry', async () => {
    const [row] = await preflightProductImportRows(
      buildRows(`action,item_code,item_name
update,ITEM-001,更新名称`),
      {
        formatError: (error) => (error as Error).message,
        getProduct: async () => ({
          canWrite: true,
          itemName: '现有商品',
          modified: 'version-1',
        }),
      },
    );
    const conflictedRow = {
      ...row,
      executionError: '版本冲突',
      status: 'error' as const,
    };
    const [refreshedRow] = await preflightProductImportRows([conflictedRow], {
      createRequestId: () => 'refreshed-request-id',
      formatError: (error) => (error as Error).message,
      getProduct: async () => ({
        canWrite: true,
        itemName: '现有商品',
        modified: 'version-2',
      }),
    });

    expect(refreshedRow).toMatchObject({
      executionError: undefined,
      itemModified: 'version-2',
      requestId: 'refreshed-request-id',
      status: 'ready',
    });
  });

  it('keeps the same idempotency key for an uncertain update retry', async () => {
    const rows = await preflightProductImportRows(
      buildRows(`action,item_code,item_name
update,ITEM-001,更新名称`),
      {
        formatError: (error) => (error as Error).message,
        getProduct: async () => ({
          canWrite: true,
          itemName: '现有商品',
          modified: 'version-1',
        }),
      },
    );
    const updateProduct = jest
      .fn()
      .mockRejectedValueOnce(new Error('网络中断'))
      .mockResolvedValueOnce({});
    const dependencies = {
      createProduct: jest.fn(),
      formatError: (error: unknown) => (error as Error).message,
      isVersionConflict: () => false,
      updateProduct,
    };

    const firstRun = await executeProductImportRows(rows, dependencies);
    expect(isProductImportRowExecutable(firstRun.rows[0])).toBe(true);
    const secondRun = await executeProductImportRows(
      firstRun.rows,
      dependencies,
    );

    expect(secondRun.rows[0].status).toBe('success');
    expect(updateProduct.mock.calls[0][2].idempotencyKey).toBe(
      updateProduct.mock.calls[1][2].idempotencyKey,
    );
  });

  it('retries uncertain create failures with the same idempotency key', async () => {
    const rows = buildRows(`action,item_code,item_name
create,ITEM-002,新增商品`);
    const createProduct = jest
      .fn()
      .mockRejectedValueOnce(new Error('网络中断'))
      .mockResolvedValueOnce({});
    const dependencies = {
      createProduct,
      formatError: (error: unknown) => (error as Error).message,
      isVersionConflict: () => false,
      updateProduct: jest.fn(),
    };

    const firstRun = await executeProductImportRows(rows, dependencies);
    expect(getProductImportRowIssue(firstRun.rows[0])).toBe('网络中断');
    expect(isProductImportRowExecutable(firstRun.rows[0])).toBe(true);

    const secondRun = await executeProductImportRows(
      firstRun.rows,
      dependencies,
    );
    expect(secondRun.rows[0].status).toBe('success');
    expect(createProduct.mock.calls[0][1].idempotencyKey).toBe(
      createProduct.mock.calls[1][1].idempotencyKey,
    );
  });
});
