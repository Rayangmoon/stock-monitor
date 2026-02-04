import axios from 'axios';
import * as iconv from 'iconv-lite';
import { StockData } from '../types';

/**
 * 股票 API 基类
 */
export abstract class StockAPI {
  abstract fetchStockData(code: string): Promise<StockData | null>;
}

/**
 * 新浪财经 API
 */
export class SinaAPI extends StockAPI {
  private readonly baseUrl = 'https://hq.sinajs.cn/list=';

  /**
   * 获取股票数据
   * @param code 股票代码（如：sh600000 或 sz000001）
   */
  async fetchStockData(code: string): Promise<StockData | null> {
    try {
      const fullCode = this.formatStockCode(code);
      const response = await axios.get(`${this.baseUrl}${fullCode}`, {
        timeout: 5000,
        responseType: 'arraybuffer', // 获取原始二进制数据
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'Referer': 'https://finance.sina.com.cn'
        }
      });

      // 将 GBK 编码转换为 UTF-8
      const data = iconv.decode(Buffer.from(response.data), 'gbk');
      return this.parseResponse(code, data);
    } catch (error) {
      console.error(`新浪API获取股票数据失败 [${code}]:`, error);
      return null;
    }
  }

  /**
   * 格式化股票代码
   * 6开头 -> sh (上海)
   * 0/3开头 -> sz (深圳)
   */
  private formatStockCode(code: string): string {
    const cleanCode = code.replace(/[^0-9]/g, '');
    if (cleanCode.startsWith('6')) {
      return `sh${cleanCode}`;
    } else if (cleanCode.startsWith('0') || cleanCode.startsWith('3')) {
      return `sz${cleanCode}`;
    }
    return cleanCode;
  }

  /**
   * 解析新浪返回数据
   * 格式: var hq_str_sh600000="浦发银行,9.50,9.48,9.52,9.54,9.47,9.51,9.52,..."
   * 数据字段说明：
   * [0] 股票名称
   * [1] 今日开盘价
   * [2] 昨日收盘价
   * [3] 当前价格
   * [4] 今日最高价
   * [5] 今日最低价
   * [8] 成交量
   */
  private parseResponse(code: string, data: string): StockData | null {
    try {
      const match = data.match(/="([^"]+)"/);
      if (!match) {
        return null;
      }

      const parts = match[1].split(',');
      if (parts.length < 32) {
        return null;
      }

      const name = parts[0];
      const openPrice = parseFloat(parts[1]);
      const closePrice = parseFloat(parts[2]); // 昨收价
      const currentPrice = parseFloat(parts[3]);
      const highPrice = parseFloat(parts[4]);
      const lowPrice = parseFloat(parts[5]);
      const volume = parseFloat(parts[8]);

      // 计算涨跌幅（相对昨收价）
      const changePercent = closePrice > 0
        ? ((currentPrice - closePrice) / closePrice) * 100
        : 0;

      return {
        code,
        name,
        currentPrice,
        openPrice,
        closePrice,
        highPrice,
        lowPrice,
        changePercent,
        volume,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('解析新浪数据失败:', error);
      return null;
    }
  }
}

/**
 * 雪球 API
 */
export class XueqiuAPI extends StockAPI {
  private readonly baseUrl = 'https://stock.xueqiu.com/v5/stock/quote.json';
  private cookie: string = '';

  /**
   * 获取股票数据
   * @param code 股票代码（如：SH600000 或 SZ000001）
   */
  async fetchStockData(code: string): Promise<StockData | null> {
    try {
      // 雪球需要先获取 cookie
      if (!this.cookie) {
        await this.initCookie();
      }

      const fullCode = this.formatStockCode(code);
      const response = await axios.get(this.baseUrl, {
        params: {
          symbol: fullCode,
          extend: 'detail'
        },
        timeout: 5000,
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'Cookie': this.cookie,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'Referer': 'https://xueqiu.com'
        }
      });

      return this.parseResponse(code, response.data);
    } catch (error) {
      console.error(`雪球API获取股票数据失败 [${code}]:`, error);
      return null;
    }
  }

  /**
   * 初始化 Cookie
   */
  private async initCookie(): Promise<void> {
    try {
      const response = await axios.get('https://xueqiu.com', {
        timeout: 5000,
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });

      const cookies = response.headers['set-cookie'];
      if (cookies) {
        this.cookie = cookies.map(c => c.split(';')[0]).join('; ');
      }
    } catch (error) {
      console.error('初始化雪球Cookie失败:', error);
    }
  }

  /**
   * 格式化股票代码
   */
  private formatStockCode(code: string): string {
    const cleanCode = code.replace(/[^0-9]/g, '');
    if (cleanCode.startsWith('6')) {
      return `SH${cleanCode}`;
    } else if (cleanCode.startsWith('0') || cleanCode.startsWith('3')) {
      return `SZ${cleanCode}`;
    }
    return cleanCode;
  }

  /**
   * 解析雪球返回数据
   */
  private parseResponse(code: string, data: any): StockData | null {
    try {
      if (!data || !data.data || !data.data.quote) {
        return null;
      }

      const quote = data.data.quote;

      return {
        code,
        name: quote.name || '',
        currentPrice: quote.current || 0,
        openPrice: quote.open || 0,
        closePrice: quote.last_close || 0, // 昨收价
        highPrice: quote.high || 0,
        lowPrice: quote.low || 0,
        changePercent: quote.percent || 0, // 雪球直接返回涨跌幅百分比
        volume: quote.volume || 0,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('解析雪球数据失败:', error);
      return null;
    }
  }
}

/**
 * API 工厂
 */
export class StockAPIFactory {
  static create(source: 'sina' | 'xueqiu'): StockAPI {
    switch (source) {
      case 'sina':
        return new SinaAPI();
      case 'xueqiu':
        return new XueqiuAPI();
      default:
        return new SinaAPI();
    }
  }
}
