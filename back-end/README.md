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

### 首次启动

后端需要先把 `repos/*.md` 构建成 `output/` 下的 JSON 文件，然后 API 服务才能读取项目数据。
请使用 Node.js `>=20.6.0`，在仓库根目录执行：

```bash
cd back-end
npm install
npm run build:offline
npm run start
```

启动成功后，API 默认监听 `http://127.0.0.1:3001`。可以打开以下地址检查服务：

- `http://127.0.0.1:3001/health`：健康检查
- `http://127.0.0.1:3001/projects`：项目列表
- `http://127.0.0.1:3001/projects/<id>`：项目详情

Windows PowerShell 如果因为执行策略无法运行 `npm`，请使用 `npm.cmd`，例如：

```bash
npm.cmd run build:offline
npm.cmd run start
```

保持服务运行时，可以在另一个终端执行测试或重新构建。修改 `repos/` 后，需要重新运行构建命令，API 才会读取新的数据。

### 常用命令

```bash
npm run validate       # 校验 repos/*.md 的 front matter、Schema 和重复项
npm run build:offline  # 不访问 GitHub，使用本地 Markdown 构建数据
npm run build          # 访问 GitHub，补充仓库信息和 README 回退内容
npm run start          # 启动 API 服务
npm run dev            # 以 watch 模式启动 API 服务
npm test               # 运行后端测试
```

联网构建使用：

```bash
npm run build
```

联网构建会使用 `GITHUB_TOKEN`（可选）读取公开仓库的描述、stars、语言、topics、许可证、默认分支和 README。匿名请求会受到 GitHub 限流限制。

### 配置

可以在 `back-end/.env` 中配置：

```env
GITHUB_TOKEN=your_github_token
GITHUB_TIMEOUT_MS=10000
```

API 服务支持以下环境变量：

```bash
PORT=3001 HOST=127.0.0.1 npm run start
```

也可以通过 `OUTPUT_DIR` 指定 JSON 产物目录。默认情况下，构建产物位于 `back-end/output/`。

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
