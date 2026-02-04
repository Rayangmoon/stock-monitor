# 项目总结

## 项目信息

- **项目名称**：股票监控助手（Stock Monitor）
- **版本**：0.0.1
- **类型**：VSCode 扩展插件
- **开发语言**：TypeScript
- **目标平台**：VSCode 1.75.0+

## 核心功能

### 1. 股票行情监控
- 支持 A 股实时行情监控
- 支持新浪财经和雪球两种数据源
- 可配置刷新间隔（默认 3 秒）

### 2. 最高涨幅计算
- 基于开盘价计算涨幅
- 实时跟踪最高价格
- 计算公式：`(当前价 - 开盘价) / 开盘价 × 100%`

### 3. 回落提醒
- 检测从最高点的回落幅度
- 可配置回落阈值（默认 2%）
- 防止频繁提醒（5分钟内只提醒一次）
- 计算公式：`最高涨幅 - 当前涨幅`

### 4. 用户界面
- 状态栏实时显示监控信息
- 弹窗提醒回落警告
- 命令面板操作
- 快速查看详情

## 项目结构

```
stock/
├── .vscode/                    # VSCode 配置
│   ├── launch.json            # 调试配置
│   ├── tasks.json             # 任务配置
│   └── settings.example.json  # 配置示例
├── src/                        # 源代码
│   ├── api/                   # API 模块
│   │   └── stockApi.ts        # 股票数据接口
│   ├── monitor/               # 监控模块
│   │   └── stockMonitor.ts    # 监控核心逻辑
│   ├── utils/                 # 工具模块
│   │   └── statusBar.ts       # 状态栏管理
│   ├── types.ts               # 类型定义
│   └── extension.ts           # 插件入口
├── out/                        # 编译输出（自动生成）
├── node_modules/              # 依赖包（自动生成）
├── .eslintrc.json             # ESLint 配置
├── .gitignore                 # Git 忽略文件
├── tsconfig.json              # TypeScript 配置
├── package.json               # 项目配置
├── package-lock.json          # 依赖锁定
├── README.md                  # 项目说明
├── QUICKSTART.md              # 快速开始
├── CHANGELOG.md               # 更新日志
├── LICENSE                    # 许可证
└── PROJECT_SUMMARY.md         # 项目总结（本文件）
```

## 技术架构

### 数据流

```
用户操作 → VSCode 命令
    ↓
StockMonitor（监控管理器）
    ↓
StockAPI（数据接口）→ 新浪/雪球 API
    ↓
数据处理 → 状态更新
    ↓
StatusBarManager（状态栏）
    ↓
用户界面显示/提醒
```

### 核心类

#### 1. StockAPI（抽象基类）
- `SinaAPI`：新浪财经接口实现
- `XueqiuAPI`：雪球接口实现
- `StockAPIFactory`：API 工厂

#### 2. StockMonitor
- 监控配置管理
- 状态跟踪
- 回落检测
- 提醒触发

#### 3. StatusBarManager
- 状态栏显示
- 实时更新
- 用户交互

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `stockMonitor.refreshInterval` | number | 3000 | 刷新间隔（毫秒） |
| `stockMonitor.fallbackThreshold` | number | 2 | 回落阈值（%） |
| `stockMonitor.apiSource` | string | "sina" | 数据源（sina/xueqiu） |

## 命令列表

| 命令 ID | 显示名称 | 功能 |
|---------|----------|------|
| `stock-monitor.addStock` | 添加监控股票 | 添加新的监控股票 |
| `stock-monitor.removeStock` | 移除监控股票 | 从列表中移除股票 |
| `stock-monitor.showStocks` | 查看监控列表 | 查看所有监控详情 |
| `stock-monitor.toggleMonitor` | 启动/停止监控 | 切换监控状态 |

## 数据接口

### 新浪财经 API

**接口地址**：`https://hq.sinajs.cn/list={code}`

**股票代码格式**：
- 上海：`sh` + 6位代码（如：sh600000）
- 深圳：`sz` + 6位代码（如：sz000001）

**返回格式**：
```
var hq_str_sh600000="浦发银行,9.50,9.48,9.52,9.54,9.47,9.51,9.52,..."
```

