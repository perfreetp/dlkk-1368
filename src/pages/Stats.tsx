import { useState, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { getToday, getDaysAgo, formatDate, storageGet, storageSet, clamp } from '@/utils';
import './Stats.css';

interface TemperatureRecord {
  date: string;
  value: number;
}

interface ModuleStats {
  events: number;
  letters: number;
  photos: number;
  travels: number;
  songs: number;
  movies: number;
}

export default function Stats() {
  const [temperatureRecords, setTemperatureRecords] = useState<TemperatureRecord[]>(
    () => storageGet('temperatureRecords', [])
  );
  const [todayTemp, setTodayTemp] = useState<number>(() => {
    const today = getToday();
    const rec = storageGet<TemperatureRecord[]>('temperatureRecords', []).find(r => r.date === today);
    return rec?.value || 0;
  });
  const [showTempModal, setShowTempModal] = useState(false);
  const [tempInput, setTempInput] = useState<number>(todayTemp || 8);

  const [moduleStats, setModuleStats] = useState<ModuleStats>(() =>
    storageGet('moduleStats', {
      events: 12,
      letters: 8,
      photos: 156,
      travels: 5,
      songs: 23,
      movies: 18,
    })
  );

  useEffect(() => {
    storageSet('temperatureRecords', temperatureRecords);
  }, [temperatureRecords]);

  useEffect(() => {
    storageSet('moduleStats', moduleStats);
  }, [moduleStats]);

  const last30Days = useMemo(() => {
    const days: string[] = [];
    for (let i = 29; i >= 0; i--) {
      days.push(getDaysAgo(i));
    }
    return days;
  }, []);

  const temperatureData = useMemo(() => {
    return last30Days.map(date => {
      const rec = temperatureRecords.find(r => r.date === date);
      return rec ? rec.value : null;
    });
  }, [last30Days, temperatureRecords]);

  const avgTemperature = useMemo(() => {
    const values = temperatureData.filter(v => v !== null) as number[];
    if (values.length === 0) return 0;
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  }, [temperatureData]);

  const maxTemperature = useMemo(() => {
    const values = temperatureData.filter(v => v !== null) as number[];
    if (values.length === 0) return 0;
    return Math.max(...values);
  }, [temperatureData]);

  const saveTodayTemp = () => {
    const today = getToday();
    const value = clamp(tempInput, 1, 10);
    setTemperatureRecords(prev => {
      const filtered = prev.filter(r => r.date !== today);
      return [...filtered, { date: today, value }];
    });
    setTodayTemp(value);
    setShowTempModal(false);
  };

  const tempChartOption = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#fce7f3',
      borderWidth: 1,
      textStyle: { color: '#374151' },
      formatter: (params: any) => {
        const p = params[0];
        if (p.value === null || p.value === undefined) return `${p.axisValue}<br/>暂无记录`;
        return `${p.axisValue}<br/><span style="color:#ec4899">❤️ 温度值: ${p.value}</span>`;
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: last30Days.map(d => formatDate(d, 'MM/DD')),
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { color: '#9ca3af', fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 10,
      axisLine: { show: false },
      axisLabel: { color: '#9ca3af', fontSize: 11 },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
    },
    series: [
      {
        name: '关系温度',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: temperatureData,
        lineStyle: {
          width: 3,
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#f472b6' },
              { offset: 1, color: '#a78bfa' },
            ],
          },
        },
        itemStyle: {
          color: '#ec4899',
          borderColor: '#fff',
          borderWidth: 2,
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(236, 72, 153, 0.25)' },
              { offset: 1, color: 'rgba(167, 139, 250, 0.02)' },
            ],
          },
        },
      },
    ],
  }), [last30Days, temperatureData]);

  const moduleChartOption = useMemo(() => ({
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#fce7f3',
      borderWidth: 1,
      textStyle: { color: '#374151' },
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { color: '#6b7280', fontSize: 13 },
      itemWidth: 12,
      itemHeight: 12,
      itemGap: 16,
    },
    series: [
      {
        name: '模块统计',
        type: 'pie',
        radius: ['50%', '75%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 3,
        },
        label: { show: false },
        labelLine: { show: false },
        data: [
          { value: moduleStats.photos, name: '照片', itemStyle: { color: '#f472b6' } },
          { value: moduleStats.movies, name: '电影', itemStyle: { color: '#a78bfa' } },
          { value: moduleStats.songs, name: '歌曲', itemStyle: { color: '#60a5fa' } },
          { value: moduleStats.events, name: '事件', itemStyle: { color: '#34d399' } },
          { value: moduleStats.letters, name: '信件', itemStyle: { color: '#fbbf24' } },
          { value: moduleStats.travels, name: '旅行', itemStyle: { color: '#f87171' } },
        ],
      },
    ],
  }), [moduleStats]);

  const moduleTrendOption = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#fce7f3',
      borderWidth: 1,
      textStyle: { color: '#374151' },
    },
    legend: {
      data: ['照片', '事件', '信件', '旅行'],
      top: 0,
      textStyle: { color: '#6b7280', fontSize: 12 },
      itemWidth: 12,
      itemHeight: 12,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '18%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: ['1月', '2月', '3月', '4月', '5月', '6月'],
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { color: '#9ca3af', fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: '#9ca3af', fontSize: 11 },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
    },
    series: [
      {
        name: '照片',
        type: 'bar',
        data: [28, 32, 30, 25, 22, 19],
        itemStyle: { color: '#f472b6', borderRadius: [4, 4, 0, 0] },
        barWidth: 12,
      },
      {
        name: '事件',
        type: 'bar',
        data: [3, 2, 4, 1, 2, 0],
        itemStyle: { color: '#a78bfa', borderRadius: [4, 4, 0, 0] },
        barWidth: 12,
      },
      {
        name: '信件',
        type: 'bar',
        data: [1, 2, 1, 3, 1, 0],
        itemStyle: { color: '#fbbf24', borderRadius: [4, 4, 0, 0] },
        barWidth: 12,
      },
      {
        name: '旅行',
        type: 'bar',
        data: [0, 1, 0, 2, 1, 1],
        itemStyle: { color: '#34d399', borderRadius: [4, 4, 0, 0] },
        barWidth: 12,
      },
    ],
  }), []);

  const moduleCards = [
    { key: 'photos', label: '照片', value: moduleStats.photos, icon: '📷', color: 'from-pink-400 to-rose-500' },
    { key: 'events', label: '事件', value: moduleStats.events, icon: '🎉', color: 'from-violet-400 to-purple-500' },
    { key: 'letters', label: '信件', value: moduleStats.letters, icon: '💌', color: 'from-amber-400 to-orange-500' },
    { key: 'travels', label: '旅行', value: moduleStats.travels, icon: '✈️', color: 'from-emerald-400 to-teal-500' },
    { key: 'songs', label: '歌曲', value: moduleStats.songs, icon: '🎵', color: 'from-blue-400 to-indigo-500' },
    { key: 'movies', label: '电影', value: moduleStats.movies, icon: '🎬', color: 'from-red-400 to-rose-500' },
  ];

  const totalCount = Object.values(moduleStats).reduce((a, b) => a + b, 0);

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-pink-50 via-white to-violet-50">
      <div className="px-8 py-6 border-b border-gray-200/50 bg-white/60 backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">
            数据统计
          </h1>
          <p className="text-sm text-gray-500 mt-1">用数据记录我们走过的每一步</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1 bg-gradient-to-br from-pink-500 via-rose-500 to-violet-500 rounded-2xl p-6 text-white shadow-lg shadow-pink-500/20">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/80 text-sm">今日关系温度</p>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-5xl font-bold">{todayTemp || '-'}</span>
                  <span className="text-white/70">/ 10</span>
                </div>
              </div>
              <span className="text-4xl">❤️</span>
            </div>
            <div className="mt-4 pt-4 border-t border-white/20 flex gap-6">
              <div>
                <p className="text-white/60 text-xs">30天平均</p>
                <p className="text-lg font-semibold mt-0.5">{avgTemperature}</p>
              </div>
              <div>
                <p className="text-white/60 text-xs">最高温度</p>
                <p className="text-lg font-semibold mt-0.5">{maxTemperature}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setTempInput(todayTemp || 8);
                setShowTempModal(true);
              }}
              className="mt-5 w-full py-2.5 bg-white/20 hover:bg-white/30 rounded-xl font-medium transition-colors backdrop-blur-sm"
            >
              记录今日温度
            </button>
          </div>

          {moduleCards.slice(0, 2).map(card => (
            <div key={card.key} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-500 text-sm">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-800 mt-2">{card.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-2xl shadow-md`}>
                  {card.icon}
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-1 text-emerald-500 text-sm">
                  <span>↑</span>
                  <span>12% 较上月</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {moduleCards.slice(2).map(card => (
            <div key={card.key} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{card.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-xl`}>
                  {card.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">关系温度趋势（近30天）</h3>
              <span className="text-xs text-gray-400">每日记录 1-10 分</span>
            </div>
            <ReactECharts option={tempChartOption} style={{ height: 280 }} opts={{ renderer: 'svg' }} />
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">各模块数据占比</h3>
              <span className="text-xs text-gray-400">总计 {totalCount} 条</span>
            </div>
            <ReactECharts option={moduleChartOption} style={{ height: 280 }} opts={{ renderer: 'svg' }} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">月度数据趋势</h3>
            <span className="text-xs text-gray-400">近6个月</span>
          </div>
          <ReactECharts option={moduleTrendOption} style={{ height: 320 }} opts={{ renderer: 'svg' }} />
        </div>
      </div>

      {showTempModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-gray-800 mb-2">记录今日温度</h2>
            <p className="text-sm text-gray-500 mb-5">用 1-10 分给今天的关系打个分吧 💝</p>

            <div className="mb-6">
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => (
                  <button
                    key={v}
                    onClick={() => setTempInput(v)}
                    className={`w-10 h-10 rounded-full font-semibold transition-all ${
                      tempInput >= v
                        ? 'bg-gradient-to-br from-pink-500 to-violet-500 text-white shadow-md scale-105'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="text-center">
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={tempInput}
                  onChange={e => setTempInput(Number(e.target.value))}
                  className="w-full accent-pink-500"
                />
                <p className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent mt-2">
                  {tempInput} / 10
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {tempInput <= 3 && '需要多关心彼此哦 🥺'}
                  {tempInput > 3 && tempInput <= 6 && '还不错，继续加油 💪'}
                  {tempInput > 6 && tempInput <= 8 && '甜蜜的日常 💕'}
                  {tempInput > 8 && '爱意满满！太幸福了 🥰'}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowTempModal(false)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={saveTodayTemp}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
