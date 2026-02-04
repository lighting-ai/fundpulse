// 东方财富基金 API 封装
import { buildJsonpApiUrl } from '../utils/apiUtils';

// 全局错误处理：捕获脚本语法错误
if (typeof window !== 'undefined') {
  const originalErrorHandler = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    // 如果是来自 FundArchivesDatas 的脚本错误，记录但不中断流程
    if (source && source.includes('FundArchivesDatas.aspx')) {
      console.warn('基金数据脚本加载错误（可能为网络问题）:', message);
      return true; // 阻止默认错误处理
    }
    // 其他错误正常处理
    if (originalErrorHandler) {
      return originalErrorHandler(message, source, lineno, colno, error);
    }
    return false;
  };
}

export interface RealtimeData {
  code: string;
  name: string;
  nav: number; // 最新净值
  estimateNav: number; // 估算净值（盘中实时）
  estimateGrowth: number; // 估算涨跌幅 %
  valuationTime: string; // 估值时间
}

export interface NavHistoryItem {
  date: string; // YYYY-MM-DD
  nav: number;
  accNav: number;
  dailyGrowth?: number;
}

export interface NavHistoryListItem {
  date: string; // YYYY-MM-DD
  nav: number; // 单位净值
  accNav: number; // 累计净值
  dailyGrowth: number; // 日增长率 %
  purchaseStatus: string; // 申购状态
  redemptionStatus: string; // 赎回状态
}

// JSONP 请求队列，处理并发请求
const jsonpQueue: Array<{
  code: string;
  resolve: (data: RealtimeData) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}> = [];

// 全局回调函数（东方财富固定使用 jsonpgz）
(window as any).jsonpgz = (data: any) => {
  if (jsonpQueue.length === 0) {
    console.warn('收到 JSONP 响应但没有待处理的请求');
    return;
  }

  if (!data || typeof data !== 'object' || !data.fundcode) {
    console.warn('JSONP 响应数据格式错误:', data);
    const firstRequest = jsonpQueue.shift();
    if (firstRequest) {
      clearTimeout(firstRequest.timeout);
      firstRequest.reject(new Error('数据格式错误'));
    }
    return;
  }

  // 根据返回的基金代码查找匹配的请求（而不是按顺序处理）
  const fundCode = data.fundcode;
  const requestIndex = jsonpQueue.findIndex((r) => r.code === fundCode);
  
  if (requestIndex === -1) {
    console.warn(`收到未匹配的基金代码: ${fundCode}，当前队列:`, jsonpQueue.map(r => r.code));
    return;
  }

  const request = jsonpQueue[requestIndex];
  // 从队列中移除这个请求
  jsonpQueue.splice(requestIndex, 1);
  clearTimeout(request.timeout);

  // 清理脚本标签
  const scripts = document.querySelectorAll(`script[src*="${fundCode}.js"]`);
  scripts.forEach((script) => {
    try {
      document.body.removeChild(script);
    } catch (e) {
      // ignore
    }
  });

  // 解析并返回数据
  const result = {
    code: fundCode,
    name: data.name || '',
    nav: parseFloat(data.dwjz) || 0, // dwjz: 昨日收盘净值
    estimateNav: parseFloat(data.gsz) || 0, // gsz: 估算净值（盘中实时）
    estimateGrowth: parseFloat(data.gszzl) || 0, // gszzl: 估算涨跌幅 %
    valuationTime: data.gztime || '', // 估值时间
  };
  
  request.resolve(result);
};

/**
 * 获取基金实时估值（JSONP）
 * 注意：东方财富 API 固定使用 jsonpgz 作为回调函数名
 */
export const fetchFundRealtime = async (code: string): Promise<RealtimeData> => {
  return new Promise((resolve, reject) => {
    // 添加到队列
    const timeout = setTimeout(() => {
      const index = jsonpQueue.findIndex((r) => r.code === code);
      if (index !== -1) {
        jsonpQueue.splice(index, 1);
        reject(new Error('请求超时'));
      }
    }, 10000);

    jsonpQueue.push({
      code,
      resolve,
      reject,
      timeout,
    });

    // 动态创建 script 标签
    const script = document.createElement('script');
    const url = buildJsonpApiUrl(
      `https://fundgz.1234567.com.cn/js/${code}.js`,
      `/api/fund-realtime/${code}.js`,
      { rt: Date.now().toString() }
    );
    script.src = url;
    script.onerror = () => {
      const index = jsonpQueue.findIndex((r) => r.code === code);
      if (index !== -1) {
        jsonpQueue.splice(index, 1);
        clearTimeout(timeout);
        reject(new Error('网络错误'));
      }
    };
    document.body.appendChild(script);
  });
};

/**
 * 获取原始的 Data_netWorthTrend 数据（不转换格式）
 * 用于 FundDataManager 进行盘中和盘后的数据融合
 */
// 请求队列：确保同一时间只有一个请求在处理，避免全局变量冲突
let isProcessingRequest = false;
const netWorthTrendRequestQueue: Array<{
  code: string;
  resolve: (data: Array<{ x: number; y: number; equityReturn?: number }>) => void;
  reject: (error: Error) => void;
}> = [];

/**
 * 处理队列中的下一个请求
 */
const processNextRequest = async () => {
  if (isProcessingRequest || netWorthTrendRequestQueue.length === 0) {
    return;
  }
  
  isProcessingRequest = true;
  const request = netWorthTrendRequestQueue.shift()!;
  const { code, resolve, reject } = request;
  
  try {
    const data = await fetchNetWorthTrendInternal(code);
    resolve(data);
  } catch (error) {
    reject(error instanceof Error ? error : new Error('未知错误'));
  } finally {
    isProcessingRequest = false;
    // 处理下一个请求
    processNextRequest();
  }
};

/**
 * 内部实现：实际执行单个请求
 */
