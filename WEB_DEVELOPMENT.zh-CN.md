# myapp Web 前端开发文档

本文档面向 `frontend/myapp-web` 的实际开发接入。后端完整接口定义以 `apps/myapp` 下的文档为准，本文只约定 Web 端如何认证、如何封装请求、第一阶段页面调用哪些接口，以及哪些边界不能在前端写死。

## 1. 项目定位

`myapp-web` 是桌面浏览器端的管理、查询和报表客户端，不是第一阶段的主要交易录入端。

第一阶段重点：

- 登录和用户态
- 首页经营概览
- 销售单据查询
- 采购单据查询
- 收付款查询
- 库存流水查询
- 财务查询

第一阶段不做：

- 完整替代移动端的销售 / 采购开单流程
- ERPNext 主数据的全量管理后台
- 前端直连云存储
- 继续使用 Ant Design Pro 模板 mock API

## 2. 后端文档来源

后端文档是接口事实来源：

- `apps/myapp/API_GATEWAY.zh-CN.md`
- `apps/myapp/JWT_AUTH.zh-CN.md`
- `apps/myapp/README.zh-CN.md`
- `apps/myapp/HANDOFF.zh-CN.md`
- `apps/myapp/REPORTS_TECH_DESIGN.zh-CN.md`

Web 文档只记录页面接入、字段使用和前端约定，不复制完整后端 API 说明。

## 3. 认证方案

Web 端只使用 JWT Bearer Token，不使用 Frappe 原有 Session / Cookie 登录方式。

当前实现文件：

- `src/services/myapp/auth-storage.ts`
- `src/services/myapp/auth.ts`
- `src/requestErrorConfig.ts`
- `src/app.tsx`
- `src/pages/user/login/index.tsx`

注意：认证接口不要使用 `@umijs/max` 的 `request`。`app.tsx` 会在 Umi 运行时初始化阶段调用当前用户加载逻辑，而 `requestErrorConfig.ts` 又会配置全局 request 拦截器；如果 `auth.ts` 再反向依赖 Umi request，容易形成启动期循环依赖，表现为页面停留在 `正在加载资源`。认证接口当前使用浏览器原生 `fetch`，业务网关接口继续使用统一 API client。

### 3.1 Token API

登录：

```text
POST /api/method/myapp.auth.token_api.login_v1
```

请求：

```json
{
  "username": "user@example.com",
  "password": "password",
  "remember_me": 0
}
```

响应核心字段：

```json
{
  "ok": true,
  "code": "JWT_TOKEN_ISSUED",
  "data": {
    "access_token": "...",
    "refresh_token": "...",
    "token_type": "bearer",
    "expires_in": 3600,
    "refresh_expires_in": 604800,
    "user": {
      "user": "user@example.com",
      "roles": ["System Manager"],
      "full_name": "User Name"
    }
  }
}
```

获取当前用户：

```text
GET/POST /api/method/myapp.auth.token_api.me_v1
```

刷新 Token：

```text
POST /api/method/myapp.auth.token_api.refresh_v1
```

注销：

```text
POST /api/method/myapp.auth.token_api.logout_v1
```

### 3.2 Token 存储

建议第一阶段：

- `access_token` 保存在内存状态和 `localStorage`
- `refresh_token` 保存在 `localStorage`
- 登录成功后立即拉取 `me_v1`
- 主动退出时调用 `logout_v1` 并清空本地 token

后续如引入更严格安全要求，可以再评估改为 BFF 或 httpOnly Cookie，但当前项目阶段先保持前后端分离 JWT 模型。

### 3.3 请求头

所有需认证接口统一携带：

```text
Authorization: Bearer <access_token>
Content-Type: application/json
Accept: application/json
```

Web 端不依赖 `X-Frappe-CSRF-Token`。CSRF 主要用于 Frappe Session/Cookie 模式，JWT Bearer 模式下不作为第一阶段接入前提。

### 3.4 401 处理

推荐流程：

1. 业务请求返回 `401`
2. 如果存在 `refresh_token`，调用 `refresh_v1`
3. 刷新成功后重放原请求一次
4. 刷新失败时清空 token，跳转 `/user/login`

刷新 token 采用轮换策略，刷新成功后必须同时更新本地 `access_token` 和 `refresh_token`。

## 4. HTTP 请求封装

