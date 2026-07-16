import { defineConfig } from 'vitepress'

const repo = 'christian-luger-at/obsidian-focus-first'

export default defineConfig({
  title: 'Focus First',
  description: 'Prioritize your Obsidian tasks with the Eisenhower or Value/Effort matrix - automatically.',
  lang: 'en-US',
  // Project site: served from https://christian-luger-at.github.io/obsidian-focus-first/
  base: '/obsidian-focus-first/',
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname: 'https://christian-luger-at.github.io/obsidian-focus-first/' },

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/obsidian-focus-first/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#7c3aed' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Focus First - Obsidian task prioritization' }],
    ['meta', { property: 'og:description', content: 'Sort your Obsidian tasks into the Eisenhower or Value/Effort matrix, automatically.' }],
    ['meta', { property: 'og:image', content: 'https://christian-luger-at.github.io/obsidian-focus-first/screens/tour.gif' }],
    ['meta', { property: 'og:url', content: 'https://christian-luger-at.github.io/obsidian-focus-first/' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'Recipes', link: '/recipes/' },
      { text: 'Reference', link: '/reference/tags' },
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
          { text: 'Triaging unclassified tasks', link: '/guide/triage' },
          { text: 'Focus, size & filters', link: '/guide/focus-size-filters' },
          { text: 'Embedding tasks in a note', link: '/guide/embedding' },
          { text: 'Settings', link: '/guide/settings' },
        ],
      },
      {
        text: 'Recipes',
        items: [
          { text: 'Recipes & workflows', link: '/recipes/' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Tags & signifiers', link: '/reference/tags' },
          { text: 'FAQ & troubleshooting', link: '/reference/faq' },
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
