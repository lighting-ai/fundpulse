// 指数数据 API（使用腾讯接口）

export interface IndexData {
  code: string;
  name: string;
  currentPrice: number;
  changePercent: number;
  change: number;
}

// 指数代码映射（腾讯代码格式）
// 腾讯格式：sh000001（上证指数），sz399001（深证成指），hkHSI（恒生指数），usIXIC（纳斯达克）
export const INDEX_CODES: Record<string, { code: string; name: string }> = {
  // 沪深指数
  'SH000001': { code: 'sh000001', name: '上证指数' },
  'SH000016': { code: 'sh000016', name: '上证50' },
  'SH000300': { code: 'sh000300', name: '沪深300' },
  'SH000905': { code: 'sh000905', name: '中证500' },
  'SH000852': { code: 'sh000852', name: '中证1000' },
  'SH000688': { code: 'sh000688', name: '科创50' },
  'SZ399001': { code: 'sz399001', name: '深证成指' },
  'SZ399005': { code: 'sz399005', name: '中小板指' },
  'SZ399006': { code: 'sz399006', name: '创业板指' },
  'SZ399002': { code: 'sz399002', name: '深成指R' },
  'SZ399003': { code: 'sz399003', name: '深证100' },
  // 港股指数
  'HSI': { code: 'hkHSI', name: '恒生指数' },
  'HSCEI': { code: 'hkHSCEI', name: '恒生国企' },
  'HSTECH': { code: 'hkHSTECH', name: '恒生科技' },
  // 美股指数
  'IXIC': { code: 'usIXIC', name: '纳斯达克' },
  'DJI': { code: 'usDJI', name: '道琼斯' },
  'SPX': { code: 'usSPX', name: '标普500' },
};

/**
 * 解析腾讯返回的数据格式
 * 腾讯格式：v_hkHSI="1~恒生指数~HSI~21000.5~100~0.5~..."
 * 字段说明：
 * parts[0]: 未知
 * parts[1]: 指数名称
 * parts[2]: 指数代码
 * parts[3]: 当前点数
 * parts[4]: 涨跌额
 * parts[5]: 涨跌幅（百分比，如 0.5 表示 0.5%）
 * parts[30]: 更新时间
 */
const parseTencentFormat = (data: string): IndexData | null => {
  try {
    if (!data || typeof data !== 'string') {
      return null;
    }
    
    const parts = data.split('~');
    if (parts.length < 6) {
      return null;
    }
    
    const name = parts[1] || '';
    const code = parts[2] || '';
    const currentPrice = parseFloat(parts[3]) || 0;
    const change = parseFloat(parts[4]) || 0;
    const changePercent = parseFloat(parts[5]) || 0;
    
    if (!name || !code || currentPrice === 0) {
      return null;
    }
    
    return {
      code,
      name,
      currentPrice,
      change,
      changePercent,
    };
  } catch (error) {
    console.error('解析腾讯数据失败:', error);
    return null;
  }
};

/**
 * 获取单个指数数据（使用腾讯 API）
 */
const fetchIndexTencent = (tencentCode: string, indexKey: string): Promise<IndexData | null> => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    const callbackName = `v_${tencentCode}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const cleanup = () => {
      try {
        if (script.parentNode) {
          document.body.removeChild(script);
        }
      } catch (e) {
        // ignore
      }
      try {
        delete (window as any)[callbackName];
      } catch (e) {
        // ignore
      }
    };
    
    const timeout = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 8000);
    
    // 腾讯返回格式：v_hkHSI="1~恒生指数~HSI~21000.5~..."
    (window as any)[callbackName] = (data: string) => {
      clearTimeout(timeout);
      cleanup();
      
      if (!data || typeof data !== 'string') {
        resolve(null);
        return;
      }
      
      // 移除引号
      const cleanData = data.replace(/^["']|["']$/g, '');
      const result = parseTencentFormat(cleanData);
      
      if (result) {
        // 使用预定义的中文名称，避免编码问题导致的乱码
        const predefinedName = INDEX_CODES[indexKey]?.name || result.name;
        // 使用 indexKey 作为 code（保持与原有代码兼容）
        resolve({
          ...result,
          code: indexKey,
          name: predefinedName, // 使用预定义的中文名称
        });
      } else {
        resolve(null);
      }
    };
    
    script.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      resolve(null);
    };
    
    // 使用相对协议，让浏览器自动选择 http/https
    // 如果 HTTPS 不可用，会回退到 HTTP（但可能被浏览器阻止 Mixed Content）
    script.src = `//qt.gtimg.cn/q=${tencentCode}&_callback=${callbackName}`;
    document.body.appendChild(script);
  });
};

