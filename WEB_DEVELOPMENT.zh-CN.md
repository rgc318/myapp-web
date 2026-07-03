# myapp Web 前端开发文档

本文档面向 `frontend/myapp-web` 的实际开发接入。后端完整接口定义以 `apps/myapp` 下的文档为准，本文只约定 Web 端如何认证、如何封装请求、第一阶段页面调用哪些接口，以及哪些边界不能在前端写死。

## 1. 项目定位

`myapp-web` 是桌面浏览器端的管理、查询、报表和运营辅助客户端。第一阶段先完成查询和详情骨架；当前已经开始按 mobile 成熟流程补 Web 端交易主流程，但交互形态应按桌面端表格和表单设计，不机械复制移动端底部弹层。

第一阶段重点：

- 登录和用户态
- 首页经营概览
- 销售单据查询
- 采购单据查询
- 收付款查询
- 库存流水查询
- 财务查询

第一阶段暂不做：

- ERPNext 主数据的全量管理后台
- 前端直连云存储
- 继续使用 Ant Design Pro 模板 mock API

### 1.1 UI 与布局开发规范

本项目基于 Ant Design Pro。页面结构、布局密度、卡片组织、图表样式、表格操作区、日期筛选区和状态呈现应优先沿用 Ant Design Pro 官方实现，不优先自行发明新的视觉结构。

本地官方参考项目：

```text
/home/rgc318/python-project/ant-design-pro
```

重点参考目录：

```text
/home/rgc318/python-project/ant-design-pro/src/pages/dashboard/analysis
/home/rgc318/python-project/ant-design-pro/src/pages/dashboard/workplace
/home/rgc318/python-project/ant-design-pro/src/components
```

开发规则：

- 新增或优化页面前，先检查官方 Ant Design Pro 项目是否已有相近页面、组件或布局。
- Dashboard、报表、统计、分析类页面优先参考官方 `dashboard/analysis`，使用官方同类组件组合，例如 `Card`、`Row`、`Col`、`Tabs`、`StatisticCard`、`Table`、`Segmented`、`RangePicker` 和 `@ant-design/plots`。
- 表单、列表、详情、结果页、异常页等页面优先参考官方对应模块，不从零手写一套布局。
- 可以替换官方 mock 数据和业务文案，但应尽量保留官方的信息架构、间距、响应式栅格和组件用法。
- 不要为了短期实现方便大量使用自定义 SVG、手写图表、任意颜色块和页面级样式；只有官方组件无法覆盖明确业务需求时，才新增局部样式。
- 页面视觉优化应先“套官方结构 + 接真实业务数据”，再按业务反馈小步调整。
- 业务接口、字段映射、权限和错误处理必须使用本项目已有 service/domain 层，不能照搬官方 mock API。

当前首页 `/dashboard` 已按官方 `dashboard/analysis` 的结构改造：顶部 KPI 卡片、中部趋势图与排行、底部关注事项与占比图，并使用 `@ant-design/plots` 接真实报表和库存接口数据。

### 1.2 控制台告警与本地资源排障规范

前端联调时应区分“会影响功能的资源错误”和“短期兼容告警”。

必须处理：

- `Unexpected token '<'` 出现在 `.js` chunk：说明浏览器把 HTML 当 JavaScript 执行。通常是 dev server 重启、重新编译或浏览器缓存导致旧 chunk 文件名已失效，服务端 fallback 返回了 `index.html`。处理方式是强刷页面，必要时清理 `src/.umi`、`src/.umi-production`、`node_modules/.cache`、`dist` 后只启动一个 dev server。
- `Refused to apply style ... MIME type ('text/html')`：说明 CSS 请求返回了 HTML。当前 Umi dev HTML 会引用 `/umi.css`，项目已在 `public/umi.css` 提供空 CSS 兜底；不要删除该文件，除非确认 Umi dev HTML 不再引用它。
- 图表运行时报 `ownerDocument`、`destroyed` 等 G2/G2Plot 内部错误：优先检查是否引入了非官方或不兼容的图表配置。Dashboard 饼图应保持官方 `Pie` + `label.position = 'spider'` 的配置方式，不要加入会破坏 legend/label 渲染生命周期的自定义 legend 配置。

建议处理：

- `[React Intl] Missing message: "menu.xxx"`：不会阻止渲染，但应补齐 `src/locales/zh-CN/menu.ts` 和 `src/locales/en-US/menu.ts`，避免菜单和页面标题 fallback。
- Ant Design / ProComponents `deprecated` 告警：短期不影响功能，但新开发代码应使用新版 API。例如 `Dropdown` 使用 `classNames.root`，`Space` 使用 `orientation`，`Statistic` 样式使用 `styles.content`，不要继续新增旧属性。
- 当前已完成第一批控制台噪音清理：库存转仓菜单国际化已补齐，`Select onDropdownVisibleChange` 已替换为 `onOpenChange`，AntD `Space direction` 已统一迁移为 `orientation`，销售联调涉及页面的 `Alert message` 已迁移为 `title`。

开发环境建议：

- 固定端口优先使用 `npm run start:dev -- --port 8001`。
- Frappe 文件服务返回的 `/files/...` 需要通过 dev proxy 转发到后端；`config/proxy.ts` 已为 `dev/test/pre` 配置 `/files/`。修改 proxy 后必须重启 dev server。
- 不要同时启动多个 Umi dev server 指向同一个工作区；并发 dev/build 容易造成 `.umi`、chunk manifest 和浏览器缓存不一致。
- 如果出现旧 chunk 或 `.umi/exports` 解析问题，先停止多余 dev server，再执行：

```bash
rm -rf src/.umi src/.umi-production node_modules/.cache dist
npm run start:dev -- --port 8001
```

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
- 页面通过 `@umijs/max` 的 `useRequest` 直接调用上述领域 service 时，必须设置 `formatResult: (result) => result`；完整约定见 `REQUEST_RESULT_CONTRACT.zh-CN.md`。

Web service 可以参考 `frontend/myapp-mobile/services/*` 的字段映射，但不要机械照搬移动端交易流程。当前 Web 已开始接入销售开单主流程；移动端仍是业务规则的重要参考来源，尤其是商品选择、批发 / 零售默认单位、计量单位换算、价格摘要、快捷下单、撤销和退货等流程。Web 端复用其字段模型和后端 v2 接口，但页面交互应保持桌面端可扫描、可批量编辑的表格形态。

### 4.1 商品主数据接入约定

Web 商品模块当前按企业级主数据维护界面建设，不只复刻移动端选品能力。

当前页面能力：

- `/master-data/products`：商品列表、创建、编辑、启停、批量启停、批量修改分类 / 品牌、CSV 批量导入、当前筛选结果导出
- `/master-data/products/:itemCode`：商品详情、资料质量、库存、单位、价格、条码列表、最近库存流水
- 列表筛选支持关键词、公司、仓库、状态、商品分类、品牌、仅有库存
- 商品分类、品牌、仓库、公司、单位均使用远程 Link 选择，避免手填主数据名称
- 列表展示分类、品牌、主条码、多条码数量、库存、标准价格、批发价、零售价、采购价
- 列表批量能力支持选中多商品后批量启用 / 停用、批量修改分类 / 品牌，并支持按当前筛选条件导出 CSV；CSV 同时导出主条码和完整条码列表
- 列表导入能力支持下载 CSV 模板、上传后预览校验，并按行执行 `create` / `update`；当前为前端顺序调用既有商品创建 / 更新接口，适合小批量维护
- 商品编辑支持图片、分类、品牌、条码、库存单位、批发 / 零售默认单位、标准售价、批发价、零售价、标准采购价、估值价
- 商品详情页支持多条码管理，包括新增条码、删除条码和设置主条码；条码列表使用 ProTable 展示主条码状态和顺序，基础编辑表单中的 `barcode` 仍只作为主条码兼容字段

字段与接口约定：

