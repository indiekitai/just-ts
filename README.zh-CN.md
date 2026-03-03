[English](README.md) | [中文](README.zh-CN.md)

# @indiekit/just

TypeScript/Node.js 命令运行器 — [casey/just](https://github.com/casey/just) 的 TypeScript 移植版。

## 特性

- **解析 justfile 语法** — recipe、变量、注释、字符串字面量
- **执行 recipe**，支持参数和依赖
- **变量赋值**和插值
- **`@` 前缀**静默执行
- **`set shell`** 设置支持
- **`--list`** 查看可用 recipe
- **`--dry-run`** 预览命令
- **MCP Server** — 将 justfile recipe 暴露给 AI agent
- **错误信息**带行号

## 安装

```bash
npm install @indiekit/just
```

## CLI 用法

```bash
# 运行默认 recipe（第一个）
just-run

# 运行指定 recipe
just-run build

# 带参数运行
just-run deploy production

# 列出所有 recipe
just-run --list

# 预演模式
just-run --dry-run build
```

## Justfile 示例

```justfile
# Build the project
build:
    npm run build

# Deploy to environment
deploy env:
    echo "Deploying to {{env}}"
    ./scripts/deploy.sh {{env}}

# Run tests (depends on build)
test: build
    npm test
```

## MCP Server

将 justfile recipe 作为 AI agent 工具暴露：

```bash
just-run-mcp
```

添加到你的 MCP 客户端配置（Claude Desktop、Cursor 等）：

```json
{
  "mcpServers": {
    "just": {
      "command": "just-run-mcp"
    }
  }
}
```

### MCP 工具

| 工具 | 说明 |
|------|------|
| `list_recipes` | 列出 justfile 中的所有 recipe |
| `run_recipe` | 执行一个 recipe |
| `parse_justfile` | 解析并返回 justfile AST |

## 编程式 API

```typescript
import { parseJustfile, execute } from '@indiekit/just';

const justfile = parseJustfile('justfile');
await execute(justfile, 'build');
```

## License

MIT
