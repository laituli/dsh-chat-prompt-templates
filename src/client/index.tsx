/**
 * dsh-chat-prompt-templates — open-source web client plugin（v0.3 布局/交付模型）。
 *
 * 交互模型（用户裁决累计）：
 * - **默认根节点** = 标准模板 `{{prompt}}`（单参数），已预载；可经「换模板」改根。
 * - **每个模板元素一行**（行 = 一个实例化模板节点；树形嵌套的子模板在其下一行，
 *   逐级缩进）。行内是该元素各参数的控件：点参数本体 = 聚焦（聊天框切到该参数
 *   值并实时回写）、预览、嵌套（换成子模板 → 出现在下一行）、清空。
 * - 行级控件：每一行有「预览」（该模板元素组合后的内容）。整树顶部有
 *   「预览（根）」显示最终交付内容。
 * - **无“应用到聊天框”**：聊天框只是用户编写参数内容的输入面；真正交付给 agent
 *   的内容 = 模板树根节点的组合文本。发送（按钮或回车）时插件先把该文本替换进
 *   草稿再提交——若正在编辑某个参数，回车/发送也会以整树组合结果提交。
 * - 外部预设：默认 http://127.0.0.1:3079/api/prompt-presets（launcher#help）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export const name = 'dsh-chat-prompt-templates'

/** client 侧注入：slots（槽位服务，client runtime 提供）。 */
export const inject = ['slots']

interface PromptParam { name: string; label: string; example?: string }
interface PromptTemplate {
  id: string
  title: string
  description?: string
  text: string
  params?: PromptParam[]
}

type ParamValue =
  | { kind: 'text'; text: string }
  | { kind: 'tpl'; tpl: PromptTemplate; values: Record<string, ParamValue> }

type Tree = Map<string, { tpl: PromptTemplate; values: Record<string, ParamValue> }>

const DEFAULT_ROOT: PromptTemplate = {
  id: 'custom-single',
  title: '标准模板',
  description: '{{prompt}} —— 直接在聊天框编写内容。',
  text: '{{prompt}}',
  params: [{ name: 'prompt', label: '内容' }],
}

const PRESETS: PromptTemplate[] = [
  DEFAULT_ROOT,
  {
    id: 'launcher-dev-profile',
    title: '开发/维护个人级 web profile 或插件',
    description: '让 agent 按 dsh-launcher-skill 流程，用“加 reg profile”模式开发或维护新的个人级 profile/插件。',
    text: '需要进行新的个人级 web profile/插件开发或维护，请阅读 http://127.0.0.1:3079/api/help （dsh-launcher-skill）。目标名称：{{name}}；基线 profile：{{baseline}}；相对基线的差异/目标服务说明：{{diff}}。请先按 skill 说明读架构与接口，再按“加 reg profile”流程给出可落地步骤并执行。',
    params: [
      { name: 'name', label: '新 profile 名称' },
      { name: 'baseline', label: '基线 profile' },
      { name: 'diff', label: '相对基线的差异' },
    ],
  },
]

const DEFAULT_PRESET_URLS = ['http://127.0.0.1:3079/api/prompt-presets']
const STORAGE_PRESET_URLS = 'dsh-chat-prompt-templates:presetUrls'

const childPathOf = (at: string, param: string): string => `${at}:${param}`

