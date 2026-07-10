# VibeHub

> 本地项目集中管理与一键启动的桌面应用

VibeHub 是一个 macOS 桌面应用，帮你把散落各处、用 AI 辅助写出来的小项目（网页类 dev server 项目、已打包好的桌面 App）集中收进一个界面，**一键启动 / 停止**，不用再逐个打开终端敲命令或翻文件夹找脚本。

## 这是什么

如果你手上有好几个自己做的小项目，每次想用某一个都要：打开终端 → `cd` 到目录 → 敲启动命令，或者翻文件夹找可执行文件——VibeHub 就是来消除这些重复步骤的。

添加项目后，它会自动识别类型并提供一个「启动」按钮，点一下项目就跑起来了。

## 主要功能

- **手动添加项目**：拖拽文件夹或点击选择，防止重复添加同一路径
- **自动类型检测**：自动区分「网页项目」（dev server）和「已打包 App」，无需手动选类型
- **一键启停**：
  - 网页项目自动分配空闲端口，避免冲突
  - App 项目直接启动 / 停止
- **实时日志**：统一的日志面板查看项目的 stdout / stderr
- **项目管理**：编辑名称、描述、图标、标签、手动启动命令；删除（二次确认）
- **标签管理**：创建 / 重命名 / 删除标签
- **搜索与排序**：按名称模糊搜索；按最近打开 / 最常打开 / 名称 A-Z / Z-A 排序
- **依赖自动安装**：检测到 Node 项目缺少依赖时自动安装
- **关闭保护**：退出时若有运行中的项目会二次确认

## 下载安装

前往 [Releases 页面](https://github.com/yichuanyang115-creator/vibehub/releases) 下载最新版本的安装包。

- **macOS（Apple 芯片 / arm64）**：下载 `vibehub-<版本>.dmg`，双击打开后把 VibeHub 拖入「应用程序」文件夹。

> ⚠️ 当前版本未做代码签名与公证，首次打开若被系统拦截，请在 Finder 中**右键点击 VibeHub → 打开**，或到「系统设置 → 隐私与安全性」中点击「仍要打开」。

目前仅提供 macOS Apple 芯片版本，其他平台需自行构建（见下文）。

## 本地开发

需要 [Node.js](https://nodejs.org/) 与 [pnpm](https://pnpm.io/)。

```bash
# 安装依赖
pnpm install

# 启动开发环境（热重载）
pnpm dev

# 代码检查与类型检查
pnpm lint
pnpm typecheck
```

## 构建打包

```bash
# 构建产物
pnpm build

# 打包 macOS 安装包（输出到 dist/）
pnpm build:mac
```

打包完成后，安装包位于 `dist/` 目录（`node_modules`、`dist`、`out` 均已在 `.gitignore` 中排除，不进仓库；安装包通过 Releases 分发）。

## 技术栈

- [Electron](https://www.electronjs.org/) — 桌面应用框架
- [electron-vite](https://electron-vite.org/) — 构建工具链
- [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) — 样式
- [electron-builder](https://www.electron.build/) — 打包与分发

## 项目结构

```
vibehub/
├── src/
│   ├── main/        # Electron 主进程（进程管理、IPC、项目启停）
│   ├── preload/     # 预加载脚本
│   └── renderer/    # React 渲染进程（界面）
├── build/           # 打包资源（图标、entitlements）
├── e2e/             # 端到端测试
├── resources/       # 应用内资源
└── electron-builder.yml
```

## 许可

私有项目，暂未开放许可协议。
