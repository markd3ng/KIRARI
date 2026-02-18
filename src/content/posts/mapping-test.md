---
title: Tag and Category Mapping Test
published: 2026-02-18
description: "Comprehensive test post for verifying tag and category mapping functionality"
image: ""
tags: [demo, example, tutorial, web_dev, frontend, javascript, typescript, astro, svelte, UnmappedTag]
category: frontend
draft: false
---

## Mapping Test

This post is used to test the tag and category mapping functionality with comprehensive test cases.

### Expected Results

**Tags:**
| Original | Expected Display | Status |
|----------|-----------------|--------|
| `demo` | 演示 | Mapped |
| `example` | 示例 | Mapped |
| `tutorial` | 教程 | Mapped |
| `web_dev` | Web开发 | Mapped |
| `frontend` | 前端 | Mapped |
| `javascript` | JavaScript | Mapped |
| `typescript` | TypeScript | Mapped |
| `astro` | Astro | Mapped |
| `svelte` | Svelte | Mapped |
| `UnmappedTag` | UnmappedTag | No mapping (fallback) |

**Category:**
| Original | Expected Display | Status |
|----------|-----------------|--------|
| `frontend` | 前端开发 | Mapped |

### How to Verify

1. Check the sidebar Categories widget - should show "前端开发" instead of "frontend"
2. Check the sidebar Tags widget - should show localized names for mapped tags
3. Check the post meta section - category and tags should display localized names
4. Check the category archive page URL - should be `/categories/frontend/` (English slug)
5. Check the tag archive page URLs - should be `/tags/demo/` etc. (English slug)