- 列表使用 `listProducts`，底层调用 `list_products_v2`
- 选品弹窗使用 `searchProducts`，底层调用 `search_product_v2`
- 详情使用 `getProductDetail`，底层调用 `get_product_detail_v2`
- 创建 / 更新商品通过 `createProduct` / `updateProduct` 写入后端 `create_product_v2` / `update_product_v2`
- 批量启停通过 `bulkSetProductsDisabled` 顺序复用 `disable_product_v2`
- 批量修改分类 / 品牌通过 `bulkUpdateProducts` 顺序复用 `update_product_v2` 的局部更新能力，未传字段不得被前端补空导致误清空
- 批量导入通过页面侧 CSV 解析和 ProTable 预览完成；`导入动作=create` 调用 `createProduct`，`导入动作=update` 按商品编码调用 `updateProduct`
- 当前商品导出为前端 CSV 导出，按当前筛选条件读取 `listProducts`，数据量上限由页面侧控制；后续大数据量导出再补后端异步导出接口
- 多条码管理通过 `addProductBarcode`、`setPrimaryProductBarcode`、`deleteProductBarcode` 分别调用 `add_product_barcode_v2`、`set_primary_product_barcode_v2`、`delete_product_barcode_v2`
- 商品详情返回的 `barcode` 是主条码兼容字段，`barcodes[]` 是完整条码列表；页面应优先用 `barcodes[]` 渲染条码管理区
- 多价格层级通过 `selling_prices` / `buying_prices` 写入，不在页面中硬读 ERPNext 原生 `Item Price`
- 页面组件只使用 `master-data.ts` 返回的驼峰字段，例如 `priceSummary.wholesaleRate`、`priceSummary.retailRate`、`priceSummary.standardBuyingRate`
- 前端不直接拼后端蛇形字段，也不在页面层维护价格表名称映射；价格表名称映射集中在 domain service 中

### 4.2 Base URL

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

### 4.3 Frappe 方法调用

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

### 4.4 错误格式

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

### 4.5 Token 处理

业务请求不需要页面手动携带 token。

当前统一处理层：

- `auth-storage.ts` 负责保存、读取、清空 token，并导出 `getMyAppAuthHeaders()`。
- `requestErrorConfig.ts` 的 request interceptor 会对 `/api/method/myapp.*` 自动注入 `Authorization: Bearer <access_token>`。
- `requestErrorConfig.ts` 的 response interceptor 会对 `myapp.api.gateway.*` 的 `401` 尝试 `refresh_v1`，刷新成功后自动重放原请求一次。
- `auth.ts` 不依赖 Umi request，认证链路内部使用 `fetch`，但同样复用 `getMyAppAuthHeaders()` 给 `me_v1` 和 `logout_v1` 携带 token。

因此页面和 domain service 不应手动拼 `Authorization`。

### 4.6 幂等 key

交易型接口需要幂等保护。虽然 Web 第一期主要是查询页，但如果实现取消、确认、付款等写操作，应遵守：

- 新业务动作生成新的 `Idempotency-Key`
- 网络重试或重复点击复用同一个 key
- 用户修改表单后重新提交必须生成新的 key
- 优先通过 Header 传入：

```text
Idempotency-Key: <uuid>
```

当前已提供 `services/myapp/mutation.ts`，用于后续写操作统一生成/传入 `Idempotency-Key`，并返回本次使用的 key。页面仍负责二次确认、刷新列表和跳转。

### 4.7 通用组件与业务工具

新增页面时，优先复用通用组件和工具，不要在业务页面内重复实现远程选择器、商品搜索和单位换算逻辑。

当前通用组件：

- `src/components/RemoteLinkSelect.tsx`
  - 通过 `search_link_options_v1` 查询 Frappe Link 选项。
  - 适用于 Customer、Company、Warehouse、Mode of Payment 等受后端白名单控制的 Link 字段。
  - 页面只传 `doctype`、`extraFields`、`filters`、`placeholder`、`limit` 和 `onChange`。
  - 作为筛选项使用时，应支持聚焦 / 展开即加载初始候选项，输入关键字后远程联想刷新候选项；不要把 Company、Customer、Supplier、Warehouse 等 Link 筛选退化成普通文本输入框。
  - ProTable 搜索表单中使用当前版本支持的 `formItemRender` 承载该组件，不使用类型不兼容的 `renderFormItem`。
  - `filters` 只能使用后端白名单字段，例如仓库按当前公司过滤、付款方式按启用状态过滤。
  - 当前会保留已有 value 作为临时选项，避免编辑页或禁用态 Link 字段无法显示当前值。
- `src/components/WorkspacePreferenceButton.tsx`
  - 顶部工作偏好入口，用于维护当前用户默认公司和默认仓库。
  - 保存到后端 `get_current_user_workspace_preferences_v1` / `update_current_user_workspace_preferences_v1` 对应的用户默认值。
- `src/components/ProductSelect.tsx`
  - 企业级商品选择器，不再使用简单下拉。
  - 通过 `searchProducts` / `search_product_v2` 查询商品，使用 Ant Design Pro `ProTable` 弹窗展示商品、编码、规格、单位、总库存、当前仓库存、销售 / 采购参考价和商品用途标识。
  - 支持公司、仓库和 `itemContext` 上下文；销售开单传 `sales`，采购开单传 `purchase`，库存类场景可传 `inventory`，通用场景可传 `any`。
  - 支持关键词、商品分类、品牌和仅有库存筛选；关键词为空时必须至少选择分类或品牌，不把 `search_product_v2` 当作无条件全量商品浏览接口使用。
  - 销售 / 采购场景支持表格勾选后批量加入明细，也支持“连续选择”模式；库存调整场景保持单选，因为页面一次只调整一个目标商品。
  - 返回已规范化的 `ProductSummary`，包含别名、单位、换算、价格摘要、销售 / 采购标识和库存参考字段。
- `src/components/UomSelect.tsx`
  - 通过 `listUoms` / `list_uoms_v2` 查询启用单位。
  - 商品维护和订单表单内的单位字段应优先使用该组件，不通过通用 Link 查询扩大 DocType 白名单。
- `src/components/ItemImageUpload.tsx`
  - 商品维护弹窗使用的图片上传控件。
  - 新增商品时先上传临时图片，再随 `create_product_v2` 的 `image` 字段绑定到商品。
  - 编辑商品时调用 `replace_item_image` / `delete_item_image` 直接替换或删除现有商品图片。
- `src/components/PaymentModeSelect.tsx`
  - 销售 / 采购收付款动作统一使用的付款方式选择器。
- `src/components/InvoicePaymentForm.tsx`
- 销售 / 采购订单详情登记收付款时选择具体销售发票 / 采购发票；销售侧按钮和弹窗文案使用“登记客户收款”，避免和客户退款或取消原收款混淆。
  - 选中发票后读取发票详情，以该发票未结金额作为默认金额和输入上限。
- `src/components/DownstreamRollbackGuide.tsx`
  - 销售 / 采购订单快捷回退遇到多下游单据时展示分步处理路径。
- 直接列出关联发票和发货 / 收货单链接；销售侧提示先取消发票详情中的原客户收款，再取消发票，最后取消发货单；采购侧提示先取消最近付款，再取消发票，最后取消收货单。
- `src/components/LineQtyEditor.tsx`
  - 订单详情下游发货、收货、开票时填写“本次数量”的通用编辑器。
- `src/components/PartyManagementPage.tsx`
  - 客户 / 供应商共用往来单位治理页面，支持关键词、状态、分组筛选、新增、编辑、启用、停用、详情抽屉、主联系人 / 主地址维护、默认价格表、付款条款、税号、税务类别、当前筛选结果 CSV 导出和 CSV 批量导入。
  - 写操作统一走 `runGatewayMutation`，保持 `Idempotency-Key`。
- `src/components/PurchaseOrderLinesTable.tsx`
  - 采购订单新建 / 编辑明细表，按商品分组展示，支持数量、单位、采购价、仓库、当前仓库存、本次入库、入库后库存、金额合计、同商品多仓库行和基于分仓库存的快捷新增仓库行。
- `src/components/PageState`
  - 页面 loading、empty、error、retry 状态。

当前通用业务工具：

- `src/utils/myapp-display.tsx`
  - 状态中文标签、币种 / 金额、计量单位展示。
- `src/utils/display-uom.ts`
  - 计量单位显示层，优先使用后端 `*_display` / `display_name` 字段，兜底处理常见英文单位和缩写。
- `src/utils/uom-conversion.ts`
  - 单位换算到库存单位、换算数量格式化。
