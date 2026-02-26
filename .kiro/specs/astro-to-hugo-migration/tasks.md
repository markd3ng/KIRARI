# 实施任务列表：Astro 博客迁移至 Hugo

## 概述

本任务列表基于需求文档和技术设计文档，将 KIRARI Astro 博客项目完整迁移至 Hugo 静态站点生成器。任务按照 7 个阶段组织，每个任务都是可执行、可测试的具体步骤。

**实现语言**: JavaScript/Node.js（用于迁移脚本和辅助工具）

**项目规模**: 
- 30 个详细需求
- 150+ 篇博客文章
- 10 种语言支持
- 25+ 组件需要迁移

**预计时间**: 7 周

## 任务清单

### 阶段 1: 基础设施搭建

- [ ] 1. 初始化 Hugo 项目结构
  - [ ] 1.1 创建 Hugo 项目目录结构
    - 创建 archetypes、assets、content、data、i18n、layouts、static、config 目录
    - 设置 .gitignore 文件
    - 初始化 package.json 用于 Node.js 工具
    - _需求: 1.1, 26.5_
  
  - [ ] 1.2 配置 Hugo 基础设置
    - 创建 config/_default/config.yaml 主配置文件
    - 配置 baseURL、languageCode、title、defaultContentLanguage
    - 配置构建选项（minify、enableRobotsTXT、enableGitInfo）
    - _需求: 14.1, 14.13_
  
  - [ ] 1.3 配置多语言支持
    - 创建 config/_default/languages.yaml
    - 配置 10 种语言（en、es、id、ja、ko、th、tr、vi、zh_CN、zh_TW）
    - 设置每种语言的 languageName、weight、params
    - _需求: 3.1, 3.7_

- [ ] 2. 创建基础布局模板
  - [ ] 2.1 实现 baseof.html 基础布局
    - 创建 layouts/_default/baseof.html
    - 实现 HTML 结构（head、body、blocks）
    - 集成 head partial 和 footer partial
    - _需求: 5.1_

  - [ ] 2.2 实现 head partial
    - 创建 layouts/partials/head.html
    - 添加 meta 标签（charset、viewport、description）
    - 添加 Open Graph 和 Twitter Card 标签
    - 添加 CSS 和字体引用
    - _需求: 13.4, 13.5, 14.7_
  
  - [ ] 2.3 实现 single.html 单页布局
    - 创建 layouts/_default/single.html
    - 实现文章详情页结构
    - 集成 post-meta、toc、license partials
    - _需求: 5.2_
  
  - [ ] 2.4 实现 list.html 列表布局
    - 创建 layouts/_default/list.html
    - 实现文章列表页结构
    - 集成 post-card 和 pagination partials
    - _需求: 5.3_
  
  - [ ] 2.5 实现 index.html 首页布局
    - 创建 layouts/index.html
    - 实现首页特殊布局
    - 显示最新文章列表
    - _需求: 5.4_

- [ ] 3. Checkpoint - 验证基础结构
  - 运行 `hugo server` 确保项目可以启动
  - 验证基础布局可以正确渲染
  - 如有问题请询问用户

### 阶段 2: 内容迁移

