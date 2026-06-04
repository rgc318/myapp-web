export type PageResult<T> = {
  hasMore: boolean;
  items: T[];
  total: number;
};

export function toOptionalNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function toNumber(value: unknown, fallback = 0) {
  return toOptionalNumber(value) ?? fallback;
}

export function toText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

export function toOptionalText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function toStringList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? '')).filter(Boolean)
    : [];
}

export function compactPayload<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (value === undefined || value === null) {
        return false;
      }
      if (typeof value === 'string' && !value.trim()) {
        return false;
      }
      return true;
    }),
  ) as Partial<T>;
}

export function readObject(value: unknown) {
  return value && typeof value === 'object'
    ? (value as Record<string, any>)
    : {};
}

export function readRows(value: unknown) {
  if (Array.isArray(value)) {
    return value as Record<string, any>[];
  }

  const payload = readObject(value);
  if (Array.isArray(payload.data)) {
    return payload.data as Record<string, any>[];
  }
  if (Array.isArray(payload.items)) {
    return payload.items as Record<string, any>[];
  }
  if (Array.isArray(payload.rows)) {
    return payload.rows as Record<string, any>[];
  }

  return [];
}

export function readPaginationMeta(value: unknown, visibleCount?: number) {
  const payload = readObject(value);
  const meta = readObject(payload.meta);
  const pagination = readObject(payload.pagination);

  return {
    hasMore: Boolean(meta.has_more ?? pagination.has_more),
    total:
      toOptionalNumber(meta.total) ??
      toOptionalNumber(meta.total_count) ??
      toOptionalNumber(pagination.total_count) ??
      visibleCount ??
      0,
  };
}
