---
title: Mermaid 图表测试
published: 2026-02-18
description: "测试 Mermaid 图表渲染功能"
tags: [demo]
category: examples
draft: false
lang: zh_CN
mermaid: true
---

## Mermaid 图表测试

本文用于验证 Mermaid 图表渲染功能是否正常工作。

### 流程图 (Flowchart)

```mermaid
graph TD;
    A[开始] --> B{是否安装?};
    B -->|是| C[运行项目];
    B -->|否| D[安装依赖];
    D --> C;
    C --> E[完成];
```

### 序列图 (Sequence Diagram)

```mermaid
sequenceDiagram
    participant 用户
    participant 浏览器
    participant 服务器

    用户->>浏览器: 访问页面
    浏览器->>服务器: 请求数据
    服务器-->>浏览器: 返回 HTML
    浏览器-->>用户: 渲染页面
```

### 甘特图 (Gantt Chart)

```mermaid
gantt
    title 项目计划
    dateFormat  YYYY-MM-DD
    section 设计
    需求分析       :a1, 2026-02-01, 7d
    UI 设计        :a2, after a1, 5d
    section 开发
    前端开发       :b1, after a2, 10d
    后端开发       :b2, after a2, 12d
    section 测试
    集成测试       :c1, after b2, 5d
```

### 饼图 (Pie Chart)

```mermaid
pie title 技术栈使用占比
    "Astro" : 40
    "Svelte" : 25
    "TailwindCSS" : 20
    "TypeScript" : 15
```

### 类图 (Class Diagram)

```mermaid
classDiagram
    class BlogPost {
        +String title
        +Date published
        +String[] tags
        +boolean mermaid
        +render() void
    }
    class Config {
        +boolean enable
    }
    BlogPost --> Config : uses
```

### 普通代码块（不受影响）

下面的代码块应该正常高亮，不会被 Mermaid 处理：

```javascript
const config = {
  mermaid: {
    enable: true,
  },
};
console.log("Hello Mermaid!");
```
