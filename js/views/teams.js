import { h } from '../core/dom.js';
import { mountExplorer } from '../components/explorer.js';
import { manifest } from '../core/api.js';
import { fmt } from '../core/format.js';
export const title = 'Teams';
export async function render(el) {
  const m = await manifest();
  el.append(h('div', { class: 'container' },
    h('div', { class: 'page-head' }, h('div', null, h('p', { class: 'eyebrow' }, h('b', null, 'All 30 teams'), h('span', { id: 'standSrc' }, ` · statistics as of ${fmt.date(m.generated_at)}`)), h('h1', null, 'The ', h('em', null, 'League'))), h('p', { class: 'lead' }, 'Two conferences, six divisions, thirty dashboards. Hover to preview a team, click to open its analytics.')),
    h('div', { id: 'explorer-root' })));
  await mountExplorer(el.querySelector('#explorer-root'), { heading: false, standings: true });
  el.append(h('div', { class: 'container', style: { padding: '24px 0 60px' } }, h('p', { class: 'source' }, 'Ratings: NBA Stats snapshot (regular season); records are refreshed live when the ESPN feed is reachable. Net rating = offensive rating − defensive rating per 100 possessions.')));
}
