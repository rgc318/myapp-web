import { ProCard } from '@ant-design/pro-components';
import {
  Alert,
  App,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  RemoteLinkSelect,
  type RemoteProductCandidate,
  RemoteProductSelect,
} from '@/components';
import { CurrencySelect } from '@/components/CurrencySelect';
import { ItemImageUpload } from '@/components/ItemImageUpload';
import { PriceListName } from '@/components/PriceListName';
import { UomSelect } from '@/components/UomSelect';
import {
  type AiDraft,
  executeAiDraft,
  getAiDraft,
  isAiDraftVersionConflictError,
  updateAiDraft,
} from '@/services/myapp/ai';
import { readAiProductPricing } from '@/services/myapp/ai-product-pricing';
import { notifyMutationError } from '@/services/myapp/mutation';
import { resolveDisplayUom } from '@/utils/display-uom';
import { resolvePriceListDisplay } from '@/utils/price-list-display';
import { AiDraftProgress } from './AiDraftProgress';
import { AiDraftBusinessReview } from './AiDraftReview';
import { AiDraftVersionConflict } from './AiDraftVersionConflict';
import { AiProductPricingFields } from './AiProductPricing';
import {
  type AiDraftConflictField,
  type AiDraftFormValues,
  buildAiDraftConflictFields,
  buildAiDraftPayload,
  getAiDraftFormFieldIssues,
  getAiDraftFormValues,
  mergeAiDraftConflictValues,
} from './ai-draft-form';

type DraftVersionConflict = {
  baseVersion: number;
  differences: AiDraftConflictField[];
  latestDraft: AiDraft;
  latestValues: AiDraftFormValues;
  localValues: AiDraftFormValues;
};

const PRODUCT_STATE_LABELS: Record<string, string> = {
  barcode: '条码',
  brand: '品牌',
  currency: '币种',
  description: '商品描述',
  image: '商品图片',
  item_group: '商品分类',
  item_name: '商品名称',
  nickname: '商品昵称',
  prices: '价格与计价单位',
  retail_rate: '零售价',
  standard_buying_rate: '标准采购参考价',
  standard_selling_rate: '标准销售参考价',
  specification: '规格',
  stock_uom: '库存基准单位',
  uom_relations: '包装与单位换算',
  wholesale_default_uom: '批发默认单位',
  wholesale_rate: '批发价',
  retail_default_uom: '零售默认单位',
};

const INVENTORY_REASON_PRESETS = [
  '盘点盘盈',
  '盘点盘亏',
  '期初库存校准',
  '历史数据纠正',
  '单位或包装换算纠正',
  '破损、报废或过期损耗',
];

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function productStateValue(value: unknown, field?: string): string {
  if (value === null || value === undefined || value === '') return '未设置';
  if (field === 'prices' && Array.isArray(value)) {
    return (
      value
        .map(objectValue)
        .map(
          (row) =>
            `${resolvePriceListDisplay(typeof row.price_list === 'string' ? row.price_list : undefined)} ${productStateValue(row.rate)} ${String(row.currency ?? '')}/${resolveDisplayUom(
              typeof row.uom === 'string' ? row.uom : undefined,
              typeof row.uom_display === 'string' ? row.uom_display : undefined,
            )}`,
        )
        .join('；') || '无价格'
    );
  }
  if (field === 'uom_relations' && Array.isArray(value)) {
    return (
      value
        .map(objectValue)
        .map(
          (row) =>
            `${productStateValue(row.from_qty)} ${resolveDisplayUom(
              typeof row.from_uom === 'string' ? row.from_uom : undefined,
            )} = ${productStateValue(row.to_qty)} ${resolveDisplayUom(
              typeof row.to_uom === 'string' ? row.to_uom : undefined,
            )}`,
        )
        .join('；') || '无换算关系'
    );
  }
  return String(value);
}

function formatInventoryNumber(value: unknown, precision = 6) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return number.toLocaleString('zh-CN', {
    maximumFractionDigits: precision,
  });
}

function unresolvedSelectionQuery(
  payload: Record<string, unknown>,
  resolvedKey: string,
  queryKey: string,
) {
  if (typeof payload[resolvedKey] === 'string' && payload[resolvedKey].trim()) {
    return '';
  }
  return typeof payload[queryKey] === 'string' ? payload[queryKey].trim() : '';
}

function productCandidates(value: unknown): RemoteProductCandidate[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(objectValue)
    .map((candidate) => ({
      brand: typeof candidate.brand === 'string' ? candidate.brand : undefined,
      itemCode:
        typeof candidate.item_code === 'string'
          ? candidate.item_code.trim()
          : '',
      itemName:
        typeof candidate.item_name === 'string'
          ? candidate.item_name
          : undefined,
      nickname:
        typeof candidate.nickname === 'string' ? candidate.nickname : undefined,
      specification:
        typeof candidate.specification === 'string'
          ? candidate.specification
          : undefined,
    }))
    .filter((candidate) => candidate.itemCode);
}

