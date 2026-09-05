/**
 * dsh-chat-prompt-templates — open-source web client plugin（v0.2 交互重构）。
 *
 * 交互模型（用户裁决 + 本次修正）：
 * - 点「提示词模板」→ 列表选模板（含外部预设，默认 http://127.0.0.1:3079/api/prompt-presets）。
 * - **不设独立编辑区**：聊天框就是参数编辑器。点栈中的某个参数 → 聊天框内容
 *   切换为该参数当前值并聚焦；此后你在聊天框里输入/修改的就是该参数的值。
 * - 显示层面：**一个模板栈一行**，行内含每个参数的控件（选中/预览/嵌套/清除）；
 *   想看某参数或某行的完整内容 → 点它的「预览」；点参数本体 = 聚焦（聊天框内容切到它）。
 * - 「预览全文」modal 查看组合后的完整提示词；「应用到聊天框」把组合结果 setDraft。
 * - 树形嵌套：参数可选子模板（递归同规则）；面包屑即 根→当前节点路径。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
    description: '只有一个文本参数：直接在聊天框里描述您想要构建的内容。',
    text: '{{prompt}}',
    params: [{ name: 'prompt', label: '内容', example: '' }],
  },
]

const DEFAULT_PRESET_URLS = ['http://127.0.0.1:3079/api/prompt-presets']
const STORAGE_PRESET_URLS = 'dsh-chat-prompt-templates:presetUrls'

function defaultValues(tpl: PromptTemplate): Record<string, ParamValue> {
  const values: Record<string, ParamValue> = {}
  for (const p of tpl.params ?? []) values[p.name] = { kind: 'text', text: '' }
  return values
}

/** 深度组合：把节点文本里的 {{param}} 替换为值（文本或子模板组合文本）。 */
function composeNode(node: { tpl: PromptTemplate; values: Record<string, ParamValue> }): string {
  const text = node.tpl.text ?? ''
  const resolved = new Map<string, string>()
  const resolve = (name: string): string => {
    if (resolved.has(name)) return resolved.get(name)!
    const val = node.values[name]
    if (!val) return ''
    const out = val.kind === 'text' ? val.text : composeNode({ tpl: val.tpl, values: val.values })
    resolved.set(name, out)
    return out
  }
  return text.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_all, name: string) => resolve(name))
}

const CSS = `
.pt-bar { display:flex; align-items:center; gap:6px; padding:3px 8px; font-size:12px; color:#c9d1d9; flex-wrap:wrap; min-height:28px; }
.pt-chip { border:1px solid rgba(127,127,127,.35); background:#21262d; color:#c9d1d9; border-radius:12px; padding:1px 9px; font-size:11.5px; cursor:pointer; }
.pt-chip:hover { background:#2a303a; }
.pt-chip.on { border-color:#58a6ff; background:rgba(88,166,255,.12); }
.pt-line { display:inline-flex; align-items:center; gap:4px; flex-wrap:wrap; font-size:11px; }
.pt-line .sep { color:#484f58; }
.pt-crumb { cursor:pointer; padding:1px 6px; border-radius:8px; background:#161b22; border:1px solid #30363d; color:#8b949e; }
.pt-crumb.cur { color:#e6edf3; border-color:#2ea043; background:rgba(46,160,67,.1); }
.pt-param { display:inline-flex; align-items:center; gap:3px; border:1px solid #30363d; background:#10151b; border-radius:10px; padding:1px 6px; font-size:11px; }
.pt-param.focus { border-color:#2ea043; background:rgba(46,160,67,.12); }
.pt-param .lb { cursor:pointer; color:#c9d1d9; }
.pt-param .lb:hover { text-decoration:underline; }
.pt-param .val { color:#8b949e; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pt-btn { border:1px solid #3b4454; background:transparent; color:#d1d5db; border-radius:6px; padding:0 7px; font-size:11px; cursor:pointer; }
.pt-btn:hover { background:#21262d; }
.pt-btn.pri { background:#3b82f6; border-color:transparent; color:#fff; }
.pt-btn.warn { color:#e3b341; }
.pt-edit-hint { color:#7ee787; font-size:11px; }
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
`