- `src/utils/sales-order-editor.ts`
  - 销售订单行模型、批发 / 零售默认单位和价格、单位换算、行金额和合计计算。
  - 后续销售订单编辑、退货、退款相关页面应继续复用该工具，不在页面内重新写单位换算。
- `src/utils/purchase-order-editor.ts`
  - 采购订单行模型、采购默认价、总库存、分仓库存、单位换算、行金额和合计计算。
  - 后续采购订单编辑、退货、退款相关页面应继续复用该工具，不在页面内重新写单位换算。
- `src/hooks/useWorkspacePreferences.ts`
  - 读取当前用户默认公司和默认仓库。
  - 新建销售 / 采购订单页已优先使用该偏好，客户 / 供应商上下文建议仍可覆盖为更具体的业务默认值。
  - Dashboard、销售 / 采购订单列表、报表、财务、收付款、库存流水、商品库存、库存预警和商品主数据查询已使用该偏好作为默认公司。
  - 在查询页中，默认公司只用于搜索表单初始值。请求组装必须尊重用户当前筛选值：用户清空公司后应传 `undefined` / 空筛选以查询全部公司数据，不能再用 `params.company ?? defaultCompany` 兜底。
  - 页面请求参数建议用 `toOptionalText(params.company)` 这类归一化工具处理空值，避免空字符串、`null`、`undefined` 的语义不一致。

### 4.8 权限和页面状态

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

### 4.9 业务展示值

Web 端已新增 `src/utils/myapp-display.tsx`，统一处理常见业务展示值：

- 状态：`StatusTag` / `formatStatusLabel` 将后端状态码展示为中文标签，并按状态类型给出基础颜色。
- 金额：`formatCurrencyValue(value, currency)` 按移动端约定展示金额单位，`CNY` / `RMB` 显示为 `元`，外币保留币种代码。
- 币种：`formatCurrencyCode(currency)` 将人民币显示为 `人民币`，外币显示币种代码。
- 单位：`formatDisplayUom(uom)` 复用移动端单位映射，例如 `NOS` / `PCS` 显示为 `件`，`BOX` 显示为 `箱`，`KG` 显示为 `千克`。

新页面不要再自行硬编码 `¥`、本地 `formatCurrency` 或原始状态标签。销售、采购、发票、发货 / 收货、报表、财务、收付款、商品和库存流水页面已接入该展示层。

### 4.10 打印与 PDF

Web 端已新增 `src/services/myapp/printing.ts` 和 `src/components/PrintDocumentButton.tsx`：

- 打印预览调用 `myapp.api.gateway.get_print_preview_v1`，由后端返回 HTML 内容，前端打开独立预览窗口。
- PDF 下载先调用 `myapp.api.gateway.get_print_file_v1` 获取文件元数据，再通过 `myapp.api.gateway.download_print_file_v1` 下载真实文件流。
- 当前已接入 `Sales Order`、`Delivery Note`、`Sales Invoice`、`Purchase Order`、`Purchase Receipt`、`Purchase Invoice` 六类单据详情页。
- 打印 / 下载属于读取和文件下载动作，不使用 `runGatewayMutation`；写操作幂等规则不适用于该类动作。
- 前端不直接拼 Frappe 打印 URL，不绕过 gateway 调用 `/printview` 或 `/api/resource`。

## 5. 媒体 URL 约定

商品图片、文件链接等媒体字段只能当作 opaque URL 使用。

前端规则：

- 后端返回完整 `https://...` 时直接使用
- 后端返回 `/files/...` 或 `/private/files/...` 时拼接 API base URL
- 开发环境同域 `/files/...` 依赖 `config/proxy.ts` 的 `/files/` 代理到 Frappe；如果图片接口成功但页面不显示，先确认 dev server 已重启并命中该代理。
- 不在页面中假设存储一定是 ERPNext 本地文件
- 不在页面中直接拼 OSS/S3/MinIO 地址
- 商品详情图片 URL 使用商品 `modified` 作为 `resolveMediaUrl(..., { version })` 参数；图片上传 / 替换返回的预览 URL 使用 `file_id` 作为版本参数，避免替换同一路径图片后浏览器继续读取旧缓存。
- 以后接入云存储时，应由后端 `media_service` 保持字段兼容

当前 Web 已提供 `resolveMediaUrl(value, { version })` 工具，参考 `frontend/myapp-mobile/lib/media-url.ts`。

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
- `myapp.api.gateway.get_sales_report_v1`
- `myapp.api.gateway.get_purchase_report_v1`
- `myapp.api.gateway.get_receivable_payable_report_v1`
- `myapp.api.gateway.get_cashflow_report_v1`
- `myapp.api.gateway.list_inventory_stock_summary_v1`

当前字段：

- 销售总览
- 采购总览
- 应收应付摘要
- 资金流入 / 流出与净现金流
- 销售 / 采购趋势
- 客户 / 供应商排行
- 商品销售额类别占比
- 库存资产和库存预警

说明：

- 首页按 Ant Design Pro 官方 `dashboard/analysis` 的页面结构实现。
- 图表使用 `@ant-design/plots`，不要回退到手写 SVG/CSS 图表，除非官方图表无法满足明确业务需求。
- 页面层只消费 domain service 返回的驼峰字段，不直接处理后端蛇形字段或 Frappe 外层包络。

### 6.3 销售单据列表

路由：

```text
/sales/orders
/sales/orders/new
/sales/orders/:name/edit
/sales/orders/:name
/sales/delivery-notes/:name
/sales/invoices/:name
/sales/returns/new
/sales/refunds/review
```

接口：

- `myapp.api.gateway.search_sales_orders_v2`
- `myapp.api.gateway.get_sales_order_detail`
- `myapp.api.gateway.get_customer_sales_context`
- `myapp.api.gateway.create_order_v2`
- `myapp.api.gateway.quick_create_order_v2`
- `myapp.api.gateway.update_order_v2`
- `myapp.api.gateway.update_order_items_v2`
- `myapp.api.gateway.quick_cancel_order_v2`
- `myapp.api.gateway.get_delivery_note_detail_v2`
- `myapp.api.gateway.get_sales_invoice_detail_v2`
- `myapp.api.gateway.get_return_source_context_v2`
- `myapp.api.gateway.process_sales_return`
- `myapp.api.gateway.get_sales_order_status_summary`

当前 Web service：

- `searchSalesOrders`
- `getSalesOrderDetail`
- `getCustomerSalesContext`
- `createSalesOrderV2`
- `quickCreateSalesOrderV2`
- `updateSalesOrderV2`
- `updateSalesOrderItemsV2`
- `quickCancelSalesOrderV2`
- `getDeliveryNoteDetail`
- `getSalesInvoiceDetail`
- `getSalesReturnSourceContext`
- `submitSalesReturn`

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

