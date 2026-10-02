# dsh-plus-plus

DeepSeek Harness 多功能增强插件。

目标领域：主题、提示词、界面功能、对话优化、能力扩展。**目前只实现了字体。**

## 状态

```
src/fonts.js       字体路由：把两个 npm 包的 woff2 与样式表喂给浏览器
index.js           宿主半身入口
client.js          浏览器半身（手写 ModuleLoader bundle，无构建步骤）
cordis.patch.yml   把宿主半身挂进 profile 合成
scripts/           宿主与浏览器两侧的自测
```

## 已实现：字体栈

**JetBrains Mono 优先，鸿蒙字体兜底中文，两者都来自 npm 依赖，不吃系统安装。**

```bash
npm install @fontsource/jetbrains-mono harmonyos-sans-webfont-splitted
```

浏览器半身发的样式表：

```css
--pp-font-mono: 'JetBrains Mono', 'HarmonyOS Sans', ui-monospace, …;
--pp-font-sans: 'HarmonyOS Sans', system-ui, …;
```

浏览器按**字符**逐个解析这条列表，所以一行里混排时拉丁字母走 JetBrains Mono、
汉字自动落到鸿蒙字体，不需要再写 `unicode-range` 去切换。

两个包各自的样式表都带 `local()` 优先声明，机器上碰巧装了字体就直接用、不下载分片；
npm 包是**兜底保证**，不是首选。

### 为什么走一条路由而不是打包器

`client.js` 是手写 ModuleLoader bundle，没有构建步骤，也就没有打包器去 hash、inline 或
base64 这些字体。宿主因此用一条 `prefix` 路由 `/api/dsh-plus-plus/fonts/*` 把它们发出去。

每个包从**各自的包根**提供，因为它们自带的样式表用相对 `url()`：
`@fontsource/jetbrains-mono` 写 `./files/…`，鸿蒙包写 `./Regular/…`。样式表原样透传、
一个字都不改，相对地址自然继续成立。自测里有一条专门守着这个约定——包根一旦挪位就会红。

中文侧每个字重切了约 82 个分片（`unicode-range`），4.6 MB/字重，但页面**只会下载屏幕上
真正出现过的字块**。装包本身不小（整个包约 63 MB），运行时只取用到的那几块。

### 安全

路由同源可达，所以按静态文件服务器的标准做法收紧：

- 扩展名白名单（仅 `woff2` / `woff` / `css`），其余 403
- 路径包含 `..` 或 NUL 直接 400，不做规范化——`%2e%2e` 会漏过
- 解析后再校验绝对路径仍位于包根之内

## 开发

```bash
npm test
```

15 项自测：宿主侧 9 项（路由注册与卸载、MIME 与缓存头、相对 URL 解析、穿越防护、
扩展名白名单），浏览器侧 6 项（bundle 解析、双语字典键一致、每条 `@import` 都指向
磁盘上真实存在且在包根内的文件、字体栈顺序）。

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
