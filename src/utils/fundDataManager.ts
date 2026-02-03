/**
 * 基金数据管理器
 * 统一管理盘中和盘后的数据融合逻辑
 * 
 * 根据 yk.md 文档：
 * - 盘中（9:30-15:00）：使用实时估算净值（gsz）和估算涨跌幅（gszzl）
 * - 盘后（15:00-19:00）：使用收盘估算（gsz）
 * - 日终（19:00后）：使用正式净值（pingzhongdata 的 Data_netWorthTrend）
 * 
 * 根据基金类型判断是否支持实时估值：
 * - 支持：股票型(001)、混合型(002)、指数型(003)，但排除名字包含"ETF"的
 * - 不支持：债券型(004)、货币型(005)、QDII(006)、FOF(007)、ETF相关基金
 */

import { fetchFundRealtime, fetchNetWorthTrend } from '../api/eastmoney';

/**
 * 判断基金是否支持实时估值
 * @param fundTypeCode 基金类型代码（FUNDTYPE，如"002"）
 * @param fundType 基金类型（FTYPE，如"混合型-偏股"）
 * @param fundName 基金名称
 * @returns 是否支持实时估值
 */
export const supportsRealtimeEstimate = (
  fundTypeCode?: string,
  fundType?: string,
  fundName?: string
): boolean => {
  // 如果没有类型信息，默认不支持（历史数据）
  if (!fundTypeCode && !fundType) {
    return false;
  }

  // 必须是股票型(001)、混合型(002)、指数型(003)
  const supportedTypes = ['001', '002', '003'];
  if (fundTypeCode && !supportedTypes.includes(fundTypeCode)) {
    return false;
  }

  // 如果基金名称包含"ETF"，不支持实时估值
  const name = fundName || '';
  if (name.includes('ETF')) {
    return false;
  }

  // 如果基金类型字符串包含"ETF"，也不支持
  const type = fundType || '';
  if (type.includes('ETF')) {
    return false;
  }

  return true;
};

export interface NetWorthTrendItem {
  x: number; // 时间戳（毫秒）
  y: number; // 净值
  equityReturn?: number; // 涨跌幅 %
}

export interface FundDisplayData {
  // 净值数据
  netValue: number; // 当前净值（实时估算或正式净值）
  changePercent: number; // 涨跌幅 %
  previousNav: number; // 昨日净值（用于计算）
  
  // 元数据
  isRealtime: boolean; // 是否为实时估算
  dataSource: 'realtime' | 'official'; // 数据来源
  updateTime: string; // 更新时间
  statusLabel: string; // UI 显示的状态标签（如"实时估算 · 10:23"）
}

/**
 * 判断是否在交易时间（9:30-11:30, 13:00-15:00）
 */
export const isTradingHours = (): boolean => {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const day = now.getDay();

  // 周末不交易
  if (day === 0 || day === 6) return false;

  const time = hour * 100 + minute;
  // 上午：9:30-11:30，下午：13:00-15:00
  return (time >= 930 && time <= 1130) || (time >= 1300 && time <= 1500);
};

/**
 * 判断是否已收盘但正式净值未公布（15:00-19:00）
 */
export const isAfterClose = (): boolean => {
  const now = new Date();
  const hour = now.getHours();
  return hour >= 15 && hour < 19; // 15:00-19:00 用实时估算
};

/**
 * 判断是否已公布正式净值（19:00后）
 */
export const isOfficialNavAvailable = (): boolean => {
  const now = new Date();
  const hour = now.getHours();
  return hour >= 19; // 19:00后使用正式净值
};

/**
 * 获取状态标签文本
 */
