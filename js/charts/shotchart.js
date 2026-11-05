/**
 * D3 half-court shot chart. Coordinates follow NBA Stats: LOC_X ∈ [-250, 250], LOC_Y ∈ [-50, 420+]
 * in tenths of feet with the basket at (0, 0); LOC_X is positive to the shooter's RIGHT when facing the basket.
 * The chart is drawn with the basket at the bottom, i.e. seen from behind the basket with the shooter facing the viewer,
 * so the lateral axis is flipped: the shooter's right (+LOC_X, "Right Corner 3") lands on the viewer's left.
 * Modes: individual shots, zone efficiency vs league, hex density.
 */
import * as d3 from 'd3';

const ZONE_ORDER = ['Restricted Area', 'In The Paint (Non-RA)', 'Mid-Range', 'Left Corner 3', 'Right Corner 3', 'Above the Break 3'];
export function zoneSummary(shots, league) {
  const by = d3.rollup(shots, v => ({ fga: v.length, fgm: d3.sum(v, s => s.SHOT_MADE_FLAG), pts: d3.sum(v, s => s.SHOT_MADE_FLAG * (s.SHOT_TYPE?.startsWith('3') ? 3 : 2)) }), s => s.SHOT_ZONE_BASIC);
  const lg = new Map();
  (league || []).forEach(r => { const z = r.SHOT_ZONE_BASIC; const cur = lg.get(z) || { fga: 0, fgm: 0 }; lg.set(z, { fga: cur.fga + r.FGA, fgm: cur.fgm + r.FGM }); });
  const total = shots.length || 1;
  return ZONE_ORDER.filter(z => by.has(z) || lg.has(z)).map(z => { const t = by.get(z) || { fga: 0, fgm: 0, pts: 0 }; const l = lg.get(z); return { zone: z, fga: t.fga, fgm: t.fgm, pct: t.fga ? t.fgm / t.fga : null, pps: t.fga ? t.pts / t.fga : null, freq: t.fga / total, league: l && l.fga ? l.fgm / l.fga : null }; });
}
export function renderShotChart(el, shots, { league = [], mode = 'shots', title = '', color = '#3D7BFF' } = {}) {
  el.innerHTML = '';
  const W = 500, H = 470;
  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', title || 'Shot chart').style('width', '100%').style('height', 'auto').style('max-height', '560px');
  const x = d3.scaleLinear().domain([250, -250]).range([0, W]);           // flipped: seen from behind the basket
  const y = d3.scaleLinear().domain([-47.5, 422.5]).range([H - 10, 10]);        // basket near the bottom
  const g = svg.append('g');
  g.append('rect').attr('x', 0).attr('y', 0).attr('width', W).attr('height', H).attr('rx', 14).attr('fill', '#17110b');
  // hardwood strips
  for (let i = 0; i < W; i += 24) g.append('rect').attr('x', i).attr('y', 0).attr('width', 12).attr('height', H).attr('fill', 'rgba(255,220,180,.025)');
  const L = g.append('g').attr('fill', 'none').attr('stroke', 'rgba(143,188,255,.7)').attr('stroke-width', 1.6);
  const r = (ft) => Math.abs(x(ft * 10) - x(0)), left = (a, b) => Math.min(x(a), x(b));   // widths stay positive whichever way the axis runs
  // key and paint
  L.append('rect').attr('x', left(-80, 80)).attr('y', y(142.5)).attr('width', r(16)).attr('height', y(-47.5) - y(142.5)).attr('fill', 'rgba(61,123,255,.08)');
  L.append('rect').attr('x', left(-60, 60)).attr('y', y(142.5)).attr('width', r(12)).attr('height', y(-47.5) - y(142.5));
  L.append('circle').attr('cx', x(0)).attr('cy', y(142.5)).attr('r', r(6));
  L.append('circle').attr('cx', x(0)).attr('cy', y(0)).attr('r', r(0.75)).attr('stroke', '#f26b1f').attr('stroke-width', 2);
  L.append('line').attr('x1', x(-30)).attr('x2', x(30)).attr('y1', y(-7.5)).attr('y2', y(-7.5)).attr('stroke', '#ddd');
  L.append('path').attr('d', d3.arc()({ innerRadius: r(4), outerRadius: r(4), startAngle: -Math.PI / 2, endAngle: Math.PI / 2 })).attr('transform', `translate(${x(0)},${y(0)})`);
  // three-point line
  const a = Math.acos(22 / 23.75);
  const arc = d3.arc()({ innerRadius: r(23.75), outerRadius: r(23.75), startAngle: -(Math.PI / 2 - a), endAngle: (Math.PI / 2 - a) });
  L.append('path').attr('d', arc).attr('transform', `translate(${x(0)},${y(0)})`);
  L.append('line').attr('x1', x(-220)).attr('x2', x(-220)).attr('y1', y(-47.5)).attr('y2', y(92.5));
  L.append('line').attr('x1', x(220)).attr('x2', x(220)).attr('y1', y(-47.5)).attr('y2', y(92.5));
  L.append('path').attr('d', d3.arc()({ innerRadius: r(6), outerRadius: r(6), startAngle: Math.PI / 2, endAngle: Math.PI * 1.5 })).attr('transform', `translate(${x(0)},${y(422.5)})`);
  L.append('rect').attr('x', 0).attr('y', y(422.5)).attr('width', W).attr('height', y(-47.5) - y(422.5));
  const tip = d3.select(el).append('div').attr('class', 'shot-tip').style('position', 'absolute').style('pointer-events', 'none').style('opacity', 0);
  el.style.position = 'relative';
  if (mode === 'zones') {
    const zs = zoneSummary(shots, league);
    const zoneShapes = {
      'Restricted Area': () => g.append('circle').attr('cx', x(0)).attr('cy', y(0)).attr('r', r(4)),
      'In The Paint (Non-RA)': () => g.append('rect').attr('x', left(-80, 80)).attr('y', y(142.5)).attr('width', r(16)).attr('height', y(-47.5) - y(142.5)),
      'Mid-Range': () => g.append('path').attr('d', d3.arc()({ innerRadius: r(8), outerRadius: r(23.5), startAngle: -(Math.PI / 2 - a), endAngle: (Math.PI / 2 - a) })).attr('transform', `translate(${x(0)},${y(0)})`),
      'Left Corner 3': () => g.append('rect').attr('x', left(-250, -220)).attr('y', y(92.5)).attr('width', r(3)).attr('height', y(-47.5) - y(92.5)),      // shooter's left → viewer's right
      'Right Corner 3': () => g.append('rect').attr('x', left(220, 250)).attr('y', y(92.5)).attr('width', r(3)).attr('height', y(-47.5) - y(92.5)),
      'Above the Break 3': () => g.append('path').attr('d', d3.arc()({ innerRadius: r(24), outerRadius: r(34), startAngle: -(Math.PI / 2 - a), endAngle: (Math.PI / 2 - a) })).attr('transform', `translate(${x(0)},${y(0)})`),
    };
    const colorScale = d3.scaleLinear().domain([-0.12, 0, 0.12]).range(['#F0506E', '#2a3142', '#2DD4A0']).clamp(true);
    zs.forEach(z => {
      const diff = z.pct != null && z.league != null ? z.pct - z.league : 0;
      const shape = zoneShapes[z.zone]?.(); if (!shape) return;
      shape.attr('fill', z.fga ? colorScale(diff) : 'rgba(255,255,255,.04)').attr('fill-opacity', .7).attr('stroke', 'rgba(255,255,255,.25)').style('cursor', 'help')
        .on('mousemove', (ev) => { tip.style('opacity', 1).style('left', ev.offsetX + 12 + 'px').style('top', ev.offsetY + 12 + 'px').html(`<b>${z.zone}</b><br/>${z.fgm}/${z.fga} · ${z.pct != null ? (z.pct * 100).toFixed(1) + '%' : '—'}<br/>League ${z.league != null ? (z.league * 100).toFixed(1) + '%' : '—'} · ${z.pps != null ? z.pps.toFixed(2) + ' pts/shot' : ''}<br/>${(z.freq * 100).toFixed(0)}% of attempts`); })
        .on('mouseleave', () => tip.style('opacity', 0));
    });
    g.append('text').attr('x', 12).attr('y', 22).attr('fill', '#B3BCCB').attr('font-size', 11).attr('font-family', 'JetBrains Mono').text('Zone FG% vs league: green = above, red = below');
  } else if (mode === 'heat') {
    const hex = d3.hexbin ? null : null;      // d3 core has no hexbin; use rectangular bins
    const bx = 25, by = 25; const bins = new Map();
    shots.forEach(s => { const k = `${Math.floor(s.LOC_X / bx)}_${Math.floor(s.LOC_Y / by)}`; const b = bins.get(k) || { n: 0, m: 0, x: Math.floor(s.LOC_X / bx) * bx, y: Math.floor(s.LOC_Y / by) * by }; b.n++; b.m += s.SHOT_MADE_FLAG; bins.set(k, b); });
    const max = d3.max([...bins.values()], b => b.n) || 1;
    const col = d3.scaleSequential(d3.interpolateRgb('#1a2238', '#f26b1f')).domain([0, max]);
    bins.forEach(b => { g.append('rect').attr('x', left(b.x, b.x + bx)).attr('y', y(b.y + by)).attr('width', r(bx / 10)).attr('height', y(0) - y(by)).attr('fill', col(b.n)).attr('fill-opacity', .85).attr('rx', 2).on('mousemove', (ev) => tip.style('opacity', 1).style('left', ev.offsetX + 12 + 'px').style('top', ev.offsetY + 12 + 'px').html(`${b.n} attempts · ${b.m} made (${(b.m / b.n * 100).toFixed(0)}%)`)).on('mouseleave', () => tip.style('opacity', 0)); });
  } else {
    const made = shots.filter(s => s.SHOT_MADE_FLAG), miss = shots.filter(s => !s.SHOT_MADE_FLAG);
    g.selectAll('.miss').data(miss).join('circle').attr('cx', d => x(d.LOC_X)).attr('cy', d => y(d.LOC_Y)).attr('r', 4).attr('fill', 'none').attr('stroke', '#F0506E').attr('stroke-width', 1.4).attr('opacity', .8);
    g.selectAll('.made').data(made).join('circle').attr('cx', d => x(d.LOC_X)).attr('cy', d => y(d.LOC_Y)).attr('r', 4).attr('fill', color).attr('stroke', '#fff').attr('stroke-width', .6).attr('opacity', .95);
    g.selectAll('circle.hit').data(shots).join('circle').attr('class', 'hit').attr('cx', d => x(d.LOC_X)).attr('cy', d => y(d.LOC_Y)).attr('r', 7).attr('fill', 'transparent').style('cursor', 'crosshair')
      .on('mousemove', (ev, d) => tip.style('opacity', 1).style('left', ev.offsetX + 12 + 'px').style('top', ev.offsetY + 12 + 'px').html(`<b>${d.SHOT_MADE_FLAG ? 'Made' : 'Missed'}</b> ${d.ACTION_TYPE}<br/>${d.SHOT_DISTANCE} ft · ${d.SHOT_ZONE_BASIC}<br/>Q${d.PERIOD} ${d.MINUTES_REMAINING}:${String(d.SECONDS_REMAINING).padStart(2, '0')} · ${d.GAME_DATE?.slice(0, 4)}-${d.GAME_DATE?.slice(4, 6)}-${d.GAME_DATE?.slice(6, 8)} ${d.HTM} v ${d.VTM}`))
      .on('mouseleave', () => tip.style('opacity', 0));
    g.append('text').attr('x', 12).attr('y', 22).attr('fill', '#B3BCCB').attr('font-size', 11).attr('font-family', 'JetBrains Mono').text(`${made.length}/${shots.length} FG · ${shots.length ? (made.length / shots.length * 100).toFixed(1) : 0}%`);
  }
  g.append('text').attr('x', W - 12).attr('y', 22).attr('text-anchor', 'end').attr('fill', '#7E7A73').attr('font-size', 10).attr('font-family', 'Inter, system-ui, sans-serif').text('Seen from behind the basket · the shooter’s right is on your left');
  return svg.node();
}
