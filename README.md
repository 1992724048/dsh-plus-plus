# dsh-plus-plus

DeepSeek Harness 多功能增强插件。

目标领域：主题、提示词、界面功能、对话优化、能力扩展。

**已实现：字体栈、直角化。** 浏览器半身按功能分模块，见「结构」。

## 状态

```
src/fonts.js       字体路由：把两个 npm 包的 woff2 与样式表喂给浏览器
index.js           宿主半身入口
client.js          浏览器半身（手写 ModuleLoader bundle，无构建步骤）
cordis.patch.yml   把宿主半身挂进 profile 合成
scripts/           宿主与浏览器两侧的自测
```

## 结构

按功能分模块，共享一层 core。**新增一个功能 = 新增一个 `client.<名字>.js` +
在 `client.js` 的 `CHUNKS` 里加一行，`client.js` 本身不用改。**

```
client.js          入口：加载 chunk、绑定 locale、渲染设置页骨架
client.core.js     公共层：功能注册表、样式表注入、双语字典校验
client.font.js     功能：字体栈
client.shape.js    功能：直角化
src/fonts.js       宿主：字体路由
index.js           宿主入口
scripts/           自测与探针
```

### 宿主支持分包

壳的 `__ModuleLoader__` 会解析 `require('dsh-plus-plus/client.<名字>.js')`，按
`client\.[A-Za-z0-9][A-Za-z0-9._-]*\.js` 取同目录的兄弟文件。文件名的 `client.` 前缀
是硬要求——不匹配就直接 `cannot resolve chunk`。

`package.json` 的 `exports` 因此要开一条通配：

```json
"./client": "./client.js",
"./client.*": "./client.*"
```

### 一个包只有一个浏览器半身

宿主的多组件机制是**多个 bundle 各占一行**，不是单个 bundle 内部拆。这不是设计
偏好，是壳里的硬约束（`client-modules` 源码可查）：

- 注册表只解析 `exports["./client"]`（**单数**），`parseDshClient` 只接受
  `platform` / `inject` / `external` / `immediately` 四个键——**没有 `components`**。
- 浏览器半身绑定在 `name` 为**裸包名**的那一行上；子路径行不带半身。

所以 `cordis.patch.yml` 只有一行，功能靠 `client.*.js` 分包，而不是多几行
`insert`。自测里有一条专门守这个：`the bundle patch registers exactly one row,
on the bare package name`——写成子路径会静默变成"只有宿主、没有浏览器"。

真要让每个功能成为独立可插拔的插件，得拆成多个 npm 包各自一行，代价是失去共享
的 core 层。

### 宿主怎么加载分包：`require` 不是分包接口

壳交给 factory 的 `require` 有**两个成员，语义完全不同**：

| 成员 | 行为 |
| --- | --- |
| `require(spec)` | **同步查模块表**。只认平台 seed 词（`react`、`react-dom`、`react/jsx-runtime`、`@deepseek-ai/cordis`、`@deepseek-ai/dsh-client-store`、`@deepseek-ai/dsh-client-ui-slots`、`-primitives`、`-dockkit`）或**已物化**的 graph row。其余一律抛 `missed the module table` |
| `require.async('./x.js')` | 分包路径。只接受**相对**路径、且文件名匹配 `client\.[A-Za-z0-9][A-Za-z0-9._-]*\.js`，返回 promise |

所以分包只能写 `require.async('./client.core.js')`。写
`require('dsh-plus-plus/client.core.js')` 在 Node 下能解析、自测也能过，**只在浏览器里
炸**——这条真的炸过一次。

分包名必须是 `./` 相对形式；`dsh-plus-plus/` 前缀只对 Node 自己的解析器有效（`npm pack`
和 `probe:install` 走的是那条路）。

`require.async` 返回 promise，所以 `apply` 是 async 的；壳会 await 客户端的 `apply`，没问题。

### 功能 chunk 不自己注册

`defineFeature` 在 core chunk 里，而 core 只能**异步**拿到，所以功能 chunk 在 factory 里
没法调它。改为：功能 chunk **导出** `descriptor`，由入口在 await 完之后统一交给
`core.defineFeature`。入口是两个半身唯一的会合点。

新增一个功能仍然只是：一个 `client.<名字>.js` + `CHUNKS` 里加一行。

