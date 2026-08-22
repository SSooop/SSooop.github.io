# Writer Studio：多栏目、Ideas 与唯一分发控制台路线

> 方案基线：2026-08-02。平台接口、权限与价格会变化，实施连接器时必须再次核对官方文档。

## 目标定义

Writer Studio 应成为本站内容的**唯一控制平面**，但不承诺所有平台都能全自动执行：

```text
本地构思与写作 → 人工定稿 → 本站 canonical → 私有分发队列
                                      ├─ 官方 API
                                      └─ 人工发布包
```

- 本站保存完整、稳定、可引用的双语 canonical 版本。
- 各平台版本都从同一个已批准的内容版本派生，不在平台编辑器里产生第二份“源稿”。
- API 可用且合规时自动发布；平台不开放 API 时，由 Studio 生成发布包并记录人工完成状态。
- 未发布的 ideas、草稿、排期 payload、凭据与平台内部 ID 不进入公开 Git 历史。

## 当前事实基线

仓库在本轮审计时共有 37 个完整中英文章对（74 个 MDX）：

| 平台           | 仓库能证明的状态                                                      |
| -------------- | --------------------------------------------------------------------- |
| 本站           | 37 个中文版本、37 个英文版本均已发布                                  |
| 微信公众号     | 37 个中文版本声明已发布；其中没有直达 URL 或 remote ID                |
| 英文微信公众号 | 6 个英文版本也声明发布，需核验是否为复制误标                          |
| LinkedIn / X   | 没有结构化发布记录                                                    |
| Medium / 雪球  | schema 已可登记（`xueqiu` / `medium` 全文条目）；历史发布记录仍需对账 |

因此目前首先要解决的是“远端对账”，而不是把所有空白都直接当成“未发布”。已知线索包括：

- `2025/glp1-china-giants-battle` 英文正文保留了一条 Medium 版本链接，应核验后导入台账。
- `2026/continuous-refactoring` 的历史版本曾声明微信、雪球和 Medium 同步发布，但缺少 URL，应标记为待核验。

## 产品模型

### 栏目注册表

Writer Studio 的一级对象是栏目，而不是博客目录：

| ID                   | 栏目            | 当前内容类型 | 当前可执行能力                          |
| -------------------- | --------------- | ------------ | --------------------------------------- |
| `intellipharma`      | 智药深瞳        | 双语文章     | Ideas、文章任务、站点发布、未来外部分发 |
| `economics-after-ai` | AI 时代的经济学 | 在线书       | Ideas；章节格式稳定后再增加书稿适配器   |
| `gaia-project`       | 盖亚计划        | 长期研究项目 | Ideas；研究输出格式稳定后再增加适配器   |

不同栏目应配置自己的工作流、文档模板、语言、校验器、canonical 规则和发布适配器，不能继续在 `server.mjs` 中堆叠栏目条件分支。

### Ideas Track

Idea 是跨文章、跨章节的独立对象，至少包含：

```text
columnId, title, body, tags, sourceUrl, status, targetDate,
createdAt, updatedAt
```

推荐状态：

```text
收件箱 → 继续发展 → 已排期 → 已进入写作 → 已归档
```

下一步增加：Idea 之间的连接、证据条目、合并、全文搜索，以及“晋升为文章/章节/研究任务”。

### 分发台账

台账按文章语言版本和平台 rendition 记录，不在中英文 frontmatter 中重复制造模糊状态：

```text
translationKey
locale
platform
format: full_text | native_article | summary | thread | link_post
status: planned | approved | site_published | queued | publishing |
        published_claimed | published_verified | manual_required |
        needs_reconcile | failed | withdrawn
contentHash
publicUrl
remoteId
publishedAt
lastVerifiedAt
evidence
```

唯一键使用：

```text
(translationKey, locale, platform, format, contentHash)
```

API 超时且无法确认是否成功时必须进入 `needs_reconcile`，不能盲目重试并制造重复内容。

## 平台执行策略

