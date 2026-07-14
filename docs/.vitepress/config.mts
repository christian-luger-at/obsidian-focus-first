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
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'Releases', link: `https://github.com/${repo}/releases` },
    ],

    // One linear learning path applied on every page: understand the ideas
    // first (Foundations), then how to run them in the tool (Using Focus First).
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is Focus First?', link: '/guide/introduction' },
        ],
      },
      {
        text: 'Foundations',
        items: [
          { text: 'Prioritization methods', link: '/methods/' },
          { text: 'The Eisenhower matrix', link: '/methods/eisenhower' },
          { text: 'The Value / Effort matrix', link: '/methods/value-effort' },
          { text: 'Daily-planning methods', link: '/methods/daily-planning' },
        ],
      },
      {
        text: 'Using Focus First',
        items: [
          { text: 'Getting started', link: '/guide/getting-started' },
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
