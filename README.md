# 墨子内容工厂

基于 Next.js 15、React 19 和 SQLite/libSQL 的 AI 内容生产工作台，覆盖资讯采集、选题分析、内容创作、微信公众号草稿同步和发布状态管理。

## 已实现功能

- 资讯采集与 AI 新闻源接入
- 关键词选题分析、文章指标与洞察报告
- 多平台内容创作与篇幅配置
- 正文自动配图与文章预览
- 微信公众号 AppID/AppSecret 连接与只读预检
- 微信封面、正文图片上传及草稿创建/更新
- 草稿回查与正文图片数量校验
- 发布状态、失败原因和平台回执管理
- 可选 Supabase 登录、团队邀请与云端存储
- 可选 Inngest 后台任务与 Turso/libSQL 云数据库

## 技术栈

- Next.js 15 / React 19 / TypeScript
- SQLite（本地）或 Turso/libSQL（云端）
- Sharp 图片处理
- Supabase Auth / Storage（可选）
- Inngest（可选）

## 本地运行

要求 Node.js 20 或更高版本。

```bash
npm install
cp .env.example .env.local
npm run dev
```

Windows PowerShell：

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

浏览器访问 <http://127.0.0.1:3000>。未配置 Supabase 时，项目会使用本地管理员模式；默认数据库文件为 `content-factory.db`。

## 环境变量

复制 `.env.example` 后按需填写。最小本地运行无需配置云服务。

常用配置：

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | SQLite 或 libSQL 数据库地址 |
| `DATABASE_AUTH_TOKEN` | 远程 libSQL/Turso Token |
| `AI_BASE_URL` | OpenAI 兼容接口地址 |
| `AI_API_KEY` | AI 服务密钥 |
| `AI_MODEL` | 默认模型 |
| `INTEGRATION_CREDENTIAL_KEY` | 第三方平台凭据加密主密钥，生产环境必须设置 |
| `UNSPLASH_ACCESS_KEY` | Unsplash 图片检索密钥 |

Supabase、Inngest、资讯采集 Worker 等可选变量均列在 `.env.example` 中。

## 微信公众号配置

1. 在微信公众号/微信开发者平台取得公众号 AppID 和 AppSecret。
2. 将部署服务器的出口 IP 加入公众号 IP 白名单。
3. 在“系统设置 → 发布渠道”中填写账号名称、AppID 和 AppSecret。
4. 点击“重新检测”，确认凭据、白名单、草稿接口和素材接口通过。
5. 在发布管理中创建草稿；正文图片会上传到微信图文图片接口后再插入草稿。

说明：微信草稿接口只返回 `media_id`，不提供可直接打开单篇草稿的固定网页链接。应用会回查草稿内容和图片数量，后台查看仍需登录微信公众号。

## 检查与构建

```bash
npm run lint
npm run build
npm run start
```

健康检查：`GET /api/health`。

## 上传 GitHub

```bash
git init
git add .
git commit -m "Initial release"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/YOUR_REPOSITORY.git
git push -u origin main
```

仓库已配置 GitHub Actions，会在推送和 Pull Request 时执行 TypeScript 检查与生产构建。

## 安全说明

- 不要提交 `.env.local`、数据库文件、日志、`.runtime` 或 `.vercel`。
- 不要把 AppSecret、API Key、数据库 Token 写进浏览器端代码。
- 生产环境必须设置随机且稳定的 `INTEGRATION_CREDENTIAL_KEY`。
- 公众号操作默认创建或更新草稿，不会在未获得接口权限时伪装成已发布。

## 许可证

当前项目未附加开源许可证。公开仓库仅代表源码可见；如需允许他人复制、修改或商用，请在发布前选择并添加合适的许可证。