/**
 * 获取单个指数数据（使用腾讯 API）
 */
export const fetchIndexData = async (indexKey: string): Promise<IndexData | null> => {
  const indexInfo = INDEX_CODES[indexKey];
  if (!indexInfo || !indexInfo.code) {
    return null;
  }

  try {
    return await fetchIndexTencent(indexInfo.code, indexKey);
  } catch (error) {
    console.error(`获取指数 ${indexKey} 数据失败:`, error);
    return null;
  }
};

/**
 * 批量获取多个指数数据（使用腾讯批量接口，更高效）
 */
export const fetchMultipleIndices = async (keys: string[]): Promise<IndexData[]> => {
  try {
    // 获取所有腾讯代码
    const tencentCodes = keys
      .map(key => {
        const info = INDEX_CODES[key];
        return info ? { tencentCode: info.code, indexKey: key } : null;
      })
      .filter((item): item is { tencentCode: string; indexKey: string } => item !== null);
    
    if (tencentCodes.length === 0) {
      return [];
    }
    
    // 批量请求
    // 注意：由于 Mixed Content 限制，HTTPS 页面无法请求 HTTP 资源
    // 如果腾讯 API 不支持 HTTPS，会回退到单个 JSONP 请求
    const codesStr = tencentCodes.map(item => item.tencentCode).join(',');
    
    // 尝试使用 HTTPS（如果支持）
    let text: string;
    try {
      // 先尝试 HTTPS
      const httpsUrl = `https://qt.gtimg.cn/q=${codesStr}`;
      const response = await fetch(httpsUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      text = await response.text();
    } catch (httpsError) {
      // HTTPS 失败，回退到 JSONP 方式（在 catch 块中处理）
      throw httpsError;
    }
    
    // 解析多行数据：v_hkHSI="..."; v_usIXIC="...";
    const results: IndexData[] = [];
    const lines = text.split(';');
    
    lines.forEach((line) => {
      if (!line || !line.includes('=')) {
        return;
      }
      
      const match = line.match(/v_(\w+)=["']?([^"';]+)["']?/);
      if (!match || match.length < 3) {
        return;
      }
      
      const tencentCode = match[1];
      const dataStr = match[2];
      
      // 找到对应的 indexKey
      const codeInfo = tencentCodes.find(item => item.tencentCode === tencentCode);
      if (!codeInfo) {
        return;
      }
      
      const parsed = parseTencentFormat(dataStr);
      if (parsed) {
        // 使用预定义的中文名称，避免编码问题导致的乱码
        const predefinedName = INDEX_CODES[codeInfo.indexKey]?.name || parsed.name;
        results.push({
          ...parsed,
          code: codeInfo.indexKey, // 使用 indexKey 作为 code
          name: predefinedName, // 使用预定义的中文名称
        });
      }
    });
    
    return results;
  } catch (error) {
    console.error('批量获取指数数据失败:', error);
    // 如果批量请求失败，回退到单个请求
    const results: IndexData[] = [];
    for (const key of keys) {
      try {
        const data = await fetchIndexData(key);
        if (data) {
          results.push(data);
        }
        // 每个请求之间稍作延迟
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        console.error(`获取指数 ${key} 失败:`, err);
      }
    }
    return results;
  }
};