const fetchNetWorthTrendInternal = async (code: string): Promise<Array<{ x: number; y: number; equityReturn?: number }>> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    
    // 增加超时时间到 30 秒
    const timeout = setTimeout(() => {
      try {
        if (script.parentNode) {
          document.body.removeChild(script);
        }
      } catch (e) {
        // ignore
      }
      reject(new Error('请求超时'));
    }, 30000);
    
    // 保存脚本 URL，用于验证数据来源（开发环境使用原始 URL）
    const scriptUrl = buildJsonpApiUrl(
      `https://fund.eastmoney.com/pingzhongdata/${code}.js`,
      `/api/fund-pingzhongdata/${code}.js`,
      {}
    );
    let dataLoaded = false;
    
    script.onerror = (error) => {
      clearTimeout(timeout);
      try {
        if (script.parentNode) {
          document.body.removeChild(script);
        }
      } catch (e) {
        // ignore
      }
      reject(new Error(`网络错误: ${error}`));
    };
    
    script.onload = () => {
      // 脚本加载完成后，立即读取数据
      // 使用递归检查，确保脚本完全执行
      const checkData = (attempt: number) => {
        if (dataLoaded) return;
        
        // 验证 script.src 是否包含当前基金代码（确保数据来源正确）
        const currentScriptSrc = script.src || '';
        if (!currentScriptSrc.includes(code)) {
          // 脚本 URL 不匹配，可能是其他基金的脚本，继续等待
          if (attempt < 100) { // 最多等待 10 秒（100 * 100ms）
            setTimeout(() => checkData(attempt + 1), 100);
          } else {
            clearTimeout(timeout);
            try {
              if (script.parentNode) {
                document.body.removeChild(script);
              }
            } catch (e) {
              // ignore
            }
            reject(new Error(`数据加载超时：脚本 URL 不匹配`));
          }
          return;
        }
        
        // 读取全局变量中的数据
        // 由于使用了请求队列，同一时间只有一个请求在处理，所以全局变量应该是当前脚本设置的值
        const data = (window as any).Data_netWorthTrend;
        
        if (data && Array.isArray(data) && data.length > 0) {
          // 立即解析并保存数据，避免被后续脚本覆盖
          try {
            const trend: Array<{ x: number; y: number; equityReturn?: number }> = [];
            // 深拷贝数据，避免引用全局变量
            data.forEach((item: any) => {
              if (item && typeof item === 'object' && item.x && item.y) {
                trend.push({
                  x: item.x,
                  y: parseFloat(item.y) || 0,
                  equityReturn: item.equityReturn ? parseFloat(item.equityReturn) : undefined,
                });
              }
            });
            
            if (trend.length > 0 && !dataLoaded) {
              dataLoaded = true;
              clearTimeout(timeout);
              
              try {
                if (script.parentNode) {
                  document.body.removeChild(script);
                }
              } catch (e) {
                // ignore
              }
              
              // 立即 resolve，使用深拷贝的数据，不依赖全局变量
              resolve(trend);
            }
          } catch (e) {
            if (attempt < 100) {
              setTimeout(() => checkData(attempt + 1), 100);
            } else {
              clearTimeout(timeout);
              try {
                if (script.parentNode) {
                  document.body.removeChild(script);
                }
              } catch (e) {
                // ignore
              }
              reject(e);
            }
          }
        } else {
          // 数据还未准备好，继续检查
          if (attempt < 100) {
            setTimeout(() => checkData(attempt + 1), 100);
          } else {
            clearTimeout(timeout);
            try {
              if (script.parentNode) {
                document.body.removeChild(script);
              }
            } catch (e) {
              // ignore
            }
            reject(new Error(`数据加载超时：数据格式错误或为空`));
          }
        }
      };
      
      // 开始检查数据（延迟 100ms 让脚本执行完成）
      setTimeout(() => checkData(0), 100);
    };
    
    const url = `${scriptUrl}?v=${Date.now()}`;
    script.src = url;
    
    document.body.appendChild(script);
  });
};

/**
 * 获取原始的 Data_netWorthTrend 数据（不转换格式）
 * 用于 FundDataManager 进行盘中和盘后的数据融合
 * 
 * 重要：每个基金的数据独立处理，使用请求队列确保同一时间只有一个请求在处理
 * 避免全局变量冲突导致的数据混乱
 */
export const fetchNetWorthTrend = async (code: string): Promise<Array<{ x: number; y: number; equityReturn?: number }>> => {
  return new Promise((resolve, reject) => {
    // 将请求加入队列
    netWorthTrendRequestQueue.push({ code, resolve, reject });
    // 尝试处理队列
    processNextRequest();
  });
};

/**
 * 获取基金历史净值（通过 script 标签加载 JS 文件）
 */
