/**
 * @name umi 的路由配置
 * @description 只支持 path,component,routes,redirect,wrappers,name,icon 的配置
 * @param path  path 只支持两种占位符配置，第一种是动态参数 :id 的形式，第二种是 * 通配符，通配符只能出现路由字符串的最后。
 * @param component 配置 location 和 path 匹配后用于渲染的 React 组件路径。可以是绝对路径，也可以是相对路径，如果是相对路径，会从 src/pages 开始找起。
 * @param routes 配置子路由，通常在需要为多个路径增加 layout 组件时使用。
 * @param redirect 配置路由跳转
 * @param wrappers 配置路由组件的包装组件，通过包装组件可以为当前的路由组件组合进更多的功能。 比如，可以用于路由级别的权限校验
 * @param name 配置路由的标题，默认读取国际化文件 menu.ts 中 menu.xxxx 的值，如配置 name 为 login，则读取 menu.ts 中 menu.login 的取值作为标题
 * @param icon 配置路由的图标，取值参考 https://ant.design/components/icon-cn， 注意去除风格后缀和大小写，如想要配置图标为 <StepBackwardOutlined /> 则取值应为 stepBackward 或 StepBackward，如想要配置图标为 <UserOutlined /> 则取值应为 user 或者 User
 * @doc https://umijs.org/docs/guides/routes
 */
