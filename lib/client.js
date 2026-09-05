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
		const name = "dsh-chat-prompt-templates";
		/** client 侧注入：slots（槽位服务，client runtime 提供）。 */
		const inject = ["slots"];
		const BUILTIN = [{
			id: "custom-single",
			title: "自定义（单个参数）",
			description: "默认模板：只有一个文本参数，直接沿用聊天框。",
			text: "{{prompt}}",
			params: [{
				name: "prompt",
				label: "内容",
				example: "帮我做…"
			}]
		}];
		const DEFAULT_PRESET_URLS = ["http://127.0.0.1:3079/api/prompt-presets"];
		const STORAGE_PRESET_URLS = "dsh-chat-prompt-templates:presetUrls";
		function paramNames(tpl) {
			const names = /* @__PURE__ */ new Set();
			const re = /\{\{\s*([\w-]+)\s*\}\}/g;
			let m;
			while ((m = re.exec(tpl.text)) !== null) names.add(m[1]);
			return [...names];
		}
		/** 深度组合：把节点文本里的 {{param}} 替换为其值（文本或子模板组合文本）。 */
		function composeNode(node) {
			const text = node.tpl.text ?? "";
			const seen = /* @__PURE__ */ new Set();
			const resolved = /* @__PURE__ */ new Map();
			const resolve = (name) => {
				if (resolved.has(name)) return resolved.get(name);
				const val = node.values[name];
				if (!val) return "";
				if (seen.has(name)) return "";
				seen.add(name);
				const out = val.kind === "text" ? val.text : composeNode({
					tpl: val.tpl,
					values: val.values
				});
				resolved.set(name, out);
				return out;
			};
			return text.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_all, name) => resolve(name));
		}
		function defaultValues(tpl) {
			const values = {};
			for (const p of tpl.params ?? []) values[p.name] = {
				kind: "text",
				text: p.example ?? ""
			};
			return values;
		}
		function placeholders(tpl) {
			const names = paramNames(tpl);
			return names.length ? names : (tpl.params ?? []).map((p) => p.name);
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
`;
		function PromptRoot(props) {
			const [library, setLibrary] = (0, react.useState)(BUILTIN);
			const [presetUrls, setPresetUrls] = (0, react.useState)(() => {
				try {
					const raw = localStorage.getItem(STORAGE_PRESET_URLS);
					return raw ? JSON.parse(raw) : DEFAULT_PRESET_URLS;
				} catch {
					return DEFAULT_PRESET_URLS;
				}
			});
			const [tree, setTree] = (0, react.useState)(null);
			const [rootPath, setRootPath] = (0, react.useState)(null);
			const [focusPath, setFocusPath] = (0, react.useState)("root");
			const [pickerFor, setPickerFor] = (0, react.useState)(null);
			const [rootPickerOpen, setRootPickerOpen] = (0, react.useState)(false);
			const [preview, setPreview] = (0, react.useState)(null);
			const [note, setNote] = (0, react.useState)("");
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
			const nodeAt = (0, react.useCallback)((path) => {
				if (!tree) return null;
				return tree.get(path) ?? null;
			}, [tree]);
			const childPathOf = (at, param) => `${at}:${param}`;
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
				setRootPath("root");
				setFocusPath("root");
				setRootPickerOpen(false);
				setNote(`已选模板：${tpl.title} —— 填好参数后可「预览」再「应用到输入框」`);
			}, [instantiate]);
			/** 把 at 节点某参数设为嵌套模板实例（childPath = at:param 的新节点）。 */
			const setParamTpl = (0, react.useCallback)((at, param, tpl) => {
				setTree((prev) => {
					if (!prev) return prev;
					const next = new Map(prev);
					const n = next.get(at);
					if (!n) return prev;
					const copy = {
						tpl: n.tpl,
						values: { ...n.values }
					};
					const child = instantiate(tpl);
					next.set(childPathOf(at, param), child);
					copy.values[param] = {
						kind: "tpl",
						tpl: child.tpl,
						values: child.values
					};
					next.set(at, copy);
					return next;
				});
				setFocusPath(childPathOf(at, param));
				setPickerFor(null);
			}, [instantiate]);
			const setParamText = (0, react.useCallback)((at, param, text) => {
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
				setFocusPath(at);
			}, []);
			const root = tree ? nodeAt("root") ?? null : null;
			const focusNode = tree ? nodeAt(focusPath) ?? null : null;
			const breadcrumb = (0, react.useMemo)(() => {
				if (!tree || !rootPath) return [];
				const parts = [];
				let cur = "root";
				parts.push({
					path: cur,
					tpl: tree.get(cur).tpl
				});
				while (cur !== focusPath) {
					const prefix = cur + ":";
					const rest = focusPath.slice(prefix.length);
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
			}, [
				tree,
				focusPath,
				rootPath
			]);
			const fullText = (0, react.useMemo)(() => {
				if (!root) return "";
				return composeNode(root);
			}, [root]);
			const apply = (0, react.useCallback)(() => {
				if (!root) return;
				const actions = props.inputActions;
				if (!actions) {
					setNote("未取得输入区 actions（当前界面无会话输入？）");
					return;
				}
				actions.setDraft(fullText);
				setNote(`已应用到输入框（长度 ${fullText.length}）——可直接发送；用「清除模板」恢复手输`);
				setPreview(null);
			}, [
				root,
				fullText,
				props.inputActions
			]);
			const clearAll = (0, react.useCallback)(() => {
				setTree(null);
				setRootPath(null);
				setFocusPath("root");
				setPreview(null);
				setPickerFor(null);
				setNote("已清除模板（手输模式）");
			}, []);
			const focusNodePathParams = focusNode ? placeholders(focusNode.tpl) : [];
			const focusValues = focusNode?.values ?? {};
			const pickList = (onPick) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "pt-pick",
				style: { maxWidth: 480 },
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: "选择提示词模板（可参数嵌套）" }),
					library.map((t) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						className: "pt-opt",
						onClick: () => onPick(t),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: t.title }), t.description ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("small", { children: [" — ", t.description] }) : null]
					}, t.id)),
					note && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "pt-meta",
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
						className: "pt-meta",
						children: "下一轮提示词从模板替换；参数可嵌套模板（树），可预览后应用"
					})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: "pt-chip on",
							onClick: () => setRootPickerOpen((v) => !v),
							children: "换模板"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "pt-stack",
							children: breadcrumb.map((b, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: {
									display: "inline-flex",
									alignItems: "center",
									gap: 3
								},
								children: [i > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "sep",
									children: "›"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: `pt-bread${b.path === focusPath ? " cur" : ""}`,
									title: b.tpl.description ?? b.tpl.title,
									onClick: () => setFocusPath(b.path),
									children: [b.tpl.title, b.via ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("em", {
										style: {
											opacity: .7,
											marginLeft: 4
										},
										children: ["@", b.via]
									}) : null]
								})]
							}, b.path))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: "pt-btn",
							onClick: () => setPreview(fullText),
							children: "预览(modal)"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: "pt-btn pri",
							onClick: apply,
							children: "应用到输入框"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: "pt-btn",
							onClick: clearAll,
							children: "清除模板"
						})
					] })
				}),
				root && focusNode && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "pt-panel",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "pt-row",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: focusNode.tpl.title }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "pt-meta",
								children: [
									focusNode.tpl.description ?? "",
									" 参数：",
									focusNodePathParams.length || 0
								]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "pt-meta",
							style: {
								whiteSpace: "pre-wrap",
								maxHeight: 80,
								overflow: "auto"
							},
							children: focusNode.tpl.text
						}),
						(focusNode.tpl.params ?? []).map((p) => {
							const val = focusValues[p.name];
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "pt-row",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										style: {
											minWidth: 110,
											fontSize: 11,
											color: "#8b949e"
										},
										children: p.label || p.name
									}),
									!val || val.kind === "text" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "pt-in",
										value: val?.kind === "text" ? val.text : "",
										placeholder: p.example ?? `填 ${p.name}…`,
										onChange: (e) => setParamText(focusPath, p.name, e.target.value)
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "pt-meta",
										children: [
											"来自模板「",
											val.tpl.title,
											"」"
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "pt-btn",
										onClick: () => setPickerFor({
											at: focusPath,
											param: p.name
										}),
										children: val?.kind === "tpl" ? "改子模板" : "选模板"
									}),
									val && val.kind === "tpl" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "pt-btn",
										onClick: () => setFocusPath(childPathOf(focusPath, p.name)),
										children: "编辑子模板 ›"
									}),
									val && (val.kind === "text" ? val.text !== "" : true) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "pt-btn",
										title: "清空该参数",
										onClick: () => clearParam(focusPath, p.name),
										children: "✕"
									})
								]
							}, p.name);
						}),
						focusNodePathParams.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "pt-meta",
							children: "（无参数）"
						})
					]
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
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: "提示词完整预览（可编辑后应用）" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								value: preview,
								onChange: (e) => setPreview(e.target.value),
								spellCheck: false,
								style: {
									flex: 1,
									margin: 0,
									padding: 14,
									background: "#0d1117",
									color: "#c9d1d9",
									border: 0,
									outline: "none",
									font: "12px/1.6 ui-monospace, monospace",
									resize: "none"
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "foot",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "pt-btn",
									onClick: () => setPreview(null),
									children: "关闭"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "pt-btn pri",
									onClick: () => {
										setPreview(null);
										apply();
									},
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