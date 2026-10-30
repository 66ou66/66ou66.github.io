# 给思源笔记装上自动时间戳:从写插件失败到代码片段的八次迭代

> 2026-10-30

## 需求

我在做一个小程序,习惯每次改 bug 都记一条开发日志。想要的效果是这样:

```
修复了列表页下拉刷新重复请求 2026-10-29 23:05
```

两个约束:时间自动生成,不用手敲;时间贴行尾靠右,像日志文件的时间列,而不是硬塞在正文末尾。

一开始想得简单:找个自带这功能的笔记软件就完了。先试了 Logseq,它的模板得手动敲 `/template` 触发,记一条日志要先打命令再填内容,和"顺手记一下"差得远。最后换成思源——本地优先、块结构清晰、还能改前端,适合动手改造。

## 第一轮:想自己写插件

思路很自然:写个插件监听回车,插时间。在 `data/plugins/` 下建目录,写 `plugin.json` 和 `index.js`:

```json
{
  "name": "auto-timestamp",
  "version": "0.1.0",
  "displayName": { "default": "自动时间戳" }
}
```

第一版用 CommonJS 风格:

```js
module.exports = class AutoTimestamp extends Plugin {}
```

思源毫无反应,连报错都没有。改成文档里的 ESM 写法:

```js
export default class AutoTimestamp extends Plugin {
  onload() { console.log('loaded') }
}
```

仍然没有日志、没有通知,插件列表里也找不到它。结论是**本地未签名的插件不会被加载**,这条路放弃。

## 第二轮:转投代码片段

思源有个更轻的入口:设置 → 外观 → 代码片段。本质是往前端注入 JS/CSS,不需要签名,也不需要打包。

但这里有个坑:**不能自己手写文件**。我直接在 `data/snippets/` 下写了 `auto-timestamp.js`,片段列表依然是空的。正确做法是先在 UI 里点"添加代码片段",让思源生成 `data/snippets/conf.json` 的条目,再改这个条目的 `content`:

```json
[
  {
    "id": "20261029220238-s7fr0m1",
    "name": "auto-ts",
    "type": "js",
    "enabled": true,
    "disabledInPublish": false,
    "content": "……一段被转义的 JS 源码……"
  }
]
```

`content` 是 JSON 字符串,里面的 JS 要整段转义,改的时候小心别把换行弄丢。重启之后,屏幕上弹出了"自动时间戳 v1 已加载",终于有反馈了。

## 第三到第六轮:死磕回车

前三版都想做到"按下回车,立刻在旁边写时间",结果连续踩坑。

**v3:判断光标是否在行尾。** 用 `Range` 比较光标位置和块尾,日志里打出来是 `行尾=false`。思源的块里混着零宽字符和尾部标签节点,范围比较根本对不上。

**v4:改成回车前后比对块内容。** 记录回车前的块文本,回车后再比对,确认是同一块且内容变长。依然静默失败——拿到的文本和预期永远不一致。

**v5:加 `norm()` 清洗。** 去掉 `\u200b`、`\ufeff`、`\u200c` 这些不可见字符,再做前缀匹配。还是没有效果。

**v6:上探针。** 干脆把键盘事件全量打印:

```js
document.addEventListener('keydown', e => {
  api('notification/pushMsg', {
    msg: '探针: key=' + e.key + ' 组合中=' + e.isComposing
  })
}, true)
```

结果只收到一条:`key=Shift`。回车被输入法(或者思源自己的按键处理)吃掉了。也就是说,**"按回车触发"这个前提在中文输入环境下就不成立**,继续在这一层死磕没有意义。

## 第七轮:换触发时机

把触发时机从"按键"改成"焦点变化":当光标离开一个块、并且这个块里有内容时,补时间。核心逻辑:

```js
var lastId = '', lastTxt = '', lastType = '';

function tick() {
  var bl = curBlock();
  if (!bl) return

  var id = bl.getAttribute('data-node-id') || ''
  var txt = (bl.textContent || '').trim()

  if (id === lastId) { lastTxt = txt; return }

  var pid = lastId, ptxt = lastTxt
  var ptype = lastType, pbl = window.__lastBlk

  lastId = id
  lastTxt = txt
  lastType = bl.getAttribute('data-type') || ''
  window.__lastBlk = bl

  if (!pid || !ptxt || skip[ptype] || hasTime(ptxt)) return

  setTimeout(function () { mark(pid, pbl) }, 200)
}

document.addEventListener('keyup', tick, true)
document.addEventListener('mouseup', tick, true)
document.addEventListener('focusin', tick, true)
setInterval(tick, 2000)
```

一次就通了,效果是:

```
111 改了 1 个 bug 2026-10-29 23:05
```

但时间贴在正文后面,还不是行尾靠右。

## 第八轮:把时间从正文拿出来

如果继续往正文追加字符串,就永远无法右对齐——它是文本流的一部分。

换一种存法:时间不写进正文,而是写进块的自定义属性 `custom-ts`,再用 CSS 把它渲染到行尾右侧。写入时调用内核 API:

```js
function api(path, body) {
  var token = window.siyuan?.config?.api?.token || ''
  var base = location.origin.indexOf('http') === 0
    ? location.origin
    : 'http://127.0.0.1:6806'
  return fetch(base + '/api/' + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Token ' + token
    },
    body: JSON.stringify(body || {})
  }).then(r => r.json())
}

function mark(id, bl) {
  if (bl && bl.getAttribute('custom-ts')) return
  api('attr/setBlockAttrs', {
    id: id,
    attrs: { 'custom-ts': nowText() }
  })
}
```

时间格式化成 `2026-10-29 23:05`:

```js
function pad(n) { return n < 10 ? '0' + n : '' + n }

function nowText() {
  var d = new Date()
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}
```

再配一条 CSS 片段:

```css
.protyle-wysiwyg [custom-ts]::after {
  content: attr(custom-ts);
  float: right;
  font-size: 12px;
  font-weight: 400;
  color: var(--b3-theme-on-surface-light);
  opacity: .85;
  margin-left: 12px;
  pointer-events: none;
  user-select: none;
}
```

关键点:块属性会原样渲染成 DOM 属性,所以 CSS 可以直接用 `attr(custom-ts)` 取值,再用 `::after` 加 `float: right` 推到行尾,不需要 `position: absolute` 那套计算。

结果是正文干净,时间右对齐、颜色比正文浅、不参与选中和点击。

## 踩坑清单

| 现象 | 真实原因 |
|---|---|
| 自写插件完全不执行 | 本地未签名插件不会被加载 |
| 手写 `snippets/*.js`,片段列表为空 | 片段必须先由 UI 创建,再改 `conf.json` 的 `content` |
| `Range` 判断行尾总是 `false` | 块内有零宽字符与尾部节点,位置比较失效 |
| 监听 `keydown` 只收到 `key=Shift` | 回车被输入法/编辑器吞掉,按键层不可靠 |
| 时间写进正文无法右对齐 | 它是文本流的一部分,不能独立排版 |

另外两个小坑:

1. **PowerShell 写 `conf.json` 会把数组包成对象。** `ConvertTo-Json` 处理单元素数组时会加一层 `{"value":[...],"Count":2}`,之后按对象取 `content` 就报"找不到属性"。用 `[pscustomobject]` 逐个构造,或者直接手写 JSON 更稳。
2. **不判断就重复写。** 每次光标经过都刷新时间,日志时间就失真了。所以写入前先查 `custom-ts` 是否存在,或者文本末尾是不是已经带了时间。

## 完整脚本

```js
(function () {
  if (window.__autoTsLoaded) return
  window.__autoTsLoaded = true

  var lastId = '', lastTxt = '', lastType = '', okDone = false

  function pad(n) { return n < 10 ? '0' + n : '' + n }

  function nowText() {
    var d = new Date()
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
      + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
  }

  function api(path, body) {
    var t = (window.siyuan && window.siyuan.config && window.siyuan.config.api
      && window.siyuan.config.api.token) || ''
    var base = location.origin.indexOf('http') === 0
      ? location.origin
      : 'http://127.0.0.1:6806'
    return fetch(base + '/api/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Token ' + t },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json() })
  }

  function toast(msg, isErr) {
    api('notification/pushMsg', {
      msg: (isErr ? '自动时间戳错误: ' : '') + msg,
      timeout: 5000
    }).catch(function () {})
  }

  function hasTime(t) {
    var tail = t.slice(-16)
    if (tail.length < 16) return false
    var d = new Date(tail.replace(' ', 'T'))
    return !isNaN(d.getTime())
  }

  function mark(id, bl) {
    if (bl && bl.getAttribute('custom-ts')) return
    api('attr/setBlockAttrs', { id: id, attrs: { 'custom-ts': nowText() } })
      .then(function (r) {
        if (!r || r.code !== 0) throw new Error('写入属性失败')
        if (!okDone) { okDone = true; toast('已写入时间戳,靠右显示') }
      })
      .catch(function (err) { toast(err.message, true) })
  }

  var skip = {
    'code-block': 1, 'table': 1, 'math': 1, 'mermaid': 1, 'flowchart': 1,
    'plantuml': 1, 'graphviz': 1, 'mindmap': 1, 'database': 1, 'video': 1,
    'audio': 1, 'iframe': 1, 'widget': 1, 'pdf': 1, 'html': 1
  }

  function curBlock() {
    var s = window.getSelection()
    if (!s || s.rangeCount === 0) return null
    var n = s.getRangeAt(0).endContainer
    var el = n.nodeType === 1 ? n : n.parentElement
    if (!el || !el.closest) return null
    if (!el.closest('.protyle-wysiwyg')) return null
    return el.closest('[data-node-id]')
  }

  function tick() {
    var bl = curBlock()
    if (!bl) return
    var id = bl.getAttribute('data-node-id') || ''
    var txt = (bl.textContent || '').trim()
    if (id === lastId) { lastTxt = txt; return }

    var pid = lastId, ptxt = lastTxt, ptype = lastType, pbl = window.__lastBlk
    lastId = id
    lastTxt = txt
    lastType = bl.getAttribute('data-type') || ''
    window.__lastBlk = bl

    if (!pid || !ptxt || skip[ptype] || hasTime(ptxt)) return
    setTimeout(function () { mark(pid, pbl) }, 200)
  }

  document.addEventListener('keyup', tick, true)
  document.addEventListener('mouseup', tick, true)
  document.addEventListener('focusin', tick, true)
  setInterval(tick, 2000)

  toast('自动时间戳 v8 已加载')
})()
```

## 总结

最大的教训:**先验证触发时机是否真的存在,再谈插入逻辑。** 回车那条路我从 v3 做到 v6,才发现键盘事件根本没到我手里;换成"光标离开块"之后一次就通了。四版代码白写,但把"输入法会不会吃掉按键"这件事彻底排除了。

还有一点值得记:**能不改正文就别改正文。** 把元数据放进块属性、交给 CSS 渲染,比在文本里拼字符串干净得多,"显示"和"存储"也就分开了。

尚未解决的:手机端要看到同样效果,需要双端共享数据。思源的第三方 WebDAV / S3 同步属于"功能特性",一次性 ¥80 解锁;只本地单机用则永久免费。暂时还在找不花钱的路子,想通了再写一篇。