- `/sales/orders` 已接入列表查询、筛选、分页和汇总；排序支持“未完成优先”“最新订单”“最近更新”“最早订单”“金额从高到低”“金额从低到高”。
- `/sales/orders` 的“最新订单”对应后端 `order_date_desc`，按订单日期排序；“最近更新”对应 `latest`，按最后修改时间排序，两者不能混用。
- `/sales/orders` 状态筛选应沿用 mobile 口径：`cancelled` 查询必须传 `excludeCancelled: false`；`completed` 只表示已全部发货且已全部开票收款结清，不以未收金额为 0 单独判定。
- `/sales/orders` 列表展示状态时不要直接把后端技术值 `fulfillment.status = pending` 展示成泛化“待处理”，销售语义应显示为“待发货”。
- `/sales/orders` 公司和客户筛选均应使用 `RemoteLinkSelect`；状态切换应放在状态视图工具条中，统计卡默认只作为概览指标，不再作为隐式筛选入口。
- `/sales/orders` 状态视图应把“全部有效订单”作为第一层级默认入口，优先使用卡片内的 `Tabs` 工具条，并把风险动作放在页签旁侧；统计卡默认只作为概览指标，不应承担隐式筛选入口，除非页面明确采用选择卡模式。
- `/sales/orders` 行内操作入口必须消费 `search_sales_orders_v2` 摘要中的 `actions`，不要在列表页重复推导能否发货、开票、收款或作废；可通过 `?action=delivery|invoice|payment` 让详情页定位到对应动作区。
- `/sales/orders/:name` 负责解释下游动作不可用原因；从列表携带 `?action=delivery|invoice|payment` 进入详情页时，如果目标动作当前不可执行，应在详情页显示明确提示。发货、开票、收款和取消订单按钮禁用时都应在动作区暴露原因，取消订单原因优先使用 `get_sales_order_detail` 中的 `actions.cancel_sales_order_hint`。
- `/sales/orders/:name` 详情页应保持企业级详情页结构：`PageContainer` 展示单号和页面操作，正文顶部使用金额概览卡片展示订单金额、应收金额、已收金额、未收金额和收款进度，中间展示订单进度与商品明细，右侧展示履约动作、基本信息、关联单据和收货信息。
- 详情页金额展示应有业务语义：订单金额使用主金额权重，已收金额使用成功色，未收金额大于 0 时使用危险色和更高权重，结清时使用成功色。不要把关键金额弱化成普通描述文本。
- 详情页下游动作弹窗应是明确的业务确认流。发货弹窗默认按待发数量生成本次发货明细，允许用户改小实现部分发货，数量为 0 的行不提交；弹窗展示单价和本次发货金额用于核对，但不允许在发货环节改价。
- 业务数量展示不要强制显示无意义小数。整数数量显示为 `8`、`28`；只有真实小数才保留必要小数。可编辑数量使用 Ant Design 标准 `InputNumber`，保留直接输入和增减按钮。
- `/sales/orders` 交货逾期、收款逾期等风险提示和筛选必须消费后端 `risk_filter` / `risk` 字段；`delivery_overdue` 表示未完全发货且交货日期早于今天的订单，`payment_overdue` 表示仍有未收款且交货日期早于今天的订单。
- `/sales/orders` 表格中日期字段和风险提示应分列展示，例如交货日期列只显示 `deliveryDate`，逾期标签放在独立“异常”列。
- `/sales/orders` 批量操作应使用 ProTable 官方 `rowSelection` + `FooterToolbar` 模式；选中行的前端 CSV 导出可以在客户端完成，导出完整筛选结果应走 `export_sales_orders_v2`。
- `/purchase/orders` 排序与销售订单保持同一语义：`order_date_desc` 是“最新订单”，按采购订单日期倒序；`latest` 是“最近更新”，按最后修改时间倒序。
- `/purchase/orders` 状态筛选应沿用 mobile 口径：`cancelled` 查询必须传 `excludeCancelled: false`；`completed` 表示已全部收货且已开票付款结清。
- 报表、财务和各业务列表的公司筛选统一使用 `RemoteLinkSelect`；默认公司只作为初始筛选值，用户清空公司后必须查询全部公司，不能再回退默认公司。
- `/sales/orders/new` 已接入销售订单新建，支持客户、公司、默认仓库、日期、批发 / 零售模式、联系人、电话、收货地址、备注、商品搜索选择、单位换算、默认价格、库存参考、保存订单和快捷下单。
- `/sales/orders/:name/edit` 已接入销售订单编辑，支持加载现有订单、补全商品单位和价格上下文、编辑收货信息和商品明细，并调用 `update_order_v2` / `update_order_items_v2` 保存。
- `/sales/orders/:name` 已接入订单详情、金额汇总、履约信息、关联发货单 / 发票、业务时间线和商品明细，并支持按明细行填写本次数量创建发货单 / 销售发票、选择具体销售发票并按金额和付款方式登记客户收款、回退并修改订单、取消销售订单，以及动作入口不可用时的原因提示；订单已结清时应禁用登记客户收款入口；Web 端当前暂停直接发起销售退货，业务改错应使用“回退并修改订单”或进入销售发票 / 销售发货单详情按顺序作废相关单据。
- `/sales/delivery-notes` 已接入销售发货单列表，支持关键词、公司、日期、单据状态、排序和分页。
- `/sales/delivery-notes/:name` 已接入销售发货单详情、金额 / 数量汇总、收货信息、关联销售订单 / 销售发票和商品明细，并支持取消发货单；详情页应沿用销售订单详情的 Ant Design Pro 风格：顶部 KPI，中间主区域展示商品明细和后续处理，右侧展示单据属性、关联单据、收货信息和回退动作；详情页需要展示“后续处理 / 历史单据说明”，已开票时引导查看销售发票，未开票且有关联订单时引导返回订单详情并通过 `?action=invoice` 进入开票动作。
- `/sales/invoices` 已接入销售发票列表，支持关键词、公司、日期、单据状态、排序和分页。
- `/sales/invoices/:name` 已接入销售发票详情、金额 / 收款汇总、收款历史、收款信息、关联销售订单 / 发货单和商品明细，并支持登记客户收款、取消销售发票和取消客户收款凭证；详情页应沿用销售订单详情的 Ant Design Pro 风格：顶部 KPI，中间主区域展示收款历史和商品明细，右侧展示单据属性、关联单据、结算信息和原收款处理动作；详情页需要展示“流程承接 / 历史单据说明”，有未收金额时直接登记客户收款，已结清时引导查看发货单或打印留档。收款历史来自 `get_sales_invoice_detail_v2.payment.entries[]`，应展示每笔客户收款的收款单号、日期、付款方式、核销金额、实收金额、差额核销、多收保留和参考号，收款单号应链接到 `/payments/<收付款单号>`，并提供行级“取消这笔收款”入口。取消客户收款是作废某一个 `Payment Entry` 的纠错 / 回退动作，不是正式客户退款；多笔收款必须让用户看清并选择具体收款单，确认弹窗应展示金额、方式、日期和参考号，顶部快捷入口只能表述为“取消最近客户收款”。
- 已被退货发票全额冲回的来源销售发票不能继续登记客户收款，即使底层发票重新出现未收金额也应禁用收款入口并展示 `actions.record_payment_hint`；如客户重新购买，应在原订单基础上重新发货并开新销售发票后再收款。后端 `update_payment_status` 也必须拒绝这类来源发票，避免从其他入口绕过页面限制。
- 已被退货发票冲回的来源销售发票如果仍有关联客户收款，页面只能以“异常收款清理”语义逐笔取消，不能继续展示为普通“回退处理”或暗示清理后可继续在原发票上收款；来源发票已关联退货发票时不应提供直接作废来源发票动作。
- `/sales/orders/new` 保存时应聚合表单必填项和商品明细校验；客户、公司、日期和商品明细等缺失项应一次性提示，不要让用户逐项试错。
- `/sales/invoices/:name` 收款历史在 service 层会过滤误混入的表头行，例如 `payment_entry = 收款单 / Payment Entry`，避免后端异常数据导致表格表头重复显示。
- `/sales/delivery-notes/:name` 未开票且有关联订单时，“前往开票”仍跳转来源订单 `?action=invoice` 并直接打开创建销售发票流程；页面文案应明确该动作会进入来源订单开票。
- 销售订单、销售发货单和销售发票详情页已接入打印预览和 PDF 下载。
- `/sales/returns/new` 保留页面和服务封装，但 Web 端当前暂停直接发起销售退货，直接访问该页面只展示暂停说明。历史已经生成的退货发票仍可通过订单时间线、关联单据和退款核对页面继续查看或回退。
- `/sales/refunds/review` 已接入销售退款核对和客户退款登记，支持读取来源销售发票收款状态、收款历史、查看退货发票，并通过 `get_customer_refund_context_v1` 读取可退金额、已退金额、退款历史和动作权限，再基于已提交的退货发票调用 `create_customer_refund` 创建正式退款 `Payment Entry`；页面结构沿用销售详情页的 Ant Design Pro 风格：顶部 KPI，中间主区域展示退款登记、客户退款历史和来源发票收款历史，右侧展示处理建议、退货 / 来源发票关系、来源发票核对和原收款处理；“取消原客户收款”仅用于需要撤销来源发票原收款凭证的场景，不等同于客户退款。

新建订单页面规则：

