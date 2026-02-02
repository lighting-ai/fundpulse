/**
 * 东方财富板块 API 封装
 * API: https://push2.eastmoney.com/api/qt/clist/get
 */

export interface SectorData {
  // 基础信息
  code: string; // f12: 板块代码，如 "BK0457"
  name: string; // f14: 板块名称，如 "电网设备"
  
  // 涨跌数据
  changePercent: number; // f3: 涨跌幅（已转换为百分比值，如 3.23 表示 3.23%）
  changeAmount?: number; // f4: 涨跌额（已转换为实际值）
  latestPrice?: number; // f2: 最新价（已转换为实际值）
  
  // 统计信息
  upCount: number; // f104: 上涨家数
  downCount: number; // f105: 下跌家数
  turnoverRate?: number; // f8: 换手率（已转换为百分比值）
  
  // 领涨股票
  leadingStock?: {
    name: string; // f128: 领涨股票名称
    code?: string; // f140: 领涨股票代码
    changePercent: number; // f141: 领涨股票涨跌幅（已转换为百分比值）
  };
  
  // 领跌股票（当前未在UI中展示）
  leadingDeclineStock?: {
    name: string; // f207: 领跌股票名称
    code?: string; // f208: 领跌股票代码
  };
  
  // 其他字段（当前未在UI中展示）
  updateTime?: Date; // f20: 更新时间（时间戳）
  marketValue?: number; // f136: 总市值相关（单位待确认）
  capitalFlow?: number; // f222: 资金流相关
}

/**
 * 获取行业板块数据
 * fs=m:90+t:2 表示行业板块
 * 
 * API 参数说明（根据实际 API 分析）：
 * - po: 排序方向
 *   - 涨幅榜：po=1（API 内部可能对正数做了特殊处理，返回涨幅最大的在前）
 *   - 跌幅榜：po=0（降序，跌幅是负数，降序意味着跌幅最大的在前）
 * - fltt: 格式化类型，1=格式化（带%），2=原始值（小数）
 * - invt: 反转类型，2=不反转
 * - dect: 小数位数，1=1位小数
 * - fid: 排序字段，f3=涨跌幅
 * - fields: 需要返回的字段列表
 */
