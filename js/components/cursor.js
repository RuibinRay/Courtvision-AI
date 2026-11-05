/**
 * Basketball cursor + magnetic wordmark (desktop, fine pointer, full motion only).
 *   · the ball follows the pointer with a short lag and rolls with its own travel (rotation = distance / radius)
 *   · it shrinks to a target ring over links and buttons, grows over the wordmark ("aim"), dribbles on press,
 *     disappears over text fields and when the pointer leaves the window
 *   · the wordmark's letters are drawn toward the pointer inside a radius and ease back when it leaves
 * One requestAnimationFrame loop drives both; transform-only; the loop sleeps once everything has settled.
 */
import { h } from '../core/dom.js';

const BALL = `<svg viewBox="0 0 24 24" aria-hidden="true"><defs><radialGradient id="cvb" cx="35%" cy="30%" r="78%"><stop offset="0" stop-color="#ffa86e"/><stop offset=".55" stop-color="#e8622a"/><stop offset="1" stop-color="#6e2a0c"/></radialGradient></defs><circle cx="12" cy="12" r="11.4" fill="url(#cvb)"/><g fill="none" stroke="#24100a" stroke-width="1.15" stroke-linecap="round"><path d="M12 .8v22.4M.8 12h22.4"/><path d="M4.4 4.3c2.9 2.7 2.9 12.7 0 15.4M19.6 4.3c-2.9 2.7-2.9 12.7 0 15.4"/></g></svg>`;
const lerp = (a, b, t) => a + (b - a) * t;
const RADIUS = 11;               // ball radius in px (rolling without slipping)

export function mountCursor({ magnet = null } = {}) {
  if (!matchMedia('(pointer: fine)').matches || document.body.classList.contains('reduced-motion')) return null;
  const orb = h('span', { class: 'orb', html: BALL });
  const ball = h('div', { class: 'cv-ball off', 'aria-hidden': 'true' }, h('span', { class: 'ring' }), h('span', { class: 'scaler' }, orb));
  document.body.append(ball); document.body.classList.add('has-ball');

  let px = -100, py = -100, bx = -100, by = -100, angle = 0, raf = 0, idle = 0, state = '', aim = false;
  const letters = magnet ? magnet.items.map(el => ({ el, x: 0, y: 0, r: 0, tx: 0, ty: 0, tr: 0, cx: 0, cy: 0 })) : [];
  const R = 190, PULL = 22;        // magnet radius / max displacement (px)
  let zone = null;                 // the wordmark's bounds, padded by the radius

  const setState = (s) => { if (s === state) return; if (state) ball.classList.remove(state); state = s; if (s) ball.classList.add(s); };
  const measure = () => {
    if (!magnet) return;
    const r = magnet.el.getBoundingClientRect();
    zone = r.width ? { l: r.left - R, t: r.top - R * .6, r: r.right + R, b: r.bottom + R * .6 } : null;
  };
  const tick = () => {
    raf = 0;
    let moving = false;
    const prev = bx;
    bx = lerp(bx, px, .3); by = lerp(by, py, .3);
    if (Math.abs(px - bx) > .05 || Math.abs(py - by) > .05) moving = true;
    angle += (bx - prev) / RADIUS * 57.2958;
    ball.style.transform = `translate3d(${bx.toFixed(2)}px,${by.toFixed(2)}px,0)`;
    orb.style.transform = `rotate(${angle.toFixed(1)}deg)`;
    if (letters.length) {
      if (idle % 12 === 0) measure();
      const inside = !!zone && px > zone.l && px < zone.r && py > zone.t && py < zone.b;
      if (inside) {
        for (const L of letters) {
          const b = L.el.getBoundingClientRect(); L.cx = b.left + b.width / 2 - L.x; L.cy = b.top + b.height / 2 - L.y;   // rest centre
          const dx = px - L.cx, dy = py - L.cy, d = Math.hypot(dx, dy) || 1, f = d < R ? (1 - d / R) ** 2 : 0;
          L.tx = dx / d * f * PULL; L.ty = dy / d * f * PULL; L.tr = -dx / R * f * 9;
        }
      } else for (const L of letters) { L.tx = L.ty = L.tr = 0; }
      for (const L of letters) {
        L.x = lerp(L.x, L.tx, .16); L.y = lerp(L.y, L.ty, .16); L.r = lerp(L.r, L.tr, .16);
        if (Math.abs(L.x - L.tx) > .03 || Math.abs(L.y - L.ty) > .03 || Math.abs(L.r - L.tr) > .03) moving = true;
        L.el.style.transform = `translate3d(${L.x.toFixed(2)}px,${L.y.toFixed(2)}px,0) rotate(${L.r.toFixed(2)}deg)`;
      }
      if (inside !== aim) { aim = inside; ball.classList.toggle('aim', aim); }
    }
    idle++;
    if (moving || idle < 20) raf = requestAnimationFrame(tick);
  };
  const wake = () => { idle = 0; if (!raf) raf = requestAnimationFrame(tick); };
  const onMove = (e) => { px = e.clientX; py = e.clientY; if (ball.classList.contains('off')) { bx = px; by = py; ball.classList.remove('off'); } wake(); };
  const onOver = (e) => {
    const t = e.target instanceof Element ? e.target : null; if (!t) return;
    if (t.closest('input,textarea,select,[contenteditable="true"]')) setState('text');
    else if (t.closest('a,button,[role="button"],summary,label,.team-logo')) setState('link');
    else setState('');
  };
  const onDown = () => ball.classList.add('press'), onUp = () => ball.classList.remove('press');
  const onLeave = (e) => { if (!e.relatedTarget && !e.toElement) ball.classList.add('off'); };
  const onBlur = () => ball.classList.add('off');
  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerover', onOver, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true }); window.addEventListener('pointerup', onUp, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave); window.addEventListener('blur', onBlur);
  window.addEventListener('resize', measure, { passive: true });
  measure();
  return {
    destroy() {
      cancelAnimationFrame(raf); raf = 0;
      window.removeEventListener('pointermove', onMove); document.removeEventListener('pointerover', onOver);
      window.removeEventListener('pointerdown', onDown); window.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('mouseleave', onLeave); window.removeEventListener('blur', onBlur); window.removeEventListener('resize', measure);
      ball.remove(); document.body.classList.remove('has-ball');
      for (const L of letters) L.el.style.transform = '';
    },
  };
}
