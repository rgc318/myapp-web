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
  Typography,
} from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RemoteLinkSelect } from '@/components';
import { CurrencySelect } from '@/components/CurrencySelect';
import { UomSelect } from '@/components/UomSelect';
import {
  type AiDraft,
  executeAiDraft,
  getAiDraft,
  isAiDraftVersionConflictError,
  updateAiDraft,
} from '@/services/myapp/ai';
import { notifyMutationError } from '@/services/myapp/mutation';
import { AiDraftProgress } from './AiDraftProgress';
import { AiDraftBusinessReview } from './AiDraftReview';
import { AiDraftVersionConflict } from './AiDraftVersionConflict';
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
  brand: '品牌',
  currency: '币种',
  description: '商品描述',
  item_group: '商品分类',
  item_name: '商品名称',
  retail_rate: '零售价',
  standard_buying_rate: '成本价',
  standard_selling_rate: '标准售价',
  stock_uom: '库存基准单位',
  wholesale_rate: '批发价',
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function productStateValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '未设置';
  return String(value);
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

function ProductUpdateState({ draft }: { draft: AiDraft }) {
  const state = objectValue(draft.payload._state);
  if (state.operation !== 'update') return null;
  const baseline = objectValue(state.baseline);
  const patch = objectValue(state.patch);
  const context = objectValue(state.context);
  const changedFields = Object.keys(patch);
  const stockQty = context.company_total_qty;
  const stockUom =
    String(context.stock_uom_display ?? context.stock_uom ?? '').trim() || '-';
  return (
    <Alert
      description={
        <Space orientation="vertical" size={4}>
          <Typography.Text>
            当前库存：{productStateValue(stockQty)} {stockUom}
            （只读，不会作为初始库存写入）
          </Typography.Text>
          {changedFields.length ? (
            changedFields.map((field) => (
              <Typography.Text key={field}>
                {PRODUCT_STATE_LABELS[field] ?? field}：
                {productStateValue(baseline[field])} →{' '}
                {productStateValue(patch[field])}
              </Typography.Text>
            ))
          ) : (
            <Typography.Text>尚未产生字段修改。</Typography.Text>
          )}
          <Typography.Text type="secondary">
            如需改变库存，请单独创建库存调整草稿。
          </Typography.Text>
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
  onUpdated,
}: {
  draftId: string | null;
  onClose: () => void;
  onLoaded?: (draft: AiDraft) => void;
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
  const onCloseRef = useRef(onClose);
  const onLoadedRef = useRef(onLoaded);
  const company = Form.useWatch('company', form);
  const adjustmentType = Form.useWatch('adjustmentType', form);
  const selectedBrand = Form.useWatch('brand', form);
  const inventoryItemCode = Form.useWatch('itemCode', form);
  const selectedItemGroup = Form.useWatch('itemGroup', form);
  const openingQty = Form.useWatch('openingQty', form);
  const selectedParty = Form.useWatch('party', form);
  const stockUom = Form.useWatch('stockUom', form);
  const selectedWarehouse = Form.useWatch('warehouse', form);
  const orderItems = Form.useWatch('items', form);
  const hasOpeningStock = Number(openingQty ?? 0) > 0;
  const isProductUpdate =
    draft?.draftType === 'product_setup' &&
    draft.payload.operation === 'update';
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
            {draft.draftType === 'product_setup' ? (
              <ProductUpdateState draft={draft} />
            ) : null}
            <Form.Item label="公司" name="company" rules={[{ required: true }]}>
              <Input disabled />
            </Form.Item>
            {draft.draftType === 'product_setup' ? (
              <>
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
                  <Form.Item label="商品编码" name="itemCode">
                    <Input disabled={isProductUpdate} />
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
                    <UomSelect />
                  </Form.Item>
                  <Form.Item
                    label="币种"
                    name="currency"
                    rules={[{ required: true }]}
                  >
                    <CurrencySelect />
                  </Form.Item>
                  <Form.Item
                    label="标准售价（默认单价）"
                    name="standardSellingRate"
                    extra="写入 Standard Selling，作为未指定销售模式时的默认销售单价。"
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
                    extra="写入 Wholesale 价格表，供批发销售模式默认取价。"
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
                    extra="写入 Retail 价格表，供零售销售模式默认取价。"
                  >
                    <InputNumber
                      min={0}
                      precision={6}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  <Form.Item
                    label="成本价（默认采购价）"
                    name="standardBuyingRate"
                    extra={
                      hasOpeningStock
                        ? '用于首次入库成本，同时写入 Standard Buying 作为默认采购参考价；不会使用售价代替。'
                        : '写入 Standard Buying，作为采购业务的默认成本参考价。'
                    }
                    required={hasOpeningStock}
                    rules={[
                      {
                        validator: async (_, value) => {
                          if (
                            Number(form.getFieldValue('openingQty') ?? 0) > 0 &&
                            (value === null ||
                              value === undefined ||
                              value === '')
                          ) {
                            throw new Error(
                              '填写初始库存时，请输入成本价（默认采购价）',
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
                  gridTemplateColumns: '1fr 1fr',
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
                      ? inventoryItemCode
                        ? `已选择商品 ${inventoryItemCode}；保存草稿后会重新校验原搜索词“${unresolvedInventoryItemQuery}”。`
                        : `AI 只识别到搜索词“${unresolvedInventoryItemQuery}”，尚未匹配商品编码。请搜索并选择具体商品。`
                      : undefined
                  }
                  label="商品"
                  name="itemCode"
                  rules={[{ message: '请选择具体商品', required: true }]}
                >
                  <RemoteLinkSelect
                    doctype="Item"
                    filters={{ disabled: 0, is_stock_item: 1 }}
                    initialQuery={unresolvedInventoryItemQuery || undefined}
                    placeholder={
                      unresolvedInventoryItemQuery
                        ? `搜索并选择“${unresolvedInventoryItemQuery}”对应的商品`
                        : '搜索并选择商品'
                    }
                  />
                </Form.Item>
                <Form.Item
                  label="调整方式"
                  name="adjustmentType"
                  rules={[{ required: true }]}
                >
                  <Select
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
                <Form.Item label="单位" name="uom">
                  <UomSelect />
                </Form.Item>
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
                                <RemoteLinkSelect
                                  doctype="Item"
                                  filters={{ disabled: 0 }}
                                  initialQuery={itemQuery || undefined}
                                  placeholder={
                                    itemQuery
                                      ? `搜索并选择“${itemQuery}”对应的商品`
                                      : '商品'
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
                              <Form.Item name={[field.name, 'uom']}>
                                <UomSelect placeholder="单位" />
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