- 使用 `RemoteLinkSelect` 选择客户、公司和仓库，客户变化后调用 `get_customer_sales_context` 自动带出默认公司、仓库、联系人和地址。
- 使用 `ProductSelect itemContext="sales"` 搜索可销售商品；选择器应展示可判断的商品、库存、仓库库存、单位和销售参考价，商品行使用 `sales-order-editor.ts` 自动带出批发 / 零售默认单位、默认价格、可选单位、库存单位换算和金额合计。
- 保存订单调用 `create_order_v2`；快捷下单调用 `quick_create_order_v2`，由后端同时创建销售订单、发货单和销售发票。
- 所有提交仍通过 `runGatewayMutation` 生成 `Idempotency-Key`，页面不手动拼 token。

编辑订单页面规则：

- 从 `get_sales_order_detail` 加载订单，再按商品编码调用 `get_product_detail_v2` 补全单位换算、默认单位、默认价格和库存参考。
- 编辑页添加商品同样使用 `ProductSelect itemContext="sales"`，不能退回通用商品搜索或简单下拉。
- 客户和公司只读展示；当前编辑入口不直接变更订单客户和公司。
- 页面结构应使用企业级表单编辑模式：正文顶部显示金额摘要和编辑状态，中间分为订单基础信息和商品明细，底部使用 Ant Design Pro 官方 `FooterToolbar` 固定保存区。
- 编辑页底部保存区应同时展示未保存状态、商品数量和订单金额，并提供取消与保存修改。表单、商品明细、添加商品和批量切换销售模式都应标记为未保存；浏览器刷新或关闭前应提示未保存修改。
- 收货地址、备注等从后端读取到文本框前要清理 HTML 标签和 `<br>`，转成真实换行，避免用户看到后端展示格式。
- 商品明细表金额列和合计金额应突出显示，数量输入遵循“整数不显示无意义小数、可直接输入并保留增减按钮”的统一规则。
- 基础信息保存调用 `update_order_v2`；商品明细替换调用 `update_order_items_v2`。
- 已发货或已开票订单是否允许编辑由后端校验，前端不绕过业务状态。

回退并修改订单规则：

- 订单详情页的“回退并修改订单”调用 `quick_cancel_order_v2`，按客户退款单、退货发票、客户收款单、销售发票、销售发货单顺序回退，让订单回到可修改状态。
- 当前订单存在多张发货单、多张销售发票、多笔有效客户收款或多笔有效客户退款时，后端会拒绝一键回退，页面会展示分步回退指引和关联单据链接。
- 回退完成后刷新订单详情，并展示本次取消的客户退款单、退货发票、客户收款单、销售发票和销售发货单。
- 销售发货单详情页的回退说明优先展示 `actions.cancel_delivery_note_hint`；作废发货单前必须提示库存和订单履约状态会回退，且如果已经开票，应先处理下游销售发票。
- 销售发票详情页的回退说明优先展示 `actions.cancel_sales_invoice_hint`；如果发票存在客户收款单，作废发票前应提示并先取消相关客户收款，再作废销售发票，避免发票作废后原收款仍残留在结算链路中。多笔客户收款场景不能自动只取消最近一笔并继续作废发票，应要求用户在收款历史逐笔取消。

销售订单业务时间线规则：

- `/sales/orders/:name` 应渲染 `get_sales_order_detail.timeline[]`，用于串联销售订单、发货单、销售发票、客户收款、销售退货和客户退款。
- 时间线是后端聚合的展示型字段，前端不要再根据 `references.delivery_notes`、`references.sales_invoices` 和付款历史自行拼接流程。
- 时间线事件应显示单据类型、单据号、状态、业务日期、金额和关联单据；能跳转的单据应提供链接。
- 订单详情右侧关联单据和退款入口应复用 `timeline[]` 中的收款单、退货发票和退款单信息；Web 端当前暂停新的退货入口，没有退货发票时禁用退款核对入口；当存在多张退货发票时，必须让用户选择具体单据，不能默认取第一张。
- 时间线、发票详情、采购付款核对或退款结果中的 `Payment Entry` 链接应优先跳转到 `/payments/<收付款单号>`，直接打开收付款详情；`/payments?search=<收付款单号>` 仅作为列表搜索兼容入口保留。

销售退货页面规则：

- 使用 `RemoteLinkSelect` 选择销售发货单或销售发票，调用 `get_return_source_context_v2` 读取可退明细。
- 已开票订单应基于销售发票退货，未开票但已发货订单才基于销售发货单退货；页面文案必须区分正常退货和作废回改，不能暗示退货前需要先作废原发票。
- 退货明细按后端返回的 `detail_submit_key` 构造 `return_items`，提交到 `process_sales_return`。
- 退货是独立退货单，不直接改原销售订单；来源发票已收款时，页面提供“核对退款”入口。
- 页面应优先使用 Ant Design Pro 官方组件组织为“顶部 KPI + 左侧主工作区 + 右侧信息区”：主工作区放退货明细 `ProTable` 和提交结果，右侧放来源 `ProDescriptions`、后续处理提示和提交动作；不要退回普通 `Table` 加纵向堆叠的结构。

销售退款核对规则：

- `/sales/refunds/review` 读取来源销售发票详情，展示应收、实收、核销、多收保留、未收、最近客户收款和完整收款历史。
- 当 URL 或表单提供退货发票时，页面调用 `get_customer_refund_context_v1`，展示退货金额、已退金额、当前可退金额、退款历史和不可退款原因，并按 `suggested_refund_amount` 默认填入退款金额。
- 退款页应在登记成功后保留本次退款结果，展示退款单号，并继续刷新退款上下文；当可退金额为 0 时显示“退款已完成”并禁用登记按钮。
- 退款页的客户退款历史应使用“退款单 / 退款日期 / 退款方式 / 退款金额”等退款语义列名，并配合退款进度条展示累计已退和剩余可退金额。
- 退款页应展示退货发票与来源发票的关系，避免用户把“取消原客户收款”和“正式客户退款”混为同一操作。
- 正式客户退款调用 `create_customer_refund`，提交 `return_invoice_name`、`refund_amount`、`mode_of_payment`、`reference_no`、`reference_date` 和 `remarks`，由后端创建并提交 `Payment Entry`。
- “取消原客户收款”只用于需要撤销来源发票原收款凭证的场景，不等同于正式客户退款；当正式客户退款已经登记完成时，应禁用该入口，避免重复处理。
- 如业务已经线下退款，应通过正式退款登记补齐财务凭证，不在 Web 中伪造退款完成状态。
- 页面应优先使用 Ant Design Pro 官方组件组织为“顶部 KPI + 左侧主工作区 + 右侧信息区”：主工作区放正式退款登记、退款历史和来源发票收款历史，右侧放处理建议、退货 / 来源发票关系、来源发票核对和原收款回退动作；退款登记成功结果应保留在主工作区，Payment Entry 入口跳转 `/payments/<收付款单号>`。

### 6.4 采购单据列表

路由：

```text
/purchase/orders
/purchase/orders/new
/purchase/orders/:name/edit
/purchase/orders/:name
/purchase/returns/new
/purchase/refunds/review
/purchase/receipts/:name
/purchase/invoices/:name
```

接口：

- `myapp.api.gateway.search_purchase_orders_v2`
- `myapp.api.gateway.get_purchase_company_context`
- `myapp.api.gateway.get_supplier_purchase_context`
- `myapp.api.gateway.create_purchase_order`
- `myapp.api.gateway.quick_create_purchase_order_v2`
- `myapp.api.gateway.update_purchase_order_v2`
- `myapp.api.gateway.update_purchase_order_items_v2`
- `myapp.api.gateway.quick_cancel_purchase_order_v2`
- `myapp.api.gateway.create_purchase_invoice_from_receipt`
- `myapp.api.gateway.get_return_source_context_v2`
- `myapp.api.gateway.process_purchase_return`
- `myapp.api.gateway.get_purchase_order_detail_v2`
- `myapp.api.gateway.get_purchase_receipt_detail_v2`
- `myapp.api.gateway.get_purchase_invoice_detail_v2`
- `myapp.api.gateway.get_purchase_order_status_summary`

当前 Web service：

