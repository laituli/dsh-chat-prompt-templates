# dsh-chat-prompt-templates

Open-source dsh **web 客户端插件**：聊天下一条消息的「提示词模板选择器」。

## 交互模型（v0.7）

- **模板插件定位**：只建立合适的提示词、辅助人描述需求；执行（如创建 profile/
  插件）由 agent 完成（launcher 提供确定型能力：registry/declare/API/skill）。
- **无全局工具条**：每行 = 左边模板标题、中间参数、右侧控件。
- **每个节点都可选 栈/树 模式**（默认栈，逐节点独立）：
  - 栈 = 只显示 聚焦节点→根 的路径；
  - 树 = 展开该节点整棵子树（行多时容器可滚动）。
  - 有嵌套子模板的行右侧才有 栈/树 切换。
- 行右控件：👁 行预览（顶行=整树交付内容预览）、▦ 修改模板；顶行另有 ⟲ 重置
  为默认 `{{prompt}}`。图标统一（👁/▦/↩/✕/⟲），无差异化配色。
- **默认根节点** = 标准模板 `{{prompt}}`；内置含「拼接两段」（两段按序拼接可
  嵌套）与 launcher 预设（3079 `/api/prompt-presets` 注入，描述需求后 agent
  执行）。
- **解套语义**：把子模板解套前预览到的组合内容赋值给该参数并改回文本。
- **无独立编辑区、无“应用到聊天框”**：聊天框=参数编辑输入面（实时回写被聚焦
  参数）；提交（发送/回车）交付整树根组合文本。

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