| 平台       | 推荐内容                                 | 执行方式                              | 关键边界                                                   |
| ---------- | ---------------------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| 本站       | 中英完整正文                             | 现有站点发布器                        | 唯一 canonical                                             |
| 微信公众号 | 中文完整正文                             | 官方 API 进草稿；权限允许时再提交发布 | `freepublish` 权限取决于主体和认证状态；发布不等于群发     |
| 雪球       | 产业、资本、经济学相关中文全文或深度节选 | Studio 生成发布包，人工发布           | 未发现公开发布 API；不得使用 cookie、私有接口或机器人绕过  |
| LinkedIn   | 英文洞见、关键图表、canonical 链接       | 官方 OAuth + Share/Post API           | API 的 article 是 URL 卡片；原生长文章/Newsletter 人工完成 |
| X          | 明确结论、短线程、精选英文 Article       | Create Post；权限确认后接 Article API | Articles 需合资格订阅；API 权限和调用成本须在接入时复核    |
| Medium     | 精选常青英文长文                         | 发布本站后，用官方 Import 人工导入    | 不再签发新 integration token；旧 API 不受支持              |

官方依据：

- 微信：[新增草稿](https://developers.weixin.qq.com/doc/service/api/draftbox/draftmanage/api_draft_add.html)、[发布草稿](https://developers.weixin.qq.com/doc/service/api/public/api_freepublish_submit.html)、[Stable Access Token](https://developers.weixin.qq.com/doc/subscription/api/base/api_getstableaccesstoken.html)
- LinkedIn：[权限](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access)、[Share on LinkedIn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin)、[OAuth](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow)
- X：[Create Post](https://docs.x.com/x-api/posts/create-post)、[Create draft Article](https://docs.x.com/x-api/articles/create-draft-article)、[Articles 资格与编辑器](https://help.x.com/en/using-x/articles)、[OAuth 2.0](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code)
- Medium：[API 现状](https://help.medium.com/hc/en-us/articles/213480228-API-Importing)、[Import](https://help.medium.com/hc/en-us/articles/214550207-Importing-a-post-to-Medium)
- 雪球：[服务协议](https://xueqiu.com/about/terms)

## 隐私与凭据边界

### 可以公开提交

- 栏目注册表、状态机、连接器代码与 payload 模板。
- 已公开文章、公开 URL、公开发布时间与已验证分发状态。
- 不含正文和授权信息的测试 fixture。

### 只能保存在私有运行层

- Ideas、草稿、未发布的分发 payload。
- OAuth access/refresh token、AppSecret、平台内部草稿 ID、账号内部 ID。
- 可能包含正文或身份信息的错误响应与调度日志。

本机凭据优先放 macOS Keychain，Writer Studio 只保存 `secretRef`。不要把 token 放入前端、`localStorage`、截图、Issue、PR 评论或 GitHub Actions 日志。

如果接受“电脑开机时才能定时发布”，首版调度器使用本机 `launchd + Keychain`，保密性最好。如果要求关机后仍准时发布，再部署独立的私有 worker，并使用云 Secret Manager/KMS；它不应运行在公开仓库的普通 CI 上。微信 API 还需要稳定出口 IP。

发布采用两阶段操作：

```text
prepare（生成平台版本并锁定 hash）
  → approve（人工预览确认）
  → execute（API 或人工发布）
  → reconcile（回填 remote ID、URL 与状态）
```

## 分阶段开发路线

### Phase 0：安全的多栏目底座（本轮已完成）

- 三栏目注册表和栏目选择器。
- 跨栏目的本地 Ideas Inbox：快速捕获、来源、标签、目标日期、编辑和状态推进。
- 旧博客任务自动补上版本、栏目和内容类型，不改变已发布内容。
- 非博客栏目不会被错误套入博客 MDX 模板。
- 所有写操作要求启动时会话令牌，并拒绝跨源请求。

### Phase 0.5：人工发布包（本轮已完成）

- Writer Studio 为微信公众号、雪球、Medium、LinkedIn 长文和 X Article 生成保守的内联
  样式富文本，同时写入 `text/html` 与 `text/plain` 剪贴板格式。
- LinkedIn 动态与 X 帖子生成适合平台限制的纯文本引流文案，不伪装成富文本。
- 标题、canonical、正文和图片分别一键复制；已发布文章图片可从正式内容目录安全回退，
  SVG/JPG/WebP 等在复制图片时转为 PNG。
- 公式、站点数据表、未知 MDX 组件、遗失图片与旧 HTML 会显示复核提示，不静默丢失。
- 发布包不读取凭据、不访问平台 API、不自动登录，也不会把 localhost 图片地址写入正文。
- Medium 明确提示优先使用官方 URL Import；各平台剪贴板兼容性仍需以真实粘贴结果为准。

当前发布包已覆盖存量：侧边栏“站点文章”区列出全部已发布文章，可直接编辑正式副本
（`src/content/blog/`）并基于正式版本生成发布包，不再依赖 `.drafts/` 副本。尚未完成的是
Phase 2 的分发台账与远端对账；不能把“可复制”误当成“已完成远端对账”。

### Phase 1：Idea 晋升与经济学书稿适配器

- Idea 支持搜索、连接、合并和证据条目。
- “晋升”动作建立写作任务，并保留 Idea 回链。
- 增加移动端快速捕获界面和离线暂存；移动端只暴露最小化的 capture surface，
  不暴露文章发布、OAuth 或凭据管理。
- 首选通过 Tailscale Serve 在个人 tailnet 内访问专用 capture endpoint，使用独立设备令牌；
  不把当前 localhost 管理后台直接绑定到 `0.0.0.0`。若要求主机离线时仍可捕获，再增加只保存
  端到端加密 payload 的中继，解密密钥只留在个人设备。
- 为《AI 时代的经济学》建立独立章节 collection、动态路由、章节排序和书级大纲。
- 保留现有经济学地图为专题可视化，不让普通 MDX 发布器覆盖它。
- 让 P02/P03 能进入站点统一 feed，但拥有自己的编辑边界与页面外壳。

验收：能从一条经济学 Idea 创建章节任务、完成双语或指定语言书稿，并安全发布到 P02 路径。

### Phase 2：私有分发台账与远端对账

- 导入 74 个站内版本为 `published_verified`。
- 导入 37 个中文微信声明为 `published_claimed`。
- 将 6 个英文微信声明和已知 Medium/雪球线索标为 `needs_reconcile`。
- 认证后先读取或导出远端文章清单，再按标题、日期、语言匹配 `translationKey`。
- 只把确认过的公开 URL 回填到公开 frontmatter。

验收：Writer Studio 能准确区分“已验证、仅声明、真正未发布”，并生成可靠 backlog。

### Phase 3：连接器试点

建议按风险从低到高：

1. LinkedIn 个人 Share：一条测试动态。
2. X：先发一条测试帖并设置调用预算上限；确认账号资格与 API 权限后，只写入一篇 Article
   草稿供人工复核，再单独测试发布动作。
3. 微信：先探测账号能力和 IP 白名单，只向草稿箱写入一篇测试稿。
4. Medium：生成官方 Import 任务并记录人工完成。
5. 雪球：生成发布包，不进行自动化登录或发布。

每次真正向外部账号发内容前，都要在预览页进行动作级确认。

### Phase 4：排期、重试与观测

- 状态机、幂等键、指数退避、`needs_reconcile` 和全局 kill switch。
- 本机 `launchd` 调度；按需求再升级私有 worker。
- 日志只记录内容 hash、脱敏错误码、remote ID 和时间。
- Token 到期提醒、撤销 OAuth、密钥轮换和平台预算上限。

### Phase 5：多平台引流而非机械复制

- 首轮只选 8–12 篇常青高价值文章，不一次性倾倒 37 篇存量。
- 微信保留中文完整论证；雪球只选产业/资本/经济学相关内容。
- LinkedIn 使用英文专业洞见和关键图表；X 使用结论、3–6 条线程或少量精选 Article。
- Medium 用官方 Import 发布精选英文长文，并指向本站英文 canonical。
- 每个平台使用独立 CTA 与 UTM；canonical 本身保持干净。
- 中英文 RSS/Atom 与邮件订阅属于高优先级自有渠道，订阅者名单必须保持私有。

## 下一次需要的账号侧信息

在开始真实认证与发布试点前，需要在平台后台确认：

- “智药深瞳”的主体类型、认证状态、AppID、草稿/发布接口权限和 IP 白名单能力。
- LinkedIn 使用个人账号还是组织主页；首版推荐个人账号。
- X 开发者项目、付费计划与可接受的单次/月度预算。
- 是否仍持有 Medium 旧 integration token；即使持有，默认仍推荐官方 Import。
- 已发布的微信、LinkedIn、Medium、雪球文章清单或后台导出，以完成首次对账。

凭据本身不要粘贴进 Codex 对话或提交到仓库；授权应只在平台官方 OAuth 页面完成。
