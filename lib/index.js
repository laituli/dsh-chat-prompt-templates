// Host loader entry (no-op): this package's value lives in its web client row
// (window.__ModuleLoader__ factory in ./client.js). Cordis imports this module
// when the profile mounts the `dsh-chat-prompt-templates` row.
export const name = 'dsh-chat-prompt-templates'

// NOTE: deliberately NO `Config` export — cordis treats a truthy Config as a
// Standard Schema and would call Config['~standard'].validate(...) on it.

export function apply() {
  // client 行在浏览器侧注册 `conversation.input.dock`；host 侧无需行为。
}
