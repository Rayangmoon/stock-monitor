import * as vscode from 'vscode';
import { StockMonitor } from './monitor/stockMonitor';
import { StatusBarManager } from './utils/statusBar';

let monitor: StockMonitor;
let statusBarManager: StatusBarManager;
let updateTimer: NodeJS.Timeout | null = null;

export function activate(context: vscode.ExtensionContext) {
  console.log('股票监控插件已激活');

  // 初始化监控器
  monitor = new StockMonitor(context);
  statusBarManager = new StatusBarManager(monitor);

  // 注册命令：添加监控股票
  const addStockCommand = vscode.commands.registerCommand(
    'stock-monitor.addStock',
    async () => {
      const code = await vscode.window.showInputBox({
        prompt: '请输入股票代码（如：600000、000001）',
        placeHolder: '股票代码',
        validateInput: (value) => {
          if (!value || !/^\d{6}$/.test(value)) {
            return '请输入6位数字的股票代码';
          }
          return null;
        }
      });

      if (!code) {
        return;
      }

      // 显示加载提示
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `正在获取股票 ${code} 的信息...`,
        cancellable: false
      }, async () => {
        // 先获取股票信息以获取名称
        const stockInfo = await monitor.fetchStockInfo(code);

        if (!stockInfo) {
          vscode.window.showErrorMessage(`无法获取股票 ${code} 的数据，请检查代码是否正确`);
          return;
        }


        // 询问回落阈值
        const thresholdStr = await vscode.window.showInputBox({
          prompt: `请输入 ${stockInfo.name} (${code}) 的回落提醒阈值（%）`,
          placeHolder: '默认为2%',
          validateInput: (value) => {
            if (value && (isNaN(Number(value)) || Number(value) <= 0)) {
              return '请输入大于0的数字';
            }
            return null;
          }
        });

        const threshold = thresholdStr ? Number(thresholdStr) : undefined;

        const success = await monitor.addStock(code, stockInfo.name, threshold);
        if (success) {
          vscode.window.showInformationMessage(`已添加监控: ${stockInfo.name} (${code})`);
          statusBarManager.update();

          // 如果监控未启动，询问是否启动
          if (!monitor.isMonitoring()) {
            const start = await vscode.window.showInformationMessage(
              '监控已停止，是否立即启动？',
              '启动',
              '稍后'
            );
            if (start === '启动') {
              vscode.commands.executeCommand('stock-monitor.toggleMonitor');
            }
          }
        } else {
          vscode.window.showErrorMessage(`添加失败: 无法获取股票 ${code} 的数据`);
        }
      });
    }
  );

  // 注册命令：移除监控股票
  const removeStockCommand = vscode.commands.registerCommand(
    'stock-monitor.removeStock',
    async () => {
      const configs = monitor.getConfigs();
      if (configs.length === 0) {
        vscode.window.showInformationMessage('暂无监控股票');
        return;
      }

      const items = configs.map(config => ({
        label: `${config.name} (${config.code})`,
        description: `回落阈值: ${config.fallbackThreshold}%`,
        code: config.code
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: '选择要移除的股票'
      });

      if (selected) {
        await monitor.removeStock(selected.code);
        vscode.window.showInformationMessage(`已移除监控: ${selected.label}`);
        statusBarManager.update();
      }
    }
  );

  // 注册命令：查看监控列表
  const showStocksCommand = vscode.commands.registerCommand(
    'stock-monitor.showStocks',
    async () => {
      const configs = monitor.getConfigs();
      if (configs.length === 0) {
        vscode.window.showInformationMessage('暂无监控股票，请先添加');
        return;
      }

      const states = monitor.getAllStates();
      const items = configs.map((config, index) => {
        const state = states.find(s => s.code === config.code);
        const status = state
          ? `当前: ${state.changePercent.toFixed(2)}% | 最高: ${state.maxRisePercent.toFixed(2)}% | 回落: ${state.fallbackPercent.toFixed(2)}%`
          : '暂无数据';
        const alertEnabled = monitor.isAlertEnabled(config.code);

        return {
          label: `${config.name} (${config.code})`,
          description: status,
          detail: `回落阈值: ${config.fallbackThreshold}% | ${config.enabled ? '✓ 已启用' : '✗ 已禁用'} | 提醒: ${alertEnabled ? '开' : '关'}`,
          code: config.code,
          buttons: [
            {
              iconPath: new vscode.ThemeIcon(alertEnabled ? 'bell' : 'bell-slash'),
              tooltip: alertEnabled ? '关闭提醒' : '开启提醒'
            },
            {
              iconPath: new vscode.ThemeIcon('pin'),
              tooltip: index === 0 ? '已置顶' : '置顶此股票'
            },
            {
              iconPath: new vscode.ThemeIcon('trash'),
              tooltip: '删除此股票'
            }
          ]
        };
      });

      const quickPick = vscode.window.createQuickPick();
      quickPick.items = items;
      quickPick.placeholder = '监控列表 - 点击查看详情';
      quickPick.canSelectMany = false;

      // 处理选择事件（查看详情）
      quickPick.onDidAccept(() => {
        const selected = quickPick.selectedItems[0];
        if (selected) {
          showStockDetail((selected as any).code);
        }
        quickPick.hide();
      });

      // 处理按钮点击事件（提醒开关、置顶和删除）
      quickPick.onDidTriggerItemButton(async (e) => {
        const item = e.item as any;
        const buttonIndex = (e.item as any).buttons.indexOf(e.button);

        // 辅助函数：刷新列表
        const refreshList = () => {
          const newConfigs = monitor.getConfigs();
          const newStates = monitor.getAllStates();
          const newItems = newConfigs.map((config, index) => {
            const state = newStates.find(s => s.code === config.code);
            const status = state
              ? `当前: ${state.changePercent.toFixed(2)}% | 最高: ${state.maxRisePercent.toFixed(2)}% | 回落: ${state.fallbackPercent.toFixed(2)}%`
              : '暂无数据';
            const alertEnabled = monitor.isAlertEnabled(config.code);

            return {
              label: `${config.name} (${config.code})`,
              description: status,
              detail: `回落阈值: ${config.fallbackThreshold}% | ${config.enabled ? '✓ 已启用' : '✗ 已禁用'} | 提醒: ${alertEnabled ? '开' : '关'}`,
              code: config.code,
              buttons: [
                {
                  iconPath: new vscode.ThemeIcon(alertEnabled ? 'bell' : 'bell-slash'),
                  tooltip: alertEnabled ? '关闭提醒' : '开启提醒'
                },
                {
                  iconPath: new vscode.ThemeIcon('pin'),
                  tooltip: index === 0 ? '已置顶' : '置顶此股票'
                },
                {
                  iconPath: new vscode.ThemeIcon('trash'),
                  tooltip: '删除此股票'
                }
              ]
            };
          });
          return newItems;
        };

        // 第一个按钮：提醒开关
        if (buttonIndex === 0) {
          const newState = monitor.toggleAlert(item.code);
          vscode.window.showInformationMessage(
            `${item.label} 提醒已${newState ? '开启' : '关闭'}`
          );
          quickPick.items = refreshList();
        }
        // 第二个按钮：置顶
        else if (buttonIndex === 1) {
          await monitor.pinStock(item.code);
          vscode.window.showInformationMessage(`已置顶: ${item.label}`);
          statusBarManager.update();
          quickPick.items = refreshList();
        }
        // 第三个按钮：删除
        else if (buttonIndex === 2) {
          const result = await vscode.window.showWarningMessage(
            `确定要删除 ${item.label} 吗？`,
            '确定',
            '取消'
          );

          if (result === '确定') {
            await monitor.removeStock(item.code);
            vscode.window.showInformationMessage(`已删除: ${item.label}`);
            statusBarManager.update();

            const newConfigs = monitor.getConfigs();
            if (newConfigs.length === 0) {
              quickPick.hide();
              vscode.window.showInformationMessage('已删除所有监控股票');
            } else {
              quickPick.items = refreshList();
            }
          }
        }
      });

      quickPick.show();
    }
  );

  // 注册命令：启动/停止监控
  const toggleMonitorCommand = vscode.commands.registerCommand(
    'stock-monitor.toggleMonitor',
    () => {
      if (monitor.isMonitoring()) {
        monitor.stop();
        if (updateTimer) {
          clearInterval(updateTimer);
          updateTimer = null;
        }
        vscode.window.showInformationMessage('股票监控已停止');
      } else {
        monitor.start();
        // 启动状态栏更新定时器
        updateTimer = setInterval(() => {
          statusBarManager.update();
        }, 1000);
        vscode.window.showInformationMessage('股票监控已启动');
      }
      statusBarManager.update();
    }
  );

  // 监听配置变化
  const configChangeListener = vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('stockMonitor')) {
      // 重启监控以应用新配置
      if (monitor.isMonitoring()) {
        monitor.stop();
        monitor.start();
      }
    }
  });

  // 注册所有命令和监听器
  context.subscriptions.push(
    addStockCommand,
    removeStockCommand,
    showStocksCommand,
    toggleMonitorCommand,
    configChangeListener,
    statusBarManager
  );

  // 自动启动监控
  const configs = monitor.getConfigs();
  if (configs.length > 0) {
    monitor.start();
    updateTimer = setInterval(() => {
      statusBarManager.update();
    }, 1000);
  }

  statusBarManager.update();
}