- `searchPurchaseOrders`
- `getPurchaseCompanyContext`
- `getSupplierPurchaseContext`
- `createPurchaseOrderV2`
- `quickCreatePurchaseOrderV2`
- `updatePurchaseOrderV2`
- `updatePurchaseOrderItemsV2`
- `quickCancelPurchaseOrderV2`
- `createPurchaseInvoiceFromReceipt`
- `recordSupplierPayment`
- `getPurchaseReturnSourceContext`
- `submitPurchaseReturn`
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
- `/purchase/orders/new` 已接入采购订单新建，支持供应商、公司、默认仓库、币种、订单日期、交货日期、供应商单号、联系人、电话、地址、备注、商品搜索选择、采购默认价、单位换算、库存参考、保存订单和快捷采购。
- `/purchase/orders/:name/edit` 已接入采购订单编辑，支持加载现有订单、补全商品单位和采购价上下文、编辑订单日期、交货日期、供应商单号、备注和商品明细，并调用 `update_purchase_order_v2` / `update_purchase_order_items_v2` 保存。
- `/purchase/orders/:name` 已接入采购订单详情、金额汇总、基本信息、供应商信息、关联收货单 / 发票和商品明细，并支持按明细行填写本次数量创建收货单 / 采购发票、选择具体采购发票并按金额和付款方式登记付款、快捷回退下游单据、取消采购订单。
- `/purchase/receipts` 已接入采购收货单列表，支持关键词、公司、日期、单据状态、排序和分页。
- `/purchase/invoices` 已接入采购发票列表，支持关键词、公司、日期、单据状态、排序和分页。
- `/purchase/returns/new` 已接入采购退货，支持基于采购收货单或采购发票读取可退明细、填写本次退货数量并提交独立退货单；来源发票已付款时，结果页提示继续核对供应商退款或应付回退。
- `/purchase/refunds/review` 已接入采购退款核对，支持读取来源采购发票的应付、已付、未付和最近付款，并在需要时取消最近付款；页面应沿用资金链路主从布局：顶部 KPI，中间主区域展示退款核对和后续处理，右侧展示处理建议、来源 / 退货发票关系、付款状态和回退动作。
- `/purchase/receipts/:name` 已接入采购收货单详情、金额 / 数量汇总、收货状态、关联采购订单 / 采购发票和商品明细，并支持基于该收货单创建采购发票、取消收货单。
- `/purchase/invoices/:name` 已接入采购发票详情、金额 / 付款汇总、付款进度、付款信息、关联采购订单 / 收货单和商品明细，并支持按未付金额登记供应商付款、取消采购发票和取消最近付款；详情页应沿用销售发票详情的 Ant Design Pro 风格：顶部 KPI，中间主区域展示商品明细和流程承接，右侧展示单据属性、关联单据、付款信息和回退动作，最近付款单号应链接到 `/payments/<收付款单号>`。
- 采购订单、采购收货单和采购发票详情页已接入打印预览和 PDF 下载。

采购新建页约定：

- 使用 `RemoteLinkSelect` 选择供应商、公司和仓库，供应商变化后调用 `get_supplier_purchase_context` 自动带出默认公司、仓库、币种、联系人和地址。
- 使用 `ProductSelect itemContext="purchase"` 搜索可采购商品；选择器应展示可判断的商品、库存、目标仓库存、单位和采购参考价，商品行使用 `purchase-order-editor.ts` 自动带出采购默认价、默认单位、可选单位、库存单位换算和金额合计。
- 采购明细表按商品分组展示，同组内可拆分多个目标入库仓；每组展示参考采购价、本次采购额、总库存、本次入库和入库后库存。
- “新增仓库行”用于同一商品拆分到多个目标入库仓；手动新增时复制当前商品上下文，仓库由用户在新行内选择；如果商品带有 `warehouseStockDetails`，组头应展示分仓库存快捷入口，点击具体仓库直接新增该仓库行。
- 保存订单调用 `create_purchase_order`；快捷采购调用 `quick_create_purchase_order_v2`，由后端同时创建采购订单、采购收货单和采购发票。
- 编辑页从 `get_purchase_order_detail_v2` 加载订单，再按商品编码调用 `get_product_detail_v2` 补全单位换算、默认单位、采购默认价和库存参考。
- 编辑页添加商品同样使用 `ProductSelect itemContext="purchase"`，不能退回通用商品搜索或简单下拉。

采购快捷回退规则：

- 订单详情页的“快捷回退下游”调用 `quick_cancel_purchase_order_v2`，按供应商付款、采购发票、采购收货单顺序回退。
- 当前订单存在多张采购收货单、多张采购发票或多笔有效付款时，后端会拒绝快捷回退，页面会展示分步回退指引和关联单据链接。
- 快捷回退完成后刷新订单详情，并展示本次回退的付款、采购发票和采购收货单。

采购退货规则：

