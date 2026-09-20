# CityU-Hub 静态数据构建器

这是把作者提交的 `repos/*.md` 构建成前端可直接读取的静态 JSON。

## 工作流

```text
作者编辑 repos/<id>.md
        |
        | Pull Request
        v
validate.yml 校验 front matter、Schema、重复 ID 和重复仓库
        |
        | 合并到 main
        v
build.yml 调用 GitHub API 补充动态字段并生成 output/*.json
        |
        v
未来由前端构建流程复制到 front-end/public/data/并部署
```

只有合并到 `main` 的内容才会进入构建；PR 不直接发布网页内容。

## 本地命令

```bash
cd back-end
npm install
npm run validate
npm run build:offline
npm test
```

联网构建使用：

```bash
npm run build
```

联网构建会使用 `GITHUB_TOKEN`（可选）读取公开仓库的描述、stars、语言、topics、许可证和默认分支。匿名请求会受到 GitHub 限流限制。

## 输入和产物

输入文件格式见根目录 `repos/_template.md`。每个文件包含 YAML front matter 和 Markdown 正文。

作者信息字段：`author` 是 GitHub 用户名，`authorName` 是展示用姓名，`major` 是专业，`enrollmentYear` 是四位入学年份；后三项均为必填。

构建产物写入 `back-end/output/`，并被 `.gitignore` 忽略：

- `projects.json`：项目列表，不包含正文
- `projects/<id>.json`：项目详情、Markdown 正文和解析结果
- `search-index.json`：搜索字段
- `tags.json`、`authors.json`、`categories.json`：筛选聚合
- `stats.json`：统计信息

`back-end/output/` 是构建产物，不是作者编辑入口，也不应成为新的数据源。

当前项目没有运行中的 HTTP API。前端默认读取部署后的静态文件 `/data/projects.json`；如需接入独立 API，前端构建时设置 `VITE_API_BASE`，并提供 `/projects` 与 `/projects/:id` 接口。

## 目录

```text
back-end/
├── src/
│   ├── build-index.mjs       静态索引构建入口
│   ├── validate-repos.mjs    PR 数据校验入口
│   ├── config.js             GitHub 构建配置
│   └── lib/
│       ├── aggregate.js      标签、作者、分类聚合
│       ├── frontmatter.js    YAML front matter 解析
│       ├── github.js         GitHub 仓库元数据客户端
│       ├── markdown.js        Markdown 信息分析
│       └── slug.js            项目 ID 生成
└── test/
    └── build-index.test.mjs  构建器测试
```

作者提交规则见根目录 `CONTRIBUTING.md`。Schema 位于 `schema/repo.schema.json`。
