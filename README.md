# dsh-chat-prompt-templates

Open-source dsh **web 客户端插件**：聊天下一条消息的「提示词模板选择器」。

## 交互模型（v0.2+）

- 点「提示词模板」→ 从模板列表选取（含外部预设：默认
  `http://127.0.0.1:3079/api/prompt-presets`，即 launcher#help 提供的 launcher
  预设；不可达时忽略）。
- **无独立编辑区**：聊天框就是参数编辑器。
  - 点栈行里的某个参数 → 聊天框内容切为该参数当前值并聚焦；
  - 之后在聊天框输入/修改的内容即该参数的值（实时回写）。
- 显示层面：**一个模板栈一行**，行内是该栈各参数及其控件：
  - 点参数本体 = 聚焦（聊天框切到它）；
  - 「预览」= 该参数/该层内容；
  - 「嵌套」= 用另一个模板（树，可多层）填充该参数；
  - 「✕」= 清空。
- 「预览全文」modal 查看组合后的完整提示词；「应用到聊天框」把组合全文
  setDraft 为下一条消息草稿。
- 面包屑 = 根 → 当前节点的路径（每层都可点/预览）。

## 模板来源

1. 内置：`custom-single`（单参数，直接沿用聊天框）。
2. 外部预设源（默认 3079 的 `/api/prompt-presets`）；可用 localStorage key
   `dsh-chat-prompt-templates:presetUrls` 覆盖来源列表。launcher 预设经此源注入
   = 设计里的 `launcher#help/prompt` 适配器。

## 挂载（profile 组合示例：web-personal-B 聊天页）

依赖：
```json
{ "dependencies": { "dsh-chat-prompt-templates": "github:laituli/dsh-chat-prompt-templates#last_release" } }
```
行（profile 的 `cordis.patch.yml` insert；**不要**加进 `dsh.profile.bundles`——
bundles 要求包声明 `dsh.bundle`）：
```yaml
- insert:
    - id: prompt-templates
      name: dsh-chat-prompt-templates
      config: {}
```
客户端注册到会话槽位 `conversation.input.dock`（list/session；register 需
`options.id`），读取输入区 owner 快照 `props.input.draft` 做实时回写；**不 shadow
root**，不干扰聊天其它座位。

## 开发

```bash
pnpm install
pnpm run typecheck
pnpm run build   # tsdown → lib/client.js (__ModuleLoader__)
```
集成要点备忘：
- client 模块必须 `export const inject = ['slots']`（否则 loader 报
  "cannot get property slots without inject"）。
- host 模块（lib/index.js）**不要**导出空 `Config`（cordis 会把它当 Standard
  Schema 调用 `.validate` 而崩溃）。
