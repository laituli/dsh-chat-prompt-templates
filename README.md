# dsh-chat-prompt-templates

Open-source dsh **web 客户端插件**：聊天下一条消息的「提示词模板选择器」。

## 交互模型（v0.4）

- **模板插件定位**：只负责建立合适的提示词、辅助人描述需求；执行（如创建
  profile/插件）由 agent 完成（launcher 提供确定型能力：registry/declare/API/skill）。
- **默认根节点** = 标准模板 `{{prompt}}`（预载，可修改）。
- **不特化显示“根”**：最上面的模板就是根模板，正常修改即可——每行的
  「预览」按钮旁即「修改模板」。
- **按钮 icon-only**（预览 ◉ / 修改模板 ⇄ / 嵌套 ⊞ / 解套 ↩ / 清空 ✕ / 重置 ⟲），
  悬停 title 说明。
- **每个模板元素一行**：行 = 实例化模板节点；嵌套子模板在其下一行（缩进）。
- **聚焦节点父参数高亮**：当前参数高亮（focus）；沿路径的祖先行“经由参数”一并
  高亮（anc），点击可回上级。
- **无独立编辑区、无“应用到聊天框”**：聊天框=参数编辑输入面；提交（发送/回车）
  交付的是整树根组合文本（= 根预览）；常驻「预览 ◉」核对交付内容。
- 外部预设：默认 `http://127.0.0.1:3079/api/prompt-presets`（launcher#help 的
  launcher 预设：描述需求后由 agent 读 skill/API 执行）。

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
