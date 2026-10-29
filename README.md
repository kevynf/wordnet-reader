# Wordnet Reader

[简体中文](README.md) | [English](README.en.md)

一个注重可读性、支持离线使用的 Open English Wordnet 浏览器。

Wordnet Reader 以紧凑的深色界面展示释义、例句、发音和词汇关系。应用完全运行在浏览器中，无需账号或后端，并且可以缓存完整词典以供离线使用。

## 功能

- 精确查词与标准化前缀建议
- 释义、例句、发音、同义词和语义关系
- 词性视图与一致的词头级元数据
- 保存在当前设备上的本地历史记录和收藏
- 可安装的 PWA，支持按需缓存和可选的完整离线下载
- 无服务端应用或数据库的静态部署

## 快速开始

环境要求：Node.js 20 或更高版本，以及 pnpm 11.22.0。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

开发服务器使用提交在仓库中的四词演示数据集。打开 Vite 输出的地址即可在不下载完整词典的情况下开发界面。

## 完整词典

完整的 2025 Plus 数据集根据上游 Open English Wordnet 发布版本生成：

```sh
pnpm data:fetch
pnpm data:build
pnpm data:verify
```

源压缩包的校验值固定在 `scripts/config.mjs` 中。只有在有意迁移到重新发布的压缩包时，才应设置 `OEWN_SHA256`。
生成的源文件和词典文件不会提交到 Git；CI 会在部署前重新构建它们。

## 验证

```sh
pnpm format:check
pnpm test
pnpm data:verify
pnpm build
```

`pnpm build` 会在 `dist/` 中生成静态生产网站。运行 `pnpm preview` 可以检查本地构建结果。

## GitHub Pages

在线演示：<https://app.kevy.net/wordnet-reader/>。

`.github/workflows/deploy.yml` 工作流会根据锁定的 pnpm lockfile 安装依赖，重新构建并验证完整词典，生成 PWA，然后部署 `dist/`。

部署步骤：

1. 将仓库的 Pages 来源设置为 **GitHub Actions**。
2. 推送 `main` 分支，或手动运行 **Deploy to GitHub Pages** 工作流。

Vite 构建使用相对资源路径，因此可以在 GitHub Pages 的项目子路径下运行。固定的上游发布版本不需要部署密钥；`OEWN_SHA256` 是可选的仓库变量，仅用于有意覆盖校验值。

## 数据与许可

应用代码采用 [MIT License](LICENSE)。词典数据保留其上游 Princeton WordNet License 和 Creative Commons Attribution 4.0 条款；详见 [NOTICE](NOTICE) 中的署名和来源信息。

Wordnet Reader 是独立的非官方浏览器，不代表 Princeton University、Global WordNet Association 或 Open English Wordnet 团队的立场，也未获得其认可。
