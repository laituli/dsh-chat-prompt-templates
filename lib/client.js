window.__ModuleLoader__.load({
	id: "dsh-chat-prompt-templates",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/index.tsx
		/**
		* dsh-chat-prompt-templates — open-source web client plugin（v0.4 布局/交互）。
		*
		* 原则（用户裁决累计）：
		* - 模板插件只负责“建立合适的提示词、辅助人描述需求”；真正的执行（如创建
		*   profile/plugin）由 agent 按提示词（skill/API）完成——launcher 侧提供确定型
		*   能力（registry/declare/api），本插件不特化创建流程。
		* - 最上面的模板总是根模板：**不特化显示“根”**；其上方是模板标题，预览按钮旁
		*   有「修改模板」，正常修改即可。**按钮用 icon（title 提示），不用文字**。
		* - **每个模板元素一行**：行 = 实例化模板节点，嵌套子模板在其下一行（缩进）。
		* - **聚焦节点的父参数都高亮**：当前行的高亮 + 沿路径把祖先行的“经由参数”一并
		*   高亮（点父参数可回到它的编辑）。
		* - **默认根节点 = 标准模板 {{prompt}}**；聊天框=参数编辑输入面；无“应用到
		*   聊天框”；提交（发送/回车）以整树根组合文本交付。
		*/
		const name = "dsh-chat-prompt-templates";
		/** client 侧注入：slots（槽位服务，client runtime 提供）。 */
		const inject = ["slots"];
		const DEFAULT_ROOT = {
			id: "custom-single",
			title: "标准模板",
			description: "{{prompt}} —— 直接在聊天框编写内容。",
			text: "{{prompt}}",
			params: [{
				name: "prompt",
				label: "内容"
			}]
		};
		const BUILTIN = [
			DEFAULT_ROOT,
			{
				id: "concat-two",
				title: "拼接两段",
				description: "把两段内容按序拼接（段落间留空行）；每段都可再嵌套模板。",
				text: "{{a}}\n\n{{b}}",
				params: [{
					name: "a",
					label: "片段 A"
				}, {
					name: "b",
					label: "片段 B"
				}]
			},
			{
				id: "launcher-dev-profile",
				title: "开发/维护个人级 profile 或插件",
				description: "描述需求 → agent 读 dsh-launcher-skill/API 后按“加 reg profile”模式执行。",
				text: "请阅读 http://127.0.0.1:3079/api/help （dsh-launcher-skill），按其接口与流程，为下列需求给出并执行“加 reg profile”式方案：新 profile 名称={{name}}；基线 profile={{baseline}}；目标/差异={{diff}}。",
				params: [
					{
						name: "name",
						label: "新 profile 名称"
					},
					{
						name: "baseline",
						label: "基线 profile"
					},
					{
						name: "diff",
						label: "目标/差异描述"
					}
				]
			}
		];
		const DEFAULT_PRESET_URLS = ["http://127.0.0.1:3079/api/prompt-presets"];
		const STORAGE_PRESET_URLS = "dsh-chat-prompt-templates:presetUrls";
		const childPathOf = (at, param) => `${at}:${param}`;
		/** Icon-only 按钮（title 说明）；预览统一用小眼睛，模板改动（行/参数）统一模板图标，
		*  解套 ↩、清空 ✕、重置 ⟲。图标不做差异化配色。 */
		const I = {
			eye: "👁",
			tpl: "▦",
			unnest: "↩",
			clear: "✕",
			reset: "⟲"
		};
		function defaultValues(tpl) {
			const values = {};
			for (const p of tpl.params ?? []) values[p.name] = {
				kind: "text",
				text: ""
			};
			return values;
		}
		function composeNode(node) {
			const text = node.tpl.text ?? "";
			const resolved = /* @__PURE__ */ new Map();
			const resolve = (name) => {
				if (resolved.has(name)) return resolved.get(name);
				const val = node.values[name];
				if (!val) return "";
				const out = val.kind === "text" ? val.text : composeNode({
					tpl: val.tpl,
					values: val.values
				});
				resolved.set(name, out);
				return out;
			};
			return text.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_all, name) => resolve(name));
		}
		const CSS = `
.pt-wrap { display:flex; flex-direction:column; gap:3px; padding:3px 8px 6px; }
.pt-scroll { max-height: 264px; overflow-y:auto; overscroll-behavior:contain; }
.pt-mode { display:inline-flex; gap:2px; border:1px solid #30363d; border-radius:6px; overflow:hidden; }
.pt-mode button { border:0; background:transparent; color:#8b949e; padding:0 8px; font-size:11px; cursor:pointer; line-height:18px; }
.pt-mode button.on { color:#e6edf3; background:#1f6feb33; }
.pt-tools { display:flex; align-items:center; gap:8px; font-size:11.5px; color:#8b949e; flex-wrap:wrap; }
.pt-chip { border:1px solid rgba(127,127,127,.35); background:#21262d; color:#c9d1d9; border-radius:12px; padding:1px 9px; font-size:11.5px; cursor:pointer; }
.pt-chip:hover { background:#2a303a; }
.pt-elem { display:flex; align-items:center; gap:4px; flex-wrap:wrap; border:1px solid #23272f; background:#0f141a; border-radius:8px; padding:2px 8px; font-size:11.5px; }
.pt-elem.active { border-color:#388bfd55; box-shadow:0 0 0 1px #388bfd33 inset; }
.pt-elem .et { font-weight:600; color:#e6edf3; cursor:pointer; }
.pt-elem .et:hover { text-decoration:underline; }
.pt-param { display:inline-flex; align-items:center; gap:3px; border:1px solid #30363d; background:#10151b; border-radius:10px; padding:1px 6px; font-size:11px; }
.pt-param.focus { border-color:#2ea043; background:rgba(46,160,67,.14); }
.pt-param.anc { border-color:#d29922; background:rgba(210,153,34,.10); }
.pt-param .lb { cursor:pointer; color:#c9d1d9; max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pt-param .lb:hover { text-decoration:underline; }
.pt-param .val { color:#8b949e; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pt-ic { border:0; background:transparent; color:#8b949e; padding:0 2px; font-size:11px; cursor:pointer; line-height:1; }
.pt-ic:hover { color:#e6edf3; }
.pt-edit-hint { color:#7ee787; font-size:11px; }
.pt-soft { color:#8b949e; font-size:11px; }
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
`;
		function PromptRoot(props) {
			const [library, setLibrary] = (0, react.useState)(BUILTIN);
			const [tree, setTree] = (0, react.useState)(null);
			const [activePath, setActivePath] = (0, react.useState)("root");
			const [mode, setMode] = (0, react.useState)("stack");
			const [editing, setEditing] = (0, react.useState)(null);
			const [picker, setPicker] = (0, react.useState)(null);
			const [preview, setPreview] = (0, react.useState)(null);
			const [note, setNote] = (0, react.useState)("");
			const lastSync = (0, react.useRef)("");
			const actions = props.inputActions;
			const snapshotDraft = props.input?.draft;
			const origSubmitRef = (0, react.useRef)(null);
			const wrappedRef = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				let alive = true;
				(async () => {
					let urls = DEFAULT_PRESET_URLS;
					try {
						const raw = localStorage.getItem(STORAGE_PRESET_URLS);
						if (raw) urls = JSON.parse(raw);
					} catch {}
					for (const url of urls) try {
						const res = await fetch(url, { headers: { accept: "application/json" } });
						if (!res.ok) continue;
						const presets = (await res.json()).value?.presets;
						if (Array.isArray(presets) && presets.length && alive) setLibrary((prev) => {
							const ids = new Set(prev.map((t) => t.id));
							const fresh = presets.filter((t) => t && t.id && !ids.has(t.id));
							return fresh.length ? [...prev, ...fresh] : prev;
						});
					} catch {}
				})();
				return () => {
					alive = false;
				};
			}, []);
			(0, react.useEffect)(() => {
				const t = /* @__PURE__ */ new Map();
				t.set("root", {
					tpl: DEFAULT_ROOT,
					values: defaultValues(DEFAULT_ROOT)
				});
				setTree(t);
				setActivePath("root");
				setEditing({
					path: "root",
					param: "prompt"
				});
			}, []);
			const instantiate = (0, react.useCallback)((tpl) => {
				return {
					tpl,
					values: defaultValues(tpl)
				};
			}, []);
			const setParamText = (0, react.useCallback)((path, param, text) => {
				setTree((prev) => {
					if (!prev) return prev;
					const n = prev.get(path);
					if (!n) return prev;
					const next = new Map(prev);
					next.set(path, {
						tpl: n.tpl,
						values: {
							...n.values,
							[param]: {
								kind: "text",
								text
							}
						}
					});
					return next;
				});
			}, []);
			const setParamTpl = (0, react.useCallback)((at, param, tpl) => {
				setTree((prev) => {
					if (!prev) return prev;
					const next = new Map(prev);
					const n = next.get(at);
					if (!n) return prev;
					const child = instantiate(tpl);
					next.set(childPathOf(at, param), child);
					next.set(at, {
						tpl: n.tpl,
						values: {
							...n.values,
							[param]: {
								kind: "tpl",
								tpl: child.tpl,
								values: child.values
							}
						}
					});
					return next;
				});
				setPicker(null);
				setActivePath(childPathOf(at, param));
				setEditing(null);
			}, [instantiate]);
			const setRootTpl = (0, react.useCallback)((tpl) => {
				const t = /* @__PURE__ */ new Map();
				t.set("root", instantiate(tpl));
				setTree(t);
				setActivePath("root");
				const first = tpl.params?.[0]?.name;
				setEditing(first ? {
					path: "root",
					param: first
				} : null);
				setPicker(null);
				setNote(`根模板改为「${tpl.title}」`);
			}, [instantiate]);
			const replaceNodeTpl = (0, react.useCallback)((path, tpl) => {
				if (path === "root") {
					setRootTpl(tpl);
					return;
				}
				const i = path.lastIndexOf(":");
				const at = path.slice(0, i) || "root";
				const param = path.slice(i + 1);
				setParamTpl(at, param, tpl);
			}, [setRootTpl, setParamTpl]);
			/** 从树上移除一个节点及其全部后代（子树）。 */
			const pruneSubtree = (0, react.useCallback)((prev, path) => {
				const next = new Map(prev);
				const prefix = `${path}:`;
				for (const key of next.keys()) if (key === path || key.startsWith(prefix)) next.delete(key);
				return next;
			}, []);
			const clearParam = (0, react.useCallback)((path, param) => {
				setTree((prev) => {
					if (!prev) return prev;
					const n = prev.get(path);
					if (!n) return prev;
					const next = pruneSubtree(prev, childPathOf(path, param));
					next.set(path, {
						tpl: n.tpl,
						values: {
							...n.values,
							[param]: {
								kind: "text",
								text: ""
							}
						}
					});
					return next;
				});
				if (editing?.path === path && editing?.param === param) setEditing(null);
				else if (editing && (editing.path === childPathOf(path, param) || editing.path.startsWith(`${childPathOf(path, param)}:`))) setEditing(null);
				setActivePath(path);
			}, [editing, pruneSubtree]);
			/** 解套：把子模板当前的组合结果（= 解套前的预览内容）赋值给该参数，并删除子树。 */
			const unnestParam = (0, react.useCallback)((path, param) => {
				const childKey = childPathOf(path, param);
				const n = tree?.get(path);
				const child = tree?.get(childKey);
				if (!n || !child) return;
				const resolved = composeNode(child);
				setTree((prev) => {
					if (!prev) return prev;
					const next = pruneSubtree(prev, childKey);
					next.set(path, {
						tpl: n.tpl,
						values: {
							...n.values,
							[param]: {
								kind: "text",
								text: resolved
							}
						}
					});
					return next;
				});
				setEditing({
					path,
					param
				});
				setActivePath(path);
				lastSync.current = resolved;
				actions?.setDraft(resolved);
				setNote(`已解套：参数「${param}」= 子模板组合结果（${resolved.length} 字符），可在聊天框继续改`);
			}, [
				tree,
				pruneSubtree,
				actions
			]);
			const resetDefault = (0, react.useCallback)(() => {
				const t = /* @__PURE__ */ new Map();
				t.set("root", {
					tpl: DEFAULT_ROOT,
					values: defaultValues(DEFAULT_ROOT)
				});
				setTree(t);
				setActivePath("root");
				setEditing({
					path: "root",
					param: "prompt"
				});
				setNote("已重置为默认标准模板 {{prompt}}");
			}, []);
			const pathNodes = (0, react.useCallback)((target) => {
				const out = [];
				if (!tree) return out;
				let cur = "root";
				while (tree.has(cur)) {
					out.push(cur);
					if (cur === target) break;
					const rest = target.slice(cur.length + 1);
					const idx = rest.indexOf(":");
					const stepParam = idx < 0 ? rest : rest.slice(0, idx);
					cur = childPathOf(cur, stepParam);
				}
				return out;
			}, [tree]);
			const rows = (0, react.useMemo)(() => {
				if (!tree) return [];
				const walk = (path, depth) => {
					const n = tree.get(path);
					if (!n) return [];
					const out = [{
						path,
						depth,
						node: n
					}];
					for (const p of n.tpl.params ?? []) {
						const v = n.values[p.name];
						if (v && v.kind === "tpl") out.push(...walk(childPathOf(path, p.name), depth + 1));
					}
					return out;
				};
				if (mode === "stack") return pathNodes(activePath).map((p, i) => ({
					path: p,
					depth: i,
					node: tree.get(p)
				}));
				return walk("root", 0);
			}, [
				tree,
				mode,
				activePath,
				pathNodes
			]);
			const rootNode = tree ? tree.get("root") ?? null : null;
			const fullText = (0, react.useMemo)(() => rootNode ? composeNode(rootNode) : "", [rootNode]);
			const ancestorEdges = (0, react.useMemo)(() => {
				const out = [];
				if (!activePath || activePath === "root") return out;
				let cur = "root";
				while (cur !== activePath) {
					const rest = activePath.slice(cur.length + 1);
					const idx = rest.indexOf(":");
					const stepParam = idx < 0 ? rest : rest.slice(0, idx);
					out.push({
						parentPath: cur,
						param: stepParam
					});
					cur = childPathOf(cur, stepParam);
					if (!tree?.has(cur)) break;
				}
				return out;
			}, [activePath, tree]);
			const paramsOf = (0, react.useCallback)((node) => {
				const tpl = node.tpl;
				const names = /* @__PURE__ */ new Set();
				const re = /\{\{\s*([\w-]+)\s*\}\}/g;
				let m;
				while ((m = re.exec(tpl.text ?? "")) !== null) names.add(m[1]);
				const declared = tpl.params ?? [];
				const ordered = declared.filter((p) => names.has(p.name) || !names.size);
				const extra = [...names].filter((nm) => !declared.some((p) => p.name === nm)).map((nm) => ({
					name: nm,
					label: nm
				}));
				return [...ordered, ...extra];
			}, []);
			const focusParam = (0, react.useCallback)((path, param) => {
				const n = tree?.get(path);
				if (!n) return;
				const val = n.values[param];
				setActivePath(path);
				if (val && val.kind === "tpl") {
					setEditing(null);
					setActivePath(childPathOf(path, param));
					setNote(`「${param}」是子模板——聚焦其所在行，编辑它自己的参数`);
					return;
				}
				const text = val?.kind === "text" ? val.text : "";
				setEditing({
					path,
					param
				});
				lastSync.current = text;
				actions?.setDraft(text);
			}, [tree, actions]);
			(0, react.useEffect)(() => {
				if (!editing) return;
				if (typeof snapshotDraft !== "string") return;
				if (snapshotDraft === lastSync.current) return;
				lastSync.current = snapshotDraft;
				setParamText(editing.path, editing.param, snapshotDraft);
			}, [snapshotDraft, editing]);
			const idleLast = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (!actions || !rootNode || editing) return;
				if (idleLast.current === fullText) return;
				idleLast.current = fullText;
				actions.setDraft(fullText);
			}, [
				actions,
				rootNode,
				editing,
				fullText
			]);
			const deliverRef = (0, react.useRef)(null);
			deliverRef.current = () => {
				if (!actions || !rootNode) return;
				actions.setDraft(fullText);
				const orig = origSubmitRef.current;
				if (orig) orig();
			};
			(0, react.useEffect)(() => {
				if (!actions?.submit) return;
				if (wrappedRef.current) return;
				const inst = actions;
				origSubmitRef.current = inst.submit.bind(actions);
				inst.submit = () => {
					if (rootNode) deliverRef.current?.();
					else origSubmitRef.current?.();
				};
				wrappedRef.current = true;
				return () => {
					if (wrappedRef.current && inst.submit !== origSubmitRef.current) inst.submit = origSubmitRef.current;
					wrappedRef.current = false;
				};
			}, [actions, rootNode]);
			(0, react.useEffect)(() => {
				const onKey = (e) => {
					if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
					if (!editing || !rootNode) return;
					const t = e.target;
					if (!t || !(t.tagName === "TEXTAREA" || t.isContentEditable)) return;
					e.preventDefault();
					deliverRef.current?.();
				};
				document.addEventListener("keydown", onKey, true);
				return () => document.removeEventListener("keydown", onKey, true);
			}, [editing, rootNode]);
			const valBadge = (val) => {
				if (!val) return "";
				if (val.kind === "text") {
					const t = val.text.replace(/\s+/g, " ");
					return t.length > 22 ? `${t.slice(0, 22)}…` : t;
				}
				return `↳${val.tpl.title}`;
			};
			const pickList = (title, onPick) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "pt-pick",
				style: { maxWidth: 540 },
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: title }), library.map((t) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					className: "pt-opt",
					onClick: () => onPick(t),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: t.title }), t.description ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [" — ", t.description] }) : null]
				}, t.id))]
			});
			const rowNodeCompose = (node) => composeNode(node);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "pt-tools",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "pt-edit-hint",
							children: editing ? `聊天框正在编辑参数「${editing.param}」` : activePath !== "root" ? "已聚焦子模板行：点击该行参数开始用聊天框编辑" : "点击参数用聊天框编辑；提交时交付整树组合（先「预览」核对）"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "pt-mode",
							title: "显示模式：栈（聚焦节点→根，默认）/ 树（完整树，可滚动）",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: mode === "stack" ? "on" : "",
								title: "栈模式（默认）：只显示 聚焦节点→根 的路径",
								onClick: () => setMode("stack"),
								children: "栈"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: mode === "tree" ? "on" : "",
								title: "树模式：完整模板树（滚动查看）",
								onClick: () => setMode("tree"),
								children: "树"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: "pt-ic",
							title: "预览整树：将交付给 agent 的内容",
							onClick: () => setPreview({
								title: "整树组合（交付内容）",
								text: fullText || "（空）"
							}),
							children: I.eye
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: "pt-ic",
							title: "重置为默认标准模板 {{prompt}}",
							onClick: resetDefault,
							children: I.reset
						}),
						note && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "pt-soft",
							children: note
						})
					]
				}),
				rootNode && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: `pt-wrap${mode === "tree" ? " pt-scroll" : ""}`,
					children: rows.map((row) => {
						const isActive = row.path === activePath;
						const paramRefs = paramsOf(row.node);
						const parentOfParam = (p) => ancestorEdges.find((a) => a.parentPath === row.path && a.param === p);
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: `pt-elem${isActive ? " active" : ""}`,
							style: { marginLeft: row.depth * 22 },
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "et",
									title: "点击聚焦本行",
									onClick: () => {
										setActivePath(row.path);
										setEditing(null);
									},
									children: row.node.tpl.title
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "pt-ic",
									title: "预览本行组合内容",
									onClick: () => setPreview({
										title: `本行预览：${row.node.tpl.title}`,
										text: rowNodeCompose(row.node) || "（空）"
									}),
									children: I.eye
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "pt-ic",
									title: "修改模板（更换本模板）",
									onClick: () => setPicker({
										kind: "replace",
										path: row.path
									}),
									children: I.tpl
								}),
								paramRefs.map((p) => {
									const val = row.node.values[p.name];
									const isTpl = !!val && val.kind === "tpl";
									const isFocus = editing?.path === row.path && editing?.param === p.name;
									const isAnc = !!parentOfParam(p.name);
									const cls = [
										"pt-param",
										isFocus ? "focus" : "",
										isAnc ? "anc" : ""
									].filter(Boolean).join(" ");
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: cls,
										title: isTpl ? `${p.label}：子模板（见下一行）` : `${p.label}：点击=用聊天框编辑`,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "lb",
												onClick: () => focusParam(row.path, p.name),
												children: p.label || p.name
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "val",
												children: valBadge(val)
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												className: "pt-ic",
												title: "预览该参数内容",
												onClick: () => {
													const text = !val ? "" : val.kind === "text" ? val.text : composeNode({
														tpl: val.tpl,
														values: val.values
													});
													setPreview({
														title: `参数预览：${p.label || p.name}`,
														text
													});
												},
												children: I.eye
											}),
											!isTpl ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												className: "pt-ic",
												title: "修改模板：用另一模板填充该参数（新行）",
												onClick: () => setPicker({
													kind: "param",
													at: row.path,
													param: p.name
												}),
												children: I.tpl
											}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												className: "pt-ic",
												title: "修改模板：更换该参数的子模板",
												onClick: () => setPicker({
													kind: "param",
													at: row.path,
													param: p.name
												}),
												children: I.tpl
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												className: "pt-ic",
												title: "解套：把子模板的组合结果填入该参数并改回文本",
												onClick: () => unnestParam(row.path, p.name),
												children: I.unnest
											})] }),
											!isTpl && val && val.kind === "text" && val.text !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												className: "pt-ic",
												title: "清空该参数",
												onClick: () => clearParam(row.path, p.name),
												children: I.clear
											})
										]
									}, p.name);
								})
							]
						}, row.path);
					})
				}),
				picker?.kind === "root" && pickList("选择根模板", setRootTpl),
				picker?.kind === "param" && pickList(`选择子模板填充参数「${picker.param}」`, (t) => setParamTpl(picker.at, picker.param, t)),
				picker?.kind === "replace" && pickList("修改模板（换成本模板）", (t) => replaceNodeTpl(picker.path, t)),
				preview !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "pt-modal-back",
					onClick: () => setPreview(null),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "pt-modal",
						onClick: (e) => e.stopPropagation(),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: preview.title }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: preview.text || "（空）" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "foot",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "pt-btn",
									onClick: () => setPreview(null),
									children: "关闭"
								})
							})
						]
					})
				})
			] });
		}
		function installStyles() {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-chat-prompt-templates";
			tag.textContent = CSS;
			document.head.appendChild(tag);
			return () => {
				for (const el of document.querySelectorAll("style[data-plugin=\"dsh-chat-prompt-templates\"]")) el.remove();
			};
		}
		function apply(ctx) {
			ctx.effect(() => installStyles(), "dsh-chat-prompt-templates: inline styles");
			ctx.slots.register({
				name: "conversation.input.dock",
				id: name,
				registrant: name,
				priority: 10
			}, (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PromptRoot, { ...props }));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map