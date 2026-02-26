# 需求文档：Astro 博客迁移至 Hugo

## 简介

本文档定义了将现有 KIRARI Astro 博客项目完整迁移至 Hugo 静态站点生成器的需求。该项目是一个功能丰富的多语言博客系统，包含复杂的组件系统、插件架构、样式系统和内容管理功能。迁移目标是在 Hugo 平台上重现所有现有功能和特性，同时保持内容完整性和用户体验一致性。

## 术语表

- **Migration_System**: 负责执行迁移过程的系统
- **Content_Converter**: 将 Astro 内容格式转换为 Hugo 格式的组件
- **Theme_Engine**: Hugo 主题系统，负责渲染页面
- **I18n_Manager**: 多语言支持管理器
- **Plugin_Adapter**: 将 Astro 插件功能适配到 Hugo 的适配器
- **Style_Processor**: 处理和转换样式文件的处理器
- **Build_System**: Hugo 构建系统
- **Config_Mapper**: 配置文件映射器
- **Component_Library**: Hugo 组件库（Partials 和 Shortcodes）
- **Asset_Pipeline**: 资源处理管道
- **Search_Engine**: 站内搜索引擎（Pagefind）
- **Markdown_Processor**: Markdown 内容处理器
- **Frontmatter_Schema**: 文章元数据模式定义
- **Navigation_System**: 导航系统
- **Taxonomy_System**: 分类和标签系统
- **RSS_Generator**: RSS 订阅生成器
- **Sitemap_Generator**: 站点地图生成器

## 需求

### 需求 1: 项目结构分析与映射

**用户故事:** 作为迁移工程师，我需要完整分析 Astro 项目结构并映射到 Hugo 架构，以便制定准确的迁移策略。

#### 验收标准


1. THE Migration_System SHALL 识别所有 Astro 项目目录结构（src/components、src/layouts、src/pages、src/content、src/styles、src/plugins、src/i18n）
2. THE Config_Mapper SHALL 将 astro.config.mjs 和 src/constants.ts 配置映射到 Hugo config.toml/yaml
3. THE Migration_System SHALL 记录所有依赖包及其在 Hugo 中的等效方案
4. THE Migration_System SHALL 识别所有自定义 Remark 和 Rehype 插件功能
5. THE Component_Library SHALL 将 Astro 组件映射到 Hugo Partials 或 Shortcodes

### 需求 2: 内容迁移

**用户故事:** 作为内容创作者，我需要所有博客文章和页面完整迁移到 Hugo，以便保持内容完整性。

#### 验收标准