- [ ] 4. 开发内容转换脚本
  - [ ] 4.1 创建 Frontmatter 转换工具
    - 创建 scripts/convert-frontmatter.js
    - 实现 Astro frontmatter 到 Hugo frontmatter 的映射
    - 转换字段：title、published→date、updated→lastmod、description、image、tags、category、draft、lang、mermaid
    - _需求: 2.2, 2.7_
  
  - [ ]* 4.2 编写 Frontmatter 转换的属性测试
    - **Property 3: Frontmatter Conversion Preserves All Fields**
    - **验证需求: 2.2, 2.7**
    - 使用 fast-check 生成随机 frontmatter 数据
    - 验证所有字段正确转换且无数据丢失
  
  - [ ] 4.3 创建图片路径转换工具
    - 创建 scripts/convert-image-paths.js
    - 解析 Markdown 中的图片引用
    - 将相对路径转换为 Hugo 兼容的路径
    - _需求: 2.5_
  
  - [ ]* 4.4 编写图片路径转换的属性测试
    - **Property 4: Image Path Conversion Maintains Resolvability**
    - **验证需求: 2.5**
    - 生成各种图片路径格式
    - 验证转换后路径可解析
  
  - [ ] 4.5 创建内容文件批量转换脚本
    - 创建 scripts/migrate-content.js
    - 读取所有 src/content/posts/*.md 文件
    - 应用 frontmatter 和图片路径转换
    - 输出到 content/posts/ 目录
    - _需求: 2.1, 2.3_
  
  - [ ]* 4.6 编写内容转换的属性测试
    - **Property 2: Content Conversion Preserves Markdown Body**
    - **验证需求: 2.3**
    - 验证 Markdown 正文内容完全保留

- [ ] 5. 执行内容迁移
  - [ ] 5.1 迁移博客文章
    - 运行 scripts/migrate-content.js
    - 迁移所有 src/content/posts/*.md 到 content/posts/
    - 验证文件数量一致
    - _需求: 2.1_
  
  - [ ] 5.2 迁移特殊页面
    - 迁移 src/content/spec/about.md 到 content/about/_index.md
    - 迁移 src/content/spec/friends.md 到 content/friends/_index.md
    - 创建 content/archive/_index.md
    - _需求: 2.4_
  
  - [ ] 5.3 迁移静态资源
    - 复制图片文件到 static/images/
    - 复制字体文件到 static/fonts/
    - 复制 favicon 和其他静态文件
    - _需求: 12.9_
  
  - [ ]* 5.4 编写内容完整性验证测试
    - **Property 49: Migration Content Completeness**
    - **验证需求: 29.5**
    - 验证所有 Astro 内容文件都有对应的 Hugo 文件

- [ ] 6. Checkpoint - 验证内容迁移
  - 运行 `hugo` 构建站点
  - 检查是否有构建错误
  - 验证文章页面可以访问
  - 如有问题请询问用户

### 阶段 3: 核心组件实现

- [ ] 7. 实现导航组件
  - [ ] 7.1 实现 Header/Navbar partial
    - 创建 layouts/partials/header.html
    - 实现导航栏结构（Logo、导航链接、搜索按钮、主题切换）
    - 使用 Hugo Menu 系统渲染导航项
    - 实现移动端响应式菜单
    - _需求: 4.1, 11.1, 11.2, 11.6_
  
  - [ ] 7.2 配置导航菜单
    - 创建 config/_default/menus.yaml
    - 配置主导航项（Home、Archive、About、Friends、GitHub）
    - 设置权重和外部链接标记
    - _需求: 11.1, 11.2_
  
  - [ ]* 7.3 编写导航系统测试
    - **Property 8: Navigation Text Follows Language Context**
    - **验证需求: 3.4**
    - 验证不同语言下导航文本正确显示
  
  - [ ] 7.4 实现 Footer partial
    - 创建 layouts/partials/footer.html
    - 支持自定义 HTML 和脚本（从 params 读取）
    - 添加版权信息和社交链接
    - _需求: 4.2, 14.8_

- [ ] 8. 实现侧边栏组件
  - [ ] 8.1 实现 Sidebar partial
    - 创建 layouts/partials/sidebar.html
    - 实现侧边栏容器结构
    - 集成 Profile、Categories、Tags widgets
    - _需求: 4.3_
  
  - [ ] 8.2 实现 Profile widget
    - 创建 layouts/partials/widgets/profile.html
    - 显示头像、姓名、简介
    - 显示社交链接（从 params.profile 读取）
    - _需求: 4.13, 14.3_
  
  - [ ] 8.3 实现 Categories widget
    - 创建 layouts/partials/widgets/categories.html
    - 列出所有分类及文章数量
    - 按文章数量排序
    - _需求: 4.14, 9.9, 9.10_
  
  - [ ] 8.4 实现 Tags widget
    - 创建 layouts/partials/widgets/tags.html
    - 列出所有标签及文章数量
    - 按文章数量排序
    - _需求: 4.14, 9.9, 9.10_

- [ ] 9. 实现文章相关组件
  - [ ] 9.1 实现 PostCard partial
    - 创建 layouts/partials/post-card.html
    - 显示文章标题、描述、日期、标签、分类、封面图
    - 实现卡片悬停效果
    - _需求: 4.4_
  
  - [ ] 9.2 实现 PostMeta partial
    - 创建 layouts/partials/post-meta.html
    - 显示作者、发布日期、更新日期、阅读时间、字数
    - 使用 Hugo 内置函数计算阅读时间和字数
    - _需求: 4.5, 6.2_
  
  - [ ]* 9.3 编写阅读时间计算测试
    - **Property 11: Reading Time and Word Count Calculation**
    - **验证需求: 6.2**
    - 验证阅读时间和字数计算准确性
  
  - [ ] 9.4 实现 TOC partial
    - 创建 layouts/partials/toc.html
    - 使用 Hugo .TableOfContents 生成目录
    - 支持 3 级标题深度
    - 实现移动端折叠功能
    - _需求: 4.8_
  
  - [ ] 9.5 实现 Pagination partial
    - 创建 layouts/partials/pagination.html
    - 使用 Hugo .Paginator 实现分页
    - 显示上一页、下一页、页码
    - 高亮当前页
    - _需求: 4.11, 20.3, 20.6_
  
  - [ ]* 9.6 编写分页功能测试
    - **Property 40: Pagination Article Count**
    - **Property 41: Pagination Navigation Accuracy**
    - **验证需求: 20.2, 20.3**
  
  - [ ] 9.7 实现 License partial
    - 创建 layouts/partials/license.html
    - 显示许可协议信息（从 params.license 读取）
    - 支持启用/禁用开关
    - _需求: 4.12, 14.4_

- [ ] 10. Checkpoint - 验证核心组件
  - 运行 `hugo server` 查看页面效果
  - 验证所有组件正确渲染
  - 检查响应式布局
  - 如有问题请询问用户

### 阶段 4: 样式系统迁移

- [ ] 11. 转换样式文件
  - [ ] 11.1 创建 Stylus 到 SCSS 转换脚本
    - 创建 scripts/convert-styles.js
    - 解析 Stylus 语法
    - 转换为 SCSS 语法
    - 保留所有 CSS 变量定义
    - _需求: 8.1, 8.2_
  
  - [ ]* 11.2 编写样式转换的属性测试
    - **Property 19: Stylus to CSS/SCSS Conversion Validity**
    - **Property 20: CSS Variable Preservation**
    - **验证需求: 8.1, 8.2**
  
  - [ ] 11.3 转换主样式文件
    - 转换 src/styles/variables.styl 到 assets/css/variables.scss
    - 转换 src/styles/markdown-extend.styl 到 assets/css/markdown.scss
    - 验证所有 CSS 变量（--primary、--page-bg、--card-bg 等 50+ 个）
    - _需求: 8.2_
  
  - [ ] 11.4 迁移其他 CSS 文件
    - 复制 main.css、expressive-code.css、photoswipe.css 到 assets/css/
    - 复制 scrollbar.css、transition.css、fonts.css 到 assets/css/
    - 调整路径引用
    - _需求: 8.5_

- [ ] 12. 配置 TailwindCSS
  - [ ] 12.1 安装和配置 TailwindCSS
    - 安装 tailwindcss、postcss、autoprefixer
    - 创建 tailwind.config.js
    - 配置 content 路径（layouts/**/*.html）
    - _需求: 8.4_
  
  - [ ] 12.2 集成 TailwindCSS 到 Hugo
    - 创建 assets/css/main.scss 作为入口文件
    - 导入 TailwindCSS 指令
    - 导入自定义样式文件
    - 配置 Hugo Pipes 处理 SCSS
    - _需求: 8.4_
  
  - [ ] 12.3 配置字体
    - 安装 @fontsource-variable/jetbrains-mono 和 @fontsource/roboto
    - 在 assets/css/fonts.scss 中导入字体
    - 配置字体 CSS 变量
    - _需求: 8.6, 12.4_

