/**
 * dsh-chat-prompt-templates — open-source web client plugin（v0.7 布局/模式）。
 *
 * 原则（用户裁决累计）：
 * - 插件只建立提示词/辅助描述需求；执行交给 agent（launcher 提供确定型能力）。
 * - **无全局工具条**。每行 = 左边模板标题、中间参数、右侧控件。
 * - **每个节点都可以是“栈”或“树”模式**（默认栈）：
 *   栈 = 只显示 聚焦节点→根 的路径；树 = 把该节点的整棵子树展开（可滚动）。
 * - 行右控件：👁 行预览、▦ 修改模板；有嵌套子模板的行另有 [栈|树] 切换；
 *   根（顶行）右侧另有 ⟲ 重置（恢复默认 {{prompt}}）。
 * - 图标统一：预览 👁、模板改动 ▦（行/参数同一图标）、解套 ↩、清空 ✕、重置 ⟲；
 *   无差异化配色。默认根 = 标准模板 {{prompt}}。解套=把解套前预览内容赋值给参数。
 * - 聊天框=参数编辑输入面；提交（发送/回车）交付整树根组合文本（根 👁 预览核对）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

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
type NodeMode = 'stack' | 'tree'

const DEFAULT_ROOT: PromptTemplate = {
  id: 'custom-single',
  title: '标准模板',
  description: '{{prompt}} —— 直接在聊天框编写内容。',
  text: '{{prompt}}',
  params: [{ name: 'prompt', label: '内容' }],
}

const BUILTIN: PromptTemplate[] = [
  DEFAULT_ROOT,
  {
    id: 'concat-two',
    title: '拼接两段',
    description: '把两段内容按序拼接（段落间留空行）；每段都可再嵌套模板。',
    text: '{{a}}\n\n{{b}}',
    params: [
      { name: 'a', label: '片段 A' },
      { name: 'b', label: '片段 B' },
    ],
  },
  {
    id: 'launcher-dev-profile',
    title: '开发/维护个人级 profile 或插件',
    description: '描述需求 → agent 读 dsh-launcher-skill/API 后按“加 reg profile”模式执行。',
    text: '请阅读 http://127.0.0.1:3079/api/help （dsh-launcher-skill），按其接口与流程，为下列需求给出并执行“加 reg profile”式方案：新 profile 名称={{name}}；基线 profile={{baseline}}；目标/差异={{diff}}。',
    params: [
      { name: 'name', label: '新 profile 名称' },
      { name: 'baseline', label: '基线 profile' },
      { name: 'diff', label: '目标/差异描述' },
    ],
  },
]

const DEFAULT_PRESET_URLS = ['http://127.0.0.1:3079/api/prompt-presets']
const STORAGE_PRESET_URLS = 'dsh-chat-prompt-templates:presetUrls'
const childPathOf = (at: string, param: string): string => `${at}:${param}`

const I = {
  eye: '👁',
  tpl: '▦',
  unnest: '↩',
  clear: '✕',
  reset: '⟲',
} as const

/** 面板高度记忆键（整体高度可拖动拉伸）。 */
const DOCK_H_KEY = 'dsh-chat-prompt-templates:dockH'
const DOCK_H_MIN = 90

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
.pt-wrap { display:flex; flex-direction:column; gap:3px; padding:2px 6px 4px; }
.pt-scroll { max-height: 264px; overflow-y:auto; overscroll-behavior:contain; }
.pt-elem { display:flex; align-items:center; gap:8px; flex-wrap:nowrap; border:1px solid #23272f; background:#0f141a; border-radius:8px; padding:2px 8px; font-size:11.5px; }
.pt-elem.active { border-color:#388bfd55; box-shadow:0 0 0 1px #388bfd33 inset; }
.pt-elem .et { flex:0 0 auto; font-weight:600; color:#e6edf3; cursor:pointer; max-width:34%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pt-elem .et:hover { text-decoration:underline; }
.pt-elem .mid { flex:1 1 auto; min-width:0; display:flex; align-items:center; gap:4px; flex-wrap:wrap; }
.pt-param { display:inline-flex; align-items:center; gap:3px; border:1px solid #30363d; background:#10151b; border-radius:10px; padding:1px 6px; font-size:11px; }
.pt-param.focus { border-color:#2ea043; background:rgba(46,160,67,.14); }
.pt-param.anc { border-color:#d29922; background:rgba(210,153,34,.10); }
.pt-param .lb { cursor:pointer; color:#c9d1d9; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pt-param .lb:hover { text-decoration:underline; }
.pt-param .val { color:#8b949e; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pt-rowctl { flex:0 0 auto; display:inline-flex; align-items:center; gap:5px; }
.pt-dock { display:flex; flex-direction:column; min-width:0; }
.pt-dock .pt-body { overflow-y:auto; min-height:0; scrollbar-width:thin; }
.pt-dock.fixed .pt-body { flex:1 1 auto; }
.pt-vhandle { flex:0 0 auto; height:8px; cursor:ns-resize; touch-action:none; background-image:radial-gradient(circle, #3b4454 1.1px, transparent 1.2px); background-size:9px 9px; background-position:center; background-repeat:no-repeat; }
.pt-vhandle:hover { background-color:rgba(31,111,235,.16); }
.pt-ic { border:0; background:transparent; color:#8b949e; padding:0 2px; font-size:11px; cursor:pointer; line-height:1; }
.pt-ic:hover { color:#e6edf3; }
.pt-mode { display:inline-flex; gap:1px; border:1px solid #30363d; border-radius:6px; overflow:hidden; }
.pt-mode button { border:0; background:transparent; color:#8b949e; padding:0 6px; font-size:10.5px; cursor:pointer; line-height:16px; }
.pt-mode button.on { color:#e6edf3; background:#1f6feb33; }
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

interface Row { path: string; depth: number; node: { tpl: PromptTemplate; values: Record<string, ParamValue> } }

function PromptRoot(props: SeatProps) {
  const [library, setLibrary] = useState<PromptTemplate[]>(BUILTIN)
  const [tree, setTree] = useState<Tree | null>(null)
  const [activePath, setActivePath] = useState('root')
  const [nodeMode, setNodeMode] = useState<Record<string, NodeMode>>({})
  const [editing, setEditing] = useState<{ path: string; param: string } | null>(null)
  const [picker, setPicker] = useState<{ kind: 'param'; at: string; param: string } | { kind: 'replace'; path: string } | null>(null)
  const [preview, setPreview] = useState<{ title: string; text: string } | null>(null)
  const lastSync = useRef('')
  const actions = props.inputActions
  const snapshotDraft = props.input?.draft
  const origSubmitRef = useRef<(() => void) | null>(null)
  const wrappedRef = useRef(false)

  // 面板整体高度（可拖动拉伸；localStorage 记忆）。
  const [dockH, setDockH] = useState<number | null>(() => {
    try {
      const v = Number(localStorage.getItem(DOCK_H_KEY))
      return Number.isFinite(v) && v >= DOCK_H_MIN ? Math.round(v) : null
    } catch {
      return null
    }
  })
  const dockMax = () => Math.max(DOCK_H_MIN, Math.round((window.innerHeight || 720) * 0.72))
  const clampDock = (h: number) => Math.min(dockMax(), Math.max(DOCK_H_MIN, h))
  const dragY = useRef<{ y: number; h: number } | null>(null)
  const onVHandleDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const base = (document.querySelector('.pt-dock') as HTMLElement | null)?.offsetHeight ?? dockH ?? 300
    const h = clampDock(base)
    dragY.current = { y: e.clientY, h }
    setDockH(h)
    const move = (ev: PointerEvent) => {
      if (!dragY.current) return
      const nh = clampDock(dragY.current.h + (ev.clientY - dragY.current.y))
      dragY.current.h = nh
      setDockH(nh)
    }
    const up = () => {
      const last = dragY.current?.h
      dragY.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (last !== undefined) {
        try {
          localStorage.setItem(DOCK_H_KEY, String(Math.round(last)))
        } catch { /* ignore */ }
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const modeOf = useCallback((path: string): NodeMode => nodeMode[path] ?? 'stack', [nodeMode])
  const setModeOf = useCallback((path: string, m: NodeMode) => {
    setNodeMode((prev) => ({ ...prev, [path]: m }))
  }, [])

  /** 从“活”树按路径组合文本：嵌套子模板一律回查 tree（不受对象引用过期影响）。 */
  const composePath = useCallback(
    (path: string): string => {
      const node = tree?.get(path)
      if (!node) return ''
      const text = node.tpl.text ?? ''
      const resolve = (name: string): string => {
        const val = node.values[name]
        if (!val) return ''
        if (val.kind === 'text') return val.text
        return composePath(childPathOf(path, name))
      }
      return text.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_all, nm: string) => resolve(nm))
    },
    [tree],
  )

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

  // 默认根节点：标准模板 {{prompt}}。
  useEffect(() => {
    const t = new Map<string, { tpl: PromptTemplate; values: Record<string, ParamValue> }>()
    t.set('root', { tpl: DEFAULT_ROOT, values: defaultValues(DEFAULT_ROOT) })
    setTree(t)
    setActivePath('root')
    setEditing({ path: 'root', param: 'prompt' })
    setNodeMode({})
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
      setPicker(null)
      setActivePath(childPathOf(at, param))
      setEditing(null)
    },
    [instantiate],
  )

  const setRootTpl = useCallback(
    (tpl: PromptTemplate) => {
      const t = new Map<string, { tpl: PromptTemplate; values: Record<string, ParamValue> }>()
      t.set('root', instantiate(tpl))
      setTree(t)
      setActivePath('root')
      const first = tpl.params?.[0]?.name
      setEditing(first ? { path: 'root', param: first } : null)
      setNodeMode({})
      setPicker(null)
    },
    [instantiate],
  )

  const replaceNodeTpl = useCallback(
    (path: string, tpl: PromptTemplate) => {
      if (path === 'root') {
        setRootTpl(tpl)
        return
      }
      const i = path.lastIndexOf(':')
      const at = path.slice(0, i) || 'root'
      const param = path.slice(i + 1)
      setParamTpl(at, param, tpl)
    },
    [setRootTpl, setParamTpl],
  )

  const pruneSubtree = useCallback((prev: Tree, path: string): Tree => {
    const next = new Map(prev)
    const prefix = `${path}:`
    for (const key of next.keys()) {
      if (key === path || key.startsWith(prefix)) next.delete(key)
    }
    return next
  }, [])

  const clearParam = useCallback((path: string, param: string) => {
    setTree((prev) => {
      if (!prev) return prev
      const n = prev.get(path)
      if (!n) return prev
      const next = pruneSubtree(prev, childPathOf(path, param))
      next.set(path, { tpl: n.tpl, values: { ...n.values, [param]: { kind: 'text', text: '' } } })
      return next
    })
    setNodeMode((prev) => {
      const next = { ...prev }
      const child = childPathOf(path, param)
      const prefix = `${child}:`
      for (const key of Object.keys(next)) {
        if (key === child || key.startsWith(prefix)) delete next[key]
      }
      return next
    })
    if (editing && (editing.path === path ? editing.param === param : editing.path === childPathOf(path, param) || editing.path.startsWith(`${childPathOf(path, param)}:`))) setEditing(null)
    setActivePath(path)
  }, [editing, pruneSubtree])

  /** 解套：子模板组合结果（解套前预览内容）赋值给该参数，并删除子树。 */
  const unnestParam = useCallback((path: string, param: string) => {
    const childKey = childPathOf(path, param)
    const n = tree?.get(path)
    const child = tree?.get(childKey)
    if (!n || !child) return
    const resolved = composePath(childKey)
    setTree((prev) => {
      if (!prev) return prev
      const next = pruneSubtree(prev, childKey)
      next.set(path, { tpl: n.tpl, values: { ...n.values, [param]: { kind: 'text', text: resolved } } })
      return next
    })
    setNodeMode((prev) => {
      const next = { ...prev }
      const prefix = `${childKey}:`
      for (const key of Object.keys(next)) {
        if (key === childKey || key.startsWith(prefix)) delete next[key]
      }
      return next
    })
    setEditing({ path, param })
    setActivePath(path)
    lastSync.current = resolved
    actions?.setDraft(resolved)
  }, [tree, pruneSubtree, actions])

  const resetDefault = useCallback(() => {
    const t = new Map<string, { tpl: PromptTemplate; values: Record<string, ParamValue> }>()
    t.set('root', { tpl: DEFAULT_ROOT, values: defaultValues(DEFAULT_ROOT) })
    setTree(t)
    setActivePath('root')
    setEditing({ path: 'root', param: 'prompt' })
    setNodeMode({})
  }, [])

  const nestedChildren = useCallback(
    (path: string): string[] => {
      if (!tree) return []
      const n = tree.get(path)
      if (!n) return []
      const out: string[] = []
      for (const p of n.tpl.params ?? []) {
        const v = n.values[p.name]
        if (v && v.kind === 'tpl') out.push(childPathOf(path, p.name))
      }
      return out
    },
    [tree],
  )

  // 可见行：默认栈；把某节点设为“树”即无条件展开其整棵子树（含后代），
  // “栈”则只展开 聚焦节点→根 路径上的行。行顺序 = 先序。
  const rows = useMemo<Row[]>(() => {
    if (!tree) return []
    const out: Row[] = []
    const walk = (path: string, depth: number, forceAll: boolean) => {
      const n = tree.get(path)
      if (!n) return
      out.push({ path, depth, node: n })
      const pTree = forceAll || modeOf(path) === 'tree'
      for (const c of nestedChildren(path)) {
        const onPath = c === activePath || activePath.startsWith(`${c}:`)
        if (pTree || onPath) walk(c, depth + 1, pTree)
      }
    }
    walk('root', 0, false)
    return out
  }, [tree, activePath, modeOf, nestedChildren])

  const hasAnyTree = useMemo(() => Object.values(nodeMode).includes('tree'), [nodeMode])

  const rootNode = tree ? (tree.get('root') ?? null) : null
  const fullText = useMemo(() => (rootNode ? composePath('root') : ''), [rootNode, composePath])

  const ancestorEdges = useMemo(() => {
    const out: { parentPath: string; param: string }[] = []
    if (!activePath || activePath === 'root') return out
    let cur = 'root'
    while (cur !== activePath) {
      const rest = activePath.slice(cur.length + 1)
      const idx = rest.indexOf(':')
      const stepParam = idx < 0 ? rest : rest.slice(0, idx)
      out.push({ parentPath: cur, param: stepParam })
      cur = childPathOf(cur, stepParam)
      if (!tree?.has(cur)) break
    }
    return out
  }, [activePath, tree])

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

  const focusParam = useCallback(
    (path: string, param: string) => {
      const n = tree?.get(path)
      if (!n) return
      const val = n.values[param]
      setActivePath(path)
      if (val && val.kind === 'tpl') {
        setEditing(null)
        setActivePath(childPathOf(path, param))
        return
      }
      const text = val?.kind === 'text' ? val.text : ''
      setEditing({ path, param })
      lastSync.current = text
      actions?.setDraft(text)
    },
    [tree, actions],
  )

  // 聊天框实时回写被聚焦参数。
  useEffect(() => {
    if (!editing) return
    if (typeof snapshotDraft !== 'string') return
    if (snapshotDraft === lastSync.current) return
    lastSync.current = snapshotDraft
    setParamText(editing.path, editing.param, snapshotDraft)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotDraft, editing])

  // 未聚焦参数：聊天框显示整树组合文本。
  const idleLast = useRef<string | null>(null)
  useEffect(() => {
    if (!actions || !rootNode || editing) return
    if (idleLast.current === fullText) return
    idleLast.current = fullText
    actions.setDraft(fullText)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, rootNode, editing, fullText])

  // 提交 = 整树根组合文本。
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return
      if (!editing || !rootNode) return
      const t = e.target as HTMLElement | null
      if (!t || !(t.tagName === 'TEXTAREA' || t.isContentEditable)) return
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
      return t.length > 20 ? `${t.slice(0, 20)}…` : t
    }
    return `↳${val.tpl.title}`
  }

  const pickList = (title: string, onPick: (t: PromptTemplate) => void) => (
    <div className="pt-pick" style={{ maxWidth: 540 }}>
      <h4>{title}</h4>
      {library.map((t) => (
        <button key={t.id} className="pt-opt" onClick={() => onPick(t)}>
          <b>{t.title}</b>
          {t.description ? <small> — {t.description}</small> : null}
        </button>
      ))}
    </div>
  )

  return (
    <div className={`pt-dock${dockH ? ' fixed' : ''}`} style={dockH ? { height: dockH } : undefined}>
      <div className="pt-body">
        {rootNode && (
          <div className={`pt-wrap${hasAnyTree || dockH ? ' pt-scroll' : ''}`}>
            {rows.map((row) => {
              const isRoot = row.path === 'root'
              const isActive = row.path === activePath
              const m = modeOf(row.path)
              const kids = nestedChildren(row.path)
              const parentOfParam = (p: string) => ancestorEdges.find((a) => a.parentPath === row.path && a.param === p)
              return (
                <div key={row.path} className={`pt-elem${isActive ? ' active' : ''}`} style={{ marginLeft: row.depth * 18 }}>
                  <span className="et" title="点击聚焦本行" onClick={() => { setActivePath(row.path); setEditing(null) }}>{row.node.tpl.title}</span>
                  <span className="mid">
                    {paramsOf(row.node).map((p) => {
                      const val = row.node.values[p.name]
                      const isTpl = !!val && val.kind === 'tpl'
                      const isFocus = editing?.path === row.path && editing?.param === p.name
                      const isAnc = !!parentOfParam(p.name)
                      const cls = ['pt-param', isFocus ? 'focus' : '', isAnc ? 'anc' : ''].filter(Boolean).join(' ')
                      return (
                        <span key={p.name} className={cls} title={isTpl ? `${p.label}：子模板` : `${p.label}：点击=用聊天框编辑`}>
                          <span className="lb" onClick={() => focusParam(row.path, p.name)}>{p.label || p.name}</span>
                          <span className="val">{valBadge(val)}</span>
                          <button className="pt-ic" title="预览该参数内容" onClick={() => {
                            const text = !val ? '' : val.kind === 'text' ? val.text : composePath(childPathOf(row.path, p.name))
                            setPreview({ title: `参数预览：${p.label || p.name}`, text })
                          }}>{I.eye}</button>
                          {!isTpl ? (
                            <button className="pt-ic" title="修改模板：用另一模板填充该参数" onClick={() => setPicker({ kind: 'param', at: row.path, param: p.name })}>{I.tpl}</button>
                          ) : (
                            <>
                              <button className="pt-ic" title="修改模板：更换该参数的子模板" onClick={() => setPicker({ kind: 'param', at: row.path, param: p.name })}>{I.tpl}</button>
                              <button className="pt-ic" title="解套：把子模板组合结果填入该参数并改回文本" onClick={() => unnestParam(row.path, p.name)}>{I.unnest}</button>
                            </>
                          )}
                          {!isTpl && val && val.kind === 'text' && val.text !== '' && (
                            <button className="pt-ic" title="清空该参数" onClick={() => clearParam(row.path, p.name)}>{I.clear}</button>
                          )}
                        </span>
                      )
                    })}
                  </span>
                  <span className="pt-rowctl">
                    {kids.length > 0 && (
                      <span className="pt-mode" title="该节点的显示模式：栈=聚焦路径；树=整棵子树">
                        <button className={m === 'stack' ? 'on' : ''} title="栈：只显示 聚焦节点→根 的路径" onClick={() => setModeOf(row.path, 'stack')}>栈</button>
                        <button className={m === 'tree' ? 'on' : ''} title="树：展开本节点全部嵌套子树" onClick={() => setModeOf(row.path, 'tree')}>树</button>
                      </span>
                    )}
                    <button className="pt-ic" title={isRoot ? '预览整树（将交付给 agent 的内容）' : '预览本行组合内容'} onClick={() => setPreview({ title: isRoot ? '整树组合（交付内容）' : `本行预览：${row.node.tpl.title}`, text: (isRoot ? fullText : composePath(row.path)) || '（空）' })}>{I.eye}</button>
                    <button className="pt-ic" title="修改模板" onClick={() => setPicker({ kind: 'replace', path: row.path })}>{I.tpl}</button>
                    {isRoot && (
                      <button className="pt-ic" title="重置为默认标准模板 {{prompt}}" onClick={resetDefault}>{I.reset}</button>
                    )}
                  </span>
                </div>
              )
            })}
            </div>
        )}
      </div>
      <div className="pt-vhandle" title="拖动调整面板高度（松手记忆）" onPointerDown={onVHandleDown} />
      {picker?.kind === 'param' && pickList(`选择子模板填充参数「${picker.param}」`, (t) => setParamTpl(picker.at, picker.param, t))}
      {picker?.kind === 'replace' && pickList('修改模板', (t) => replaceNodeTpl(picker.path, t))}
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
    </div>
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
