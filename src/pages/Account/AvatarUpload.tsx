import { UploadOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Button, Space, Typography } from 'antd';
import { useState } from 'react';
import { ImageEditorUpload } from '@/components/ImageEditorUpload';
import { resolveMediaUrl } from '@/services/myapp/media-url';
import { uploadCurrentUserAvatar } from '@/services/myapp/users';
import {
  AVATAR_IMAGE_EDIT_PROFILE,
  fileToBase64,
  type PreparedImage,
} from '@/utils/image-processing';

const { Text } = Typography;

export function AvatarUpload({
  onChange,
  value,
}: {
  onChange?: (value: string) => void;
  value?: string | null;
}) {
  const [uploading, setUploading] = useState(false);
  const previewUrl = resolveMediaUrl(value);
  const handlePreparedImage = async (prepared: PreparedImage) => {
    setUploading(true);
    try {
      const fileContentBase64 = await fileToBase64(prepared.file);
      const { data } = await uploadCurrentUserAvatar({
        contentType: prepared.mimeType,
        fileContentBase64,
        filename: prepared.file.name,
      });
      onChange?.(data.fileUrl);
    } catch (error) {
      throw error instanceof Error ? error : new Error('头像上传失败');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Space orientation="vertical" align="center" size="middle">
      <Avatar
        size={112}
        src={previewUrl || undefined}
        icon={<UserOutlined />}
      />
      <ImageEditorUpload
        disabled={uploading}
        onPrepared={handlePreparedImage}
        profile={AVATAR_IMAGE_EDIT_PROFILE}
        sourceUrl={previewUrl}
      >
        <Button icon={<UploadOutlined />} loading={uploading}>
          上传新头像
        </Button>
      </ImageEditorUpload>
      <Text type="secondary">JPG / PNG / WebP，自动裁剪为 512 × 512 WebP</Text>
    </Space>
  );
}