export const fetchFundHistory = async (code: string): Promise<NavHistoryItem[]> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    
    const timeout = setTimeout(() => {
      try {
        document.body.removeChild(script);
      } catch (e) {
        // ignore
      }
      reject(new Error('请求超时'));
    }, 10000);
    
    // 保存原始全局变量
    const originalVar = (window as any).Data_netWorthTrend;
    
    let dataLoaded = false;
    let checkCount = 0;
    const maxChecks = 100;
    
    const checkInterval = setInterval(() => {
      checkCount++;
      const data = (window as any).Data_netWorthTrend;
      
      if (data && data !== originalVar && !dataLoaded) {
        if (checkCount < 3) {
          return;
        }
        
        dataLoaded = true;
        clearInterval(checkInterval);
        clearTimeout(timeout);
        
        try {
          document.body.removeChild(script);
        } catch (e) {
          // ignore
        }
        
        try {
          const history: NavHistoryItem[] = [];
          if (Array.isArray(data)) {
            data.forEach((item: any) => {
              if (item && typeof item === 'object' && item.x) {
                // 修复时区问题：时间戳转换为日期字符串
                // 时间戳应该按照本地时区解析（因为基金数据通常按本地日期）
                const timestamp = item.x;
                const dateObj = new Date(timestamp);
                
                // 使用本地时区方法获取年月日（因为基金净值日期通常是按本地日期）
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');
                const date = `${year}-${month}-${day}`;
                
                const nav = parseFloat(item.y) || 0;
                const accNav = parseFloat(item.acc) || nav;
                const dailyGrowth = item.equityReturn ? parseFloat(item.equityReturn) : undefined;
                
                if (date && nav > 0) {
                  history.push({ date, nav, accNav, dailyGrowth });
                }
              }
            });
          }
          
          // 恢复原始值
          if (originalVar !== undefined) {
            (window as any).Data_netWorthTrend = originalVar;
          } else {
            const descriptor = Object.getOwnPropertyDescriptor(window, 'Data_netWorthTrend');
            if (descriptor && descriptor.configurable) {
              delete (window as any).Data_netWorthTrend;
            }
          }
          
          resolve(history);
        } catch (e) {
          // 恢复原始值
          if (originalVar !== undefined) {
            (window as any).Data_netWorthTrend = originalVar;
          } else {
            const descriptor = Object.getOwnPropertyDescriptor(window, 'Data_netWorthTrend');
            if (descriptor && descriptor.configurable) {
              delete (window as any).Data_netWorthTrend;
            }
          }
          reject(e);
        }
      }
      
      if (checkCount >= maxChecks) {
        clearInterval(checkInterval);
        clearTimeout(timeout);
        try {
          document.body.removeChild(script);
        } catch (e) {
          // ignore
        }
        reject(new Error('数据加载超时'));
      }
    }, 100);
    
    script.onerror = () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
      try {
        document.body.removeChild(script);
      } catch (e) {
        // ignore
      }
      reject(new Error('网络错误'));
    };
    
    const url = buildJsonpApiUrl(
      `https://fund.eastmoney.com/pingzhongdata/${code}.js`,
      `/api/fund-pingzhongdata/${code}.js`,
      { v: Date.now().toString() }
    );
    script.src = url;
    document.body.appendChild(script);
  });
};

/**
 * 格式化股票代码为 secids 格式 (0.代码=深市, 1.代码=沪市)
 * 科创板(688开头)、沪市主板(600/601/603开头) -> 1.
 * 创业板(300/301开头)、深市主板(000/001/002开头) -> 0.
 * 北交所(8/4开头) -> 0.
 */
const formatSecid = (code: string): string => {
  const trimmed = code.trim();
  // 沪市：6开头（600/601/603/688等）、5开头
  if (trimmed.startsWith('6') || trimmed.startsWith('5')) {
    return `1.${trimmed}`;
  }
  // 深市：0开头（000/001/002/300/301等）、8开头、4开头
  return `0.${trimmed}`;
};

/**
 * 解析 HTML 表格提取持仓数据
 */
const parseHoldingsFromHTML = (html: string): Array<{ stockCode: string; stockName: string; ratio: number }> => {
  const holdings: Array<{ stockCode: string; stockName: string; ratio: number }> = [];
  
  try {
    // 创建临时 DOM 元素来解析 HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // 查找第一个表格（最新的季度数据）
    const tables = tempDiv.querySelectorAll('table');
    if (tables.length === 0) {
      return holdings;
    }
    
    const firstTable = tables[0];
    const rows = firstTable.querySelectorAll('tbody tr');
    
    rows.forEach((row) => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 7) {
        // 表格结构：序号 | 股票代码 | 股票名称 | 最新价 | 涨跌幅 | 相关资讯 | 占净值比例 | ...
        // 或者：序号 | 股票代码 | 股票名称 | 相关资讯 | 占净值比例 | ...
        
        // 尝试从不同位置提取数据
        let stockCode = '';
        let stockName = '';
        let ratio = 0;
        
        // 方法1：从链接中提取股票代码（更可靠）
        const codeLink = cells[1]?.querySelector('a');
        if (codeLink) {
          const href = codeLink.getAttribute('href') || '';
          // 从链接中提取代码，如 /unify/r/1.600183 -> 600183 或 /unify/r/0.300308 -> 300308
          const match = href.match(/\/unify\/r\/\d+\.(\d+)$/);
          if (match && match[1]) {
            stockCode = match[1]; // 提取股票代码部分（纯数字）
          } else {
            // 如果没有匹配，尝试从链接文本提取
            stockCode = codeLink.textContent?.trim() || '';
          }
        } else {
          // 如果没有链接，直接从单元格文本提取
          stockCode = cells[1]?.textContent?.trim() || '';
        }
        
        // 清理股票代码（去除可能的非数字字符）
        stockCode = stockCode.replace(/[^\d]/g, '');
        
        // 提取股票名称
        const nameLink = cells[2]?.querySelector('a');
        if (nameLink) {
          stockName = nameLink.textContent?.trim() || '';
        } else {
          stockName = cells[2]?.textContent?.trim() || '';
        }
        
        // 提取占净值比例（可能在索引6或4，取决于表格结构）
        let ratioText = '';
        if (cells.length >= 7) {
          // 有"最新价"和"涨跌幅"列的情况
          ratioText = cells[6]?.textContent?.trim() || '';
        } else if (cells.length >= 5) {
          // 没有"最新价"和"涨跌幅"列的情况
          ratioText = cells[4]?.textContent?.trim() || '';
        }
        
        // 解析比例（去除%符号）
        ratio = parseFloat(ratioText.replace('%', '')) || 0;
        
        if (stockCode && stockName && ratio > 0) {
          holdings.push({ stockCode, stockName, ratio });
        }
      }
    });
  } catch (error) {
    console.error('解析 HTML 表格失败:', error);
  }
  
  return holdings;
};

/**
 * 解析 HTML 表格提取基金基本概况数据
 */