Web 端应新增自己的 API client，不继续使用模板的 `src/services/ant-design-pro/*`。

当前目录：

```text
src/services/myapp/api-client.ts
src/services/myapp/api-base.ts
src/services/myapp/api-utils.ts
src/services/myapp/auth-storage.ts
src/services/myapp/auth.ts
src/services/myapp/gateway.ts
src/services/myapp/master-data.ts
src/services/myapp/media-url.ts
src/services/myapp/purchase.ts
src/services/myapp/reports.ts
src/services/myapp/sales.ts
```

分层约定：

- `api-base.ts` 统一生成 API URL，支持生产环境 `MYAPP_WEB_API_BASE_URL`，默认同域。
- `api-client.ts` 只处理 Frappe 外层 `message`、myapp 网关包络、错误对象和幂等 key。
- `api-utils.ts` 只放通用字段转换，例如数字、文本、分页和列表包络解析。
- `gateway.ts` 保留为低层通用网关函数集合，适合临时接入或尚未沉淀 domain service 的接口。
- `sales.ts`、`purchase.ts`、`reports.ts`、`master-data.ts` 面向 Web 页面返回驼峰字段和页面友好类型。
- 页面组件不直接读取后端蛇形字段，不直接处理 Frappe 外层响应。

Web service 可以参考 `frontend/myapp-mobile/services/*` 的字段映射，但不要机械照搬移动端交易流程。Web 当前定位是管理、查询和报表客户端，优先沉淀单据列表、详情、状态摘要、下游引用、报表、资金流水和主数据查询。移动端中的开单、草稿、扫码、图片上传、快捷回退等操作，只在 Web 真正有页面需求时再接入。

### 4.1 Base URL

开发环境推荐使用 Umi dev proxy：

```text
前端请求: /api/method/...
代理目标: http://localhost:<frappe-port>
```

前端代码中优先使用相对路径 `/api/method/...`，避免把本地端口写死在业务服务里。

如确实需要显式后端地址，可通过环境变量提供，例如：

```text
MYAPP_WEB_API_BASE_URL=http://localhost:8080
```

### 4.2 Frappe 方法调用

所有后端方法走统一入口：

```text
POST /api/method/<method>
```

例如：

```text
POST /api/method/myapp.api.gateway.search_sales_orders_v2
```

`myapp.api.gateway.*` 成功响应的业务包络位于 Frappe `message` 内：

```json
{
  "message": {
    "ok": true,
    "status": "success",
    "code": "SUCCESS",
    "message": "业务提示信息",
    "data": {},
    "meta": {}
  }
}
```

前端服务层应返回 `message.data`，不要把 Frappe 外层结构泄漏到页面组件。

### 4.3 错误格式

网关错误包络：

```json
{
  "ok": false,
  "status": "error",
  "code": "VALIDATION_ERROR",
  "message": "具体错误信息",
  "data": {},
  "meta": {}
}
```

前端统一处理：

- `401`: token 过期或无效，尝试刷新，失败后跳登录
- `403`: 显示权限不足
- `404`: 显示资源不存在
- `409`: 显示业务冲突，例如幂等 key 冲突、库存不足
- `422`: 显示字段或业务校验错误
- `500`: 显示系统错误，保留错误码便于排查

不要继续使用 Ant Design Pro 模板的 `{ success, data, errorCode, errorMessage }` 假设。

当前全局 request 错误处理已做两层兼容：

- 对模板老接口，只在响应明确 `success === false` 时按模板错误处理。
- 对 `myapp.api.gateway.*`，识别 Frappe `message` 内的 `{ ok: false, code, message }` 包络。

业务服务默认通过 `api-client.ts` 设置 `skipErrorHandler: true`，由 `callGatewayMethod` 抛出 `MyAppApiError`，页面可在 `useRequest` 的 `error` 中展示明确业务错误。没有显式跳过全局错误处理的请求，也不会再被模板的 `success` 逻辑误判。

### 4.4 Token 处理

业务请求不需要页面手动携带 token。

当前统一处理层：

