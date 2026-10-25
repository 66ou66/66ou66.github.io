import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: "66ou66's Blog",
  description: '记录解决问题的过程:踩坑、排查、复盘',
  lastUpdated: true,

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '文章', link: '/posts/hello-world.html' },
      { text: '关于', link: '/about.html' }
    ],

    sidebar: {
      '/posts/': [
        {
          text: '文章',
          items: [
            { text: '开博第一篇:为什么写博客', link: '/posts/hello-world.html' },
            { text: '我是怎么搭建这个博客的', link: '/posts/build-this-blog.html' },
            { text: '从 30.7% 到全自动对弈:象棋 AI 的 72 天', link: '/posts/chess-ai-evolution.html' }
          ]
        }
      ]
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/66ou66' }],

    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    lastUpdated: {
      text: '最后更新',
      formatOptions: { dateStyle: 'short', timeStyle: 'short' }
    },
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '目录',
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',

    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索文章',
            buttonAriaLabel: '搜索文章'
          },
          modal: {
            displayDetails: '显示详细列表',
            resetButtonLabel: '清除查询条件',
            backButtonTitle: '关闭搜索框',
            noResultsText: '无法找到相关结果',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭'
            }
          }
        }
      }
    }
  }
})