- [ ] 13. 实现主题系统
  - [ ] 13.1 实现主题切换 JavaScript
    - 创建 assets/js/theme-switcher.js
    - 实现三种主题模式（light、dark、auto）
    - 实现 localStorage 持久化
    - 监听系统主题变化
    - _需求: 16.1, 16.2, 16.3, 16.7_
  
  - [ ]* 13.2 编写主题切换测试
    - **Property 35: Theme Preference Persistence**
    - **Property 36: System Theme Tracking**
    - **验证需求: 16.2, 16.3, 16.7**
  
  - [ ] 13.3 实现主题切换 UI 组件
    - 创建 layouts/partials/theme-switcher.html
    - 添加主题切换按钮
    - 显示当前主题图标
    - 添加平滑过渡动画
    - _需求: 16.4, 16.5, 16.8_
  
  - [ ] 13.4 实现主题色自定义功能
    - 创建 assets/js/color-settings.js
    - 实现 hue 值调整（0-360）
    - 实现 localStorage 持久化
    - 更新 --hue CSS 变量
    - _需求: 17.1, 17.2, 17.3, 17.4, 17.5_
  
  - [ ]* 13.5 编写主题色自定义测试
    - **Property 37: Theme Color Persistence**
    - **Property 38: Theme Color CSS Variable Application**
    - **验证需求: 17.3, 17.4, 17.5**
  
  - [ ] 13.6 实现 DisplaySettings 组件
    - 创建 layouts/partials/display-settings.html
    - 添加主题色选择器 UI
    - 实现彩虹渐变背景
    - 支持 fixed 模式隐藏选择器
    - _需求: 4.15, 17.2, 17.6, 17.7_
  
  - [ ] 13.7 配置明暗主题 CSS 变量
    - 在 assets/css/variables.scss 中定义 :root 和 :root.dark 变量
    - 实现主题色调整逻辑
    - 测试主题切换效果
    - _需求: 8.3, 8.10_
  
  - [ ]* 13.8 编写主题 CSS 变量测试
    - **Property 21: Theme Mode CSS Variable Application**
    - **验证需求: 8.3**

- [ ] 14. Checkpoint - 验证样式系统
  - 运行 `hugo server` 查看样式效果
  - 测试主题切换功能
  - 测试主题色自定义功能
  - 验证响应式设计
  - 如有问题请询问用户

### 阶段 5: 高级功能实现

