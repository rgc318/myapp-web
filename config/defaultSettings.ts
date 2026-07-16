import type { ProLayoutProps } from '@ant-design/pro-components';

/**
 * @name
 */
const Settings: ProLayoutProps & {
  pwa?: boolean;
  logo?: string;
} = {
  navTheme: 'light',
  colorPrimary: '#1677ff',
  layout: 'mix',
  contentWidth: 'Fluid',
  fixedHeader: true,
  fixSiderbar: true,
  colorWeak: false,
  title: '进销存管理后台',
  pwa: false,
  logo: '/logo.svg',
  iconfontUrl: '',
  token: {
    pageContainer: {
      paddingBlockPageContainerContent: 20,
      paddingInlinePageContainerContent: 24,
    },
  },
};

export default Settings;
