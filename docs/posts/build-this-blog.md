# 我是怎么搭建这个博客的

> 2026-10-25

需求很简单:一个属于自己的技术博客,免费托管,一条命令就能发布。这篇文章记录完整的搭建过程,包括一次被 GitHub 拒绝的推送。也算给这个博客的叙事风格打个样:**问题背景 → 方案选型 → 实施过程 → 踩的坑 → 总结**。

## 问题背景

想在 GitHub Pages 上要一个博客,约束条件:

- 免费、稳定,内容在自己手里(可随时迁移)
- 写作就是写 Markdown,不要花哨的后台
- 支持中文、本地搜索、深色模式这些基本体验

## 方案选型:VitePress 还是 Hugo

主流选择就这两个,对比下来:

| | VitePress | Hugo |
|---|---|---|
| 运行环境 | Node.js | 单个二进制 |
| 定制方式 | Vue 组件 | Go 模板 |
| 中文文档 | 官方支持好 | 主题文档居多 |
| 本地搜索 | 内置 | 依赖主题 |

我的机器上 Node 是现成的,前端技术栈也更熟,出问题能自己看源码调试,所以选了 **VitePress**。如果是不写前端、又想极简的人,Hugo 更省事——这是口味问题,不是优劣问题。

## 实施过程

### 1. 脚手架

没用 `npm create vitepress@latest`,因为交互式命令行在自动化环境里不好使。手写脚手架反而更清楚,总共就四个东西:

```
docs/
  .vitepress/config.ts   # 站点配置
  index.md               # 首页
  posts/                 # 文章目录
package.json
```

`package.json` 里加三个脚本:`dev`(本地预览)、`build`(构建)、`deploy`(发布,后面细说)。

`config.ts` 里配置了中文语言、导航栏、按 `/posts/` 前缀分组的侧边栏,以及内置的本地搜索(把 UI 文案翻译成了中文)。

### 2. 部署:一次被拒的推送

第一版方案是最"标准"的:写一个 GitHub Actions 工作流,push 到 `main` 时 CI 自动构建、自动发布,本地只管写 Markdown。

工作流写好,`git push`,被远端拒绝了:

```
! [remote rejected] main -> main (refusing to allow an OAuth App to create
  or update workflow `.github/workflows/deploy.yml` without `workflow` scope)
```

原因:我是用 GitHub CLI(`gh`)登录的,它的 OAuth token 只有 `repo` 等基础权限,**没有 `workflow` 权限**。GitHub 规定:经 OAuth 授权的令牌如果想创建或修改 workflow 文件,必须显式带上 `workflow` scope——这是 2021 年 Codecov 供应链事件之后加的防护。

补授权只要一条命令(`gh auth refresh -s workflow`,浏览器里点一次确认),但当时想走通无人工介入的路径,于是换了个不需要任何额外权限的方案:

### 3. 最终方案:gh-pages 分支部署

思路很朴素,分两支:

- `main` 分支:只放源码(Markdown、配置)
- `gh-pages` 分支:只放构建产物(`vitepress build` 的输出)

本地跑 `npm run deploy`,一条命令完成"构建 + 把产物推到 `gh-pages` 分支",再把 GitHub Pages 的来源指向 `gh-pages` 分支,线上就生效了。推送纯静态文件只需要 `repo` 权限,正好绕开了上面那个限制。

把 Pages 来源从 workflow 模式切回分支模式,用 API 一次搞定:

```bash
gh api -X PUT repos/66ou66/66ou66.github.io/pages --input - <<'EOF'
{"build_type": "legacy", "source": {"branch": "gh-pages", "path": "/"}}
EOF
```

## 踩的坑

1. **OAuth token 缺 `workflow` scope 会拒推**。不是所有 `git push` 失败都是网络问题,看清 `remote rejected` 的具体文案,它一般把原因写得明明白白。
2. **Pages 的"来源"必须和部署方式匹配**。GitHub Pages 支持两种发布方式:从分支读静态文件(`legacy`),或走 GitHub Actions(`workflow`)。用 API 建站点时默认给了 workflow 模式,切回分支部署必须把 `build_type` 和 `source` **一起改**——我第一遍只改了 `source`,`build_type` 还停在 workflow,Pages 就一直干等一个永远不会来的 Actions 部署,网站 404 了整整一分半钟,查配置才看出来。
3. **`cleanUrls` 不能开**。VitePress 的 `cleanUrls` 选项可以把 URL 变成不带 `.html` 的形式,但它依赖服务器做 URL 重写,GitHub Pages 不做,开了之后搜索结果点进去就是 404。所以站内链接老老实实带 `.html`。
4. **(留给以后)** 如果哪天切回 Actions 方案,记得工作流里 checkout 要加 `fetch-depth: 0`,否则浅克隆拿不到 git 历史,页面底部的"最后更新"时间算不出来。

## 总结

整个搭建不到一小时,其中"被拒的推送"到"想清楚换方案"占了十分钟——事后看,这次波折比我预想的任何顺利流程都值得写。

以后写文章的流程就是:`npm run dev` 预览 → `docs/posts/` 下写 Markdown → 侧边栏加一条 → `npm run deploy`,一分钟后线上可见。

后续想做的事:

- [ ] 接入 [giscus](https://giscus.app/),用 GitHub Discussions 做评论
- [ ] 生成 sitemap,提交给搜索引擎
- [ ] 加一个 RSS 订阅地址
- [ ] 哪天想通了,跑一次 `gh auth refresh -s workflow`,升级成 push 即部署

这些做完了再写一篇。
