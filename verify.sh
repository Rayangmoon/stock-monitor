#!/bin/bash

# 股票监控插件 - 项目验证脚本

echo "================================"
echo "股票监控插件 - 项目验证"
echo "================================"
echo ""

# 检查 Node.js
echo "1. 检查 Node.js 版本..."
node --version
if [ $? -ne 0 ]; then
  echo "❌ Node.js 未安装"
  exit 1
fi
echo "✅ Node.js 已安装"
echo ""

# 检查依赖
echo "2. 检查依赖..."
if [ ! -d "node_modules" ]; then
  echo "⚠️  依赖未安装，正在安装..."
  npm install
else
  echo "✅ 依赖已安装"
fi
echo ""

# 编译项目
echo "3. 编译项目..."
npm run compile
if [ $? -ne 0 ]; then
  echo "❌ 编译失败"
  exit 1
fi
echo "✅ 编译成功"
echo ""

# 运行 Lint
echo "4. 运行代码检查..."
npm run lint
if [ $? -ne 0 ]; then
  echo "❌ 代码检查失败"
  exit 1
fi
echo "✅ 代码检查通过"
echo ""

# 检查输出文件
echo "5. 检查输出文件..."
if [ -f "out/extension.js" ]; then
  echo "✅ extension.js 已生成"
else
  echo "❌ extension.js 未生成"
  exit 1
fi

if [ -f "out/api/stockApi.js" ]; then
  echo "✅ stockApi.js 已生成"
else
  echo "❌ stockApi.js 未生成"
  exit 1
fi

if [ -f "out/monitor/stockMonitor.js" ]; then
  echo "✅ stockMonitor.js 已生成"
else
  echo "❌ stockMonitor.js 未生成"
  exit 1
fi

if [ -f "out/utils/statusBar.js" ]; then
  echo "✅ statusBar.js 已生成"
else
  echo "❌ statusBar.js 未生成"
  exit 1
fi
echo ""

# 项目结构检查
echo "6. 检查项目结构..."
required_files=(
  "package.json"
  "tsconfig.json"
  "README.md"
  "QUICKSTART.md"
  "CHANGELOG.md"
  "LICENSE"
  "src/extension.ts"
  "src/types.ts"
  "src/api/stockApi.ts"
  "src/monitor/stockMonitor.ts"
  "src/utils/statusBar.ts"
)

all_exist=true
for file in "${required_files[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file"
  else
    echo "❌ $file 不存在"
    all_exist=false
  fi
done

if [ "$all_exist" = false ]; then
  exit 1
fi
echo ""

# 总结
echo "================================"
echo "✅ 项目验证完成！"
echo "================================"
echo ""
echo "下一步："
echo "1. 在 VSCode 中打开项目"
echo "2. 按 F5 启动调试"
echo "3. 在新窗口中测试插件功能"
echo ""
echo "快速命令："
echo "  npm run watch    - 监听文件变化自动编译"
echo "  npm run compile  - 编译项目"
echo "  npm run lint     - 代码检查"
echo ""
