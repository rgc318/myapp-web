import {
  type AiChatMessage,
  type AiDraft,
  resolveAiDraftCitation,
} from '@/services/myapp/ai';

export type InventoryDraftProductCandidate = {
  itemCode: string;
  itemName: string;
};

export type PendingInventoryCandidateSelection = {
  candidates: InventoryDraftProductCandidate[];
  draft: AiDraft;
  matches: InventoryDraftProductCandidate[];
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeCandidateText(value: unknown) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s\-_/（）()]+/gu, '');
}

export function getInventoryDraftProductCandidates(
  draft: AiDraft,
): InventoryDraftProductCandidate[] {
  if (draft.draftType !== 'inventory_adjustment') return [];
  const items = Array.isArray(draft.payload.items)
    ? draft.payload.items.map(asObject)
    : [];
  const row = items[0] ?? {};
  if (typeof row.item_code === 'string' && row.item_code.trim()) return [];
  return (Array.isArray(row.candidates) ? row.candidates : [])
    .map(asObject)
    .map((candidate) => ({
      itemCode: String(candidate.item_code ?? '').trim(),
      itemName: String(candidate.item_name ?? candidate.item_code ?? '').trim(),
    }))
    .filter((candidate) => candidate.itemCode);
}

export function findPendingInventoryCandidateSelection(
  messages: AiChatMessage[],
  input: string,
): PendingInventoryCandidateSelection | null {
  const normalizedInput = normalizeCandidateText(input);
  if (!normalizedInput) return null;

  for (const message of [...messages].reverse()) {
    for (const citation of [...(message.citations ?? [])].reverse()) {
      const draft = resolveAiDraftCitation(citation);
      if (!draft || draft.status !== 'draft') continue;
      const candidates = getInventoryDraftProductCandidates(draft);
      if (!candidates.length) continue;
      const matches = candidates.filter((candidate) => {
        const code = normalizeCandidateText(candidate.itemCode);
        const name = normalizeCandidateText(candidate.itemName);
        return (
          code === normalizedInput ||
          name === normalizedInput ||
          code.includes(normalizedInput) ||
          name.includes(normalizedInput)
        );
      });
      return { candidates, draft, matches };
    }
  }
  return null;
}