const parseFundBasicInfoFromHTML = (html: string): {
  fundName: string;
  manager: string;
  company: string;
  inceptionDate: string;
} => {
  const result = {
    fundName: '',
    manager: '',
    company: '',
    inceptionDate: '',
  };
  
  try {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // 查找表格
    const tables = tempDiv.querySelectorAll('table');
    if (tables.length === 0) {
      return result;
    }
    
    // 遍历所有表格行，查找关键信息
    tables.forEach((table) => {
      const rows = table.querySelectorAll('tbody tr, tr');
      rows.forEach((row) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const label = cells[0]?.textContent?.trim() || '';
          const value = cells[1]?.textContent?.trim() || '';
          
          // 匹配不同的字段
          if (label.includes('基金全称') || label.includes('基金简称')) {
            if (!result.fundName && value) {
              result.fundName = value;
            }
          } else if (label.includes('基金经理') || label.includes('基金经理人')) {
            if (!result.manager && value) {
              // 可能包含链接，提取文本
              const link = cells[1]?.querySelector('a');
              result.manager = link ? link.textContent?.trim() || value : value;
            }
          } else if (label.includes('基金管理人') || label.includes('管理公司')) {
            if (!result.company && value) {
              // 可能包含链接，提取文本
              const link = cells[1]?.querySelector('a');
              result.company = link ? link.textContent?.trim() || value : value;
            }
          } else if (label.includes('成立日期')) {
            if (!result.inceptionDate && value) {
              result.inceptionDate = value;
            }
          }
        }
      });
    });
  } catch (error) {
    console.error('解析基金基本概况 HTML 失败:', error);
  }
  
  return result;
};

/**
 * 获取基金基本概况数据（从 FundArchivesDatas.aspx?type=jbgk）
 * 使用 JSONP 形式加载
 * 
 * 注意：此接口不稳定，已移除使用，仅保留代码作为参考
 * @deprecated 已改用 pingzhongdata 接口
 */
// @ts-expect-error - 保留代码作为参考，但不再使用
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const fetchFundBasicInfoFromJBGK = async (
  fundCode: string
): Promise<{
  fundName: string;
  manager: string;
  company: string;
  inceptionDate: string;
}> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const requestId = `jbgk_${fundCode}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 保存原始的 apidata，避免被其他请求覆盖
    const originalApidata = (window as any).apidata;
    
    const cleanup = () => {
      try {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      } catch (e) {
        // ignore
      }
      // 清理标记
      try {
        const apidata = (window as any).apidata;
        if (apidata && apidata[requestId]) {
          delete apidata[requestId];
        }
      } catch (e) {
        // ignore
      }
    };
    
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('获取基金基本概况数据超时'));
    }, 20000); // 增加超时时间到20秒
    
    // 监听全局变量 apidata
    let checkCount = 0;
    const maxChecks = 200; // 增加检查次数
    
    const checkInterval = setInterval(() => {
      checkCount++;
      const apidata = (window as any).apidata;
      
      // 检查是否有新的 apidata，且未被当前请求处理过
      if (apidata && apidata.content && apidata !== originalApidata && !apidata[requestId]) {
        // 验证是否是基本概况数据（通过检查 content 中是否包含基本概况相关的关键词）
        const contentStr = String(apidata.content || '').toLowerCase();
        const isBasicInfoData = contentStr.includes('基金全称') || 
                               contentStr.includes('基金简称') || 
                               contentStr.includes('基金经理') ||
                               contentStr.includes('基金管理人') ||
                               contentStr.includes('成立日期');
        
        if (isBasicInfoData) {
          apidata[requestId] = true; // 标记已处理，避免重复处理
          clearInterval(checkInterval);
          clearTimeout(timeout);
          cleanup();
          
          try {
            // 解析 HTML 表格提取基本概况数据
            const basicInfo = parseFundBasicInfoFromHTML(apidata.content);
            
            if (basicInfo.fundName || basicInfo.manager || basicInfo.company || basicInfo.inceptionDate) {
              console.log(`成功解析基金 ${fundCode} 的基本概况数据`);
              resolve(basicInfo);
            } else {
              reject(new Error('未能从 HTML 中提取基本概况数据'));
            }
          } catch (e) {
            console.error('解析基本概况数据失败:', e);
            reject(e);
          }
        }
      }
      
      if (checkCount >= maxChecks) {
        clearInterval(checkInterval);
        clearTimeout(timeout);
        cleanup();
        reject(new Error('数据加载超时'));
      }
    }, 100);
    
    script.onerror = () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
      cleanup();
      reject(new Error('加载基本概况数据失败'));
    };
    
    // 捕获脚本执行错误
    script.onload = () => {
      // 脚本加载完成，但可能包含语法错误
      // 通过检查 apidata 来判断是否成功
      setTimeout(() => {
        const apidata = (window as any).apidata;
        if (!apidata || !apidata.content) {
          // 如果脚本加载后没有设置 apidata，可能是语法错误
          console.warn('脚本加载完成但未设置 apidata，可能包含语法错误');
        }
      }, 1000);
    };
    
    // 使用 try-catch 包裹脚本添加，捕获可能的错误
    try {
      // 东方财富 F10 基本概况接口（返回包含 HTML 的 JavaScript 变量）
      const url = buildJsonpApiUrl(
        `https://fundf10.eastmoney.com/FundArchivesDatas.aspx`,
        `/api/fund-archives`,
        { type: 'jbgk', code: fundCode, t: Date.now().toString() }
      );
      script.src = url;
      document.body.appendChild(script);
    } catch (e) {
      clearInterval(checkInterval);
      clearTimeout(timeout);
      cleanup();
      reject(new Error('添加脚本失败'));
    }
  });
};

/**
 * 步骤1：获取基金持仓基础信息（名称+占比）
 * 使用 FundArchivesDatas.aspx?type=jjcc 接口
 * 注意：该接口返回的是包含 HTML 表格的 JavaScript 变量
 */
