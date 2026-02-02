/**
 * 腾讯财经指数 API 封装
 * API: https://qt.gtimg.cn/q=
 */

import { INDEX_CODES } from './index';

export interface TencentIndexData {
  marketType?: string;      // 1/51=A股, 100=港股, 200=美股
  name: string;
  code: string;
  tencentCode?: string; // 腾讯代码（如 sh000001），用于查找预定义名称
  price: number; // 最新价 (字段3)
  prevClose: number; // 昨收 (字段4)
  open: number; // 今开 (字段5)
  change: number; // 涨跌额
  changePercent: number; // 涨跌幅%
  high: number; // 最高
  low: number; // 最低
  pe: number; // 市盈率(PE)
  volume: string; // 格式化后的成交量（如 "2.45亿"）
  amount?: string; // 格式化后的成交额（如 "3965.59亿"）
  updateTime?: string; // 更新时间
  isUp?: boolean; // 是否上涨
}

/**
 * 根据腾讯代码查找预定义的中文名称（避免乱码）
 */
const getPredefinedName = (tencentCodeOrIndexCode: string, fallbackName: string, indexCode?: string): string => {
  // 方法1: 直接匹配腾讯代码（如 sh000001）
  for (const [key, value] of Object.entries(INDEX_CODES)) {
    if (value.code === tencentCodeOrIndexCode) {
      return value.name;
    }
  }
  
  // 方法2: 通过指数代码匹配（如 000001 匹配 SH000001）
  const codeToMatch = indexCode || tencentCodeOrIndexCode;
  if (codeToMatch) {
    const upperCode = codeToMatch.toUpperCase();
    
    // 尝试直接匹配（如 000001 -> SH000001）
    if (tencentCodeOrIndexCode.startsWith('sh') || upperCode.match(/^0{3,}/)) {
      const shCode = 'SH' + upperCode.replace(/^SH/, '');
      if (INDEX_CODES[shCode]) {
        return INDEX_CODES[shCode].name;
      }
    } else if (tencentCodeOrIndexCode.startsWith('sz') || upperCode.match(/^399/)) {
      const szCode = 'SZ' + upperCode.replace(/^SZ/, '');
      if (INDEX_CODES[szCode]) {
        return INDEX_CODES[szCode].name;
      }
    } else if (tencentCodeOrIndexCode.startsWith('hk')) {
      // 港股：hkHSI -> HSI
      // 先尝试去掉 hk 前缀匹配（hkHSI -> HSI）
      const hkCode = tencentCodeOrIndexCode.substring(2).toUpperCase(); // hkHSI -> HSI
      if (INDEX_CODES[hkCode]) {
        return INDEX_CODES[hkCode].name;
      }
      // 也尝试使用 indexCode 直接匹配
      if (indexCode && INDEX_CODES[indexCode.toUpperCase()]) {
        return INDEX_CODES[indexCode.toUpperCase()].name;
      }
    } else if (tencentCodeOrIndexCode.startsWith('us')) {
      // 美股：usIXIC -> IXIC
      // 先尝试去掉 us 前缀匹配（usIXIC -> IXIC）
      const usCode = tencentCodeOrIndexCode.substring(2).toUpperCase(); // usIXIC -> IXIC
      if (INDEX_CODES[usCode]) {
        return INDEX_CODES[usCode].name;
      }
      // 也尝试使用 indexCode 直接匹配（可能是 .IXIC）
      if (indexCode) {
        const indexCodeUpper = indexCode.toUpperCase();
        if (INDEX_CODES[indexCodeUpper]) {
          return INDEX_CODES[indexCodeUpper].name;
        }
        // 对于美股，indexCode 可能是 .IXIC，需要去掉点号
        if (indexCodeUpper.startsWith('.')) {
          const codeWithoutDot = indexCodeUpper.substring(1);
          if (INDEX_CODES[codeWithoutDot]) {
            return INDEX_CODES[codeWithoutDot].name;
          }
        }
      }
    } else if (codeToMatch && !tencentCodeOrIndexCode.startsWith('sh') && !tencentCodeOrIndexCode.startsWith('sz')) {
      // 如果 codeToMatch 不是沪深代码，可能是港股美股的 indexCode（如 HSI, IXIC）
      // 尝试直接匹配
      if (INDEX_CODES[upperCode]) {
        return INDEX_CODES[upperCode].name;
      }
      // 对于美股，indexCode 可能是 .IXIC，需要去掉点号
      if (upperCode.startsWith('.')) {
        const codeWithoutDot = upperCode.substring(1);
        if (INDEX_CODES[codeWithoutDot]) {
          return INDEX_CODES[codeWithoutDot].name;
        }
      }
    }
    
    // 尝试直接匹配大写代码
    if (INDEX_CODES[upperCode]) {
      return INDEX_CODES[upperCode].name;
    }
  }
  
  // 方法3: 如果原始名称不包含乱码字符，使用原始名称
  // 乱码通常包含 � 或显示为问号，或者包含非中文字符的异常字符
  if (fallbackName && 
      !fallbackName.includes('�') && 
      !fallbackName.includes('?') &&
      !/^[\x00-\x7F]+$/.test(fallbackName)) { // 不是纯ASCII（可能是乱码）
    // 检查是否包含中文字符
    if (/[\u4e00-\u9fa5]/.test(fallbackName)) {
      return fallbackName.trim();
    }
  }
  
  // 如果都找不到，返回空字符串，让上层逻辑处理
  return '';
};