- `auth-storage.ts` 负责保存、读取、清空 token，并导出 `getMyAppAuthHeaders()`。
- `requestErrorConfig.ts` 的 request interceptor 会对 `/api/method/myapp.*` 自动注入 `Authorization: Bearer <access_token>`。
- `requestErrorConfig.ts` 的 response interceptor 会对 `myapp.api.gateway.*` 的 `401` 尝试 `refresh_v1`，刷新成功后自动重放原请求一次。
- `auth.ts` 不依赖 Umi request，认证链路内部使用 `fetch`，但同样复用 `getMyAppAuthHeaders()` 给 `me_v1` 和 `logout_v1` 携带 token。

因此页面和 domain service 不应手动拼 `Authorization`。

### 4.5 幂等 key

交易型接口需要幂等保护。虽然 Web 第一期主要是查询页，但如果实现取消、确认、付款等写操作，应遵守：

- 新业务动作生成新的 `Idempotency-Key`
- 网络重试或重复点击复用同一个 key
- 用户修改表单后重新提交必须生成新的 key
- 优先通过 Header 传入：

```text
Idempotency-Key: <uuid>
```

当前已提供 `services/myapp/mutation.ts`，用于后续写操作统一生成/传入 `Idempotency-Key`，并返回本次使用的 key。页面仍负责二次确认、刷新列表和跳转。

### 4.6 权限和页面状态

当前权限点在 `src/access.ts`：

- `canAdmin`
- `canViewSales`
- `canViewPurchase`
- `canViewFinance`
- `canViewInventory`
- `canViewReports`
- `canViewMasterData`

这些权限暂按 ERPNext 常见角色名宽松匹配，例如 `System Manager`、`Sales Manager`、`Sales User`、`Purchase Manager`、`Accounts User` 等。后续应按真实角色清单调整。

通用页面状态组件：

- `src/components/PageState`
- 支持 loading、empty、error 和 retry
- 新页面优先复用它，避免每个页面重复写 `Skeleton / Empty / Alert`

## 5. 媒体 URL 约定

商品图片、文件链接等媒体字段只能当作 opaque URL 使用。

前端规则：

- 后端返回完整 `https://...` 时直接使用
- 后端返回 `/files/...` 或 `/private/files/...` 时拼接 API base URL
- 不在页面中假设存储一定是 ERPNext 本地文件
- 不在页面中直接拼 OSS/S3/MinIO 地址
- 以后接入云存储时，应由后端 `media_service` 保持字段兼容

建议提供 `resolveMediaUrl(value, { version })` 工具，参考 `frontend/myapp-mobile/lib/media-url.ts`。

## 6. 页面与接口映射

### 6.1 登录页

路由：

```text
/user/login
```

接口：

- `myapp.auth.token_api.login_v1`
- `myapp.auth.token_api.me_v1`

页面要求：

- 只保留账号、密码、记住登录
- 不保留模板验证码、第三方登录图标、mock 登录
- 登录成功后写入 token，拉取当前用户，跳转首页

### 6.2 首页经营概览

路由：

```text
/dashboard
```

接口：

- `myapp.api.gateway.get_business_report_overview_v1`
- 后续按需接 `get_sales_report_v1`、`get_purchase_report_v1`

第一阶段字段：

- 销售总览
- 采购总览
- 应收应付摘要
- 待处理单据数量

说明：

- 第一阶段可以先做稳定布局和占位状态
- 图表不阻塞单据查询页开发

### 6.3 销售单据列表

路由：

```text
/sales/orders
/sales/orders/:name
/sales/delivery-notes/:name
/sales/invoices/:name
```

接口：

- `myapp.api.gateway.search_sales_orders_v2`
- `myapp.api.gateway.get_sales_order_detail`
- `myapp.api.gateway.get_delivery_note_detail_v2`
- `myapp.api.gateway.get_sales_invoice_detail_v2`
- `myapp.api.gateway.get_sales_order_status_summary`

当前 Web service：

- `searchSalesOrders`
- `getSalesOrderDetail`
- `getDeliveryNoteDetail`
- `getSalesInvoiceDetail`

列表字段：

- 单据编号
- 客户
- 公司
- 状态
- 金额
- 已收 / 未收
- 交付状态
- 开票状态
- 日期

筛选条件：

- 公司
- 客户
- 日期范围
- 单据状态
- 交付状态
- 开票状态

当前页面：

