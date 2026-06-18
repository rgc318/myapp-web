import { Select } from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  type LinkOption,
  type LinkOptionFilters,
  searchLinkOptions,
} from '@/services/myapp/master-data';

function optionLabel(option: LinkOption) {
  return option.description
    ? `${option.label} (${option.description})`
    : option.label;
}

export function RemoteLinkSelect({
  disabled,
  doctype,
  extraFields,
  filters,
  limit = 20,
  placeholder,
  style,
  value,
  onChange,
}: {
  disabled?: boolean;
  doctype: string;
  extraFields?: string[];
  filters?: LinkOptionFilters;
  limit?: number;
  placeholder?: string;
  style?: React.CSSProperties;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [fetching, setFetching] = useState(false);
  const [options, setOptions] = useState<LinkOption[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const requestRef = useRef(0);

  useEffect(
    () => () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    },
    [],
  );

  const loadOptions = async (query = '') => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setFetching(true);
    try {
      const nextOptions = await searchLinkOptions(
        doctype,
        query,
        extraFields,
        limit,
        filters,
      );
      if (requestId === requestRef.current) {
        setOptions(nextOptions);
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

  const loadInitialOptions = () => {
    if (!options.length) {
      void loadOptions();
    }
  };

  const selectOptions = useMemo(() => {
    const mapped = options.map((option) => ({
      label: optionLabel(option),
      value: option.value,
    }));
    if (value && !mapped.some((option) => option.value === value)) {
      return [{ label: value, value }, ...mapped];
    }
    return mapped;
  }, [options, value]);

  return (
    <Select
      allowClear
      disabled={disabled}
      filterOption={false}
      loading={fetching}
      onChange={(nextValue) => onChange?.(nextValue ?? '')}
      onFocus={loadInitialOptions}
      onOpenChange={(open) => {
        if (open) {
          loadInitialOptions();
        }
      }}
      onSearch={scheduleSearch}
      options={selectOptions}
      placeholder={placeholder}
      showSearch
      style={style}
      value={value || undefined}
    />
  );
}