1. THE Content_Converter SHALL 将所有 src/content/posts/*.md 文件转换为 Hugo content/posts/*.md 格式
2. THE Frontmatter_Schema SHALL 转换 Astro frontmatter（title、published、updated、description、image、tags、category、draft、lang、mermaid）到 Hugo frontmatter
3. THE Content_Converter SHALL 保持 Markdown 内容体不变
4. THE Content_Converter SHALL 转换 src/content/spec/*.md（about.md、friends.md）到 Hugo content 目录
5. THE Content_Converter SHALL 处理所有图片引用路径，确保在 Hugo 中正确解析
6. WHEN 文章包含 draft: true 标记时，THE Build_System SHALL 在生产构建中排除该文章
7. THE Content_Converter SHALL 保留所有文章的发布日期和更新日期

### 需求 3: 多语言支持（i18n）

**用户故事:** 作为国际用户，我需要完整的多语言支持，以便用我的母语阅读内容。

#### 验收标准

1. THE I18n_Manager SHALL 支持 10 种语言（en、es、id、ja、ko、th、tr、vi、zh_CN、zh_TW）
2. THE I18n_Manager SHALL 将 src/i18n/languages/*.ts 翻译文件转换为 Hugo i18n/*.yaml 格式
3. THE I18n_Manager SHALL 实现所有 i18n 键的翻译（home、about、archive、search、friends、tags、categories、recentPosts、comments 等 30+ 个键）
4. THE Navigation_System SHALL 根据当前语言显示正确的导航文本
5. WHEN 文章指定 lang 字段时，THE Build_System SHALL 将文章归类到对应语言版本
6. THE I18n_Manager SHALL 实现语言切换功能
7. THE Config_Mapper SHALL 配置 Hugo 的 defaultContentLanguage 和 languages 设置


### 需求 4: 组件系统迁移

**用户故事:** 作为开发者，我需要所有 Astro 组件在 Hugo 中有对应实现，以便保持页面功能完整。

#### 验收标准

1. THE Component_Library SHALL 实现 Navbar 组件（导航栏，包含 Logo、导航链接、搜索按钮、主题切换）
2. THE Component_Library SHALL 实现 Footer 组件（页脚，支持自定义 HTML 和脚本）
3. THE Component_Library SHALL 实现 SideBar 组件（侧边栏，包含 Profile、Categories、Tags 小部件）
4. THE Component_Library SHALL 实现 PostCard 组件（文章卡片，显示标题、描述、日期、标签、分类、封面图）
5. THE Component_Library SHALL 实现 PostMeta 组件（文章元信息，显示作者、发布日期、更新日期、阅读时间、字数）
6. THE Component_Library SHALL 实现 ArchivePanel 组件（归档面板，按年月分组显示文章）
7. THE Component_Library SHALL 实现 Search 组件（搜索功能，集成 Pagefind）
8. THE Component_Library SHALL 实现 TOC 组件（目录，支持 3 级标题深度）
9. THE Component_Library SHALL 实现 LightDarkSwitch 组件（明暗主题切换）
10. THE Component_Library SHALL 实现 BackToTop 组件（返回顶部按钮）
11. THE Component_Library SHALL 实现 Pagination 组件（分页导航）
12. THE Component_Library SHALL 实现 License 组件（许可协议显示）
13. THE Component_Library SHALL 实现 Profile 组件（个人资料卡片，包含头像、姓名、简介、社交链接）
14. THE Component_Library SHALL 实现 Categories 和 Tags 小部件
15. THE Component_Library SHALL 实现 DisplaySettings 组件（显示设置，包含主题色选择器）

### 需求 5: 布局系统

**用户故事:** 作为开发者，我需要完整的布局系统，以便不同类型的页面使用正确的布局。

#### 验收标准

1. THE Theme_Engine SHALL 实现 baseof.html 基础布局（对应 Layout.astro）
2. THE Theme_Engine SHALL 实现 single.html 单页布局（文章详情页）
3. THE Theme_Engine SHALL 实现 list.html 列表布局（文章列表、标签列表、分类列表）
4. THE Theme_Engine SHALL 实现 index.html 首页布局
5. THE Theme_Engine SHALL 实现 MainGridLayout（主网格布局，包含侧边栏）
6. THE Theme_Engine SHALL 实现 archive.html 归档页布局
7. THE Theme_Engine SHALL 实现 taxonomy.html 分类法布局（标签页、分类页）
8. WHEN 页面类型为文章时，THE Theme_Engine SHALL 使用 single.html 布局
9. WHEN 页面类型为列表时，THE Theme_Engine SHALL 使用 list.html 布局


### 需求 6: Markdown 处理与插件

**用户故事:** 作为内容创作者，我需要所有 Markdown 扩展功能在 Hugo 中正常工作，以便使用丰富的内容格式。

#### 验收标准

1. THE Markdown_Processor SHALL 支持数学公式渲染（KaTeX，对应 remark-math 和 rehype-katex）
2. THE Markdown_Processor SHALL 计算文章阅读时间和字数（对应 remark-reading-time）
3. THE Markdown_Processor SHALL 提取文章摘要（对应 remark-excerpt）
4. THE Markdown_Processor SHALL 为标题自动生成 ID（对应 rehype-slug）
5. THE Markdown_Processor SHALL 为标题添加锚点链接（对应 rehype-autolink-headings）
6. THE Markdown_Processor SHALL 为图片添加懒加载属性（对应 rehype-lazy-load-image）
7. THE Markdown_Processor SHALL 支持 Mermaid 图表渲染（对应 rehype-mermaid-pre）
8. THE Markdown_Processor SHALL 支持 GitHub 风格的告示块（Note、Tip、Important、Caution、Warning，对应 remark-github-admonitions-to-directives）
9. THE Markdown_Processor SHALL 支持自定义指令（对应 remark-directive）
10. THE Markdown_Processor SHALL 支持章节化（对应 remark-sectionize）
11. WHEN 文章 frontmatter 包含 mermaid: true 时，THE Asset_Pipeline SHALL 加载 Mermaid.js 库
12. THE Markdown_Processor SHALL 支持 GitHub 卡片 shortcode（对应 GithubCardComponent）
13. THE Markdown_Processor SHALL 支持 GitHub 文件卡片 shortcode（对应 GithubFileCardComponent）

### 需求 7: 代码高亮系统

**用户故事:** 作为技术博主，我需要强大的代码高亮功能，以便展示代码示例。

#### 验收标准

1. THE Markdown_Processor SHALL 使用 Chroma 或 Shiki 进行语法高亮
2. THE Markdown_Processor SHALL 支持双主题（github-dark 和 github-dark-dimmed）
3. THE Markdown_Processor SHALL 支持代码块折叠功能（对应 plugin-collapsible-sections）
4. THE Markdown_Processor SHALL 支持行号显示（对应 plugin-line-numbers）
5. THE Markdown_Processor SHALL 显示语言标识（对应 plugin-language-badge）
6. THE Markdown_Processor SHALL 提供自定义复制按钮（对应 plugin-custom-copy-button）
7. THE Markdown_Processor SHALL 支持代码自动换行
8. THE Markdown_Processor SHALL 为 shellsession 语言禁用行号
9. THE Markdown_Processor SHALL 排除 mermaid 语言的语法高亮


### 需求 8: 样式系统迁移

**用户故事:** 作为用户，我需要网站保持原有的视觉风格和交互体验，以便获得一致的使用体验。

#### 验收标准

1. THE Style_Processor SHALL 将 Stylus 文件（variables.styl、markdown-extend.styl）转换为 CSS 或 SCSS
2. THE Style_Processor SHALL 保留所有 CSS 变量定义（--primary、--page-bg、--card-bg 等 50+ 个变量）
3. THE Style_Processor SHALL 实现明暗主题切换逻辑（:root 和 :root.dark）
4. THE Style_Processor SHALL 保留 TailwindCSS 配置和样式
5. THE Style_Processor SHALL 迁移所有自定义 CSS 文件（main.css、markdown.css、expressive-code.css、photoswipe.css、scrollbar.css、transition.css、fonts.css）
6. THE Style_Processor SHALL 配置字体（JetBrains Mono Variable、Roboto）
7. THE Style_Processor SHALL 实现响应式设计，支持移动端和桌面端
8. THE Style_Processor SHALL 保留所有动画和过渡效果
9. THE Style_Processor SHALL 实现自定义滚动条样式
10. THE Style_Processor SHALL 支持主题色调整（hue 值从 0 到 360）

### 需求 9: 分类法系统（Taxonomies）

**用户故事:** 作为用户，我需要通过标签和分类浏览文章，以便找到感兴趣的内容。

#### 验收标准

1. THE Taxonomy_System SHALL 配置 tags 和 categories 两种分类法
2. THE Taxonomy_System SHALL 实现标签映射（slug 到显示名称，如 web_dev → Web开发）
3. THE Taxonomy_System SHALL 实现分类映射（slug 到显示名称，如 examples → 示例）
4. THE Taxonomy_System SHALL 生成标签列表页（/tags/）
5. THE Taxonomy_System SHALL 生成分类列表页（/categories/）
6. THE Taxonomy_System SHALL 生成单个标签页（/tags/[tag]/）
7. THE Taxonomy_System SHALL 生成单个分类页（/categories/[category]/）
8. THE Taxonomy_System SHALL 在文章页显示所属标签和分类
9. THE Taxonomy_System SHALL 统计每个标签和分类的文章数量
10. THE Taxonomy_System SHALL 按文章数量排序标签和分类

### 需求 10: 搜索功能

**用户故事:** 作为用户，我需要搜索功能，以便快速找到相关文章。

#### 验收标准

1. THE Search_Engine SHALL 集成 Pagefind 搜索引擎
2. THE Search_Engine SHALL 在构建时生成搜索索引
3. THE Search_Engine SHALL 支持全文搜索
4. THE Search_Engine SHALL 支持多语言搜索
5. THE Search_Engine SHALL 在搜索结果中显示文章标题、摘要和 URL
6. THE Search_Engine SHALL 高亮搜索关键词
7. THE Search_Engine SHALL 提供搜索建议
8. WHEN 用户输入搜索关键词时，THE Search_Engine SHALL 实时显示搜索结果


### 需求 11: 导航系统

**用户故事:** 作为用户，我需要清晰的导航系统，以便在网站中自由浏览。

#### 验收标准

1. THE Navigation_System SHALL 实现主导航栏（Home、Archive、About、Friends、GitHub）
2. THE Navigation_System SHALL 支持内部链接和外部链接
3. THE Navigation_System SHALL 为外部链接添加图标和 target="_blank"
4. THE Navigation_System SHALL 自动处理 base path（如 /blog/）
5. THE Navigation_System SHALL 高亮当前页面的导航项
6. THE Navigation_System SHALL 实现移动端响应式菜单
7. THE Navigation_System SHALL 实现面包屑导航
8. THE Navigation_System SHALL 实现文章的上一篇/下一篇导航

### 需求 12: 资源管理

**用户故事:** 作为开发者，我需要高效的资源管理系统，以便优化网站性能。

#### 验收标准

1. THE Asset_Pipeline SHALL 处理图片资源（压缩、格式转换）
2. THE Asset_Pipeline SHALL 支持图片懒加载
3. THE Asset_Pipeline SHALL 集成 PhotoSwipe 图片灯箱功能
4. THE Asset_Pipeline SHALL 处理字体文件（@fontsource-variable/jetbrains-mono、@fontsource/roboto）
5. THE Asset_Pipeline SHALL 处理图标（使用 @iconify 或 Hugo 内置图标方案）
6. THE Asset_Pipeline SHALL 最小化 CSS 和 JavaScript
7. THE Asset_Pipeline SHALL 实现代码分割，按需加载
8. THE Asset_Pipeline SHALL 生成 favicon
9. THE Asset_Pipeline SHALL 处理 public 目录下的静态资源
10. WHEN Mermaid 功能未启用时，THE Asset_Pipeline SHALL NOT 加载 Mermaid.js 库

### 需求 13: SEO 和元数据

**用户故事:** 作为网站所有者，我需要完善的 SEO 支持，以便提高搜索引擎排名。

#### 验收标准

1. THE Build_System SHALL 生成 sitemap.xml
2. THE Build_System SHALL 生成 robots.txt
3. THE Build_System SHALL 生成 RSS feed（/rss.xml）
4. THE Build_System SHALL 为每个页面生成 Open Graph 标签
5. THE Build_System SHALL 为每个页面生成 Twitter Card 标签
6. THE Build_System SHALL 支持自定义 meta 标签（Google、Bing、Yandex、Naver 验证码）
7. THE Build_System SHALL 设置正确的 canonical URL
8. THE Build_System SHALL 生成结构化数据（JSON-LD）
9. THE Build_System SHALL 设置正确的 hreflang 标签（多语言）
10. WHEN 文章有封面图时，THE Build_System SHALL 将其设置为 og:image


### 需求 14: 配置系统

**用户故事:** 作为网站管理员，我需要灵活的配置系统，以便自定义网站设置。

#### 验收标准

1. THE Config_Mapper SHALL 将 Config.site 配置映射到 Hugo config（url、baseURL、title、languageCode）
2. THE Config_Mapper SHALL 将 Config.navBar 配置映射到 Hugo menu 配置
3. THE Config_Mapper SHALL 将 Config.profile 配置映射到 Hugo params
4. THE Config_Mapper SHALL 将 Config.license 配置映射到 Hugo params
5. THE Config_Mapper SHALL 将 Config.expressiveCode 配置映射到代码高亮配置
6. THE Config_Mapper SHALL 将 Config.mermaid 配置映射到 Hugo params
7. THE Config_Mapper SHALL 将 Config.head 配置映射到 Hugo params（verification、customHtml、customScript）
8. THE Config_Mapper SHALL 将 Config.footer 配置映射到 Hugo params（customHtml、customScript）
9. THE Config_Mapper SHALL 将 Config.mappings 配置映射到 Hugo data 文件
10. THE Config_Mapper SHALL 将 Config.llms 配置映射到 Hugo params
11. THE Config_Mapper SHALL 支持 YAML、TOML 或 JSON 配置格式
12. THE Config_Mapper SHALL 配置 trailingSlash 行为
13. THE Config_Mapper SHALL 配置构建选项（minify、inlineStylesheets）

### 需求 15: 友链系统

**用户故事:** 作为博主，我需要友链页面，以便展示友情链接。

#### 验收标准

1. THE Build_System SHALL 读取 src/_data/friends.json 数据
2. THE Build_System SHALL 将友链数据转换为 Hugo data 文件（data/friends.json 或 friends.yaml）
3. THE Build_System SHALL 在友链页面显示所有友链（站点标题、描述、URL、图标）
4. THE Build_System SHALL 在友链页面顶部显示介绍文本（来自 content/spec/friends.md）
5. THE Build_System SHALL 为友链卡片添加悬停效果
6. THE Build_System SHALL 为友链添加外部链接图标
7. THE Build_System SHALL 支持友链数据的增删改

### 需求 16: 主题切换功能

**用户故事:** 作为用户，我需要切换明暗主题，以便在不同环境下舒适阅读。

#### 验收标准

1. THE Theme_Engine SHALL 实现三种主题模式（亮色、暗色、跟随系统）
2. THE Theme_Engine SHALL 在页面加载时应用用户保存的主题偏好
3. THE Theme_Engine SHALL 将主题偏好保存到 localStorage
4. THE Theme_Engine SHALL 提供主题切换按钮
5. THE Theme_Engine SHALL 在切换主题时添加平滑过渡动画
6. THE Theme_Engine SHALL 根据主题模式切换 CSS 变量
7. WHEN 用户选择跟随系统时，THE Theme_Engine SHALL 监听系统主题变化
8. THE Theme_Engine SHALL 在主题切换按钮上显示当前主题图标


### 需求 17: 主题色自定义

**用户故事:** 作为用户，我需要自定义主题色，以便个性化网站外观。

#### 验收标准

1. THE Theme_Engine SHALL 支持主题色调（hue）从 0 到 360 度的调整
2. THE Theme_Engine SHALL 提供主题色选择器 UI
3. THE Theme_Engine SHALL 将主题色偏好保存到 localStorage
4. THE Theme_Engine SHALL 在页面加载时应用用户保存的主题色
5. THE Theme_Engine SHALL 通过 CSS 变量 --hue 控制主题色
6. THE Theme_Engine SHALL 实时预览主题色变化
7. WHEN Config.site.themeColor.fixed 为 true 时，THE Theme_Engine SHALL 隐藏主题色选择器
8. THE Theme_Engine SHALL 为主题色选择器提供彩虹渐变背景

### 需求 18: 页面过渡动画

**用户故事:** 作为用户，我需要流畅的页面过渡动画，以便获得更好的浏览体验。

#### 验收标准

1. THE Theme_Engine SHALL 实现页面切换时的淡入淡出动画
2. THE Theme_Engine SHALL 实现页面加载进度条
3. THE Theme_Engine SHALL 在页面切换时保持滚动位置（如需要）
4. THE Theme_Engine SHALL 预加载链接页面（hover 时）
5. THE Theme_Engine SHALL 使用 Swup 或类似库实现平滑过渡
6. THE Theme_Engine SHALL 在不支持 View Transitions API 的浏览器中提供降级方案
7. THE Theme_Engine SHALL 为内容加载添加延迟动画（--content-delay: 150ms）

### 需求 19: 归档页面

**用户故事:** 作为用户，我需要归档页面，以便按时间浏览所有文章。

#### 验收标准

1. THE Build_System SHALL 生成归档页面（/archive/）
2. THE Build_System SHALL 按年份分组显示文章
3. THE Build_System SHALL 按月份分组显示文章
4. THE Build_System SHALL 显示每篇文章的标题、日期和分类
5. THE Build_System SHALL 统计文章总数
6. THE Build_System SHALL 按时间倒序排列文章（最新的在前）
7. THE Build_System SHALL 为归档页面添加时间轴样式


### 需求 20: 分页功能

**用户故事:** 作为用户，我需要分页功能，以便浏览大量文章。

#### 验收标准

1. THE Build_System SHALL 为文章列表页实现分页
2. THE Build_System SHALL 配置每页显示的文章数量
3. THE Build_System SHALL 生成分页导航（上一页、下一页、页码）
4. THE Build_System SHALL 为第一页生成 /page/1/ 和 / 两个 URL
5. THE Build_System SHALL 为后续页面生成 /page/N/ URL
6. THE Build_System SHALL 在分页导航中高亮当前页
7. THE Build_System SHALL 在首页和末页禁用相应的导航按钮

### 需求 21: LLMs 文档生成

**用户故事:** 作为 AI 开发者，我需要为 LLMs 优化的文档，以便 AI 模型理解网站内容。

#### 验收标准

1. THE Build_System SHALL 生成 llms.txt 文档索引
2. THE Build_System SHALL 生成 llms-small.txt 简洁版文档
3. THE Build_System SHALL 生成 llms-full.txt 完整版文档
4. WHEN Config.llms.i18n 为 true 时，THE Build_System SHALL 为每种语言生成独立的 LLMs 文档（llms-en.txt、llms-zh.txt 等）
5. THE Build_System SHALL 在 sitemap.xml 中包含 LLMs 文档 URL
6. THE Build_System SHALL 使用 Config.llms.title 和 Config.llms.description 作为文档元数据
7. WHEN Config.llms.enable 为 false 时，THE Build_System SHALL NOT 生成 LLMs 文档

### 需求 22: 性能优化

**用户故事:** 作为用户，我需要快速的页面加载速度，以便获得流畅的浏览体验。

#### 验收标准

1. THE Build_System SHALL 最小化 HTML、CSS 和 JavaScript
2. THE Asset_Pipeline SHALL 压缩图片
3. THE Asset_Pipeline SHALL 生成响应式图片（srcset）
4. THE Asset_Pipeline SHALL 实现关键 CSS 内联
5. THE Asset_Pipeline SHALL 延迟加载非关键资源
6. THE Build_System SHALL 生成静态 HTML 页面
7. THE Build_System SHALL 实现代码分割
8. THE Build_System SHALL 配置浏览器缓存策略
9. THE Build_System SHALL 生成 Service Worker（可选）
10. THE Build_System SHALL 优化字体加载（font-display: swap）


### 需求 23: 响应式设计

**用户故事:** 作为移动端用户，我需要网站在各种设备上正常显示，以便随时随地阅读。

#### 验收标准

1. THE Theme_Engine SHALL 支持移动端（320px+）、平板（768px+）和桌面端（1024px+）
2. THE Theme_Engine SHALL 在移动端隐藏侧边栏，提供汉堡菜单
3. THE Theme_Engine SHALL 在移动端优化导航栏布局
4. THE Theme_Engine SHALL 在移动端优化文章卡片布局
5. THE Theme_Engine SHALL 在移动端优化 TOC 显示（折叠或底部显示）
6. THE Theme_Engine SHALL 使用响应式图片
7. THE Theme_Engine SHALL 优化移动端触摸交互
8. THE Theme_Engine SHALL 在移动端优化字体大小和行高

### 需求 24: 可访问性（Accessibility）

**用户故事:** 作为残障用户，我需要网站具备良好的可访问性，以便使用辅助技术浏览。

#### 验收标准

1. THE Theme_Engine SHALL 为所有图片提供 alt 属性
2. THE Theme_Engine SHALL 使用语义化 HTML 标签
3. THE Theme_Engine SHALL 提供键盘导航支持
4. THE Theme_Engine SHALL 为交互元素提供 focus 样式
5. THE Theme_Engine SHALL 使用 ARIA 标签增强可访问性
6. THE Theme_Engine SHALL 确保颜色对比度符合 WCAG AA 标准
7. THE Theme_Engine SHALL 为 skip to content 链接提供支持
8. THE Theme_Engine SHALL 为表单元素提供 label

### 需求 25: 错误处理

**用户故事:** 作为用户，我需要友好的错误页面，以便在访问不存在的页面时获得帮助。

#### 验收标准

1. THE Build_System SHALL 生成 404 错误页面
2. THE Build_System SHALL 在 404 页面提供返回首页链接
3. THE Build_System SHALL 在 404 页面提供搜索功能
4. THE Build_System SHALL 在 404 页面显示最近文章列表
5. IF 构建过程中发生错误，THEN THE Build_System SHALL 输出详细的错误信息
6. IF 配置文件格式错误，THEN THE Build_System SHALL 提示具体的错误位置


### 需求 26: 开发体验

**用户故事:** 作为开发者，我需要良好的开发体验，以便高效地维护和扩展网站。

#### 验收标准

1. THE Build_System SHALL 提供本地开发服务器（hugo server）
2. THE Build_System SHALL 支持热重载（live reload）
3. THE Build_System SHALL 提供快速的构建速度
4. THE Build_System SHALL 提供清晰的构建日志
5. THE Build_System SHALL 提供开发文档（README.md）
6. THE Build_System SHALL 提供配置示例和注释
7. THE Build_System SHALL 提供新建文章的脚本（对应 scripts/new-post.js）
8. THE Build_System SHALL 支持草稿模式（hugo server -D）

### 需求 27: 部署支持

**用户故事:** 作为网站管理员，我需要简单的部署流程，以便快速发布网站。

#### 验收标准

1. THE Build_System SHALL 生成可直接部署的静态文件
2. THE Build_System SHALL 支持 GitHub Pages 部署
3. THE Build_System SHALL 支持 Netlify 部署
4. THE Build_System SHALL 支持 Vercel 部署
5. THE Build_System SHALL 支持自定义域名配置
6. THE Build_System SHALL 生成正确的资源路径（考虑 baseURL）
7. THE Build_System SHALL 提供 CI/CD 配置示例（GitHub Actions）

### 需求 28: 内容验证

**用户故事:** 作为内容创作者，我需要内容验证功能，以便确保文章格式正确。

#### 验收标准

1. THE Build_System SHALL 验证 frontmatter 必填字段（title、published）
2. THE Build_System SHALL 验证日期格式（YYYY-MM-DD）
3. THE Build_System SHALL 验证标签和分类是否在映射表中定义
4. THE Build_System SHALL 验证图片路径是否存在
5. IF frontmatter 缺少必填字段，THEN THE Build_System SHALL 输出警告信息
6. IF 文章包含损坏的链接，THEN THE Build_System SHALL 输出警告信息


### 需求 29: 迁移工具

**用户故事:** 作为迁移工程师，我需要自动化迁移工具，以便高效完成迁移任务。

#### 验收标准

1. THE Migration_System SHALL 提供内容转换脚本
2. THE Migration_System SHALL 提供配置转换脚本
3. THE Migration_System SHALL 提供样式转换脚本（Stylus 到 CSS/SCSS）
4. THE Migration_System SHALL 提供组件映射文档
5. THE Migration_System SHALL 验证迁移后的内容完整性
6. THE Migration_System SHALL 生成迁移报告（成功/失败的项目）
7. THE Migration_System SHALL 提供回滚机制
8. THE Migration_System SHALL 提供迁移前后的对比工具

### 需求 30: 测试与验证

**用户故事:** 作为质量保证工程师，我需要完整的测试，以便确保迁移后的网站功能正常。

#### 验收标准

1. THE Migration_System SHALL 验证所有页面可正常访问（无 404 错误）
2. THE Migration_System SHALL 验证所有内部链接有效
3. THE Migration_System SHALL 验证所有图片正常加载
4. THE Migration_System SHALL 验证多语言切换功能
5. THE Migration_System SHALL 验证搜索功能
6. THE Migration_System SHALL 验证标签和分类页面
7. THE Migration_System SHALL 验证 RSS feed 格式正确
8. THE Migration_System SHALL 验证 sitemap.xml 格式正确
9. THE Migration_System SHALL 验证主题切换功能
10. THE Migration_System SHALL 验证响应式布局
11. THE Migration_System SHALL 验证代码高亮功能
12. THE Migration_System SHALL 验证数学公式渲染
13. THE Migration_System SHALL 验证 Mermaid 图表渲染
14. THE Migration_System SHALL 验证 SEO 元数据
15. THE Migration_System SHALL 进行性能测试（Lighthouse 评分）
16. THE Migration_System SHALL 进行可访问性测试（WCAG 合规性）
17. FOR ALL 原 Astro 网站的页面，迁移后的 Hugo 网站 SHALL 生成等效的页面
18. FOR ALL 原 Astro 网站的功能，迁移后的 Hugo 网站 SHALL 提供等效的功能

## 迁移策略

### 阶段 1: 准备与分析
- 完整分析 Astro 项目结构
- 创建功能映射表
- 确定 Hugo 主题架构
- 准备开发环境

### 阶段 2: 核心迁移
- 转换配置文件
- 迁移内容文件
- 实现基础布局
- 实现核心组件

### 阶段 3: 功能实现
- 实现多语言支持
- 实现 Markdown 扩展
- 实现样式系统
- 实现搜索功能

### 阶段 4: 优化与测试
- 性能优化
- 功能测试
- 兼容性测试
- 用户验收测试

### 阶段 5: 部署与文档
- 部署到生产环境
- 编写使用文档
- 培训内容创作者
- 监控和维护

## 风险评估

### 高风险项
1. **Stylus 到 CSS 转换**: Stylus 的高级特性可能难以完全转换
2. **自定义 Remark/Rehype 插件**: Hugo 的 Markdown 处理器可能无法完全复制所有功能
3. **Svelte 组件**: Hugo 不支持 Svelte，需要用原生 JavaScript 或 Alpine.js 重写
4. **页面过渡动画**: Hugo 的客户端路由能力有限

### 中风险项
1. **图标系统**: @iconify 需要替换为 Hugo 兼容方案
2. **代码高亮**: Expressive Code 的高级特性可能需要自定义实现
3. **LLMs 文档生成**: 需要自定义 Hugo 模板或脚本

### 低风险项
1. **内容迁移**: Markdown 格式基本兼容
2. **多语言支持**: Hugo 内置强大的 i18n 支持
3. **SEO 功能**: Hugo 内置完善的 SEO 支持

## 缓解措施

1. **Stylus 转换**: 使用自动化工具（如 stylus-converter）+ 手动调整
2. **插件功能**: 使用 Hugo Shortcodes + 客户端 JavaScript 实现
3. **Svelte 组件**: 使用 Alpine.js 或 Vanilla JS 重写交互逻辑
4. **图标系统**: 使用 Hugo Pipes 处理 SVG 图标或使用 CDN
5. **代码高亮**: 使用 Hugo 内置 Chroma + 自定义 CSS 样式
6. **页面过渡**: 使用 Swup.js 或类似库实现客户端路由

## 成功标准

迁移成功的标准：
1. 所有页面正常访问，无 404 错误
2. 所有功能正常工作（搜索、导航、主题切换等）
3. 视觉效果与原网站一致（允许细微差异）
4. 性能指标不低于原网站（Lighthouse 评分）
5. SEO 元数据完整且正确
6. 多语言功能正常
7. 响应式布局在各设备上正常显示
8. 可访问性符合 WCAG AA 标准
9. 构建时间合理（< 1 分钟）
10. 开发体验良好（热重载、清晰的错误信息）
