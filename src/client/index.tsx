/**
 * dsh-chat-prompt-templates — open-source web client plugin.
 *
 * 交互模型（用户裁决版）：
 * - 点击入口后从模板列表选取模板；下一轮聊天框内的提示词被模板提示词替换。
 * - 模板 = 文本 + 参数；参数可自由输入，也可“从提示词模板选”（树形、可多层）。
 * - 聊天框上方呈现“模板栈”：每层显示 模板名 + 参数名。树形模板下，前端看到的
 *   栈 = 根节点到当前聚焦参数的路径；切换聚焦参数即换栈；每层都可预览。
 * - 最终组合输入提供完整预览（modal）后才可应用（替换草稿）。
 * - 外部预设：从配置的预设源 GET 拉取合并（默认 http://127.0.0.1:3079/api/prompt-presets，
 *   即 launcher#help 提供的预设）；源不可达时忽略（只保留内置模板）。
 *
 * 挂载：注册到会话输入区槽位 `conversation.input.dock`（list，session 作用域），
 * 通过会话标准套件拿到 inputActions.setDraft() 应用结果。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'

export const name = 'dsh-chat-prompt-templates'

/** client 侧注入：slots（槽位服务，client runtime 提供）。 */
export const inject = ['slots']

/** 注册进本插件的模板（内部或外部预设）。 */
interface PromptParam { name: string; label: string; example?: string }
interface PromptTemplate {
  id: string
  title: string
  description?: string
  text: string
  params?: PromptParam[]
}

/** 参数取值：自由文本，或嵌套模板实例（其自身参数再取值）。 */
type ParamValue =
  | { kind: 'text'; text: string }
  | { kind: 'tpl'; tpl: PromptTemplate; values: Record<string, ParamValue> }

/** 一棵实例化模板树：path 形如 'root' | 'root:gen' | 'root:gen:api'… */
type Tree = Map<string, { tpl: PromptTemplate; values: Record<string, ParamValue> }>

const BUILTIN: PromptTemplate[] = [
  {
    id: 'custom-single',
    title: '自定义（单个参数）',
    description: '默认模板：只有一个文本参数，直接沿用聊天框。',
    text: '{{prompt}}',
    params: [{ name: 'prompt', label: '内容', example: '帮我做…' }],
  },
]

const DEFAULT_PRESET_URLS = ['http://127.0.0.1:3079/api/prompt-presets']
const STORAGE_PRESET_URLS = 'dsh-chat-prompt-templates:presetUrls'

function paramNames(tpl: PromptTemplate): string[] {
  const names = new Set<string>()
  const re = /\{\{\s*([\w-]+)\s*\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(tpl.text)) !== null) names.add(m[1])
  return [...names]
}

/** 深度组合：把节点文本里的 {{param}} 替换为其值（文本或子模板组合文本）。 */
function composeNode(node: { tpl: PromptTemplate; values: Record<string, ParamValue> }): string {
  const text = node.tpl.text ?? ''
  const seen = new Set<string>()
  const resolved = new Map<string, string>()
  const resolve = (name: string): string => {
    if (resolved.has(name)) return resolved.get(name)!
    const val = node.values[name]
    if (!val) return ''
    if (seen.has(name)) return ''
    seen.add(name)
    const out = val.kind === 'text' ? val.text : composeNode({ tpl: val.tpl, values: val.values })
    resolved.set(name, out)
    return out
  }
  return text.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_all, name: string) => resolve(name))
}

function defaultValues(tpl: PromptTemplate): Record<string, ParamValue> {
  const values: Record<string, ParamValue> = {}
  for (const p of tpl.params ?? []) values[p.name] = { kind: 'text', text: p.example ?? '' }
  return values
}

function placeholders(tpl: PromptTemplate): string[] {
  const names = paramNames(tpl)
  return names.length ? names : (tpl.params ?? []).map((p) => p.name)
}

