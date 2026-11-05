/**
 * ECharts wrapper with the COURTVISION dark theme. Every chart is interactive (hover tooltips,
 * legend toggles) and resizes with its container. Each helper returns the chart instance.
 */
import * as echarts from 'echarts';

export const PALETTE = ['#3D7BFF', '#B79CFF', '#38E8FF', '#F5B301', '#F26B1F', '#2DD4A0', '#F0506E', '#9fc4ff'];
const FONT = "'Inter', system-ui, sans-serif", MONO = "'JetBrains Mono', monospace";
const instances = new Set();
let ro = null;
function observe(el, chart) {
  if (!ro) ro = new ResizeObserver(entries => entries.forEach(e => e.target.__chart?.resize()));
  el.__chart = chart; ro.observe(el);
}
export function initChart(el, option, { alt } = {}) {
  const chart = echarts.init(el, null, { renderer: 'canvas' });
  chart.setOption(Object.assign({ backgroundColor: 'transparent', textStyle: { fontFamily: FONT, color: '#B3BCCB' }, color: PALETTE, animationDuration: 600, animationEasing: 'cubicOut' }, option));
  observe(el, chart); instances.add(chart);
  if (alt) { el.setAttribute('role', 'img'); el.setAttribute('aria-label', alt); }
  return chart;
}
export function disposeAll() { instances.forEach(c => { try { c.dispose(); } catch {} }); instances.clear(); }
export const axisBase = (extra = {}) => ({ axisLine: { lineStyle: { color: 'rgba(255,255,255,.12)' } }, axisTick: { show: false }, axisLabel: { color: '#74809A', fontFamily: MONO, fontSize: 11 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,.06)' } }, ...extra });
export const tooltipBase = (extra = {}) => ({ trigger: 'axis', backgroundColor: 'rgba(10,13,22,.95)', borderColor: 'rgba(255,255,255,.14)', textStyle: { color: '#F2F4F8', fontFamily: FONT, fontSize: 12 }, ...extra });
export const gridBase = (extra = {}) => ({ left: 48, right: 20, top: 36, bottom: 36, containLabel: false, ...extra });

export function radar(el, indicators, series, { alt } = {}) {
  return initChart(el, {
    tooltip: tooltipBase({ trigger: 'item' }),
    legend: { bottom: 0, textStyle: { color: '#B3BCCB' }, icon: 'circle' },
    radar: { indicator: indicators, shape: 'polygon', splitNumber: 4, axisName: { color: '#B3BCCB', fontFamily: MONO, fontSize: 11 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,.1)' } }, splitArea: { areaStyle: { color: ['rgba(255,255,255,.015)', 'rgba(255,255,255,.035)'] } }, axisLine: { lineStyle: { color: 'rgba(255,255,255,.12)' } }, radius: '66%', center: ['50%', '48%'] },
    series: [{ type: 'radar', symbolSize: 5, data: series.map((s, i) => ({ name: s.name, value: s.value, itemStyle: { color: s.color || PALETTE[i] }, lineStyle: { width: 2 }, areaStyle: { opacity: .18 } })) }],
  }, { alt });
}
export function line(el, { x, series, yName = '', yMin, yMax, markLine, area = false, smooth = true, alt, formatter, legend = true, yFormatter }) {
  return initChart(el, {
    tooltip: tooltipBase({ valueFormatter: formatter }),
    legend: legend ? { top: 0, right: 0, textStyle: { color: '#B3BCCB' }, icon: 'roundRect' } : undefined,
    grid: gridBase({ top: legend ? 40 : 20, left: 52 }),
    xAxis: { type: 'category', data: x, boundaryGap: false, ...axisBase() },
    yAxis: { type: 'value', name: yName, min: yMin, max: yMax, nameTextStyle: { color: '#74809A', fontFamily: MONO, fontSize: 10, align: 'left' }, ...axisBase({ axisLabel: { color: '#74809A', fontFamily: MONO, fontSize: 11, formatter: yFormatter } }) },
    series: series.map((s, i) => ({ name: s.name, type: 'line', data: s.data, smooth, showSymbol: s.symbol ?? false, symbolSize: 6, lineStyle: { width: s.width || 2, type: s.dashed ? 'dashed' : 'solid', color: s.color || PALETTE[i] }, itemStyle: { color: s.color || PALETTE[i] }, areaStyle: (s.area ?? area) ? { opacity: .12, color: s.color || PALETTE[i] } : undefined, markLine: s.markLine, connectNulls: true })),
  }, { alt });
}
export function bar(el, { x, series, horizontal = false, stack = false, yName = '', alt, formatter, labels = false, colorFn, yMin, yMax }) {
  const cat = { type: 'category', data: x, ...axisBase({ axisLabel: { color: '#B3BCCB', fontFamily: MONO, fontSize: 11, interval: 0, width: horizontal ? 110 : undefined, overflow: 'truncate' } }) };
  const val = { type: 'value', name: yName, min: yMin, max: yMax, nameTextStyle: { color: '#74809A', fontFamily: MONO, fontSize: 10 }, ...axisBase() };
  return initChart(el, {
    tooltip: tooltipBase({ valueFormatter: formatter }),
    legend: series.length > 1 ? { top: 0, right: 0, textStyle: { color: '#B3BCCB' } } : undefined,
    grid: gridBase({ left: horizontal ? 120 : 52, top: series.length > 1 ? 40 : 24 }),
    xAxis: horizontal ? val : cat, yAxis: horizontal ? { ...cat, inverse: true } : val,
    series: series.map((s, i) => ({ name: s.name, type: 'bar', data: s.data.map((v, j) => colorFn ? { value: v, itemStyle: { color: colorFn(v, j) } } : v), stack: stack ? 'a' : undefined, barMaxWidth: 28, itemStyle: { color: s.color || PALETTE[i], borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] }, label: labels ? { show: true, position: horizontal ? 'right' : 'top', color: '#B3BCCB', fontFamily: MONO, fontSize: 10, formatter: (p) => formatter ? formatter(p.value) : p.value } : undefined })),
  }, { alt });
}
export function scatter(el, { points, xName, yName, highlight = [], alt, xInverse = false, yInverse = false, labelAll = false, quadrant = null, trend = null, symbolSize = 12 }) {
  const data = points.map(p => ({ name: p.name, value: [p.x, p.y], itemStyle: { color: p.color || (highlight.includes(p.id) ? '#F5B301' : 'rgba(127,178,255,.75)') }, symbolSize: highlight.includes(p.id) ? symbolSize * 1.8 : symbolSize, label: { show: labelAll || highlight.includes(p.id), position: 'top', formatter: p.label || p.name, color: '#fff', fontFamily: MONO, fontSize: 10 }, id: p.id, meta: p }));
  const series = [{ type: 'scatter', data, emphasis: { label: { show: true, color: '#fff' } } }];
  if (quadrant) series[0].markLine = { silent: true, symbol: 'none', lineStyle: { color: 'rgba(255,255,255,.2)', type: 'dashed' }, data: [{ xAxis: quadrant.x }, { yAxis: quadrant.y }], label: { show: false } };
  if (trend) series.push({ type: 'line', data: trend, showSymbol: false, lineStyle: { color: '#F5B301', width: 1.5, type: 'dashed' }, tooltip: { show: false } });
  return initChart(el, {
    tooltip: tooltipBase({ trigger: 'item', formatter: (p) => p.data?.meta?.tip || `${p.name}<br/>${xName}: ${p.value[0]}<br/>${yName}: ${p.value[1]}` }),
    grid: gridBase({ left: 56, bottom: 44, right: 24 }),
    xAxis: { type: 'value', name: xName, nameLocation: 'middle', nameGap: 28, scale: true, inverse: xInverse, nameTextStyle: { color: '#B3BCCB', fontFamily: MONO, fontSize: 11 }, ...axisBase() },
    yAxis: { type: 'value', name: yName, scale: true, inverse: yInverse, nameTextStyle: { color: '#B3BCCB', fontFamily: MONO, fontSize: 11 }, ...axisBase() },
    series,
  }, { alt });
}
export function gauge(el, value, { label = 'Home win probability', color = '#3D7BFF', alt } = {}) {
  return initChart(el, {
    series: [{ type: 'gauge', startAngle: 200, endAngle: -20, min: 0, max: 100, radius: '100%', center: ['50%', '62%'], progress: { show: true, width: 16, itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#B79CFF' }, { offset: 1, color }] } } }, axisLine: { lineStyle: { width: 16, color: [[1, 'rgba(255,255,255,.08)']] } }, axisTick: { show: false }, splitLine: { length: 8, lineStyle: { color: 'rgba(255,255,255,.2)', width: 1 } }, axisLabel: { show: false }, pointer: { show: false }, anchor: { show: false }, title: { show: true, offsetCenter: [0, '30%'], color: '#74809A', fontFamily: MONO, fontSize: 11 }, detail: { valueAnimation: true, offsetCenter: [0, '-10%'], fontSize: 44, fontWeight: 800, fontFamily: "'Barlow Condensed', sans-serif", color: '#fff', formatter: (v) => v.toFixed(1) + '%' }, data: [{ value: +(value * 100).toFixed(1), name: label }] }],
  }, { alt });
}
export function histogram(el, values, { bins = 30, xName = 'Margin', color = '#3D7BFF', alt, marker, formatter } = {}) {
  const min = Math.min(...values), max = Math.max(...values), w = (max - min) / bins || 1;
  const counts = new Array(bins).fill(0); values.forEach(v => { const i = Math.min(bins - 1, Math.floor((v - min) / w)); counts[i]++; });
  const x = counts.map((_, i) => (min + (i + .5) * w).toFixed(1));
  return initChart(el, {
    tooltip: tooltipBase({ formatter: (p) => `${xName} ≈ ${p[0].axisValue}<br/>${p[0].value} simulations (${(p[0].value / values.length * 100).toFixed(1)}%)` }),
    grid: gridBase({ left: 44, bottom: 40 }),
    xAxis: { type: 'category', data: x, name: xName, nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: '#B3BCCB', fontFamily: MONO, fontSize: 11 }, ...axisBase({ axisLabel: { color: '#74809A', fontFamily: MONO, fontSize: 10, interval: Math.floor(bins / 8) } }) },
    yAxis: { type: 'value', ...axisBase() },
    series: [{ type: 'bar', data: counts.map((c, i) => ({ value: c, itemStyle: { color: (min + (i + .5) * w) >= 0 ? color : '#F0506E' } })), barCategoryGap: '8%', markLine: marker != null ? { symbol: 'none', silent: true, data: [{ xAxis: Math.round((marker - min) / w) }], lineStyle: { color: '#F5B301', width: 2 }, label: { formatter: `${marker > 0 ? '+' : ''}${marker.toFixed(1)}`, color: '#F5B301', fontFamily: MONO } } : undefined }],
  }, { alt });
}
export function calendar(el, data, { range, alt } = {}) {
  // data: [[yyyy-mm-dd, value(1 win / -1 loss), label]]
  return initChart(el, {
    tooltip: tooltipBase({ trigger: 'item', formatter: (p) => p.data[2] || p.data[0] }),
    visualMap: { show: false, min: -1, max: 1, inRange: { color: ['#F0506E', '#1A1F2B', '#2DD4A0'] } },
    calendar: { range, cellSize: ['auto', 18], left: 44, right: 16, top: 40, itemStyle: { color: 'rgba(255,255,255,.03)', borderColor: 'rgba(6,8,14,.9)', borderWidth: 2 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,.14)' } }, dayLabel: { color: '#74809A', fontFamily: MONO, fontSize: 10, nameMap: ['S', 'M', 'T', 'W', 'T', 'F', 'S'] }, monthLabel: { color: '#B3BCCB', fontFamily: MONO, fontSize: 11 }, yearLabel: { show: false } },
    series: [{ type: 'heatmap', coordinateSystem: 'calendar', data }],
  }, { alt });
}
export function probDistribution(el, mu, sigma, { alt } = {}) {
  const xs = []; const ys = []; for (let x = mu - 3.5 * sigma; x <= mu + 3.5 * sigma; x += sigma / 12) { xs.push(x.toFixed(1)); ys.push(Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI))); }
  return initChart(el, {
    tooltip: tooltipBase({ formatter: (p) => `Margin ${p[0].axisValue}: density ${(+p[0].value).toFixed(4)}` }),
    grid: gridBase({ left: 44, bottom: 36 }),
    xAxis: { type: 'category', data: xs, name: 'Home margin', nameLocation: 'middle', nameGap: 24, nameTextStyle: { color: '#B3BCCB', fontFamily: MONO, fontSize: 11 }, ...axisBase({ axisLabel: { color: '#74809A', fontFamily: MONO, fontSize: 10, interval: 11 } }) },
    yAxis: { type: 'value', show: false },
    series: [{ type: 'line', data: ys.map((y, i) => ({ value: y, itemStyle: { color: +xs[i] >= 0 ? '#3D7BFF' : '#F0506E' } })), smooth: true, showSymbol: false, lineStyle: { color: '#9fc4ff', width: 2 }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: 'rgba(240,80,110,.35)' }, { offset: Math.max(0, Math.min(1, (0 - (mu - 3.5 * sigma)) / (7 * sigma))), color: 'rgba(240,80,110,.35)' }, { offset: Math.max(0, Math.min(1, (0 - (mu - 3.5 * sigma)) / (7 * sigma))), color: 'rgba(61,123,255,.35)' }, { offset: 1, color: 'rgba(61,123,255,.35)' }] } }, markLine: { symbol: 'none', silent: true, data: [{ xAxis: xs.findIndex(x => +x >= 0) }], lineStyle: { color: '#fff', type: 'dashed' }, label: { formatter: 'tie', color: '#fff', fontFamily: MONO } } }],
  }, { alt });
}
