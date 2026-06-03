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

建议目录：

```text
src/lib/api-client.ts
src/lib/auth-storage.ts
src/lib/media-url.ts
src/services/auth.ts
src/services/gateway.ts
src/services/reports.ts
```

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

### 4.4 幂等 key

交易型接口需要幂等保护。虽然 Web 第一期主要是查询页，但如果实现取消、确认、付款等写操作，应遵守：

- 新业务动作生成新的 `Idempotency-Key`
- 网络重试或重复点击复用同一个 key
- 用户修改表单后重新提交必须生成新的 key
- 优先通过 Header 传入：

```text
Idempotency-Key: <uuid>
```

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
```

接口：

- `myapp.api.gateway.search_sales_orders_v2`
- `myapp.api.gateway.get_sales_order_detail`
- `myapp.api.gateway.get_delivery_note_detail_v2`
- `myapp.api.gateway.get_sales_invoice_detail_v2`
- `myapp.api.gateway.get_sales_order_status_summary`

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

### 6.4 采购单据列表

路由：

```text
/purchase/orders
```

接口：

- `myapp.api.gateway.search_purchase_orders_v2`
- `myapp.api.gateway.get_purchase_order_detail_v2`
- `myapp.api.gateway.get_purchase_receipt_detail_v2`
- `myapp.api.gateway.get_purchase_invoice_detail_v2`
- `myapp.api.gateway.get_purchase_order_status_summary`

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

### 6.5 收付款查询

路由：

```text
/payments
```

接口：

- 优先使用后端已有报表接口或后续薄查询接口
- 可参考 `myapp.api.gateway.get_receivable_payable_report_v1`
- 可参考 `myapp.api.gateway.list_cashflow_entries_v1`

字段：

- 收付款单号
- 方向：收款 / 付款
- 往来方类型
- 往来方
- 金额
- 公司
- 日期
- 关联单据

### 6.6 库存流水

路由：

```text
/inventory-ledger
```

接口：

- 第一期可使用只读查询接口或后续薄聚合接口
- 如果后端没有满足 Web 查询的接口，应新增薄查询接口，不在前端拼复杂 ERPNext 查询规则

字段：

- 物料
- 仓库
- 实际数量变化
- 凭证类型
- 凭证编号
- 入库单价
- 库存价值变化
- 日期

### 6.7 财务查询

路由：

```text
/finance
```

接口：

- `myapp.api.gateway.get_receivable_payable_report_v1`
- `myapp.api.gateway.get_cashflow_report_v1`
- `myapp.api.gateway.list_cashflow_entries_v1`

字段：

- 应收 / 应付方向
- 客户 / 供应商
- 发票编号
- 总金额
- 未结金额
- 状态
- 日期

### 6.8 商品与主数据辅助

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

开发前确认：

- Frappe / ERPNext 后端已启动
- `myapp_jwt_secret` 已配置
- 能通过 `login_v1` 获取 JWT
- Umi dev proxy 指向当前后端端口