- `/purchase/returns/new` 读取 `get_return_source_context_v2`，来源类型限定为 `Purchase Receipt` 或 `Purchase Invoice`。
- 退货明细按后端返回的 `detail_submit_key` 构造 `return_items`，提交到 `process_purchase_return`。
- 采购退货是独立退货单，不直接改原采购订单；来源采购发票已付款时，结果页提供“核对退款”入口，跳转 `/purchase/refunds/review`。
- 当前后端没有独立供应商退款入账接口；采购退款核对页只提供现有可执行的“取消最近付款”回退动作，不伪造独立供应商退款完成状态。

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
/payments/:name
```

接口：

- 优先使用后端已有报表接口或后续薄查询接口
- 可参考 `myapp.api.gateway.get_receivable_payable_report_v1`
- 可参考 `myapp.api.gateway.list_cashflow_entries_v1`

当前页面：

- `/payments` 已接入 `list_cashflow_entries_v1` 和 `get_cashflow_report_v1`，作为资金收支入口展示筛选范围内的收款合计、付款合计和净现金流 KPI。
- `/payments/:name` 已接入 `get_payment_entry_detail_v1`，用于查看单笔收付款凭证、业务链路、核销明细、差额 / 扣减明细、关联销售 / 采购 / 退货发票和作废动作状态。
- 支持关键词、公司、日期和分页查询；`/payments?search=<收付款单号>` 应自动填入关键词，用于保留列表搜索兼容能力，业务链路中的单号跳转应优先使用 `/payments/<收付款单号>`。
- 展示收付款单号、收款 / 付款 / 转账方向、往来方类型、往来方、付款方式、金额和参考号。
- 收付款流水中的单号应可点击进入 `/payments/:name`。
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

### 6.7 待处理确认

路由：

```text
/pending-confirmations
```

当前页面：

- `/pending-confirmations` 已接入待处理确认工作台，聚合销售发货单、销售发票、采购收货单和采购发票的草稿单据。
- 页面通过 `documents.ts` 调用 `list_business_documents_v1`，按 `docstatus=draft` 查询候选单据，不直接访问 ERPNext resource API。
- 确认动作通过 `pending-confirmations.ts` 调用 `confirm_pending_document`，写操作统一走 `runGatewayMutation` 和 `Idempotency-Key`。
- 页面支持关键词、公司、单据类型筛选，可跳转单据详情，并在提交前二次确认。

### 6.8 库存查询

路由：

```text
/inventory/stock
/inventory/stock/:itemCode
/inventory/alerts
/inventory/adjustments
/inventory/ledger
/inventory-ledger
```

接口：

- `myapp.api.gateway.list_products_v2`
- `myapp.api.gateway.get_product_detail_v2`
- `myapp.api.gateway.list_inventory_stock_summary_v1`
- `myapp.api.gateway.list_stock_ledger_entries_v1`

当前页面：

- `/inventory/stock` 已接入 `list_products_v2`，支持关键词、公司、仓库和仅有库存筛选，展示商品当前库存、公司总库存、采购价、零售价和仓库库存明细。
- `/inventory/stock` 的“查看流水”和仓库明细可跳转到库存流水，并带入商品 / 仓库筛选。
- `/inventory/stock/:itemCode` 已接入 `get_product_detail_v2` 和 `list_stock_ledger_entries_v1`，展示单个商品的库存摘要、仓库库存、单位换算和最近库存流水。
- `/inventory/alerts` 已接入 `list_inventory_stock_summary_v1`，支持低库存、无库存、负库存筛选，展示库存预警汇总和明细。
- `/inventory/adjustments` 已接入库存目标数量调整，支持选择商品、公司、仓库、过账日期、目标数量、单位和估值价。
- `/inventory/adjustments` 底层调用 `reconcile_inventory_stock_v1`，由后端统一 UOM 换算并创建正式 `Stock Entry` 调整单据，写操作走 `runGatewayMutation` 和 `Idempotency-Key`。
- `/inventory/transfers` 已接入 `transfer_inventory_stock_v1`，支持同公司仓库之间按商品单位转仓，由后端统一 UOM 换算并创建正式 `Stock Entry` 转移单据。
- `/inventory/ledger` 已接入 `list_stock_ledger_entries_v1`。
- `/inventory/ledger` 支持公司、商品、仓库、日期、凭证类型、凭证编号筛选和分页。
- `/inventory/ledger` 默认查询最近 30 天。
- `/inventory/ledger` 变动数量和库存价值变动按正负数做颜色区分。
- `Sales Order`、`Delivery Note`、`Sales Invoice`、`Purchase Order`、`Purchase Receipt`、`Purchase Invoice` 凭证号支持点击跳转。
- 暂未实现详情页的凭证类型保留纯文本。
- 页面不直接调用 `/api/resource/Stock Ledger Entry`，仍统一通过 myapp JWT gateway。
- `/inventory-ledger` 保留为旧入口，重定向到 `/inventory/ledger`。

字段：

- 物料
- 仓库
- 实际数量变化
- 凭证类型
- 凭证编号
- 入库单价
- 库存价值变化
- 日期

### 6.9 财务查询

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

### 6.10 商品与主数据辅助

可供筛选、详情和后续管理页使用：

- `myapp.api.gateway.search_product_v2`
  - Web 订单选品必须显式传 `item_context`：销售订单为 `sales`，采购订单为 `purchase`，库存查询为 `inventory`，通用检索为 `any`。
  - Web 商品选择器可传 `item_group`、`brand` 和 `in_stock_only` 缩小候选范围；分类和品牌通过 `search_link_options_v1` 查询 `Item Group` / `Brand`。
  - 返回值应继续映射到 `ProductSummary`，供 `ProductSelect`、订单行编辑器和库存页面复用。
- `myapp.api.gateway.list_products_v2`
- `myapp.api.gateway.get_product_detail_v2`
- `myapp.api.gateway.upload_item_image`
- `myapp.api.gateway.replace_item_image`
- `myapp.api.gateway.delete_item_image`
- `myapp.api.gateway.list_customers_v2`
- `myapp.api.gateway.get_customer_detail_v2`
- `myapp.api.gateway.list_suppliers_v2`
- `myapp.api.gateway.get_supplier_detail_v2`
- `myapp.api.gateway.list_uoms_v2`
- `myapp.api.gateway.create_uom_v2`
- `myapp.api.gateway.update_uom_v2`
- `myapp.api.gateway.disable_uom_v2`
- `myapp.api.gateway.list_warehouses_v2`
- `myapp.api.gateway.create_warehouse_v2`
- `myapp.api.gateway.update_warehouse_v2`
- `myapp.api.gateway.disable_warehouse_v2`

第一阶段主数据仍以查询辅助和高频治理为主；商品、客户、供应商、仓库和计量单位已先补常用维护能力，用于解决开单前的基础资料治理问题。

当前页面：

- `/master-data/products` 已接入商品列表，支持关键词、公司、仓库、状态、分类、品牌和仅有库存筛选，支持库存 / 价格摘要展示、新增、编辑、启用、停用、批量启停、批量修改分类 / 品牌、当前筛选结果 CSV 导出、图片上传、图片替换和图片删除；商品详情页已支持多条码列表、新增条码、删除条码和设置主条码。商品图片显示必须通过 `resolveMediaUrl`，并使用版本参数规避浏览器缓存。
- `/master-data/customers` 已接入客户治理第一版，支持关键词 / 状态 / 分组筛选、分页查询、新增、编辑、启用、停用、详情抽屉、主联系人 / 主地址维护、最近使用地址展示、默认价格表、付款条款、税号、税务类别、当前筛选结果 CSV 导出和 CSV 批量导入。
- `/master-data/suppliers` 已接入供应商治理第一版，支持关键词 / 状态 / 分组筛选、分页查询、新增、编辑、启用、停用、详情抽屉、主联系人 / 主地址维护、最近使用地址展示、默认价格表、付款条款、税号、税务类别、当前筛选结果 CSV 导出和 CSV 批量导入。
- `/master-data/uoms` 已接入计量单位列表，支持关键词、状态筛选、分页查询、新增、编辑、启用和停用。
- `/master-data/warehouses` 已接入仓库列表，支持关键词、公司、状态、仓库类型筛选，支持新增、编辑、启用、停用、当前筛选结果 CSV 导出和 CSV 批量导入；当前覆盖仓库名称、公司、父仓库、是否分组、会计科目、仓库类型、默认在途仓库、拒收仓标记、客户归属、联系方式和地址等 ERPNext 原生治理字段。
- 商品轻量维护当前覆盖基础字段、图片、库存单位、批发 / 零售默认单位和标准价格；库存目标数量调整已在 `/inventory/adjustments` 接入，库存转仓已在 `/inventory/transfers` 接入，批量盘点已在 `/inventory/counts` 接入并直接提交 ERPNext `Stock Reconciliation`。

当前缺口：

- 客户管理当前已从轻量维护升级为企业级第一版；常规付款条款和税务字段已接入，尚未接入联系人 / 地址多条独立管理、客户公司维度信用额度子表、客户交易历史聚合、应收钻取、客户标签 / 区域 / 业务员归属和审计记录。
- 供应商管理当前已从轻量维护升级为企业级第一版；常规付款条款和税务字段已接入，尚未接入联系人 / 地址多条独立管理、采购历史聚合、应付钻取、供应商等级 / 标签和审计记录。
- 仓库管理当前已接入 ERPNext 原生基础治理字段和 CSV 导入导出；库位 / 容量、负责人、默认成本中心、仓库权限、审计记录和更细粒度治理仍归后续模块。
- 库存批量盘点当前是直接提交式工作流；盘点草稿、复核确认、作废 / 取消和审计生命周期仍应在后续库存治理模块继续补。

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
MYAPP_WEB_ENABLE_WATERMARK=
```

`MYAPP_WEB_DEV_LOGIN_USERNAME` 和 `MYAPP_WEB_DEV_LOGIN_PASSWORD` 只在本地 dev 模式注入登录页初始值，用于联调提效。

`MYAPP_WEB_API_BASE_URL` 用于生产或非同域部署。默认留空，表示前端请求同域 `/api/method/...`。本地开发仍优先使用 Umi dev proxy 的 `MYAPP_WEB_PROXY_TARGET`。

`MYAPP_WEB_ENABLE_WATERMARK` 控制页面水印。留空时本地 dev 默认关闭、生产构建默认开启；可显式设置 `true` / `false` 覆盖。水印内容为“用户名 / 日期 / 内部资料”。

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

清理旧 dev server：

```bash
lsof -nP -iTCP:8001 -sTCP:LISTEN
lsof -nP -iTCP:8003 -sTCP:LISTEN
lsof -nP -iTCP:8005 -sTCP:LISTEN

lsof -tiTCP:8003 -sTCP:LISTEN | xargs -r kill
lsof -tiTCP:8005 -sTCP:LISTEN | xargs -r kill
```

如果 `ss` 能看到端口监听，但 `lsof` / `fuser` 查不到 PID，通常说明旧服务由另一个宿主终端、容器命名空间或更高权限启动。此时不要按端口盲杀后端进程；应回到启动旧前端服务的终端执行 `Ctrl+C`，或在宿主环境用 `lsof` 确认命令行是 `max dev` / `npm run start:dev` 后再关闭。

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

### 11.1 本轮任务总结

截至 2026-07-03 当前本地提交，销售收款 / 退货退款 / 回退链路已完成以下收尾：

- Web 端暂停直接发起销售退货入口：订单、发货单和发票详情不再引导创建新退货，`/sales/returns/new` 保留页面但展示暂停说明；历史退货发票仍可查看、退款核对和回退。
- 订单详情的“回退并修改订单”按后端能力展示可用性，避免没有下游单据或已经回退后的订单仍误导用户继续点击回退。
- 销售退款核对页区分“正式客户退款”和“取消原客户收款”：客户退款必须基于退货发票；取消原客户收款只作为纠错动作。
- 已存在正式客户退款时，页面禁用取消原客户收款入口，引导先取消客户退款，避免退款和收款作废互相冲突。
- 销售发票 / 发货单详情的作废与退货入口文案已调整为当前业务口径：常规改错优先回退下游单据，不再把退货作为 Web 端常规入口。

