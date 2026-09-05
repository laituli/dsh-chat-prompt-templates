# dsh-chat-prompt-templates

Open-source dsh **web 客户端插件**：聊天下一条消息的「提示词模板选择器」。

## 功能（对应设计裁决）

- 点击入口 → 从**模板列表**选择模板；下一轮聊天框内的提示词被模板提示词替换。
- 模板 = 文本 + 参数。参数可**自由输入**，也可“**从提示词模板选**”——嵌套、
  可多层（树形）。
- 聊天框上方呈现**模板栈/面包屑**：每层 = 模板名 + 参数名。树形模板下，栈 =
  根到**当前聚焦参数**的路径；点其它参数即换栈；每层可点击进入/预览。
- **modal 完整预览**：应用前看整条组合结果，modal 里仍可改，再「应用」。
- 应用路径 = `inputActions.setDraft(fullText)`（替换下一轮草稿，用户自行发送）。

## 模板来源

1. 内置：`custom-single`（默认单参数模板，直接沿用聊天框）。
2. **外部预设**：默认拉取 `http://127.0.0.1:3079/api/prompt-presets`（即
   `launcher#help` 子插件提供的 launcher 预设：开发个人级 profile/插件 → 阅读
   3079:api/help）。源不可达（未装 help / 未启动）时静默忽略；可经
   localStorage key `dsh-chat-prompt-templates:presetUrls` 覆盖来源列表。
   launcher 预设经此源注入 = 设计里的 `launcher#help/prompt` 适配器（无需在
   本包内硬编码 launcher 文案）。

## 挂载（profile 组合示例：web-personal-B 聊天页）

profile `~/.dsh/profiles/<name>/cordis.patch.yml` 追加行：

```yaml
- insert:
    - id: prompt-templates
      name: dsh-chat-prompt-templates
```

manifest 依赖（个人 profile 用 github 依赖）：

```json
{ "dependencies": { "dsh-chat-prompt-templates": "github:laituli/dsh-chat-prompt-templates#last_release" } }
```

客户端行注册到会话槽位 `conversation.input.dock`（list/session），通过会话标准
套件拿到 `useInput`/`inputActions` —— 不 shadow root，不干扰聊天界面其它座位。

## 开发

```bash
pnpm install
pnpm run typecheck
pnpm run build   # tsdown → lib/client.js (__ModuleLoader__)
```
