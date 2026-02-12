---
title: "Simple Guides for Fuwari (CJK)"
published: 2024-04-01
description: "How to use this blog template."
image: "./cover.jpeg"
tags: ["Fuwari", "Blogging", "Customization", "CJK"]
category: Guides
draft: false
---


> Cover image source: [Source](https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA/208fc754-890d-4adb-9753-2c963332675d/width=2048/01651-1456859105-(colour_1.5),girl,_Blue,yellow,green,cyan,purple,red,pink,_best,8k,UHD,masterpiece,male%20focus,%201boy,gloves,%20ponytail,%20long%20hair,.jpeg)

This blog template is built with [Astro](https://astro.build/). For the things that are not mentioned in this guide, you may find the answers in the [Astro Docs](https://docs.astro.build/).

## Front-matter of Posts

```yaml
---
title: My First Blog Post
published: 2023-09-09
description: This is the first post of my new Astro blog.
image: ./cover.jpg
tags: [Foo, Bar]
category: Front-end
draft: false
---
```

| Attribute     | Description                                                                                                                                                                                                 |
|---------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `title`       | The title of the post.                                                                                                                                                                                      |
| `published`   | The date the post was published.                                                                                                                                                                            |
| `description` | A short description of the post. Displayed on index page.                                                                                                                                                   |
| `image`       | The cover image path of the post.<br/>1. Start with `http://` or `https://`: Use web image<br/>2. Start with `/`: For image in `public` dir<br/>3. With none of the prefixes: Relative to the markdown file |
| `tags`        | The tags of the post.                                                                                                                                                                                       |
| `category`    | The category of the post.                                                                                                                                                                                   |
| `draft`        | If this post is still a draft, which won't be displayed.                                                                                                                                                    |

## Where to Place the Post Files



Your post files should be placed in `src/content/posts/` directory. You can also create sub-directories to better organize your posts and assets.

```
src/content/posts/
├── post-1.md
└── post-2/
    ├── cover.png
    └── index.md
```



## CJK Rendering Test

### Chinese (Simplified)
这里是一段简体中文文本，用于测试字体渲染效果。
天地玄黄，宇宙洪荒。日月盈昃，辰宿列张。

### Chinese (Traditional)
這裡是一段繁體中文文本，用於測試字體渲染效果。
天地玄黃，宇宙洪荒。日月盈昃，辰宿列張。

### Japanese
ここは日本語のテキストです。フォントのレンダリングをテストします。
いろはにほへと ちりぬるを わかよたれそ つねならむ

### Korean
여기는 한국어 텍스트입니다. 폰트 렌더링을 테스트합니다.
가나다라마바사 아자차카타파하

### Mixed
中文、日本語、한국어 mixed text line.
