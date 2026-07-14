import { defineConfig } from 'vitepress'

const repo = 'christian-luger-at/obsidian-focus-first'

export default defineConfig({
  title: 'Focus First',
  description: 'Prioritize your Obsidian tasks with the Eisenhower or Value/Effort matrix — automatically.',
  lang: 'en-US',
  // Project site: served from https://christian-luger-at.github.io/obsidian-focus-first/
  base: '/obsidian-focus-first/',
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname: 'https://christian-luger-at.github.io/obsidian-focus-first/' },

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: 'Releases', link: `https://github.com/${repo}/releases` },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is Focus First?', link: '/guide/introduction' },
            { text: 'Getting started', link: '/guide/getting-started' },
          ],
        },
        {
          text: 'Using Focus First',
          items: [
            { text: 'How tasks are classified', link: '/guide/classification' },
            { text: 'The two matrices', link: '/guide/matrices' },
            { text: 'Focus, size & filters', link: '/guide/focus-size-filters' },
            { text: 'Embedding tasks in a note', link: '/guide/embedding' },
            { text: 'Settings', link: '/guide/settings' },
          ],
        },
        {
          text: 'Contributing',
          items: [
            { text: 'Development', link: '/guide/development' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: `https://github.com/${repo}` },
    ],

    editLink: {
      pattern: `https://github.com/${repo}/edit/main/docs/:path`,
      text: 'Edit this page on GitHub',
    },

    search: { provider: 'local' },

    footer: {
      message: 'Released under the MIT License.',
      copyright: '© 2026 Christian Luger',
    },
  },
})