const fetchHoldingsBasic = async (
  fundCode: string
): Promise<Array<{ stockCode: string; stockName: string; ratio: number }>> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const requestId = `jjcc_${fundCode}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 保存原始的 apidata，避免被其他请求覆盖
    const originalApidata = (window as any).apidata;
    
    const cleanup = () => {
      try {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      } catch (e) {
        // ignore
      }
      // 清理标记
      try {
        const apidata = (window as any).apidata;
        if (apidata && apidata[requestId]) {
          delete apidata[requestId];
        }
      } catch (e) {
        // ignore
      }
    };
    
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('获取持仓数据超时'));
    }, 20000); // 增加超时时间到20秒
    
    // 监听全局变量 apidata
    let checkCount = 0;
    const maxChecks = 200; // 增加检查次数
    
    const checkInterval = setInterval(() => {
      checkCount++;
      const apidata = (window as any).apidata;
      
      // 检查是否有新的 apidata，且未被当前请求处理过
      // 同时检查 content 中是否包含持仓相关的关键词（如"股票代码"、"占净值比例"等）
      if (apidata && apidata.content && apidata !== originalApidata && !apidata[requestId]) {
        // 验证是否是持仓数据（通过检查 content 中是否包含持仓相关的关键词）
        const contentStr = String(apidata.content || '').toLowerCase();
        const isHoldingsData = contentStr.includes('股票代码') || 
                              contentStr.includes('占净值比例') || 
                              contentStr.includes('持仓') ||
                              contentStr.includes('股票名称');
        
        if (isHoldingsData) {
          apidata[requestId] = true; // 标记已处理，避免重复处理
          clearInterval(checkInterval);
          clearTimeout(timeout);
          cleanup();
          
          try {
            // 解析 HTML 表格提取持仓数据
            const holdings = parseHoldingsFromHTML(apidata.content);
            
            if (holdings.length > 0) {
              console.log(`成功解析基金 ${fundCode} 的持仓数据:`, holdings.length, '条');
              resolve(holdings);
            } else {
              reject(new Error('未能从 HTML 中提取持仓数据'));
            }
          } catch (e) {
            console.error('解析持仓数据失败:', e);
            reject(e);
          }
        }
      }
      
      if (checkCount >= maxChecks) {
        clearInterval(checkInterval);
        clearTimeout(timeout);
        cleanup();
        reject(new Error('数据加载超时'));
      }
    }, 100);
    
    script.onerror = () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
      cleanup();
      reject(new Error('加载持仓数据失败'));
    };
    
    // 捕获脚本执行错误
    script.onload = () => {
      // 脚本加载完成，但可能包含语法错误
      // 通过检查 apidata 来判断是否成功
      setTimeout(() => {
        const apidata = (window as any).apidata;
        if (!apidata || !apidata.content) {
          // 如果脚本加载后没有设置 apidata，可能是语法错误
          console.warn('脚本加载完成但未设置 apidata，可能包含语法错误');
        }
      }, 1000);
    };
    
    // 使用 try-catch 包裹脚本添加，捕获可能的错误
    try {
      // 东方财富 F10 持仓接口（返回包含 HTML 的 JavaScript 变量）
      const url = buildJsonpApiUrl(
        `https://fundf10.eastmoney.com/FundArchivesDatas.aspx`,
        `/api/fund-archives`,
        { type: 'jjcc', code: fundCode, topline: '10', t: Date.now().toString() }
      );
      script.src = url;
      document.body.appendChild(script);
    } catch (e) {
      clearInterval(checkInterval);
      clearTimeout(timeout);
      cleanup();
      reject(new Error('添加脚本失败'));
    }
  });
};

/**
 * 步骤2：批量获取股票实时行情（涨跌幅）
 * 使用 push2.eastmoney.com/api/qt/ulist.np/get 接口（支持跨域）
 */
const fetchStocksRealtime = async (
  stockCodes: string[]
): Promise<Map<string, { changePercent: number }>> => {
  if (stockCodes.length === 0) {
    return new Map();
  }
  
  const secids = stockCodes.map(code => formatSecid(code)).join(',');
  const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f2,f3,f12,f14&secids=${secids}&_=${Date.now()}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    const realtimeMap = new Map<string, { changePercent: number }>();
    if (data.data?.diff && Array.isArray(data.data.diff)) {
      data.data.diff.forEach((item: any) => {
        const code = String(item.f12 || '');
        if (code) {
          realtimeMap.set(code, {
            changePercent: parseFloat(item.f3) || 0, // f3: 涨跌幅%
          });
        }
      });
    }
    
    return realtimeMap;
  } catch (error) {
    console.error('获取股票实时行情失败:', error);
    return new Map();
  }
};

/**
 * 从 pingzhongdata 获取基金基本信息（备用方案）
 */
// 基金概况数据结构定义
export interface FundManagerInfo {
  id: string;
  pic: string;
  name: string;
  star: number;
  workTime: string;
  fundSize: string;
  power: {
    avr: string;
    categories: string[];
    dsc: string[];
    data: number[];
    jzrq: string;
  };
  profit: {
    categories: string[];
    series: Array<{
      data: Array<{
        name: string | null;
        color: string;
        y: number;
      }>;
    }>;
    jzrq: string;
  };
}

export interface PerformanceEvaluation {
  avr: string;
  categories: string[];
  dsc: string[];
  data: number[];
}

export interface HolderStructure {
  series: Array<{
    name: string;
    data: number[];
  }>;
  categories: string[];
}

export interface AssetAllocation {
  series: Array<{
    name: string;
    type: string | null;
    data: number[];
    yAxis: number;
  }>;
  categories: string[];
}

export interface FundOverviewData {
  currentFundManager: FundManagerInfo[];
  performanceEvaluation: PerformanceEvaluation | null;
  holderStructure: HolderStructure | null;
  assetAllocation: AssetAllocation | null;
}

