# dsh-chat-prompt-templates

Open-source dsh **web 客户端插件**：聊天下一条消息的「提示词模板选择器」。

## 交互模型（v0.3）

- **默认根节点** = 标准模板 `{{prompt}}`（预载；可「换根模板」改，外部预设经
  `http://127.0.0.1:3079/api/prompt-presets` 注入，即 launcher#help 预设）。
- **每个模板元素一行**：行 = 一个实例化模板节点；嵌套子模板出现在其下一行
  （缩进）。行内是该元素各参数的控件：点参数本体 = 聚焦（聊天框切到该参数值、
  实时回写）、预览、嵌套、清空/解套；行级「预览」看该元素组合内容。
- **无独立编辑区、无“应用到聊天框”**：聊天框只是编写参数内容的输入面。
  - 点参数 → 聊天框显示该参数值并聚焦；输入即回写该参数。
  - 未聚焦参数时聊天框显示整树组合文本。
- **提交即交付整树结果**：发送（按钮或回车）时，插件先把「根节点组合文本」
  （= 根预览内容）替换进草稿再提交——聊天框本身不是交付物。整树顶部常驻
  「预览（根）」可随时核对最终交付内容。

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
