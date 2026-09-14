import { Select } from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  type ProductSummary,
  searchProducts,
} from '@/services/myapp/master-data';

export type RemoteProductCandidate = {
  brand?: string | null;
  itemCode: string;
  itemName?: string | null;
  nickname?: string | null;
  specification?: string | null;
};

type ProductContext = 'sales' | 'purchase' | 'inventory' | 'any';

function candidateLabel(candidate: RemoteProductCandidate) {
  const itemName = candidate.itemName?.trim();
  const identity =
    itemName && itemName !== candidate.itemCode
      ? `${itemName}（${candidate.itemCode}）`
      : candidate.itemCode;
  const nickname = candidate.nickname?.trim();
  return [
    identity,
    nickname ? `昵称：${nickname}` : null,
    candidate.specification?.trim(),
    candidate.brand?.trim(),
  ]
    .filter(Boolean)
    .join(' · ');
}

function productCandidate(product: ProductSummary): RemoteProductCandidate {
  return {
    brand: product.brand,
    itemCode: product.itemCode,
    itemName: product.itemName,
    nickname: product.nickname,
    specification: product.specification,
  };
}

export function RemoteProductSelect({
  company,
  disabled,
  initialCandidates = [],
  initialQuery,
  itemContext = 'any',
  limit = 20,
  placeholder,
  style,
  value,
  warehouse,
  onChange,
}: {
  company?: string;
  disabled?: boolean;
  initialCandidates?: RemoteProductCandidate[];
  initialQuery?: string;
  itemContext?: ProductContext;
  limit?: number;
  placeholder?: string;
  style?: React.CSSProperties;
  value?: string;
  warehouse?: string;
  onChange?: (value: string) => void;
}) {
  const [fetching, setFetching] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [remoteCandidates, setRemoteCandidates] = useState<
    RemoteProductCandidate[]
  >([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const requestRef = useRef(0);
  const initialCandidatesKey = JSON.stringify(initialCandidates);

  useEffect(
    () => () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    requestRef.current += 1;
    setLoadError(null);
    setRemoteCandidates([]);
  }, [
    company,
    initialCandidatesKey,
    initialQuery,
    itemContext,
    limit,
    warehouse,
  ]);

  const loadOptions = async (query = '') => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setFetching(true);
    setLoadError(null);
    try {
      const result = await searchProducts({
        company,
        disabled: 0,
        itemContext,
        limit,
        searchKey: query,
        warehouse,
      });
      if (requestId === requestRef.current) {
        setRemoteCandidates(result.items.map(productCandidate));
      }
    } catch (error) {
      if (requestId === requestRef.current) {
        setRemoteCandidates([]);
        setLoadError(
          error instanceof Error ? error.message : '商品搜索失败，请稍后重试',
        );
      }
    } finally {
      if (requestId === requestRef.current) {
        setFetching(false);
      }
    }
  };

  const scheduleSearch = (query: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      void loadOptions(query);
    }, 250);
  };

  const candidates = useMemo(() => {
    const merged = new Map<string, RemoteProductCandidate>();
    [...initialCandidates, ...remoteCandidates].forEach((candidate) => {
      const itemCode = candidate.itemCode?.trim();
      if (itemCode && !merged.has(itemCode)) {
        merged.set(itemCode, { ...candidate, itemCode });
      }
    });
    return Array.from(merged.values());
  }, [initialCandidatesKey, remoteCandidates]);

  const options = useMemo(() => {
    const mapped = candidates.map((candidate) => ({
      label: candidateLabel(candidate),
      value: candidate.itemCode,
    }));
    if (value && !mapped.some((option) => option.value === value)) {
      return [{ label: value, value }, ...mapped];
    }
    return mapped;
  }, [candidates, value]);

  const loadInitialOptions = () => {
    if (!remoteCandidates.length) {
      void loadOptions(initialQuery);
    }
  };

  return (
    <Select
      allowClear
      disabled={disabled}
      filterOption={false}
      loading={fetching}
      notFoundContent={
        fetching ? '正在搜索商品…' : (loadError ?? '暂无匹配商品')
      }
      onChange={(nextValue) => onChange?.(nextValue ?? '')}
      onFocus={loadInitialOptions}
      onOpenChange={(open) => {
        if (open) {
          loadInitialOptions();
        }
      }}
      onSearch={scheduleSearch}
      options={options}
      placeholder={placeholder}
      showSearch
      style={style}
      value={value || undefined}
    />
  );
}