/**
 * 解析单条指数数据
 * 根据市场类型自动判断字段索引
 */
const parseIndexLine = (line: string): TencentIndexData | null => {
  try {
    // 提取腾讯代码（如 v_sh000001）
    const codeMatch = line.match(/^v_(\w+)=/);
    const tencentCode = codeMatch ? codeMatch[1] : '';
    
    // 清理前缀和后缀，提取内容
    const content = line.replace(/^[^=]+="/, "").replace(/"$/, "").trim();
    if (!content) {
      return null;
    }
    
    const fields = content.split('~');
    
    if (fields.length < 35) {
      console.warn('数据字段不足，可能解析失败', fields.length, tencentCode);
      return null;
    }

    const marketType = fields[0];
    const rawName = (fields[1] || '').trim();
    const indexCode = fields[2] || '';
    
    // 基础价格数据（所有市场通用位置）
    const price = parseFloat(fields[3]) || 0;
    const prevClose = parseFloat(fields[4]) || 0;
    const open = parseFloat(fields[5]) || 0;
    const volume = fields[6] || '';

    // 根据市场类型确定涨跌字段索引
    // 根据实际数据验证：所有市场（A股、港股、美股）的字段索引都是一样的
    // 字段31是涨跌额，32是涨跌幅，33是最高，34是最低
    const changeIdx = 31;
    const changePercentIdx = 32;
    const highIdx = 33;
    const lowIdx = 34;

    // 提取涨跌幅数据
    let change = parseFloat(fields[changeIdx]);
    let changePercent = parseFloat(fields[changePercentIdx]);
    
    // 数据校验：如果解析失败或为空，根据价格计算
    if (isNaN(change) || (change === 0 && price && prevClose)) {
      change = price - prevClose;
    }
    if (isNaN(changePercent) || changePercent === 0) {
      changePercent = prevClose ? (change / prevClose * 100) : 0;
    }
    
    // 验证涨跌幅是否合理（避免显示异常大的值）
    if (Math.abs(changePercent) >= 100) {
      // 如果字段值异常大（可能是时间戳），回退到计算
      changePercent = prevClose ? (change / prevClose * 100) : 0;
    }
    const validChangePercent = Math.abs(changePercent) < 1000 ? changePercent : 0;

    // 提取高低点（带容错）
    const high = parseFloat(fields[highIdx]) || 0;
    const low = parseFloat(fields[lowIdx]) || 0;

    // 查找更新时间
    let updateTime: string | undefined;
    
    // 扫描字段找时间（通常在字段30附近）
    for (let i = 25; i < Math.min(35, fields.length); i++) {
      const val = fields[i];
      // 识别时间格式：A股(20260202130357)、港股(2026/02/02 11:59:59)、美股(2026-01-30 17:15:59)
      if (val && (/\d{4}[\/\-]?\d{2}[\/\-]?\d{2}/.test(val) || /^\d{14}$/.test(val))) {
        updateTime = val;
        break;
      }
    }
    
    // 查找PE：根据实际数据，A股PE在字段39，港股美股PE位置不固定，需要从后往前查找
    let pe: number | undefined;
    
    // 对于A股，PE通常在字段39
    if ((marketType === '1' || marketType === '51') && fields[39]) {
      const peVal = parseFloat(fields[39]);
      if (!isNaN(peVal) && peVal > 0 && peVal < 1000) {
        pe = peVal;
      }
    } else {
      // 港股美股：从后往前查找PE（通常在倒数第5-10个字段中）
      const endFields = fields.slice(-10);
      for (let i = endFields.length - 1; i >= 0; i--) {
        const val = endFields[i];
        if (!val) continue;
        
        // 识别PE：0-100之间的小数，且不是0也不是时间
        const numVal = parseFloat(val);
        if (!isNaN(numVal) && numVal > 0 && numVal < 100 && !/^\d{4}/.test(val)) {
          // 进一步验证：PE通常在1-50之间
          if (numVal >= 1 && numVal <= 50) {
            pe = numVal;
            break;
          }
        }
      }
    }
    
    // 验证PE是否合理
    const validPe = pe && pe > 0 && pe < 1000 ? pe : 0;

    // 查找成交额（通常在高低点之后，或者倒数第3-5位）
    let amount: string | undefined;
    // 简化的成交额查找逻辑，不同市场位置不一致
    if (marketType === '1' || marketType === '51') {
      // A股成交额通常在fields[35]附近，但位置不固定
      // 这里用正则从后匹配大数字
      for (let i = fields.length - 5; i > fields.length - 10; i--) {
        if (fields[i] && /^\d{5,}$/.test(fields[i])) {
          amount = fields[i];
          break;
        }
      }
    }

    // 使用预定义的中文名称，避免乱码
    let name = '';
    
    // 检查原始名称是否正常（包含中文且不包含乱码字符）
    const isRawNameValid = rawName && 
      rawName.length > 0 &&
      /[\u4e00-\u9fa5]/.test(rawName) && 
      !rawName.includes('�') && 
      !rawName.includes('?');
    
    // 对于港股美股，优先使用预定义名称（确保一致性）
    // 对于沪深，如果原始名称正常则使用，否则使用预定义名称
    if (tencentCode && (tencentCode.startsWith('hk') || tencentCode.startsWith('us'))) {
      // 港股美股：优先使用预定义名称
      name = getPredefinedName(tencentCode, rawName, indexCode);
      if (!name && rawName && rawName.length > 0) {
        name = rawName; // 如果预定义名称找不到，使用原始名称
      }
    } else {
      // 沪深：如果原始名称正常，直接使用
      if (isRawNameValid) {
        name = rawName;
      } else {
        // 尝试使用预定义名称
        name = getPredefinedName(tencentCode, rawName, indexCode);
        
        // 如果预定义名称也找不到，但原始名称存在，使用原始名称（即使可能有点乱码）
        if (!name && rawName && rawName.length > 0) {
          name = rawName;
        }
      }
    }
    
    // 如果还是找不到，使用代码作为名称
    if (!name) {
      name = indexCode || tencentCode;
    }

    // 对于港股美股，indexCode 是 HSI, IXIC 等，但我们需要用 tencentCode 作为唯一标识
    // 对于沪深，indexCode 是 000001, 399001 等，可以直接使用
    const finalCode = (tencentCode && (tencentCode.startsWith('hk') || tencentCode.startsWith('us'))) 
      ? tencentCode  // 港股美股使用 tencentCode
      : (indexCode || tencentCode); // 沪深使用 indexCode
    
    return {
      marketType,
      name,
      code: finalCode,
      tencentCode: tencentCode || undefined,
      price,
      prevClose,
      change,
      changePercent: validChangePercent,
      open,
      high,
      low,
      volume,
      amount,
      pe: validPe,
      updateTime,
      isUp: change >= 0
    };
  } catch (error) {
    console.error('解析单条指数数据失败:', error, line);
    return null;
  }
};

