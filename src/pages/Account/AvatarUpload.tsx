import { UploadOutlined, UserOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { Avatar, Button, Space, Typography, Upload } from 'antd';
import { useState } from 'react';
import { notifyMutationError } from '@/services/myapp/mutation';
import { uploadCurrentUserAvatar } from '@/services/myapp/users';

const { Text } = Typography;
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取头像文件失败'));
    reader.onload = () => {
      const value = String(reader.result ?? '');
      resolve(value.includes(',') ? (value.split(',').pop() ?? '') : value);
    };
    reader.readAsDataURL(file);
  });
}

export function AvatarUpload({
  onChange,
  value,
}: {
  onChange?: (value: string) => void;
  value?: string | null;
}) {
  const [uploading, setUploading] = useState(false);
  const uploadProps: UploadProps = {
    accept: 'image/jpeg,image/png,image/webp,image/gif',
    beforeUpload: async (file) => {
      if (!file.type.startsWith('image/')) {
        notifyMutationError(new Error('请选择图片文件'));
        return Upload.LIST_IGNORE;
      }
      if (file.size > MAX_AVATAR_SIZE) {
        notifyMutationError(new Error('头像图片请控制在 5MB 以内'));
        return Upload.LIST_IGNORE;
      }
      setUploading(true);
      try {
        const fileContentBase64 = await fileToBase64(file);
        const { data } = await uploadCurrentUserAvatar({
          contentType: file.type,
          fileContentBase64,
          filename: file.name,
        });
        onChange?.(data.fileUrl);
      } catch (error) {
        notifyMutationError(error);
      } finally {
        setUploading(false);
      }
      return Upload.LIST_IGNORE;
    },
    maxCount: 1,
    showUploadList: false,
  };

  return (
    <Space orientation="vertical" align="center" size="middle">
      <Avatar size={112} src={value || undefined} icon={<UserOutlined />} />
      <Upload {...uploadProps}>
        <Button icon={<UploadOutlined />} loading={uploading}>
          上传新头像
        </Button>
      </Upload>
      <Text type="secondary">支持 JPG、PNG、WebP、GIF，最大 5MB</Text>
    </Space>
  );
}