const fetchFundBasicInfoFromPingzhong = async (
  code: string
): Promise<{
  fundName: string;
  manager: string;
  company: string;
  inceptionDate: string;
}> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    
    const timeout = setTimeout(() => {
      try {
        document.body.removeChild(script);
      } catch (e) {
        // ignore
      }
      reject(new Error('获取基金基本信息超时'));
    }, 10000);
    
    const originalVars = {
      fS_name: (window as any).fS_name,
      fS_manager: (window as any).fS_manager,
      fS_fundCompany: (window as any).fS_fundCompany,
      fS_establishDate: (window as any).fS_establishDate,
    };
    
    let dataLoaded = false;
    let checkCount = 0;
    const maxChecks = 100;
    
    const checkInterval = setInterval(() => {
      checkCount++;
      const name = (window as any).fS_name;
      
      if (name && name !== originalVars.fS_name && !dataLoaded) {
        if (checkCount < 5) {
          return;
        }
        
        dataLoaded = true;
        clearInterval(checkInterval);
        clearTimeout(timeout);
        
        try {
          document.body.removeChild(script);
        } catch (e) {
          // ignore
        }
        
        const fundName = (window as any).fS_name || '';
        const manager = (window as any).fS_manager || '';
        const company = (window as any).fS_fundCompany || '';
        const inceptionDate = (window as any).fS_establishDate || '';
        
        // 恢复原始值
        Object.keys(originalVars).forEach((key) => {
          try {
            if (originalVars[key as keyof typeof originalVars] !== undefined) {
              (window as any)[key] = originalVars[key as keyof typeof originalVars];
            } else {
              const descriptor = Object.getOwnPropertyDescriptor(window, key);
              if (descriptor && descriptor.configurable) {
                delete (window as any)[key];
              }
            }
          } catch (e) {
            // ignore
          }
        });
        
        resolve({ fundName, manager, company, inceptionDate });
      }
      
      if (checkCount >= maxChecks) {
        clearInterval(checkInterval);
        clearTimeout(timeout);
        try {
          document.body.removeChild(script);
        } catch (e) {
          // ignore
        }
        reject(new Error('数据加载超时'));
      }
    }, 100);
    
    script.onerror = () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
      try {
        document.body.removeChild(script);
      } catch (e) {
        // ignore
      }
      reject(new Error('网络错误'));
    };
    
    const url = buildJsonpApiUrl(
      `https://fund.eastmoney.com/pingzhongdata/${code}.js`,
      `/api/fund-pingzhongdata/${code}.js`,
      { v: Date.now().toString() }
    );
    script.src = url;
    document.body.appendChild(script);
  });
};

/**
 * 从 pingzhongdata 接口获取基金概况数据
 * 包括：现任基金经理、业绩评价、持有人结构、资产配置
 */
export const fetchFundOverviewData = async (code: string): Promise<FundOverviewData> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    
    const timeout = setTimeout(() => {
      try {
        document.body.removeChild(script);
      } catch (e) {
        // ignore
      }
      reject(new Error('获取基金概况数据超时'));
    }, 15000);
    
    // 保存原始变量值
    const originalVars = {
      Data_currentFundManager: (window as any).Data_currentFundManager,
      Data_performanceEvaluation: (window as any).Data_performanceEvaluation,
      Data_holderStructure: (window as any).Data_holderStructure,
      Data_assetAllocation: (window as any).Data_assetAllocation,
    };
    
    let dataLoaded = false;
    let checkCount = 0;
    const maxChecks = 150;
    
    const checkInterval = setInterval(() => {
      checkCount++;
      
      // 检查数据是否已加载（至少有一个数据存在）
      const hasData = 
        (window as any).Data_currentFundManager ||
        (window as any).Data_performanceEvaluation ||
        (window as any).Data_holderStructure ||
        (window as any).Data_assetAllocation;
      
      if (hasData && !dataLoaded) {
        if (checkCount < 10) {
          return; // 等待数据完全加载
        }
        
        dataLoaded = true;
        clearInterval(checkInterval);
        clearTimeout(timeout);
        
        try {
          document.body.removeChild(script);
        } catch (e) {
          // ignore
        }
        
        // 提取数据
        const currentFundManager = (window as any).Data_currentFundManager || [];
        const performanceEvaluation = (window as any).Data_performanceEvaluation || null;
        const holderStructure = (window as any).Data_holderStructure || null;
        const assetAllocation = (window as any).Data_assetAllocation || null;
        
        // 恢复原始值
        Object.keys(originalVars).forEach((key) => {
          try {
            if (originalVars[key as keyof typeof originalVars] !== undefined) {
              (window as any)[key] = originalVars[key as keyof typeof originalVars];
            } else {
              const descriptor = Object.getOwnPropertyDescriptor(window, key);
              if (descriptor && descriptor.configurable) {
                delete (window as any)[key];
              }
            }
          } catch (e) {
            // ignore
          }
        });
        
        resolve({
          currentFundManager: Array.isArray(currentFundManager) ? currentFundManager : [],
          performanceEvaluation,
          holderStructure,
          assetAllocation,
        });
      }
      
      if (checkCount >= maxChecks) {
        clearInterval(checkInterval);
        clearTimeout(timeout);
        try {
          document.body.removeChild(script);
        } catch (e) {
          // ignore
        }
        // 即使超时也返回空数据，不阻塞UI
        resolve({
          currentFundManager: [],
          performanceEvaluation: null,
          holderStructure: null,
          assetAllocation: null,
        });
      }
    }, 100);
    
    script.onerror = () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
      try {
        document.body.removeChild(script);
      } catch (e) {
        // ignore
      }
      // 网络错误时返回空数据，不阻塞UI
      resolve({
        currentFundManager: [],
        performanceEvaluation: null,
        holderStructure: null,
        assetAllocation: null,
      });
    };
    
    const url = buildJsonpApiUrl(
      `https://fund.eastmoney.com/pingzhongdata/${code}.js`,
      `/api/fund-pingzhongdata/${code}.js`,
      { v: Date.now().toString() }
    );
    script.src = url;
    document.body.appendChild(script);
  });
};