- [ ] 15. 实现多语言支持
  - [ ] 15.1 创建翻译文件转换脚本
    - 创建 scripts/convert-i18n.js
    - 解析 src/i18n/languages/*.ts TypeScript 文件
    - 转换为 i18n/*.yaml YAML 格式
    - 保留所有翻译键值对
    - _需求: 3.2_
  
  - [ ]* 15.2 编写翻译文件转换的属性测试
    - **Property 6: Translation File Conversion Preserves All Keys**
    - **验证需求: 3.2**

  - [ ] 15.3 转换所有语言翻译文件
    - 运行 scripts/convert-i18n.js
    - 转换 10 种语言文件（en、es、id、ja、ko、th、tr、vi、zh_CN、zh_TW）
    - 验证所有翻译键（home、about、archive、search 等 30+ 个键）
    - _需求: 3.2, 3.3_
  
  - [ ] 15.4 实现语言切换功能
    - 创建 layouts/partials/language-switcher.html
    - 显示可用语言列表
    - 实现语言切换逻辑
    - _需求: 3.6_
  
  - [ ]* 15.5 编写语言路由测试
    - **Property 7: Language-Specific Content Routing**
    - **验证需求: 3.5**
    - 验证带 lang 字段的文章正确归类到对应语言

- [ ] 16. 实现分类法系统
  - [ ] 16.1 配置 Taxonomies
    - 在 config/_default/config.yaml 中配置 taxonomies
    - 定义 tags 和 categories 分类法
    - _需求: 9.1_
  
  - [ ] 16.2 创建分类映射数据文件
    - 创建 data/tag_mappings.json
    - 创建 data/category_mappings.json
    - 定义 slug 到显示名称的映射
    - _需求: 9.2, 9.3_
  
  - [ ] 16.3 实现 Taxonomy 布局
    - 创建 layouts/taxonomy/tag.html（单个标签页）
    - 创建 layouts/taxonomy/category.html（单个分类页）
    - 创建 layouts/taxonomy/terms.html（标签/分类列表页）
    - _需求: 9.4, 9.5, 9.6, 9.7_
  
  - [ ]* 16.4 编写分类法过滤测试
    - **Property 22: Tag Page Content Filtering**
    - **Property 23: Category Page Content Filtering**
    - **Property 24: Taxonomy Article Count Accuracy**
    - **验证需求: 9.6, 9.7, 9.9**
  
  - [ ] 16.5 在文章页显示标签和分类
    - 在 layouts/posts/single.html 中添加标签和分类显示
    - 链接到对应的标签/分类页
    - _需求: 9.8_

- [ ] 17. 实现搜索功能
  - [ ] 17.1 集成 Pagefind
    - 安装 pagefind 包
    - 配置 Pagefind 构建脚本
    - 在构建后生成搜索索引
    - _需求: 10.1, 10.2_
  
  - [ ] 17.2 实现搜索 UI 组件
    - 创建 layouts/partials/search.html
    - 添加搜索输入框和结果容器
    - 实现搜索按钮和模态框
    - _需求: 4.7_
  
  - [ ] 17.3 实现搜索 JavaScript
    - 创建 assets/js/search.js
    - 加载 Pagefind 库
    - 实现搜索查询逻辑
    - 显示搜索结果（标题、摘要、URL）
    - 高亮搜索关键词
    - _需求: 10.3, 10.5, 10.6, 10.8_
  
  - [ ]* 17.4 编写搜索功能测试
    - **Property 25: Search Result Relevance**
    - **Property 26: Search Index Multilingual Support**
    - **验证需求: 10.3, 10.4**
  
  - [ ] 17.5 配置多语言搜索
    - 配置 Pagefind 多语言索引
    - 为每种语言生成独立索引
    - _需求: 10.4_

- [ ] 18. 实现 Markdown 扩展功能
  - [ ] 18.1 配置 Hugo Markdown 处理器
    - 在 config/_default/config.yaml 中配置 markup.goldmark
    - 启用 unsafe HTML、attributes、autoHeadingID
    - 配置扩展（footnote、table、taskList 等）
    - _需求: 6.4, 6.9_
  
  - [ ]* 18.2 编写标题 ID 生成测试
    - **Property 12: Heading ID Generation Uniqueness**
    - **验证需求: 6.4**

  - [ ] 18.3 实现自定义 Render Hooks
    - 创建 layouts/_default/_markup/render-image.html（图片懒加载）
    - 创建 layouts/_default/_markup/render-heading.html（标题锚点）
    - 创建 layouts/_default/_markup/render-link.html（外部链接处理）
    - _需求: 6.5, 6.6, 11.3_
  
  - [ ]* 18.4 编写 Render Hooks 测试
    - **Property 13: Heading Anchor Link Presence**
    - **Property 14: Image Lazy Loading Attribute**
    - **Property 28: External Link Attributes**
    - **验证需求: 6.5, 6.6, 11.3**
  
  - [ ] 18.5 实现 Shortcodes
    - 创建 layouts/shortcodes/github-card.html
    - 创建 layouts/shortcodes/github-file-card.html
    - 创建 layouts/shortcodes/note.html（告示块）
    - 创建 layouts/shortcodes/tip.html、important.html、caution.html、warning.html
    - _需求: 6.8, 6.12, 6.13_
  
  - [ ]* 18.6 编写告示块渲染测试
    - **Property 16: GitHub Admonition Block Rendering**
    - **验证需求: 6.8**
  
  - [ ] 18.7 实现数学公式支持
    - 创建 assets/js/katex-loader.js
    - 检测页面中的数学公式语法
    - 动态加载 KaTeX 库
    - 渲染数学公式
    - _需求: 6.1_
  
  - [ ]* 18.8 编写数学公式渲染测试
    - **Property 10: Math Formula Rendering Inclusion**
    - **验证需求: 6.1**
  
  - [ ] 18.9 实现 Mermaid 图表支持
    - 创建 assets/js/mermaid-loader.js
    - 根据 frontmatter mermaid 字段条件加载
    - 渲染 Mermaid 图表
    - _需求: 6.7, 6.11_
  
  - [ ]* 18.10 编写 Mermaid 加载测试
    - **Property 15: Mermaid Library Conditional Loading**
    - **Property 30: Conditional Mermaid Library Loading**
    - **验证需求: 6.11, 12.10**

- [ ] 19. 实现代码高亮系统
  - [ ] 19.1 配置 Hugo Chroma
    - 在 config/_default/config.yaml 中配置 markup.highlight
    - 设置代码高亮样式（github-dark）
    - 启用行号、代码围栏等功能
    - _需求: 7.1, 7.4_
  
  - [ ]* 19.2 编写代码高亮测试
    - **Property 17: Code Block Syntax Highlighting**
    - **Property 18: Code Block Line Numbers**
    - **验证需求: 7.1, 7.4**
  
  - [ ] 19.3 实现代码块增强功能
    - 创建 assets/js/code-enhancements.js
    - 实现复制按钮功能
    - 实现代码折叠功能
    - 添加语言标识显示
    - _需求: 7.3, 7.4, 7.5, 7.6_
  
  - [ ] 19.4 配置代码块样式
    - 创建 assets/css/code-blocks.scss
    - 实现双主题支持（github-dark 和 github-dark-dimmed）
    - 实现代码自动换行
    - 为 shellsession 禁用行号
    - _需求: 7.2, 7.7, 7.8, 7.9_

- [ ] 20. Checkpoint - 验证高级功能
  - 测试多语言切换
  - 测试搜索功能
  - 测试标签和分类页面
  - 测试 Markdown 扩展（数学公式、Mermaid、代码高亮）
  - 如有问题请询问用户

### 阶段 6: SEO 和特殊页面

- [ ] 21. 实现 SEO 功能
  - [ ] 21.1 配置 SEO 元数据
    - 在 config/_default/params.yaml 中配置 SEO 参数
    - 配置验证码（Google、Bing、Yandex、Naver）
    - _需求: 13.6, 14.7_
  
  - [ ] 21.2 生成 Sitemap 和 Robots.txt
    - 配置 Hugo 自动生成 sitemap.xml
    - 创建 static/robots.txt
    - _需求: 13.1, 13.2_
  
  - [ ]* 21.3 编写 Sitemap 完整性测试
    - **Property 31: Sitemap URL Completeness**
    - **验证需求: 13.1**

  - [ ] 21.4 实现 RSS Feed
    - 配置 Hugo 自动生成 RSS feed
    - 自定义 RSS 模板（如需要）
    - _需求: 13.3_
  
  - [ ] 21.5 实现结构化数据
    - 在 layouts/partials/head.html 中添加 JSON-LD
    - 为文章页添加 Article schema
    - 为网站添加 WebSite schema
    - _需求: 13.8_
  
  - [ ] 21.6 配置 hreflang 标签
    - 在 layouts/partials/head.html 中添加 hreflang 标签
    - 为每种语言生成对应的 hreflang
    - _需求: 13.9_
  
  - [ ]* 21.7 编写 Open Graph 标签测试
    - **Property 32: Open Graph Tag Presence**
    - **Property 33: Article Cover Image as OG Image**
    - **验证需求: 13.4, 13.10**

- [ ] 22. 实现特殊页面
  - [ ] 22.1 实现归档页面
    - 创建 layouts/archive/list.html
    - 实现 ArchivePanel partial
    - 按年月分组显示文章
    - 显示文章总数和时间轴样式
    - _需求: 4.6, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7_
  
  - [ ]* 22.2 编写归档页面测试
    - **Property 39: Archive Chronological Grouping**
    - **验证需求: 19.2, 19.3, 19.6**
  
  - [ ] 22.2 实现友链页面
    - 创建 data/friends.json 数据文件
    - 在 layouts/friends/list.html 中读取友链数据
    - 显示友链卡片（标题、描述、URL、图标）
    - 添加悬停效果和外部链接图标
    - _需求: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_
  
  - [ ]* 22.3 编写友链显示测试
    - **Property 34: Friend Link Display Completeness**
    - **验证需求: 15.3**
  
  - [ ] 22.4 实现 404 错误页面
    - 创建 layouts/404.html
    - 添加返回首页链接
    - 添加搜索功能
    - 显示最近文章列表
    - _需求: 25.1, 25.2, 25.3, 25.4_

- [ ] 23. 实现 LLMs 文档生成
  - [ ] 23.1 创建 LLMs 文档生成脚本
    - 创建 scripts/generate-llms-docs.js
    - 读取所有文章内容
    - 生成 llms.txt、llms-small.txt、llms-full.txt
    - _需求: 21.1, 21.2, 21.3_
  
  - [ ] 23.2 实现多语言 LLMs 文档
    - 根据 Config.llms.i18n 配置
    - 为每种语言生成独立文档（llms-en.txt、llms-zh.txt 等）
    - _需求: 21.4_
  
  - [ ]* 23.3 编写 LLMs 文档测试
    - **Property 42: LLMs Document Language Separation**
    - **验证需求: 21.4**
  
  - [ ] 23.4 配置 LLMs 文档参数
    - 在 config/_default/params.yaml 中配置 llms 参数
    - 设置 enable、i18n、title、description
    - _需求: 14.10, 21.7_

- [ ] 24. 实现其他交互组件
  - [ ] 24.1 实现 BackToTop 按钮
    - 创建 layouts/partials/back-to-top.html
    - 创建 assets/js/back-to-top.js
    - 监听滚动事件，显示/隐藏按钮
    - 实现平滑滚动到顶部
    - _需求: 4.10_
  
  - [ ] 24.2 实现图片灯箱功能
    - 集成 PhotoSwipe 库
    - 创建 assets/js/photoswipe-init.js
    - 为内容图片添加灯箱功能
    - _需求: 12.3_
  
  - [ ] 24.3 实现页面过渡动画
    - 集成 Swup.js 或使用 View Transitions API
    - 创建 assets/js/page-transitions.js
    - 实现淡入淡出动画
    - 实现加载进度条
    - _需求: 18.1, 18.2, 18.7_

- [ ] 25. Checkpoint - 验证 SEO 和特殊页面
  - 验证 sitemap.xml 和 robots.txt 生成
  - 验证 RSS feed 格式
  - 测试归档页面和友链页面
  - 测试 404 页面
  - 如有问题请询问用户

### 阶段 7: 优化、测试和部署

- [ ] 26. 性能优化
  - [ ] 26.1 配置资源压缩
    - 在 config/_default/config.yaml 中启用 minify
    - 配置 HTML、CSS、JS 压缩选项
    - _需求: 22.1_
  
  - [ ]* 26.2 编写资源压缩测试
    - **Property 43: Asset Minification**
    - **验证需求: 22.1**
  
  - [ ] 26.2 实现图片优化
    - 配置 Hugo 图片处理管道
    - 实现图片压缩和格式转换
    - 生成响应式图片（srcset）
    - _需求: 12.1, 22.2, 22.3_
  
  - [ ]* 26.3 编写图片压缩测试
    - **Property 29: Image Compression Application**
    - **验证需求: 12.1**
  
  - [ ] 26.4 实现关键 CSS 内联
    - 提取关键 CSS
    - 在 head 中内联关键 CSS
    - 延迟加载非关键 CSS
    - _需求: 22.4_
  
  - [ ] 26.5 配置缓存策略
    - 为静态资源添加 fingerprint
    - 配置浏览器缓存头
    - _需求: 22.8_
  
  - [ ] 26.6 优化字体加载
    - 配置 font-display: swap
    - 预加载关键字体
    - _需求: 22.10_

- [ ] 27. 响应式设计优化
  - [ ] 27.1 实现移动端优化
    - 优化移动端导航栏（汉堡菜单）
    - 优化移动端侧边栏（隐藏或折叠）
    - 优化移动端文章卡片布局
    - 优化移动端 TOC 显示
    - _需求: 23.2, 23.3, 23.4, 23.5_
  
  - [ ] 27.2 测试响应式断点
    - 测试移动端（320px+）
    - 测试平板（768px+）
    - 测试桌面端（1024px+）
    - _需求: 23.1_
  
  - [ ]* 27.3 编写响应式测试
    - **Property 44: Responsive Breakpoint Behavior**
    - **验证需求: 23.1**
  
  - [ ] 27.4 优化触摸交互
    - 增大移动端点击区域
    - 优化滑动和手势交互
    - _需求: 23.7_

- [ ] 28. 可访问性优化
  - [ ] 28.1 添加 ARIA 标签
    - 为导航添加 aria-label
    - 为按钮添加 aria-label
    - 为模态框添加 aria-modal
    - _需求: 24.5_
  
  - [ ] 28.2 优化键盘导航
    - 确保所有交互元素可通过 Tab 访问
    - 实现 skip to content 链接
    - 添加 focus 样式
    - _需求: 24.3, 24.4, 24.7_
  
  - [ ]* 28.3 编写可访问性测试
    - **Property 45: Image Alt Attribute Presence**
    - **Property 46: Interactive Element Focus Styles**
    - **验证需求: 24.1, 24.4**
  
  - [ ] 28.4 验证颜色对比度
    - 使用工具检查颜色对比度
    - 确保符合 WCAG AA 标准
    - _需求: 24.6_
  
  - [ ] 28.5 为表单添加 label
    - 为搜索输入框添加 label
    - 为其他表单元素添加 label
    - _需求: 24.8_

- [ ] 29. 内容验证
  - [ ] 29.1 实现 Frontmatter 验证
    - 创建 scripts/validate-content.js
    - 验证必填字段（title、published）
    - 验证日期格式（YYYY-MM-DD）
    - 验证标签和分类是否在映射表中
    - _需求: 28.1, 28.2, 28.3_
  
  - [ ]* 29.2 编写 Frontmatter 验证测试
    - **Property 47: Frontmatter Required Field Validation**
    - **Property 48: Frontmatter Date Format Validation**
    - **验证需求: 28.1, 28.2, 28.5**
  
  - [ ] 29.3 验证图片路径
    - 检查所有图片引用是否存在
    - 输出缺失图片的警告
    - _需求: 28.4_
  
  - [ ] 29.4 验证内部链接
    - 检查所有内部链接是否有效
    - 输出损坏链接的警告
    - _需求: 28.6_

- [ ] 30. 综合测试
  - [ ] 30.1 运行所有单元测试
    - 执行 `npm test`
    - 确保所有测试通过
    - 检查测试覆盖率（目标 > 80%）
    - _需求: 30.1-30.18_
  
  - [ ] 30.2 运行所有属性测试
    - 执行 `npm run test:property`
    - 确保所有属性测试通过（100+ 迭代）
    - _需求: 30.1-30.18_
  
  - [ ] 30.3 执行迁移验证测试
    - 验证所有页面可访问（无 404）
    - 验证所有内部链接有效
    - 验证所有图片正常加载
    - _需求: 30.1, 30.2, 30.3_
  
  - [ ]* 30.4 编写功能等效性测试
    - **Property 50: Functional Equivalence After Migration**
    - **验证需求: 30.17, 30.18**
  
  - [ ] 30.5 测试多语言功能
    - 测试语言切换
    - 验证每种语言的翻译
    - 测试多语言搜索
    - _需求: 30.4_
  
  - [ ] 30.6 测试搜索功能
    - 测试全文搜索
    - 测试搜索结果准确性
    - 测试搜索高亮
    - _需求: 30.5_
  
  - [ ] 30.7 测试标签和分类
    - 验证标签页和分类页
    - 验证文章过滤正确性
    - _需求: 30.6_
  
  - [ ] 30.8 测试 RSS 和 Sitemap
    - 验证 RSS feed 格式
    - 验证 sitemap.xml 格式
    - _需求: 30.7, 30.8_
  
  - [ ] 30.9 测试主题切换
    - 测试明暗主题切换
    - 测试主题色自定义
    - 测试主题持久化
    - _需求: 30.9_
  
  - [ ] 30.10 测试响应式布局
    - 在不同设备尺寸下测试
    - 验证移动端和桌面端布局
    - _需求: 30.10_
  
  - [ ] 30.11 测试代码高亮
    - 验证各种语言的语法高亮
    - 测试行号显示
    - 测试复制按钮
    - _需求: 30.11_
  
  - [ ] 30.12 测试数学公式渲染
    - 验证 LaTeX 公式正确渲染
    - 测试行内和块级公式
    - _需求: 30.12_
  
  - [ ] 30.13 测试 Mermaid 图表
    - 验证 Mermaid 图表正确渲染
    - 测试条件加载逻辑
    - _需求: 30.13_
  
  - [ ] 30.14 验证 SEO 元数据
    - 检查所有页面的 meta 标签
    - 验证 Open Graph 和 Twitter Card
    - 验证结构化数据
    - _需求: 30.14_
  
  - [ ]* 30.15 运行性能测试
    - 运行 Lighthouse 测试
    - 目标：Performance > 90, Accessibility > 95, Best Practices > 90, SEO > 95
    - 测试构建时间（< 60 秒）
    - _需求: 30.15_
  
  - [ ]* 30.16 运行可访问性测试
    - 使用 axe-core 进行自动化测试
    - 手动测试键盘导航
    - 验证 WCAG AA 合规性
    - _需求: 30.16_

- [ ] 31. 开发工具和文档
  - [ ] 31.1 创建新建文章脚本
    - 创建 scripts/new-post.js
    - 实现交互式文章创建
    - 自动生成 frontmatter 模板
    - _需求: 26.7_
  
  - [ ] 31.2 编写 README 文档
    - 项目介绍和功能说明
    - 安装和运行指南
    - 开发和构建命令
    - 配置说明
    - _需求: 26.5_
  
  - [ ] 31.3 编写迁移文档
    - 迁移步骤说明
    - 配置映射表
    - 组件映射表
    - 常见问题解答
    - _需求: 29.4_
  
  - [ ] 31.4 创建配置示例
    - 提供完整的配置示例
    - 添加详细注释
    - _需求: 26.6_

- [ ] 32. Checkpoint - 最终验证
  - 运行完整的测试套件
  - 验证所有功能正常工作
  - 检查性能指标
  - 如有问题请询问用户

- [ ] 33. 部署准备
  - [ ] 33.1 配置生产环境
    - 创建 config/production/config.yaml
    - 配置生产环境特定设置
    - 设置正确的 baseURL
    - _需求: 27.5_
  
  - [ ] 33.2 创建 CI/CD 配置
    - 创建 .github/workflows/deploy.yml
    - 配置自动构建和部署
    - 配置测试流程
    - _需求: 27.7_
  
  - [ ] 33.3 配置部署平台
    - 配置 GitHub Pages / Netlify / Vercel
    - 设置自定义域名
    - 配置 HTTPS
    - _需求: 27.2, 27.3, 27.4, 27.5_
  
  - [ ] 33.4 生成生产构建
    - 运行 `hugo --environment production`
    - 验证构建输出
    - 检查资源路径正确性
    - _需求: 27.1, 27.6_
  
  - [ ] 33.5 部署到测试环境
    - 部署到 staging 环境
    - 进行用户验收测试
    - 收集反馈并修复问题
    - _需求: 27.2_

- [ ] 34. 生成迁移报告
  - [ ] 34.1 运行迁移验证脚本
    - 创建 scripts/generate-migration-report.js
    - 统计迁移的文件数量
    - 记录成功和失败的项目
    - _需求: 29.6_
  
  - [ ] 34.2 生成迁移报告文档
    - 汇总迁移统计信息
    - 列出所有警告和错误
    - 提供手动操作清单
    - _需求: 29.6_
  
  - [ ] 34.3 创建对比工具
    - 对比 Astro 和 Hugo 站点
    - 验证 URL 一致性
    - 验证内容一致性
    - _需求: 29.8_

- [ ] 35. 最终部署
  - [ ] 35.1 部署到生产环境
    - 执行生产部署
    - 验证所有页面可访问
    - 监控错误日志
    - _需求: 27.2_
  
  - [ ] 35.2 配置监控和分析
    - 配置 Google Analytics（如需要）
    - 配置错误监控
    - 配置性能监控
    - _需求: 27.2_
  
  - [ ] 35.3 更新 DNS 和重定向
    - 更新 DNS 记录（如需要）
    - 配置 301 重定向（如 URL 有变化）
    - 验证所有旧 URL 正确重定向
    - _需求: 27.5_
  
  - [ ] 35.4 通知和文档更新
    - 通知用户迁移完成
    - 更新相关文档
    - 培训内容创作者
    - _需求: 26.5_

## 注意事项

### 任务标记说明

- `[ ]` - 核心实现任务，必须完成
- `[ ]*` - 可选测试任务，可以跳过以加快 MVP 开发
- 每个任务都标注了相关的需求编号（_需求: X.Y_）

### 属性测试说明

所有标记为 `*` 的属性测试任务都使用 fast-check 库，配置为至少 100 次迭代。每个属性测试都明确标注了：
- **Property N**: 对应设计文档中的属性编号和名称
- **验证需求**: 该属性验证的具体需求编号

### Checkpoint 任务

Checkpoint 任务用于在关键阶段验证进度，确保：
- 所有测试通过
- 功能正常工作
- 如有疑问及时询问用户

### 依赖关系

任务按照自然的依赖顺序组织：
1. 基础设施必须先搭建
2. 内容迁移依赖于基础结构
3. 组件实现依赖于内容和布局
4. 样式和功能可以并行开发
5. 测试和优化在功能完成后进行
6. 部署是最后一步

### 预计时间分配

- 阶段 1（基础设施）: 3-5 天
- 阶段 2（内容迁移）: 5-7 天
- 阶段 3（核心组件）: 7-10 天
- 阶段 4（样式系统）: 5-7 天
- 阶段 5（高级功能）: 10-14 天
- 阶段 6（SEO 和特殊页面）: 5-7 天
- 阶段 7（优化、测试和部署）: 7-10 天

**总计**: 约 7 周（42-60 天）

### 成功标准

迁移成功的标准：
- ✅ 所有核心任务完成
- ✅ 所有内容迁移无数据丢失
- ✅ 所有页面可访问，无 404 错误
- ✅ 所有功能正常工作
- ✅ 性能指标达标（Lighthouse > 90）
- ✅ 可访问性符合 WCAG AA
- ✅ 用户验收测试通过

## 开始执行

要开始执行任务，请：
1. 打开此 tasks.md 文件
2. 点击任务旁边的 "Start task" 按钮
3. 按照任务描述逐步实现
4. 完成后标记任务为完成

祝迁移顺利！🚀