- `/sales/orders` 已接入列表查询、筛选、分页和汇总。
- `/sales/orders/:name` 已接入订单详情、金额汇总、履约信息、关联发货单 / 发票和商品明细，并支持创建发货单、创建销售发票、按金额和付款方式登记收款、取消销售订单。
- `/sales/delivery-notes/:name` 已接入销售发货单详情、金额 / 数量汇总、收货信息、关联销售订单 / 销售发票和商品明细，并支持取消发货单。
- `/sales/invoices/:name` 已接入销售发票详情、金额 / 收款汇总、收款信息、关联销售订单 / 发货单和商品明细，并支持取消销售发票和取消最近收款。

### 6.4 采购单据列表

路由：

```text
/purchase/orders
/purchase/orders/:name
/purchase/receipts/:name
/purchase/invoices/:name
```

接口：

- `myapp.api.gateway.search_purchase_orders_v2`
- `myapp.api.gateway.get_purchase_order_detail_v2`
- `myapp.api.gateway.get_purchase_receipt_detail_v2`
- `myapp.api.gateway.get_purchase_invoice_detail_v2`
- `myapp.api.gateway.get_purchase_order_status_summary`

当前 Web service：

- `searchPurchaseOrders`
- `getPurchaseOrderDetail`
- `getPurchaseReceiptDetail`
- `getPurchaseInvoiceDetail`

列表字段：

- 单据编号
- 供应商
- 公司
- 状态
- 金额
- 已付 / 未付
- 收货状态
- 开票状态
- 日期

筛选条件：

- 公司
- 供应商
- 日期范围
- 单据状态
- 收货状态
- 开票状态

当前页面：

- `/purchase/orders` 已接入采购订单列表、关键词 / 公司 / 日期 / 状态 / 排序筛选、分页和汇总。
- `/purchase/orders/:name` 已接入采购订单详情、金额汇总、基本信息、供应商信息、关联收货单 / 发票和商品明细，并支持创建收货单、创建采购发票、按金额和付款方式登记付款、取消采购订单。
- `/purchase/receipts/:name` 已接入采购收货单详情、金额 / 数量汇总、收货状态、关联采购订单 / 采购发票和商品明细，并支持取消收货单。
- `/purchase/invoices/:name` 已接入采购发票详情、金额 / 付款汇总、付款信息、关联采购订单 / 收货单和商品明细，并支持取消采购发票和取消最近付款。

### 6.5 经营报表

路由：

```text
/reports
```

接口：

- `myapp.api.gateway.get_business_report_overview_v1`

当前页面：

- 已接入公司和日期筛选。
- 已展示销售额、采购额、净现金流、已收 / 应收、已付 / 应付 KPI。
- 已展示销售客户排行、采购供应商排行、应收 / 应付明细、销售 / 采购商品排行、销售 / 采购 / 资金趋势小表。
- 当前先做查询入口和表格摘要，不引入复杂图表；后续按使用反馈补图表、钻取和导出。

### 6.6 收付款查询

路由：

```text
/payments
```

接口：

- 优先使用后端已有报表接口或后续薄查询接口
- 可参考 `myapp.api.gateway.get_receivable_payable_report_v1`
- 可参考 `myapp.api.gateway.list_cashflow_entries_v1`

当前页面：

- `/payments` 已接入 `list_cashflow_entries_v1`。
- 支持公司、日期和分页查询。
- 展示收付款单号、收款 / 付款 / 转账方向、往来方类型、往来方、付款方式、金额和参考号。
- 当前服务层未暴露方向过滤，页面先不在前端做伪筛选；后续等后端接口支持后补方向、付款方式和往来方筛选。

字段：

- 收付款单号
- 方向：收款 / 付款
- 往来方类型
- 往来方
- 金额
- 公司
- 日期
- 关联单据

### 6.7 库存流水

路由：

```text
/inventory-ledger
```

接口：

- `myapp.api.gateway.list_stock_ledger_entries_v1`

当前页面：

- `/inventory-ledger` 已接入 `list_stock_ledger_entries_v1`。
- 支持公司、商品、仓库、日期、凭证类型、凭证编号筛选和分页。
- 默认查询最近 30 天。
- 变动数量和库存价值变动按正负数做颜色区分。
- `Sales Order`、`Delivery Note`、`Sales Invoice`、`Purchase Order`、`Purchase Receipt`、`Purchase Invoice` 凭证号支持点击跳转。
- 暂未实现详情页的凭证类型保留纯文本。
- 页面不直接调用 `/api/resource/Stock Ledger Entry`，仍统一通过 myapp JWT gateway。