const CSS = `
.pt-bar { display:flex; align-items:center; gap:8px; padding:4px 8px; font-size:12px; color:#c9d1d9; flex-wrap:wrap; }
.pt-chip { border:1px solid rgba(127,127,127,.35); background:#21262d; color:#c9d1d9; border-radius:12px; padding:2px 10px; font-size:11.5px; cursor:pointer; }
.pt-chip:hover { background:#2a303a; }
.pt-chip.on { border-color:#58a6ff; background:rgba(88,166,255,.12); }
.pt-stack { display:inline-flex; gap:4px; align-items:center; flex-wrap:wrap; font-size:11px; }
.pt-stack .sep { color:#484f58; }
.pt-bread { cursor:pointer; padding:1px 6px; border-radius:8px; background:#161b22; border:1px solid #30363d; color:#8b949e; }
.pt-bread.cur { color:#e6edf3; border-color:#2ea043; background:rgba(46,160,67,.1); }
.pt-btn { border:1px solid #3b4454; background:transparent; color:#d1d5db; border-radius:6px; padding:1px 8px; font-size:11.5px; cursor:pointer; }
.pt-btn:hover { background:#21262d; }
.pt-btn.pri { background:#3b82f6; border-color:transparent; color:#fff; }
.pt-panel { border-top:1px dashed #30363d; padding:6px 10px; background:#0f141a; font-size:12px; color:#c9d1d9; display:flex; flex-direction:column; gap:6px; }
.pt-row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.pt-meta { color:#8b949e; font-size:11.5px; }
.pt-pick { position:fixed; z-index:60; max-height:55vh; overflow:auto; background:#161b22; border:1px solid #30363d; border-radius:8px; padding:6px; box-shadow:0 8px 28px rgba(0,0,0,.5); min-width:340px; }
.pt-pick h4 { margin:2px 4px 6px; font-size:11px; color:#8b949e; }
.pt-opt { display:block; width:100%; text-align:left; background:transparent; border:0; color:#c9d1d9; padding:5px 8px; border-radius:6px; cursor:pointer; font-size:12px; }
.pt-opt:hover { background:#21262d; }
.pt-opt small { color:#8b949e; }
.pt-modal-back { position:fixed; inset:0; background:rgba(1,4,9,.62); z-index:70; display:flex; align-items:center; justify-content:center; }
.pt-modal { background:#0d1117; border:1px solid #30363d; border-radius:10px; max-width:720px; width:92%; max-height:80vh; display:flex; flex-direction:column; }
.pt-modal h3 { margin:0; padding:10px 14px; font-size:13px; color:#e6edf3; border-bottom:1px solid #21262d; }
.pt-modal pre { margin:0; padding:14px; overflow:auto; white-space:pre-wrap; word-break:break-word; font:12px/1.6 ui-monospace, monospace; color:#c9d1d9; flex:1; }
.pt-modal .foot { padding:8px 14px; border-top:1px solid #21262d; display:flex; gap:8px; justify-content:flex-end; }
.pt-in { background:#21262d; border:1px solid #30363d; color:inherit; border-radius:6px; padding:2px 7px; font-size:12px; min-width:160px; }
`

/** 会话输入区槽位的 owner 共享 + 会话标准套件（结构最小化，不做跨包值导入）。 */
interface SeatProps {
  useInput?: unknown
  inputActions?: { setDraft(text: string): void; submit?(): void }
}

