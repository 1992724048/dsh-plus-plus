# dsh-plus-plus

DeepSeek Harness 多功能增强插件。

目标领域：主题、提示词、界面功能、对话优化、能力扩展。

**已实现：字体栈、直角化。**

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

20 项自测：宿主侧 9 项（路由注册与卸载、MIME 与缓存头、相对 URL 解析、穿越防护、
扩展名白名单），浏览器侧 11 项（bundle 解析、`apply()` 跑完、不引用 loader 未提供
的自由变量、双语字典键一致、每条 `@import` 都指向磁盘上真实存在且在包根内的文件、
字体栈顺序、宿主字体变量被重指向、六个圆角 token 归零、扫除规则带 `!important`
且没有全局 `corner-shape`）。

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
npm run probe:client    # 按 loader 的方式跑一遍 factory，打印 apply() 抛什么
npm run probe:install   # 从 profile 视角验证依赖解析（见下面的开发流程）
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
就是这条——它从 profile 视角解析两个字体包，再加载 `src/fonts.js` 问
`assetRoot()`，任何一环断了立刻报出来。

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

## 下一步

按领域逐个细化需求再动手：提示词、对话优化、能力扩展。