字段：

- 物料
- 仓库
- 实际数量变化
- 凭证类型
- 凭证编号
- 入库单价
- 库存价值变化
- 日期

### 6.8 财务查询

路由：

```text
/finance
```

接口：

- `myapp.api.gateway.get_receivable_payable_report_v1`
- `myapp.api.gateway.get_cashflow_report_v1`
- `myapp.api.gateway.list_cashflow_entries_v1`

当前页面：

- `/finance` 已接入 `get_receivable_payable_report_v1`。
- 支持公司、日期筛选。
- 支持客户应收 / 供应商应付切换。
- 展示总额、未结金额、往来方数量和往来方摘要表。
- 当前接口返回的是聚合摘要，不是发票级明细；发票级钻取后续需要单据查询接口或报表接口支持。

字段：

- 应收 / 应付方向
- 客户 / 供应商
- 发票编号
- 总金额
- 未结金额
- 状态
- 日期

### 6.9 商品与主数据辅助

可供筛选、详情和后续管理页使用：

- `myapp.api.gateway.search_product_v2`
- `myapp.api.gateway.list_products_v2`
- `myapp.api.gateway.get_product_detail_v2`
- `myapp.api.gateway.list_customers_v2`
- `myapp.api.gateway.get_customer_detail_v2`
- `myapp.api.gateway.list_suppliers_v2`
- `myapp.api.gateway.get_supplier_detail_v2`
- `myapp.api.gateway.list_uoms_v2`

第一阶段只作为筛选和详情辅助，不扩展完整主数据后台。

当前页面：

- `/master-data/products` 已接入商品列表，支持关键词、公司、仓库筛选和库存 / 价格摘要展示。
- `/master-data/customers` 已接入客户列表，支持关键词和分页查询。
- `/master-data/suppliers` 已接入供应商列表，支持关键词和分页查询。
- `/master-data/uoms` 已接入计量单位列表，支持关键词和分页查询。
- 当前页面只做查询辅助，不开放新增、编辑和停用操作。

## 7. Ant Design Pro 模板清理要求

开始业务开发前应清理：

- `src/services/ant-design-pro/*` 的模板 API 依赖
- 登录页中的验证码、第三方登录、模板文案
- `src/requestErrorConfig.ts` 中拼接 `?token=123` 的拦截器
- `config/proxy.ts` 中指向 `proapi.azurewebsites.net` 的模板代理
- `/welcome`、`/admin`、`/list` 等模板路由
- mock 数据对真实业务页面的影响

可以保留：

- Ant Design Pro Layout
- 菜单、权限、国际化基础设施
- ProTable / ProForm 等组件能力

当前策略：

- UI 背景、布局、登录页视觉优先保留模板原状，后续按模块逐步调整。
- 功能性接入可以直接替换模板 mock 逻辑，例如账号密码登录已经接入 `login_v1`。
- `/welcome`、`/admin`、`/list` 暂时保留，避免一次性大幅删除模板内容；根路由已调整到 `/dashboard`。

## 8. 权限与角色

第一阶段采用后端权限为准：

- 前端只做菜单和按钮级显隐
- 后端仍负责最终权限校验
- `me_v1` 返回的用户和角色用于前端展示、菜单裁剪和调试信息

建议前端权限分层：

- `canViewDashboard`
- `canViewSales`
- `canViewPurchase`
- `canViewPayments`
- `canViewInventory`
- `canViewFinance`
- `canManageMasterData`

没有明确后端角色映射前，先保持菜单可见，遇到 `403` 显示权限不足。

## 9. 开发验收标准

每个页面完成时至少满足：

- 使用 JWT Bearer Token 访问后端
- 刷新页面后能恢复登录态
- token 失效时能回到登录页
- loading、empty、error 状态完整
- 表格筛选条件能反映到请求参数
- 页面组件不直接解析 Frappe 外层 `message`
- 图片和文件链接通过 `resolveMediaUrl`
- 不依赖 mock API

## 10. 本地运行

安装依赖已完成时：

```bash
cd frontend/myapp-web
npm run dev
```

如果需要固定本地端口，例如继续使用交接约定的 `8001`：

```bash
npm run start:dev -- --port 8001
```