/** 会话输入区槽位的 owner 共享 + 会话标准套件（结构最小化，不做跨包值导入）。 */
interface SeatProps {
  useInput?: (() => { draft?: string } | null | undefined) | undefined
  inputActions?: { setDraft(text: string): void; submit?(): void }
}

const childPathOf = (at: string, param: string): string => `${at}:${param}`

function PromptRoot(props: SeatProps) {
  const [library, setLibrary] = useState<PromptTemplate[]>(BUILTIN)
  const [presetUrls] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_PRESET_URLS)
      return raw ? (JSON.parse(raw) as string[]) : DEFAULT_PRESET_URLS
    } catch {
      return DEFAULT_PRESET_URLS
    }
  })
  const [tree, setTree] = useState<Tree | null>(null)
  const [viewPath, setViewPath] = useState('root')
  const [editing, setEditing] = useState<{ path: string; param: string } | null>(null)
  const [pickerFor, setPickerFor] = useState<{ at: string; param: string } | null>(null)
  const [rootPickerOpen, setRootPickerOpen] = useState(false)
  const [preview, setPreview] = useState<{ title: string; text: string } | null>(null)
  const [note, setNote] = useState('')
  const lastSync = useRef('')
  const actions = props.inputActions
  const useSnapshot = props.useInput ?? (() => null)

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

  const instantiate = useCallback((tpl: PromptTemplate): { tpl: PromptTemplate; values: Record<string, ParamValue> } => {
    return { tpl, values: defaultValues(tpl) }
  }, [])

  const chooseRoot = useCallback(
    (tpl: PromptTemplate) => {
      const next: Tree = new Map()
      next.set('root', instantiate(tpl))
      setTree(next)
      setViewPath('root')
      setEditing(null)
      setRootPickerOpen(false)
      setPickerFor(null)
      setNote(`已选模板「${tpl.title}」——点行内参数=用聊天框编辑它；点「应用到聊天框」组合全文`)
    },
    [instantiate],
  )

  /** 参数设为嵌套模板实例（childPath = at:param 的新节点），并切到该子节点。 */
  const setParamTpl = useCallback(
    (at: string, param: string, tpl: PromptTemplate) => {
      setTree((prev) => {
        if (!prev) return prev
        const next = new Map(prev)
        const n = next.get(at)
        if (!n) return prev
        const child = instantiate(tpl)
        next.set(childPathOf(at, param), child)
        next.set(at, { tpl: n.tpl, values: { ...n.values, [param]: { kind: 'tpl', tpl: child.tpl, values: child.values } } })
        return next
      })
      setViewPath(childPathOf(at, param))
      setEditing(null)
      setPickerFor(null)
      setNote(`参数「${param}」使用了子模板「${tpl.title}」——继续编辑它的参数`)
    },
    [instantiate],
  )

  const setParamText = useCallback((at: string, param: string, text: string) => {
    setTree((prev) => {
      if (!prev) return prev
      const n = prev.get(at)
      if (!n) return prev
      const next = new Map(prev)
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
    if (editing?.path === at && editing?.param === param) setEditing(null)
  }, [editing])

  const clearAll = useCallback(() => {
    setTree(null)
    setViewPath('root')
    setEditing(null)
    setPickerFor(null)
    setPreview(null)
    setNote('已清除模板（手输模式）')
  }, [])

  const nodeAt = useCallback((path: string) => (tree ? (tree.get(path) ?? null) : null), [tree])
  const root = nodeAt('root')
  const viewNode = nodeAt(viewPath)
  const paramList = useMemo(() => {
    if (!viewNode) return []
    const tpl = viewNode.tpl
    const names = new Set<string>()
    const re = /\{\{\s*([\w-]+)\s*\}\}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(tpl.text ?? '')) !== null) names.add(m[1])
    const ordered = (tpl.params ?? []).filter((p) => names.has(p.name) || !tpl.text.includes('{{'))
    const extra = [...names].filter((nm) => !(tpl.params ?? []).some((p) => p.name === nm)).map((nm) => ({ name: nm, label: nm }))
    return [...ordered, ...extra]
  }, [viewNode])

  const fullText = useMemo(() => (root ? composeNode(root) : ''), [root])

  // 面包屑 = 根→当前节点路径。
  const breadcrumb = useMemo(() => {
    if (!tree) return []
    const parts: { path: string; tpl: PromptTemplate; via?: string }[] = []
    let cur = 'root'
    const n0 = tree.get(cur)
    if (!n0) return []
    parts.push({ path: cur, tpl: n0.tpl })
    while (cur !== viewPath) {
      const rest = viewPath.slice(cur.length + 1)
      const idx = rest.indexOf(':')
      const stepParam = idx < 0 ? rest : rest.slice(0, idx)
      const child = childPathOf(cur, stepParam)
      const n = tree.get(child)
      if (!n) break
      parts.push({ path: child, tpl: n.tpl, via: stepParam })
      cur = child
    }
    return parts
  }, [tree, viewPath])

  // 聚焦参数：点击参数本体 → 把聊天框内容切为该参数当前值。
  const focusParam = useCallback(
    (path: string, param: string) => {
      const n = nodeAt(path)
      if (!n) return
      const val = n.values[param]
      if (!val || val.kind === 'text') {
        const text = val?.kind === 'text' ? val.text : ''
        setEditing({ path, param })
        lastSync.current = text
        actions?.setDraft(text)
        setNote(`正在编辑参数「${param}」：直接在聊天框输入即可（即改即存）`)
      } else {
        // 子模板：切到其节点编辑参数。
        setViewPath(childPathOf(path, param))
        setEditing(null)
      }
    },
    [nodeAt, actions],
  )

  // 聊天框即参数编辑器：把输入的变化实时写回被聚焦的参数。
  const snapshotDraft = useSnapshot()?.draft
  useEffect(() => {
    if (!editing) return
    if (typeof snapshotDraft !== 'string') return
    if (snapshotDraft === lastSync.current) return
    lastSync.current = snapshotDraft
    setParamText(editing.path, editing.param, snapshotDraft)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotDraft, editing])

  const previewParam = useCallback(
    (path: string, param: string) => {
      const n = nodeAt(path)
      if (!n) return
      const val = n.values[param]
      const text = !val ? '' : val.kind === 'text' ? val.text : composeNode({ tpl: val.tpl, values: val.values })
      setPreview({ title: `参数预览：${param}`, text })
    },
    [nodeAt],
  )

  const applyToChat = useCallback(() => {
    if (!root) return
    actions?.setDraft(fullText)
    setNote(`已把组合后的完整提示词放到聊天框（长度 ${fullText.length}），可直接发送；需要改参数就点栈里的参数`)
    setPreview(null)
  }, [root, fullText, actions])

  const valBadge = (val: ParamValue | undefined): string => {
    if (!val) return ''
    if (val.kind === 'text') {
      const t = val.text.replace(/\s+/g, ' ')
      return t.length > 24 ? `${t.slice(0, 24)}…` : t
    }
    return `子模板:${val.tpl.title}`
  }

  const pickList = (onPick: (t: PromptTemplate) => void) => (
    <div className="pt-pick" style={{ maxWidth: 480 }}>
      <h4>选择提示词模板（参数可再嵌套模板）</h4>
      {library.map((t) => (
        <button key={t.id} className="pt-opt" onClick={() => onPick(t)}>
          <b>{t.title}</b>
          {t.description ? <small> — {t.description}</small> : null}
        </button>
      ))}
      {note && <div className="pt-meta" style={{ color: '#8b949e', fontSize: 11, padding: '4px 6px 0' }}>{note}</div>}
    </div>
  )

  return (
    <>
      <div className="pt-bar">
        {!root ? (
          <>
            <button className="pt-chip on" onClick={() => setRootPickerOpen((v) => !v)}>提示词模板</button>
            <span style={{ color: '#8b949e', fontSize: 11 }}>下一轮提示词从模板替换：参数直接用聊天框编辑，可嵌套模板，可预览后应用</span>
          </>
        ) : (
          <>
            <button className="pt-chip on" onClick={() => setRootPickerOpen((v) => !v)}>换模板</button>
            {breadcrumb.map((b, i) => (
              <span key={b.path} className="pt-line">
                {i > 0 && <span className="sep">›</span>}
                <span className={`pt-crumb${b.path === viewPath ? ' cur' : ''}`} title={b.tpl.description ?? ''} onClick={() => { setViewPath(b.path); setEditing(null) }}>
                  {b.tpl.title}{b.via ? ` @${b.via}` : ''}
                </span>
                <button className="pt-btn" title="预览本层内容" onClick={() => setPreview({ title: `模板内容：${b.tpl.title}`, text: b.tpl.text ?? '' })}>预览</button>
              </span>
            ))}
            <span className="sep" style={{ color: '#30363d' }}>|</span>
            {paramList.map((p) => {
              const val = viewNode?.values[p.name]
              const isEdit = editing?.path === viewPath && editing?.param === p.name
              return (
                <span key={p.name} className={`pt-param${isEdit ? ' focus' : ''}`}>
                  <span className="lb" title="点击：聊天框切到该参数进行编辑" onClick={() => focusParam(viewPath, p.name)}>{p.label || p.name}</span>
                  <span className="val">{valBadge(val)}</span>
                  <button className="pt-btn" title="预览该参数内容" onClick={() => previewParam(viewPath, p.name)}>预览</button>
                  <button className="pt-btn warn" title="用嵌套模板填充该参数" onClick={() => setPickerFor({ at: viewPath, param: p.name })}>嵌套</button>
                  {val && (val.kind === 'text' ? val.text !== '' : true) && (
                    <button className="pt-btn" title="清空该参数" onClick={() => clearParam(viewPath, p.name)}>✕</button>
                  )}
                </span>
              )
            })}
            <span style={{ flex: 1 }} />
            {editing && <span className="pt-edit-hint">正在聊天框编辑参数「{editing.param}」</span>}
            <button className="pt-btn" onClick={() => setPreview({ title: '提示词完整预览', text: fullText })}>预览全文</button>
            <button className="pt-btn pri" onClick={applyToChat}>应用到聊天框</button>
            <button className="pt-btn" onClick={clearAll}>清空模板</button>
          </>
        )}
      </div>
      {pickerFor && pickList((t) => setParamTpl(pickerFor.at, pickerFor.param, t))}
      {rootPickerOpen && pickList(chooseRoot)}
      {preview !== null && (
        <div className="pt-modal-back" onClick={() => setPreview(null)}>
          <div className="pt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{preview.title}</h3>
            <pre>{preview.text || '（空）'}</pre>
            <div className="foot">
              <button className="pt-btn" onClick={() => setPreview(null)}>关闭</button>
              {preview.title.startsWith('提示词完整预览') && (
                <button className="pt-btn pri" onClick={applyToChat}>应用(替换输入框草稿)</button>
              )}
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
    register(opts: { name: string; id?: string; registrant: string; priority?: number }, comp: (props: SeatProps) => unknown): unknown
  }
  effect(fn: () => (() => void) | void, label?: string): unknown
}

export function apply(ctx: ClientLike): void {
  ctx.effect(() => installStyles(), 'dsh-chat-prompt-templates: inline styles')
  ctx.slots.register(
    { name: 'conversation.input.dock', id: name, registrant: name, priority: 10 },
    (props: SeatProps) => <PromptRoot {...props} />,
  )
}
