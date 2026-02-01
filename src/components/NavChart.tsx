import React from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { useDetailStore } from '../store/detailStore';
import clsx from 'clsx';

export function NavChart() {
  const { navHistory, timeRange, setTimeRange, isLoading } = useDetailStore();

  const ranges: Array<{ key: typeof timeRange; label: string }> = [
    { key: '30d', label: '1月' },
    { key: '3m', label: '3月' },
    { key: '6m', label: '6月' },
    { key: '1y', label: '1年' },
    { key: 'all', label: '全部' },
  ];

  // 数据验证和清理
  const validHistory = React.useMemo(() => {
    if (!navHistory || !Array.isArray(navHistory)) {
      return [];
    }
    return navHistory
      .filter((item) => item && item.date && typeof item.nav === 'number' && !isNaN(item.nav))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [navHistory]);

  // 计算统计数据
  const stats = React.useMemo(() => {
    if (validHistory.length === 0) {
      return null;
    }
    
    const values = validHistory.map(item => item.nav);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const latest = values[values.length - 1];
    const earliest = values[0];
    const change = latest - earliest;
    const changePercent = earliest > 0 ? (change / earliest) * 100 : 0;
    
    return {
      max,
      min,
      latest,
      earliest,
      change,
      changePercent,
      maxDate: validHistory[values.indexOf(max)].date,
      minDate: validHistory[values.indexOf(min)].date,
    };
  }, [validHistory]);

  // 确保 xAxis 和 series 数据长度一致
  const chartData = React.useMemo(() => {
    if (validHistory.length === 0) {
      return { dates: [], values: [] };
    }
    
    const dates: string[] = [];
    const values: number[] = [];
    
    validHistory.forEach((item) => {
      if (item && item.date && typeof item.nav === 'number' && !isNaN(item.nav) && item.nav > 0) {
        dates.push(item.date);
        values.push(item.nav);
      }
    });
    
    return { dates, values };
  }, [validHistory]);

  const option: echarts.EChartsOption = React.useMemo(() => {
    if (chartData.dates.length === 0 || chartData.values.length === 0) {
      return {
        backgroundColor: 'transparent',
        animation: false,
        xAxis: { type: 'category', data: [] },
        yAxis: { type: 'value' },
        series: [{ type: 'line', data: [] }],
      };
    }

    // 确保数据长度一致
    const minLength = Math.min(chartData.dates.length, chartData.values.length);
    const dates = chartData.dates.slice(0, minLength);
    const values = chartData.values.slice(0, minLength);

    // 计算Y轴范围，留出一些边距
    const valueRange = Math.max(...values) - Math.min(...values);
    const padding = valueRange * 0.15; // 15%的边距
    const yMin = Math.max(0, Math.min(...values) - padding);
    const yMax = Math.max(...values) + padding;

    return {
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 1000,
      animationEasing: 'cubicOut',
      grid: {
        top: 60,
        left: 70,
        right: 30,
        bottom: 50,
        containLabel: false,
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: 11,
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
          formatter: (value: string) => {
            try {
              if (!value) return '';
              const date = new Date(value);
              if (isNaN(date.getTime())) return value;
              const month = date.getMonth() + 1;
              const day = date.getDate();
              return `${month}/${day}`;
            } catch {
              return value || '';
            }
          },
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        scale: false,
        min: yMin,
        max: yMax,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: 'rgba(255, 255, 255, 0.6)',
          fontFamily: 'SF Mono, "JetBrains Mono", monospace',
          fontSize: 11,
          formatter: (val: number) => {
            if (typeof val !== 'number' || isNaN(val)) return '0';
            return val.toFixed(2);
          },
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.06)',
            type: 'solid',
            width: 1,
          },
        },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        textStyle: {
          color: 'rgba(255, 255, 255, 0.9)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
          fontSize: 12,
        },
        padding: [12, 16],
        borderRadius: 12,
        backdropFilter: 'blur(20px) saturate(180%)',
        axisPointer: {
          type: 'line',
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.2)',
            width: 1,
            type: 'dashed' as const,
          },
          label: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderColor: 'rgba(255, 255, 255, 0.2)',
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: 11,
            fontFamily: 'SF Mono, "JetBrains Mono", monospace',
          },
        },
        formatter: (params: any) => {
          try {
            const param = Array.isArray(params) ? params[0] : params;
            if (!param || !param.axisValue) return '';
            const item = validHistory.find((h) => h.date === param.axisValue);
            if (!item) return '';
            const date = new Date(item.date);
            const dateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
            return `
              <div style="line-height: 1.6;">
                <div style="font-weight: 600; margin-bottom: 8px; font-size: 13px;">${dateStr}</div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                  <span style="opacity: 0.7;">单位净值</span>
                  <span style="font-weight: 600; font-family: 'SF Mono', monospace; color: #60A5FA;">${item.nav.toFixed(4)}</span>
                </div>
                ${item.accNav ? `
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                  <span style="opacity: 0.7;">累计净值</span>
                  <span style="font-family: 'SF Mono', monospace;">${item.accNav.toFixed(4)}</span>
                </div>
                ` : ''}
                ${item.dailyGrowth !== undefined && !isNaN(item.dailyGrowth) ? `
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="opacity: 0.7;">日涨跌</span>
                  <span style="font-weight: 600; font-family: 'SF Mono', monospace; color: ${item.dailyGrowth >= 0 ? '#FF453A' : '#32D74B'};">${item.dailyGrowth >= 0 ? '+' : ''}${item.dailyGrowth.toFixed(2)}%</span>
                </div>
                ` : ''}
              </div>
            `;
          } catch (e) {
            return '';
          }
        },
      },
      series: [
        {
          type: 'line',
          data: values,
          smooth: 0.4,
          symbol: 'none',
          sampling: 'lttb',
          lineStyle: {
            width: 2.5,
            color: '#60A5FA',
            shadowColor: 'rgba(96, 165, 250, 0.3)',
            shadowBlur: 8,
            shadowOffsetY: 2,
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(96, 165, 250, 0.25)' },
              { offset: 0.5, color: 'rgba(129, 140, 248, 0.15)' },
              { offset: 1, color: 'rgba(167, 139, 250, 0.05)' },
            ]),
          },
          emphasis: {
            focus: 'series',
            lineStyle: {
              width: 3,
            },
          },
        },
      ],
    };
  }, [chartData, validHistory]);

  if (!navHistory || navHistory.length === 0 || validHistory.length === 0) {
    if (isLoading) {
      return (
        <div className="space-y-6 animate-pulse">
          {/* 统计信息骨架屏 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="glass-card p-4 backdrop-blur-xl bg-white/5 border-white/10">
                <div className="h-4 w-20 bg-white/10 rounded mb-3" />
                <div className="h-7 w-24 bg-white/10 rounded" />
              </div>
            ))}
          </div>
          {/* 图表骨架屏 */}
          <div className="glass-card p-6 backdrop-blur-xl bg-white/5 border-white/10">
            <div className="flex gap-2 mb-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-9 w-16 bg-white/10 rounded-lg" />
              ))}
            </div>
            <div className="h-[450px] bg-white/5 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <i className="ri-loader-4-line animate-spin text-4xl text-text-tertiary mb-3 block" />
                <div className="text-text-secondary">正在加载净值数据...</div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="glass-card p-12 text-center animate-in fade-in duration-300">
        <i className="ri-line-chart-line text-5xl text-text-muted mb-4 block" />
        <div className="text-text-secondary">暂无净值数据</div>
        <div className="text-sm text-text-tertiary mt-2">
          请先选择一个基金查看详情
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 transition-opacity duration-300">
      {/* 统计信息卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="glass-card p-4 backdrop-blur-xl bg-white/5 border-white/10 transition-all duration-300 hover:scale-105">
            <div className="text-xs text-text-tertiary mb-1.5 font-medium">最新净值</div>
            <div className={clsx(
              'text-xl font-mono font-semibold',
              stats.changePercent >= 0 ? 'text-up' : 'text-down'
            )}>
              {stats.latest.toFixed(4)}
            </div>
          </div>
          <div className="glass-card p-4 backdrop-blur-xl bg-white/5 border-white/10 transition-all duration-300 hover:scale-105">
            <div className="text-xs text-text-tertiary mb-1.5 font-medium">期间涨跌</div>
            <div className={clsx(
              'text-xl font-mono font-semibold',
              stats.changePercent >= 0 ? 'text-up' : 'text-down'
            )}>
              {stats.changePercent >= 0 ? '+' : ''}{stats.changePercent.toFixed(2)}%
            </div>
          </div>
          <div className="glass-card p-4 backdrop-blur-xl bg-white/5 border-white/10 transition-all duration-300 hover:scale-105">
            <div className="text-xs text-text-tertiary mb-1.5 font-medium">最高净值</div>
            <div className="text-xl font-mono font-semibold text-text-primary">
              {stats.max.toFixed(4)}
            </div>
            <div className="text-xs text-text-tertiary mt-1">
              {new Date(stats.maxDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
            </div>
          </div>
          <div className="glass-card p-4 backdrop-blur-xl bg-white/5 border-white/10 transition-all duration-300 hover:scale-105">
            <div className="text-xs text-text-tertiary mb-1.5 font-medium">最低净值</div>
            <div className="text-xl font-mono font-semibold text-text-primary">
              {stats.min.toFixed(4)}
            </div>
            <div className="text-xs text-text-tertiary mt-1">
              {new Date(stats.minDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>
      )}

      {/* 图表容器 */}
      <div className="glass-card p-6 backdrop-blur-xl bg-white/5 border-white/10">
        {/* 时间范围切换 - Apple风格 */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {ranges.map((range) => (
            <button
              key={range.key}
              onClick={() => setTimeRange(range.key)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                'backdrop-blur-sm border',
                timeRange === range.key
                  ? 'bg-white/20 text-white border-white/30 shadow-lg shadow-blue-500/20'
                  : 'bg-white/5 text-text-secondary border-white/10 hover:bg-white/10 hover:text-text-primary hover:border-white/20'
              )}
            >
              {range.label}
            </button>
          ))}
        </div>

        {/* 图表 */}
        {isLoading ? (
          <div className="h-[450px] w-full flex items-center justify-center animate-pulse">
            <div className="text-center">
              <i className="ri-loader-4-line animate-spin text-4xl text-text-tertiary mb-3 block" />
              <div className="text-text-secondary">正在加载图表数据...</div>
            </div>
          </div>
        ) : (
          <div className="transition-opacity duration-500">
            <ReactECharts
              key={`chart-${chartData.dates.length}-${chartData.values.length}-${timeRange}`}
              option={option}
              style={{ height: '450px', width: '100%' }}
              opts={{ renderer: 'svg', locale: 'ZH' }}
              notMerge={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