注意：`npm run dev -- --port 8001` 在当前脚本链路下可能不会把端口参数正确传给 `max dev`，Umi 会自动选择其他可用端口，例如 `8003`。排查时以启动日志里的 `App listening at` 为准。

开发前确认：

- Frappe / ERPNext 后端已启动
- `myapp_jwt_secret` 已配置
- 能通过 `login_v1` 获取 JWT
- Umi dev proxy 指向当前后端端口

### 10.1 本地环境变量

本地开发可复制 `.env.example` 为 `.env.local`。`.env.local` 已加入 `.gitignore`，不要提交真实账号密码。

支持变量：

```text
MYAPP_WEB_DEV_LOGIN_USERNAME=
MYAPP_WEB_DEV_LOGIN_PASSWORD=
MYAPP_WEB_PROXY_TARGET=http://localhost:8080
MYAPP_WEB_API_BASE_URL=
```

`MYAPP_WEB_DEV_LOGIN_USERNAME` 和 `MYAPP_WEB_DEV_LOGIN_PASSWORD` 只在本地 dev 模式注入登录页初始值，用于联调提效。

`MYAPP_WEB_API_BASE_URL` 用于生产或非同域部署。默认留空，表示前端请求同域 `/api/method/...`。本地开发仍优先使用 Umi dev proxy 的 `MYAPP_WEB_PROXY_TARGET`。

### 10.2 登录页停在正在加载资源

如果浏览器一直显示 `正在加载资源`：

1. 先确认浏览器访问的端口就是当前 dev server 监听端口。当前推荐固定使用 `http://localhost:8001`，启动命令为 `npm run start:dev -- --port 8001`。
2. 确认 `/user/login`、`/umi.js`、`/scripts/loading.js` 和页面引用的 chunk 都返回 `200`。
3. 检查当前 bundle 中 `auth.ts` 是否仍调用 Umi `request`。认证接口应走 `callAuthMethod` / `fetch`。
4. 检查浏览器是否命中旧 PWA / service worker 缓存。当前 Web 管理端默认关闭 PWA，并会在 localhost 下清理旧 service worker 和 Cache Storage。
5. 如 bundle 仍是旧代码，停止 dev server，删除生成缓存后重启：

```bash
rm -rf src/.umi node_modules/.cache
npm run start:dev -- --port 8001
```

6. 浏览器执行强制刷新，Windows / Linux 通常是 `Ctrl + F5` 或 `Ctrl + Shift + R`；必要时用无痕窗口验证。

本轮遇到的实际现象：

- 用户按交接访问 `http://localhost:8001/user/login`，页面停留在 `正在加载资源`。
- 排查发现当前前端实际监听在 `8003`，`8001` 没有服务，另有 `8000` 返回 `500`。
- 正确启动方式改为 `npm run start:dev -- --port 8001`，并用 curl 验证 `/user/login`、`/sales/orders`、`/umi.js`、`/scripts/loading.js` 均返回 `200`。
- 同时关闭模板默认 PWA，避免旧 service worker/cache 缓存过期 chunk，导致 React 应用没有接管 loading 占位。
- 执行 `npm run build` 会清理并重写 `dist`。如果 dev server 仍在跑，可能出现 `/umi.js` 返回 HTML 的状态；此时应重启 dev server，并以启动日志里的 `App listening at` 端口为准。

常用探测命令：

```bash
ss -ltnp | rg ':800[0-9]'

for route in /user/login /sales/orders /umi.js /scripts/loading.js; do
  printf '%s ' "$route"
  /usr/bin/curl -s -o /dev/null -w '%{http_code} %{content_type}\n' \
    "http://localhost:8001$route" --max-time 10 || true
done
```

如果 `8001` 已被旧进程占用，Umi 会自动选择其他端口，例如 `8003`。这种情况下应访问新端口，并确认 `/umi.js` 的 `content_type` 是 `application/javascript`，不是 `text/html`。

本次已验证的修复点：`auth.ts` 不再 import `@umijs/max`，当前 bundle 中登录、当前用户、刷新 token、登出均调用 `callAuthMethod`。

PWA 说明：

- 当前项目定位是桌面端管理 / 查询后台，不依赖离线打开旧页面。
- 关闭 PWA 不影响登录、JWT、API 请求、销售订单列表和详情等在线功能。
- 关闭 PWA 会失去 service worker 离线缓存和添加到桌面等能力。
- 如果未来生产环境确实需要 PWA，应单独设计缓存版本更新策略，避免用户加载旧 chunk。

