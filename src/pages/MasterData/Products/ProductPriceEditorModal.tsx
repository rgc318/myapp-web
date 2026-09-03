import {
  Alert,
  DatePicker,
  Form,
  InputNumber,
  Modal,
  message,
  Select,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import { CurrencySelect } from '@/components/CurrencySelect';
import { PriceListName } from '@/components/PriceListName';
import {
  type ProductPriceCollection,
  type ProductPriceRecord,
  type ProductSummary,
  saveProductPrice,
} from '@/services/myapp/master-data';
import { resolveDisplayUom } from '@/utils/myapp-display';
import { resolvePriceListOptionLabel } from '@/utils/price-list-display';

type ProductPriceFormValues = {
  currency?: string;
  priceList: string;
  rate: number;
  uom: string;
  validFrom?: Dayjs | null;
  validUpto?: Dayjs | null;
};

export function ProductPriceEditorModal({
  collection,
  defaultType,
  editingPrice,
  onClose,
  onSaved,
  open,
  product,
}: {
  collection?: ProductPriceCollection;
  defaultType: 'selling' | 'buying';
  editingPrice?: ProductPriceRecord;
  onClose: () => void;
  onSaved: () => void;
  open: boolean;
  product: ProductSummary;
}) {
  const [form] = Form.useForm<ProductPriceFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const priceListOptions = useMemo(
    () =>
      (collection?.priceLists ?? [])
        .filter((row) => (defaultType === 'buying' ? row.buying : row.selling))
        .map((row) => ({
          currency: row.currency,
          label: resolvePriceListOptionLabel(row.name),
          value: row.name,
        })),
    [collection?.priceLists, defaultType],
  );
  const uomOptions = product.allUoms.map((uom) => ({
    label: resolveDisplayUom(uom, product.allUomDisplays[uom]),
    value: uom,
  }));

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    const defaultPriceList =
      priceListOptions[0]?.value ??
      (defaultType === 'buying' ? 'Standard Buying' : 'Standard Selling');
    form.setFieldsValue({
      currency:
        editingPrice?.currency || priceListOptions[0]?.currency || 'CNY',
      priceList: editingPrice?.priceList ?? defaultPriceList,
      rate: editingPrice?.rate ?? undefined,
      uom: editingPrice?.uom ?? product.stockUom,
      validFrom: editingPrice?.validFrom ? dayjs(editingPrice.validFrom) : null,
      validUpto: editingPrice?.validUpto ? dayjs(editingPrice.validUpto) : null,
    });
  }, [
    defaultType,
    editingPrice,
    form,
    open,
    priceListOptions,
    product.stockUom,
  ]);

  const handleSubmit = async (values: ProductPriceFormValues) => {
    setSubmitting(true);
    try {
      await saveProductPrice({
        currency: values.currency,
        itemCode: product.itemCode,
        itemModified: collection?.itemModified ?? product.modified,
        priceList: values.priceList,
        priceModified: editingPrice?.modified,
        priceName: editingPrice?.name,
        rate: Number(values.rate),
        uom: values.uom,
        validFrom: values.validFrom?.format('YYYY-MM-DD'),
        validUpto: values.validUpto?.format('YYYY-MM-DD'),
      });
      onSaved();
      onClose();
    } catch (caught) {
      message.error(caught instanceof Error ? caught.message : '价格保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      confirmLoading={submitting}
      destroyOnHidden
      onCancel={onClose}
      onOk={() => form.submit()}
      open={open}
      title={
        editingPrice ? (
          <>
            修改价格 · <PriceListName code={editingPrice.priceList} />
          </>
        ) : (
          '新增价格'
        )
      }
      width={760}
    >
      <Alert
        description={
          editingPrice
            ? '现有价格的价格表、币种和计价单位作为定位键锁定。若这些字段填错，请新增正确价格后终止旧价格，避免留下不可追踪的覆盖。'
            : '价格必须明确属于一个价格表、币种和商品单位；同一组合不能存在有效期重叠的重复记录。'
        }
        showIcon
        style={{ marginBottom: 16 }}
        title={editingPrice ? '本次只修改金额或有效期' : '创建单位化价格'}
        type="info"
      />
      <Form<ProductPriceFormValues>
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item
          label="价格表"
          name="priceList"
          rules={[{ required: true, message: '请选择价格表' }]}
        >
          <Select
            disabled={Boolean(editingPrice)}
            onChange={(value) => {
              const option = priceListOptions.find(
                (row) => row.value === value,
              );
              if (option?.currency)
                form.setFieldValue('currency', option.currency);
            }}
            options={priceListOptions}
            showSearch
          />
        </Form.Item>
        <Form.Item
          label="计价单位"
          name="uom"
          rules={[{ required: true, message: '请选择计价单位' }]}
        >
          <Select
            disabled={Boolean(editingPrice)}
            options={uomOptions}
            showSearch
          />
        </Form.Item>
        <Form.Item
          label="币种"
          name="currency"
          rules={[{ required: true, message: '请选择币种' }]}
        >
          <CurrencySelect disabled={Boolean(editingPrice)} />
        </Form.Item>
        <Form.Item
          label="价格"
          name="rate"
          rules={[{ required: true, message: '请输入价格' }]}
        >
          <InputNumber min={0} precision={6} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="生效日期" name="validFrom">
          <DatePicker allowClear style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          dependencies={['validFrom']}
          label="失效日期"
          name="validUpto"
          rules={[
            ({ getFieldValue }) => ({
              validator: async (_, value?: Dayjs | null) => {
                const validFrom = getFieldValue('validFrom') as Dayjs | null;
                if (value && validFrom && value.isBefore(validFrom, 'day')) {
                  throw new Error('失效日期不能早于生效日期');
                }
              },
            }),
          ]}
        >
          <DatePicker allowClear style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
