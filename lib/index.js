// Host loader entry (no-op): this package's value lives in its web client row
// (window.__ModuleLoader__ factory in ./client.js). Cordis imports this module
// when the profile mounts the `dsh-chat-prompt-templates` row.
export const name = 'dsh-chat-prompt-templates'

export const Config = {}

export function apply() {
  // client 行在浏览器侧注册 `conversation.input.dock`；host 侧无需行为。
}