export const getStatusLabel = (isRealtime: boolean, updateTime?: string): string => {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  if (isRealtime) {
    if (isTradingHours()) {
      return `实时估算 · ${hour}:${String(minute).padStart(2, '0')}`;
    } else if (isAfterClose()) {
      return '收盘估算 · 15:00';
    }
  }

  // 正式净值
  if (updateTime) {
    const date = new Date(updateTime);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日净值`;
  }

  return '今日净值';
};

/**
 * 从历史数据中获取最后一条（今日的正式净值）
 */
export const getLatestOfficialNav = (historyData: NetWorthTrendItem[]): NetWorthTrendItem | null => {
  if (!historyData || historyData.length === 0) return null;
  
  // 按时间戳排序，取最后一条
  const sorted = [...historyData].sort((a, b) => a.x - b.x);
  return sorted[sorted.length - 1];
};

/**
 * 获取前一个交易日的收盘净值
 */
export const getPreviousCloseNav = (historyData: NetWorthTrendItem[]): number => {
  if (!historyData || historyData.length < 2) return 0;
  
  // 按时间戳排序，取倒数第二条
  const sorted = [...historyData].sort((a, b) => a.x - b.x);
  if (sorted.length >= 2) {
    return sorted[sorted.length - 2].y;
  }
  return sorted[0]?.y || 0;
};

/**
 * 融合实时数据和历史数据，返回统一的显示数据
 * @param fundCode 基金代码
 * @param historyData 历史净值趋势数据（可选，如果不提供会自动获取）
 * @returns 返回 FundDisplayData 或 null（获取失败时不返回默认值，避免清零）
 */
// 请求缓存，避免频繁请求同一个基金
const netWorthTrendCache = new Map<string, {
  data: Array<{ x: number; y: number; equityReturn?: number }>;
  timestamp: number;
}>();

// 缓存有效期：5分钟
const CACHE_DURATION = 5 * 60 * 1000;

export const mergeFundData = async (
  fundCode: string,
  historyData?: NetWorthTrendItem[] | null,
  fundTypeCode?: string,
  fundType?: string,
  fundName?: string
): Promise<FundDisplayData | null> => {
  // 如果没有提供历史数据，尝试获取
  let trendData = historyData;
  if (!trendData) {
    // 检查缓存
    const cached = netWorthTrendCache.get(fundCode);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      trendData = cached.data;
    } else {
      try {
        trendData = await fetchNetWorthTrend(fundCode);
        // 缓存成功获取的数据
        if (trendData) {
          netWorthTrendCache.set(fundCode, {
            data: trendData,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        // 如果缓存中有旧数据，使用旧数据
        if (cached) {
          trendData = cached.data;
        } else {
          // 历史数据获取失败，但不影响实时数据的使用
          trendData = null;
        }
      }
    }
  }
  
  const latestOfficial = trendData ? getLatestOfficialNav(trendData) : null;
  const previousNav = trendData ? getPreviousCloseNav(trendData) : 0;
  
  // 判断是否应该使用实时数据
  // 1. 必须在交易时间（盘中或盘后）
  // 2. 基金必须支持实时估值
  const shouldUseRealtime = (isTradingHours() || isAfterClose()) && 
    supportsRealtimeEstimate(fundTypeCode, fundType, fundName);
  
  if (shouldUseRealtime) {
    try {
      // 获取实时数据
      const realtimeData = await fetchFundRealtime(fundCode);
      
      // 兜底逻辑：如果返回的估算净值为0或空，说明该基金不支持实时估值，跳过
      if (realtimeData.estimateNav && realtimeData.estimateNav > 0) {
        return {
          netValue: realtimeData.estimateNav, // gsz: 实时估算净值
          changePercent: realtimeData.estimateGrowth || 0, // gszzl: 估算涨跌幅
          previousNav: realtimeData.nav || previousNav, // dwjz: 昨日收盘净值
          isRealtime: true,
          dataSource: 'realtime',
          updateTime: realtimeData.valuationTime || '',
          statusLabel: getStatusLabel(true, realtimeData.valuationTime),
        };
      } else {
        // 兜底：即使是我们规定的支持类型，如果返回空，也跳过实时估算
        console.warn(`基金 ${fundCode} 实时估值接口返回空，跳过实时估算`);
      }
    } catch (error) {
      console.warn(`获取基金 ${fundCode} 实时数据失败:`, error);
      // 实时数据获取失败，尝试使用正式净值
    }
  }
  
  // 使用正式净值（19:00后或实时数据获取失败）
  if (latestOfficial) {
    return {
      netValue: latestOfficial.y,
      changePercent: latestOfficial.equityReturn || 0,
      previousNav,
      isRealtime: false,
      dataSource: 'official',
      updateTime: new Date(latestOfficial.x).toISOString(),
      statusLabel: getStatusLabel(false, new Date(latestOfficial.x).toISOString()),
    };
  }
  
  // 如果实时数据和正式净值都获取失败，返回 null，不清零
  // 这样调用方可以保留旧数据
  return null;
};

/**
 * 计算今日盈亏
 * @param netValue 当前净值（实时估算或正式净值）
 * @param previousNav 昨日收盘净值
 * @param userShares 用户持有份额
 */
export const calculateTodayProfit = (
  netValue: number,
  previousNav: number,
  userShares: number
): number => {
  if (!netValue || !previousNav || !userShares) return 0;
  return (netValue - previousNav) * userShares;
};

/**
 * 计算累计收益
 * @param netValue 当前净值（实时估算或正式净值）
 * @param userCost 用户成本价
 * @param userShares 用户持有份额
 */
export const calculateTotalProfit = (
  netValue: number,
  userCost: number,
  userShares: number
): number => {
  if (!netValue || !userCost || !userShares) return 0;
  return (netValue - userCost) * userShares;
};
