/**
 * 股票数据接口
 */
export interface StockData {
  code: string;           // 股票代码
  name: string;           // 股票名称
  currentPrice: number;   // 当前价格
  openPrice: number;      // 开盘价
  closePrice: number;     // 昨收价
  highPrice: number;      // 最高价
  lowPrice: number;       // 最低价
  changePercent: number;  // 涨跌幅（相对昨收价）
  volume: number;         // 成交量
  timestamp: number;      // 时间戳
}

/**
 * 监控配置接口
 */
export interface MonitorConfig {
  code: string;              // 股票代码
  name: string;              // 股票名称
  fallbackThreshold: number; // 回落阈值（%）
  enabled: boolean;          // 是否启用
}

/**
 * 监控状态接口
 */
export interface MonitorState {
  code: string;
  openPrice: number;        // 开盘价
  highestPrice: number;     // 最高价（相对开盘价）
  currentPrice: number;     // 当前价
  changePercent: number;    // 真实涨跌幅（相对昨收价，%）
  maxRisePercent: number;   // 最高涨幅（相对开盘价，%）
  currentRisePercent: number; // 当前涨幅（相对开盘价，%）
  fallbackPercent: number;  // 回落幅度（%）
  lastAlertTime?: number;   // 上次提醒时间
  mutedUntil?: number;      // 静音到期时间（今日不再提醒）
  alertEnabled: boolean;    // 是否开启提醒
}
