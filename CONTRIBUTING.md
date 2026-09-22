# 提交项目

项目作者通过 Pull Request 添加或修改 `repos/*.md`，不要直接编辑解析产物 `web/public/data/`。

## 流程

1. 复制 `repos/_template.md`，改名为稳定的项目文件名。
2. 填写 front matter 和 Markdown 正文。
3. 在仓库根目录本地运行：

```bash
npm install
npm run validate
npm run build
```

4. 创建 Pull Request。CI 会校验 front matter、项目 ID 和仓库地址是否重复，并跑一遍整站构建。
5. 合并到 `main` 后，Vercel 会自动拉取最新代码并重新解析、重新发布；自建服务器则由 `scripts/sync-and-build.sh` 重建。

## 约定

- `repoUrl` 必须是公开 GitHub 仓库地址。
- `author` 填写 GitHub 用户名；`authorName`、`major` 和 `enrollmentYear` 必须填写作者的姓名、专业和入学年份。
- `enrollmentYear` 使用四位数字，例如 `2024`。
- `id` 可省略，解析器会根据仓库 owner 和 repo 生成；显式填写后不可随意修改。
- `tags` 使用小写短标签，最多 12 个。
- 项目介绍正文写在 front matter 后面，解析器会把它渲染成项目详情页的 HTML。
- `status: hidden` 的条目不会出现在站点上。
- 不要提交 `web/public/data/`，它是构建时自动生成的产物。
