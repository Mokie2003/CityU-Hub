# 提交项目

项目作者通过 Pull Request 添加或修改 `repos/*.md`，不要直接编辑解析产物 `web/public/data/`。

## 分支模型

仓库只有三条长期分支，默认分支是 `main`；旧分支 `master` 已删除，请统一使用 `main`：

| 分支 | 用途 | 收哪类 PR |
| --- | --- | --- |
| `main` | 稳定发布分支，线上的正式版本以它为准 | 只接受 `feature` / `dev` 的合并，不直接往上提交 |
| `feature` | 只丢 Markdown 文件：`repos/*.md` | 提交项目的 PR，全部提到这里 |
| `dev` | 网站改动与新功能：`web/`、`repos-parser/`、`scripts/`、工作流、文档 | 前端 / 解析器 / 文档类 PR |

**本文只讲怎么往 `feature` 提交项目**；改站点代码请从 `dev` 切分支并把 PR 提到 `dev`。一个 PR 只做一件事：只提交项目信息的 PR 不要顺带改站点代码。

## 流程

1. 复制 `repos/_template.md`，改名为稳定的项目文件名。
2. 填写 front matter 和 Markdown 正文。
3. 在仓库根目录本地运行：

```bash
npm install
npm run validate
npm run build
```

4. 从 `feature` 切分支（例如 `feat/add-my-project`），创建目标分支为 `feature` 的 Pull Request。CI 会校验 front matter、项目 ID 和仓库地址是否重复，并跑一遍整站构建。
5. 维护者 review 合并后，会定期把 `feature` 合并进 `main`；**只有合并到 `main` 才会触发发布**——Vercel 自动拉取最新代码并重新解析、重新发布，自建服务器则由 `scripts/sync-and-build.sh` 重建。

## 约定

- `repoUrl` 必须是公开 GitHub 仓库地址。
- `author` 填写 GitHub 用户名；`authorName`、`major` 和 `enrollmentYear` 必须填写作者的姓名、专业和入学年份。
- `enrollmentYear` 使用四位数字，例如 `2024`。
- `id` 可省略，解析器会根据仓库 owner 和 repo 生成；显式填写后不可随意修改。
- `tags` 使用小写短标签，最多 12 个。
- 项目介绍正文写在 front matter 后面，解析器会把它渲染成项目详情页的 HTML。
- `status: hidden` 的条目不会出现在站点上。
- 不要提交 `web/public/data/`，它是构建时自动生成的产物。