function PromptRoot(props: SeatProps) {
  const [library, setLibrary] = useState<PromptTemplate[]>(BUILTIN)
  const [presetUrls, setPresetUrls] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_PRESET_URLS)
      return raw ? (JSON.parse(raw) as string[]) : DEFAULT_PRESET_URLS
    } catch {
      return DEFAULT_PRESET_URLS
    }
  })
  const [tree, setTree] = useState<Tree | null>(null)
  const [rootPath, setRootPath] = useState<string | null>(null)
  const [focusPath, setFocusPath] = useState<string>('root')
  const [pickerFor, setPickerFor] = useState<{ at: string; param: string } | null>(null)
  const [rootPickerOpen, setRootPickerOpen] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [note, setNote] = useState('')

  // 拉取外部预设（默认 launcher#help 的 /api/prompt-presets；不可达忽略）。
  useEffect(() => {
    let alive = true
    void (async () => {
      for (const url of presetUrls) {
        try {
          const res = await fetch(url, { headers: { accept: 'application/json' } })
          if (!res.ok) continue
          const doc = (await res.json()) as { ok?: boolean; value?: { presets?: PromptTemplate[] } }
          const presets = doc.value?.presets
          if (Array.isArray(presets) && presets.length) {
            if (alive) {
              setLibrary((prev) => {
                const ids = new Set(prev.map((t) => t.id))
                const fresh = presets.filter((t) => t && t.id && !ids.has(t.id))
                return fresh.length ? [...prev, ...fresh] : prev
              })
              setNote(`已载入预设源 ${url}（${presets.length} 条）`)
            }
          }
        } catch {
          /* 源不可达（未装 help / launcher 未启动）：忽略 */
        }
      }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const nodeAt = useCallback(
    (path: string): { tpl: PromptTemplate; values: Record<string, ParamValue> } | null => {
      if (!tree) return null
      const n = tree.get(path)
      return n ?? null
    },
    [tree],
  )

  const childPathOf = (at: string, param: string): string => `${at}:${param}`

  const instantiate = useCallback((tpl: PromptTemplate): { tpl: PromptTemplate; values: Record<string, ParamValue> } => {
    return { tpl, values: defaultValues(tpl) }
  }, [])

  const chooseRoot = useCallback(
    (tpl: PromptTemplate) => {
      const next: Tree = new Map()
      next.set('root', instantiate(tpl))
      setTree(next)
      setRootPath('root')
      setFocusPath('root')
      setRootPickerOpen(false)
      setNote(`已选模板：${tpl.title} —— 填好参数后可「预览」再「应用到输入框」`)
    },
    [instantiate],
  )

  /** 把 at 节点某参数设为嵌套模板实例（childPath = at:param 的新节点）。 */
  const setParamTpl = useCallback(
    (at: string, param: string, tpl: PromptTemplate) => {
      setTree((prev) => {
        if (!prev) return prev
        const next = new Map(prev)
        const n = next.get(at)
        if (!n) return prev
        const copy: { tpl: PromptTemplate; values: Record<string, ParamValue> } = { tpl: n.tpl, values: { ...n.values } }
        const child = instantiate(tpl)
        next.set(childPathOf(at, param), child)
        copy.values[param] = { kind: 'tpl', tpl: child.tpl, values: child.values }
        next.set(at, copy)
        return next
      })
      setFocusPath(childPathOf(at, param))
      setPickerFor(null)
    },
    [instantiate],
  )

  const setParamText = useCallback((at: string, param: string, text: string) => {
    setTree((prev) => {
      if (!prev) return prev
      const next = new Map(prev)
      const n = next.get(at)
      if (!n) return prev
      next.set(at, { tpl: n.tpl, values: { ...n.values, [param]: { kind: 'text', text } } })
      return next
    })
  }, [])

  const clearParam = useCallback((at: string, param: string) => {
    setTree((prev) => {
      if (!prev) return prev
      const next = new Map(prev)
      const n = next.get(at)
      if (!n) return prev
      next.set(at, { tpl: n.tpl, values: { ...n.values, [param]: { kind: 'text', text: '' } } })
      next.delete(childPathOf(at, param))
      return next
    })
    setFocusPath(at)
  }, [])

  const root = tree ? (nodeAt('root') ?? null) : null
  const focusNode = tree ? (nodeAt(focusPath) ?? null) : null

  // 面包屑栈：从 root 到聚焦节点（每个非根层级 = 上一级某参数里选的子模板）。
  const breadcrumb = useMemo(() => {
    if (!tree || !rootPath) return []
    const parts: { path: string; tpl: PromptTemplate; via?: string }[] = []
    let cur = 'root'
    parts.push({ path: cur, tpl: tree.get(cur)!.tpl })
    while (cur !== focusPath) {
      const prefix = cur + ':'
      const rest = focusPath.slice(prefix.length)
      const idx = rest.indexOf(':')
      const stepParam = idx < 0 ? rest : rest.slice(0, idx)
      const child = childPathOf(cur, stepParam)
      const n = tree.get(child)
      if (!n) break
      parts.push({ path: child, tpl: n.tpl, via: stepParam })
      cur = child
    }
    return parts
  }, [tree, focusPath, rootPath])

  const fullText = useMemo(() => {
    if (!root) return ''
    return composeNode(root)
  }, [root])

  const apply = useCallback(() => {
    if (!root) return
    const actions = props.inputActions
    if (!actions) {
      setNote('未取得输入区 actions（当前界面无会话输入？）')
      return
    }
    actions.setDraft(fullText)
    setNote(`已应用到输入框（长度 ${fullText.length}）——可直接发送；用「清除模板」恢复手输`)
    setPreview(null)
  }, [root, fullText, props.inputActions])

  const clearAll = useCallback(() => {
    setTree(null)
    setRootPath(null)
    setFocusPath('root')
    setPreview(null)
    setPickerFor(null)
    setNote('已清除模板（手输模式）')
  }, [])

  const focusNodePathParams = focusNode ? placeholders(focusNode.tpl) : []
  const focusValues = focusNode?.values ?? {}

  const pickList = (
    onPick: (t: PromptTemplate) => void,
  ) => (
    <div className="pt-pick" style={{ maxWidth: 480 }}>
      <h4>选择提示词模板（可参数嵌套）</h4>
      {library.map((t) => (
        <button key={t.id} className="pt-opt" onClick={() => onPick(t)}>
          <b>{t.title}</b>
          {t.description ? <small> — {t.description}</small> : null}
        </button>
      ))}
      {note && <div className="pt-meta">{note}</div>}
    </div>
  )

  return (
    <>
      <div className="pt-bar">
        {!root ? (
          <>
            <button className="pt-chip on" onClick={() => setRootPickerOpen((v) => !v)}>提示词模板</button>
            <span className="pt-meta">下一轮提示词从模板替换；参数可嵌套模板（树），可预览后应用</span>
          </>
        ) : (
          <>
            <button className="pt-chip on" onClick={() => setRootPickerOpen((v) => !v)}>换模板</button>
            <span className="pt-stack">
              {breadcrumb.map((b, i) => (
                <span key={b.path} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  {i > 0 && <span className="sep">›</span>}
                  <span
                    className={`pt-bread${b.path === focusPath ? ' cur' : ''}`}
                    title={b.tpl.description ?? b.tpl.title}
                    onClick={() => setFocusPath(b.path)}
                  >
                    {b.tpl.title}
                    {b.via ? <em style={{ opacity: .7, marginLeft: 4 }}>@{b.via}</em> : null}
                  </span>
                </span>
              ))}
            </span>
            <span style={{ flex: 1 }} />
            <button className="pt-btn" onClick={() => setPreview(fullText)}>预览(modal)</button>
            <button className="pt-btn pri" onClick={apply}>应用到输入框</button>
            <button className="pt-btn" onClick={clearAll}>清除模板</button>
          </>
        )}
      </div>
      {root && focusNode && (
        <div className="pt-panel">
          <div className="pt-row">
            <b>{focusNode.tpl.title}</b>
            <span className="pt-meta">{focusNode.tpl.description ?? ''} 参数：{focusNodePathParams.length || 0}</span>
          </div>
          <div className="pt-meta" style={{ whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'auto' }}>{focusNode.tpl.text}</div>
          {(focusNode.tpl.params ?? []).map((p) => {
            const val = focusValues[p.name]
            return (
              <div key={p.name} className="pt-row">
                <label style={{ minWidth: 110, fontSize: 11, color: '#8b949e' }}>{p.label || p.name}</label>
                {!val || val.kind === 'text' ? (
                  <input
                    className="pt-in"
                    value={val?.kind === 'text' ? val.text : ''}
                    placeholder={p.example ?? `填 ${p.name}…`}
                    onChange={(e) => setParamText(focusPath, p.name, e.target.value)}
                  />
                ) : (
                  <span className="pt-meta">来自模板「{val.tpl.title}」</span>
                )}
                <button className="pt-btn" onClick={() => setPickerFor({ at: focusPath, param: p.name })}>
                  {val?.kind === 'tpl' ? '改子模板' : '选模板'}
                </button>
                {val && val.kind === 'tpl' && (
                  <button className="pt-btn" onClick={() => setFocusPath(childPathOf(focusPath, p.name))}>编辑子模板 ›</button>
                )}
                {val && (val.kind === 'text' ? val.text !== '' : true) && (
                  <button className="pt-btn" title="清空该参数" onClick={() => clearParam(focusPath, p.name)}>✕</button>
                )}
              </div>
            )
          })}
          {focusNodePathParams.length === 0 && <span className="pt-meta">（无参数）</span>}
        </div>
      )}
      {pickerFor && pickList((t) => setParamTpl(pickerFor.at, pickerFor.param, t))}
      {rootPickerOpen && pickList(chooseRoot)}
      {preview !== null && (
        <div className="pt-modal-back" onClick={() => setPreview(null)}>
          <div className="pt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>提示词完整预览（可编辑后应用）</h3>
            <textarea
              value={preview}
              onChange={(e) => setPreview(e.target.value)}
              spellCheck={false}
              style={{ flex: 1, margin: 0, padding: 14, background: '#0d1117', color: '#c9d1d9', border: 0, outline: 'none', font: '12px/1.6 ui-monospace, monospace', resize: 'none' }}
            />
            <div className="foot">
              <button className="pt-btn" onClick={() => setPreview(null)}>关闭</button>
              <button className="pt-btn pri" onClick={() => { setPreview(null); apply() }}>应用(替换输入框草稿)</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function installStyles(): () => void {
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-chat-prompt-templates'
  tag.textContent = CSS
  document.head.appendChild(tag)
  return () => { for (const el of document.querySelectorAll('style[data-plugin="dsh-chat-prompt-templates"]')) el.remove() }
}

interface ClientLike {
  slots: {
    register(opts: { name: string; registrant: string; priority?: number }, comp: (props: SeatProps) => unknown): unknown
  }
  effect(fn: () => (() => void) | void, label?: string): unknown
}

export function apply(ctx: ClientLike): void {
  ctx.effect(() => installStyles(), 'dsh-chat-prompt-templates: inline styles')
  ctx.slots.register(
    { name: 'conversation.input.dock', registrant: name, priority: 10 },
    (props: SeatProps) => <PromptRoot {...props} />,
  )
}
