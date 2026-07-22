# MyApp Web 部署说明

## 推荐架构

生产和 staging 环境优先采用同域反向代理：浏览器只访问 Web 容器，Web 容器把 `/api/method/`、`/files/` 和 `/private/files/` 转发到 Frappe frontend。

```text
浏览器 -> myapp-web:8080 -> 静态资源
                      \-> Frappe frontend:8080 -> Backend / 文件服务
```

这种部署方式下，构建参数 `MYAPP_WEB_API_BASE_URL` 保持空值，可以避免 CORS、Cookie 域和混合内容问题。只有前端和 API 必须分属不同域名时才设置绝对 API 地址。

## 本地构建镜像

构建阶段使用 Node.js 22，并通过 `package-lock.json` 和 `npm ci` 保证依赖可重复安装。CI 安装阶段跳过 Husky 等仓库生命周期脚本，再显式执行 `max setup` 生成 Umi 类型文件；镜像构建由 `max build` 完成 Umi 初始化。

```bash
docker build -t myapp-web:staging .
```

跨域构建示例：

```bash
docker build \
  --build-arg MYAPP_WEB_API_BASE_URL=https://api.example.com \
  -t myapp-web:staging .
```

## 运行

Frappe staging Compose 的默认网络名为 `staging_default`，其中 Frappe Nginx 服务名是 `frontend`：

```bash
docker run -d \
  --name myapp-web-staging \
  --restart unless-stopped \
  --network staging_default \
  -p 30080:8080 \
  -e MYAPP_WEB_UPSTREAM=http://frontend:8080 \
  myapp-web:staging
```

如 Frappe 不在同一 Docker 网络，把 `MYAPP_WEB_UPSTREAM` 改为 Web 容器可访问的 Frappe frontend 地址。不要直接指向只提供 Gunicorn API 的 backend，因为 `/files/` 也需要由 Frappe frontend 正确处理。

## GitHub Actions

- `Build staging image`：运行完整前端验证，构建并推送 `ghcr.io/<owner>/myapp-web:<tag>`。
- `Deploy staging Web`：通过 SSH 在目标服务器拉取镜像，以 `myapp-web-staging` 容器运行；发布后检查 `/healthz`、SPA 登录路由和 Frappe ping API，失败时自动恢复上一镜像。

仓库 Secrets：

- `STAGING_SSH_HOST`
- `STAGING_SSH_PORT`
- `STAGING_SSH_USER`
- `STAGING_SSH_PRIVATE_KEY`
- `GHCR_USERNAME`
- `GHCR_TOKEN`

当前服务器建议值：

```text
STAGING_SSH_HOST=192.168.31.229
STAGING_SSH_USER=vivy
publish_port=30080
docker_network=staging_default
frappe_upstream=http://frontend:8080
```

## 上线验收

```bash
curl --noproxy '*' -fsS http://192.168.31.229:30080/healthz
curl --noproxy '*' -I http://192.168.31.229:30080/user/login
curl --noproxy '*' -i http://192.168.31.229:30080/api/method/ping
```

预期结果：

- `/healthz` 返回 `200` 和 `ok`。
- `/user/login` 返回前端 HTML，刷新任意 SPA 路由不出现 404。
- `/api/method/ping` 到达 Frappe，而不是返回前端 `index.html`。
- AI 对话使用 POST + JWT SSE；Nginx 已关闭该路径的响应和请求缓冲，并把读取超时设为 300 秒。
- `index.html` 不缓存，文件名带 8 位内容哈希的构建静态资源长期缓存。
