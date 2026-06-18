import { GlobalOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { getAllLocales, getLocale, setLocale } from '@umijs/max';
import { Dropdown } from 'antd';
import React, { useState } from 'react';

export type SiderTheme = 'light' | 'dark';

const localeLabels: Record<string, { icon: string; label: string }> = {
  'bn-BD': { icon: '🇧🇩', label: 'বাংলা' },
  'en-US': { icon: '🇺🇸', label: 'English' },
  'fa-IR': { icon: '🇮🇷', label: 'فارسی' },
  'id-ID': { icon: '🇮🇩', label: 'Bahasa Indonesia' },
  'ja-JP': { icon: '🇯🇵', label: '日本語' },
  'pt-BR': { icon: '🇧🇷', label: 'Português' },
  'zh-CN': { icon: '🇨🇳', label: '简体中文' },
  'zh-TW': { icon: '🇭🇰', label: '繁體中文' },
};

export const SelectLang: React.FC = () => {
  const [selectedLang, setSelectedLang] = useState(() => getLocale());
  const locales = getAllLocales();

  return (
    <Dropdown
      menu={{
        items: locales.map((locale) => {
          const config = localeLabels[locale] ?? {
            icon: '🌐',
            label: locale,
          };

          return {
            key: locale,
            label: (
              <span>
                <span style={{ marginRight: 8 }}>{config.icon}</span>
                {config.label}
              </span>
            ),
          };
        }),
        onClick: ({ key }) => {
          setLocale(key, true);
          setSelectedLang(key);
        },
        selectedKeys: [selectedLang],
      }}
      placement="bottomRight"
    >
      <span
        style={{
          alignItems: 'center',
          cursor: 'pointer',
          display: 'inline-flex',
          fontSize: 18,
          justifyContent: 'center',
          padding: 4,
        }}
      >
        <GlobalOutlined />
      </span>
    </Dropdown>
  );
};

export const Question: React.FC = () => {
  return (
    <a
      href="https://pro.ant.design/docs/getting-started"
      target="_blank"
      rel="noreferrer"
      style={{
        color: 'inherit',
        display: 'inline-flex',
        fontSize: '18px',
        padding: 4,
      }}
    >
      <QuestionCircleOutlined />
    </a>
  );
};