export default [
  {
    path: '/user',
    layout: false,
    routes: [
      {
        name: 'login',
        path: '/user/login',
        component: './user/login',
      },
    ],
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    icon: 'dashboard',
    component: './Dashboard',
  },
  {
    path: '/pending-confirmations',
    name: 'pending-confirmations',
    icon: 'checkCircle',
    access: 'canViewPendingConfirmations',
    component: './PendingConfirmations',
  },
  {
    path: '/sales',
    name: 'sales',
    icon: 'shoppingCart',
    access: 'canViewSales',
    routes: [
      {
        path: '/sales',
        redirect: '/sales/orders',
      },
      {
        path: '/sales/orders',
        name: 'orders',
        component: './Sales/Orders',
      },
      {
        path: '/sales/orders/new',
        name: 'order-new',
        component: './Sales/Orders/New',
        hideInMenu: true,
      },
      {
        path: '/sales/orders/:name/edit',
        name: 'order-edit',
        component: './Sales/Orders/Edit',
        hideInMenu: true,
      },
      {
        path: '/sales/orders/:name',
        name: 'order-detail',
        component: './Sales/Orders/Detail',
        hideInMenu: true,
      },
      {
        path: '/sales/delivery-notes',
        name: 'delivery-notes',
        component: './Sales/DeliveryNotes',
      },
      {
        path: '/sales/delivery-notes/:name',
        name: 'delivery-note-detail',
        component: './Sales/DeliveryNotes/Detail',
        hideInMenu: true,
      },
      {
        path: '/sales/invoices',
        name: 'invoices',
        component: './Sales/Invoices',
      },
      {
        path: '/sales/invoices/:name',
        name: 'invoice-detail',
        component: './Sales/Invoices/Detail',
        hideInMenu: true,
      },
      {
        path: '/sales/returns/new',
        name: 'return-new',
        component: './Sales/Returns/New',
        hideInMenu: true,
      },
      {
        path: '/sales/refunds/review',
        name: 'refund-review',
        component: './Sales/Refunds/Review',
        hideInMenu: true,
      },
    ],
  },
  {
    path: '/purchase',
    name: 'purchase',
    icon: 'shopping',
    access: 'canViewPurchase',
    routes: [
      {
        path: '/purchase',
        redirect: '/purchase/orders',
      },
      {
        path: '/purchase/orders',
        name: 'orders',
        component: './Purchase/Orders',
      },
      {
        path: '/purchase/orders/new',
        name: 'order-new',
        component: './Purchase/Orders/New',
        hideInMenu: true,
      },
      {
        path: '/purchase/orders/:name/edit',
        name: 'order-edit',
        component: './Purchase/Orders/Edit',
        hideInMenu: true,
      },
      {
        path: '/purchase/orders/:name',
        name: 'order-detail',
        component: './Purchase/Orders/Detail',
        hideInMenu: true,
      },
      {
        path: '/purchase/receipts',
        name: 'receipts',
        component: './Purchase/Receipts',
      },
      {
        path: '/purchase/receipts/:name',
        name: 'receipt-detail',
        component: './Purchase/Receipts/Detail',
        hideInMenu: true,
      },
      {
        path: '/purchase/invoices',
        name: 'invoices',
        component: './Purchase/Invoices',
      },
      {
        path: '/purchase/invoices/:name',
        name: 'invoice-detail',
        component: './Purchase/Invoices/Detail',
        hideInMenu: true,
      },
      {
        path: '/purchase/returns/new',
        name: 'return-new',
        component: './Purchase/Returns/New',
        hideInMenu: true,
      },
      {
        path: '/purchase/refunds/review',
        name: 'refund-review',
        component: './Purchase/Refunds/Review',
        hideInMenu: true,
      },
    ],
  },
  {
    path: '/reports',
    name: 'reports',
    icon: 'barChart',
    access: 'canViewReports',
    component: './Reports',
  },
  {
    path: '/payments',
    name: 'payments',
    icon: 'transaction',
    access: 'canViewFinance',
    component: './Payments',
  },
  {
    path: '/payments/:name',
    name: 'payment-detail',
    access: 'canViewFinance',
    component: './Payments/Detail',
    hideInMenu: true,
  },
  {
    path: '/printing/preview',
    name: 'printing-preview',
    access: 'canViewPrinting',
    component: './Printing/Preview',
    hideInMenu: true,
  },
  {
    path: '/printing/settings',
    name: 'printing-settings',
    icon: 'printer',
    access: 'canAdmin',
    component: './Printing/Settings',
  },
  {
    path: '/finance',
    name: 'finance',
    icon: 'accountBook',
    access: 'canViewFinance',
    component: './Finance',
  },
  {
    path: '/inventory',
    name: 'inventory',
    icon: 'database',
    access: 'canViewInventory',
    routes: [
      {
        path: '/inventory',
        redirect: '/inventory/stock',
      },
      {
        path: '/inventory/stock',
        name: 'stock',
        component: './Inventory/Stock',
      },
      {
        path: '/inventory/alerts',
        name: 'alerts',
        component: './Inventory/Alerts',
      },
      {
        path: '/inventory/adjustments',
        name: 'adjustments',
        component: './Inventory/Adjustments',
      },
      {
        path: '/inventory/counts',
        name: 'counts',
        component: './Inventory/Counts',
      },
      {
        path: '/inventory/transfers',
        name: 'transfers',
        component: './Inventory/Transfers',
      },
      {
        path: '/inventory/stock/:itemCode',
        name: 'stock-detail',
        component: './Inventory/Stock/Detail',
        hideInMenu: true,
      },
      {
        path: '/inventory/ledger',
        name: 'ledger',
        component: './InventoryLedger',
      },
    ],
  },
  {
    path: '/inventory-ledger',
    redirect: '/inventory/ledger',
  },
  {
    path: '/master-data',
    name: 'master-data',
    icon: 'appstore',
    access: 'canViewMasterData',
    routes: [
      {
        path: '/master-data',
        redirect: '/master-data/products',
      },
      {
        path: '/master-data/products',
        name: 'products',
        component: './MasterData/Products',
      },
      {
        path: '/master-data/products/:itemCode',
        component: './MasterData/Products/Detail',
      },
      {
        path: '/master-data/customers',
        name: 'customers',
        component: './MasterData/Customers',
      },
      {
        path: '/master-data/suppliers',
        name: 'suppliers',
        component: './MasterData/Suppliers',
      },
      {
        path: '/master-data/uoms',
        name: 'uoms',
        component: './MasterData/Uoms',
      },
      {
        path: '/master-data/warehouses',
        name: 'warehouses',
        component: './MasterData/Warehouses',
      },
    ],
  },
  {
    path: '/welcome',
    name: 'welcome',
    icon: 'smile',
    component: './Welcome',
    hideInMenu: true,
  },
  {
    path: '/admin',
    name: 'admin',
    icon: 'crown',
    access: 'canAdmin',
    hideInMenu: true,
    routes: [
      {
        path: '/admin',
        redirect: '/admin/sub-page',
      },
      {
        path: '/admin/sub-page',
        name: 'sub-page',
        component: './Admin',
      },
    ],
  },
  {
    name: 'list.table-list',
    icon: 'table',
    path: '/list',
    component: './table-list',
    hideInMenu: true,
  },
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    component: '404',
    layout: false,
    path: './*',
  },
];