export const fetchSectors = async (sortType: 'up' | 'down' = 'up'): Promise<SectorData[]> => {
  // 根据你提供的 API：
  // 涨幅榜：po=1
  // 跌幅榜：po=0
  const po = sortType === 'up' ? '1' : '0';
  
  // 使用你提供的完整 fields 列表
  const url = `https://push2.eastmoney.com/api/qt/clist/get?np=1&fltt=1&invt=2&fs=m:90+t:2+f:!50&fields=f12,f13,f14,f1,f2,f4,f3,f152,f20,f8,f104,f105,f128,f140,f141,f207,f208,f209,f136,f222&fid=f3&pn=1&pz=20&po=${po}&dect=1`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    if (!data.data || !data.data.diff) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[fetchSectors] API 返回数据为空:', data);
      }
      return [];
    }

    const sectors = data.data.diff.map((item: any) => {
      /**
       * API 字段解析（根据实际返回数据）：
       * 
       * f1: 未知字段，示例值: 2
       * f2: 最新价（放大100倍），示例值: 4052874 → 实际值: 40528.74
       * f3: 涨跌幅（放大100倍），示例值: 323 → 实际值: 3.23%
       * f4: 涨跌额（放大100倍），示例值: 126740 → 实际值: 1267.40
       * f8: 换手率（放大100倍），示例值: 526 → 实际值: 5.26%
       * f12: 板块代码，示例值: "BK0457"
       * f13: 市场类型，示例值: 90（表示行业板块）
       * f14: 板块名称，示例值: "电网设备"
       * f20: 时间戳（毫秒），示例值: 1915631664000
       * f104: 上涨家数，示例值: 118
       * f105: 下跌家数，示例值: 21
       * f128: 领涨股票名称，示例值: "顺钠股份"
       * f140: 领涨股票代码，示例值: "000533"
       * f141: 领涨股票涨跌幅（放大100倍），示例值: 0 → 实际值: 0%（注意：示例数据中为0，实际可能是1002表示10.02%）
       * f136: 未知字段，示例值: 1002（可能是总市值相关）
       * f152: 未知字段，示例值: 2
       * f207: 领跌股票名称，示例值: "华通线缆"
       * f208: 领跌股票代码，示例值: "605196"
       * f209: 未知字段，示例值: 1
       * f222: 未知字段，示例值: -963（可能是资金流相关）
       */

      // f3: 涨跌幅（放大100倍），需要除以100得到百分比值
      // 示例：323 → 3.23%
      const changePercent = (parseFloat(item.f3) || 0) / 100;

      // f141: 领涨股票涨跌幅（放大100倍），需要除以100得到百分比值
      // 示例：如果返回1002，表示10.02%
      const leadingStockChangePercent = item.f141 ? (parseFloat(item.f141) || 0) / 100 : 0;

      // f2: 最新价（放大100倍），除以100得到实际价格
      // 示例：4052874 → 40528.74
      const latestPrice = (parseFloat(item.f2) || 0) / 100;

      // f4: 涨跌额（放大100倍），除以100得到实际涨跌额
      // 示例：126740 → 1267.40
      const changeAmount = (parseFloat(item.f4) || 0) / 100;

      // f8: 换手率（放大100倍），除以100得到实际换手率百分比
      // 示例：526 → 5.26%
      const turnoverRate = (parseFloat(item.f8) || 0) / 100;

      // f20: 时间戳（毫秒），转换为Date对象
      const updateTime = item.f20 ? new Date(item.f20) : undefined;

      // f136: 可能是总市值相关数据（需要进一步确认单位）
      const marketValue = item.f136;

      // f222: 可能是资金流相关数据
      const capitalFlow = item.f222;

      return {
        code: item.f12 || '', // f12: 板块代码
        name: (item.f14 || '').replace('行业', '').replace('板块', ''), // f14: 板块名称
        changePercent, // f3: 涨跌幅
        upCount: item.f104 || 0, // f104: 上涨家数
        downCount: item.f105 || 0, // f105: 下跌家数
        leadingStock: item.f128
          ? {
              name: item.f128, // f128: 领涨股票名称
              code: item.f140 || '', // f140: 领涨股票代码
              changePercent: leadingStockChangePercent, // f141: 领涨股票涨跌幅
            }
          : undefined,
        // 以下字段当前未在UI中展示，但已解析以备后用
        latestPrice, // f2: 最新价
        changeAmount, // f4: 涨跌额
        turnoverRate, // f8: 换手率
        updateTime, // f20: 更新时间
        marketValue, // f136: 总市值相关
        capitalFlow, // f222: 资金流相关
        leadingDeclineStock: item.f207
          ? {
              name: item.f207, // f207: 领跌股票名称
              code: item.f208 || '', // f208: 领跌股票代码
            }
          : undefined,
      };
    });

    // 调试：输出解析后的数据
    if (process.env.NODE_ENV === 'development') {
      console.log(`[fetchSectors] ${sortType === 'up' ? '涨幅榜' : '跌幅榜'} 解析结果:`, sectors.length, '条');
      if (sectors.length > 0) {
        console.log('[fetchSectors] 前3条原始数据:', data.data.diff.slice(0, 3).map((item: any) => ({
          name: item.f14,
          f3_raw: item.f3,
          f3_type: typeof item.f3,
          f141_raw: item.f141,
        })));
        console.log('[fetchSectors] 前3条解析后:', sectors.slice(0, 3).map((s: SectorData) => ({
          name: s.name,
          changePercent: s.changePercent,
        })));
      }
    }

    return sectors;
  } catch (error) {
    console.error('获取板块数据失败:', error);
    throw error;
  }
};