本轮已验证：

```bash
npm run tsc
npm run biome:lint
npm test -- Sales/Orders/Detail.test.tsx --runInBand
git -C frontend/myapp-web diff --check
```

说明：订单详情 Jest 用例通过，但仍输出项目既有 jsdom `window.getComputedStyle` not implemented 噪声和 open handle 提示。

截至 2026-06-05 当前本地提交，Web 端已完成以下收尾：

- 水印已改为环境变量开关：`MYAPP_WEB_ENABLE_WATERMARK`，本地 dev 默认关闭，生产默认开启。
- 应用标题、PWA 名称、菜单、登录页标题和页脚已改为中文业务后台文案。
- 状态、金额和币种展示已统一到 `src/utils/myapp-display.tsx`；计量单位展示和换算已拆到 `src/utils/display-uom.ts`、`src/utils/uom-conversion.ts`，规则参考 mobile 端已有处理。
- 销售、采购、发货 / 收货、发票、报表、财务、收付款、商品、库存流水页面已接入统一展示工具。
- 本地 dev server 排障说明已补充：优先固定 `8001`，旧端口服务需先确认 PID 再关闭，`/umi.js` 必须返回 `application/javascript`。
- 付款方式已从手工输入升级为选择器，通过 `myapp.api.gateway.search_link_options_v1` 查询 `Mode of Payment`，不直接调用 `frappe.client.*`。
- 顶部已新增工作偏好入口，可维护当前用户默认公司和默认仓库；主要查询页和销售 / 采购新建页已接入默认公司，录入页还会使用默认仓库。

本轮已验证：

```bash
npm run jest -- src/utils/__tests__/myapp-display.test.tsx src/pages/user/login/login.test.tsx src/services/myapp/__tests__ src/__tests__/access.test.ts --runInBand
npm run tsc
npm run biome:lint
npm run build
git diff --check
```

最近前端本地提交：

```text
02c9846 docs: document dev server cleanup
88be384 feat: normalize business display labels
731c080 docs: document localized app chrome
c4258c4 feat: localize app chrome
```

当前前端仓库 `main` 比 `origin/main` ahead 4，尚未推送。后端 `apps/myapp` 当前在 `develop`，工作区干净并已同步远端。

当前本地服务注意事项：

- 本次工具会话无法看到旧 `8001` / `8003` / `8005` 前端进程 PID，但这些端口的 `/umi.js` 已确认返回 `application/javascript`。
- 新开的 `8007` 已关闭。
- 下一会话如果需要只保留一个 dev server，应优先回到启动旧服务的宿主终端 `Ctrl+C`，或在宿主环境用 `lsof` 确认是 `max dev` 后再关闭。

### 11.2 基础接入状态

截至当前提交，Web 端基础接入状态：

- 登录页保留 Ant Design Pro 模板视觉，账号密码登录接入 `myapp.auth.token_api.login_v1`。
- 应用标题、PWA 名称、菜单、登录页标题和页脚已改为中文业务后台文案。
- `/welcome`、`/admin`、`/list` 模板路由暂时保留但已从菜单隐藏，避免影响业务导航。
- 登录成功后保存 JWT token，并更新 `@@initialState.currentUser`。
- `getInitialState` 使用 `me_v1` 恢复当前用户，不再调用模板 `/api/currentUser`。
- 全局 request 拦截器会给 `/api/method/myapp.*` 请求添加 Bearer Token。
- 业务网关请求遇到 `401` 时会尝试 `refresh_v1` 并重放一次请求。
- 新增 `/dashboard`，根路由 `/` 重定向到 `/dashboard`。
- 首页已接入 `myapp.api.gateway.get_business_report_overview_v1` 的第一版 loading / error / empty / KPI 展示。
- 新增 `/sales/orders` 和 `/sales/orders/:name`，接入销售订单查询和详情。
- 新增 `/purchase/orders` 和 `/purchase/orders/:name`，接入采购订单查询和详情。
- 新增 `/sales/delivery-notes`、`/sales/invoices`、`/purchase/receipts`、`/purchase/invoices`，接入下游单据列表。
- 新增 `/sales/delivery-notes/:name`、`/sales/invoices/:name`、`/purchase/receipts/:name`、`/purchase/invoices/:name`，接入下游单据详情和关联跳转。
- 销售 / 采购订单详情已接入按明细行填写本次数量创建发货 / 收货单、创建发票、选择具体发票后按金额和付款方式登记收付款、取消订单动作；销售订单详情已支持列表动作入口不可用时的原因提示。
- 销售 / 采购订单详情登记收付款时已使用付款方式选择器，并优先默认常用支付方式。
- 销售 / 采购下游单据详情已接入取消动作，销售发票详情额外支持取消原客户收款，采购发票详情额外支持取消最近付款。
- 销售订单、销售发货单、销售发票、采购订单、采购收货单和采购发票详情页已接入打印预览和 PDF 下载。
- 新增 `/reports`，接入经营报表入口和多组查询摘要。
- 新增 `/payments`，接入收付款流水分页查询、筛选范围 KPI 和单笔收付款详情。
- 新增 `/finance`，接入应收 / 应付聚合查询。
- 新增 `/inventory-ledger`，接入真实库存流水查询。
- 新增 `/master-data/products`、`/master-data/customers`、`/master-data/suppliers`、`/master-data/uoms`，接入主数据辅助查询。
- Web API 分层已补齐到查询后台基础面：
  - `reports.ts`：经营概览、销售 / 采购报表、应收应付、资金趋势、资金流水
  - `sales.ts`：销售订单列表 / 详情、发货单详情、销售发票详情、销售下游单据创建、取消和收款取消
  - `purchase.ts`：采购订单列表 / 详情、采购收货单详情、采购发票详情、采购下游单据创建、取消和付款取消
  - `documents.ts`：受限业务单据列表，覆盖销售发货单、销售发票、采购收货单和采购发票
  - `master-data.ts`：商品、客户、供应商、仓库、UOM 查询；商品、客户、供应商、仓库和 UOM 维护
  - `media.ts`：商品图片上传、替换和删除
  - `printing.ts`：单据打印预览、PDF 文件元数据和文件流下载
  - `api-utils.ts`：通用字段和分页解析
- 已补生产 API base 骨架：`MYAPP_WEB_API_BASE_URL` 为空时同域请求，非同域部署时显式指定。
- 已补统一 token header 层：业务请求由 request interceptor 自动携带 Bearer token。
- 已补基础权限点和通用页面状态组件。
- 已补业务展示工具：状态中文标签、金额 / 币种单位、计量单位按移动端约定统一展示。
- 已补写操作 helper：`services/myapp/mutation.ts` 统一幂等 key 模式。
- 已补基础层单测：api-client、auth-storage、api-utils、access、domain service 映射。
- dev proxy 只代理 `/api/method/` 到 `MYAPP_WEB_PROXY_TARGET`，默认 `http://localhost:8080`。
- 本地开发服务推荐固定用 `npm run start:dev -- --port 8001`。
- 已关闭模板默认 PWA 缓存，避免开发期加载旧资源后卡在启动占位页。

### 11.3 新对话继续开发建议

新对话继续开发时，优先处理：

1. 在浏览器确认 `/user/login` 强制刷新后能正常渲染和自动填充。
2. 登录后确认 `/dashboard`、`/sales/orders`、`/purchase/orders` 能显示数据或明确错误态。
3. 登录后确认 `/reports`、`/payments`、`/finance`、`/inventory-ledger` 能显示查询结果或明确错误态。
4. 登录后确认 `/master-data/products`、`/master-data/customers`、`/master-data/suppliers`、`/master-data/uoms` 能显示列表或明确错误态。
5. 做真实浏览器联调，验证销售 / 采购创建下游单据、登记收付款、取消订单和取消下游单据后的后端单据状态刷新。
6. 继续补业务增强：主数据轻量编辑、报表图表和钻取。
