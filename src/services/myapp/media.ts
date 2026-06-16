import { compactPayload, readObject } from './api-utils';
import { resolveMediaUrl } from './media-url';
import { runGatewayMutation } from './mutation';

export type UploadedItemImage = {
  attachedToDoctype: string | null;
  attachedToName: string | null;
  fileId: string | null;
  fileName: string | null;
  fileUrl: string;
  previewUrl: string;
  isPrivate: boolean;
  storageProvider: string | null;
};

export type DeletedItemImage = {
  deleted: boolean;
  itemCode: string;
  previousFileUrl: string | null;
  reason: string | null;
};

export type UploadItemImagePayload = {
  contentType?: string | null;
  fileContentBase64: string;
  filename: string;
  isPrivate?: boolean;
  itemCode?: string | null;
};

function mapUploadedItemImage(value: unknown): UploadedItemImage {
  const data = readObject(value);
  const fileUrl = typeof data.file_url === 'string' ? data.file_url : '';
  return {
    attachedToDoctype:
      typeof data.attached_to_doctype === 'string'
        ? data.attached_to_doctype
        : null,
    attachedToName:
      typeof data.attached_to_name === 'string' ? data.attached_to_name : null,
    fileId: typeof data.file_id === 'string' ? data.file_id : null,
    fileName: typeof data.file_name === 'string' ? data.file_name : null,
    fileUrl,
    previewUrl: resolveMediaUrl(fileUrl),
    isPrivate: Boolean(data.is_private),
    storageProvider:
      typeof data.storage_provider === 'string' ? data.storage_provider : null,
  };
}

function mapDeletedItemImage(value: unknown, itemCode: string): DeletedItemImage {
  const data = readObject(value);
  return {
    deleted: Boolean(data.deleted),
    itemCode: typeof data.item_code === 'string' ? data.item_code : itemCode,
    previousFileUrl:
      typeof data.previous_file_url === 'string'
        ? data.previous_file_url
        : null,
    reason: typeof data.reason === 'string' ? data.reason : null,
  };
}

export async function uploadItemImage(payload: UploadItemImagePayload) {
  const result = await runGatewayMutation<UploadedItemImage>(
    'upload_item_image',
    {
      payload: compactPayload({
        content_type: payload.contentType,
        file_content_base64: payload.fileContentBase64,
        filename: payload.filename,
        is_private: payload.isPrivate ? 1 : 0,
        item_code: payload.itemCode,
      }),
      successMessage: '商品图片已上传',
      transform: mapUploadedItemImage,
    },
  );
  return result.data;
}

export async function replaceItemImage(
  payload: UploadItemImagePayload & { itemCode: string },
) {
  const result = await runGatewayMutation<UploadedItemImage>(
    'replace_item_image',
    {
      payload: compactPayload({
        content_type: payload.contentType,
        file_content_base64: payload.fileContentBase64,
        filename: payload.filename,
        is_private: payload.isPrivate ? 1 : 0,
        item_code: payload.itemCode,
      }),
      successMessage: '商品图片已替换',
      transform: mapUploadedItemImage,
    },
  );
  return result.data;
}

export async function deleteItemImage(itemCode: string) {
  const result = await runGatewayMutation<DeletedItemImage>(
    'delete_item_image',
    {
      payload: { item_code: itemCode },
      successMessage: '商品图片已删除',
      transform: (raw) => mapDeletedItemImage(raw, itemCode),
    },
  );
  return result.data;
}
