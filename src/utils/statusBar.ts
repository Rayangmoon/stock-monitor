import * as vscode from "vscode";
import { StockMonitor } from "../monitor/stockMonitor";

/**
 * 状态栏管理器
 */
export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private monitor: StockMonitor;

  constructor(monitor: StockMonitor) {
    this.monitor = monitor;
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = "stock-monitor.showStocks";
    this.statusBarItem.show();
  }

  /**
   * 更新状态栏
   */
  update(): void {
    const states = this.monitor.getAllStates();
    const isRunning = this.monitor.isMonitoring();

    if (!isRunning) {
      this.statusBarItem.text = "$(debug-pause) 股票监控已停止";
      this.statusBarItem.tooltip = "点击查看监控列表";
      return;
    }

    if (states.length === 0) {
      this.statusBarItem.text = "$(eye) 股票监控 (0)";
      this.statusBarItem.tooltip = "暂无监控股票，点击添加";
      return;
    }

    // 显示监控数量和简要信息（显示真实涨跌幅）
    const summary = states
      .slice(0, 3)
      .map((state) => {
        const color = state.changePercent >= 0 ? "🔴" : "🟢";
        return `${color}${state.changePercent.toFixed(2)}%`;
      })
      .join(" ");

    this.statusBarItem.text = `$(eye) stock (${states.length}) ${summary}`;

    // 构建详细提示
    const tooltip = states
      .map((state) => {
        const config = this.monitor
          .getConfigs()
          .find((c) => c.code === state.code);
        const name = config?.name || state.code;
        return `${name}: ${state.changePercent.toFixed(
          2
        )}% (回落: ${state.fallbackPercent.toFixed(2)}%)`;
      })
      .join("\n");

    this.statusBarItem.tooltip = `监控中的股票:\n${tooltip}\n\n点击查看详情`;
  }

  /**
   * 销毁
   */
  dispose(): void {
    this.statusBarItem.dispose();
  }
}
