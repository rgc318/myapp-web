import type {
  SaveProductPayload,
  UpdateProductPayload,
} from '@/services/myapp/master-data';

export type ProductImportAction = 'create' | 'update';
export type ProductImportStatus =
  | 'invalid'
  | 'pending'
  | 'validating'
  | 'ready'
  | 'running'
  | 'success'
  | 'error';

type ProductImportRowBase = {
  action: ProductImportAction;
  executionError?: string;
  itemCode?: string | null;
  itemModified?: string | null;
  itemName: string;
  line: number;
  preflightError?: string;
  requestId: string;
  requiresPreflight?: boolean;
  status: ProductImportStatus;
  validationError?: string;
};

export type ProductImportRow =
  | (ProductImportRowBase & {
      action: 'create';
      payload: SaveProductPayload;
    })
  | (ProductImportRowBase & {
      action: 'update';
      payload: Partial<SaveProductPayload>;
    });

function normalizeCsvHeader(value: string) {
  return value
    .trim()
    .replace(/^\uFEFF/, '')
    .toLowerCase();
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];
    if (char === '"' && quoted && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}

export function parseProductImportCsv(text: string) {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim());
  if (lines.length < 2) {
    return [];
  }
  const headers = splitCsvLine(lines[0]).map(normalizeCsvHeader);
  return lines.slice(1).map((line, index) => {
    const cells = splitCsvLine(line);
    return headers.reduce<Record<string, string>>(
      (row, header, cellIndex) => {
        row[header] = cells[cellIndex]?.trim() ?? '';
        return row;
      },
      { __line: String(index + 2) },
    );
  });
}

function readCsvField(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeCsvHeader(key)]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function readCsvNumber(
  row: Record<string, string>,
  keys: string[],
  label: string,
  validationErrors: string[],
) {
  const value = readCsvField(row, keys);
  if (!value) {
    return undefined;
  }
  const parsed = Number(value.replaceAll(',', ''));
  if (!Number.isFinite(parsed)) {
    validationErrors.push(`${label}必须是有效数字`);
    return undefined;
  }
  return parsed;
}

function readCsvBoolean(
  row: Record<string, string>,
  keys: string[],
  label: string,
  validationErrors: string[],
) {
  const value = readCsvField(row, keys)?.toLowerCase();
  if (!value) {
    return undefined;
  }
  if (['1', 'true', 'yes', 'y', '停用', '禁用', 'disabled'].includes(value)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', '启用', 'enabled'].includes(value)) {
    return false;
  }
  validationErrors.push(`${label}只能填写启用/停用、0/1 或 true/false`);
  return undefined;
}

function mapImportAction(value?: string): {
  action: ProductImportAction;
  validationError?: string;
} {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'update' || normalized === '更新') {
    return { action: 'update' };
  }
  if (
    !normalized ||
    normalized === 'create' ||
    normalized === '新增' ||
    normalized === '创建'
  ) {
    return { action: 'create' };
  }
  return {
    action: 'create',
    validationError: '导入动作只能填写 create/新增 或 update/更新',
  };
}

function setOptionalTextPayload<K extends keyof SaveProductPayload>(
  payload: Partial<SaveProductPayload>,
  key: K,
  value: SaveProductPayload[K] | undefined,
) {
  if (value !== undefined) {
    payload[key] = value;
  }
}

function setOptionalNumberPayload<K extends keyof SaveProductPayload>(
  payload: Partial<SaveProductPayload>,
  key: K,
  value: SaveProductPayload[K] | undefined,
) {
  if (value !== undefined) {
    payload[key] = value;
  }
}

