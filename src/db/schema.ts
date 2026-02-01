import Dexie, { Table } from 'dexie';

// 数据类型定义
export interface UserWatchlist {
  id?: number;
  fundCode: string; // 基金代码（主键索引）
  fundName: string; // 基金名称（缓存，减少查询）
  addedAt: Date; // 添加时间
  sortOrder: number; // 拖拽排序顺序
  category?: string; // 基金类型（混合型、股票型等）
}

export interface NavHistory {
  id?: number;
  fundCode: string; // 基金代码
  date: string; // 净值日期 YYYY-MM-DD
  nav: number; // 单位净值
  accNav: number; // 累计净值
  dailyGrowth?: number; // 日涨跌幅 %
  // 复合索引：[fundCode+date] 用于快速查询某基金时间范围
}

export interface FundDetail {
  fundCode: string; // 主键
  fundName: string;
  manager: string; // 基金经理
  company: string; // 管理公司
  inceptionDate: string;
  topHoldings: Array<{
    // 前10重仓股（JSON 存储）
    stockCode: string;
    stockName: string;
    ratio: number; // 持仓占比
    changePercent?: number; // 今日涨跌幅 %
  }>;
  updatedAt: Date; // 缓存时间戳
}

export interface MarketIndex {
  code: string; // 指数代码（HSI/IXIC等）
  name: string;
  currentPrice: number;
  changePercent: number;
  updatedAt: Date;
}

export class FundPulseDB extends Dexie {
  // 表定义
  watchlist!: Table<UserWatchlist, number>;
  navHistory!: Table<NavHistory, number>;
  fundDetails!: Table<FundDetail, string>;
  indices!: Table<MarketIndex, string>;

  constructor() {
    super('FundPulseDB');
    this.version(1).stores({
      // 索引定义
      watchlist: '++id, fundCode, sortOrder',
      navHistory: '[fundCode+date], fundCode, date', // 复合索引：快速查某基金日期范围
      fundDetails: 'fundCode, updatedAt',
      indices: 'code, updatedAt',
    });
  }
}

export const db = new FundPulseDB();
