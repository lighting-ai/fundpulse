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
        animation: false, // 禁用动画
        xAxis: { type: 'category', data: [] },
        yAxis: { type: 'value' },
        series: [{ type: 'line', data: [] }],
      };
    }

    // 确保数据长度一致
    const minLength = Math.min(chartData.dates.length, chartData.values.length);
    const dates = chartData.dates.slice(0, minLength);
    const values = chartData.values.slice(0, minLength);

    return {
      backgroundColor: 'transparent',
      animation: false, // 禁用动画以避免数据变化时的错误
      grid: {
        top: 40,
        left: 60,
        right: 20,
        bottom: 40,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: 'var(--text-tertiary)',
          fontSize: 11,
          formatter: (value: string) => {
            try {
              if (!value) return '';
              const date = new Date(value);
              if (isNaN(date.getTime())) return value;
              return `${date.getMonth() + 1}/${date.getDate()}`;
            } catch {
              return value || '';
            }
          },
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: 'var(--text-secondary)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          formatter: (val: number) => {
            if (typeof val !== 'number' || isNaN(val)) return '0';
            return val.toFixed(2);
          },
        },
        splitLine: {
          lineStyle: {
            color: 'var(--chart-grid)',
            type: 'dashed',
          },
        },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        borderColor: 'rgba(99, 102, 241, 0.3)',
        textStyle: {
          color: 'var(--text-primary)',
          fontFamily: 'JetBrains Mono, monospace',
        },
        padding: 12,
        borderRadius: 8,
        backdropFilter: 'blur(10px)',
        formatter: (params: any) => {
          try {
            const param = Array.isArray(params) ? params[0] : params;
            if (!param || !param.axisValue) return '';
            const item = validHistory.find((h) => h.date === param.axisValue);
            if (!item) return '';
            return `
              <div>
                <div style="margin-bottom: 4px; font-weight: 600;">${item.date}</div>
                <div>单位净值: <span style="color: var(--chart-line);">${item.nav.toFixed(4)}</span></div>
                <div>累计净值: ${item.accNav?.toFixed(4) || '--'}</div>
                ${item.dailyGrowth !== undefined && !isNaN(item.dailyGrowth) ? `<div>日涨跌: <span style="color: ${item.dailyGrowth >= 0 ? 'var(--up-primary)' : 'var(--down-primary)'}">${item.dailyGrowth >= 0 ? '+' : ''}${item.dailyGrowth.toFixed(2)}%</span></div>` : ''}
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
          smooth: true,
          symbol: 'none',
          lineStyle: {
            width: 3,
            color: 'var(--chart-line)',
            shadowColor: 'rgba(96, 165, 250, 0.5)',
            shadowBlur: 10,
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'var(--chart-area-top)' },
              { offset: 1, color: 'var(--chart-area-bottom)' },
            ]),
          },
        },
      ],
    };
  }, [chartData, validHistory]);

  if (!navHistory || navHistory.length === 0 || validHistory.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <i className="ri-line-chart-line text-5xl text-text-muted mb-4 block" />
        <div className="text-text-secondary">
          {isLoading ? '加载中...' : '暂无净值数据'}
        </div>
        <div className="text-sm text-text-tertiary mt-2">
          {isLoading ? '正在获取数据' : '请先选择一个基金查看详情'}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      {/* 时间范围切换 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {ranges.map((range) => (
          <button
            key={range.key}
            onClick={() => setTimeRange(range.key)}
            className={clsx(
              'px-4 py-1.5 rounded-lg text-sm transition-colors',
              timeRange === range.key
                ? 'bg-accent-blue text-white'
                : 'bg-bg-elevated text-text-secondary hover:text-text-primary'
            )}
          >
            {range.label}
          </button>
        ))}
      </div>

      {/* 图表 */}
      {isLoading ? (
        <div className="skeleton h-64 w-full" />
      ) : (
        <ReactECharts
          key={`chart-${chartData.dates.length}-${chartData.values.length}`} // 添加 key 强制重新渲染
          option={option}
          style={{ height: '400px', width: '100%' }}
          opts={{ renderer: 'svg' }}
          notMerge={true} // 不合并配置，完全重新渲染
        />
      )}
    </div>
  );
}
