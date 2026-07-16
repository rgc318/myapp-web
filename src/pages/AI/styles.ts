import { createStyles } from 'antd-style';

export const useAiWorkspaceStyles = createStyles(({ css, token }) => ({
  composer: css`
    border-top: 1px solid ${token.colorBorderSecondary};
    padding: ${token.paddingMD}px ${token.paddingLG}px;
  `,
  contextBar: css`
    align-items: center;
    border-bottom: 1px solid ${token.colorBorderSecondary};
    display: flex;
    flex-wrap: wrap;
    gap: ${token.marginSM}px;
    justify-content: space-between;
    padding: ${token.paddingSM}px ${token.paddingLG}px;
  `,
  emptyState: css`
    align-items: center;
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    margin: 0 auto;
    max-width: 760px;
    padding: ${token.paddingXL}px;
    width: 100%;
  `,
  inspector: css`
    background: ${token.colorBgContainer};
    border-left: 1px solid ${token.colorBorderSecondary};
    display: flex;
    flex: 0 0 300px;
    flex-direction: column;
    overflow-y: auto;
    padding: ${token.paddingMD}px;

    @media (max-width: ${token.screenXL}px) {
      display: none;
    }
  `,
  main: css`
    background: ${token.colorBgContainer};
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  `,
  messageBody: css`
    display: flex;
    flex-direction: column;
    gap: ${token.marginSM}px;
    max-width: 100%;
    min-width: 0;
  `,
  messages: css`
    display: flex;
    flex: 1;
    justify-content: center;
    overflow-y: auto;
    padding: ${token.paddingLG}px;

    > div {
      max-width: 960px;
      width: 100%;
    }
  `,
  page: css`
    .ant-pro-page-container-children-container {
      padding-block: 0;
    }
  `,
  promptGrid: css`
    margin-top: ${token.marginXL}px;
    width: 100%;
  `,
  sidebar: css`
    background: ${token.colorBgContainer};
    border-right: 1px solid ${token.colorBorderSecondary};
    display: flex;
    flex: 0 0 280px;
    flex-direction: column;
    overflow: hidden;

    @media (max-width: ${token.screenLG}px) {
      flex-basis: 228px;
    }

    @media (max-width: ${token.screenMD}px) {
      display: none;
    }
  `,
  sidebarBody: css`
    flex: 1;
    overflow-y: auto;
    padding: ${token.paddingSM}px;
  `,
  sidebarHeader: css`
    border-bottom: 1px solid ${token.colorBorderSecondary};
    padding: ${token.paddingMD}px;
  `,
  sourceCards: css`
    display: grid;
    gap: ${token.marginSM}px;
  `,
  workspace: css`
    background: ${token.colorBgContainer};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    box-shadow: ${token.boxShadowTertiary};
    display: flex;
    height: calc(100vh - 178px);
    min-height: 620px;
    overflow: hidden;
  `,
}));
