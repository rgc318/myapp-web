import { Steps } from 'antd';
import dayjs from 'dayjs';
import React, { type ComponentProps } from 'react';
import type { AiDraft } from '@/services/myapp/ai';

export function AiDraftProgress({
  conflict,
  dirty,
  draft,
  executing,
}: {
  conflict: boolean;
  dirty: boolean;
  draft: AiDraft;
  executing: boolean;
}) {
  const executed = draft.status === 'executed' && Boolean(draft.execution);
  const discarded = draft.status === 'discarded';
  const handedOff = draft.status === 'handed_off';
  const modifiedAt = draft.modified
    ? dayjs(draft.modified).isValid()
      ? dayjs(draft.modified).format('YYYY-MM-DD HH:mm:ss')
      : draft.modified
    : null;
  const items: ComponentProps<typeof Steps>['items'] = [
    {
      content: dirty ? '有未保存修改' : `版本 ${draft.version} 已保存`,
      status: dirty ? 'process' : 'finish',
      title: '草稿保存',
    },
    {
      content: conflict
        ? '先处理版本冲突'
        : dirty
          ? '保存后重新校验'
          : draft.validation.readyForHandoff
            ? `后端校验通过${modifiedAt ? ` · 最近校验 ${modifiedAt}` : ''}`
            : `${draft.validation.errors.length} 项需要处理`,
      status: conflict
        ? 'error'
        : dirty
          ? 'wait'
          : draft.validation.readyForHandoff
            ? 'finish'
            : 'error',
      title: '业务校验',
    },
    {
      content: executed
        ? '正式业务操作完成'
        : executing
          ? '正在执行，禁止重复提交'
          : handedOff
            ? '已进入完整业务编辑器'
            : discarded
              ? '草稿已放弃，不能执行'
              : '等待用户确认',
      status:
        executed || handedOff
          ? 'finish'
          : discarded
            ? 'error'
            : executing
              ? 'process'
              : 'wait',
      title: '正式执行',
    },
    {
      content: executed
        ? `${draft.execution?.targetDoctype ?? '业务对象'} ${draft.execution?.targetName ?? ''}`.trim()
        : handedOff
          ? '在完整业务页面继续处理'
          : discarded
            ? '已放弃的草稿不会生成回执'
            : '执行后生成可追溯回执',
      status: executed ? 'finish' : 'wait',
      title: '业务回执',
    },
  ];

  return <Steps items={items} responsive={false} size="small" />;
}