### 10.3 测试

当前基础层测试不依赖真实后端，主要通过 mock request / gateway 方法验证前端自己的协议解析和字段映射。

新增覆盖：

- `src/services/myapp/__tests__/api-client.test.ts`
  - Frappe `message` 外层解包
  - myapp gateway `{ ok, data, meta }` 包络解包
  - `{ ok: false, code, message }` 业务错误转换为 `MyAppApiError`
- `src/services/myapp/__tests__/auth-storage.test.ts`
  - token 保存、读取、清空
  - `Authorization: Bearer ...` header 生成
- `src/services/myapp/__tests__/api-utils.test.ts`
  - 数字、文本、分页、列表包络解析
- `src/services/myapp/__tests__/domain-services.test.ts`
  - sales / purchase / reports / master-data 的关键字段映射
- `src/__tests__/access.test.ts`
  - 基础角色权限点
- `src/pages/user/login/login.test.tsx`
  - 登录页账号密码表单渲染
  - JWT 登录参数、用户态更新
  - 后端登录错误提示

运行基础层测试：

```bash
npm run jest -- src/services/myapp/__tests__ src/__tests__/access.test.ts --runInBand
npm run jest -- src/pages/user/login/login.test.tsx --runInBand
```

注意：当前 Jest + Umi 测试配置使用 `@umijs/max/test.js`。如果改回 `@umijs/max/test`，当前依赖组合下会出现配置导入失败。

### 10.4 生产部署

推荐生产形态是前端静态资源和 Frappe API 同域部署：

```text
https://example.com/            -> myapp-web dist/index.html
https://example.com/umi.*.js    -> myapp-web dist 静态资源
https://example.com/api/method/ -> 反向代理到 Frappe
```

同域部署时 `MYAPP_WEB_API_BASE_URL` 保持空值，前端代码请求相对路径 `/api/method/...`。这能避免 CORS、Cookie 域、跨域重定向和浏览器安全策略带来的额外复杂度。

构建命令：

```bash
npm ci
npm run build
```

生产环境变量：

```text
MYAPP_WEB_API_BASE_URL=
```

只有当前端静态站点和 Frappe API 确实分属不同域名时，才设置：

```text
MYAPP_WEB_API_BASE_URL=https://api.example.com
```

跨域部署需要后端正确允许 `Authorization`、`Content-Type`、`Idempotency-Key` 请求头，并允许实际 Web 站点域名。第一阶段优先避免跨域部署。

Nginx 示例：

