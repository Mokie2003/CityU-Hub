# 提交项目

项目作者通过 Pull Request 添加或修改 `repos/*.md`，不要直接编辑构建产物 `back-end/output/`。

## 流程

1. 复制 `repos/_template.md`，改名为稳定的项目文件名。
2. 填写 front matter 和 Markdown 正文。
3. 本地运行：

```bash
cd back-end
npm install
npm run validate
npm run build:offline
```

4. 创建 Pull Request。CI 会校验 front matter、项目 ID 和仓库地址是否重复。
5. 合并到 `main` 后，构建 workflow 会调用 GitHub API 补充 stars、language、license 等动态字段，并生成静态 JSON。

## 约定

- `repoUrl` 必须是公开 GitHub 仓库地址。
- `id` 可省略，构建器会根据仓库 owner 和 repo 生成；显式填写后不可随意修改。
- `tags` 使用小写短标签，最多 12 个。
- 项目介绍正文写在 front matter 后面，构建器会把它写入项目详情 JSON。
- 不要提交 `back-end/output/`，它是 CI 构建产物。