// 请求队列，避免并发冲突
const requestQueue = new Map<string, Promise<any>>();

/**
 * 获取基金详情（包含重仓股）- 使用新的API方案
 * 1. 从 pingzhongdata 获取基金基本信息（jbgk 接口不稳定，已移除）
 * 2. 从 FundArchivesDatas.aspx?type=jjcc 获取持仓信息（名称+占比）
 * 3. 从 push2.eastmoney.com 获取股票实时涨跌幅
 * 
 * 注意：持仓数据获取失败不会影响基本信息返回
 * 使用请求队列避免同一基金代码的并发请求冲突
 */
export const fetchFundDetail = async (code: string): Promise<{
  fundName: string;
  manager: string;
  company: string;
  inceptionDate: string;
  topHoldings: Array<{ stockCode: string; stockName: string; ratio: number; changePercent?: number }>;
}> => {
  // 如果已有相同基金代码的请求在进行，等待它完成
  const existingRequest = requestQueue.get(code);
  if (existingRequest) {
    console.log(`基金 ${code} 的请求已在进行中，等待完成...`);
    return existingRequest;
  }
  
  // 创建新的请求
  const requestPromise = (async () => {
    try {
      // 步骤1：并行获取基金基本信息和持仓数据，提高加载速度
      const [basicInfoResult, holdingsResult] = await Promise.allSettled([
        // 获取基金基本信息（直接使用 pingzhongdata 接口，jbgk 接口不稳定）
        (async () => {
          let fundBasicInfo: {
            fundName: string;
            manager: string;
            company: string;
            inceptionDate: string;
          };
          
          try {
            fundBasicInfo = await fetchFundBasicInfoFromPingzhong(code);
          } catch (pingzhongError) {
            // 即使失败也返回空数据，避免阻塞
            fundBasicInfo = {
              fundName: '',
              manager: '',
              company: '',
              inceptionDate: '',
            };
          }
          
          // 如果基本信息中没有基金名称，尝试从实时数据接口获取
          if (!fundBasicInfo.fundName) {
            try {
              const realtimeData = await fetchFundRealtime(code);
              if (realtimeData.name) {
                fundBasicInfo.fundName = realtimeData.name;
              }
            } catch (error) {
              // 静默失败，不影响主流程
            }
          }
          
          return fundBasicInfo;
        })(),
        // 获取持仓数据（与基本信息并行，不等待）
        (async () => {
          try {
            const basicHoldings = await fetchHoldingsBasic(code);
            
            if (basicHoldings.length > 0) {
              // 获取股票实时涨跌幅
              const stockCodes = basicHoldings.map(h => h.stockCode);
              const realtimeMap = await fetchStocksRealtime(stockCodes);
              
              // 合并数据
              const topHoldings = basicHoldings.map(holding => {
                const realtime = realtimeMap.get(holding.stockCode);
                return {
                  ...holding,
                  changePercent: realtime?.changePercent,
                };
              });
              
              // 按持仓占比排序（降序）
              topHoldings.sort((a, b) => b.ratio - a.ratio);
              return topHoldings;
            }
            return [];
          } catch (error) {
            // 静默失败，不影响主流程
            return [];
          }
        })(),
      ]);
      
      // 提取结果
      const fundBasicInfo = basicInfoResult.status === 'fulfilled' 
        ? basicInfoResult.value 
        : {
            fundName: '',
            manager: '',
            company: '',
            inceptionDate: '',
          };
      
      const topHoldings = holdingsResult.status === 'fulfilled' 
        ? holdingsResult.value 
        : [];
      
      return {
        ...fundBasicInfo,
        topHoldings,
      };
    } catch (error) {
      // 确保错误时也从队列中移除
      console.error('获取基金详情失败:', error);
      throw error;
    } finally {
      // 请求完成后从队列中移除（无论成功还是失败）
      requestQueue.delete(code);
    }
  })();
  
  // 将请求添加到队列
  requestQueue.set(code, requestPromise);
  
  return requestPromise;
};

/**
 * 验证基金代码是否存在
 */
/**
 * 获取基金历史净值列表（从 lsjz API）
 * @param code 基金代码
 * @param pageIndex 页码，从1开始
 * @param pageSize 每页数量，默认20
 * @returns 历史净值列表
 */
