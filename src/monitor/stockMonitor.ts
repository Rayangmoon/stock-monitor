import * as vscode from "vscode";
import { StockAPI, StockAPIFactory } from "../api/stockApi";
import { MonitorConfig, MonitorState, StockData } from "../types";

/**
 * 股票监控管理器
 */
export class StockMonitor {
  private api: StockAPI;
  private configs: Map<string, MonitorConfig> = new Map();
  private states: Map<string, MonitorState> = new Map();
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private refreshInterval: number = 3000;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.api = this.createAPI();
    this.loadConfigs();
    this.loadRefreshInterval();
  }

  /**
   * 创建 API 实例
   */
  private createAPI(): StockAPI {
    const config = vscode.workspace.getConfiguration("stockMonitor");
    const source = config.get<"sina" | "xueqiu">("apiSource", "sina");
    return StockAPIFactory.create(source);
  }

  /**
   * 加载刷新间隔
   */
  private loadRefreshInterval(): void {
    const config = vscode.workspace.getConfiguration("stockMonitor");
    this.refreshInterval = config.get<number>("refreshInterval", 3000);
  }

  /**
   * 加载配置
   */
  private loadConfigs(): void {
    const saved = this.context.globalState.get<MonitorConfig[]>(
      "monitorConfigs",
      []
    );
    this.configs.clear();
    saved.forEach((config) => {
      this.configs.set(config.code, config);
    });
  }

  /**
   * 保存配置
   */
  private async saveConfigs(): Promise<void> {
    const configs = Array.from(this.configs.values());
    await this.context.globalState.update("monitorConfigs", configs);
  }

  /**
   * 添加监控股票
   */
  async addStock(
    code: string,
    name: string,
    fallbackThreshold?: number
  ): Promise<boolean> {
    const config = vscode.workspace.getConfiguration("stockMonitor");
    const defaultThreshold = config.get<number>("fallbackThreshold", 2);

    const monitorConfig: MonitorConfig = {
      code,
      name,
      fallbackThreshold: fallbackThreshold || defaultThreshold,
      enabled: true,
    };

    this.configs.set(code, monitorConfig);
    await this.saveConfigs();

    // 初始化状态
    const stockData = await this.api.fetchStockData(code);
    if (stockData) {
      this.initState(stockData);
      return true;
    }

    return false;
  }

  /**
   * 移除监控股票
   */
  async removeStock(code: string): Promise<void> {
    this.configs.delete(code);
    this.states.delete(code);
    await this.saveConfigs();
  }

  /**
   * 获取所有监控配置
   */
  getConfigs(): MonitorConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * 获取监控状态
   */
  getState(code: string): MonitorState | undefined {
    return this.states.get(code);
  }

  /**
   * 获取所有监控状态
   */
  getAllStates(): MonitorState[] {
    return Array.from(this.states.values());
  }

  /**
   * 初始化状态
   */
  private initState(stockData: StockData): void {
    const state: MonitorState = {
      code: stockData.code,
      openPrice: stockData.openPrice,
      highestPrice: stockData.openPrice,
      currentPrice: stockData.currentPrice,
      changePercent: stockData.changePercent, // 真实涨跌幅
      maxRisePercent: 0,
      currentRisePercent: this.calculateRisePercent(
        stockData.currentPrice,
        stockData.openPrice
      ),
      fallbackPercent: 0,
    };

    this.states.set(stockData.code, state);
  }

  /**
   * 更新状态
   */
  private updateState(stockData: StockData): void {
    let state = this.states.get(stockData.code);

    if (!state) {
      this.initState(stockData);
      state = this.states.get(stockData.code)!;
    }

    // 更新当前价格和真实涨跌幅
    state.currentPrice = stockData.currentPrice;
    state.changePercent = stockData.changePercent; // 更新真实涨跌幅

    // 计算当前涨幅（相对开盘价）
    state.currentRisePercent = this.calculateRisePercent(
      stockData.currentPrice,
      state.openPrice
    );

    // 更新最高价格（相对开盘价的最高点）
    if (stockData.currentPrice > state.highestPrice) {
      state.highestPrice = stockData.currentPrice;
      state.maxRisePercent = state.currentRisePercent;
    }

    // 计算回落幅度（从最高点回落的百分比）
    if (state.maxRisePercent > 0) {
      state.fallbackPercent = state.maxRisePercent - state.currentRisePercent;
    } else {
      state.fallbackPercent = 0;
    }
  }

  /**
   * 计算涨幅百分比
   */
  private calculateRisePercent(
    currentPrice: number,
    openPrice: number
  ): number {
    if (openPrice === 0) {
      return 0;
    }
    return ((currentPrice - openPrice) / openPrice) * 100;
  }

  /**
   * 检查是否需要提醒
   */
  private shouldAlert(code: string): boolean {
    const config = this.configs.get(code);
    const state = this.states.get(code);

    if (!config || !state || !config.enabled) {
      return false;
    }

    // 只有在有涨幅的情况下才检查回落
    if (state.maxRisePercent <= 0) {
      return false;
    }

    // 检查回落是否超过阈值
    if (state.fallbackPercent >= config.fallbackThreshold) {
      // 防止频繁提醒（5分钟内只提醒一次）
      const now = Date.now();
      if (state.lastAlertTime && now - state.lastAlertTime < 5 * 60 * 1000) {
        return false;
      }

      state.lastAlertTime = now;
      return true;
    }

    return false;
  }

  /**
   * 启动监控
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.loadRefreshInterval();
    this.api = this.createAPI();

    this.timer = setInterval(() => {
      this.tick();
    }, this.refreshInterval);

    // 立即执行一次
    this.tick();
  }

  /**
   * 停止监控
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }

  /**
   * 是否正在运行
   */
  isMonitoring(): boolean {
    return this.isRunning;
  }

  /**
   * 监控周期
   */
  private async tick(): Promise<void> {
    const codes = Array.from(this.configs.keys());

    for (const code of codes) {
      const config = this.configs.get(code);
      if (!config || !config.enabled) {
        continue;
      }

      try {
        const stockData = await this.api.fetchStockData(code);
        if (stockData) {
          this.updateState(stockData);

          // 检查是否需要提醒
          if (this.shouldAlert(code)) {
            this.sendAlert(code);
          }
        }
      } catch (error) {
        console.error(`监控股票 ${code} 失败:`, error);
      }
    }
  }

  /**
   * 发送提醒
   */
  private sendAlert(code: string): void {
    const config = this.configs.get(code);
    const state = this.states.get(code);

    if (!config || !state) {
      return;
    }

    const message =
      `【${config.name}】回落提醒\n` +
      `最高涨幅: ${state.maxRisePercent.toFixed(2)}%\n` +
      `当前涨幅: ${state.currentRisePercent.toFixed(2)}%\n` +
      `回落幅度: ${state.fallbackPercent.toFixed(2)}%\n` +
      `当前价格: ${state.currentPrice.toFixed(2)}`;

    vscode.window.showWarningMessage(message, "查看详情").then((selection) => {
      if (selection === "查看详情") {
        this.showStockDetail(code);
      }
    });
  }

  /**
   * 显示股票详情
   */
  private showStockDetail(code: string): void {
    const config = this.configs.get(code);
    const state = this.states.get(code);

    if (!config || !state) {
      return;
    }

    const detail =
      `股票代码: ${code}\n` +
      `股票名称: ${config.name}\n` +
      `开盘价: ${state.openPrice.toFixed(2)}\n` +
      `最高价: ${state.highestPrice.toFixed(2)}\n` +
      `当前价: ${state.currentPrice.toFixed(2)}\n` +
      `最高涨幅: ${state.maxRisePercent.toFixed(2)}%\n` +
      `当前涨幅: ${state.currentRisePercent.toFixed(2)}%\n` +
      `回落幅度: ${state.fallbackPercent.toFixed(2)}%\n` +
      `回落阈值: ${config.fallbackThreshold.toFixed(2)}%`;

    vscode.window.showInformationMessage(detail);
  }
}