function ProductUpdateState({
  draft,
  onPrepareInventoryAdjustment,
  preparingInventory,
}: {
  draft: AiDraft;
  onPrepareInventoryAdjustment?: (draft: AiDraft) => void;
  preparingInventory: boolean;
}) {
  const state = objectValue(draft.payload._state);
  if (state.operation !== 'update') return null;
  const baseline = objectValue(state.baseline);
  const patch = objectValue(state.patch);
  const context = objectValue(state.context);
  const changedFields = Object.keys(patch);
  const stockQty = context.company_total_qty;
  const stockUom =
    String(context.stock_uom_display ?? context.stock_uom ?? '').trim() || '-';
  const warehouseStock = Array.isArray(context.company_warehouse_stock)
    ? context.company_warehouse_stock.map(objectValue)
    : [];
  const requiresUomMigration = Boolean(context.requires_uom_migration);
  const itemCode = String(draft.payload.item_code ?? '').trim();
  return (
    <Alert
      description={
        <Space orientation="vertical" size={4}>
          <Typography.Text>
            当前库存：{productStateValue(stockQty)} {stockUom}
            （只读，不会作为初始库存写入）
          </Typography.Text>
          {warehouseStock.length ? (
            <Space orientation="vertical" size={2}>
              <Typography.Text strong>分仓库存</Typography.Text>
              {warehouseStock.map((row) => (
                <Typography.Text key={String(row.warehouse ?? '')}>
                  {String(row.warehouse ?? '未命名仓库')}：
                  {productStateValue(row.qty ?? row.total_qty)} {stockUom}
                </Typography.Text>
              ))}
            </Space>
          ) : (
            <Typography.Text type="secondary">
              当前公司没有分仓库存记录。
            </Typography.Text>
          )}
          {changedFields.length ? (
            changedFields.map((field) => (
              <Typography.Text key={field}>
                {PRODUCT_STATE_LABELS[field] ?? field}：
                {productStateValue(baseline[field], field)} →{' '}
                {productStateValue(patch[field], field)}
              </Typography.Text>
            ))
          ) : (
            <Typography.Text>尚未产生字段修改。</Typography.Text>
          )}
          {requiresUomMigration ? (
            <Alert
              action={
                itemCode ? (
                  <Button
                    href={`/master-data/products/${encodeURIComponent(itemCode)}?uom_migration=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="small"
                  >
                    处理单位异常
                  </Button>
                ) : null
              }
              message={String(
                context.uom_governance_message ??
                  '库存基准单位异常，请先完成受控单位错误迁移。',
              )}
              showIcon
              type="error"
            />
          ) : (
            <Button
              loading={preparingInventory}
              onClick={() => onPrepareInventoryAdjustment?.(draft)}
              size="small"
              type="primary"
            >
              调整此商品库存
            </Button>
          )}
        </Space>
      }
      showIcon
      style={{ marginBottom: 16 }}
      title="正在完善现有商品"
      type="info"
    />
  );
}

function OrderLinePriceHint({
  draft,
  itemCode,
  price,
}: {
  draft: AiDraft;
  itemCode?: string;
  price?: number;
}) {
  const rows = Array.isArray(draft.payload.items)
    ? draft.payload.items.map(objectValue)
    : [];
  const sourceRow = rows.find((row) => row.item_code === itemCode);
  const state = objectValue(sourceRow?._state);
  if (!state.schema_version) return null;
  const patch = objectValue(state.patch);
  const effective = objectValue(state.effective);
  const referencePrice = state.reference_price;
  const referenceSource = String(
    state.reference_price_source ?? '后端价格规则',
  );
  const locallyOverridden = price !== effective.price;
  const userOverridden = locallyOverridden || Object.hasOwn(patch, 'price');
  const referenceText =
    referencePrice === null || referencePrice === undefined
      ? '系统未配置参考价'
      : ['系统参考', productStateValue(referencePrice)].join(' ');
  return (
    <Typography.Text type="secondary">
      {userOverridden ? '人工覆盖价' : '系统取价'} · {referenceText}（
      {referenceSource}）
    </Typography.Text>
  );
}

export function AiDraftEditorModal({
  draftId,
  onClose,
  onLoaded,
  onPrepareInventoryAdjustment,
  onUpdated,
}: {
  draftId: string | null;
  onClose: () => void;
  onLoaded?: (draft: AiDraft) => void;
  onPrepareInventoryAdjustment?: (draft: AiDraft) => Promise<void>;
  onUpdated: (draft: AiDraft) => void;
}) {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<AiDraftFormValues>();
  const [draft, setDraft] = useState<AiDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [versionConflict, setVersionConflict] =
    useState<DraftVersionConflict | null>(null);
  const [selectedConflictKeys, setSelectedConflictKeys] = useState<string[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [preparingInventory, setPreparingInventory] = useState(false);
  const onCloseRef = useRef(onClose);
  const onLoadedRef = useRef(onLoaded);
  const company = Form.useWatch('company', form);
  const adjustmentType = Form.useWatch('adjustmentType', form);
  const inventoryQuantity = Form.useWatch('quantity', form);
  const inventoryUom = Form.useWatch('uom', form);
  const inventoryValuationInputUom = Form.useWatch('valuationInputUom', form);
  const inventoryValuationRate = Form.useWatch('valuationRate', form);
  const inventoryValuationRateSource = Form.useWatch(
    'valuationRateSource',
    form,
  );
  const inventoryValuationReferenceId = Form.useWatch(
    'valuationReferenceId',
    form,
  );
  const selectedBrand = Form.useWatch('brand', form);
  const selectedItemCode = Form.useWatch('itemCode', form);
  const selectedItemGroup = Form.useWatch('itemGroup', form);
  const openingQty = Form.useWatch('openingQty', form);
  const productOperation = Form.useWatch('operation', form);
  const selectedParty = Form.useWatch('party', form);
  const stockUom = Form.useWatch('stockUom', form);
  const selectedWarehouse = Form.useWatch('warehouse', form);
  const orderItems = Form.useWatch('items', form);
  const hasOpeningStock = Number(openingQty ?? 0) > 0;
  const isProductUpdate =
    draft?.draftType === 'product_setup' && productOperation === 'update';
  const productDraftState =
    draft?.draftType === 'product_setup'
      ? objectValue(draft.payload._state)
      : {};
  const productTargetEntity = objectValue(productDraftState.entity);
  const productTargetResolved = Boolean(
    productTargetEntity.name ||
      (draft?.validation.readyForHandoff && draft.payload.item_code),
  );
  const needsProductTargetSelection = isProductUpdate && !productTargetResolved;
  const busy = saving || executing;

  const inventorySourceItem =
    draft?.draftType === 'inventory_adjustment' &&
    Array.isArray(draft.payload.items)
      ? objectValue(draft.payload.items[0])
      : {};
  const unresolvedInventoryItemQuery =
    draft?.draftType === 'inventory_adjustment' &&
    !inventorySourceItem.item_code &&
    typeof inventorySourceItem.item_query === 'string'
      ? inventorySourceItem.item_query.trim()
      : '';
  const unresolvedInventoryWarehouseQuery =
    draft?.draftType === 'inventory_adjustment'
      ? unresolvedSelectionQuery(draft.payload, 'warehouse', 'warehouse_query')
      : '';
  const inventoryProductCandidates = productCandidates(
    inventorySourceItem.candidates,
  );
  const inventoryItemMatchesSource =
    Boolean(selectedItemCode) &&
    selectedItemCode === inventorySourceItem.item_code;
  const inventoryStockUomDisplay = String(
    inventorySourceItem.stock_uom_display ??
      inventorySourceItem.stock_uom ??
      '',
  ).trim();
  const inventoryUomOptions =
    inventoryItemMatchesSource &&
    Array.isArray(inventorySourceItem.available_uoms)
      ? inventorySourceItem.available_uoms
          .map(objectValue)
          .map((row) => {
            const uom = typeof row.uom === 'string' ? row.uom.trim() : '';
            const display =
              typeof row.uom_display === 'string' && row.uom_display.trim()
                ? row.uom_display.trim()
                : uom;
            const factor = Number(row.conversion_factor ?? 0);
            return {
              label:
                factor > 0 && factor !== 1 && inventoryStockUomDisplay
                  ? `${display}（1 ${display} = ${factor} ${inventoryStockUomDisplay}）`
                  : display,
              value: uom,
            };
          })
          .filter((option) => option.value)
      : [];
  const selectedInventoryUom = Array.isArray(inventorySourceItem.available_uoms)
    ? inventorySourceItem.available_uoms
        .map(objectValue)
        .find((row) => row.uom === inventoryUom)
    : undefined;
  const inventoryConversionFactor = Number(
    selectedInventoryUom?.conversion_factor ?? 0,
  );
  const inventoryInputStockQty =
    Number.isFinite(Number(inventoryQuantity)) && inventoryConversionFactor > 0
      ? Number(inventoryQuantity) * inventoryConversionFactor
      : null;
  const inventoryCurrentStockQty = Number(
    inventorySourceItem.current_stock_qty ?? 0,
  );
  const inventoryTargetStockQty =
    inventoryInputStockQty === null
      ? null
      : adjustmentType === 'increase'
        ? inventoryCurrentStockQty + inventoryInputStockQty
        : adjustmentType === 'decrease'
          ? inventoryCurrentStockQty - inventoryInputStockQty
          : inventoryInputStockQty;
  const inventoryNeedsValuationRate =
    inventoryTargetStockQty !== null &&
    inventoryTargetStockQty > inventoryCurrentStockQty;
  const inventoryValuationCandidates = Array.isArray(
    inventorySourceItem.valuation_rate_candidates,
  )
    ? inventorySourceItem.valuation_rate_candidates.map(objectValue)
    : [];
  const inventoryCurrentValuationRate = Number(
    inventorySourceItem.current_valuation_rate ?? 0,
  );
  const inventoryCurrentStockValue = Number(
    inventorySourceItem.current_stock_value ??
      inventoryCurrentStockQty * inventoryCurrentValuationRate,
  );
  const inventoryTargetStockValue =
    inventoryTargetStockQty !== null &&
    Number.isFinite(Number(inventoryValuationRate))
      ? inventoryTargetStockQty * Number(inventoryValuationRate)
      : null;
  const inventoryStockValueDifference =
    inventoryTargetStockValue === null
      ? null
      : inventoryTargetStockValue - inventoryCurrentStockValue;
  const inventoryRevaluesExistingStock =
    inventoryCurrentStockQty > 0 &&
    Number.isFinite(Number(inventoryValuationRate)) &&
    Math.abs(Number(inventoryValuationRate) - inventoryCurrentValuationRate) >=
      0.000001;
  const inventoryValuationReference =
    inventoryValuationCandidates.find(
      (row) => row.reference_id === inventoryValuationReferenceId,
    ) ?? objectValue(inventorySourceItem.valuation_rate_reference);
  const inventoryValuationInputDisplay = String(
    (Array.isArray(inventorySourceItem.available_uoms)
      ? inventorySourceItem.available_uoms
          .map(objectValue)
          .find((row) => row.uom === inventoryValuationInputUom)?.uom_display
      : undefined) ??
      inventoryValuationCandidates.find(
        (row) => row.uom === inventoryValuationInputUom,
      )?.uom_display ??
      inventoryValuationInputUom ??
      inventoryUom ??
      '',
  );
  const inventoryValuationRateHelp =
    inventoryValuationRateSource === 'buying_price_reference'
      ? `已采用采购价格表“${String(inventoryValuationReference.price_list ?? '-')}”的价格；后端会按 Item Price 记录重新核验并折算。`
      : inventoryValuationRateSource === 'current_valuation'
        ? '已沿用当前仓库的实际库存估值。'
        : '人工价格按当前选择单位录入，系统会折算为库存基准单位估值。';

  const applyInventoryValuationCandidate = (
    candidate: Record<string, unknown>,
  ) => {
    if (!candidate.selectable) return;
    form.setFieldsValue({
      valuationInputRate: Number(candidate.rate),
      valuationInputUom: String(candidate.uom ?? ''),
      valuationRate: Number(candidate.stock_unit_rate),
      valuationRateSource: 'buying_price_reference',
      valuationReferenceId: String(candidate.reference_id ?? ''),
    });
    setDirty(true);
  };

  const updateInventoryValuationForUom = (nextUom: string) => {
    const nextUnit = Array.isArray(inventorySourceItem.available_uoms)
      ? inventorySourceItem.available_uoms
          .map(objectValue)
          .find((row) => row.uom === nextUom)
      : undefined;
    const nextFactor = Number(nextUnit?.conversion_factor ?? 0);
    const source = form.getFieldValue('valuationRateSource');
    const currentStockUnitRate = Number(form.getFieldValue('valuationRate'));
    if (
      source === 'user' &&
      nextFactor > 0 &&
      Number.isFinite(currentStockUnitRate) &&
      currentStockUnitRate > 0
    ) {
      form.setFieldsValue({
        valuationInputRate: currentStockUnitRate * nextFactor,
        valuationInputUom: nextUom,
        valuationRate: currentStockUnitRate,
        valuationRateSource: 'user',
        valuationReferenceId: undefined,
      });
      message.info('已按新单位换算并保留你的人工库存估值。');
      return;
    }
    if (inventoryCurrentValuationRate > 0 && nextFactor > 0) {
      form.setFieldsValue({
        valuationInputRate: inventoryCurrentValuationRate * nextFactor,
        valuationInputUom: nextUom,
        valuationRate: inventoryCurrentValuationRate,
        valuationRateSource: 'current_valuation',
        valuationReferenceId: undefined,
      });
      return;
    }
    const exactCandidates = inventoryValuationCandidates.filter(
      (row) => row.selectable && row.uom === nextUom,
    );
    if (exactCandidates.length === 1) {
      applyInventoryValuationCandidate(exactCandidates[0]);
      return;
    }
    form.setFieldsValue({
      valuationInputRate: undefined,
      valuationInputUom: nextUom,
      valuationRate: undefined,
      valuationRateSource: undefined,
      valuationReferenceId: undefined,
    });
  };
  const unresolvedProductItemGroupQuery =
    draft?.draftType === 'product_setup'
      ? unresolvedSelectionQuery(
          draft.payload,
          'item_group',
          'item_group_query',
        )
      : '';
  const unresolvedProductBrandQuery =
    draft?.draftType === 'product_setup'
      ? unresolvedSelectionQuery(draft.payload, 'brand', 'brand_query')
      : '';
  const unresolvedProductWarehouseQuery =
    draft?.draftType === 'product_setup'
      ? unresolvedSelectionQuery(draft.payload, 'warehouse', 'warehouse_query')
      : '';
  const duplicateProductCandidates =
    draft?.draftType === 'product_setup' &&
    Array.isArray(draft.payload.duplicate_candidates)
      ? draft.payload.duplicate_candidates.map(objectValue)
      : [];
  const isPurchaseOrder = draft?.draftType === 'purchase_order';
  const unresolvedOrderPartyQuery =
    draft?.draftType === 'sales_order' || isPurchaseOrder
      ? unresolvedSelectionQuery(
          draft.payload,
          isPurchaseOrder ? 'supplier' : 'customer',
          isPurchaseOrder ? 'supplier_query' : 'customer_query',
        )
      : '';
  const unresolvedOrderWarehouseQuery =
    draft?.draftType === 'sales_order' || isPurchaseOrder
      ? unresolvedSelectionQuery(draft.payload, 'warehouse', 'warehouse_query')
      : '';
  const orderSourceItems =
    (draft?.draftType === 'sales_order' || isPurchaseOrder) &&
    Array.isArray(draft.payload.items)
      ? draft.payload.items.map(objectValue)
      : [];

  const applyBackendFieldIssues = useCallback(
    (nextDraft: AiDraft) => {
      const issues = getAiDraftFormFieldIssues(nextDraft);
      if (issues.length) {
        form.setFields(
          issues.map((issue) => ({
            errors: [issue.message],
            name: issue.name,
          })),
        );
      }
      return issues;
    },
    [form],
  );

  const applyDraft = (nextDraft: AiDraft) => {
    const nextValues = getAiDraftFormValues(nextDraft);
    setDraft(nextDraft);
    setDirty(false);
    setVersionConflict(null);
    setSelectedConflictKeys([]);
    form.resetFields();
    form.setFieldsValue(nextValues);
    applyBackendFieldIssues(nextDraft);
    onUpdated(nextDraft);
  };

  useEffect(() => {
    onCloseRef.current = onClose;
    onLoadedRef.current = onLoaded;
  }, [onClose, onLoaded]);

  useEffect(() => {
    if (draft?.status === 'draft') {
      applyBackendFieldIssues(draft);
    }
  }, [applyBackendFieldIssues, draft]);

  useEffect(() => {
    form.resetFields();
    setDraft(null);
    setDirty(false);
    setVersionConflict(null);
    setSelectedConflictKeys([]);
    if (!draftId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void getAiDraft(draftId)
      .then((latestDraft) => {
        if (!active) return;
        const values = getAiDraftFormValues(latestDraft);
        setDraft(latestDraft);
        form.setFieldsValue(values);
        onLoadedRef.current?.(latestDraft);
      })
      .catch((error) => {
        if (!active) return;
        notifyMutationError(error);
        onCloseRef.current();
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [draftId, form]);

  const openVersionConflict = async (
    baseDraft: AiDraft,
    localValues: AiDraftFormValues,
  ) => {
    try {
      const latestDraft = await getAiDraft(baseDraft.name);
      const resolvedBaseValues = getAiDraftFormValues(baseDraft);
      const latestValues = getAiDraftFormValues(latestDraft);
      const differences = buildAiDraftConflictFields(
        baseDraft.draftType,
        resolvedBaseValues,
        localValues,
        latestValues,
      );
      setDraft(latestDraft);
      setDirty(differences.some((field) => field.localChanged));
      setVersionConflict({
        baseVersion: baseDraft.version,
        differences,
        latestDraft,
        latestValues,
        localValues,
      });
      setSelectedConflictKeys(
        differences
          .filter((field) => field.localChanged)
          .map((field) => field.key),
      );
      onUpdated(latestDraft);
      message.warning(
        `草稿已从版本 ${baseDraft.version} 更新到版本 ${latestDraft.version}，请先处理字段差异。`,
      );
    } catch (error) {
      notifyMutationError(error);
    }
  };

  const useLatestConflictVersion = () => {
    if (!versionConflict) return;
    applyDraft(versionConflict.latestDraft);
    message.info(
      `已切换到最新草稿版本 ${versionConflict.latestDraft.version}。`,
    );
  };

  const applyConflictSelection = () => {
    if (!versionConflict || versionConflict.latestDraft.status !== 'draft') {
      return;
    }
    const mergedValues = mergeAiDraftConflictValues(
      versionConflict.latestValues,
      versionConflict.localValues,
      selectedConflictKeys,
    );
    setDraft(versionConflict.latestDraft);
    setVersionConflict(null);
    setSelectedConflictKeys([]);
    setDirty(selectedConflictKeys.length > 0);
    form.resetFields();
    form.setFieldsValue(mergedValues);
    onUpdated(versionConflict.latestDraft);
    message.info(
      selectedConflictKeys.length
        ? `已基于版本 ${versionConflict.latestDraft.version} 保留所选本地修改，请再次保存并校验。`
        : `已采用版本 ${versionConflict.latestDraft.version} 的最新字段。`,
    );
  };

  const save = async ({ notify = true }: { notify?: boolean } = {}) => {
    if (!draft || draft.status !== 'draft' || versionConflict) return null;
    let values: AiDraftFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return null;
    }
    setSaving(true);
    try {
      const updated = await updateAiDraft(
        draft.name,
        draft.version,
        buildAiDraftPayload(draft, values),
      );
      applyDraft(updated);
      if (notify)
        message.success(`草稿版本 ${updated.version} 已保存并重新校验`);
      return updated;
    } catch (error) {
      if (isAiDraftVersionConflictError(error)) {
        await openVersionConflict(draft, values);
        return null;
      }
      notifyMutationError(error);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const confirmExecute = async () => {
    if (!draft || draft.status !== 'draft' || versionConflict) return;
    if (
      draft.draftType === 'inventory_adjustment' &&
      inventoryNeedsValuationRate &&
      Number(form.getFieldValue('valuationInputRate') ?? 0) <= 0
    ) {
      try {
        await form.validateFields(['valuationInputRate']);
      } catch {
        form.scrollToField('valuationInputRate', {
          behavior: 'smooth',
          block: 'center',
          focus: true,
        });
        return;
      }
    }

    let latestDraft: AiDraft | null = null;
    if (dirty) {
      latestDraft = await save({ notify: false });
    } else {
      const openedVersion = draft.version;
      setSaving(true);
      try {
        latestDraft = await getAiDraft(draft.name);
        applyDraft(latestDraft);
        if (latestDraft.version !== openedVersion) {
          message.info(
            `草稿已更新到版本 ${latestDraft.version}，请检查最新内容后重新确认执行。`,
          );
          return;
        }
      } catch (error) {
        notifyMutationError(error);
        return;
      } finally {
        setSaving(false);
      }
    }

    if (!latestDraft) return;
    if (latestDraft.status !== 'draft') {
      message.info('草稿状态已变化，已刷新为最新状态。');
      return;
    }
    if (!latestDraft.validation.readyForHandoff) {
      const issues = applyBackendFieldIssues(latestDraft);
      if (issues[0]) {
        form.scrollToField(issues[0].name, {
          behavior: 'smooth',
          block: 'center',
          focus: true,
        });
      }
      const validationSummary = latestDraft.validation.errors.length
        ? `${latestDraft.validation.errors
            .map((error) => error.replace(/[。；;]+$/u, ''))
            .join('；')}。`
        : '草稿仍有未解决的业务校验问题，请检查标红字段。';
      message.warning({
        content: `无法执行：${validationSummary}`,
        duration: 6,
      });
      return;
    }

    modal.confirm({
      content: (
        <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
          <AiDraftBusinessReview draft={latestDraft} />
        </div>
      ),
      okText: '确认执行当前版本',
      onOk: async () => {
        setExecuting(true);
        try {
          const result = await executeAiDraft(
            latestDraft.name,
            latestDraft.version,
          );
          applyDraft(result.draft);
          message.success(
            result.replayed
              ? '该草稿已执行，已恢复正式业务回执。'
              : '草稿执行成功，正式业务回执已生成。',
          );
        } catch (error) {
          if (isAiDraftVersionConflictError(error)) {
            await openVersionConflict(
              latestDraft,
              getAiDraftFormValues(latestDraft),
            );
            return;
          }
          notifyMutationError(error);
          throw error;
        } finally {
          setExecuting(false);
        }
      },
      title: `确认执行草稿 ${latestDraft.name} · 版本 ${latestDraft.version}？`,
      width: 760,
    });
  };

  const prepareInventoryAdjustment = async (productDraft: AiDraft) => {
    if (!onPrepareInventoryAdjustment || preparingInventory) return;
    setPreparingInventory(true);
    try {
      await onPrepareInventoryAdjustment(productDraft);
    } finally {
      setPreparingInventory(false);
    }
  };

  return (
    <Modal
      closable={!busy}
      destroyOnHidden
      footer={
        draft?.status === 'draft' ? (
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button disabled={busy} onClick={onClose}>
              取消
            </Button>
            <Button
              disabled={loading || executing || Boolean(versionConflict)}
              loading={saving}
              onClick={() => void save()}
            >
              保存草稿
            </Button>
            <Button
              disabled={loading || saving || Boolean(versionConflict)}
              loading={executing}
              onClick={() => void confirmExecute()}
              type="primary"
            >
              确认执行
            </Button>
          </Space>
        ) : (
          <Button onClick={onClose} type="primary">
            关闭
          </Button>
        )
      }
      keyboard={!busy}
      mask={{ closable: !busy }}
      onCancel={() => {
        if (!busy) onClose();
      }}
      open={Boolean(draftId)}
      title={
        draft
          ? `${draft.validation.readyForHandoff ? '编辑' : '完善'}${
              draft.draftType === 'product_setup'
                ? isProductUpdate
                  ? '现有商品'
                  : '商品建档'
                : draft.draftType === 'inventory_adjustment'
                  ? '库存调整'
                  : draft.draftType === 'purchase_order'
                    ? '采购订单'
                    : '销售订单'
            }草稿 · 版本 ${draft.version}`
          : '编辑 AI 草稿'
      }
      width={980}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 190px)',
          overflowY: 'auto',
          paddingRight: 12,
        },
      }}
    >
      <Spin description="正在读取最新草稿版本…" spinning={loading}>
        {draft ? (
          <div style={{ marginBottom: 16 }}>
            <AiDraftProgress
              conflict={Boolean(versionConflict)}
              dirty={dirty}
              draft={draft}
              executing={executing}
            />
          </div>
        ) : null}
        {draft?.boundScopeSummary?.length ? (
          <Alert
            title="本草稿已绑定操作范围"
            description={
              <Space orientation="vertical" size={2}>
                {draft.boundScopeSummary.map((part) => (
                  <Typography.Text key={part}>{part}</Typography.Text>
                ))}
                <Typography.Text>
                  以上已绑定内容不能更换或清空。如需更换，请返回对话明确新要求并重新生成草稿。数量、金额等仍按业务规则编辑；执行前请核对目标是否符合原意。
                </Typography.Text>
              </Space>
            }
            showIcon
            style={{ marginBottom: 16 }}
            type="info"
          />
        ) : null}
        {versionConflict ? (
          <div style={{ marginBottom: 16 }}>
            <AiDraftVersionConflict
              baseVersion={versionConflict.baseVersion}
              canKeepLocal={versionConflict.latestDraft.status === 'draft'}
              differences={versionConflict.differences}
              latestVersion={versionConflict.latestDraft.version}
              onApplySelection={applyConflictSelection}
              onSelectedKeysChange={setSelectedConflictKeys}
              onUseLatest={useLatestConflictVersion}
              selectedKeys={selectedConflictKeys}
            />
          </div>
        ) : null}
        {draft && draft.status !== 'draft' ? (
          <AiDraftBusinessReview draft={draft} />
        ) : draft ? (
          <Form
            disabled={busy || Boolean(versionConflict)}
            form={form}
            layout="vertical"
            onValuesChange={() => setDirty(true)}
          >
            {!versionConflict &&
              (draft.validation.errors.length ||
              draft.validation.warnings.length ? (
                <Alert
                  description={
                    <Space orientation="vertical" size={2}>
                      {draft.validation.errors.map((error) => (
                        <Typography.Text key={error} type="danger">
                          {error}
                        </Typography.Text>
                      ))}
                      {draft.validation.warnings.map((warning) => (
                        <Typography.Text key={warning}>
                          {warning}
                        </Typography.Text>
                      ))}
                    </Space>
                  }
                  showIcon
                  style={{ marginBottom: 16 }}
                  title={
                    draft.validation.errors.length
                      ? `当前有 ${draft.validation.errors.length} 项必须处理`
                      : '请检查以下提示'
                  }
                  type={draft.validation.errors.length ? 'warning' : 'info'}
                />
              ) : null)}
            {draft.draftType === 'inventory_adjustment' &&
            inventorySourceItem.requires_uom_migration === true &&
            typeof inventorySourceItem.item_code === 'string' &&
            inventorySourceItem.item_code.trim() &&
            inventoryItemMatchesSource ? (
              <Alert
                title="库存单位需要先纠正"
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
                description={
                  <Space orientation="vertical">
                    <Typography.Text>
                      商品页面将在新标签页打开，当前草稿输入会保留。处理后返回保存草稿并重新校验；若产生继任商品，请返回对话确认新商品并重新生成草稿。
                    </Typography.Text>
                    <Space wrap>
                      <Button
                        href={`/master-data/products/${encodeURIComponent(inventorySourceItem.item_code)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        查看商品
                      </Button>
                      <Button
                        href={`/master-data/products/${encodeURIComponent(inventorySourceItem.item_code)}?uom_migration=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        处理单位异常
                      </Button>
                    </Space>
                    <Typography.Text type="secondary">
                      纠正页面会检查操作权限、现有库存和历史引用，并说明需要先处理的事项。
                    </Typography.Text>
                  </Space>
                }
              />
            ) : null}
            {dirty && draft.draftType === 'inventory_adjustment' ? (
              <Alert
                message="当前顶部校验来自已保存版本；保存草稿后会按最新单位、价格和实时库存重新校验。"
                showIcon
                style={{ marginBottom: 16 }}
                type="info"
              />
            ) : null}
            {draft.draftType === 'product_setup' ? (
              <ProductUpdateState
                draft={draft}
                onPrepareInventoryAdjustment={(productDraft) =>
                  void prepareInventoryAdjustment(productDraft)
                }
                preparingInventory={preparingInventory}
              />
            ) : null}
            <Form.Item label="公司" name="company" rules={[{ required: true }]}>
              <Input disabled />
            </Form.Item>
            {draft.draftType === 'product_setup' ? (
              <>
                {duplicateProductCandidates.length ? (
                  <Alert
                    description="请选择是新增一个独立商品，还是完善下面某个疑似相同商品。系统不会仅凭照片自动覆盖现有商品。"
                    showIcon
                    style={{ marginBottom: 16 }}
                    title={`发现 ${duplicateProductCandidates.length} 个疑似相同商品`}
                    type="warning"
                  />
                ) : null}
                <div
                  style={{
                    display: 'grid',
                    gap: 12,
                    gridTemplateColumns: '1fr 1fr',
                  }}
                >
                  <Form.Item
                    label="处理方式"
                    name="operation"
                    rules={[{ required: true }]}
                  >
                    <Select
                      disabled={
                        busy ||
                        Boolean(versionConflict) ||
                        draft.boundFields?.operation
                      }
                      options={[
                        { label: '新增商品', value: 'create' },
                        { label: '完善现有商品', value: 'update' },
                      ]}
                    />
                  </Form.Item>
                  {duplicateProductCandidates.length ? (
                    <Form.Item label="疑似相同商品">
                      <Select
                        allowClear
                        disabled={
                          busy ||
                          Boolean(versionConflict) ||
                          draft.boundFields?.target ||
                          (draft.boundFields?.operation &&
                            productOperation !== 'update')
                        }
                        onChange={(value) => {
                          if (value) {
                            form.setFieldsValue({
                              itemCode: value,
                              operation: 'update',
                            });
                            setDirty(true);
                          }
                        }}
                        options={duplicateProductCandidates.map(
                          (candidate) => ({
                            label: `${String(candidate.item_name ?? candidate.item_code ?? '')} · ${String(candidate.item_code ?? '')}${
                              candidate.nickname
                                ? ` · 昵称：${String(candidate.nickname)}`
                                : ''
                            }${
                              candidate.specification
                                ? ` · ${String(candidate.specification)}`
                                : ''
                            }`,
                            value: String(candidate.item_code ?? ''),
                          }),
                        )}
                        placeholder="选择后切换为完善现有商品"
                      />
                    </Form.Item>
                  ) : null}
                </div>
                <Form.Item label="商品图片" name="image">
                  <ItemImageUpload />
                </Form.Item>
                <div
                  style={{
                    display: 'grid',
                    gap: 12,
                    gridTemplateColumns: '1fr 1fr',
                  }}
                >
                  <Form.Item
                    label="商品名称"
                    name="itemName"
                    rules={[{ required: true }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    extra="用于内部快速识别相似商品，也可作为 AI 和订单选品的搜索词。"
                    label="商品昵称"
                    name="nickname"
                  >
                    <Input allowClear maxLength={140} />
                  </Form.Item>
                  <Form.Item
                    extra={
                      needsProductTargetSelection
                        ? selectedItemCode
                          ? `已选择目标商品 ${selectedItemCode}；保存后系统会重新读取商品并校验权限与当前版本。`
                          : '当前草稿尚未绑定现有商品，请搜索并选择要完善的目标商品。'
                        : isProductUpdate
                          ? '商品编码是本次完善操作的固定目标，不能在已绑定后直接修改。'
                          : undefined
                    }
                    label={
                      needsProductTargetSelection ? '选择现有商品' : '商品编码'
                    }
                    name="itemCode"
                    rules={
                      isProductUpdate
                        ? [
                            {
                              message: '请选择要完善的现有商品',
                              required: true,
                            },
                          ]
                        : undefined
                    }
                  >
                    {needsProductTargetSelection ? (
                      <RemoteProductSelect
                        disabled={
                          busy ||
                          Boolean(versionConflict) ||
                          draft.boundFields?.target
                        }
                        company={company}
                        initialCandidates={productCandidates(
                          draft.payload.duplicate_candidates,
                        )}
                        initialQuery={
                          typeof draft.payload.item_name === 'string'
                            ? draft.payload.item_name
                            : undefined
                        }
                        placeholder="按商品编码、名称、昵称或条码搜索并选择"
                      />
                    ) : (
                      <Input disabled={isProductUpdate} />
                    )}
                  </Form.Item>
                  <Form.Item label="条码" name="barcode">
                    <Input maxLength={140} />
                  </Form.Item>
                  <Form.Item label="规格" name="specification">
                    <Input maxLength={500} />
                  </Form.Item>
                  <Form.Item
                    extra={
                      unresolvedProductItemGroupQuery
                        ? selectedItemGroup
                          ? `已选择商品分类 ${selectedItemGroup}；保存后会重新校验。`
                          : `AI 只识别到分类搜索词“${unresolvedProductItemGroupQuery}”，请搜索并选择具体分类。`
                        : undefined
                    }
                    label="商品分类"
                    name="itemGroup"
                  >
                    <RemoteLinkSelect
                      doctype="Item Group"
                      filters={{ is_group: 0 }}
                      initialQuery={
                        unresolvedProductItemGroupQuery || undefined
                      }
                      placeholder="搜索并选择商品分类"
                    />
                  </Form.Item>
                  <Form.Item
                    extra={
                      unresolvedProductBrandQuery
                        ? selectedBrand
                          ? `已选择品牌 ${selectedBrand}；保存后会重新校验。`
                          : `AI 只识别到品牌搜索词“${unresolvedProductBrandQuery}”，请搜索并选择具体品牌。`
                        : undefined
                    }
                    label="品牌"
                    name="brand"
                  >
                    <RemoteLinkSelect
                      doctype="Brand"
                      initialQuery={unresolvedProductBrandQuery || undefined}
                      placeholder="搜索并选择品牌"
                    />
                  </Form.Item>
                  <Form.Item
                    label="库存基准单位"
                    name="stockUom"
                    extra={
                      isProductUpdate
                        ? '这是商品主数据单位；库存数量变化必须使用库存调整。'
                        : '初始库存统一按该单位写入，不需要另外选择入库单位。'
                    }
                    rules={[{ message: '请选择库存基准单位', required: true }]}
                  >
                    <UomSelect disabled={isProductUpdate} />
                  </Form.Item>
                  <Form.Item
                    label="币种"
                    name="currency"
                    rules={[{ required: true }]}
                  >
                    <CurrencySelect />
                  </Form.Item>
                  {readAiProductPricing(draft.payload) ? (
                    <AiProductPricingFields />
                  ) : (
                    <>
                      <Form.Item
                        label="标准销售参考价"
                        name="standardSellingRate"
                        extra="写入标准销售（Standard Selling），仅在没有匹配到更具体的客户、渠道或价格表规则时作为销售兜底参考；不等同于批发价或零售价。"
                      >
                        <InputNumber
                          min={0}
                          precision={6}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                      <Form.Item
                        label="批发价"
                        name="wholesaleRate"
                        extra="写入批发（Wholesale）价格表，供批发销售模式默认取价。"
                      >
                        <InputNumber
                          min={0}
                          precision={6}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                      <Form.Item
                        label="零售价"
                        name="retailRate"
                        extra="写入零售（Retail）价格表，供零售销售模式默认取价。"
                      >
                        <InputNumber
                          min={0}
                          precision={6}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                      <Form.Item
                        label="标准采购参考价"
                        name="standardBuyingRate"
                        extra={
                          hasOpeningStock
                            ? '写入标准采购（Standard Buying），并作为当前初始库存估值的建议来源；请按实际取得成本核对，销售价格不会参与库存计价。'
                            : '写入标准采购（Standard Buying），作为没有供应商合同价、数量阶梯价或采购价格表时的采购兜底参考；它不是库存实时估值。'
                        }
                        required={hasOpeningStock}
                        rules={[
                          {
                            validator: async (_, value) => {
                              if (
                                Number(form.getFieldValue('openingQty') ?? 0) >
                                  0 &&
                                (value === null ||
                                  value === undefined ||
                                  value === '')
                              ) {
                                throw new Error(
                                  '填写初始库存时，请输入标准采购参考价并核对首次入库估值',
                                );
                              }
                            },
                          },
                        ]}
                      >
                        <InputNumber
                          min={0}
                          precision={6}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    </>
                  )}
                  {!isProductUpdate ? (
                    <>
                      <Form.Item label="初始库存数量" name="openingQty">
                        <InputNumber
                          min={0}
                          precision={6}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                      <Form.Item
                        label="入库仓库"
                        name="warehouse"
                        extra={
                          unresolvedProductWarehouseQuery
                            ? selectedWarehouse
                              ? `已选择仓库 ${selectedWarehouse}；保存后会重新校验。`
                              : `AI 只识别到仓库搜索词“${unresolvedProductWarehouseQuery}”，请重新选择当前公司的叶子仓库。`
                            : hasOpeningStock
                              ? `将按库存基准单位${stockUom ? `（${stockUom}）` : ''}入库。`
                              : undefined
                        }
                        required={hasOpeningStock}
                        rules={[
                          {
                            validator: async (_, value) => {
                              if (
                                Number(form.getFieldValue('openingQty') ?? 0) >
                                  0 &&
                                !value
                              ) {
                                throw new Error(
                                  '填写初始库存时，请选择入库仓库',
                                );
                              }
                            },
                          },
                        ]}
                      >
                        <RemoteLinkSelect
                          doctype="Warehouse"
                          filters={{ company, disabled: 0, is_group: 0 }}
                          initialQuery={
                            unresolvedProductWarehouseQuery || undefined
                          }
                        />
                      </Form.Item>
                    </>
                  ) : null}
                </div>
                <Form.Item label="商品描述" name="description">
                  <Input.TextArea maxLength={2000} rows={3} />
                </Form.Item>
              </>
            ) : draft.draftType === 'inventory_adjustment' ? (
              <div
                style={{
                  display: 'grid',
                  gap: 12,
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                }}
              >
                <Form.Item
                  label="过账日期"
                  name="postingDate"
                  rules={[{ required: true }]}
                >
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  extra={
                    unresolvedInventoryWarehouseQuery
                      ? selectedWarehouse
                        ? `已选择仓库 ${selectedWarehouse}；保存后会重新校验。`
                        : `AI 只识别到仓库搜索词“${unresolvedInventoryWarehouseQuery}”，请重新选择当前公司的可用仓库。`
                      : undefined
                  }
                  label="仓库"
                  name="warehouse"
                  rules={[
                    { message: '请选择当前公司的可用仓库', required: true },
                  ]}
                >
                  <RemoteLinkSelect
                    disabled={
                      busy ||
                      Boolean(versionConflict) ||
                      draft.boundFields?.warehouse
                    }
                    doctype="Warehouse"
                    filters={{ company, disabled: 0, is_group: 0 }}
                    initialQuery={
                      unresolvedInventoryWarehouseQuery || undefined
                    }
                  />
                </Form.Item>
                <Form.Item
                  extra={
                    unresolvedInventoryItemQuery
                      ? selectedItemCode
                        ? `已选择商品 ${selectedItemCode}；保存草稿后会重新校验原搜索词“${unresolvedInventoryItemQuery}”。`
                        : inventoryProductCandidates.length
                          ? `AI 识别到搜索词“${unresolvedInventoryItemQuery}”，后端找到 ${inventoryProductCandidates.length} 个候选，请从下拉列表中选择具体商品。`
                          : `AI 只识别到搜索词“${unresolvedInventoryItemQuery}”，尚未匹配商品编码。请搜索并选择具体商品。`
                      : undefined
                  }
                  label="商品"
                  name="itemCode"
                  rules={[{ message: '请选择具体商品', required: true }]}
                >
                  <RemoteProductSelect
                    disabled={
                      busy ||
                      Boolean(versionConflict) ||
                      draft.boundFields?.target
                    }
                    company={company}
                    initialCandidates={inventoryProductCandidates}
                    initialQuery={unresolvedInventoryItemQuery || undefined}
                    itemContext="inventory"
                    placeholder={
                      unresolvedInventoryItemQuery
                        ? `搜索并选择“${unresolvedInventoryItemQuery}”对应的商品`
                        : '搜索并选择商品'
                    }
                    warehouse={selectedWarehouse}
                    onChange={() => {
                      form.setFieldValue('uom', undefined);
                      form.setFieldValue('valuationInputRate', undefined);
                      form.setFieldValue('valuationInputUom', undefined);
                      form.setFieldValue('valuationRate', undefined);
                      form.setFieldValue('valuationRateSource', undefined);
                      form.setFieldValue('valuationReferenceId', undefined);
                    }}
                  />
                </Form.Item>
                <Form.Item
                  label="调整方式"
                  name="adjustmentType"
                  rules={[{ required: true }]}
                >
                  <Select
                    disabled={
                      busy ||
                      Boolean(versionConflict) ||
                      draft.boundFields?.adjustmentType
                    }
                    options={[
                      { label: '调整到目标库存', value: 'set_target' },
                      { label: '增加库存', value: 'increase' },
                      { label: '减少库存', value: 'decrease' },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  label="数量"
                  name="quantity"
                  rules={[
                    { required: true },
                    {
                      validator: async (_, value) => {
                        if (
                          adjustmentType !== 'set_target' &&
                          Number(value ?? 0) <= 0
                        ) {
                          throw new Error('增加或减少库存时，数量必须大于 0');
                        }
                      },
                    },
                  ]}
                >
                  <InputNumber
                    min={0}
                    precision={6}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
                <Form.Item
                  extra={
                    inventoryItemMatchesSource
                      ? '库存草稿只能使用当前商品已配置的单位；如需新增包装单位，请先维护商品单位换算。'
                      : '更换商品后先保存草稿，系统会重新读取该商品的单位换算并提供可选单位。'
                  }
                  label="单位"
                  name="uom"
                  rules={
                    inventoryUomOptions.length
                      ? [
                          {
                            message: '请选择商品已配置的单位',
                            required: true,
                          },
                        ]
                      : undefined
                  }
                >
                  <Select
                    disabled={!inventoryUomOptions.length}
                    onChange={(value) => updateInventoryValuationForUom(value)}
                    options={inventoryUomOptions}
                    placeholder={
                      inventoryItemMatchesSource
                        ? '商品单位尚未加载'
                        : '保存草稿后加载该商品单位'
                    }
                  />
                </Form.Item>
                <Form.Item hidden name="valuationInputUom">
                  <Input />
                </Form.Item>
                <Form.Item hidden name="valuationRate">
                  <InputNumber />
                </Form.Item>
                <Form.Item hidden name="valuationRateSource">
                  <Input />
                </Form.Item>
                <Form.Item hidden name="valuationReferenceId">
                  <Input />
                </Form.Item>
                {inventoryTargetStockQty !== null ? (
                  <ProCard
                    style={{ gridColumn: '1 / -1' }}
                    title="库存估值与价值影响"
                    variant="outlined"
                  >
                    <div
                      style={{
                        display: 'grid',
                        gap: 12,
                        gridTemplateColumns:
                          'repeat(auto-fit, minmax(220px, 1fr))',
                      }}
                    >
                      <Form.Item
                        extra={inventoryValuationRateHelp}
                        label={`本次计价单位价格（每${inventoryValuationInputDisplay || '所选单位'}）`}
                        name="valuationInputRate"
                        required={inventoryNeedsValuationRate}
                        rules={
                          inventoryNeedsValuationRate
                            ? [
                                {
                                  validator: async (_, value) => {
                                    if (Number(value ?? 0) <= 0) {
                                      throw new Error(
                                        '增加库存时必须填写有效的计价单位价格',
                                      );
                                    }
                                  },
                                },
                              ]
                            : undefined
                        }
                      >
                        <InputNumber
                          min={0}
                          onChange={(value) => {
                            const numericValue = Number(value);
                            form.setFieldsValue({
                              valuationInputUom: inventoryUom,
                              valuationRate:
                                Number.isFinite(numericValue) &&
                                inventoryConversionFactor > 0
                                  ? numericValue / inventoryConversionFactor
                                  : undefined,
                              valuationRateSource: 'user',
                              valuationReferenceId: undefined,
                            });
                          }}
                          precision={6}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                      <div>
                        <Typography.Text type="secondary">
                          执行后库存估值单价（每
                          {inventoryStockUomDisplay ||
                            String(
                              inventorySourceItem.stock_uom ?? '库存基准单位',
                            )}
                          ）
                        </Typography.Text>
                        <div style={{ marginTop: 8 }}>
                          <Typography.Text strong style={{ fontSize: 20 }}>
                            {formatInventoryNumber(inventoryValuationRate)}
                          </Typography.Text>
                          <Tag style={{ marginInlineStart: 8 }}>
                            {inventoryValuationRateSource ===
                            'buying_price_reference'
                              ? '采购价候选'
                              : inventoryValuationRateSource ===
                                  'current_valuation'
                                ? '当前库存估值'
                                : inventoryValuationRateSource === 'user'
                                  ? '人工填写'
                                  : '待确认'}
                          </Tag>
                        </div>
                        <Typography.Paragraph
                          style={{ marginBottom: 0, marginTop: 8 }}
                          type="secondary"
                        >
                          该数值会写入 ERPNext Stock
                          Reconciliation，影响库存价值；
                          采购价格表本身只是候选来源，不会创建采购单、应付或采购发票。
                        </Typography.Paragraph>
                      </div>
                    </div>

                    {inventoryValuationCandidates.length ? (
                      <div style={{ marginTop: 16 }}>
                        <Typography.Text strong>
                          有效采购价格候选
                        </Typography.Text>
                        <Table<Record<string, unknown>>
                          columns={[
                            {
                              dataIndex: 'price_list',
                              render: (value: unknown) => (
                                <PriceListName code={String(value ?? '')} />
                              ),
                              title: '价格表',
                              width: 150,
                            },
                            {
                              render: (_, row) =>
                                `${formatInventoryNumber(row.rate)} ${String(row.currency ?? '')}`.trim(),
                              title: '原价格',
                              width: 120,
                            },
                            {
                              render: (_, row) =>
                                String(row.uom_display ?? row.uom ?? '-'),
                              title: '计价单位',
                              width: 100,
                            },
                            {
                              dataIndex: 'conversion_factor',
                              render: (value: unknown) =>
                                formatInventoryNumber(value),
                              title: '换算系数',
                              width: 100,
                            },
                            {
                              dataIndex: 'stock_unit_rate',
                              render: (value: unknown) =>
                                formatInventoryNumber(value),
                              title: `折算后/${inventoryStockUomDisplay || '库存单位'}`,
                              width: 130,
                            },
                            {
                              render: (_, row) =>
                                row.valid_from || row.valid_upto
                                  ? `${row.valid_from ?? '不限'} ～ ${row.valid_upto ?? '不限'}`
                                  : '长期有效',
                              title: '有效期',
                              width: 190,
                            },
                            {
                              fixed: 'right' as const,
                              render: (_, row) => (
                                <Button
                                  disabled={!row.selectable}
                                  onClick={() =>
                                    applyInventoryValuationCandidate(row)
                                  }
                                  size="small"
                                  type={
                                    row.reference_id ===
                                    inventoryValuationReferenceId
                                      ? 'primary'
                                      : 'link'
                                  }
                                >
                                  {!row.selectable
                                    ? '不可用'
                                    : row.reference_id ===
                                        inventoryValuationReferenceId
                                      ? '已采用'
                                      : '采用'}
                                </Button>
                              ),
                              title: '操作',
                              width: 90,
                            },
                          ]}
                          dataSource={inventoryValuationCandidates}
                          pagination={false}
                          rowKey={(row) => String(row.reference_id)}
                          scroll={{ x: 880 }}
                          size="small"
                          style={{ marginTop: 8 }}
                        />
                        {inventoryValuationCandidates.some(
                          (row) => !row.selectable,
                        ) ? (
                          <Typography.Paragraph
                            style={{ marginBottom: 0, marginTop: 8 }}
                            type="secondary"
                          >
                            “不可用”表示价格缺少计价单位或商品没有对应换算关系，需要先维护商品价格或单位。
                          </Typography.Paragraph>
                        ) : null}
                      </div>
                    ) : (
                      <Alert
                        message="该商品当前没有有效采购价格候选，可沿用当前库存估值或人工填写。"
                        showIcon
                        style={{ marginTop: 16 }}
                        type="info"
                      />
                    )}

                    <div
                      style={{
                        display: 'grid',
                        gap: 12,
                        gridTemplateColumns:
                          'repeat(auto-fit, minmax(145px, 1fr))',
                        marginTop: 16,
                      }}
                    >
                      {[
                        [
                          '数量换算',
                          `${formatInventoryNumber(inventoryQuantity)} ${String(selectedInventoryUom?.uom_display ?? inventoryUom ?? '')} = ${formatInventoryNumber(inventoryInputStockQty)} ${inventoryStockUomDisplay}`,
                        ],
                        [
                          '当前库存',
                          `${formatInventoryNumber(inventoryCurrentStockQty)} ${inventoryStockUomDisplay}`,
                        ],
                        [
                          '执行后库存',
                          `${formatInventoryNumber(inventoryTargetStockQty)} ${inventoryStockUomDisplay}`,
                        ],
                        [
                          '当前库存价值',
                          formatInventoryNumber(inventoryCurrentStockValue),
                        ],
                        [
                          '执行后库存价值',
                          formatInventoryNumber(inventoryTargetStockValue),
                        ],
                        [
                          '库存价值差额',
                          formatInventoryNumber(inventoryStockValueDifference),
                        ],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <Typography.Text type="secondary">
                            {label}
                          </Typography.Text>
                          <div>
                            <Typography.Text strong>{value}</Typography.Text>
                          </div>
                        </div>
                      ))}
                    </div>

                    {inventoryRevaluesExistingStock ? (
                      <Alert
                        message="本次估值与当前仓库估值不同，执行时会同时重新估值已有库存。"
                        showIcon
                        style={{ marginTop: 16 }}
                        type="warning"
                      />
                    ) : null}
                    {inventorySourceItem.valuation_selection_required ? (
                      <Alert
                        message="当前单位存在多个采购价候选，或只有其他单位的采购价；请明确采用一项或人工填写。"
                        showIcon
                        style={{ marginTop: 16 }}
                        type="warning"
                      />
                    ) : null}
                  </ProCard>
                ) : null}
                <div style={{ gridColumn: '1 / -1' }}>
                  <Typography.Text type="secondary">快捷原因</Typography.Text>
                  <div style={{ marginBottom: 8, marginTop: 6 }}>
                    <Space wrap>
                      {INVENTORY_REASON_PRESETS.filter((reason) => {
                        if (reason === '盘点盘盈')
                          return adjustmentType !== 'decrease';
                        if (
                          reason === '盘点盘亏' ||
                          reason === '破损、报废或过期损耗'
                        )
                          return adjustmentType !== 'increase';
                        return true;
                      }).map((reason) => (
                        <Button
                          key={reason}
                          onClick={() => {
                            form.setFieldValue('reason', reason);
                            setDirty(true);
                          }}
                          size="small"
                        >
                          {reason}
                        </Button>
                      ))}
                      <Button
                        onClick={() => {
                          form.setFieldValue('reason', undefined);
                          setDirty(true);
                          form.scrollToField('reason', {
                            behavior: 'smooth',
                            block: 'center',
                            focus: true,
                          });
                        }}
                        size="small"
                      >
                        其他（手工填写）
                      </Button>
                    </Space>
                  </div>
                  <Form.Item
                    label="调整原因"
                    name="reason"
                    rules={[
                      {
                        message: '请填写盘点差异或业务原因',
                        required: true,
                      },
                    ]}
                  >
                    <Input.TextArea maxLength={1000} rows={3} />
                  </Form.Item>
                </div>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'grid',
                    gap: 12,
                    gridTemplateColumns: '1fr 1fr',
                  }}
                >
                  <Form.Item
                    label="处理方式"
                    name="operation"
                    rules={[{ required: true }]}
                  >
                    <Select
                      disabled={
                        busy ||
                        Boolean(versionConflict) ||
                        draft.boundFields?.operation
                      }
                      options={[
                        { label: '创建新订单', value: 'create' },
                        { label: '修改现有订单', value: 'update' },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item
                    label="来源订单号"
                    name="orderNumber"
                    rules={[
                      {
                        validator: async (_, value) => {
                          if (productOperation === 'update' && !value) {
                            throw new Error('修改订单时必须填写本系统订单号');
                          }
                        },
                      },
                    ]}
                  >
                    <Input
                      disabled={
                        busy ||
                        Boolean(versionConflict) ||
                        productOperation !== 'update' ||
                        draft.boundFields?.target
                      }
                      placeholder="例如 SO-0001 / PO-0001"
                    />
                  </Form.Item>
                  <Form.Item
                    extra={
                      unresolvedOrderPartyQuery
                        ? selectedParty
                          ? `已选择${isPurchaseOrder ? '供应商' : '客户'} ${selectedParty}；保存后会重新校验。`
                          : `AI 只识别到搜索词“${unresolvedOrderPartyQuery}”，请搜索并选择具体${isPurchaseOrder ? '供应商' : '客户'}。`
                        : undefined
                    }
                    label={
                      draft.draftType === 'purchase_order' ? '供应商' : '客户'
                    }
                    name="party"
                    rules={[{ required: true }]}
                  >
                    <RemoteLinkSelect
                      doctype={
                        draft.draftType === 'purchase_order'
                          ? 'Supplier'
                          : 'Customer'
                      }
                      initialQuery={unresolvedOrderPartyQuery || undefined}
                      placeholder={`搜索并选择${isPurchaseOrder ? '供应商' : '客户'}`}
                    />
                  </Form.Item>
                  {draft.draftType === 'purchase_order' ? (
                    <Form.Item
                      label="币种"
                      name="currency"
                      rules={[{ required: true }]}
                    >
                      <CurrencySelect />
                    </Form.Item>
                  ) : null}
                  <Form.Item
                    extra={
                      unresolvedOrderWarehouseQuery
                        ? selectedWarehouse
                          ? `已选择默认仓库 ${selectedWarehouse}；保存后会重新校验。`
                          : `AI 只识别到默认仓库搜索词“${unresolvedOrderWarehouseQuery}”，请重新选择；也可以为每个商品行单独选择仓库。`
                        : '未填写时，每个商品行必须单独选择仓库。'
                    }
                    label="默认仓库"
                    name="warehouse"
                  >
                    <RemoteLinkSelect
                      doctype="Warehouse"
                      filters={{ company, disabled: 0, is_group: 0 }}
                      initialQuery={unresolvedOrderWarehouseQuery || undefined}
                    />
                  </Form.Item>
                  {draft.draftType === 'purchase_order' ? (
                    <Form.Item label="供应商参考号" name="supplierRef">
                      <Input maxLength={140} />
                    </Form.Item>
                  ) : null}
                  <Form.Item
                    label="单据日期"
                    name="transactionDate"
                    rules={[{ required: true }]}
                  >
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item
                    label={
                      draft.draftType === 'purchase_order'
                        ? '预计到货日期'
                        : '交货日期'
                    }
                    name="targetDate"
                    rules={[{ required: true }]}
                  >
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item
                    label={
                      draft.draftType === 'purchase_order'
                        ? '采购取值模式'
                        : '销售模式'
                    }
                    name="defaultMode"
                  >
                    <Select
                      options={[
                        { label: '批发', value: 'wholesale' },
                        { label: '零售', value: 'retail' },
                      ]}
                    />
                  </Form.Item>
                </div>
                <Form.Item label="备注" name="remarks">
                  <Input.TextArea maxLength={1000} />
                </Form.Item>
                <Form.List name="items">
                  {(fields, { add, remove }) => (
                    <Space orientation="vertical" style={{ width: '100%' }}>
                      {fields.map((field) => {
                        const sourceRow = orderSourceItems[field.name] ?? {};
                        const itemQuery = unresolvedSelectionQuery(
                          sourceRow,
                          'item_code',
                          'item_query',
                        );
                        const warehouseQuery = unresolvedSelectionQuery(
                          sourceRow,
                          'warehouse',
                          'warehouse_query',
                        );
                        const selectedLine = orderItems?.[field.name];
                        const lineCandidates = productCandidates(
                          sourceRow.candidates,
                        );
                        const lineItemMatchesSource =
                          Boolean(selectedLine?.itemCode) &&
                          selectedLine?.itemCode === sourceRow.item_code;
                        const lineUomOptions =
                          lineItemMatchesSource &&
                          Array.isArray(sourceRow.available_uoms)
                            ? sourceRow.available_uoms
                                .map(objectValue)
                                .map((row) => ({
                                  label:
                                    typeof row.uom_display === 'string' &&
                                    row.uom_display.trim()
                                      ? row.uom_display.trim()
                                      : String(row.uom ?? ''),
                                  value: String(row.uom ?? '').trim(),
                                }))
                                .filter((option) => option.value)
                            : [];
                        return (
                          <ProCard
                            key={field.key}
                            size="small"
                            title={`商品行 ${field.name + 1}`}
                            extra={
                              <Button danger onClick={() => remove(field.name)}>
                                删除
                              </Button>
                            }
                          >
                            <div
                              style={{
                                display: 'grid',
                                gap: 12,
                                gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr',
                              }}
                            >
                              <Form.Item
                                extra={
                                  itemQuery
                                    ? selectedLine?.itemCode
                                      ? `已选择商品 ${selectedLine.itemCode}；保存后会重新校验。`
                                      : lineCandidates.length
                                        ? `AI 识别到搜索词“${itemQuery}”，后端找到 ${lineCandidates.length} 个候选，请从下拉列表中选择。`
                                        : `AI 只识别到搜索词“${itemQuery}”，请搜索并选择具体商品。`
                                    : undefined
                                }
                                name={[field.name, 'itemCode']}
                                rules={[
                                  {
                                    message: '请选择具体商品',
                                    required: true,
                                  },
                                ]}
                              >
                                <RemoteProductSelect
                                  company={company}
                                  initialCandidates={lineCandidates}
                                  initialQuery={itemQuery || undefined}
                                  itemContext={
                                    isPurchaseOrder ? 'purchase' : 'sales'
                                  }
                                  placeholder={
                                    itemQuery
                                      ? `搜索并选择“${itemQuery}”对应的商品`
                                      : '商品'
                                  }
                                  onChange={() =>
                                    form.setFieldValue(
                                      ['items', field.name, 'uom'],
                                      undefined,
                                    )
                                  }
                                />
                              </Form.Item>
                              <Form.Item
                                name={[field.name, 'qty']}
                                rules={[{ required: true }]}
                              >
                                <InputNumber
                                  min={0.000001}
                                  placeholder="数量"
                                  style={{ width: '100%' }}
                                />
                              </Form.Item>
                              <Form.Item
                                extra={
                                  lineItemMatchesSource
                                    ? undefined
                                    : '更换商品后先保存草稿，系统会重新读取该商品的可用单位。'
                                }
                                name={[field.name, 'uom']}
                                rules={
                                  lineUomOptions.length
                                    ? [
                                        {
                                          message: '请选择商品已配置的单位',
                                          required: true,
                                        },
                                      ]
                                    : undefined
                                }
                              >
                                <Select
                                  disabled={!lineUomOptions.length}
                                  options={lineUomOptions}
                                  placeholder="商品单位"
                                />
                              </Form.Item>
                              <Form.Item
                                extra={
                                  <OrderLinePriceHint
                                    draft={draft}
                                    itemCode={
                                      orderItems?.[field.name]?.itemCode
                                    }
                                    price={orderItems?.[field.name]?.price}
                                  />
                                }
                                name={[field.name, 'price']}
                              >
                                <InputNumber
                                  min={0}
                                  placeholder="价格"
                                  precision={6}
                                  style={{ width: '100%' }}
                                />
                              </Form.Item>
                              <Form.Item
                                extra={
                                  warehouseQuery
                                    ? selectedLine?.warehouse
                                      ? `已选择仓库 ${selectedLine.warehouse}；保存后会重新校验。`
                                      : `AI 只识别到仓库搜索词“${warehouseQuery}”，请重新选择。`
                                    : undefined
                                }
                                name={[field.name, 'warehouse']}
                              >
                                <RemoteLinkSelect
                                  doctype="Warehouse"
                                  filters={{
                                    company,
                                    disabled: 0,
                                    is_group: 0,
                                  }}
                                  initialQuery={warehouseQuery || undefined}
                                  placeholder="仓库"
                                />
                              </Form.Item>
                            </div>
                          </ProCard>
                        );
                      })}
                      <Button onClick={() => add()} type="dashed">
                        新增商品行
                      </Button>
                    </Space>
                  )}
                </Form.List>
              </>
            )}
          </Form>
        ) : (
          <div style={{ minHeight: 180 }} />
        )}
      </Spin>
    </Modal>
  );
}