/**
 * 显示股票详情
 */
function showStockDetail(code: string): void {
  const configs = monitor.getConfigs();
  const config = configs.find(c => c.code === code);
  const state = monitor.getState(code);

  if (!config) {
    return;
  }

  let detail = `股票代码: ${code}\n`;
  detail += `股票名称: ${config.name}\n`;
  detail += `回落阈值: ${config.fallbackThreshold}%\n`;
  detail += `状态: ${config.enabled ? '已启用' : '已禁用'}\n`;

  if (state) {
    detail += `\n实时数据:\n`;
    detail += `开盘价: ${state.openPrice.toFixed(2)}\n`;
    detail += `最高价: ${state.highestPrice.toFixed(2)}\n`;
    detail += `当前价: ${state.currentPrice.toFixed(2)}\n`;
    detail += `最高涨幅: ${state.maxRisePercent.toFixed(2)}%\n`;
    detail += `当前涨幅: ${state.changePercent.toFixed(2)}%\n`;
    detail += `回落幅度: ${state.fallbackPercent.toFixed(2)}%\n`;
  } else {
    detail += `\n暂无实时数据`;
  }

  vscode.window.showInformationMessage(detail);
}

export function deactivate() {
  if (monitor) {
    monitor.stop();
  }
  if (updateTimer) {
    clearInterval(updateTimer);
  }
  console.log('股票监控插件已停用');
}
