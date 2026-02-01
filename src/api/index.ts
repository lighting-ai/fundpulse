// 指数数据 API（使用东方财富接口）

export interface IndexData {
  code: string;
  name: string;
  currentPrice: number;
  changePercent: number;
  change: number;
}

// 指数代码映射（东方财富代码格式）
// 格式：市场代码+指数代码，如 1.000001 表示上证指数
export const INDEX_CODES: Record<string, { code: string; name: string; market: string }> = {
  'SH000001': { code: '1.000001', name: '上证指数', market: 'm:1' },
  'SZ399001': { code: '0.399001', name: '深证成指', market: 'm:0' },
  'SZ399006': { code: '0.399006', name: '创业板指', market: 'm:0' },
  // 暂时只支持 A 股指数，海外指数需要其他数据源
  'HSI': { code: '', name: '恒生指数', market: '' },
  'IXIC': { code: '', name: '纳斯达克', market: '' },
  'DJI': { code: '', name: '道琼斯', market: '' },
  'SPX': { code: '', name: '标普500', market: '' },
};

/**
 * 通过东方财富 API 获取指数数据
 * 使用 push2.eastmoney.com 接口，通过 script 标签加载 JSONP
 */
const loadEastMoneyIndexData = (code: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    // 生成唯一的回调函数名
    const callbackName = `eastmoney_index_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    
    const cleanup = () => {
      try {
        document.body.removeChild(script);
      } catch (e) {
        // ignore
      }
      delete (window as any)[callbackName];
    };
    
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('请求超时'));
    }, 8000);
    
    // 设置回调函数
    (window as any)[callbackName] = (data: any) => {
      clearTimeout(timeout);
      cleanup();
      resolve(data);
    };
    
    script.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error('网络错误'));
    };
    
    // 东方财富指数接口（支持 JSONP）
    // secid 格式：1.000001（上证指数），0.399001（深证成指）
    // fields: f43=现价, f58=名称, f60=昨收, f170=涨跌幅
    script.src = `https://push2.eastmoney.com/api/qt/stock/get?secid=${code}&fields=f43,f58,f60,f170&fltt=2&cb=${callbackName}&_=${Date.now()}`;
    document.body.appendChild(script);
  });
};

/**
 * 解析东方财富返回的数据
 */
const parseEastMoneyData = (data: any, indexKey: string): IndexData | null => {
  try {
    if (!data || !data.data) {
      return null;
    }
    
    const d = data.data;
    // 东方财富返回的价格需要除以100（有些字段需要，有些不需要）
    // f43: 现价（可能需要除以100）
    // f60: 昨收（可能需要除以100）
    // f170: 涨跌幅（百分比，可能需要除以100）
    const currentPrice = (parseFloat(d.f43) || 0) / 100; // 当前价
    const yesterdayClose = (parseFloat(d.f60) || currentPrice * 100) / 100; // 昨收
    const changePercent = (parseFloat(d.f170) || 0) / 100; // 涨跌幅（百分比）
    const change = currentPrice - yesterdayClose;
    
    // 如果价格看起来不合理（太大或太小），尝试不除以100
    let finalPrice = currentPrice;
    let finalChangePercent = changePercent;
    if (currentPrice < 0.01 || currentPrice > 100000) {
      finalPrice = parseFloat(d.f43) || 0;
      finalChangePercent = parseFloat(d.f170) || 0;
    }
    
    return {
      code: indexKey,
      name: INDEX_CODES[indexKey]?.name || d.f58 || '',
      currentPrice: finalPrice,
      changePercent: finalChangePercent,
      change: finalPrice - yesterdayClose,
    };
  } catch (error) {
    console.error('解析东方财富数据失败:', error);
    return null;
  }
};

/**
 * 获取单个指数数据
 */
export const fetchIndexData = async (indexKey: string): Promise<IndexData | null> => {
  const indexInfo = INDEX_CODES[indexKey];
  if (!indexInfo || !indexInfo.code) {
    // 海外指数暂时不支持
    return null;
  }

  try {
    const rawData = await loadEastMoneyIndexData(indexInfo.code);
    return parseEastMoneyData(rawData, indexKey);
  } catch (error) {
    console.error(`获取指数 ${indexKey} 数据失败:`, error);
    return null;
  }
};

/**
 * 批量获取多个指数数据（串行请求，避免并发问题）
 */
export const fetchMultipleIndices = async (keys: string[]): Promise<IndexData[]> => {
  const results: IndexData[] = [];
  
  // 串行请求，避免并发导致的数据混乱
  for (const key of keys) {
    try {
      const data = await fetchIndexData(key);
      if (data) {
        results.push(data);
      }
      // 每个请求之间稍作延迟，避免请求过快
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`获取指数 ${key} 失败:`, error);
    }
  }
  
  return results;
};