**数据字段**：
- [0] 股票名称
- [1] 今日开盘价
- [3] 当前价格
- [4] 今日最高价
- [5] 今日最低价
- [8] 成交量

### 雪球 API

**接口地址**：`https://stock.xueqiu.com/v5/stock/quote.json`

**参数**：
- `symbol`：股票代码（如：SH600000）
- `extend`：扩展信息（detail）

**认证**：需要 Cookie

## 算法说明

### 最高涨幅计算

```typescript
// 当前涨幅
currentRisePercent = (currentPrice - openPrice) / openPrice * 100

// 更新最高涨幅
if (currentPrice > highestPrice) {
  highestPrice = currentPrice
  maxRisePercent = currentRisePercent
}
```

### 回落检测

```typescript
// 计算回落幅度
fallbackPercent = maxRisePercent - currentRisePercent

// 检查是否触发提醒
if (fallbackPercent >= threshold && maxRisePercent > 0) {
  // 发送提醒
  sendAlert()
}
```

### 防止频繁提醒

```typescript
const ALERT_INTERVAL = 5 * 60 * 1000; // 5分钟

if (lastAlertTime && (now - lastAlertTime) < ALERT_INTERVAL) {
  return false; // 不提醒
}
```

## 使用场景

### 场景 1：日内交易监控
用户在开盘后添加关注的股票，设置 2% 的回落阈值。当股票涨到 5% 后回落到 3%，触发提醒，用户可以考虑止盈。

### 场景 2：多股票监控
用户同时监控 5 只股票，状态栏显示每只股票的实时涨跌情况，点击可查看详情。

### 场景 3：自定义阈值
对于波动较大的股票，用户可以设置更高的回落阈值（如 5%），避免频繁提醒。

## 开发指南

### 环境要求
- Node.js 16+
- VSCode 1.75.0+
- TypeScript 4.9+

### 开发流程

1. **安装依赖**
```bash
npm install
```

2. **开发模式**
```bash
npm run watch
```

3. **调试运行**
按 F5 启动调试

4. **编译**
```bash
npm run compile
```

5. **打包**
```bash
npm run vscode:prepublish
```

### 代码规范
- 使用 ESLint 进行代码检查
- 遵循 TypeScript 严格模式
- 使用 JSDoc 注释

## 测试建议

### 单元测试
- API 接口测试
- 涨幅计算测试
- 回落检测测试

### 集成测试
- 完整监控流程测试
- 多股票并发测试
- 异常情况处理测试

### 手动测试
1. 添加股票测试
2. 数据刷新测试
3. 提醒触发测试
4. 配置变更测试

## 已知限制

1. **数据延迟**：第三方接口可能有延迟
2. **API 限制**：频繁请求可能被限流
3. **Cookie 过期**：雪球接口需要定期更新 Cookie
4. **交易时间**：非交易时间数据不更新

## 未来规划

### 短期（v0.1.0）
- [ ] 添加单元测试
- [ ] 优化错误处理
- [ ] 添加日志系统
- [ ] 支持股票搜索

### 中期（v0.2.0）
- [ ] 添加历史数据图表
- [ ] 支持自定义提醒声音
- [ ] 添加涨停/跌停提醒
- [ ] 支持分组管理

### 长期（v1.0.0）
- [ ] 支持港股、美股
- [ ] 添加技术指标分析
- [ ] 支持移动端推送
- [ ] 添加策略回测功能

## 贡献指南

欢迎提交 Issue 和 Pull Request！

### 提交 Issue
- 描述问题或建议
- 提供复现步骤
- 附上截图或日志

### 提交 PR
- Fork 项目
- 创建特性分支
- 提交代码
- 发起 Pull Request

## 许可证

MIT License - 详见 LICENSE 文件

## 联系方式

- 项目地址：/Users/lei_yang/Desktop/self/stock
- 问题反馈：通过 Issue 提交

## 致谢

感谢以下开源项目和服务：
- VSCode Extension API
- 新浪财经
- 雪球
- TypeScript
- Axios

---

**最后更新**：2026-02-04
**文档版本**：1.0
