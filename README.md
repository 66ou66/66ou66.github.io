# 66ou66's Blog

基于 [VitePress](https://vitepress.dev/) 的个人博客,部署在 GitHub Pages:<https://66ou66.github.io>

## 本地开发

```bash
npm install     # 首次
npm run dev     # 启动本地预览 http://localhost:5173
```

## 写新文章

1. 在 `docs/posts/` 下新建一个 Markdown 文件,比如 `my-post.md`
2. 打开 `docs/.vitepress/config.ts`,在 `sidebar['/posts/']` 里加一条:

```ts
{ text: '我的新文章标题', link: '/posts/my-post.html' }
```

3. 提交源码:

```bash
git add . && git commit -m "post: 我的新文章" && git push
```

4. 发布到线上(构建并推送 `gh-pages` 分支,约一分钟后生效):

```bash
npm run deploy
```

## 目录结构

```
docs/
  .vitepress/config.ts   # 站点配置(导航、侧边栏、搜索)
  index.md               # 首页
  about.md               # 关于页
  posts/                 # 文章目录
```

源码在 `main` 分支,线上产物在 `gh-pages` 分支(由 `npm run deploy` 自动维护,不要手动改)。

## 升级:push 即自动部署(可选)

当前发布方式是本地构建推送,如果想改成"push 到 main 自动构建部署",给 gh 补一次 workflow 权限即可:

```bash
gh auth refresh -s workflow   # 浏览器确认一次
```

然后新建 `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # lastUpdated 需要完整 git 历史
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: docs/.vitepress/dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

最后把 Pages 来源切回 Actions(一次性):

```bash
gh api -X PUT repos/66ou66/66ou66.github.io/pages --input - <<'EOF'
{"build_type": "workflow"}
EOF
```
