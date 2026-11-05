import { h } from '../core/dom.js';
import { manifest } from '../core/api.js';
import { fmt } from '../core/format.js';
export async function mountFooter(el) {
  const m = await manifest().catch(() => ({}));
  el.append(h('div', { class: 'inner' },
    h('div', null, h('h4', null, 'COURTVISION AI'), h('p', null, 'Beyond the Box Score. Every Possession Tells a Story.'), h('p', null, 'A personal educational data-science portfolio project. Not affiliated with the NBA or any team. No gambling content; predictions are statistical estimates, never guarantees.'),
      h('p', { class: 'mono small' }, `Data snapshot: ${m.generated_at ? fmt.datetime(m.generated_at) : 'n/a'} · Season ${m.season || ''}`)),
    h('div', null, h('h4', null, 'Explore'), ['#/teams|Teams', '#/players|Players', '#/live|Live Games', '#/predictions|Prediction Lab', '#/compare|Matchup Lab', '#/datalab|Data Science Lab'].map(s => { const [href, t] = s.split('|'); return h('a', { href }, t); })),
    h('div', null, h('h4', null, 'Sources & credits'), h('a', { href: 'https://www.nba.com/stats', target: '_blank', rel: 'noopener' }, 'NBA Stats (definitions, statistics)'), h('a', { href: 'https://github.com/swar/nba_api', target: '_blank', rel: 'noopener' }, 'nba_api (research client)'), h('a', { href: 'https://www.espn.com/nba/', target: '_blank', rel: 'noopener' }, 'ESPN (live scores)'), h('p', { class: 'small' }, 'Team logos and player headshots are served from NBA.com CDN and remain the property of NBA Properties and the teams. Full-body player photos were supplied for this project; all other players use NBA.com headshots.'), h('a', { href: '#/models' }, 'Model documentation & accuracy'))
  ));
}
