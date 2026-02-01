export interface RankedFund {
  code: string;
  name: string;
  type: string;
  nav: number;
  accNav: number;
  dailyGrowth: number;
  recent1Week: number;
  recent1Month: number;
  recent3Month: number;
  recent1Year: number;
  thisYear: number;
  manager: string;
}

// 兼容旧接口
export interface FundRankItem extends RankedFund {
  recent1Week: number;
  recent3Month: number;
  recent6Month: number;
  recent2Year: number;
  recent3Year: number;
  sinceInception: number;
}

// 字段索引映射（根据实际返回调整）
const FIELD_INDEX = {
  code: 0,
  name: 1,
  pinyin: 2,
  type: 3,
  manager: 21, // 注意：这个位置可能变动
  nav: 5,
  accNav: 6,
  dailyGrowth: 7,
  recent1Week: 8,
  recent1Month: 9,
  recent3Month: 10,
  recent6Month: 11,
  recent1Year: 12,
  recent2Year: 13,
  recent3Year: 14,
  thisYear: 15,
  sinceInception: 16
};

// 请求队列，避免并发冲突
const rankDataRequestQueue: Array<{
  requestId: string;
  resolve: (data: RankedFund[]) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}> = [];

// 全局 rankData setter，处理所有请求
let rankDataSetter: ((v: any) => void) | null = null;

// 初始化全局 setter（只初始化一次）
const initRankDataSetter = () => {
  if (rankDataSetter) return; // 已经初始化过了

  // 清理已存在的属性
  try {
    const existingDescriptor = Object.getOwnPropertyDescriptor(window, 'rankData');
    if (existingDescriptor && existingDescriptor.configurable) {
      delete (window as any).rankData;
    }
  } catch (e) {
    // ignore
  }

  // 定义全局 setter
  try {
    Object.defineProperty(window, 'rankData', {
      configurable: true,
      enumerable: true,
      set: function(v) {
        if (rankDataRequestQueue.length === 0) {
          console.warn('收到 rankData 但没有待处理的请求');
          return;
        }

        // 处理队列中的第一个请求
        const request = rankDataRequestQueue[0];
        rankDataRequestQueue.shift();

        clearTimeout(request.timeout);

        // 检查错误
        if (v.ErrCode && v.ErrCode !== 0) {
          request.reject(new Error(v.Data || `API错误: ErrCode=${v.ErrCode}`));
          return;
        }

        if (v && Array.isArray(v.datas) && v.datas.length > 0) {
          try {
            // 解析数据
            const funds: RankedFund[] = v.datas.map((row: string) => {
              const cols = row.split(',');
              return {
                code: cols[FIELD_INDEX.code] || '',
                name: cols[FIELD_INDEX.name] || '',
                type: cols[FIELD_INDEX.type] || '混合型',
                nav: parseFloat(cols[FIELD_INDEX.nav]) || 0,
                accNav: parseFloat(cols[FIELD_INDEX.accNav]) || 0,
                dailyGrowth: parseFloat(cols[FIELD_INDEX.dailyGrowth]) || 0,
                recent1Week: parseFloat(cols[FIELD_INDEX.recent1Week]) || 0,
                recent1Month: parseFloat(cols[FIELD_INDEX.recent1Month]) || 0,
                recent3Month: parseFloat(cols[FIELD_INDEX.recent3Month]) || 0,
                recent1Year: parseFloat(cols[FIELD_INDEX.recent1Year]) || 0,
                thisYear: parseFloat(cols[FIELD_INDEX.thisYear]) || 0,
                manager: cols[FIELD_INDEX.manager] || '-'
              };
            });
            console.log(`✅ 解析成功，数据条数: ${funds.length}`);
            request.resolve(funds);
          } catch (err) {
            request.reject(err instanceof Error ? err : new Error('解析数据失败'));
          }
        } else {
          request.reject(new Error('数据格式错误'));
        }
      }
    });

    rankDataSetter = (v: any) => {
      (window as any).rankData = v;
    };
  } catch (e) {
    console.error('初始化 rankData setter 失败:', e);
  }
};

/**
 * 获取基金排行榜（天天基金 JSONP 接口）
 * 参考文档：design/v2.0/jijin.md
 * 
 * 注意：API返回格式为 var rankData = {...}
 * 需要通过拦截全局变量来获取数据
 */
export const fetchFundRanking = (options: {
  type?: 'all' | 'gp' | 'hh' | 'zq' | 'zs' | 'qdii';
  sortBy?: '1nzf' | '1y' | '3y' | '6y' | '1n' | 'jn' | 'ln';
  pageSize?: number;
  pageIndex?: number;
} = {}): Promise<RankedFund[]> => {
  const {
    type = 'all',
    sortBy = '1nzf', // 默认今日涨幅
    pageSize = 50,
  } = options;

  // 构建参数（简化版，参考用户测试代码）
  const params = new URLSearchParams({
    op: 'ph',
    dt: 'kf',
    ft: type,
    sc: sortBy,
    st: 'desc',
    pn: pageSize.toString(),
  });
  // 添加时间戳参数避免缓存
  params.append('_', Date.now().toString());

  return new Promise((resolve, reject) => {
    // 初始化全局 setter（如果还没初始化）
    initRankDataSetter();

    const script = document.createElement('script');
    const requestId = `rankData_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const cleanup = () => {
      try {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      } catch (e) {
        // ignore
      }
      
      // 从队列中移除当前请求
      const index = rankDataRequestQueue.findIndex(r => r.requestId === requestId);
      if (index !== -1) {
        rankDataRequestQueue.splice(index, 1);
      }
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('请求超时'));
    }, 20000);

    // 将请求添加到队列
    rankDataRequestQueue.push({
      requestId,
      resolve: (funds) => {
        clearTimeout(timeout);
        cleanup();
        resolve(funds);
      },
      reject: (error) => {
        clearTimeout(timeout);
        cleanup();
        reject(error);
      },
      timeout,
    });

    script.src = `https://fund.eastmoney.com/data/rankhandler.aspx?${params.toString()}`;
    
    script.onerror = () => {
      // 从队列中查找并移除当前请求
      const index = rankDataRequestQueue.findIndex(r => r.requestId === requestId);
      if (index !== -1) {
        const request = rankDataRequestQueue[index];
        rankDataRequestQueue.splice(index, 1);
        clearTimeout(request.timeout);
        request.reject(new Error('脚本加载失败'));
      }
      cleanup();
    };
  
    document.body.appendChild(script);
    console.log('📡 加载脚本:', script.src);
  });
};