### core 提供什么

功能 chunk 不碰 `document`、不注册 locale、也不管样式表什么时候被移除：

| 导出 | 作用 |
| --- | --- |
| `defineFeature(descriptor)` | 声明一个功能；重复 id 直接抛错，不静默覆盖 |
| `listFeatures()` | 按 `order` 升序返回全部功能 |
| `styleSheet(css, label)` | 插入样式表并返回 disposer |
| `registerStyles(ctx, css, label)` | 同上，但自己开 effect，调用方不必管生命周期 |
| `dictionaries(name, dicts)` | 校验双语平衡，**指出具体缺哪个键** |

功能描述符的字段：`id` `group` `order` `locale` `css` `settings` `apply`。
`client.js` 只认这七个，所以加字段不用改入口。

### 三条设计约定

**core 是跨 chunk 的单例。** 功能注册表是模块级数组，这正是多个 chunk 共享同一份
列表的原因。副作用是自测里每次 boot 都必须新建模块缓存，否则上一个 chunk 声明的功能
会累积——这一点在 `client-selftest.mjs` 的 `boot()` 里有注释说明。

**字典按功能 id 加前缀后合并。** 每个功能只管自己的 `{ zh, en }`，入口合并成
`font.font.title` 这样的键再统一注册一次。这样 `locale.register` 的双语平衡检查仍然
只有一次调用，而 `core.dictionaries` 能在合并**之前**就指出是哪个功能的哪个键不对。

**`order` 是样式表的胜负手。** 功能各自贡献样式表，同特异性下后加载的赢。
`shape` 声明为 20、`font` 为 10，就是为了让直角扫除规则最后生效——否则字体的某条
规则可能把圆角带回来。

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

30 项自测：宿主侧 9 项（路由注册与卸载、MIME 与缓存头、相对 URL 解析、穿越防护、
扩展名白名单），浏览器侧 22 项（入口解析、`apply()` 跑完、**所有同步 `require` 都是
seed 词**、**所有分包都走 `require.async` 且 core 只物化一次**、CHUNKS 里必须是相对
路径且首个是 core、**功能 chunk 不得同步 require core**、不引用 loader 未提供的自由变量、
patch 只有一行且用裸包名、chunk 文件名合规、磁盘上的 chunk 与入口 require 完全一致、
core 单例、每个功能声明完整、启动顺序递增、重复 id 抛错、双语不平衡报错并指出键名、
合并后字典平衡、设置页组合出每节、effect 不重复注册、每条 `@import` 都指向磁盘上真实
存在且在包根内的文件、宿主字体变量被重指向、六个圆角 token 归零、扫除规则带
`!important` 且没有全局 `corner-shape`）。

> 前两条是这轮故障的直接教训：**自测的 `require` 必须和壳的完全一致**。之前用一个
> 什么 specifier 都接受的宽松桩，于是 `missed the module table` 这类只在浏览器里出现的
> 失败被整整放过了两轮。现在桩分成 `require` / `require.async` 两个成员，并记录每次调用。

> 「磁盘上的 chunk 与入口 require 完全一致」是防漂移那一条：磁盘上有但没人 require
> 的是死代码；require 了但磁盘上没有的，会在浏览器里加载失败。

## 已实现：直角化

整个界面改为直角，**头像、状态点、进度环这类真正该是圆形的地方保留**。写死，
没有开关。

宿主把整个圆角体系收在六个变量里，绝大部分 CSS 读的是变量而不是硬编码长度，
所以归零这六个就覆盖了面板、卡片、输入框、按钮、代码块、模态框：

```css
--dsw-radius-xs / sm / md / lg / xl / panel: 0px
```

另有五个由该刻度派生出来的特性级 token 一并归零，避免主题里的旧值漏过来：
`--dsl-code-block-border-radius`、`--dsl-guide-entry-radius`、`--dsl-search-radius`、
`--dsl-terminal-radius`、`--dsl-web-radius`。

### 硬编码的那部分

宿主还有 **163 处**直接写死 `px` 长度的圆角，没有任何变量能覆盖，其中包括 27 处
`999px` 的胶囊形（标签、chip、小按钮）。这部分只能靠扫：

```css
* { border-radius: 0 !important; }
```

