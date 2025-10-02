# 建议命令

## 开发命令

### 启动开发服务器
```bash
pnpm dev
# 或
npm run dev
```
- 生成 manifest 文件
- 启动 Next.js 开发服务器（监听 0.0.0.0）
- 默认端口：3000
- 支持热重载

### 构建生产版本
```bash
pnpm build
# 或
npm run build
```
- 生成 manifest 文件
- 构建优化的生产版本

### 启动生产服务器
```bash
pnpm start
# 或
npm run start
```
- 需要先运行 `pnpm build`
- 启动 Next.js 生产服务器

## 代码质量命令

### 代码检查
```bash
# 基础检查
pnpm lint

# 自动修复 + 格式化
pnpm lint:fix

# 严格模式（不允许警告）
pnpm lint:strict
```

### 类型检查
```bash
pnpm typecheck
```
- 运行 TypeScript 编译器检查类型错误
- 不生成输出文件

### 代码格式化
```bash
# 格式化所有文件
pnpm format

# 检查格式（不修改）
pnpm format:check
```

## 测试命令

### 运行测试
```bash
# 运行所有测试
pnpm test

# 监听模式
pnpm test:watch
```

## 工具命令

### 生成 Manifest
```bash
pnpm gen:manifest
```
- 生成 PWA manifest 文件
- 构建和开发时自动运行

### Git Hooks 安装
```bash
pnpm prepare
```
- 安装 Husky Git hooks
- 首次克隆仓库后自动运行

## 任务完成后应执行的命令

### 标准流程
完成一个功能或修复后，按顺序执行：

1. **类型检查**
```bash
pnpm typecheck
```

2. **代码检查和格式化**
```bash
pnpm lint:fix
```

3. **运行测试**（如果有相关测试）
```bash
pnpm test
```

4. **提交代码**
```bash
git add .
git commit -m "feat(scope): 描述"
# Git hooks 会自动运行 lint-staged
```

### Git 提交前自动检查
项目配置了 lint-staged，提交时会自动：
- 对 JS/TS 文件运行 ESLint 和 Prettier
- 对 JSON/CSS/MD 文件运行 Prettier

### 最佳实践
- 开发时保持 `pnpm dev` 运行，观察编译错误
- 提交前运行 `pnpm typecheck` 确保类型正确
- 使用 `pnpm lint:strict` 确保代码质量
- 遵循 Conventional Commits 规范编写提交信息

## Docker 相关命令

### 构建镜像
```bash
docker build -t lunatv .
```

### 运行容器
```bash
docker-compose up -d
```

### 查看日志
```bash
docker-compose logs -f moontv-core
```

### 停止容器
```bash
docker-compose down
```

## macOS 系统工具命令

### 文件操作
- `ls` - 列出文件
- `cd` - 切换目录
- `pwd` - 显示当前目录
- `cat` - 查看文件内容
- `grep` - 搜索文本

### Git 操作
- `git status` - 查看状态
- `git add .` - 添加所有更改
- `git commit -m "message"` - 提交
- `git push` - 推送到远程
- `git pull` - 拉取远程更改
- `git log` - 查看提交历史
- `git diff` - 查看差异

### 包管理
- `pnpm install` - 安装依赖
- `pnpm add <package>` - 添加依赖
- `pnpm remove <package>` - 移除依赖

## 环境变量

开发时需要创建 `.env` 文件，包含：
```bash
USERNAME=admin
PASSWORD=admin_password
NEXT_PUBLIC_STORAGE_TYPE=redis
REDIS_URL=redis://localhost:6379
# 或使用其他存储方式
```

详见 README.md 中的环境变量说明。
