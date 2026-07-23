import { Select } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { listUoms, type UomSummary } from '@/services/myapp/master-data';
import { sortUomsByBusinessPriority } from '@/utils/display-uom';

function optionLabel(uom: UomSummary) {
  const display = uom.displayName || uom.uomName || uom.name;
  return display === uom.name ? display : `${display} (${uom.name})`;
}

const uomCache = new Map<string, UomSummary>();
const uomRequestCache = new Map<string, Promise<UomSummary[]>>();

async function loadCachedUoms(query: string) {
  const cacheKey = query.trim().toLowerCase();
  const pending = uomRequestCache.get(cacheKey);
  if (pending) {
    return pending;
  }

  const request = listUoms({
    enabled: 1,
    limit: 100,
    searchKey: query,
  }).then((result) => {
    result.items.forEach((uom) => {
      uomCache.set(uom.name, uom);
    });
    return sortUomsByBusinessPriority(
      result.items,
      (uom) => uom.name,
      (uom) => uom.displayName,
    );
  });
  uomRequestCache.set(cacheKey, request);
  try {
    return await request;
  } finally {
    uomRequestCache.delete(cacheKey);
  }
}

export function UomSelect({
  disabled,
  placeholder = '选择单位',
  style,
  value,
  displayValue,
  onChange,
}: {
  disabled?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
  value?: string | null;
  /** 商品详情接口已返回的单位展示名，可避免首次打开表单时短暂显示编码。 */
  displayValue?: string | null;
  onChange?: (value: string) => void;
}) {
  const [fetching, setFetching] = useState(false);
  const [options, setOptions] = useState<UomSummary[]>([]);

  const loadOptions = useCallback(async (query = '') => {
    setFetching(true);
    try {
      setOptions(await loadCachedUoms(query));
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    const normalizedValue = value?.trim();
    if (!normalizedValue || uomCache.has(normalizedValue)) {
      return;
    }
    void loadOptions(normalizedValue);
  }, [loadOptions, value]);

  const selectOptions = useMemo(() => {
    const mapped = options.map((uom) => ({
      label: optionLabel(uom),
      value: uom.name,
    }));
    if (value && !mapped.some((option) => option.value === value)) {
      const cached = uomCache.get(value);
      return [
        {
          label: displayValue || (cached ? optionLabel(cached) : value),
          value,
        },
        ...mapped,
      ];
    }
    return mapped;
  }, [displayValue, options, value]);

  return (
    <Select
      allowClear
      disabled={disabled}
      filterOption={false}
      loading={fetching}
      onChange={(nextValue) => onChange?.(nextValue)}
      onOpenChange={(open) => {
        if (open && !options.length) {
          void loadOptions();
        }
      }}
      onSearch={(query) => {
        void loadOptions(query);
      }}
      options={selectOptions}
      placeholder={placeholder}
      showSearch
      style={style}
      value={value || undefined}
    />
  );
}