`!important` 是必需的：宿主规则是 class 选择器 `(0,1,0)`，通配符是 `(0,0,0)`，
不加就输了，输赢还取决于哪张表后加载。

### 怎么把圆形留下

上面那条会连 37 处 `border-radius: 50%` 一起抹平——头像、状态点、复选框旋钮、
进度环，正是你要求保留的。

宿主给这些规则标了 **`corner-shape: round`**（37 条里有 33 条和 `50%` 同时出现），
这是 CSS Shapes 的属性。于是按这个标记精确恢复：

```css
[style*="corner-shape"] { corner-shape: square !important; }
```

只对宿主显式标记为 round 的元素改写，其他一律不动。

> 前提：这依赖 Chromium 的 CSS Shapes `corner-shape`。目前 Electron 44 支持；若将来
> 不支持，退化结果是「圆形元素也变直角」——界面仍然一致，只是少了圆形。

## 探针

另有两个诊断脚本，它们不是测试，是**没有浏览器时用来复现启动故障的探针**：
```bash
npm run probe:client    # 按 loader 的方式跑一遍，含分包解析，打印 apply() 抛什么
npm run probe:install   # 从 profile 视角验证依赖解析与每个 chunk 的 exports（见下面）
```

## 开发流程：profile 用 junction 指向本仓库

本仓库通过 `file:` 挂进 profile，但 **pnpm 默认是拷贝，不是链接**——改完仓库，
profile 里跑的还是旧代码；而且 `pnpm install` 会因为锁文件认为「Already up to
date」而拒绝刷新。

所以装好后把 profile 里那份拷贝换成指向仓库的 junction：

```powershell
$nm   = "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\dsh-plus-plus"
$repo = "D:\CODE\dsh-plus-plus"
Remove-Item -Recurse -Force -LiteralPath $nm
New-Item -ItemType Junction -Path $nm -Target $repo
```

之后**改仓库即刻生效**，重启应用即可，不用再同步。

字体包不会丢：仓库自己有 `node_modules`，junction 让 `require.resolve` 顺着
junction 落到 `D:\CODE\dsh-plus-plus\node_modules`。`npm run probe:install` 守的
就是这条——它从 profile 视角解析两个字体包、经 junction 加载 `src/fonts.js` 问
`assetRoot()`，再逐个解析 `client.*.js` 确认 `exports` 通配生效，任何一环断了立刻
报出来。

> 别对 junction 跑 `install_bundle`：pnpm 会把链接替换回拷贝。要改依赖，先在
> 仓库里改 `package.json` 并 `npm install`，再删掉 profile 里那份重建 junction。

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
- **`webServer.register({ kind, path, handler })`** —— `kind` 是 `'exact'` 或
  `'prefix'`，**不按 method 匹配**；handler 收到 `(req, res)`，没有 `match` 参数。
  `prefix` 路由拿到的是**完整 pathname**，得自己剥掉路由前缀。
- **两条 client 路径，只有 `styles` 属于其中一条。** `dsh.client` 声明的 bundle
  走 `window.__ModuleLoader__`，factory **只收到 `require`** 一个参数；
  而 `styles` / `host` / `harness` 这些内建只注入 `evaluateClientHalf`
  ——**动态 client half 路径**。在 `__ModuleLoader__` bundle 里引用 `styles`
  会抛 `styles is not defined`，导致 `apply()` 失败、整个 entry 启动不了。
  插样式表请用 `document.createElement('style')`（参考插件 `dsh-our-free-model`
  就是这么做的）。
  顺带：`Builtin` inspect 会把 `styles` 列为内建，容易误以为两条路径都有。
- **一个包只有一个浏览器半身。** `exports["./client"]` 是单数，`parseDshClient` 只认
  `platform` / `inject` / `external` / `immediately`，**没有 `components`**；而且半身
  绑定在 `name` 为裸包名的那一行，子路径行不带半身。宿主的多组件是「多 bundle
  各占一行」，不是「一个 bundle 内拆」。详见「结构」。
- **`require` 不是分包接口。** 它是同步查模块表，只认 8 个平台 seed 词或已物化的
  graph row；分包必须用 `require.async('./client.*.js')`。详见「结构」。

## 下一步

按领域逐个细化需求再动手：提示词、对话优化、能力扩展。每个领域 = 一个新的
`client.<名字>.js` 加一行 `CHUNKS`。
