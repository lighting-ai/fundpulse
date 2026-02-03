import Dexie, { Table } from 'dexie';

// 数据类型定义
export interface UserWatchlist {
  id?: number;
  fundCode: string; // 基金代码（主键索引）
  fundName: string; // 基金名称（缓存，减少查询）
  addedAt: Date; // 添加时间
  sortOrder: number; // 拖拽排序顺序
  category?: string; // 基金分类（不带中划线，如"混合型"），用于分类展示
  ftype?: string; // 基金类型原始值（FTYPE，可能带中划线，如"混合型-偏股"）
  fundType?: string; // 基金类型代码（FUNDTYPE，如"002"）
  userShares?: number; // 用户持仓份额（份）
  userCost?: number; // 用户持仓成本（买入时的净值）
  userAmount?: number; // 用户持仓金额（元），用于快速输入
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
    // 版本2：添加 ftype 和 fundType 字段
    this.version(2).stores({
      watchlist: '++id, fundCode, sortOrder',
      navHistory: '[fundCode+date], fundCode, date',
      fundDetails: 'fundCode, updatedAt',
      indices: 'code, updatedAt',
    }).upgrade(async (tx) => {
      // 迁移数据：
      // 1. 如果已有 category，保留它（作为分类）
      // 2. 如果 category 存在但没有 ftype，将 category 复制到 ftype（作为原始值）
      // 3. 如果 ftype 存在但没有 category，从 ftype 提取分类到 category
      const watchlist = tx.table('watchlist');
      await watchlist.toCollection().modify((fund) => {
        if (fund.category && !fund.ftype) {
          // 有 category 但没有 ftype，将 category 作为原始值
          fund.ftype = fund.category;
        } else if (fund.ftype && !fund.category) {
          // 有 ftype 但没有 category，从 ftype 提取分类
          const parts = fund.ftype.split('-');
          fund.category = parts[0] || '';
        }
      });
    });
  }
}

export const db = new FundPulseDB();
