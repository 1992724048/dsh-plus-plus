# dsh-plus-plus

DeepSeek Harness 多功能增强插件 —— **仓库骨架，功能待定**。

目标领域（尚未细化）：主题、提示词、界面功能、对话优化、能力扩展。

## 状态

当前只有仓库基础设施，没有任何功能代码：

```
.gitignore        忽略依赖、构建产物与 tmp/ 等运行时残留
README.md         本文件
```

插件本体尚未创建。下面这些是**确定要做**的事，不是已经做完的事：

- [ ] `package.json` —— 声明 bundle patch 与浏览器半身
- [ ] `cordis.patch.yml` —— 把宿主半身挂进 profile 合成
- [ ] `index.js` —— 宿主半身入口
- [ ] `client.js` —— 浏览器半身（手写 ModuleLoader bundle，无构建步骤）
- [ ] `scripts/` —— 打包前置检查与自测

## 已确认的技术约束

这几条是侦察宿主后查实的，会影响后续所有实现，写在这里免得重新踩：

- **`inject` 保持为空。** Cordis 会把 fiber 里未点名且尚未出现的服务一直挂起。
  纯增强型插件不能有硬依赖，任何服务缺席都只应退化单项功能，因此走 `ctx.get()`
  （缺失回答 `undefined`）与 `ctx.on()`（没人发的事件直接忽略）。
- **只用加法插槽。** 插槽树标了 `replaceRisk`：`settings.section`、
  `conversation.composer.dock` 等是 `none`（可安全追加），而任何 `single` 位
  （如 `conversation.composer.bar`、`sidebar.settings`）注册进去会顶掉自带 UI。
- **`ThemeDefinition` 是 `{ id, colorScheme, tokens }`** —— 单一明暗态 + 扁平
  token 表。`{ light, dark }` 双值对属于 `overrideTokens(source, tokens)`，
  那是叠在当前主题之上的分层，不进注册表。
- **可用主题令牌**：`--dsw-alias-*` 系列（bg-base / bg-layer-1..2 / bg-overlay /
  border-l1..2 / brand-primary / label-primary..secondary / state-error /
  state-idle / state-success / state-warn）以及 `--dsw-specific-sidebar-fill`。
- **`locale.register(ns, { zh, en })`** 一次登记所有语言并强制双语平衡，缺一个
  `en` 会在浏览器里注册失败；`locale.bind(ns)` 返回稳定引用，调用时读当前语言，
  切语言无需重新绑定。宿主自己的 `t` 不做插值，插值要自己 `.replace('{n}', …)`。
- **数据可用自己的同源路由**：`webServer.register({ method, path, handler })`，
  handler 收到 `(request, response, match)`。相比 typed Remote 绑定，这条路在
  缺传输的合成上也能用。

## 下一步

按领域逐个细化需求再动手。先从**主题**开始。
