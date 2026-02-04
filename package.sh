#!/bin/bash

# 股票监控插件 - 打包脚本

echo "================================"
echo "股票监控插件 - 打包为 VSIX"
echo "================================"
echo ""

# 检查 vsce 是否安装
if ! command -v vsce &> /dev/null; then
    echo "⚠️  vsce 未安装，正在安装..."
    npm install -g @vscode/vsce
    if [ $? -ne 0 ]; then
        echo "❌ vsce 安装失败"
        exit 1
    fi
    echo "✅ vsce 安装成功"
fi

# 清理旧的编译文件
echo "1. 清理旧文件..."
rm -rf out
echo "✅ 清理完成"
echo ""

# 编译项目
echo "2. 编译项目..."
npm run compile
if [ $? -ne 0 ]; then
    echo "❌ 编译失败"
    exit 1
fi
echo "✅ 编译成功"
echo ""

# 运行 Lint
echo "3. 代码检查..."
npm run lint
if [ $? -ne 0 ]; then
    echo "⚠️  代码检查有警告，但继续打包"
fi
echo "✅ 代码检查完成"
echo ""

# 打包
echo "4. 打包插件..."
vsce package
if [ $? -ne 0 ]; then
    echo "❌ 打包失败"
    exit 1
fi
echo "✅ 打包成功"
echo ""

# 显示生成的文件
echo "================================"
echo "✅ 打包完成！"
echo "================================"
echo ""
echo "生成的文件："
ls -lh *.vsix
echo ""
echo "安装方法："
echo "1. 打开 VSCode"
echo "2. 进入扩展面板（Ctrl+Shift+X 或 Cmd+Shift+X）"
echo "3. 点击右上角 '...' 菜单"
echo "4. 选择 '从 VSIX 安装...'"
echo "5. 选择生成的 .vsix 文件"
echo ""
echo "或者使用命令行安装："
echo "code --install-extension $(ls *.vsix | head -1)"
echo ""
