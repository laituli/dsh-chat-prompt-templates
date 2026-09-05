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
		const name = "dsh-chat-prompt-templates";
		/** client 侧注入：slots（槽位服务，client runtime 提供）。 */
		const inject = ["slots"];
		const BUILTIN = [{
			id: "custom-single",
			title: "自定义（单个参数）",
			description: "只有一个文本参数：直接在聊天框里描述您想要构建的内容。",
			text: "{{prompt}}",
			params: [{
				name: "prompt",
				label: "内容",
				example: ""
			}]
		}];
		const DEFAULT_PRESET_URLS = ["http://127.0.0.1:3079/api/prompt-presets"];
		const STORAGE_PRESET_URLS = "dsh-chat-prompt-templates:presetUrls";
		function defaultValues(tpl) {
			const values = {};
			for (const p of tpl.params ?? []) values[p.name] = {
				kind: "text",
				text: ""
			};
			return values;
		}
		/** 深度组合：把节点文本里的 {{param}} 替换为值（文本或子模板组合文本）。 */
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
`;
		const childPathOf = (at, param) => `${at}:${param}`;
		function PromptRoot(props) {
			const [library, setLibrary] = (0, react.useState)(BUILTIN);
			const [presetUrls] = (0, react.useState)(() => {
				try {
					const raw = localStorage.getItem(STORAGE_PRESET_URLS);
					return raw ? JSON.parse(raw) : DEFAULT_PRESET_URLS;
				} catch {
					return DEFAULT_PRESET_URLS;
				}
			});
			const [tree, setTree] = (0, react.useState)(null);
			const [viewPath, setViewPath] = (0, react.useState)("root");
			const [editing, setEditing] = (0, react.useState)(null);
			const [pickerFor, setPickerFor] = (0, react.useState)(null);
			const [rootPickerOpen, setRootPickerOpen] = (0, react.useState)(false);
			const [preview, setPreview] = (0, react.useState)(null);
			const [note, setNote] = (0, react.useState)("");
			const lastSync = (0, react.useRef)("");
			const actions = props.inputActions;
			const snapshotDraft = props.input?.draft;
			(0, react.useEffect)(() => {
				let alive = true;
				(async () => {
					for (const url of presetUrls) try {
						const res = await fetch(url, { headers: { accept: "application/json" } });
						if (!res.ok) continue;
						const presets = (await res.json()).value?.presets;
						if (Array.isArray(presets) && presets.length) {
							if (alive) {
								setLibrary((prev) => {
									const ids = new Set(prev.map((t) => t.id));
									const fresh = presets.filter((t) => t && t.id && !ids.has(t.id));
									return fresh.length ? [...prev, ...fresh] : prev;
								});
								setNote(`已载入预设源 ${url}（${presets.length} 条）`);
							}
						}
					} catch {}
				})();
				return () => {
					alive = false;
				};
			}, []);
			const instantiate = (0, react.useCallback)((tpl) => {
				return {
					tpl,
					values: defaultValues(tpl)
				};
			}, []);
			const chooseRoot = (0, react.useCallback)((tpl) => {
				const next = /* @__PURE__ */ new Map();
				next.set("root", instantiate(tpl));
				setTree(next);
				setViewPath("root");
				setEditing(null);
				setRootPickerOpen(false);
				setPickerFor(null);
				setNote(`已选模板「${tpl.title}」——点行内参数=用聊天框编辑它；点「应用到聊天框」组合全文`);
			}, [instantiate]);
			/** 参数设为嵌套模板实例（childPath = at:param 的新节点），并切到该子节点。 */
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
				setViewPath(childPathOf(at, param));
				setEditing(null);
				setPickerFor(null);
				setNote(`参数「${param}」使用了子模板「${tpl.title}」——继续编辑它的参数`);
			}, [instantiate]);
			const setParamText = (0, react.useCallback)((at, param, text) => {
				setTree((prev) => {
					if (!prev) return prev;
					const n = prev.get(at);
					if (!n) return prev;
					const next = new Map(prev);
					next.set(at, {
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
			const clearParam = (0, react.useCallback)((at, param) => {
				setTree((prev) => {
					if (!prev) return prev;
					const next = new Map(prev);
					const n = next.get(at);
					if (!n) return prev;
					next.set(at, {
						tpl: n.tpl,
						values: {
							...n.values,
							[param]: {
								kind: "text",
								text: ""
							}
						}
					});
					next.delete(childPathOf(at, param));
					return next;
				});
				if (editing?.path === at && editing?.param === param) setEditing(null);
			}, [editing]);
			const clearAll = (0, react.useCallback)(() => {
				setTree(null);
				setViewPath("root");
				setEditing(null);
				setPickerFor(null);
				setPreview(null);
				setNote("已清除模板（手输模式）");
			}, []);
			const nodeAt = (0, react.useCallback)((path) => tree ? tree.get(path) ?? null : null, [tree]);
			const root = nodeAt("root");
			const viewNode = nodeAt(viewPath);
			const paramList = (0, react.useMemo)(() => {
				if (!viewNode) return [];
				const tpl = viewNode.tpl;
				const names = /* @__PURE__ */ new Set();
				const re = /\{\{\s*([\w-]+)\s*\}\}/g;
				let m;
				while ((m = re.exec(tpl.text ?? "")) !== null) names.add(m[1]);
				const ordered = (tpl.params ?? []).filter((p) => names.has(p.name) || !tpl.text.includes("{{"));
				const extra = [...names].filter((nm) => !(tpl.params ?? []).some((p) => p.name === nm)).map((nm) => ({
					name: nm,
					label: nm
				}));
				return [...ordered, ...extra];
			}, [viewNode]);
			const fullText = (0, react.useMemo)(() => root ? composeNode(root) : "", [root]);
			const breadcrumb = (0, react.useMemo)(() => {
				if (!tree) return [];
				const parts = [];
				let cur = "root";
				const n0 = tree.get(cur);
				if (!n0) return [];
				parts.push({
					path: cur,
					tpl: n0.tpl
				});
				while (cur !== viewPath) {
					const rest = viewPath.slice(cur.length + 1);
					const idx = rest.indexOf(":");
					const stepParam = idx < 0 ? rest : rest.slice(0, idx);
					const child = childPathOf(cur, stepParam);
					const n = tree.get(child);
					if (!n) break;
					parts.push({
						path: child,
						tpl: n.tpl,
						via: stepParam
					});
					cur = child;
				}
				return parts;
			}, [tree, viewPath]);
			const focusParam = (0, react.useCallback)((path, param) => {
				const n = nodeAt(path);
				if (!n) return;
				const val = n.values[param];
				if (!val || val.kind === "text") {
					const text = val?.kind === "text" ? val.text : "";
					setEditing({
						path,
						param
					});
					lastSync.current = text;
					actions?.setDraft(text);
					setNote(`正在编辑参数「${param}」：直接在聊天框输入即可（即改即存）`);
				} else {
					setViewPath(childPathOf(path, param));
					setEditing(null);
				}
			}, [nodeAt, actions]);
			(0, react.useEffect)(() => {
				if (!editing) return;
				if (typeof snapshotDraft !== "string") return;
				if (snapshotDraft === lastSync.current) return;
				lastSync.current = snapshotDraft;
				setParamText(editing.path, editing.param, snapshotDraft);
			}, [snapshotDraft, editing]);
			const previewParam = (0, react.useCallback)((path, param) => {
				const n = nodeAt(path);
				if (!n) return;
				const val = n.values[param];
				const text = !val ? "" : val.kind === "text" ? val.text : composeNode({
					tpl: val.tpl,
					values: val.values
				});
				setPreview({
					title: `参数预览：${param}`,
					text
				});
			}, [nodeAt]);
			const applyToChat = (0, react.useCallback)(() => {
				if (!root) return;
				actions?.setDraft(fullText);
				setNote(`已把组合后的完整提示词放到聊天框（长度 ${fullText.length}），可直接发送；需要改参数就点栈里的参数`);
				setPreview(null);
			}, [
				root,
				fullText,
				actions
			]);
			const valBadge = (val) => {
				if (!val) return "";
				if (val.kind === "text") {
					const t = val.text.replace(/\s+/g, " ");
					return t.length > 24 ? `${t.slice(0, 24)}…` : t;
				}
				return `子模板:${val.tpl.title}`;
			};
			const pickList = (onPick) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "pt-pick",
				style: { maxWidth: 480 },
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: "选择提示词模板（参数可再嵌套模板）" }),
					library.map((t) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						className: "pt-opt",
						onClick: () => onPick(t),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: t.title }), t.description ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [" — ", t.description] }) : null]
					}, t.id)),
					note && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "pt-meta",
						style: {
							color: "#8b949e",
							fontSize: 11,
							padding: "4px 6px 0"
						},
						children: note
					})
				]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "pt-bar",
					children: !root ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						className: "pt-chip on",
						onClick: () => setRootPickerOpen((v) => !v),
						children: "提示词模板"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							color: "#8b949e",
							fontSize: 11
						},
						children: "下一轮提示词从模板替换：参数直接用聊天框编辑，可嵌套模板，可预览后应用"
					})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: "pt-chip on",
							onClick: () => setRootPickerOpen((v) => !v),
							children: "换模板"
						}),
						breadcrumb.map((b, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "pt-line",
							children: [
								i > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "sep",
									children: "›"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: `pt-crumb${b.path === viewPath ? " cur" : ""}`,
									title: b.tpl.description ?? "",
									onClick: () => {
										setViewPath(b.path);
										setEditing(null);
									},
									children: [b.tpl.title, b.via ? ` @${b.via}` : ""]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "pt-btn",
									title: "预览本层内容",
									onClick: () => setPreview({
										title: `模板内容：${b.tpl.title}`,
										text: b.tpl.text ?? ""
									}),
									children: "预览"
								})
							]
						}, b.path)),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "sep",
							style: { color: "#30363d" },
							children: "|"
						}),
						paramList.map((p) => {
							const val = viewNode?.values[p.name];
							const isEdit = editing?.path === viewPath && editing?.param === p.name;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: `pt-param${isEdit ? " focus" : ""}`,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "lb",
										title: "点击：聊天框切到该参数进行编辑",
										onClick: () => focusParam(viewPath, p.name),
										children: p.label || p.name
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "val",
										children: valBadge(val)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "pt-btn",
										title: "预览该参数内容",
										onClick: () => previewParam(viewPath, p.name),
										children: "预览"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "pt-btn warn",
										title: "用嵌套模板填充该参数",
										onClick: () => setPickerFor({
											at: viewPath,
											param: p.name
										}),
										children: "嵌套"
									}),
									val && (val.kind === "text" ? val.text !== "" : true) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "pt-btn",
										title: "清空该参数",
										onClick: () => clearParam(viewPath, p.name),
										children: "✕"
									})
								]
							}, p.name);
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
						editing && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "pt-edit-hint",
							children: [
								"正在聊天框编辑参数「",
								editing.param,
								"」"
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: "pt-btn",
							onClick: () => setPreview({
								title: "提示词完整预览",
								text: fullText
							}),
							children: "预览全文"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: "pt-btn pri",
							onClick: applyToChat,
							children: "应用到聊天框"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: "pt-btn",
							onClick: clearAll,
							children: "清空模板"
						})
					] })
				}),
				pickerFor && pickList((t) => setParamTpl(pickerFor.at, pickerFor.param, t)),
				rootPickerOpen && pickList(chooseRoot),
				preview !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "pt-modal-back",
					onClick: () => setPreview(null),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "pt-modal",
						onClick: (e) => e.stopPropagation(),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: preview.title }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: preview.text || "（空）" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "foot",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "pt-btn",
									onClick: () => setPreview(null),
									children: "关闭"
								}), preview.title.startsWith("提示词完整预览") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "pt-btn pri",
									onClick: applyToChat,
									children: "应用(替换输入框草稿)"
								})]
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