```nginx
server {
  listen 80;
  server_name example.com;

  root /srv/myapp-web/dist;
  index index.html;

  location = /index.html {
    add_header Cache-Control "no-store";
    try_files $uri =404;
  }

  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
  }

  location / {
    add_header Cache-Control "no-store";
    try_files $uri /index.html;
  }

  location /api/method/ {
    proxy_pass http://frappe-backend:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Caddy 示例：

```caddyfile
example.com {
  root * /srv/myapp-web/dist

  @api path /api/method/*
  reverse_proxy @api frappe-backend:8000

  @assets path /assets/*
  header @assets Cache-Control "public, max-age=31536000, immutable"

  @html path / /index.html
  header @html Cache-Control "no-store"

  try_files {path} /index.html
  file_server
}
```

缓存策略：

- `index.html` 不长缓存，避免用户拿到旧入口文件。
- 带 hash 的 JS/CSS/图片资源可以长缓存。
- 当前 PWA 已关闭，不依赖 service worker 更新机制。
- 如果部署平台有 CDN，确认 CDN 不会把 `/api/method/` 缓存，也不会把 `index.html` 长缓存。

上线后最小验收：

```bash
curl -I https://example.com/user/login
curl -I https://example.com/umi.js
curl -i https://example.com/api/method/myapp.auth.token_api.me_v1
```

验收要点：

- `/user/login` 返回 `200` 和 HTML。
- JS/CSS 静态资源返回 `200`，不是反向代理到后端后的 HTML 错误页。
- `/api/method/...` 能到达 Frappe，未登录返回明确的 `401` 或业务错误，不应由静态站点返回 `index.html`。
- 登录后业务请求自动携带 `Authorization: Bearer <token>`，页面代码不应手动拼 token。

## 11. 当前交接状态

截至当前提交，Web 端基础接入状态：

- 登录页保留 Ant Design Pro 模板视觉，账号密码登录接入 `myapp.auth.token_api.login_v1`。
- 登录成功后保存 JWT token，并更新 `@@initialState.currentUser`。
- `getInitialState` 使用 `me_v1` 恢复当前用户，不再调用模板 `/api/currentUser`。
- 全局 request 拦截器会给 `/api/method/myapp.*` 请求添加 Bearer Token。
- 业务网关请求遇到 `401` 时会尝试 `refresh_v1` 并重放一次请求。
- 新增 `/dashboard`，根路由 `/` 重定向到 `/dashboard`。
- 首页已接入 `myapp.api.gateway.get_business_report_overview_v1` 的第一版 loading / error / empty / KPI 展示。
- 新增 `/sales/orders` 和 `/sales/orders/:name`，接入销售订单查询和详情。
- 新增 `/purchase/orders` 和 `/purchase/orders/:name`，接入采购订单查询和详情。
- 新增 `/sales/delivery-notes/:name`、`/sales/invoices/:name`、`/purchase/receipts/:name`、`/purchase/invoices/:name`，接入下游单据详情和关联跳转。
- 销售 / 采购订单详情已接入创建下游单据、按金额和付款方式登记收付款、取消订单动作。
- 销售 / 采购下游单据详情已接入取消动作，发票详情额外支持取消最近收款 / 付款。
- 新增 `/reports`，接入经营报表入口和多组查询摘要。
- 新增 `/payments`，接入收付款流水分页查询。
- 新增 `/finance`，接入应收 / 应付聚合查询。
- 新增 `/inventory-ledger`，接入真实库存流水查询。
- 新增 `/master-data/products`、`/master-data/customers`、`/master-data/suppliers`、`/master-data/uoms`，接入主数据辅助查询。
- Web API 分层已补齐到查询后台基础面：
  - `reports.ts`：经营概览、销售 / 采购报表、应收应付、资金趋势、资金流水
  - `sales.ts`：销售订单列表 / 详情、发货单详情、销售发票详情、销售下游单据创建、取消和收款取消
  - `purchase.ts`：采购订单列表 / 详情、采购收货单详情、采购发票详情、采购下游单据创建、取消和付款取消
  - `master-data.ts`：商品、客户、供应商、UOM 查询
  - `api-utils.ts`：通用字段和分页解析
- 已补生产 API base 骨架：`MYAPP_WEB_API_BASE_URL` 为空时同域请求，非同域部署时显式指定。
- 已补统一 token header 层：业务请求由 request interceptor 自动携带 Bearer token。
- 已补基础权限点和通用页面状态组件。
- 已补写操作 helper：`services/myapp/mutation.ts` 统一幂等 key 模式。
- 已补基础层单测：api-client、auth-storage、api-utils、access、domain service 映射。
- dev proxy 只代理 `/api/method/` 到 `MYAPP_WEB_PROXY_TARGET`，默认 `http://localhost:8080`。
- 本地开发服务推荐固定用 `npm run start:dev -- --port 8001`。
- 已关闭模板默认 PWA 缓存，避免开发期加载旧资源后卡在启动占位页。

新对话继续开发时，优先处理：

1. 在浏览器确认 `/user/login` 强制刷新后能正常渲染和自动填充。
2. 登录后确认 `/dashboard` 能显示经营概览或明确错误态。
3. 登录后确认 `/sales/orders` 能显示列表数据或明确错误态。
4. 登录后确认 `/purchase/orders` 能显示列表数据或明确错误态。
5. 登录后确认 `/reports` 能显示经营报表或明确错误态。
6. 登录后确认 `/payments` 能显示收付款流水或明确错误态。
7. 登录后确认 `/finance` 能显示应收 / 应付摘要或明确错误态。
8. 登录后确认 `/inventory-ledger` 能显示库存流水或明确错误态。
9. 登录后确认 `/master-data/products`、`/master-data/customers`、`/master-data/suppliers`、`/master-data/uoms` 能显示列表或明确错误态。
10. 继续做真实浏览器联调，验证销售 / 采购创建下游单据、登记收付款、取消订单和取消下游单据后的后端单据状态刷新。