function defaultValues(tpl: PromptTemplate): Record<string, ParamValue> {
  const values: Record<string, ParamValue> = {}
  for (const p of tpl.params ?? []) values[p.name] = { kind: 'text', text: '' }
  return values
}

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
.pt-wrap { display:flex; flex-direction:column; gap:2px; padding:3px 8px 6px; }
.pt-tools { display:flex; align-items:center; gap:6px; font-size:11.5px; color:#8b949e; flex-wrap:wrap; }
.pt-chip { border:1px solid rgba(127,127,127,.35); background:#21262d; color:#c9d1d9; border-radius:12px; padding:1px 9px; font-size:11.5px; cursor:pointer; }
.pt-chip:hover { background:#2a303a; }
.pt-chip.on { border-color:#58a6ff; background:rgba(88,166,255,.12); }
.pt-elem { display:flex; align-items:center; gap:5px; flex-wrap:wrap; border:1px solid #23272f; background:#0f141a; border-radius:8px; padding:3px 8px; font-size:11.5px; }
.pt-elem.root { border-color:#2d333b; background:#131a21; }
.pt-elem .et { font-weight:600; color:#e6edf3; cursor:default; }
.pt-param { display:inline-flex; align-items:center; gap:3px; border:1px solid #30363d; background:#10151b; border-radius:10px; padding:1px 6px; font-size:11px; }
.pt-param.focus { border-color:#2ea043; background:rgba(46,160,67,.12); }
.pt-param .lb { cursor:pointer; color:#c9d1d9; }
.pt-param .lb:hover { text-decoration:underline; }
.pt-param .val { color:#8b949e; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pt-btn { border:1px solid #3b4454; background:transparent; color:#d1d5db; border-radius:6px; padding:0 7px; font-size:11px; cursor:pointer; }
.pt-btn:hover { background:#21262d; }
.pt-btn.warn { color:#e3b341; }
.pt-edit-hint { color:#7ee787; font-size:11px; }
.pt-pick { position:fixed; z-index:60; max-height:55vh; overflow:auto; background:#161b22; border:1px solid #30363d; border-radius:8px; padding:6px; box-shadow:0 8px 28px rgba(0,0,0,.5); min-width:360px; }
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

/** 输入区 owner 快照（草稿随输入由渲染器推送）。 */
interface SeatProps {
  input?: { draft?: string } | undefined
  inputActions?: { setDraft(text: string): void; submit?(): void }
}

/** 树节点 → 展示行（先序）。 */
interface Row { path: string; depth: number; node: { tpl: PromptTemplate; values: Record<string, ParamValue> } }

function PromptRoot(props: SeatProps) {
  const [library, setLibrary] = useState<PromptTemplate[]>(PRESETS)
  const [tree, setTree] = useState<Tree | null>(null)
  const [editing, setEditing] = useState<{ path: string; param: string } | null>(null)
  const [rootPickerOpen, setRootPickerOpen] = useState(false)
  const [pickerFor, setPickerFor] = useState<{ at: string; param: string } | null>(null)
  const [preview, setPreview] = useState<{ title: string; text: string } | null>(null)
  const [note, setNote] = useState('')
  const lastSync = useRef('')
  const actions = props.inputActions
  const snapshotDraft = props.input?.draft
  const origSubmitRef = useRef<(() => void) | null>(null)
  const wrappedRef = useRef(false)

  // 拉取外部预设（默认 launcher#help /api/prompt-presets；不可达忽略）。
  useEffect(() => {
    let alive = true
    void (async () => {
      let urls = DEFAULT_PRESET_URLS
      try {
        const raw = localStorage.getItem(STORAGE_PRESET_URLS)
        if (raw) urls = JSON.parse(raw) as string[]
      } catch { /* default */ }
      for (const url of urls) {
        try {
          const res = await fetch(url, { headers: { accept: 'application/json' } })
          if (!res.ok) continue
          const doc = (await res.json()) as { ok?: boolean; value?: { presets?: PromptTemplate[] } }
          const presets = doc.value?.presets
          if (Array.isArray(presets) && presets.length && alive) {
            setLibrary((prev) => {
              const ids = new Set(prev.map((t) => t.id))
              const fresh = presets.filter((t) => t && t.id && !ids.has(t.id))
              return fresh.length ? [...prev, ...fresh] : prev
            })
          }
        } catch { /* 源不可达忽略 */ }
      }
    })()
    return () => { alive = false }
  }, [])

  // 默认根节点：标准模板 {{prompt}}（可换）。
  useEffect(() => {
    const t = new Map<string, { tpl: PromptTemplate; values: Record<string, ParamValue> }>()
    t.set('root', { tpl: DEFAULT_ROOT, values: defaultValues(DEFAULT_ROOT) })
    setTree(t)
    setEditing({ path: 'root', param: 'prompt' })
  }, [])

  const instantiate = useCallback((tpl: PromptTemplate): { tpl: PromptTemplate; values: Record<string, ParamValue> } => {
    return { tpl, values: defaultValues(tpl) }
  }, [])

  const setParamText = useCallback((path: string, param: string, text: string) => {
    setTree((prev) => {
      if (!prev) return prev
      const n = prev.get(path)
      if (!n) return prev
      const next = new Map(prev)
      next.set(path, { tpl: n.tpl, values: { ...n.values, [param]: { kind: 'text', text } } })
      return next
    })
  }, [])

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
      setPickerFor(null)
      setNote(`参数「${param}」已使用子模板「${tpl.title}」（新行在下方）`)
    },
    [instantiate],
  )

  const setRoot = useCallback(
    (tpl: PromptTemplate) => {
      const t = new Map<string, { tpl: PromptTemplate; values: Record<string, ParamValue> }>()
      t.set('root', instantiate(tpl))
      setTree(t)
      setRootPickerOpen(false)
      const first = tpl.params?.[0]?.name
      if (first) setEditing({ path: 'root', param: first })
      else setEditing(null)
      setNote(`根模板已设为「${tpl.title}」`)
    },
    [instantiate],
  )

  const clearParam = useCallback(
    (path: string, param: string) => {
      setTree((prev) => {
        if (!prev) return prev
        const next = new Map(prev)
        const n = next.get(path)
        if (!n) return prev
        next.delete(childPathOf(path, param))
        next.set(path, { tpl: n.tpl, values: { ...n.values, [param]: { kind: 'text', text: '' } } })
        return next
      })
      if (editing?.path === path && editing?.param === param) setEditing(null)
    },
    [editing],
  )

  const clearAll = useCallback(() => {
    const t = new Map<string, { tpl: PromptTemplate; values: Record<string, ParamValue> }>()
    t.set('root', { tpl: DEFAULT_ROOT, values: defaultValues(DEFAULT_ROOT) })
    setTree(t)
    setEditing({ path: 'root', param: 'prompt' })
    setNote('已重置为默认根模板 {{prompt}}')
  }, [])

  // 行集合（先序；含嵌套子模板行）。
  const rows = useMemo<Row[]>(() => {
    if (!tree) return []
    const out: Row[] = []
    const walk = (path: string, depth: number) => {
      const n = tree.get(path)
      if (!n) return
      out.push({ path, depth, node: n })
      for (const p of n.tpl.params ?? []) {
        const v = n.values[p.name]
        if (v && v.kind === 'tpl') walk(childPathOf(path, p.name), depth + 1)
      }
    }
    walk('root', 0)
    return out
  }, [tree])

  const rootNode = tree ? (tree.get('root') ?? null) : null
  const fullText = useMemo(() => (rootNode ? composeNode(rootNode) : ''), [rootNode])

  // 参数表（顺序稳定：模板 params + 文本里出现但未声明的占位符）。
  const paramsOf = useCallback((node: { tpl: PromptTemplate; values: Record<string, ParamValue> }) => {
    const tpl = node.tpl
    const names = new Set<string>()
    const re = /\{\{\s*([\w-]+)\s*\}\}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(tpl.text ?? '')) !== null) names.add(m[1])
    const declared = tpl.params ?? []
    const ordered = declared.filter((p) => names.has(p.name) || !names.size)
    const extra = [...names].filter((nm) => !declared.some((p) => p.name === nm)).map((nm) => ({ name: nm, label: nm }))
    return [...ordered, ...extra]
  }, [])

  // 聚焦参数：聊天框切到该参数值（text 型才可编辑）。
  const focusParam = useCallback(
    (path: string, param: string) => {
      const n = tree?.get(path)
      if (!n) return
      const val = n.values[param]
      if (val && val.kind === 'tpl') {
        setNote(`参数「${param}」是子模板（见其行）；编辑请点子模板行的参数`)
        return
      }
      const text = val?.kind === 'text' ? val.text : ''
      setEditing({ path, param })
      lastSync.current = text
      actions?.setDraft(text)
      setNote(`编辑「${param}」：直接在聊天框写即可；提交时发给 agent 的是整树组合结果`)
    },
    [tree, actions],
  )

  // 聊天框内容实时回写为被聚焦参数。
  useEffect(() => {
    if (!editing) return
    if (typeof snapshotDraft !== 'string') return
    if (snapshotDraft === lastSync.current) return
    lastSync.current = snapshotDraft
    setParamText(editing.path, editing.param, snapshotDraft)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotDraft, editing])

  // 未聚焦参数时：聊天框显示根组合文本（原生提交/回车即交付整树结果）。
  const idleLast = useRef<string | null>(null)
  useEffect(() => {
    if (!actions || !rootNode || editing) return
    if (idleLast.current === fullText) return
    idleLast.current = fullText
    actions.setDraft(fullText)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, rootNode, editing, fullText])

  // 提交：以根节点组合文本交付。原 submit 捕获一次；存在模板期间接管。
  const deliverRef = useRef<(() => void) | null>(null)
  deliverRef.current = () => {
    if (!actions || !rootNode) return
    actions.setDraft(fullText)
    const orig = origSubmitRef.current
    if (orig) orig()
  }
  useEffect(() => {
    if (!actions?.submit) return
    if (wrappedRef.current) return
    const inst = actions as { submit: () => void }
    origSubmitRef.current = inst.submit.bind(actions)
    inst.submit = () => {
      if (rootNode) deliverRef.current?.()
      else origSubmitRef.current?.()
    }
    wrappedRef.current = true
    return () => {
      if (wrappedRef.current && inst.submit !== origSubmitRef.current) inst.submit = origSubmitRef.current as () => void
      wrappedRef.current = false
    }
  }, [actions, rootNode])

  // 回车：编辑参数时以整树结果提交（否则原生提交）。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return
      if (!editing || !rootNode) return
      const t = e.target as HTMLElement | null
      if (!t || !(t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (!rootNode) return
      e.preventDefault()
      deliverRef.current?.()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [editing, rootNode])

  const valBadge = (val: ParamValue | undefined): string => {
    if (!val) return ''
    if (val.kind === 'text') {
      const t = val.text.replace(/\s+/g, ' ')
      return t.length > 24 ? `${t.slice(0, 24)}…` : t
    }
    return `子模板:${val.tpl.title}`
  }

  const pickList = (onPick: (t: PromptTemplate) => void) => (
    <div className="pt-pick" style={{ maxWidth: 520 }}>
      <h4>选择提示词模板（参数可再嵌套模板 → 每个模板元素占一行）</h4>
      {library.map((t) => (
        <button key={t.id} className="pt-opt" onClick={() => onPick(t)}>
          <b>{t.title}</b>
          {t.description ? <small> — {t.description}</small> : null}
        </button>
      ))}
    </div>
  )

  return (
    <>
      <div className="pt-tools">
        <button className="pt-chip on" onClick={() => setRootPickerOpen((v) => !v)}>换根模板</button>
        <span className="pt-edit-hint">
          {editing
            ? `正在聊天框编辑「${editing.param}」`
            : '点击参数开始用聊天框编辑；提交时发给 agent 的是整树组合结果（可随时「预览（根）」核对）'}
        </span>
        <span style={{ flex: 1 }} />
        <button className="pt-btn" onClick={() => setPreview({ title: '根模板预览（将交付 agent 的内容）', text: fullText || '（空）' })}>预览（根）</button>
        <button className="pt-btn" onClick={clearAll}>重置默认</button>
        {note && <span style={{ color: '#8b949e', fontSize: 11 }}>{note}</span>}
      </div>
      {rootNode && (
        <div className="pt-wrap">
          {rows.map((row) => {
            const isRoot = row.path === 'root'
            return (
              <div key={row.path} className={`pt-elem${isRoot ? ' root' : ''}`} style={{ marginLeft: row.depth * 22 }}>
                <span className="et">{isRoot ? `根 · ${row.node.tpl.title}` : row.node.tpl.title}</span>
                <button className="pt-btn" title="预览本行（该模板元素组合内容）" onClick={() => setPreview({ title: `本行预览：${row.node.tpl.title}`, text: composeNode(row.node) || '（空）' })}>预览</button>
                {paramsOf(row.node).map((p) => {
                  const val = row.node.values[p.name]
                  const isTpl = !!val && val.kind === 'tpl'
                  const isEdit = editing?.path === row.path && editing?.param === p.name
                  return (
                    <span key={p.name} className={`pt-param${isEdit ? ' focus' : ''}`} title={isTpl ? `${p.label}：子模板，见下方行` : '点标签 = 用聊天框编辑该参数'}>
                      <span className="lb" onClick={() => focusParam(row.path, p.name)}>{p.label || p.name}</span>
                      <span className="val">{valBadge(val)}</span>
                      <button className="pt-btn" title="预览该参数内容" onClick={() => {
                        const text = !val ? '' : val.kind === 'text' ? val.text : composeNode({ tpl: val.tpl, values: val.values })
                        setPreview({ title: `参数预览：${p.label || p.name}`, text })
                      }}>预览</button>
                      {!isTpl ? (
                        <button className="pt-btn warn" title="用嵌套模板填充该参数（新行）" onClick={() => setPickerFor({ at: row.path, param: p.name })}>嵌套</button>
                      ) : (
                        <button className="pt-btn" title="解除嵌套，回到文本参数" onClick={() => clearParam(row.path, p.name)}>解套</button>
                      )}
                      {val && (val.kind === 'text' ? val.text !== '' : true) && (
                        <button className="pt-btn" title="清空该参数" onClick={() => clearParam(row.path, p.name)}>✕</button>
                      )}
                    </span>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
      {rootPickerOpen && pickList(setRoot)}
      {pickerFor && pickList((t) => setParamTpl(pickerFor.at, pickerFor.param, t))}
      {preview !== null && (
        <div className="pt-modal-back" onClick={() => setPreview(null)}>
          <div className="pt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{preview.title}</h3>
            <pre>{preview.text || '（空）'}</pre>
            <div className="foot">
              <button className="pt-btn" onClick={() => setPreview(null)}>关闭</button>
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