export function buildProductImportRows(
  rawRows: Record<string, string>[],
  createRequestId: (row: {
    action: ProductImportAction;
    itemCode?: string;
    line: number;
  }) => string,
): ProductImportRow[] {
  return rawRows.map((row) => {
    const validationErrors: string[] = [];
    const actionResult = mapImportAction(
      readCsvField(row, ['action', '导入动作']),
    );
    const action = actionResult.action;
    if (actionResult.validationError) {
      validationErrors.push(actionResult.validationError);
    }
    const itemCode = readCsvField(row, ['itemCode', 'item_code', '商品编码']);
    const itemName =
      readCsvField(row, ['itemName', 'item_name', '商品名称']) ?? '';
    const nickname = readCsvField(row, [
      'nickname',
      'custom_nickname',
      '商品昵称',
      '昵称',
    ]);
    const stockUom =
      readCsvField(row, ['stockUom', 'stock_uom', '库存单位']) ?? 'Nos';
    const barcode = readCsvField(row, ['barcode', '主条码', '条码']);
    const brand = readCsvField(row, ['brand', '品牌']);
    const currency = readCsvField(row, ['currency', '币种']);
    const description = readCsvField(row, ['description', '描述']);
    const disabled = readCsvBoolean(
      row,
      ['disabled', '停用'],
      '停用',
      validationErrors,
    );
    const itemGroup = readCsvField(row, [
      'itemGroup',
      'item_group',
      '商品分类',
    ]);
    const retailDefaultUom = readCsvField(row, [
      'retailDefaultUom',
      'retail_default_uom',
      '零售默认单位',
    ]);
    const retailRate = readCsvNumber(
      row,
      ['retailRate', 'retail_rate', '零售价'],
      '零售价',
      validationErrors,
    );
    const standardBuyingRate = readCsvNumber(
      row,
      ['standardBuyingRate', 'standard_buying_rate', '标准采购价', '采购价'],
      '标准采购价',
      validationErrors,
    );
    const standardSellingRate = readCsvNumber(
      row,
      ['standardSellingRate', 'standard_rate', '标准售价'],
      '标准售价',
      validationErrors,
    );
    const valuationRate = readCsvNumber(
      row,
      ['valuationRate', 'valuation_rate', '估值价'],
      '估值价',
      validationErrors,
    );
    const wholesaleDefaultUom = readCsvField(row, [
      'wholesaleDefaultUom',
      'wholesale_default_uom',
      '批发默认单位',
    ]);
    const wholesaleRate = readCsvNumber(
      row,
      ['wholesaleRate', 'wholesale_rate', '批发价'],
      '批发价',
      validationErrors,
    );
    const line = Number(row.__line ?? 0);
    const requestId = createRequestId({ action, itemCode, line });

    if (action === 'update') {
      const payload: Partial<SaveProductPayload> = {};
      setOptionalTextPayload(payload, 'barcode', barcode);
      setOptionalTextPayload(payload, 'brand', brand);
      setOptionalTextPayload(payload, 'currency', currency);
      setOptionalTextPayload(payload, 'description', description);
      setOptionalTextPayload(payload, 'itemGroup', itemGroup);
      setOptionalTextPayload(payload, 'itemName', itemName || undefined);
      setOptionalTextPayload(payload, 'nickname', nickname);
      setOptionalTextPayload(payload, 'retailDefaultUom', retailDefaultUom);
      setOptionalTextPayload(
        payload,
        'stockUom',
        readCsvField(row, ['stockUom', 'stock_uom', '库存单位']),
      );
      setOptionalTextPayload(
        payload,
        'wholesaleDefaultUom',
        wholesaleDefaultUom,
      );
      setOptionalNumberPayload(payload, 'retailRate', retailRate);
      setOptionalNumberPayload(
        payload,
        'standardBuyingRate',
        standardBuyingRate,
      );
      setOptionalNumberPayload(
        payload,
        'standardSellingRate',
        standardSellingRate,
      );
      setOptionalNumberPayload(payload, 'valuationRate', valuationRate);
      setOptionalNumberPayload(payload, 'wholesaleRate', wholesaleRate);
      if (disabled !== undefined) {
        payload.disabled = disabled;
      }
      if (!itemCode) {
        validationErrors.push('更新商品必须填写商品编码');
      }
      if (Object.keys(payload).length === 0) {
        validationErrors.push('更新商品必须至少填写一个更新字段');
      }
      const validationError = validationErrors.length
        ? validationErrors.join('；')
        : undefined;
      return {
        action,
        itemCode,
        itemName,
        line,
        payload,
        requestId,
        status: validationError ? 'invalid' : 'pending',
        validationError,
      };
    }

    const payload: SaveProductPayload = {
      barcode: barcode ?? null,
      brand: brand ?? null,
      currency: currency ?? 'CNY',
      description: description ?? null,
      disabled,
      itemCode: itemCode ?? null,
      itemGroup: itemGroup ?? null,
      itemName,
      nickname: nickname ?? null,
      retailDefaultUom: retailDefaultUom ?? stockUom,
      retailRate,
      standardBuyingRate,
      standardSellingRate,
      stockUom,
      valuationRate,
      wholesaleDefaultUom: wholesaleDefaultUom ?? stockUom,
      wholesaleRate,
    };
    if (!itemName) {
      validationErrors.push('新增商品必须填写商品名称');
    }
    const validationError = validationErrors.length
      ? validationErrors.join('；')
      : undefined;
    return {
      action,
      itemCode,
      itemName,
      line,
      payload,
      requestId,
      status: validationError ? 'invalid' : 'ready',
      validationError,
    };
  });
}

export function getProductImportRowIssue(row: ProductImportRow) {
  return row.validationError ?? row.preflightError ?? row.executionError;
}

export function isProductImportRowExecutable(row: ProductImportRow) {
  if (row.status === 'ready') {
    return true;
  }
  return (
    row.status === 'error' &&
    Boolean(row.executionError) &&
    !row.validationError &&
    (row.action === 'create' ||
      (Boolean(row.itemModified) && !row.requiresPreflight))
  );
}

export function canPreflightProductImportRow(row: ProductImportRow) {
  return (
    row.action === 'update' && row.status !== 'success' && !row.validationError
  );
}

