import { MyAppApiError } from '@/services/myapp/api-client';

export function isDocumentVersionConflict(error: unknown) {
  return (
    error instanceof MyAppApiError &&
    (error.code === 'DOCUMENT_VERSION_CONFLICT' ||
      (typeof error.data === 'object' &&
        error.data !== null &&
        'conflict_type' in error.data &&
        error.data.conflict_type === 'document_modified'))
  );
}