/**
 * 解析多条指数数据（分号分隔）
 * @param rawData 原始数据字符串，如 "v_sh000001="..."; v_hkHSI="...""
 */
export const parseTencentIndex = (rawData: string): TencentIndexData[] => {
  // 按 "v_" 分割多条数据，保留有效内容
  const lines = rawData
    .split(/;?\s*v_/)
    .filter(line => line.includes('=') && line.includes('~'));
  
  return lines
    .map(line => {
      // 如果行不以 v_ 开头，需要添加前缀
      if (!line.startsWith('v_')) {
        return parseIndexLine(`v_${line}`);
      }
      return parseIndexLine(line);
    })
    .filter((item): item is TencentIndexData => item !== null);
};

/**
 * 获取腾讯财经指数数据
 * 注意：腾讯财经 API 返回的是文本格式，不是 JSONP
 * API 响应头指定了 charset=GBK，浏览器会自动尝试解码
 * 即使名称字段乱码，其他字段（价格、涨跌幅等）仍可正确解析
 * 解决方案：直接获取文本，解析数据，名称乱码时用预定义名称覆盖
 */
export const fetchTencentIndices = async (codes: string[]): Promise<TencentIndexData[]> => {
  const codesStr = codes.join(',');
  const url = `https://qt.gtimg.cn/q=${codesStr}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // 直接获取文本，浏览器会根据响应头尝试解码
    // 即使名称字段乱码，其他字段（价格、涨跌幅等）仍然可以正确解析
    const text = await response.text();
    
    // 解析数据（名称字段可能乱码，但其他字段正常）
    const result = parseTencentIndex(text);
    
    // 使用预定义名称覆盖可能的乱码名称
    // 通过 tencentCode 和 indexCode 匹配预定义名称
    const finalResult = result.map((item) => {
      const tencentCode = (item as any).tencentCode || '';
      
      // 检查名称是否乱码或无效
      // 对于港股美股，名称可能是英文（如 "Hang Seng Index"），这是正常的，不应该被判定为乱码
      const isGarbled = 
        item.name.includes('�') || 
        item.name.includes('?') ||
        (!/[\u4e00-\u9fa5]/.test(item.name) && 
         item.name !== item.code && 
         !item.name.match(/^[A-Z][a-zA-Z\s]+$/) && // 允许英文名称（如 "Hang Seng Index"）
         !item.name.match(/^[A-Z]+$/)); // 允许纯大写字母（如 "HSI"）
      
      // 如果名称乱码或无效，使用预定义名称
      if (isGarbled || !item.name || item.name.trim().length === 0) {
        // 优先使用 tencentCode 匹配，如果没有则使用 code
        const predefinedName = 
          (tencentCode && getPredefinedName(tencentCode, item.name, item.code)) ||
          getPredefinedName(item.code, item.name, item.code);
        
        if (predefinedName) {
          return { ...item, name: predefinedName };
        }
      }
      
      // 对于港股美股，即使名称是中文，也优先使用预定义名称（确保一致性）
      // 这样可以确保显示统一的名称（如 '恒生国企' 而不是 '国企指数'）
      if (tencentCode && (tencentCode.startsWith('hk') || tencentCode.startsWith('us'))) {
        // 优先使用 tencentCode 匹配预定义名称
        const predefinedName = getPredefinedName(tencentCode, item.name, item.code);
        
        if (predefinedName && predefinedName !== item.name) {
          return { ...item, name: predefinedName };
        }
        
        // 如果 tencentCode 匹配失败，尝试使用 code（可能是 HSI, IXIC 等）
        if (!predefinedName) {
          const fallbackName = getPredefinedName(item.code, item.name, item.code);
          if (fallbackName && fallbackName !== item.name) {
            return { ...item, name: fallbackName };
          }
        }
      }
      
      // 即使名称不是乱码，如果是英文名称，也尝试用预定义的中文名称覆盖
      // 这样可以确保显示中文名称
      if (!/[\u4e00-\u9fa5]/.test(item.name) && item.name.match(/^[A-Z][a-zA-Z\s]+$/)) {
        const predefinedName = 
          (tencentCode && getPredefinedName(tencentCode, item.name, item.code)) ||
          getPredefinedName(item.code, item.name, item.code);
        
        if (predefinedName) {
          return { ...item, name: predefinedName };
        }
      }
      
      return item;
    });
    
    // 去重：根据 code 和 tencentCode 去重
    const uniqueResult = finalResult.reduce((acc, current) => {
      // 使用 code 或 tencentCode 作为唯一标识
      const currentId = (current as any).tencentCode || current.code;
      const existing = acc.find(item => {
        const itemId = (item as any).tencentCode || item.code;
        return itemId === currentId;
      });
      
      if (!existing) {
        acc.push(current);
      } else {
        // 如果已存在，保留名称更完整的（优先保留有中文名称的）
        if (/[\u4e00-\u9fa5]/.test(current.name) && !/[\u4e00-\u9fa5]/.test(existing.name)) {
          const index = acc.indexOf(existing);
          acc[index] = current;
        }
      }
      return acc;
    }, [] as TencentIndexData[]);
    
    return uniqueResult;
  } catch (error) {
    console.error('获取腾讯指数数据失败:', error);
    throw error;
  }
};