function cloneProductImportRow(row: ProductImportRow): ProductImportRow {
  if (row.action === 'update') {
    return { ...row, payload: { ...row.payload } };
  }
  return { ...row, payload: { ...row.payload } };
}

type ProductImportPreflightDependencies = {
  createRequestId?: () => string;
  formatError: (error: unknown) => string;
  getProduct: (itemCode: string) => Promise<{
    canWrite: boolean;
    itemName: string;
    modified: string | null;
  } | null>;
  onRowsChange?: (rows: ProductImportRow[]) => void;
};

export async function preflightProductImportRows(
  rows: ProductImportRow[],
  dependencies: ProductImportPreflightDependencies,
) {
  const nextRows = rows.map(cloneProductImportRow);
  const candidateIndexes = nextRows
    .map((row, index) =>
      canPreflightProductImportRow(row) ? index : undefined,
    )
    .filter((index): index is number => index !== undefined);

  let cursor = 0;
  const worker = async () => {
    while (cursor < candidateIndexes.length) {
      const index = candidateIndexes[cursor];
      cursor += 1;
      const row = nextRows[index];
      if (row.action !== 'update') {
        continue;
      }
      nextRows[index] = {
        ...row,
        preflightError: undefined,
        status: 'validating',
      };
      dependencies.onRowsChange?.([...nextRows]);
      try {
        const product = await dependencies.getProduct(String(row.itemCode));
        if (!product) {
          throw new Error('未找到该商品');
        }
        if (!product.canWrite) {
          throw new Error('当前账号没有该商品的修改权限');
        }
        if (!product.modified) {
          throw new Error('商品详情未返回版本信息，已阻止覆盖更新');
        }
        nextRows[index] = {
          ...nextRows[index],
          executionError: undefined,
          itemModified: product.modified,
          itemName: row.itemName || product.itemName,
          preflightError: undefined,
          requestId: dependencies.createRequestId?.() ?? row.requestId,
          requiresPreflight: false,
          status: 'ready',
        };
      } catch (caught) {
        nextRows[index] = {
          ...nextRows[index],
          itemModified: null,
          preflightError: dependencies.formatError(caught),
          requiresPreflight: true,
          status: 'error',
        };
      }
      dependencies.onRowsChange?.([...nextRows]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(5, candidateIndexes.length) }, () =>
      worker(),
    ),
  );

  return nextRows;
}

type ProductImportMutationOptions = {
  idempotencyKey: string;
  notifyError: false;
  notifySuccess: false;
};

type ProductImportExecutionDependencies = {
  createProduct: (
    payload: SaveProductPayload,
    options: ProductImportMutationOptions,
  ) => Promise<unknown>;
  formatError: (error: unknown) => string;
  isVersionConflict: (error: unknown) => boolean;
  onRowsChange?: (rows: ProductImportRow[]) => void;
  updateProduct: (
    itemCode: string,
    payload: UpdateProductPayload,
    options: ProductImportMutationOptions,
  ) => Promise<unknown>;
};

export type ProductImportExecutionResult = {
  failed: number;
  rows: ProductImportRow[];
  skipped: number;
  succeeded: number;
};

export async function executeProductImportRows(
  rows: ProductImportRow[],
  dependencies: ProductImportExecutionDependencies,
): Promise<ProductImportExecutionResult> {
  const nextRows = rows.map(cloneProductImportRow);
  let failed = 0;
  let succeeded = 0;

  for (let index = 0; index < nextRows.length; index += 1) {
    const row = nextRows[index];
    if (!isProductImportRowExecutable(row)) {
      continue;
    }
    nextRows[index] = {
      ...row,
      executionError: undefined,
      status: 'running',
    };
    dependencies.onRowsChange?.([...nextRows]);
    try {
      const options: ProductImportMutationOptions = {
        idempotencyKey: row.requestId,
        notifyError: false,
        notifySuccess: false,
      };
      if (row.action === 'update') {
        await dependencies.updateProduct(
          String(row.itemCode),
          { ...row.payload, itemModified: row.itemModified },
          options,
        );
      } else {
        await dependencies.createProduct(row.payload, options);
      }
      nextRows[index] = {
        ...nextRows[index],
        executionError: undefined,
        status: 'success',
      };
      succeeded += 1;
    } catch (caught) {
      const versionConflict = dependencies.isVersionConflict(caught);
      nextRows[index] = {
        ...nextRows[index],
        executionError: versionConflict
          ? '商品已被其他用户修改，请重新预检更新行后重试'
          : dependencies.formatError(caught),
        requiresPreflight: row.action === 'update' && versionConflict,
        status: 'error',
      };
      failed += 1;
    }
    dependencies.onRowsChange?.([...nextRows]);
  }

  return {
    failed,
    rows: nextRows,
    skipped: nextRows.length - succeeded - failed,
    succeeded,
  };
}