export const fetchFundNavHistoryList = async (
  code: string,
  pageIndex: number = 1,
  pageSize: number = 20
): Promise<NavHistoryListItem[]> => {
  return new Promise((resolve, reject) => {
    const callbackName = `jQuery${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const script = document.createElement('script');
    
    const timeout = setTimeout(() => {
      try {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      } catch (e) {
        // ignore
      }
      // 清理回调函数
      try {
        delete (window as any)[callbackName];
      } catch (e) {
        // ignore
      }
      reject(new Error('请求超时'));
    }, 20000);

    // 设置全局回调函数
    (window as any)[callbackName] = (data: any) => {
      clearTimeout(timeout);
      try {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      } catch (e) {
        // ignore
      }
      
      // 清理回调函数
      try {
        delete (window as any)[callbackName];
      } catch (e) {
        // ignore
      }

      try {
        if (!data || !data.Data || !data.Data.LSJZList) {
          reject(new Error('数据格式错误'));
          return;
        }

        const list: NavHistoryListItem[] = data.Data.LSJZList.map((item: any) => {
          const date = item.FSRQ || ''; // 净值日期
          const nav = parseFloat(item.DWJZ) || 0; // 单位净值
          const accNav = parseFloat(item.LJJZ) || nav; // 累计净值
          const dailyGrowth = parseFloat(item.JZZZL) || 0; // 日增长率
          const purchaseStatus = item.SGZT || ''; // 申购状态
          const redemptionStatus = item.SHZT || ''; // 赎回状态

          return {
            date,
            nav,
            accNav,
            dailyGrowth,
            purchaseStatus,
            redemptionStatus,
          };
        });

        resolve(list);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('解析数据失败'));
      }
    };

    script.onerror = () => {
      clearTimeout(timeout);
      try {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      } catch (e) {
        // ignore
      }
      // 清理回调函数
      try {
        delete (window as any)[callbackName];
      } catch (e) {
        // ignore
      }
      reject(new Error('网络错误'));
    };

    // 构建 API URL
    // 生产环境使用代理（通过 Caddy），开发环境直接调用原始 API
    const getApiUrl = () => {
      const params = new URLSearchParams({
        callback: callbackName,
        fundCode: code,
        pageIndex: pageIndex.toString(),
        pageSize: pageSize.toString(),
        startDate: '',
        endDate: '',
        _: Date.now().toString(),
      });
      
      return buildJsonpApiUrl(
        'https://api.fund.eastmoney.com/f10/lsjz',
        '/api/fund-nav-history',
        params
      );
    };

    const url = getApiUrl();
    script.src = url;
    document.body.appendChild(script);
  });
};

/**
 * 基金搜索结果
 */
export interface FundSearchResult {
  code: string;
  name: string;
  shortName?: string;
  nav?: number;
  fundType?: string; // FTYPE，如"混合型-偏股"
  fundTypeCode?: string; // FUNDTYPE，如"002"
  company?: string;
}

/**
 * 搜索基金（支持代码和名称搜索）
 * 使用防抖控制，避免频繁请求
 */
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
let lastSearchTime = 0;
const SEARCH_DEBOUNCE_MS = 500; // 防抖延迟 500ms
const MIN_SEARCH_INTERVAL_MS = 300; // 最小搜索间隔 300ms

export const searchFunds = async (keyword: string): Promise<FundSearchResult[]> => {
  const trimmedKeyword = keyword.trim();
  if (!trimmedKeyword) {
    return [];
  }

  // 防抖控制：如果距离上次搜索时间太短，等待
  const now = Date.now();
  const timeSinceLastSearch = now - lastSearchTime;
  if (timeSinceLastSearch < MIN_SEARCH_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_SEARCH_INTERVAL_MS - timeSinceLastSearch));
  }

  return new Promise((resolve, reject) => {
    // 清除之前的防抖定时器
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // 设置防抖
    searchTimeout = setTimeout(async () => {
      try {
        lastSearchTime = Date.now();
        const callbackName = `jQuery${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const script = document.createElement('script');
        
        const timeout = setTimeout(() => {
          try {
            if (script.parentNode) {
              script.parentNode.removeChild(script);
            }
          } catch (e) {
            // ignore
          }
          try {
            delete (window as any)[callbackName];
          } catch (e) {
            // ignore
          }
          reject(new Error('搜索超时'));
        }, 10000);

        // 设置全局回调函数
        (window as any)[callbackName] = (data: any) => {
          clearTimeout(timeout);
          try {
            if (script.parentNode) {
              script.parentNode.removeChild(script);
            }
          } catch (e) {
            // ignore
          }
          try {
            delete (window as any)[callbackName];
          } catch (e) {
            // ignore
          }

          try {
            if (!data || data.ErrCode !== 0 || !Array.isArray(data.Datas)) {
              resolve([]);
              return;
            }

            const results: FundSearchResult[] = data.Datas
              .filter((item: any) => item.CATEGORY === 700 && item.FundBaseInfo) // 只返回基金类型
              .map((item: any) => {
                const fundInfo = item.FundBaseInfo;
                return {
                  code: fundInfo.FCODE || item.CODE || '',
                  name: fundInfo.SHORTNAME || item.NAME || '',
                  shortName: fundInfo.SHORTNAME,
                  nav: fundInfo.DWJZ ? parseFloat(fundInfo.DWJZ) : undefined,
                  fundType: fundInfo.FTYPE || '', // FTYPE，如"混合型-偏股"
                  fundTypeCode: fundInfo.FUNDTYPE || '', // FUNDTYPE，如"002"
                  company: fundInfo.JJGS || '',
                };
              });

            resolve(results);
          } catch (error) {
            reject(error instanceof Error ? error : new Error('解析搜索结果失败'));
          }
        };

        script.onerror = () => {
          clearTimeout(timeout);
          try {
            if (script.parentNode) {
              script.parentNode.removeChild(script);
            }
          } catch (e) {
            // ignore
          }
          try {
            delete (window as any)[callbackName];
          } catch (e) {
            // ignore
          }
          reject(new Error('网络错误'));
        };

        // 构建 API URL
        const params = new URLSearchParams({
          callback: callbackName,
          m: '1', // 搜索模式：1=基金
          key: encodeURIComponent(trimmedKeyword),
          _: Date.now().toString(),
        });

        const url = buildJsonpApiUrl(
          `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx`,
          `/api/fund-search`,
          params
        );

        script.src = url;
        document.body.appendChild(script);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('搜索失败'));
      }
    }, SEARCH_DEBOUNCE_MS);
  });
};

/**
 * 验证基金代码（使用搜索接口）
 */
export const validateFundCode = async (code: string): Promise<{ valid: boolean; name?: string }> => {
  try {
    // 如果是6位数字代码，直接搜索
    if (/^\d{6}$/.test(code)) {
      const results = await searchFunds(code);
      const exactMatch = results.find(r => r.code === code);
      if (exactMatch) {
        return { valid: true, name: exactMatch.name };
      }
    }
    
    // 尝试搜索（支持代码和名称）
    const results = await searchFunds(code);
    if (results.length > 0) {
      // 优先返回精确匹配的代码
      const exactMatch = results.find(r => r.code === code);
      if (exactMatch) {
        return { valid: true, name: exactMatch.name };
      }
      // 返回第一个结果
      return { valid: true, name: results[0].name };
    }
    
    return { valid: false };
  } catch (error) {
    // 搜索失败，返回无效
    return { valid: false };
  }
};
