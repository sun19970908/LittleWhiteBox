/* eslint-disable */
import { $ as Wt, A as yn, D as He, E as Ye, I as tn, J as Vn, M as qt, N as Gn, P as _t, Q as bn, R as Ot, S as E, T as Ze, U as Oe, V as P, W as wn, X as pe, at as Ht, b as Pt, c as Bs, ct as qs, d as an, dt as na, ft as C, h as re, i as xn, l as Yn, lt as m, m as ut, p as Ws, q as Qn, r as Kn, rt as B, ut as At, v as X, x as Y, y as k } from "./xiaobai-os-app-navigation-Dv7QNwzp.js";
import { t as gt } from "./xiaobai-os-_plugin-vue_export-helper-Dj7HTbfw.js";
import { n as Hs, r as Ta, t as Vs } from "./xiaobai-os-composer-keyboard-COt-GHsA.js";
import { t as Gs } from "./xiaobai-os-constants-CDXgazQ7.js";
import { C as Jt, Ct as Ys, Ft as Mn, Lt as rt, Pt as Qs, S as Ks, St as Xn, T as kn, Tt as Xs, X as dt, Y as Jn, Z as Js, _ as Na, _t as er, a as ma, bt as ja, d as nn, et as es, h as tr, kt as ar, l as nr, n as ts, o as sr, p as rr, st as as, vt as or, w as ns, wt as _n, x as ir, xt as sn, y as Sn, yt as lr } from "./xiaobai-os-three.module-Ah3xIFOr.js";
import { t as ss } from "./xiaobai-os-BufferGeometryUtils-BLglYbHr.js";
import { C as cr, S as xe, _ as rs, a as wt, b as Lt, c as he, d as Rn, f as ue, g as ur, h as de, i as la, l as Z, m as st, n as Da, o as Et, p as Fa, r as Bt, s as dr, t as te, u as os, v as Ee, w as is, x as ls, y as Q } from "./xiaobai-os-copy-3NrdXA9U.js";
function xa(e) {
  return e.seed = Math.imul(e.seed, 1664525) + 1013904223 >>> 0, e.seed / 4294967296;
}
function hr(e, t, s) {
  const a = [...t], n = [];
  for (; a.length && n.length < s; ) n.push(a.splice(Math.floor(xa(e) * a.length), 1)[0]);
  return n;
}
function Oa() {
  return Array.from(crypto.getRandomValues(new Uint32Array(4)), (e) => e.toString(16).padStart(8, "0")).join("");
}
function be(e, t) {
  throw Object.assign(/* @__PURE__ */ new Error(`expedition_${e}`), {
    code: `expedition_${e}`,
    ...t === void 0 ? {} : { cause: t }
  });
}
function Cn(e) {
  return !e || e.location.scene === "camp" && e.phase === "exploration";
}
var nt = {
  traveler: {
    price: 0,
    achievement: null,
    fabric: "#326d9f",
    metal: "#d5b77b",
    glow: "#a7def3",
    silhouette: "cloak",
    head: "none"
  },
  guardian: {
    price: 0,
    achievement: "boss-0",
    fabric: "#278c7f",
    metal: "#d9bb75",
    glow: "#99e2c5",
    silhouette: "armor",
    head: "helm"
  },
  moonweaver: {
    price: 0,
    achievement: "boss-1",
    fabric: "#7863b4",
    metal: "#ddd9ed",
    glow: "#bdceff",
    silhouette: "robe",
    head: "hat"
  },
  sovereign: {
    price: 0,
    achievement: "boss-2",
    fabric: "#973f59",
    metal: "#e3bd64",
    glow: "#ffe4a4",
    silhouette: "armor",
    head: "crown"
  },
  ranger: {
    price: 180,
    achievement: null,
    fabric: "#387759",
    metal: "#d2b989",
    glow: "#c8ebad",
    silhouette: "hood",
    head: "hood"
  },
  paladin: {
    price: 320,
    achievement: null,
    fabric: "#e9e6d4",
    metal: "#a1b9c5",
    glow: "#e8dba3",
    silhouette: "armor",
    head: "helm"
  },
  witch: {
    price: 240,
    achievement: null,
    fabric: "#383b69",
    metal: "#cda56d",
    glow: "#b9a6f3",
    silhouette: "robe",
    head: "hat"
  },
  assassin: {
    price: 280,
    achievement: null,
    fabric: "#343947",
    metal: "#d88675",
    glow: "#ce9cac",
    silhouette: "hood",
    head: "hood"
  },
  machinist: {
    price: 260,
    achievement: null,
    fabric: "#b67745",
    metal: "#3f636c",
    glow: "#b0eff1",
    silhouette: "coat",
    head: "goggles"
  },
  beastcaller: {
    price: 300,
    achievement: null,
    fabric: "#70906b",
    metal: "#ece0b7",
    glow: "#c5e895",
    silhouette: "cloak",
    head: "horns"
  },
  frostbound: {
    price: 420,
    achievement: null,
    fabric: "#8dbbc7",
    metal: "#e4eef0",
    glow: "#c3fbff",
    silhouette: "coat",
    head: "crown"
  },
  stargazer: {
    price: 480,
    achievement: null,
    fabric: "#504881",
    metal: "#d4bc8c",
    glow: "#ddcbff",
    silhouette: "robe",
    head: "crown"
  }
};
function Za(e, t) {
  const s = nt[t];
  return t === "traveler" || e.purchases.some((a) => a.id === t) || s.achievement !== null && e.awards.some((a) => a.key === s.achievement);
}
var me = (e, t, s = 0) => ({
  family: e,
  chapter: s,
  ...t ? { requires: [t] } : {}
}), ne = (e, t = 0) => ({
  family: e,
  weapons: [e],
  chapter: t
}), sa = {
  "storm-step": me("storm"),
  conductor: me("storm", [
    "storm-step",
    "orbit",
    "momentum",
    "command"
  ]),
  momentum: me("storm"),
  cinder: me("fire"),
  wildfire: me("fire", ["cinder", "inferno"]),
  "blood-price": me("risk"),
  frost: me("frost"),
  shatter: me("frost", [
    "frost",
    "nova",
    "pinning",
    "trapper",
    "orbitals"
  ]),
  echo: me("skill"),
  hunter: {
    ...me("bow"),
    weapons: [
      "bow",
      "staff",
      "grimoire",
      "cannon"
    ]
  },
  piercing: me("blade"),
  orbit: me("storm"),
  thorns: me("guard"),
  aegis: me("guard"),
  siphon: me("life"),
  focus: me("skill"),
  renewal: me("life"),
  execution: me("blade"),
  "last-stand": me("guard", void 0, 1),
  quicksilver: me("skill"),
  magnet: me("skill"),
  wardstone: me("guard"),
  pilgrim: me("life"),
  gambit: me("risk", void 0, 1),
  riposte: ne("blade"),
  "shield-break": ne("blade"),
  "cleave-wave": ne("blade", 1),
  duelist: ne("blade"),
  "blood-dance": ne("blade"),
  valor: ne("blade", 1),
  ricochet: ne("bow"),
  "split-arrow": ne("bow"),
  pinning: ne("bow"),
  "distance-draw": ne("bow"),
  "hunter-mark": ne("bow", 1),
  trapper: ne("bow"),
  nova: ne("staff"),
  inferno: {
    ...ne("staff"),
    requires: [["cinder"]]
  },
  fracture: {
    ...ne("staff"),
    requires: [[
      "frost",
      "nova",
      "orbitals"
    ]]
  },
  overload: {
    ...ne("staff", 1),
    requires: [["cinder"], [
      "frost",
      "nova",
      "orbitals"
    ]]
  },
  orbitals: ne("staff"),
  convergence: ne("staff"),
  backstab: ne("daggers"),
  shadowstep: ne("daggers"),
  hemorrhage: ne("daggers"),
  "execution-chain": ne("daggers", 1),
  smoke: ne("daggers"),
  venom: ne("daggers"),
  "pack-bond": ne("grimoire"),
  martyr: ne("grimoire"),
  covenant: ne("grimoire"),
  frenzy: ne("grimoire"),
  "soul-harvest": ne("grimoire", 1),
  command: ne("grimoire"),
  shrapnel: ne("cannon"),
  minefield: ne("cannon"),
  overclock: ne("cannon"),
  bunker: ne("cannon"),
  salvage: ne("cannon"),
  railgun: ne("cannon", 1)
}, z = (e, t) => e.relics.find((s) => s.id === t)?.rank ?? 0;
function fr(e) {
  return rs.filter((t) => !sa[t].weapons || sa[t].weapons.includes(e));
}
function cs(e, t, s = null) {
  const a = sa[t];
  return (!a.weapons || a.weapons.includes(e.weapon)) && (!a.requires || a.requires.every((n) => n.some((r) => r !== s && z(e, r) > 0)));
}
function Re(e) {
  throw Object.assign(/* @__PURE__ */ new Error(`expedition_world_${e}`), { code: `expedition_world_${e}` });
}
var pr = 1e-9;
function Vt(e, t, s) {
  return {
    x: e.origin.x + (t + 0.5) * e.cellSize,
    y: e.origin.y + (s + 0.5) * e.cellSize
  };
}
function Tt(e, t) {
  return {
    column: Math.floor((t.x - e.origin.x) / e.cellSize),
    row: Math.floor((t.y - e.origin.y) / e.cellSize)
  };
}
function us(e, t) {
  const s = e.rows[0]?.length ?? 0, a = e.rows.length;
  (!s || !a || !Number.isFinite(e.cellSize) || e.cellSize <= 0 || !Number.isFinite(e.origin.x) || !Number.isFinite(e.origin.y) || e.rows.some((o) => o.length !== s || /[^.# ]/.test(o))) && Re("map_invalid");
  const n = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set(), u = /* @__PURE__ */ new Set();
  for (const o of e.gates) {
    (!o.id || n.has(o.id) || !o.cells.length) && Re("map_invalid"), n.add(o.id);
    const c = !t.has(o.id);
    c && u.add(o.id);
    for (const { column: d, row: l } of o.cells) {
      (!Number.isInteger(d) || !Number.isInteger(l) || d < 0 || d >= s || e.rows[l]?.[d] !== ".") && Re("map_invalid");
      const h = l * s + d;
      r.has(h) && Re("map_invalid"), r.add(h), c && i.add(h);
    }
  }
  for (const o of t) n.has(o) || Re("gate_unknown");
  return {
    map: e,
    columns: s,
    rows: a,
    closedGates: u,
    blocked(o, c) {
      return o < 0 || o >= s || c < 0 || c >= a || e.rows[c][o] !== "." || i.has(c * s + o);
    }
  };
}
function va(e, t, s, a) {
  const n = Math.max(t - e.x, 0, e.x - t - a), r = Math.max(s - e.y, 0, e.y - s - a);
  return n * n + r * r;
}
function ca(e, t, s) {
  const a = s.x - t.x, n = s.y - t.y, r = a * a + n * n, i = r === 0 ? 0 : Math.max(0, Math.min(1, ((e.x - t.x) * a + (e.y - t.y) * n) / r));
  return (e.x - t.x - a * i) ** 2 + (e.y - t.y - n * i) ** 2;
}
function ds(e, t, s, a, n) {
  let r = 0, i = 1;
  for (const [u, o, c] of [[
    e.x,
    t.x - e.x,
    s
  ], [
    e.y,
    t.y - e.y,
    a
  ]]) if (o === 0) {
    if (u <= c || u >= c + n) return !1;
  } else {
    const d = (c - u) / o, l = (c + n - u) / o;
    if (r = Math.max(r, Math.min(d, l)), i = Math.min(i, Math.max(d, l)), r >= i) return !1;
  }
  return r < i;
}
function mr(e, t, s, a, n) {
  return ds(e, t, s, a, n) ? 0 : Math.min(va(e, s, a, n), va(t, s, a, n), ca({
    x: s,
    y: a
  }, e, t), ca({
    x: s + n,
    y: a
  }, e, t), ca({
    x: s,
    y: a + n
  }, e, t), ca({
    x: s + n,
    y: a + n
  }, e, t));
}
function $e(e, t, s, a = 0) {
  (![
    t.x,
    t.y,
    s.x,
    s.y,
    a
  ].every(Number.isFinite) || a < 0) && Re("input_invalid");
  const { map: n } = e, r = n.cellSize, i = Tt(n, {
    x: Math.min(t.x, s.x) - a,
    y: Math.min(t.y, s.y) - a
  }), u = Tt(n, {
    x: Math.max(t.x, s.x) + a,
    y: Math.max(t.y, s.y) + a
  });
  for (let o = i.row; o <= u.row; o++) for (let c = i.column; c <= u.column; c++) {
    if (!e.blocked(c, o)) continue;
    const d = n.origin.x + c * r, l = n.origin.y + o * r;
    if (a === 0 ? ds(t, s, d, l, r) || va(t, d, l, r) === 0 && va(s, d, l, r) === 0 : mr(t, s, d, l, r) < a * a - pr) return !1;
  }
  return !0;
}
var mt = (e, t, s) => $e(e, t, t, s);
function rn(e, t, s, a) {
  [s.x, s.y].every(Number.isFinite) || Re("input_invalid"), mt(e, t, a) || Re("position_blocked");
  const n = Math.hypot(s.x, s.y);
  if (n === 0) return;
  const r = Math.ceil(n / (e.map.cellSize / 4)), i = s.x / r, u = s.y / r;
  for (let o = 0; o < r; o++) {
    const c = {
      x: t.x + i,
      y: t.y + u
    };
    if ($e(e, t, c, a)) {
      Object.assign(t, c);
      continue;
    }
    const d = Math.abs(i) >= Math.abs(u) ? ["x", "y"] : ["y", "x"];
    for (const l of d) {
      const h = {
        ...t,
        [l]: t[l] + (l === "x" ? i : u)
      };
      $e(e, t, h, a) && Object.assign(t, h);
    }
  }
}
var Mt = Math.PI * 2, q = (e, t) => Math.hypot(e.x - t.x, e.y - t.y), ve = (e, t) => Math.atan2(t.y - e.y, t.x - e.x), on = (e) => (e - 1) * Math.PI / 4 - Math.PI / 2, Qe = (e, t, s) => ({
  x: e.x + Math.cos(t) * s,
  y: e.y + Math.sin(t) * s
});
function Xe(e, t, s, a, n, r) {
  if (r) {
    rn(r.space, t, {
      x: Math.cos(s) * a,
      y: Math.sin(s) * a
    }, n);
    return;
  }
  t.x += Math.cos(s) * a, t.y += Math.sin(s) * a;
  for (const i of e.obstacles) {
    const u = q(t, i), o = n + i.radius;
    if (u < o) {
      const c = u < 1e-3 ? s : ve(i, t);
      t.x = i.x + Math.cos(c) * o, t.y = i.y + Math.sin(c) * o;
    }
  }
  t.x = Math.max(-Q.arena + n, Math.min(Q.arena - n, t.x)), t.y = Math.max(-Q.arena + n, Math.min(Q.arena - n, t.y));
}
function vr(e, t, s, a) {
  const n = e.x - t.x, r = e.y - t.y, i = Math.max(0, Math.min(a, n * Math.cos(s) + r * Math.sin(s)));
  return Math.hypot(n - Math.cos(s) * i, r - Math.sin(s) * i);
}
var gr = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1]
], Ua = (e, t) => Math.hypot(t.x - e.x, t.y - e.y);
function ra(e, t, s, a) {
  if (!mt(e, t, a) || !mt(e, s, a)) return null;
  if ($e(e, t, s, a)) return [{ ...s }];
  const { map: n, columns: r, rows: i } = e, u = Tt(n, t), o = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Set(), l = [];
  function h(g) {
    return Vt(n, g % r, Math.floor(g / r));
  }
  function f(g, v, b, x) {
    if (g < 0 || g >= r || v < 0 || v >= i) return;
    const _ = v * r + g;
    d.has(_) || (o.get(_) ?? 1 / 0) <= b || (o.set(_, b), c.set(_, x), l.push({
      id: _,
      score: b + Ua(h(_), s)
    }));
  }
  for (let g = -1; g <= 1; g++) for (let v = -1; v <= 1; v++) {
    const b = u.column + v, x = u.row + g, _ = Vt(n, b, x);
    $e(e, t, _, a) && f(b, x, Ua(t, _), -1);
  }
  for (; l.length; ) {
    l.sort((b, x) => x.score - b.score || x.id - b.id);
    const { id: g } = l.pop();
    if (d.has(g)) continue;
    d.add(g);
    const v = h(g);
    if ($e(e, v, s, a)) {
      const b = [{ ...s }];
      let x = g;
      for (; x !== -1; )
        b.push(h(x)), x = c.get(x);
      b.reverse();
      const _ = [];
      let p = t;
      for (let w = 0; w < b.length; ) {
        let M = w;
        for (; M + 1 < b.length && $e(e, p, b[M + 1], a); ) M++;
        p = b[M], _.push(p), w = M + 1;
      }
      return _;
    }
    for (const [b, x] of gr) {
      const _ = g % r + b, p = Math.floor(g / r) + x, w = Vt(n, _, p);
      $e(e, v, w, a) && f(_, p, o.get(g) + Ua(v, w), g);
    }
  }
  return null;
}
var zn = (e) => !xe(e) || e === "warden" || e === "thornheart", ae = (e, t, s, a = 0) => !e || $e(e.space, t, s, a);
function yr(e, t, s) {
  return e.summonPoints.filter((a) => mt(e.space, a, s) && ra(e.space, e.entry, a, s)).sort((a, n) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(n.x - t.x, n.y - t.y))[0] ?? null;
}
function hs(e, t, s) {
  return !e || $e(e.space, t, s, 0.3) ? s : {
    x: t.x,
    y: t.y
  };
}
function fs(e, t, s, a) {
  if (!e) return Math.atan2(s.y - t.y, s.x - t.x);
  let n = s;
  if (!mt(e.space, n, a)) {
    const i = [], u = a + e.space.map.cellSize, o = Tt(e.space.map, {
      x: s.x - u,
      y: s.y - u
    }), c = Tt(e.space.map, {
      x: s.x + u,
      y: s.y + u
    });
    for (let l = Math.max(0, o.row); l <= Math.min(e.space.rows - 1, c.row); l++) for (let h = Math.max(0, o.column); h <= Math.min(e.space.columns - 1, c.column); h++) {
      const f = Vt(e.space.map, h, l);
      Math.hypot(f.x - s.x, f.y - s.y) <= a + e.space.map.cellSize && mt(e.space, f, a) && $e(e.space, f, s) && i.push(f);
    }
    i.sort((l, h) => Math.hypot(l.x - s.x, l.y - s.y) - Math.hypot(h.x - s.x, h.y - s.y));
    const d = i.find((l) => ra(e.space, t, l, a));
    if (!d) return null;
    n = d;
  }
  const r = ra(e.space, t, n, a);
  return r?.length ? Math.atan2(r[0].y - t.y, r[0].x - t.x) : null;
}
function ge(e, t, s, a = 1, n = 0) {
  e.effects.push({
    id: ++e.serial,
    x: t.x,
    y: t.y,
    kind: s,
    size: a,
    angle: n,
    life: s === "slash" ? 9 : 15
  });
}
function ze(e, t, s, a) {
  if (!xe(t) && e.enemies.filter((i) => i.hp > 0).length >= Q.maxEnemies) return null;
  if (a) {
    const i = yr(a, s, de[t].radius);
    if (!i) return null;
    s = i;
  }
  const n = de[t].hp * (xe(t) ? 1 : 1 + e.chapter * 0.2 + (e.elite ? 0.25 : 0)), r = {
    id: ++e.serial,
    kind: t,
    x: s.x,
    y: s.y,
    hp: n,
    maxHp: n,
    angle: Math.PI / 2,
    cooldown: 35 + Math.floor(xa(e) * 20),
    windup: 0,
    target: { ...s },
    pattern: 0,
    phase: 1,
    chill: 0,
    burn: 0,
    marked: 0,
    stun: 0,
    bleed: 0,
    poison: 0,
    exposed: 0,
    motion: 0,
    motionAngle: 0,
    stagger: 0,
    memory: []
  };
  return e.enemies.push(r), r;
}
function ht(e, t, s, a, n, r = {}) {
  const i = {
    id: ++e.serial,
    x: t.x,
    y: t.y,
    angle: s,
    damage: a,
    friendly: n,
    source: "attack",
    pierce: 0,
    hits: [],
    speed: 0.22,
    life: 130,
    radius: 0.16,
    splash: 0,
    bounce: 0,
    ...r
  };
  return e.shots.push(i), i;
}
function fe(e, t, s, a, n, r, i, u = !1, o = {}) {
  const c = {
    id: ++e.serial,
    x: t.x,
    y: t.y,
    kind: s,
    radius: a,
    wait: n,
    life: r,
    damage: i,
    friendly: u,
    angle: 0,
    length: 0,
    width: 0.65,
    inner: 0,
    source: u ? "passive" : "attack",
    hits: [],
    ...o
  };
  return e.hazards.push(c), c;
}
function tt(e, t, s, a, n) {
  return fe(e, t, "slam", s, a, 8, n);
}
function Se(e, t, s, a, n, r, i) {
  return fe(e, t, "beam", 0, r, 9, i, !1, {
    angle: s,
    length: a,
    width: n
  });
}
function ct(e, t, s, a, n, r, i = 0.22) {
  for (let u = 0; u < a; u++) ht(e, t, s + (u / Math.max(1, a - 1) - 0.5) * n, r, !1, { speed: i });
}
function Pn(e, t, s, a, n, r = 0.16) {
  for (let i = 0; i < s; i++) ht(e, t, a + i * Mt / s, n, !1, { speed: r });
}
function Ba(e, t, s, a, n = 0) {
  const r = {
    id: ++e.serial,
    kind: t,
    x: s.x,
    y: s.y,
    hp: t === "turret" ? 65 : t === "familiar" ? st.familiarHp : 38,
    life: a,
    cooldown: 12,
    angle: 0,
    empowered: n
  };
  return e.companions.push(r), r;
}
var ua = (e) => e === "attack" || e === "skill";
function ps(e, t) {
  if (e.player.hp <= 0) return;
  const s = Math.min(Q.maxHp - e.player.hp, t);
  e.player.hp += s, s > 0 && ge(e, e.player, "heal");
}
function ft(e, t, s) {
  if (xe(t.kind)) {
    if (t.stagger += s, t.stagger < 100) return;
    t.stagger = 0, s = 24;
  }
  t.stun = Math.max(t.stun, s), t.windup = 0, t.motion = 0, t.cooldown = Math.max(20, t.cooldown), ge(e, t, "guard", 1.4);
}
function Ue(e, t, s, a, n, r = e.player, i) {
  if (t.hp <= 0 || !ae(i, r, t)) return;
  const u = t.burn > 0 || ua(n) && z(a, "cinder") > 0, o = t.chill > 0 || ua(n) && z(a, "frost") > 0, c = (n === "skill" || n === "companion" && a.weapon === "cannon") && o && z(a, "shatter") > 0, d = ua(n) && u && o && z(a, "overload") > 0;
  let l = s * (z(a, "blood-price") ? Ee.bloodDamage + (z(a, "blood-price") - 1) * 0.12 : 1);
  if (z(a, "execution") && t.hp / t.maxHp < Ee.executeThreshold && (l *= Ee.executeDamage + (z(a, "execution") - 1) * 0.1), t.exposed > 0 && (l *= 1.25), (t.kind === "guard" || i && t.kind === "warden") && n === "attack" && Math.cos(ve(t, r) - t.angle) > 0.4 && t.exposed <= 0 && (l *= z(a, "shield-break") ? 0.8 : 0.35), t.kind !== "priest" && !xe(t.kind) && e.enemies.some((h) => h.kind === "priest" && h.hp > 0 && q(t, h) < 3.5 && ae(i, t, h)) && (l *= 0.7), n === "attack" && z(a, "backstab") && Math.cos(ve(t, e.player) - t.angle) < -0.3 && (l *= 1.6 + z(a, "backstab") * 0.2, t.exposed = Math.max(t.exposed, 55)), n === "attack" && z(a, "duelist") && ft(e, t, 9 * z(a, "duelist")), c) {
    l += 15 * z(a, "shatter"), t.chill = 0, ge(e, t, "burst", 2.2);
    for (const h of e.enemies) h.id !== t.id && q(t, h) < 2.2 && Ue(e, h, 9 * z(a, "shatter"), a, "passive", t, i);
  }
  if (ua(n) && (z(a, "cinder") && (t.burn = Math.max(t.burn, 80 + z(a, "cinder") * 25)), z(a, "frost") && (t.chill = Math.max(t.chill, 45 + z(a, "frost") * 20)), (z(a, "blood-dance") || z(a, "hemorrhage")) && (t.bleed = 100 + 25 * (z(a, "blood-dance") + z(a, "hemorrhage"))), z(a, "venom") && (t.poison = 100 + z(a, "venom") * 35), d && (l += 20 * z(a, "overload"), ge(e, t, "lightning")), n === "skill" && z(a, "hunter-mark") && (t.exposed = Math.max(t.exposed, 100 + z(a, "hunter-mark") * 40)), z(a, "inferno") && u && n === "skill" && fe(e, t, "fire", 1.5 + z(a, "inferno") * 0.3, 0, 70, 4 * z(a, "inferno"), !0)), d && (t.burn = 0), (d || c) && (t.chill = 0), t.hp = Math.max(0, t.hp - l), t.marked = 5, n === "lightning" && z(a, "momentum") && e.tick % 6 === 0 && (e.player.dash = Math.max(0, e.player.dash - z(a, "momentum") * 2)), !(t.hp > 0)) {
    if (e.kills++, ge(e, t, "burst", xe(t.kind) ? 3 : 0.8), z(a, "wildfire") && u && fe(e, t, "fire", 1.8 + z(a, "wildfire") * 0.2, 0, 90, 3 * z(a, "wildfire"), !0), z(a, "fracture") && o) for (let h = 0; h < 4 + z(a, "fracture"); h++) ht(e, t, h * Mt / (4 + z(a, "fracture")), 9, !0, { source: "passive" });
    if (z(a, "siphon") && (e.kills % Ee.siphonEvery === 0 || xe(t.kind)) && ps(e, (xe(t.kind) ? Ee.siphonBossHeal : Ee.siphonHeal) + z(a, "siphon") - 1), z(a, "execution-chain") && (e.player.dash = Math.max(0, e.player.dash - 12 * z(a, "execution-chain")), e.player.skill = Math.max(0, e.player.skill - 8)), z(a, "soul-harvest") && (e.player.resource = Math.min(st.maxPower, e.player.resource + 9 * z(a, "soul-harvest"))), n === "companion" && z(a, "salvage") && (e.player.skill = Math.max(0, e.player.skill - 12 * z(a, "salvage"))), z(a, "magnet"))
      for (const h of e.enemies) h.hp > 0 && q(t, h) < 3 + z(a, "magnet") && ae(i, t, h) && Xe(e, h, ve(h, t), 0.7, de[h.kind].radius, i);
  }
}
function qa(e, t, s, a, n, r = e.player) {
  const i = [t];
  if (ae(n, r, t)) {
    z(s, "conductor") && i.push(...e.enemies.filter((u) => u.id !== t.id && u.hp > 0 && q(u, t) < 4.5 && ae(n, t, u)).sort((u, o) => q(u, t) - q(o, t)).slice(0, z(s, "conductor") + 1));
    for (const u of i)
      ge(e, u, "lightning"), Ue(e, u, a, s, "lightning", n ? u === t ? r : t : e.player, n);
  }
}
function ms(e, t, s) {
  const a = e.player, n = a.guard > 0;
  a.resource = Math.min(100, a.resource + (n ? 25 : 8)), ge(e, a, n ? "parry" : "block", n ? 2 : 1, a.facing), n && (a.skill = Math.max(35, a.skill - 15));
  const r = z(t, "riposte"), i = z(t, "thorns");
  if (r || i)
    for (const u of e.enemies) q(u, a) < 3.2 + r * 0.3 && ae(s, a, u) && (Ue(e, u, (n ? 20 : 8) * r + 9 * i, t, "passive", a, s), ft(e, u, n ? 20 : 7));
}
function Ma(e, t, s, a) {
  const n = e.player;
  if (n.invulnerable > 0 || n.hp <= 0) return;
  if (n.shield > 0) {
    ms(e, s, a), n.invulnerable = n.guard > 0 ? 8 : 4;
    return;
  }
  let r = t * Lt[s.weapon].guard * (z(s, "blood-price") ? Ee.bloodHurt : 1) * (z(s, "gambit") ? 1.2 : 1);
  const i = Math.min(n.ward, r);
  if (n.ward -= i, r -= i, n.hp <= r && z(s, "last-stand") && !n.rescues) {
    n.rescues++, n.hp = 15 + z(s, "last-stand") * 8, n.invulnerable = 60, ge(e, n, i > 0 ? "ward-break" : "guard", 3);
    return;
  }
  if (n.hp = Math.max(0, n.hp - r), e.damageTaken += r, n.invulnerable = 18, n.lastHit = e.tick, ge(e, n, i > 0 ? n.ward > 0 ? "ward-hit" : "ward-break" : "hit"), z(s, "thorns"))
    for (const u of e.enemies) q(u, n) < 3 && Ue(e, u, 10 * z(s, "thorns"), s, "passive", n, a);
}
function ea(e, t, s = 45) {
  e.ward += Math.max(0, Math.min(t, s - e.ward));
}
function $n(e, t, s, a = !1, n) {
  const r = Lt[t.weapon], i = e.player, u = ve(i, s), o = (a ? 0.6 : 1) * (z(t, "gambit") ? 1 + z(t, "gambit") * 0.12 : 1);
  if (i.facing = u, i.swing = t.weapon === "cannon" ? 15 : 8, t.weapon === "blade" || t.weapon === "daggers") {
    const h = r.range + z(t, "piercing") * 0.25;
    ge(e, i, "slash", h, u);
    for (const f of e.enemies)
      q(i, f) > h + de[f.kind].radius || Math.cos(ve(i, f) - u) < -0.1 || !ae(n, i, f) || (Ue(e, f, r.damage * o, t, "attack", i, n), t.weapon === "blade" && !a && i.combo % 3 === 2 && ft(e, f, 14));
    t.weapon === "blade" && (i.resource = Math.min(100, i.resource + 9), z(t, "cleave-wave") && i.combo % 3 === 2 && ht(e, i, u, 14 * z(t, "cleave-wave"), !0, {
      pierce: 5,
      radius: 0.4,
      speed: 0.3,
      source: "passive"
    }));
    return;
  }
  let c = r.damage * o;
  z(t, "distance-draw") && (c *= 1 + Math.min(1, q(i, s) / 8) * 0.15 * z(t, "distance-draw")), t.weapon === "staff" && (i.resource = Math.min(100, i.resource + 18)), t.weapon === "grimoire" && (i.resource = Math.min(st.maxPower, i.resource + 12));
  const d = z(t, "piercing") * Ee.extraPierce + z(t, "railgun") * 2, l = ht(e, i, u, c, !0, {
    pierce: d,
    speed: t.weapon === "bow" ? 0.38 : 0.28,
    splash: t.weapon === "staff" ? 1.4 : t.weapon === "cannon" ? 1.8 + z(t, "shrapnel") * 0.3 : 0,
    bounce: z(t, "ricochet"),
    radius: t.weapon === "cannon" ? 0.3 : 0.16
  });
  if (t.weapon === "bow" && z(t, "split-arrow") && i.combo % 3 === 2) for (const h of [-0.18, 0.18]) ht(e, i, u + h, c * (0.35 + z(t, "split-arrow") * 0.1), !0, {
    speed: l.speed,
    pierce: d
  });
}
function br(e, t, s, a) {
  const n = e.player, r = Lt[t.weapon], i = z(t, "focus");
  switch (n.skill = Math.round(r.skillCooldown * (i ? Ee.focusSkill - (i - 1) * 0.06 : 1)), z(t, "aegis") && (n.shield = 18 + z(t, "aegis") * 6, n.guard = 8, ea(n, z(t, "aegis") * 6)), t.weapon) {
    case "blade": {
      n.shield = 26 + z(t, "aegis") * 6, n.guard = 9;
      const u = 1 + n.resource / 100;
      n.resource = 0, ge(e, n, "slash", 3.6, n.facing);
      for (const o of e.enemies)
        o.hp <= 0 || q(n, o) > 3.6 + de[o.kind].radius || !ae(a, n, o) || (z(t, "shield-break") && (o.exposed = Math.max(o.exposed, 70 + 30 * z(t, "shield-break"))), Ue(e, o, r.skill * u, t, "skill", n, a), ft(e, o, 40), xe(o.kind) || Xe(e, o, ve(n, o), 1.5, de[o.kind].radius, a));
      z(t, "valor") && ea(n, 12 * z(t, "valor") * u);
      break;
    }
    case "bow":
      for (let u = -2; u <= 2; u++) ht(e, n, n.facing + u * 0.15, r.skill, !0, {
        pierce: 6,
        speed: 0.42,
        source: "skill"
      });
      Xe(e, n, n.facing + Math.PI, 0.85, Q.playerRadius, a);
      break;
    case "staff": {
      const u = s ?? n, o = 1 + n.resource / 125;
      if (n.resource = 0, z(t, "convergence"))
        for (const c of e.enemies) q(c, u) < 4 + z(t, "convergence") && ae(a, u, c) && Xe(e, c, ve(c, u), 1.2, de[c.kind].radius, a);
      for (let c = 0; c < 3; c++) {
        const d = Qe(u, c * Mt / 3, 0.7);
        fe(e, ae(a, u, d) ? d : u, "slam", 2.3, 10 + c * 10, 1, r.skill * o, !0, { source: "skill" });
      }
      if (z(t, "nova")) {
        fe(e, n, "frost", 3 + z(t, "nova") * 0.5, 0, 32, 6 * z(t, "nova"), !0, { source: "skill" });
        for (const c of e.enemies) q(n, c) < 3.5 && ae(a, n, c) && (c.chill = 120, ft(e, c, 25));
      }
      break;
    }
    case "daggers":
      if (n.invulnerable = Math.max(n.invulnerable, 12), s) {
        const u = Qe(s, s.angle + Math.PI, de[s.kind].radius + 0.55);
        Xe(e, n, ve(n, u), Math.min(5, q(n, u)), Q.playerRadius, a), n.facing = ve(n, s), ae(a, n, s) && (!a || q(n, s) <= r.range + de[s.kind].radius) && (s.exposed = Math.max(s.exposed, 60), Ue(e, s, r.skill, t, "skill", n, a), ft(e, s, 20)), ge(e, n, "slash", 2, n.facing);
      }
      z(t, "shadowstep") && Ba(e, "shade", n, 95 + z(t, "shadowstep") * 30, z(t, "shadowstep"));
      break;
    case "grimoire": {
      const u = n.resource;
      n.resource = 0, n.resonance = st.resonanceTicks + u, ge(e, n, "resonance", 2);
      for (const o of e.companions) o.kind === "familiar" && o.hp > 0 && o.life > 0 && (o.hp = Math.max(o.hp, st.familiarHp), o.cooldown = 0);
      s && (s.exposed = Math.max(s.exposed, 100), Ue(e, s, r.skill + u * 0.3, t, "skill", n, a)), z(t, "command") && fe(e, s ?? n, "storm", 2.4 + z(t, "command") * 0.3, 10, 65, 7 * z(t, "command"), !0, { source: "skill" });
      break;
    }
    case "cannon": {
      const u = 1 + (z(t, "overclock") >= 2 ? 1 : 0), o = e.companions.filter((c) => c.kind === "turret");
      o.length >= u && (o[0].life = 0), Ba(e, "turret", hs(a, n, Qe(n, n.facing, 0.9)), 240 + z(t, "overclock") * 45, z(t, "overclock")), z(t, "bunker") && ea(n, 15 * z(t, "bunker"));
      break;
    }
  }
}
function wr(e, t, s, a) {
  const n = e.player, r = z(s, "quicksilver");
  if (n.dash = Math.round(Q.dashCooldown * (1 - r * 0.08)), n.dashTime = Q.dashTicks, n.dashAngle = t.move ? on(t.move) : n.facing, n.invulnerable = Q.dashTicks + 2, z(s, "storm-step") && fe(e, n, "storm", 1.7 + z(s, "storm-step") * 0.15, 0, 70, 6 + z(s, "storm-step") * 3, !0), z(s, "trapper") && fe(e, n, "frost", 1.8, 12, 110, 5 * z(s, "trapper"), !0), z(s, "minefield") && fe(e, n, "mine", 2 + z(s, "minefield") * 0.2, 12, 180, 25 * z(s, "minefield"), !0), z(s, "smoke")) {
    for (const i of e.enemies) q(i, n) < 3 + z(s, "smoke") * 0.4 && ae(a, n, i) && (ft(e, i, 30 + z(s, "smoke") * 8), i.exposed = Math.max(i.exposed, 65));
    ge(e, n, "guard", 3);
  }
}
function xr(e, t, s, a) {
  const n = e.player;
  for (const c of [
    "attack",
    "dash",
    "skill",
    "invulnerable",
    "swing",
    "shield",
    "guard"
  ]) n[c] = Math.max(0, n[c] - 1);
  const r = e.enemies.filter((c) => c.hp > 0 && ae(a, n, c)).sort((c, d) => q(n, c) - q(n, d))[0];
  t.dash && !n.dash && !n.dashTime && wr(e, t, s, a);
  const i = {
    x: n.x,
    y: n.y
  };
  if (n.dashTime > 0)
    Xe(e, n, n.dashAngle, Q.speed * 3.6, Q.playerRadius, a), n.dashTime--, !n.dashTime && z(s, "momentum") && r && q(n, r) < 3 && qa(e, r, s, 10 + z(s, "momentum") * 5, a);
  else if (t.move) {
    n.facing = on(t.move);
    const c = n.swing > 0;
    let d = Q.speed * (c ? Lt[s.weapon].moveFire : 1);
    z(s, "quicksilver") && n.dash > Q.dashCooldown / 2 && (d *= 1 + z(s, "quicksilver") * 0.1), e.hazards.some((l) => !l.friendly && l.kind === "frost" && !l.wait && q(l, n) < l.radius && ae(a, l, n)) && (d *= 0.65), Xe(e, n, n.facing, d, Q.playerRadius, a);
  }
  n.travel += q(i, n), z(s, "pilgrim") && n.travel >= 28 && (n.travel -= 28, ea(n, z(s, "pilgrim") * 6, 35)), z(s, "wardstone") && e.tick - n.lastHit > 150 && e.tick % 30 === 0 && ea(n, 2, z(s, "wardstone") * 10);
  const u = r && ae(a, n, r) ? r : void 0;
  t.skill && !n.skill && (u && (n.facing = ve(n, u)), br(e, s, u, a));
  const o = Lt[s.weapon].range + (s.weapon === "blade" || s.weapon === "daggers" ? z(s, "piercing") * 0.25 : 0);
  if (u && !n.attack && q(n, u) <= o + de[u.kind].radius && ($n(e, s, u, !1, a), n.combo++, z(s, "echo") && n.combo % Math.max(2, Ee.echoEvery + 1 - z(s, "echo")) === 0 && $n(e, s, u, !0, a), n.attack = Math.round(Lt[s.weapon].period * (z(s, "focus") ? Ee.focusAttack : 1))), z(s, "orbit") && e.tick % Math.round(Ee.orbitTicks / (1 + z(s, "orbit") * 0.25)) === 0 && r && q(n, r) < 4.5 && qa(e, r, s, 12 + z(s, "orbit") * 3, a), z(s, "orbitals") && e.tick % 35 === 0) {
    for (const c of e.enemies) q(n, c) < 2.5 + z(s, "orbitals") * 0.35 && ae(a, n, c) && (Ue(e, c, 12 * z(s, "orbitals"), s, "passive", n, a), c.chill = Math.max(c.chill, 30));
    ge(e, n, "burst", 2.8);
  }
  return {
    x: n.x - i.x,
    y: n.y - i.y
  };
}
function Mr(e, t, s) {
  if (e.player.resonance = Math.max(0, e.player.resonance - 1), t.weapon === "grimoire" && e.tick % 45 === 1) {
    const a = 2 + z(t, "pack-bond");
    e.companions.filter((n) => n.kind === "familiar" && n.hp > 0 && n.life > 0).length < a && Ba(e, "familiar", hs(s, e.player, Qe(e.player, e.tick, 1)), 36e3);
  }
  for (const a of e.companions) {
    a.life--, a.cooldown = Math.max(0, a.cooldown - 1);
    const n = e.enemies.filter((i) => i.hp > 0 && (a.kind !== "turret" || ae(s, a, i))).sort((i, u) => q(i, a) - q(u, a))[0];
    if (a.hp <= 0 || a.life <= 0 || !n) continue;
    if (a.angle = ve(a, n), a.kind !== "turret") {
      const i = q(a, e.player) > 8;
      if (i || q(a, n) > 1.3 || !ae(s, a, n)) {
        const u = fs(s, a, i ? e.player : n, 0.25);
        u !== null && Xe(e, a, u, i ? 0.19 : 0.14 + z(t, "frenzy") * 0.015, 0.25, s);
      }
    }
    const r = a.kind === "turret" ? 8 : 1.8;
    if (!a.cooldown && q(a, n) < r && ae(s, a, n)) if (a.kind === "turret")
      ht(e, a, a.angle, Lt.cannon.skill * (1 + a.empowered * 0.15), !0, {
        source: "companion",
        speed: 0.35
      }), a.cooldown = 28 - a.empowered * 3;
    else {
      const i = a.kind === "familiar" && e.player.resonance > 0;
      Ue(e, n, a.kind === "shade" ? 9 + a.empowered * 4 : (i ? st.empoweredDamage : st.damage) * (1 + z(t, "covenant") * 0.15), t, "companion", a, s), ge(e, a, "slash", 1.2, a.angle);
      const u = a.kind === "shade" ? 32 : i ? st.empoweredAttackTicks : st.attackTicks;
      a.cooldown = Math.round(u / (1 + z(t, "frenzy") * 0.18));
    }
  }
  for (const a of e.companions) a.hp <= 0 && a.kind === "familiar" && z(t, "martyr") && (ps(e, z(t, "martyr")), fe(e, a, "slam", 2.2, 0, 1, 15 * z(t, "martyr"), !0));
  e.companions = e.companions.filter((a) => a.hp > 0 && a.life > 0);
}
var xt = Object.freeze({
  ritualTicks: 330,
  survivalTicks: 1500,
  pursuitInterval: 390,
  reinforcementInterval: 270,
  warningAfter: 1800
}), ga = [
  {
    x: -4,
    y: 0
  },
  {
    x: 4,
    y: -3
  },
  {
    x: 0,
    y: 4
  }
];
function ha(e, t, s) {
  if (e.wave++, s) {
    for (const r of s.waves[e.wave - 1]) ze(e, r.kind, r.position);
    return;
  }
  if (e.boss) {
    ze(e, e.bossKind, {
      x: 0,
      y: -5
    });
    return;
  }
  const a = ur[e.zone].mobs, n = 4 + e.chapter + (e.elite ? 2 : 0) + (t.oaths.includes("legion") ? 2 : 0);
  for (let r = 0; r < n; r++) {
    const i = Mt * r / n + (e.wave - 1) * 0.8;
    let u = a[(r + e.wave - 1) % a.length];
    e.wave === 1 && e.chapter === 0 && r < 2 && (u = a[0]), e.encounter === "pursuit" && r === 0 && (u = "stalker"), e.encounter === "siege" && r === 0 && (u = "guard"), ze(e, u, {
      x: Math.cos(i) * 8.7,
      y: Math.sin(i) * 8.7
    });
  }
}
function kr(e, t, s) {
  if (e.boss) return;
  const a = e.objective, n = e.enemies.some((r) => r.hp > 0);
  if (e.encounter === "ritual") {
    a.progress < a.target && q(e.player, a) < 2.5 && !e.enemies.some((i) => i.hp > 0 && q(i, a) < 2.2) && a.progress++;
    const r = Math.min(2, Math.floor(a.progress / xt.ritualTicks));
    a.x = ga[r].x, a.y = ga[r].y, e.tick % xt.reinforcementInterval === 0 && a.progress < a.target && e.enemies.length < 8 && ze(e, e.chapter ? "wisp" : "stalker", {
      x: a.x > 0 ? -9 : 9,
      y: xa(e) * 12 - 6
    });
  } else if (e.encounter === "survival")
    a.progress = Math.min(a.target, a.progress + 1), e.tick % xt.reinforcementInterval === 0 && a.progress < a.target && e.enemies.length < 10 && ha(e, t), e.tick % 150 === 0 && fe(e, {
      x: 0,
      y: 0
    }, "ring", 15, 35, 90, 12, !1, { inner: Math.max(4.8, 9 - e.tick / 400) });
  else if (e.encounter === "pursuit")
    a.progress = e.tick % xt.pursuitInterval, e.wave < e.waves && a.progress === 0 && ha(e, t);
  else if (e.encounter === "crossfire" && e.tick % 150 === 0) {
    const r = e.tick % 300 === 0, i = Math.round((r ? e.player.y : e.player.x) / 3) * 3;
    Se(e, r ? {
      x: -10,
      y: i
    } : {
      x: i,
      y: -10
    }, r ? 0 : Math.PI / 2, 20, 0.65, 36, 15);
  }
  e.tick > xt.warningAfter && e.tick % 180 === 0 && fe(e, e.player, "fire", 2.2, 36, 90, 13), !n && e.wave < e.waves && e.encounter !== "survival" ? ++e.nextWave >= 40 && (e.nextWave = 0, ha(e, t, s)) : n && (e.nextWave = 0);
}
function _r(e) {
  return e.enemies.some((t) => t.hp > 0) ? !1 : !e.boss && e.encounter === "survival" ? e.objective.progress >= e.objective.target : !e.boss && e.encounter === "ritual" ? e.objective.progress >= e.objective.target && e.wave >= e.waves : e.wave >= e.waves;
}
function Sr(e) {
  const t = e.objective;
  e.encounter === "ritual" && (Object.assign(t, ga[0]), t.target = xt.ritualTicks * ga.length), e.encounter === "survival" && (t.target = xt.survivalTicks), e.encounter === "pursuit" && (t.target = xt.pursuitInterval);
}
var Dt = (e, t) => {
  e.motion = t, e.motionAngle = ve(e, e.target), e.stun = 18;
}, Rr = {
  warden(e, t, s) {
    const a = t.pattern % 3, n = Fa.warden.damage;
    if (a === 0)
      Dt(t, 24), Se(e, t, t.motionAngle, 13, 1.1, 18, n);
    else if (a === 1) {
      for (let r = -1; r <= 1; r++) tt(e, Qe(t, t.angle + r * 0.55, 3.5), 1.8, 12 + Math.abs(r) * 8, n);
      t.exposed = Math.max(t.exposed, 65);
    } else
      ct(e, t, t.angle, 5 + t.phase * 2, 1.5, n * 0.65), t.phase > 1 && ze(e, "guard", {
        x: -7,
        y: -7
      }, s);
  },
  thornheart(e, t, s) {
    const a = t.pattern % 4;
    if (a === 0) for (let n = 0; n < 5; n++) fe(e, Qe(t.target, n * Mt / 5, 3.6), "poison", 1.4, 26, 110, 12);
    else if (a === 1)
      fe(e, t, "ring", 7.5, 25, 14, 22, !1, { inner: 3 }), t.exposed = Math.max(t.exposed, 80);
    else if (a === 2) for (const n of [-7, 7]) ze(e, "stalker", {
      x: n,
      y: -6
    }, s);
    else for (let n = 0; n < 3 + t.phase; n++) Se(e, t, t.angle + n * Mt / (3 + t.phase), 15, 0.55, 25, 18);
  },
  weaver(e, t) {
    const s = t.pattern % 4;
    if (s === 0)
      t.x = t.target.x > 0 ? -7 : 7, t.y = -5, ge(e, t, "burst", 2), Se(e, {
        x: -10,
        y: t.target.y
      }, 0, 20, 0.7, 30, 21), Se(e, {
        x: t.target.x,
        y: -10
      }, Math.PI / 2, 20, 0.7, 42, 21);
    else if (s === 1) ct(e, t, ve(t, e.player), 7 + t.phase, 1.8, 13, 0.2);
    else if (s === 2) {
      for (let a = 0; a < 4; a++) {
        const n = Qe({
          x: 0,
          y: 0
        }, a * Math.PI / 2 + Math.PI / 4, 7);
        Se(e, n, ve(n, {
          x: 0,
          y: 0
        }), 11, 0.6, 25 + a * 8, 18);
      }
      t.exposed = Math.max(t.exposed, 75);
    } else
      ze(e, "wisp", {
        x: -7,
        y: 5
      }), ze(e, "wisp", {
        x: 7,
        y: 5
      });
  },
  astrologer(e, t) {
    const s = t.pattern % 3, a = t.pattern * 0.53;
    if (s === 0) for (let n = 0; n < 7; n++)
      n !== t.phase && Se(e, t, a + n * Mt / 7, 18, 0.6, 32, 23);
    else if (s === 1) for (let n = 0; n < 6; n++) {
      const r = Qe({
        x: 0,
        y: 0
      }, n * Mt / 6, 9);
      ct(e, r, ve(r, t.target), 2 + t.phase, 0.45, 12, 0.16);
    }
    else
      tt(e, t.target, 2, 18, 24), fe(e, {
        x: 0,
        y: 0
      }, "ring", 10.5, 38, 12, 22, !1, { inner: 5.5 }), t.exposed = Math.max(t.exposed, 90);
  },
  king(e, t) {
    const s = t.pattern % 4;
    if (s === 0)
      Dt(t, 18), Se(e, t, t.motionAngle, 10, 0.9, 18, 24);
    else if (s === 1) for (let a = 0; a < 2 + t.phase; a++) tt(e, Qe(t, t.angle + (a % 2 ? 0.65 : -0.65), 3), 2, 7 + a * 10, 23);
    else s === 2 ? (Se(e, {
      x: -10,
      y: 0
    }, 0, 20, 0.8, 22, 26), Se(e, {
      x: 0,
      y: -10
    }, Math.PI / 2, 20, 0.8, 35, 26), t.exposed = Math.max(t.exposed, 65)) : (ct(e, t, t.angle, 3, 0.55, 18, 0.29), t.phase > 1 && (ze(e, "stalker", {
      x: -8,
      y: 3
    }), ze(e, "archer", {
      x: 8,
      y: -3
    })));
  },
  phoenix(e, t) {
    const s = t.pattern % 4;
    if (s === 0) {
      Dt(t, 28);
      for (let a = 0; a < 6; a++) fe(e, Qe(t, t.motionAngle, a * 2), "fire", 1.2, 20 + a * 4, 95, 13);
    } else if (s === 1) Pn(e, t, 10 + t.phase * 2, t.pattern * 0.32, 13, 0.17);
    else if (s === 2)
      t.x = 0, t.y = 0, fe(e, t, "ring", 9, 30, 15, 25, !1, { inner: 3.5 }), t.exposed = Math.max(t.exposed, 85);
    else for (const a of [{
      x: -6,
      y: -5
    }, {
      x: 6,
      y: 5
    }]) ze(e, "bomber", a);
  },
  forgemaster(e, t) {
    const s = t.pattern % 4;
    if (s === 0) for (const a of [
      -7,
      0,
      7
    ]) Se(e, {
      x: a,
      y: -10
    }, Math.PI / 2, 20, 1.1, 26, 24);
    else if (s === 1) for (let a = -1; a <= 1; a++) fe(e, {
      x: t.target.x + a * 2.5,
      y: t.target.y
    }, "fire", 1.6, 28 + Math.abs(a) * 7, 100, 14);
    else s === 2 ? (tt(e, t, 4, 18, 26), t.exposed = Math.max(t.exposed, 100)) : (ze(e, "bomber", {
      x: -8,
      y: 5
    }), t.phase > 1 && ze(e, "guard", {
      x: 8,
      y: 5
    }));
  },
  colossus(e, t) {
    const s = t.pattern % 3;
    if (s === 0) for (let a = 0; a < 3; a++) fe(e, t, "ring", 3 + a * 3, 20 + a * 19, 9, 23, !1, { inner: 1.4 + a * 3 });
    else if (s === 1)
      Dt(t, 30), Se(e, t, t.motionAngle, 18, 1.4, 18, 27);
    else {
      for (const a of [-1, 1]) tt(e, {
        x: t.target.x + a * 2,
        y: t.target.y
      }, 2.7, 30, 25);
      t.exposed = Math.max(t.exposed, 110);
    }
  },
  frostqueen(e, t) {
    const s = t.pattern % 4;
    if (s === 0) for (let a = 0; a < 4; a++) fe(e, Qe(t.target, a * Math.PI / 2, 3), "frost", 1.8, 24, 100, 10);
    else s === 1 ? ct(e, t, t.angle, 9, 2.2, 14, 0.21) : s === 2 ? (t.x = -t.x, t.y = -t.y, Se(e, t, ve(t, t.target), 20, 1.2, 32, 24), t.exposed = Math.max(t.exposed, 85)) : (fe(e, {
      x: 0,
      y: 0
    }, "ring", 10.5, 32, 18, 22, !1, { inner: 5 }), ze(e, "stalker", {
      x: 0,
      y: -8
    }));
  },
  leviathan(e, t) {
    const s = t.pattern % 4;
    if (s === 0)
      t.x = -9, t.y = t.target.y, t.target = {
        x: 9,
        y: t.y
      }, Dt(t, 40), Se(e, t, 0, 19, 1.4, 14, 25);
    else if (s === 1) for (let a = 0; a < 4; a++) Se(e, {
      x: -10,
      y: -8 + a * 5
    }, 0, 20, 0.7, 20 + a * 13, 20);
    else s === 2 ? (tt(e, t.target, 3.8, 28, 26), t.exposed = Math.max(t.exposed, 95)) : (fe(e, {
      x: 0,
      y: 0
    }, "ring", 10, 26, 14, 23, !1, { inner: t.phase > 1 ? 4 : 6 }), ct(e, t, t.angle, 5, 1.3, 14));
  },
  archivist(e, t) {
    const s = t.pattern % 4;
    if (s === 0)
      t.memory.push({ ...t.target }), t.memory = t.memory.slice(-4), tt(e, t.target, 2.3, 24, 21);
    else if (s === 1) for (let a = 0; a < t.memory.length; a++) tt(e, t.memory[a], 2.6, 22 + a * 8, 24);
    else if (s === 2) {
      for (const a of t.memory) Se(e, a, ve(a, t.target), 18, 0.65, 32, 22);
      ze(e, "wisp", {
        x: -7,
        y: -7
      }), ze(e, "wisp", {
        x: 7,
        y: 7
      });
    } else
      Pn(e, t, 12, t.pattern * 0.2, 14), t.exposed = Math.max(t.exposed, 100);
  },
  voidknight(e, t) {
    const s = t.pattern % 4;
    if (s === 0)
      t.x = Math.max(-8, Math.min(8, -t.target.x)), t.y = Math.max(-8, Math.min(8, -t.target.y)), ge(e, t, "burst", 2), Se(e, t, ve(t, t.target), 20, 0.8, 24, 26);
    else if (s === 1)
      Dt(t, 20), ct(e, t, t.angle, 3 + t.phase, 0.9, 15, 0.26);
    else if (s === 2)
      tt(e, t, 3, 12, 26), fe(e, t, "ring", 7, 30, 10, 22, !1, { inner: 3.5 }), t.exposed = Math.max(t.exposed, 65);
    else for (const a of [{
      x: t.target.x,
      y: -9
    }, {
      x: -9,
      y: t.target.y
    }]) Se(e, a, ve(a, t.target), 20, 0.6, 22, 23);
  }
};
function Cr(e, t, s, a) {
  const n = t.kind;
  for (; t.phase < (t.hp / t.maxHp < 0.3 ? 3 : t.hp / t.maxHp < 0.65 ? 2 : 1); ) {
    const r = t.phase + 1;
    t.phase = r, ge(e, t, "burst", 4), n === "phoenix" && r === 2 && (t.hp = Math.min(t.maxHp, t.hp + t.maxHp * 0.12), fe(e, t, "fire", 3, 25, 100, 14)), n === "archivist" && (t.memory.push({
      x: e.player.x,
      y: e.player.y
    }), t.memory = t.memory.slice(-4)), s.oaths.includes("legion") && ze(e, "stalker", {
      x: t.x > 0 ? -8 : 8,
      y: 6
    }, a);
  }
  Rr[n](e, t, a), t.pattern++;
}
function zr(e, t, s) {
  if (!xe(t.kind)) {
    const a = e.companions.filter((n) => n.hp > 0 && n.life > 0 && q(n, t) < 2.8 && ae(s, t, n)).sort((n, r) => q(n, t) - q(r, t))[0];
    if (a) return a;
    if (e.encounter === "siege" && !e.boss && (t.kind === "soldier" || t.kind === "guard" || t.kind === "charger") && q(t, e.player) > 3) return e.objective;
  }
  return e.player;
}
function Pr(e, t, s, a, n) {
  const r = de[t.kind];
  q(t.target, e.player) < a && q(t, e.player) < r.reach + 1 && ae(n, t, e.player) && Ma(e, r.damage, s, n);
  for (const i of e.companions) q(t.target, i) < a && q(t, i) < r.reach + 1 && ae(n, t, i) && (i.hp -= r.damage);
  !e.boss && e.encounter === "siege" && q(t.target, e.objective) < a && q(t, e.objective) < r.reach + 1 && (e.objective.hp = Math.max(0, e.objective.hp - r.damage * 0.5)), ge(e, t.target, "slash", a, t.angle);
}
function $r(e, t, s, a) {
  const n = de[t.kind];
  if (xe(t.kind)) {
    Cr(e, t, s, a);
    return;
  }
  switch (t.kind) {
    case "archer":
      ct(e, t, t.angle, e.chapter > 0 ? 3 : 2, 0.36, n.damage, 0.24);
      break;
    case "priest":
      for (const r of e.enemies) r.hp > 0 && !xe(r.kind) && q(r, t) < 3.5 && ae(a, t, r) && (r.hp = Math.min(r.maxHp, r.hp + 8));
      ct(e, t, t.angle, 3, 0.7, n.damage, 0.18), ge(e, t, "heal", 3.5);
      break;
    case "charger":
      t.motion = 23, t.motionAngle = t.angle;
      break;
    case "bomber":
      fe(e, t.target, "fire", 1.9, 23, 75, n.damage);
      break;
    case "wisp":
      ht(e, t, t.angle, n.damage, !1, { speed: 0.3 }), t.motion = 7, t.motionAngle = t.angle + Math.PI / 2;
      break;
    case "guard":
      tt(e, t.target, 1.7, 8, n.damage);
      break;
    default:
      Pr(e, t, s, n.reach + 0.15, a);
  }
}
function Er(e, t, s, a) {
  const n = de[t.kind], r = {
    x: t.x,
    y: t.y
  }, i = t.kind === "leviathan" ? 0.44 : t.kind === "wisp" ? 0.24 : 0.32;
  if (Xe(e, t, t.motionAngle, i, n.radius, a), t.motion--, t.kind !== "wisp") {
    q(t, e.player) < n.radius + 0.4 && ae(a, t, e.player) && Ma(e, n.damage, s, a);
    for (const u of e.companions) q(t, u) < n.radius + 0.3 && ae(a, t, u) && (u.hp -= n.damage, t.motion = 0);
    !e.boss && e.encounter === "siege" && q(t, e.objective) < n.radius + 0.6 && (e.objective.hp = Math.max(0, e.objective.hp - n.damage * 0.5), t.motion = 0), q(r, t) < i * 0.65 && (t.motion = 0, t.exposed = Math.max(t.exposed, 80), t.stun = 24, ge(e, t, "guard", 2));
  }
  t.motion || (t.cooldown = Math.max(t.cooldown, 28));
}
function Ir(e, t, s, a) {
  for (const n of [...e.enemies]) {
    if (n.hp <= 0) continue;
    for (const l of [
      "marked",
      "chill",
      "exposed"
    ]) n[l] = Math.max(0, n[l] - 1);
    for (const l of [
      "burn",
      "bleed",
      "poison"
    ]) n[l] > 0 && (n[l]--, e.tick % 15 === 0 && Ue(e, n, 2 + (l === "burn" ? z(t, "cinder") + z(t, "inferno") : l === "bleed" ? z(t, "hemorrhage") + z(t, "blood-dance") : z(t, "venom")) * 1.5, t, "passive", a ? n : e.player, a));
    if (n.hp <= 0) continue;
    if (n.stun > 0) {
      n.stun--;
      continue;
    }
    if (n.motion > 0) {
      Er(e, n, t, a);
      continue;
    }
    const r = de[n.kind], i = t.oaths.includes("haste");
    if (n.windup > 0) {
      --n.windup === 0 && ($r(e, n, t, a), n.cooldown = Math.round(r.cooldown * (i ? 0.8 : 1) / (xe(n.kind) ? 1 + (n.phase - 1) * 0.12 : 1)));
      continue;
    }
    const u = zr(e, n, a), o = q(n, u), c = ae(a, n, u);
    if (n.cooldown = Math.max(0, n.cooldown - 1), n.angle = ve(n, u), !n.cooldown && o < r.reach && c) {
      if (n.target = {
        x: u.x,
        y: u.y
      }, n.windup = Math.round(r.windup * (i ? 0.8 : 1)), u === e.player && (n.kind === "archer" || n.kind === "bomber")) {
        const l = n.kind === "bomber" ? 23 : o / 0.24, h = Math.min(n.windup + l, 4.5 / Math.max(1e-3, Math.hypot(s.x, s.y))), f = {
          x: u.x + s.x * h,
          y: u.y + s.y * h
        };
        a ? ae(a, n, f) && ae(a, u, f) && (n.target = f) : (n.target.x = Math.max(-10, Math.min(10, f.x)), n.target.y = Math.max(-10, Math.min(10, f.y))), n.angle = ve(n, n.target);
      }
      continue;
    }
    const d = n.kind === "archer" || n.kind === "priest" || n.kind === "bomber" || n.kind === "wisp";
    if (o > (d ? 5 : xe(n.kind) ? 2.8 : 0.95) || d && o < 3 || !c) {
      const l = n.kind === "stalker" && o > 3 ? n.id % 2 ? 0.28 : -0.28 : 0, h = fs(a, n, u, r.radius);
      h !== null && Xe(e, n, h + (d && o < 3 && c ? Math.PI : a ? 0 : l), r.speed * (n.chill ? xe(n.kind) ? 0.8 : 0.5 : 1) * (i ? 1.08 : 1), r.radius, a);
    }
    for (const l of e.enemies) l.id !== n.id && l.hp > 0 && q(n, l) < r.radius + de[l.kind].radius && Xe(e, n, ve(l, n), 0.027, r.radius, a);
  }
}
function da(e, t, s) {
  if (e.kind === "beam") return vr(t, e, e.angle, e.length) < e.width + s;
  const a = q(e, t);
  return a < e.radius + s && (e.kind !== "ring" || a > e.inner - s);
}
function Lr(e, t, s) {
  for (const a of e.shots) {
    if (a.life <= 0) continue;
    const n = {
      x: a.x,
      y: a.y
    };
    if (a.x += Math.cos(a.angle) * a.speed, a.y += Math.sin(a.angle) * a.speed, a.life--, s ? !ae(s, n, a, a.radius) : Math.abs(a.x) > Q.arena || Math.abs(a.y) > Q.arena || e.obstacles.some((r) => q(r, a) < r.radius + a.radius)) {
      a.life = 0;
      continue;
    }
    if (!a.friendly) {
      if (q(a, e.player) < Q.playerRadius + a.radius && ae(s, a, e.player)) e.player.shield > 0 ? (ms(e, t, s), a.friendly = !0, a.source = "skill", a.angle += Math.PI, a.damage *= 1.8, a.hits = []) : (Ma(e, a.damage, t, s), a.life = 0);
      else {
        const r = e.companions.find((i) => i.hp > 0 && q(a, i) < 0.3 + a.radius && ae(s, a, i));
        r && (r.hp -= a.damage * (1 - z(t, "covenant") * 0.12), a.life = 0);
      }
      continue;
    }
    for (const r of e.enemies) {
      if (r.hp <= 0 || a.hits.includes(r.id) || q(r, a) > de[r.kind].radius + a.radius || !ae(s, a, r)) continue;
      a.hits.push(r.id);
      const i = a.damage * (z(t, "hunter") && q(r, e.player) > Ee.hunterRange ? Ee.hunterDamage + (z(t, "hunter") - 1) * 0.15 : 1);
      if (Ue(e, r, i, t, a.source, a, s), z(t, "pinning") && a.source === "attack" && (r.chill = 50 + z(t, "pinning") * 20, e.player.combo % 3 === 0 && ft(e, r, 8 * z(t, "pinning"))), a.splash > 0) {
        ge(e, r, "burst", a.splash);
        for (const u of e.enemies) u.id !== r.id && q(u, r) < a.splash + de[u.kind].radius && Ue(e, u, i * 0.55, t, a.source, r, s);
      }
      if (a.bounce > 0) {
        const u = e.enemies.filter((o) => o.hp > 0 && !a.hits.includes(o.id) && q(o, r) < 6 && ae(s, a, o, a.radius)).sort((o, c) => q(r, o) - q(r, c))[0];
        if (u) {
          a.bounce--, a.angle = ve(a, u), a.damage *= 0.8;
          break;
        }
      }
      if (a.pierce-- <= 0) {
        a.life = 0;
        break;
      }
    }
  }
  e.shots = e.shots.filter((a) => a.life > 0);
}
function Ar(e, t, s) {
  for (const a of [...e.hazards]) {
    if (a.wait > 0) {
      a.wait--;
      continue;
    }
    if (a.life--, !a.friendly) {
      da(a, e.player, Q.playerRadius) && ae(s, a, e.player) && Ma(e, a.damage, t, s), !e.boss && e.encounter === "siege" && e.tick % 15 === 0 && da(a, e.objective, 0.6) && ae(s, a, e.objective) && (e.objective.hp = Math.max(0, e.objective.hp - a.damage * 0.35));
      const r = a.kind === "slam" || a.kind === "beam" || a.kind === "ring";
      if (r || e.tick % 15 === 0)
        for (const i of e.companions) i.hp > 0 && (!r || !a.hits.includes(i.id)) && da(a, i, 0.3) && ae(s, a, i) && (i.hp -= a.damage * 0.25, r && a.hits.push(i.id));
      continue;
    }
    if (a.kind !== "slam" && a.kind !== "mine" && e.tick % 15 !== 0) continue;
    const n = e.enemies.filter((r) => r.hp > 0 && da(a, r, de[r.kind].radius) && ae(s, a, r));
    a.kind === "mine" && n.length && (a.life = 0, ge(e, a, "burst", a.radius));
    for (const r of n) a.kind === "storm" ? qa(e, r, t, a.damage, s, a) : (a.kind === "fire" && (r.burn = Math.max(r.burn, 45)), a.kind === "frost" && (r.chill = Math.max(r.chill, 60)), a.kind === "mine" && ft(e, r, 25), Ue(e, r, a.damage, t, a.source, a, s));
  }
  e.hazards = e.hazards.filter((a) => a.life > 0);
}
function Tr(e, t, s) {
  Lr(e, t, s), Ar(e, t, s);
}
function jr(e) {
  return e.player.hp <= 0 ? "fallen" : !e.boss && e.encounter === "siege" && e.objective.hp <= 0 ? "beacon" : null;
}
function Or(e, t, s) {
  const { seed: a, zone: n, chapter: r, elite: i, boss: u, bossKind: o, encounter: c, hp: d } = e, l = {
    tick: 0,
    seed: a,
    serial: 0,
    player: {
      x: 0,
      y: 5,
      hp: d,
      facing: -Math.PI / 2,
      attack: 0,
      dash: 0,
      skill: 0,
      invulnerable: 30,
      dashTime: 0,
      dashAngle: 0,
      swing: 0,
      shield: 0,
      combo: 0,
      guard: 0,
      resource: 0,
      resonance: 0,
      ward: 0,
      lastHit: 0,
      travel: 0,
      rescues: 0
    },
    enemies: [],
    shots: [],
    hazards: [],
    effects: [],
    companions: [],
    obstacles: u ? o === "warden" || o === "colossus" ? [{
      x: -5,
      y: 0,
      radius: 0.85
    }, {
      x: 5,
      y: 0,
      radius: 0.85
    }] : [] : [{
      x: -5,
      y: -4,
      radius: 0.9
    }, {
      x: 5,
      y: 3,
      radius: 0.9
    }],
    wave: 0,
    waves: u ? 1 : i ? 3 : 2,
    nextWave: 0,
    kills: 0,
    damageTaken: 0,
    status: "fighting",
    zone: n,
    chapter: r,
    elite: i,
    boss: u,
    bossKind: o,
    encounter: c,
    objective: {
      x: 0,
      y: 0,
      hp: 100,
      progress: 0,
      target: 0
    }
  };
  return s && ((u && !zn(o) || s.waves.some((h) => h.some((f) => !zn(f.kind)))) && Re("encounter_unsupported"), (c !== "skirmish" || !s.waves.length || !mt(s.space, s.entry, Q.playerRadius) || s.waves.some((h) => !h.length || h.some((f) => !mt(s.space, f.position, de[f.kind].radius) || !ra(s.space, s.entry, f.position, Q.playerRadius)))) && Re("map_invalid"), Object.assign(l.player, s.entry), Object.assign(l.objective, s.objective), l.obstacles = [], l.waves = s.waves.length), Sr(l), ha(l, t, s), l;
}
function Zr(e, t, s, a) {
  if (e.status !== "fighting") return;
  e.tick++, e.effects = e.effects.filter((r) => --r.life > 0).slice(-80);
  const n = xr(e, t, s, a);
  Mr(e, s, a), Ir(e, s, n, a), Tr(e, s, a), e.enemies = e.enemies.filter((r) => r.hp > 0), jr(e) ? e.status = "lost" : (kr(e, s, a), _r(e) && (e.status = "won", e.shots = [], e.hazards = []));
}
function Ur(e, t) {
  const s = e.at(-1);
  s && s.move === t.move && s.dash === t.dash && s.skill === t.skill ? s.ticks++ : e.push({
    ...t,
    ticks: 1
  });
}
function Wa(e, t) {
  return e.x >= t.x - t.width / 2 && e.x < t.x + t.width / 2 && e.y >= t.z - t.depth / 2 && e.y < t.z + t.depth / 2;
}
function St(e) {
  const { landscape: t } = e, { bounds: s } = t, a = {
    x: s.x - s.width / 2,
    y: s.z - s.depth / 2
  }, n = [
    s,
    ...t.features.map((d) => d.footprint),
    ...t.gates.map((d) => d.footprint)
  ];
  n.some((d) => ![
    d.x,
    d.z,
    d.width,
    d.depth
  ].every(Number.isFinite) || d.width <= 0 || d.depth <= 0 || ![
    d.x - d.width / 2,
    d.z - d.depth / 2,
    d.width,
    d.depth
  ].every(Number.isInteger)) && Re("map_invalid");
  const r = t.features.map((d) => d.id);
  new Set(r).size !== r.length && Re("map_invalid"), t.features.some((d) => [
    "tree",
    "tower",
    "wall",
    "arch",
    "column",
    "root"
  ].includes(d.kind) && (d.height === void 0 || !Number.isFinite(d.height) || d.height <= 0)) && Re("map_invalid");
  for (const d of n.slice(1)) (d.x - d.width / 2 < a.x || d.z - d.depth / 2 < a.y || d.x + d.width / 2 > a.x + s.width || d.z + d.depth / 2 > a.y + s.depth) && Re("map_invalid");
  t.roads.some((d) => !Number.isFinite(d.width) || d.width <= 0 || d.points.length < 2 || d.points.some(([l, h], f) => !Number.isFinite(l) || !Number.isFinite(h) || f > 0 && l === d.points[f - 1][0] && h === d.points[f - 1][1])) && Re("map_invalid");
  const i = [];
  for (let d = 0; d < s.depth; d++) {
    let l = "";
    for (let h = 0; h < s.width; h++) {
      const f = {
        x: a.x + h + 0.5,
        y: a.y + d + 0.5
      };
      l += t.features.some((g) => g.kind !== "arch" && Wa(f, g.footprint)) ? "#" : ".";
    }
    i.push(l);
  }
  const u = {
    origin: a,
    cellSize: 1,
    rows: i,
    gates: t.gates.map((d) => {
      const l = d.footprint, h = [];
      for (let f = l.z - l.depth / 2 - a.y; f < l.z + l.depth / 2 - a.y; f++) for (let g = l.x - l.width / 2 - a.x; g < l.x + l.width / 2 - a.x; g++) h.push({
        column: g,
        row: f
      });
      return {
        id: d.id,
        cells: h
      };
    })
  }, o = us(u, new Set(u.gates.map((d) => d.id)));
  Object.values(e.anchors).some((d) => !mt(o, d, Q.playerRadius)) && Re("map_invalid");
  const c = /* @__PURE__ */ new Set();
  for (const d of [...e.exits, ...e.objects])
    (!e.anchors[d.anchor] || c.has(d.id)) && Re("map_invalid"), c.add(d.id);
  return {
    ...e,
    map: u,
    gates: t.gates
  };
}
var R = (e, t, s, a, n, r, i = {}) => ({
  id: e,
  kind: t,
  footprint: {
    x: s,
    z: a,
    width: n,
    depth: r
  },
  ...i
}), Nr = St({
  id: "camp",
  safe: !0,
  anchors: {
    start: {
      x: -22,
      y: 16
    },
    road: {
      x: 0,
      y: -53
    },
    clinic: {
      x: -13,
      y: 12
    },
    guard: {
      x: 7,
      y: -39
    },
    kouzi: {
      x: 32,
      y: 8
    },
    anian: {
      x: -18,
      y: 15
    },
    rest: {
      x: -3,
      y: 15
    },
    cargo: {
      x: 16,
      y: 7
    },
    postern: {
      x: -42,
      y: 7
    },
    receiving: {
      x: -16,
      y: 16
    },
    gatehouse: {
      x: 11,
      y: -37
    },
    clinic_back: {
      x: -29,
      y: 8
    },
    registry: {
      x: -10,
      y: 15
    }
  },
  exits: [{
    id: "road",
    anchor: "road",
    to: "crossroads",
    arrival: "camp"
  }, {
    id: "postern",
    anchor: "postern",
    to: "cells",
    arrival: "postern",
    condition: { all: ["postern_opened"] }
  }],
  objects: [{
    id: "rest",
    anchor: "rest",
    kind: "rest"
  }, {
    id: "cargo",
    anchor: "cargo",
    kind: "inspect",
    passage: "cargo",
    condition: { all: ["warden_defeated"] }
  }],
  landscape: {
    vista: "camp",
    surface: "street",
    bounds: {
      x: 0,
      z: -8,
      width: 96,
      depth: 100
    },
    suspended: [
      {
        kind: "pipe",
        from: [
          -35.7,
          5.3,
          36
        ],
        to: [
          -35.7,
          5.3,
          -46
        ]
      },
      {
        kind: "pipe",
        from: [
          -36,
          4.8,
          4
        ],
        to: [
          -19,
          4.8,
          4
        ]
      },
      {
        kind: "pipe",
        from: [
          -27,
          5.2,
          28
        ],
        to: [
          -27,
          5.2,
          4
        ]
      },
      {
        kind: "pipe",
        from: [
          -8,
          5.4,
          -12
        ],
        to: [
          12,
          5.4,
          -12
        ]
      },
      {
        kind: "pipe",
        from: [
          12,
          5.4,
          -12
        ],
        to: [
          12,
          5.4,
          -48
        ]
      },
      {
        kind: "pipe",
        from: [
          12,
          5.4,
          -12
        ],
        to: [
          34,
          5.4,
          -12
        ]
      },
      {
        kind: "pipe",
        from: [
          34,
          5.4,
          -12
        ],
        to: [
          34,
          5.4,
          20
        ]
      },
      {
        kind: "washing",
        from: [
          -27,
          3.5,
          25
        ],
        to: [
          -12,
          3.8,
          20
        ]
      },
      {
        kind: "washing",
        from: [
          15,
          3.7,
          20
        ],
        to: [
          28,
          4.2,
          28
        ]
      }
    ],
    gates: [{
      id: "postern",
      footprint: {
        x: -36,
        z: 7,
        width: 2,
        depth: 4
      },
      condition: { all: ["postern_opened"] }
    }],
    roads: [
      {
        points: [
          [0, 36],
          [0, 16],
          [-4, 10],
          [-4, 1],
          [2, -12],
          [0, -24],
          [0, -53]
        ],
        width: 4
      },
      {
        points: [
          [-33, 18],
          [-23, 15],
          [-14, 13],
          [0, 11],
          [16, 8],
          [28, 8]
        ],
        width: 3
      },
      {
        points: [
          [-31, 32],
          [-30, 19],
          [-29, 8]
        ],
        width: 3
      },
      {
        points: [
          [-27, 18],
          [-22, 18],
          [-17, 23.2],
          [-12, 23.2]
        ],
        width: 2
      },
      {
        points: [
          [0, -36],
          [17, -37],
          [27, -43]
        ],
        width: 4
      }
    ],
    features: [
      R("clinic", "clinic", -19, 4, 14, 10),
      R("storehouse", "storehouse", 12, -9, 12, 12),
      R("hearth", "stove", 0, 6, 4, 4),
      R("rest-bench", "bench", -5, 15, 2, 4),
      R("wagon", "wagon", 22, 3, 4, 6),
      R("supply-crates", "supplies", 20, -5, 4, 4),
      R("drying-shed", "workshop", -29, 0, 4, 10, { height: 3.5 }),
      R("herbs-small", "medicine", -23, 10, 6, 2),
      R("menders-home", "dwelling", -12, 20, 4, 4, {
        height: 3.3,
        tint: "rose"
      }),
      R("eastern-home", "dwelling", 15, 20, 4, 4, { height: 4.1 }),
      R("wall-home", "dwelling", -31, -12, 4, 4, { height: 5 }),
      R("charcoal-home", "dwelling", 34, -16, 4, 4, { height: 4.7 }),
      R("pipe-home", "dwelling", -16, -19, 4, 4, { height: 3.8 }),
      R("canal-west", "water", -26, -28, 44, 4),
      R("canal-east", "water", 26, -28, 44, 4),
      R("bridge-west", "wall", -5, -28, 2, 6, { height: 0.8 }),
      R("bridge-east", "wall", 5, -28, 2, 6, { height: 0.8 }),
      R("gate-west", "wall", -26, -49, 44, 4, { height: 6 }),
      R("gate-east", "wall", 26, -49, 44, 4, { height: 6 }),
      R("west-watchtower", "tower", -8, -49, 6, 8, { height: 12 }),
      R("east-watchtower", "tower", 8, -49, 6, 8, { height: 12 }),
      R("departure-arch", "arch", 0, -49, 10, 4, { height: 8 }),
      R("west-boundary", "wall", -37, -26, 2, 62, {
        height: 7,
        wallUse: "homes"
      }),
      R("postern-bottom", "wall", -37, 25, 2, 32, {
        height: 7,
        wallUse: "homes"
      }),
      R("south-boundary", "wall", 0, 40, 96, 4, { height: 1 }),
      R("east-boundary", "wall", 46, -8, 4, 96, { height: 1.2 }),
      R("postern-end", "wall", -47, -8, 2, 100, { height: 2.4 }),
      R("north-boundary", "wall", 0, -57, 96, 2, { height: 5 }),
      R("roadside-workshop", "workshop", -17, -38, 16, 8, { height: 4 }),
      R("lookout-ruin", "ruin", 24, -38, 6, 6, { height: 3 }),
      R("arrival-home", "dwelling", -27, 28, 6, 6, { height: 4.3 }),
      R("eastern-workshop", "workshop", 28, 30, 6, 6, { height: 3.7 }),
      R("wall-row", "dwelling", -24, -21, 18, 4, { height: 4.5 }),
      R("roadside-homes", "dwelling", -8, -12, 4, 10, { height: 4.2 }),
      R("clinic-back-shed", "workshop", -20, -5, 16, 2, { height: 2.6 })
    ]
  }
}), Dr = St({
  id: "crossroads",
  safe: !1,
  anchors: {
    camp: {
      x: 0,
      y: 43
    },
    gate: {
      x: 0,
      y: -43
    },
    waterway: {
      x: 34,
      y: 7
    },
    roots: {
      x: -36,
      y: -13
    },
    warning: {
      x: 5,
      y: 19
    },
    encounter: {
      x: 0,
      y: 9
    },
    patrol: {
      x: -4,
      y: -8
    },
    lookout: {
      x: 8,
      y: -18
    }
  },
  exits: [
    {
      id: "camp",
      anchor: "camp",
      to: "camp",
      arrival: "road"
    },
    {
      id: "gate",
      anchor: "gate",
      to: "gate",
      arrival: "crossroads",
      condition: { all: ["crossroads_cleared"] }
    },
    {
      id: "waterway",
      anchor: "waterway",
      to: "waterway",
      arrival: "crossroads",
      condition: { all: ["crossroads_cleared"] }
    },
    {
      id: "roots",
      anchor: "roots",
      to: "roots",
      arrival: "crossroads",
      condition: { all: ["warden_defeated"] }
    }
  ],
  objects: [{
    id: "warning",
    anchor: "warning",
    kind: "inspect",
    passage: "warning"
  }],
  landscape: {
    vista: "ramparts",
    surface: "grass",
    bounds: {
      x: 0,
      z: 0,
      width: 96,
      depth: 96
    },
    gates: [{
      id: "roots",
      footprint: {
        x: -29,
        z: -13,
        width: 2,
        depth: 6
      },
      condition: { all: ["warden_defeated"] }
    }],
    roads: [
      {
        points: [
          [0, 44],
          [0, 28],
          [-4, 14],
          [2, 0],
          [0, -20],
          [0, -44]
        ],
        width: 8
      },
      {
        points: [
          [-4, 14],
          [14, 14],
          [24, 7],
          [35, 7]
        ],
        width: 4
      },
      {
        points: [
          [0, -13],
          [-18, -13],
          [-37, -13]
        ],
        width: 5
      }
    ],
    features: [
      R("wall-west", "wall", -30, -32, 2, 32, { height: 3 }),
      R("wall-west-low", "wall", -30, 19, 2, 58, { height: 2 }),
      R("wall-east", "wall", 24, -25, 4, 44, { height: 7 }),
      R("rampart-tower", "tower", 24, -16, 8, 8, { height: 15 }),
      R("gate-tower-left", "tower", -8, -41, 6, 8, { height: 11 }),
      R("gate-tower-right", "tower", 8, -41, 6, 8, { height: 11 }),
      R("north-arch", "arch", 0, -41, 10, 4, { height: 8 }),
      R("west-gate-wall", "wall", -26, -43, 40, 4, { height: 5 }),
      R("east-gate-wall", "wall", 36, -43, 20, 4, { height: 5 }),
      R("road-ruin", "ruin", -12, 1, 6, 6, { height: 3.5 }),
      R("fallen-column", "ruin", 12, -2, 4, 4, { height: 1.2 }),
      R("road-tree", "tree", -17, 27, 4, 4, {
        height: 9,
        tint: "amber"
      }),
      R("roots-tree", "tree", -39, -25, 6, 6, {
        height: 13,
        tint: "sage"
      }),
      R("southern-tree", "tree", 17, 37, 4, 4, {
        height: 9,
        tint: "sage"
      }),
      R("arrival-watch-west", "tower", -8, 44, 6, 8, { height: 10 }),
      R("arrival-watch-east", "tower", 8, 44, 6, 8, { height: 10 }),
      R("arrival-arch", "arch", 0, 44, 10, 4, { height: 8 }),
      R("broken-convoy", "wagon", -12, 19, 4, 6, { damaged: !0 }),
      R("convoy-supplies", "supplies", -16, 16, 4, 4),
      R("stranded-cargo", "cargo", -24, 28, 8, 12),
      R("stranded-fuel", "fuel", 18, 25, 6, 8),
      R("old-border", "thicket", -18, -6, 14, 4),
      R("waterway-bank", "water", 37, 21, 22, 16),
      R("north-boundary", "wall", 0, -47, 96, 2, { height: 5 }),
      R("south-boundary-west", "wall", -26, 47, 44, 2, { height: 5 }),
      R("south-boundary-east", "wall", 26, 47, 44, 2, { height: 5 }),
      R("west-boundary", "wall", -47, 0, 2, 96, { height: 2 }),
      R("east-boundary", "wall", 47, 0, 2, 96, { height: 2 })
    ]
  }
}), Fr = St({
  id: "gate",
  safe: !1,
  anchors: {
    crossroads: {
      x: 0,
      y: 32
    },
    beacon: {
      x: 0,
      y: -33
    },
    encounter: {
      x: 0,
      y: 0
    },
    guard: {
      x: -5,
      y: -9
    },
    archer: {
      x: 8,
      y: -17
    },
    parley: {
      x: 0,
      y: 19
    },
    parley_side: {
      x: -7,
      y: 19
    },
    guard_side: {
      x: -8,
      y: 9
    },
    archer_side: {
      x: 8,
      y: 9
    }
  },
  exits: [{
    id: "crossroads",
    anchor: "crossroads",
    to: "crossroads",
    arrival: "gate"
  }, {
    id: "beacon",
    anchor: "beacon",
    to: "beacon",
    arrival: "gate",
    condition: { all: ["patrol_cleared"] }
  }],
  objects: [],
  landscape: {
    vista: "ramparts",
    surface: "paving",
    bounds: {
      x: 0,
      z: 0,
      width: 72,
      depth: 80
    },
    gates: [],
    roads: [{
      points: [
        [0, 34],
        [0, 13],
        [0, -9],
        [0, -34]
      ],
      width: 10
    }, {
      points: [
        [-26, 12],
        [0, 12],
        [26, 12]
      ],
      width: 4
    }],
    features: [
      R("outer-west", "wall", -35, 0, 2, 80, { height: 8 }),
      R("outer-east", "wall", 35, 0, 2, 80, { height: 8 }),
      R("north-wall", "wall", 0, -39, 72, 2, { height: 9 }),
      R("south-wall", "wall", 0, 39, 72, 2, { height: 5 }),
      R("gate-tower-west", "tower", -10, -27, 8, 12, { height: 16 }),
      R("gate-tower-east", "tower", 10, -27, 8, 12, { height: 16 }),
      R("main-arch", "arch", 0, -27, 12, 6, { height: 12 }),
      R("gate-flank-west", "wall", -25, -27, 22, 6, { height: 9 }),
      R("gate-flank-east", "wall", 25, -27, 22, 6, { height: 9 }),
      R("west-pillars", "ruin", -13, -3, 6, 4, { height: 4.8 }),
      R("east-pillars", "ruin", 13, -3, 6, 4, { height: 4.8 }),
      R("western-barracks", "storehouse", -25, 2, 12, 12),
      R("eastern-barracks", "storehouse", 25, 2, 12, 12),
      R("awaiting-inspection", "cargo", -15, 23, 4, 12),
      R("cleared-consignments", "cargo", 15, 23, 4, 12),
      R("inspection-cart", "wagon", 25, 19, 4, 6),
      R("inspection-crates", "supplies", 28, 25, 4, 4),
      R("barracks-tree", "tree", -27, 26, 4, 4, {
        height: 9,
        tint: "amber"
      })
    ]
  }
}), Br = St({
  id: "beacon",
  safe: !1,
  anchors: {
    gate: {
      x: 0,
      y: 35
    },
    hall: {
      x: 0,
      y: -35
    },
    beacon: {
      x: 0,
      y: 0
    },
    encounter: {
      x: 0,
      y: 9
    },
    guard: {
      x: -9,
      y: -13
    },
    archer: {
      x: 12,
      y: -13
    },
    parley: {
      x: 0,
      y: 28
    },
    parley_side: {
      x: -8,
      y: 28
    },
    guard_side: {
      x: -14,
      y: 2
    },
    archer_side: {
      x: 14,
      y: 2
    }
  },
  exits: [{
    id: "gate",
    anchor: "gate",
    to: "gate",
    arrival: "beacon"
  }, {
    id: "hall",
    anchor: "hall",
    to: "hall",
    arrival: "beacon",
    condition: { all: ["alarm_silenced"] }
  }],
  objects: [],
  landscape: {
    vista: "ramparts",
    surface: "paving",
    bounds: {
      x: 0,
      z: 0,
      width: 72,
      depth: 84
    },
    gates: [],
    roads: [{
      points: [
        [0, 36],
        [0, 10],
        [-9, 0],
        [-9, -18],
        [0, -27],
        [0, -36]
      ],
      width: 6
    }, {
      points: [
        [0, 10],
        [10, 0],
        [10, -18],
        [0, -27]
      ],
      width: 6
    }],
    features: [
      R("west-parapet", "wall", -35, 0, 2, 84, { height: 3 }),
      R("east-parapet", "wall", 35, 0, 2, 84, { height: 3 }),
      R("north-wall", "wall", 0, -41, 72, 2, { height: 9 }),
      R("south-wall", "wall", 0, 41, 72, 2, { height: 5 }),
      R("signal-brazier", "beacon", 0, -8, 6, 6),
      R("west-signal-column", "column", -20, -10, 4, 4, { height: 11 }),
      R("east-signal-column", "column", 20, -10, 4, 4, { height: 11 }),
      R("west-approach-column", "column", -20, 12, 4, 4, { height: 8 }),
      R("east-approach-column", "column", 20, 12, 4, 4, { height: 8 }),
      R("hall-tower-west", "tower", -10, -30, 8, 8, { height: 16 }),
      R("hall-tower-east", "tower", 10, -30, 8, 8, { height: 16 }),
      R("hall-arch", "arch", 0, -30, 12, 4, { height: 12 }),
      R("signal-fuel", "fuel", -27, 19, 8, 22),
      R("signal-reserve", "cargo", 27, 19, 8, 22),
      R("west-copper-store", "supplies", -26, -23, 6, 6),
      R("east-copper-store", "supplies", 26, -23, 6, 6)
    ]
  }
}), qr = St({
  id: "waterway",
  safe: !1,
  anchors: {
    crossroads: {
      x: -21,
      y: -35
    },
    cells: {
      x: 20,
      y: 35
    },
    sluice: {
      x: -9,
      y: 8
    },
    encounter: {
      x: 4,
      y: 4
    },
    guard: {
      x: 10,
      y: -5
    }
  },
  exits: [{
    id: "crossroads",
    anchor: "crossroads",
    to: "crossroads",
    arrival: "waterway"
  }, {
    id: "cells",
    anchor: "cells",
    to: "cells",
    arrival: "waterway",
    condition: { all: ["waterway_cleared"] }
  }],
  objects: [{
    id: "sluice",
    anchor: "sluice",
    kind: "switch",
    fact: "sluice_opened"
  }],
  landscape: {
    vista: "interior",
    surface: "wet",
    bounds: {
      x: 0,
      z: 0,
      width: 64,
      depth: 88
    },
    suspended: [
      {
        kind: "pipe",
        from: [
          -28.5,
          4.3,
          -41
        ],
        to: [
          -28.5,
          4.3,
          16
        ]
      },
      {
        kind: "pipe",
        from: [
          -28.5,
          4.3,
          -18
        ],
        to: [
          29,
          4.3,
          -18
        ]
      },
      {
        kind: "pipe",
        from: [
          29,
          4.3,
          -18
        ],
        to: [
          29,
          4.3,
          41
        ]
      }
    ],
    gates: [{
      id: "sluice",
      footprint: {
        x: 0,
        z: 16,
        width: 12,
        depth: 4
      },
      condition: { all: ["sluice_opened"] }
    }],
    roads: [{
      points: [
        [-21, -35],
        [-10, -32],
        [-10, -12],
        [3, 0],
        [0, 16],
        [14, 28],
        [20, 35]
      ],
      width: 5
    }],
    features: [
      R("west-wall", "wall", -31, 0, 2, 88, { height: 7 }),
      R("east-wall", "wall", 31, 0, 2, 88, { height: 7 }),
      R("north-wall", "wall", 0, -43, 64, 2, { height: 8 }),
      R("south-wall", "wall", 0, 43, 64, 2, { height: 8 }),
      R("upper-channel-west", "water", -24, -3, 12, 58),
      R("upper-channel-east", "water", 23, -12, 14, 48),
      R("lower-channel-west", "water", -13, 32, 30, 20),
      R("lower-channel-east", "water", 28, 32, 4, 20),
      R("sluice-west-abutment", "wall", -18, 16, 24, 4, { height: 5 }),
      R("sluice-east-abutment", "wall", 18, 16, 24, 4, { height: 5 }),
      R("upper-pier-west", "column", -15, -18, 4, 4, { height: 9 }),
      R("upper-pier-east", "column", 11, -18, 4, 4, { height: 9 }),
      R("lower-pier-west", "column", -13, 0, 4, 4, { height: 9 }),
      R("lower-pier-east", "column", 13, 0, 4, 4, { height: 9 }),
      R("vault-north", "arch", -2, -18, 26, 2, { height: 10 }),
      R("vault-middle", "arch", 0, 0, 26, 2, { height: 10 }),
      R("entry-marker", "ruin", -24, -39, 6, 2, { height: 5 }),
      R("maintenance-supplies", "supplies", 8, 36, 4, 4)
    ]
  }
}), Wr = St({
  id: "cells",
  safe: !1,
  anchors: {
    waterway: {
      x: -21,
      y: 21
    },
    hall: {
      x: 0,
      y: -3
    },
    postern: {
      x: 23,
      y: 33
    },
    latch: {
      x: 20,
      y: 16
    },
    release: {
      x: -3,
      y: 5
    },
    kouzi: {
      x: -15,
      y: -12
    },
    anian: {
      x: 15,
      y: -12
    },
    kouzi_talk: {
      x: -15,
      y: -8
    },
    anian_talk: {
      x: 15,
      y: -8
    }
  },
  exits: [
    {
      id: "waterway",
      anchor: "waterway",
      to: "waterway",
      arrival: "cells"
    },
    {
      id: "hall",
      anchor: "hall",
      to: "hall",
      arrival: "cells"
    },
    {
      id: "postern",
      anchor: "postern",
      to: "camp",
      arrival: "postern",
      condition: { all: ["postern_opened"] }
    }
  ],
  objects: [{
    id: "release",
    anchor: "release",
    kind: "switch",
    fact: "captives_released"
  }, {
    id: "postern_latch",
    anchor: "latch",
    kind: "switch",
    fact: "postern_opened"
  }],
  landscape: {
    vista: "interior",
    surface: "paving",
    bounds: {
      x: 0,
      z: 0,
      width: 64,
      depth: 76
    },
    gates: [
      {
        id: "cell-west",
        footprint: {
          x: -15,
          z: -10,
          width: 10,
          depth: 2
        },
        condition: { all: ["captives_released"] }
      },
      {
        id: "cell-east",
        footprint: {
          x: 15,
          z: -10,
          width: 10,
          depth: 2
        },
        condition: { all: ["captives_released"] }
      },
      {
        id: "postern",
        footprint: {
          x: 24,
          z: 24,
          width: 12,
          depth: 2
        },
        condition: { all: ["postern_opened"] }
      }
    ],
    roads: [{
      points: [
        [-21, 21],
        [-21, 12],
        [0, 5],
        [20, 12],
        [24, 24],
        [23, 34]
      ],
      width: 4
    }, {
      points: [
        [-16, -23],
        [-15, -10],
        [0, 5],
        [15, -10],
        [16, -23]
      ],
      width: 4
    }],
    features: [
      R("west-wall", "wall", -31, 0, 2, 76, { height: 6 }),
      R("east-wall", "wall", 31, 0, 2, 76, { height: 6 }),
      R("north-wall", "wall", 0, -37, 64, 2, { height: 8 }),
      R("south-wall", "wall", 0, 37, 64, 2, { height: 6 }),
      R("cells-divider", "wall", 0, -24, 2, 28, { height: 6 }),
      R("cells-front-center", "wall", 0, -10, 20, 2, { height: 6 }),
      R("cells-front-west", "wall", -26, -10, 12, 2, { height: 6 }),
      R("cells-front-east", "wall", 26, -10, 12, 2, { height: 6 }),
      R("postern-divider", "wall", -7, 24, 50, 2, { height: 5 }),
      R("waterway-passage", "arch", -21, 19, 10, 2, { height: 7 }),
      R("postern-corridor", "wall", 17, 31, 2, 12, { height: 5 }),
      R("west-bunk", "bunk", -26, -24, 4, 8),
      R("east-bunk", "bunk", 26, -24, 4, 8),
      R("west-cell-bench", "bench", -8, -30, 2, 4),
      R("east-cell-bench", "bench", 8, -30, 2, 4),
      R("guard-desk", "ledger", 3, 12, 4, 4),
      R("hall-pier-west", "column", -7, -4, 2, 2, { height: 7 }),
      R("hall-pier-east", "column", 7, -4, 2, 2, { height: 7 })
    ]
  }
}), Hr = St({
  id: "hall",
  safe: !1,
  anchors: {
    beacon: {
      x: -22,
      y: 35
    },
    cells: {
      x: 22,
      y: 35
    },
    encounter: {
      x: 0,
      y: 5
    },
    warden: {
      x: 0,
      y: -17
    },
    orders: {
      x: 0,
      y: -36
    },
    reinforcementLeft: {
      x: -24,
      y: -12
    },
    reinforcementRight: {
      x: 24,
      y: -12
    }
  },
  exits: [{
    id: "beacon",
    anchor: "beacon",
    to: "beacon",
    arrival: "hall"
  }, {
    id: "cells",
    anchor: "cells",
    to: "cells",
    arrival: "hall"
  }],
  objects: [{
    id: "orders",
    anchor: "orders",
    kind: "inspect",
    passage: "orders",
    condition: { all: ["warden_defeated"] }
  }],
  landscape: {
    vista: "interior",
    surface: "marble",
    bounds: {
      x: 0,
      z: 0,
      width: 80,
      depth: 92
    },
    gates: [],
    roads: [{
      points: [
        [-22, 36],
        [-22, 27],
        [0, 19],
        [22, 27],
        [22, 36]
      ],
      width: 5
    }, {
      points: [
        [0, 27],
        [0, 4],
        [0, -17],
        [0, -35]
      ],
      width: 10
    }],
    features: [
      R("west-wall", "wall", -39, 0, 2, 92, { height: 11 }),
      R("east-wall", "wall", 39, 0, 2, 92, { height: 11 }),
      R("north-wall", "wall", 0, -45, 80, 2, { height: 13 }),
      R("south-wall", "wall", 0, 45, 80, 2, { height: 8 }),
      R("western-front-column", "column", -15, 17, 4, 4, { height: 12 }),
      R("eastern-front-column", "column", 15, 17, 4, 4, { height: 12 }),
      R("western-middle-column", "column", -15, -3, 4, 4, { height: 12 }),
      R("eastern-middle-column", "column", 15, -3, 4, 4, { height: 12 }),
      R("western-rear-column", "column", -15, -25, 4, 4, { height: 12 }),
      R("eastern-rear-column", "column", 15, -25, 4, 4, { height: 12 }),
      R("entry-vault", "arch", 0, 17, 30, 2, { height: 14 }),
      R("rear-vault", "arch", 0, -25, 30, 2, { height: 14 }),
      R("west-gallery", "planter", -32, 4, 6, 28),
      R("east-gallery", "planter", 32, 4, 6, 28),
      R("west-gallery-bench", "bench", -28, 28, 2, 6),
      R("east-gallery-bench", "bench", 28, 28, 2, 6),
      R("crown-console", "ledger", 0, -41, 6, 4),
      R("northern-west-pillar", "column", -29, -35, 4, 4, { height: 14 }),
      R("northern-east-pillar", "column", 29, -35, 4, 4, { height: 14 })
    ]
  }
}), Vr = St({
  id: "roots",
  safe: !1,
  anchors: {
    crossroads: {
      x: 0,
      y: 34
    },
    encounter: {
      x: 0,
      y: 5
    },
    tree: {
      x: 0,
      y: -12
    },
    rootLeft: {
      x: -12,
      y: -13
    },
    rootRight: {
      x: 12,
      y: -13
    }
  },
  exits: [{
    id: "crossroads",
    anchor: "crossroads",
    to: "crossroads",
    arrival: "roots"
  }],
  objects: [],
  landscape: {
    vista: "garden",
    surface: "grass",
    bounds: {
      x: 0,
      z: 0,
      width: 80,
      depth: 84
    },
    gates: [],
    suspended: [{
      kind: "pipe",
      from: [
        -38,
        3.2,
        -29
      ],
      to: [
        -3,
        3.2,
        -29
      ]
    }, {
      kind: "pipe",
      from: [
        3,
        2.8,
        -29
      ],
      to: [
        38,
        2.8,
        -29
      ]
    }],
    roads: [{
      points: [
        [0, 35],
        [0, 23],
        [-9, 11],
        [-12, -7],
        [0, -19]
      ],
      width: 5
    }, {
      points: [
        [0, 23],
        [11, 12],
        [13, -5],
        [0, -19]
      ],
      width: 4
    }],
    features: [
      R("west-enclosure", "wall", -39, 0, 2, 84, { height: 3 }),
      R("east-enclosure", "wall", 39, 0, 2, 84, { height: 3 }),
      R("north-enclosure", "wall", 0, -41, 80, 2, { height: 4 }),
      R("south-enclosure", "wall", 0, 41, 80, 2, { height: 3 }),
      R("dead-heartwood", "root", 0, -29, 12, 10, { height: 17 }),
      R("western-root", "root", -22, -15, 8, 4, { height: 3.8 }),
      R("eastern-root", "root", 22, -11, 8, 4, { height: 3.2 }),
      R("west-reflecting-pool", "water", -26, 9, 12, 16),
      R("east-reflecting-pool", "water", 26, 9, 12, 16),
      R("west-old-colonnade", "ruin", -15, 7, 4, 4, { height: 5 }),
      R("east-old-colonnade", "ruin", 15, 9, 4, 4, { height: 4 }),
      R("western-growth", "thicket", -29, -27, 14, 12),
      R("eastern-growth", "thicket", 29, -27, 14, 12),
      R("west-entry-pillar", "column", -7, 30, 4, 4, { height: 7 }),
      R("east-entry-pillar", "column", 7, 30, 4, 4, { height: 7 }),
      R("garden-arch", "arch", 0, 30, 14, 2, { height: 9 }),
      R("west-entry-tree", "tree", -21, 29, 6, 6, {
        height: 12,
        tint: "rose"
      }),
      R("east-entry-tree", "tree", 23, 29, 6, 6, {
        height: 12,
        tint: "sage"
      }),
      R("west-north-tree", "tree", -18, -33, 6, 6, {
        height: 14,
        tint: "sage"
      }),
      R("east-north-tree", "tree", 18, -33, 6, 6, {
        height: 14,
        tint: "rose"
      })
    ]
  }
}), Ce = {
  camp: Nr,
  crossroads: Dr,
  gate: Fr,
  beacon: Br,
  waterway: qr,
  cells: Wr,
  hall: Hr,
  roots: Vr
}, Gr = 2.4;
function ya(e, t) {
  return (!e?.all || e.all.every((s) => t.has(s))) && (!e?.none || e.none.every((s) => !t.has(s)));
}
var En = /* @__PURE__ */ new WeakMap();
function Rt(e, t) {
  const s = e.gates.filter((i) => ya(i.condition, t)).map((i) => i.id), a = s.join("/");
  let n = En.get(e);
  n || (n = /* @__PURE__ */ new Map(), En.set(e, n));
  let r = n.get(a);
  return r || (r = us(e.map, new Set(s)), n.set(a, r)), r;
}
function ka(e, t) {
  const s = e.exits.filter((n) => ya(n.condition, t)).map((n) => ({
    kind: "exit",
    target: n,
    position: e.anchors[n.anchor]
  })), a = e.objects.filter((n) => ya(n.condition, t) && !(n.kind === "switch" && t.has(n.fact))).map((n) => ({
    kind: "object",
    target: n,
    position: e.anchors[n.anchor]
  }));
  return [...s, ...a];
}
function Yr(e, t, s) {
  const a = Rt(e, s);
  return ka(e, s).filter((n) => q(t.position, n.position) <= 2.4 && $e(a, t.position, n.position)).sort((n, r) => q(t.position, n.position) - q(t.position, r.position) || n.target.id.localeCompare(r.target.id));
}
function Qr(e, t, s, a = 1) {
  (!Number.isInteger(t) || t < 0 || t > 8) && Re("input_invalid"), t && (e.facing = on(t), rn(s, e.position, {
    x: Math.cos(e.facing) * Q.speed * a,
    y: Math.sin(e.facing) * Q.speed * a
  }, Q.playerRadius));
}
var Gt = {
  crossroads: {
    complete: "crossroads_cleared",
    triggerRadius: 26,
    boss: null,
    summons: [],
    waves: [[{
      kind: "soldier",
      anchor: "patrol"
    }, {
      kind: "soldier",
      anchor: "lookout"
    }]]
  },
  gate: {
    complete: "patrol_cleared",
    boss: null,
    summons: [],
    waves: [[{
      kind: "guard",
      anchor: "guard"
    }, {
      kind: "archer",
      anchor: "archer"
    }]]
  },
  beacon: {
    complete: "alarm_silenced",
    boss: null,
    summons: [],
    waves: [[{
      kind: "guard",
      anchor: "guard"
    }, {
      kind: "archer",
      anchor: "archer"
    }], [{
      kind: "charger",
      anchor: "guard"
    }]]
  },
  waterway: {
    complete: "waterway_cleared",
    boss: null,
    summons: [],
    waves: [[{
      kind: "guard",
      anchor: "guard"
    }]]
  },
  hall: {
    complete: "warden_defeated",
    boss: "warden",
    summons: ["reinforcementLeft", "reinforcementRight"],
    waves: [[{
      kind: "warden",
      anchor: "warden"
    }]]
  },
  roots: {
    complete: "roots_cleared",
    boss: "thornheart",
    summons: ["rootLeft", "rootRight"],
    waves: [[{
      kind: "thornheart",
      anchor: "tree"
    }]]
  }
};
function vs(e, t, s, a, n, r) {
  const i = Gt[e];
  if (!i || t.has(i.complete)) return null;
  const u = Ce[e], o = i.waves.map((c) => c.map((d) => ({
    kind: d.kind,
    position: u.anchors[d.anchor]
  })));
  return e === "hall" && r && o[0].push({
    kind: "guard",
    position: u.anchors.reinforcementLeft
  }, {
    kind: "archer",
    position: u.anchors.reinforcementRight
  }), {
    setup: {
      seed: a,
      zone: 0,
      chapter: 0,
      elite: !1,
      boss: i.boss !== null,
      bossKind: i.boss ?? "warden",
      encounter: "skirmish",
      hp: n
    },
    field: {
      space: Rt(u, t),
      entry: s,
      objective: u.anchors.encounter,
      waves: o,
      summonPoints: i.summons.map((c) => u.anchors[c])
    }
  };
}
var _a = {
  sanniang: "三娘",
  anian: "阿念",
  kouzi: "扣子",
  laobai: "老白"
}, vt = Object.keys(_a), Kr = {
  sanniang: "changyounian_intel",
  laobai: "bajin_intel",
  anian: null,
  kouzi: null
}, oe = Object.freeze({
  artwork: {
    unavailable: "部分场景纹理未载入，不影响游玩。",
    retry: "重新载入",
    loading: "载入中…"
  },
  scenes: {
    camp: "檐下",
    crossroads: "外墙岔口",
    gate: "哨站正门",
    beacon: "烽火台",
    waterway: "旧水道",
    cells: "牢房",
    hall: "内堡门厅",
    roots: "根庭"
  },
  people: _a,
  switches: {
    sluice_opened: "升起水闸",
    captives_released: "打开牢门",
    postern_opened: "拉开小门"
  },
  passages: {
    warning: {
      title: "哨站的烽火",
      body: "墙上的传令管正通向烽火台。先熄灭烽火，能截住内堡的增援；若从水道先去救人，守军会在撤离途中或内堡集结。受困者不会因为你停下来查看道路而被处决。"
    },
    cargo: {
      title: "归还的货签",
      body: `货车上是药材和冷却管件。

哨站随货送来的放还单：
“冷却管件十二副，库中仅此，余者冻裂报损。”

管件箱里夹着的出库签：
“本箱原装二十四副，出十二，存十二，完好。”`
    },
    orders: {
      title: "主闸控制台",
      body: "封锁的闸齿停了下来，外墙的输送轨道正在逐段亮起。控制台上的旧命令只有“内城优先”四个字，没有撤销日期。"
    }
  },
  actions: {
    inspect: "查看",
    talk: "交谈",
    rest: "休整",
    travel: "前往",
    close: "返回",
    interact: "交互",
    next: "切换对象",
    map: "地图",
    resume: "继续",
    move: "移动",
    controls: "WASD 或方向键移动，E 交互",
    paused: "已暂停"
  }
}), Sa = {
  sanniang: {
    initial: {
      scene: "camp",
      anchor: "clinic"
    },
    home: {
      scene: "camp",
      anchor: "clinic"
    },
    captive: !1
  },
  laobai: {
    initial: {
      scene: "camp",
      anchor: "guard"
    },
    home: {
      scene: "camp",
      anchor: "guard"
    },
    captive: !1
  },
  kouzi: {
    initial: {
      scene: "cells",
      anchor: "kouzi"
    },
    home: {
      scene: "camp",
      anchor: "kouzi"
    },
    captive: !0
  },
  anian: {
    initial: {
      scene: "cells",
      anchor: "anian"
    },
    home: {
      scene: "camp",
      anchor: "anian"
    },
    captive: !0
  }
}, ln = {
  camp: {
    scene: "camp",
    anchor: "start",
    name: "檐下营地"
  },
  gatehouse: {
    scene: "camp",
    anchor: "gatehouse",
    name: "外门门楼"
  },
  pipewalk: {
    scene: "camp",
    anchor: "kouzi",
    name: "管架高处"
  },
  clinic_back: {
    scene: "camp",
    anchor: "clinic_back",
    name: "诊棚后"
  },
  registry: {
    scene: "camp",
    anchor: "registry",
    name: "登记棚"
  },
  crossroads: {
    scene: "crossroads",
    anchor: "warning",
    name: oe.scenes.crossroads
  },
  gate: {
    scene: "gate",
    anchor: "crossroads",
    name: oe.scenes.gate
  },
  beacon: {
    scene: "beacon",
    anchor: "gate",
    name: oe.scenes.beacon
  },
  waterway: {
    scene: "waterway",
    anchor: "crossroads",
    name: oe.scenes.waterway
  },
  cells: {
    scene: "cells",
    anchor: "release",
    name: oe.scenes.cells
  },
  hall: {
    scene: "hall",
    anchor: "cells",
    name: oe.scenes.hall
  },
  roots: {
    scene: "roots",
    anchor: "crossroads",
    name: oe.scenes.roots
  }
}, cn = {
  briefing: {
    atHome: !1,
    people: ["sanniang", "laobai"],
    requires: [],
    fact: "briefed",
    meaning: "玩家明确愿意去哨站救人时提交，确认接下救援委托、开放营地外的路线。对白说明正门与旧水道两条路线；是否邀你同行另算，实际救援由探索完成。"
  },
  receiving: {
    atHome: !1,
    people: ["laobai"],
    requires: [],
    fact: "receiving_arranged",
    meaning: "玩家请求或接受担架接应，老白答应安排时提交。担架队在小门接应；牢门和小门打开后，玩家回到檐下才完成接回。"
  },
  finish: {
    atHome: !1,
    people: ["sanniang"],
    requires: [
      "captives_arrived",
      "supplies_secured",
      "warden_defeated"
    ],
    fact: "chapter_completed",
    meaning: "与玩家核对回来的两个人和药材后提交收尾。玩家读完并继续后结算这一章。第二章尚未开放。"
  },
  clinic: {
    atHome: !0,
    people: ["sanniang"],
    requires: ["captives_arrived", "supplies_secured"],
    fact: "clinic_helped",
    meaning: "玩家帮三娘归置归还的药材、你在对白中回应这次协助时提交。记录共同经历，好感和态度由你另行判断。"
  }
}, gs = Object.keys(cn);
function Xr(e, t, s) {
  return s.scene !== "camp" ? [] : gs.filter((a) => {
    const n = cn[a], r = Sa[t].home, i = Ce[r.scene].anchors[r.anchor];
    return n.atHome && Math.hypot(s.position.x - i.x, s.position.y - i.y) > 2.4 ? !1 : n.people.includes(t) && !e.includes(n.fact) && n.requires.every((u) => e.includes(u));
  });
}
var jt = (e, t) => Math.hypot(e.x - t.x, e.y - t.y), In = /* @__PURE__ */ new WeakMap();
function Ha(e, t, s) {
  if ($e(e, t, s, Q.playerRadius)) return s;
  const a = Tt(e.map, t), n = Tt(e.map, s), r = `${a.column},${a.row}/${n.column},${n.row}`;
  let i = In.get(e);
  i || (i = /* @__PURE__ */ new Map(), In.set(e, i));
  const u = Vt(e.map, a.column, a.row);
  if (!i.has(r)) {
    const c = ra(e, u, Vt(e.map, n.column, n.row), Q.playerRadius);
    i.size >= 512 && i.delete(i.keys().next().value), i.set(r, c?.find((d) => jt(d, u) > 0.01) ?? null);
  }
  const o = i.get(r);
  return o ? $e(e, t, o, Q.playerRadius) ? o : u : null;
}
function fa(e, t) {
  const s = Gt[e];
  return !s || t.has(s.complete);
}
function Va(e, t, s, a) {
  const n = [{
    ...e,
    route: []
  }], r = /* @__PURE__ */ new Set();
  for (; n.length; ) {
    const i = n.shift(), u = Ce[i.scene], o = Rt(u, s);
    if (i.scene === t.scene && Ha(o, i.position, u.anchors[t.anchor])) return i.route;
    for (const c of Ce[i.scene].exits) {
      const d = `${c.to}/${c.arrival}`;
      r.has(d) || !ya(c.condition, s) || a && !fa(c.to, s) || !Ha(o, i.position, u.anchors[c.anchor]) || (r.add(d), n.push({
        scene: c.to,
        position: Ce[c.to].anchors[c.arrival],
        route: [...i.route, c]
      }));
    }
  }
  return null;
}
function ys(e, t) {
  const s = new Set(e.facts), a = e.people[t];
  return Object.entries(ln).map(([n, r]) => ({
    id: n,
    name: r.name,
    personHere: a.scene === r.scene && (n === r.scene || jt(a.position, Ce[r.scene].anchors[r.anchor]) <= 2.4),
    playerHere: e.location.scene === r.scene && (n === r.scene || jt(e.location.position, Ce[r.scene].anchors[r.anchor]) <= 2.4),
    accessible: (r.scene === "camp" || s.has("briefed")) && Va(a, r, s, !1) !== null,
    safe: fa(r.scene, s),
    solo: fa(a.scene, s) && fa(r.scene, s) && Va(a, r, s, !0) !== null
  }));
}
function Jr(e, t) {
  return !Sa[t].captive || e.facts.includes("captives_arrived");
}
var bs = (e) => Gr * (0.7 + vt.indexOf(e) / vt.length * 0.2);
function eo(e) {
  return vt.some((t) => e.people[t].mode === "travel" || e.people[t].mode === "follow" && jt(e.people[t].position, e.location.position) >= bs(t));
}
function ws(e, t) {
  return vt.filter((s) => t[s].scene === e).map((s) => ({
    kind: "object",
    position: t[s].position,
    target: {
      id: s,
      anchor: "",
      kind: "person",
      person: s
    }
  }));
}
function xs(e) {
  return [...ka(Ce[e.location.scene], new Set(e.facts)), ...ws(e.location.scene, e.people)];
}
function un(e, t, s, a) {
  return ws(e.id, a).filter((n) => {
    if (n.kind !== "object" || n.target.kind !== "person") return !1;
    const r = e.id === "cells" && Sa[n.target.person].captive && !s.has("captives_arrived"), i = Rt(e, r ? /* @__PURE__ */ new Set([...s, "captives_released"]) : s);
    return jt(n.position, t) <= (r ? 5 : 2.4) && $e(i, t, n.position);
  });
}
function to(e) {
  const t = new Set(e.facts);
  for (const s of vt) {
    const a = e.people[s];
    if (a.mode === "idle") continue;
    const n = Ce[a.scene], r = Rt(n, t);
    let i, u;
    if (a.mode === "follow") {
      if (a.scene !== e.location.scene && be("invalid"), i = e.location.position, jt(a.position, i) < bs(s)) continue;
    } else {
      const f = ln[a.destination], g = Va(a, f, t, !0);
      if (g || be("unavailable"), u = g[0], i = n.anchors[u?.anchor ?? f.anchor], jt(a.position, i) < 0.2) {
        u ? (a.scene = u.to, a.position = { ...Ce[u.to].anchors[u.arrival] }) : (a.mode = "idle", a.destination = null);
        continue;
      }
    }
    const o = Ha(r, a.position, i);
    o || be("unavailable");
    const c = o.x - a.position.x, d = o.y - a.position.y, l = Math.hypot(c, d), h = Math.min(l, Q.speed * 1.8);
    l && (a.facing = Math.atan2(d, c), rn(r, a.position, {
      x: c / l * h,
      y: d / l * h
    }, Q.playerRadius));
  }
}
var Ne = {
  bajin: {
    name: "八斤",
    card: "enemy-bajin",
    scene: "gate",
    intel: "bajin_intel",
    complete: "patrol_cleared",
    persuaded: "bajin_passed",
    kind: "guard",
    anchor: "parley",
    clearedAnchor: "parley_side",
    approachRadius: 7,
    sentryExits: {
      guard: "guard_side",
      archer: "archer_side"
    }
  },
  changyounian: {
    name: "常有年",
    card: "enemy-changyounian",
    scene: "beacon",
    intel: "changyounian_intel",
    complete: "alarm_silenced",
    persuaded: "changyounian_passed",
    kind: "archer",
    anchor: "parley",
    clearedAnchor: "parley_side",
    approachRadius: 7,
    sentryExits: {
      guard: "guard_side",
      archer: "archer_side"
    }
  }
}, Ra = Object.keys(Ne), Ms = [...vt, ...Ra];
function De(e) {
  return Object.hasOwn(_a, e);
}
function pt(e) {
  return De(e) ? _a[e] : Ne[e].name;
}
function ba(e, t) {
  const s = Ne[e];
  return Ce[s.scene].anchors[t.has(s.complete) ? s.clearedAnchor : s.anchor];
}
function Ca(e, t, s) {
  return Ra.filter((a) => Ne[a].scene === e).flatMap((a) => {
    const n = ba(a, s), r = Ne[a];
    return Math.hypot(t.x - n.x, t.y - n.y) <= r.approachRadius ? [{
      kind: "object",
      target: {
        id: a,
        anchor: "",
        kind: "enemy",
        enemy: a
      },
      position: n
    }] : [];
  });
}
function Ga(e) {
  return (!e || typeof e != "object" || Array.isArray(e)) && be("invalid"), e;
}
function Ln(e, t = 0, s = Number.MAX_SAFE_INTEGER) {
  return (!Number.isSafeInteger(e) || Number(e) < t || Number(e) > s) && be("invalid"), e;
}
function kt(e, t) {
  return (typeof e != "string" || !t.includes(e)) && be("invalid"), e;
}
function An(e, t, s) {
  return (!Array.isArray(e) || e.length > t) && be("invalid"), e.map(s);
}
function ao(e) {
  return new Set(e).size !== e.length && be("invalid"), e;
}
function Tn(e) {
  typeof e != "boolean" && be("invalid");
}
function no(e) {
  return (typeof e != "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(e)) && be("identity"), e;
}
var ks = ["male", "female"];
function so(e) {
  const t = Ga(e);
  return (typeof t.name != "string" || !t.name.trim() || t.name.trim().length > 24 || /[\r\n]/.test(t.name)) && be("invalid"), {
    name: t.name.trim(),
    gender: kt(t.gender, ks)
  };
}
var It = Object.freeze({
  id: "outpost",
  number: "第一章",
  numeral: "I",
  title: "哨站救援"
}), _s = `${It.number} · ${It.title}`, ro = {
  sanniang: { initial: {
    reply: "先坐一坐。檐下不常见生面孔，身上可有哪里不舒服？路上受的凉、磕碰的小伤，都可以同我说。",
    performance: {
      expression: "smile",
      gesture: "gesture"
    }
  } },
  laobai: { initial: {
    reply: "生面孔啊。找人，还是找路？找人我倒认得几个，找路嘛……我这条腿，眼下只能给你指指。",
    performance: {
      expression: "teasing",
      gesture: "tilt"
    }
  } },
  anian: {
    initial: {
      reply: "嗯？……你不是这里的人。是来接我们的吗？这些货签我还留着，就是泡皱了。",
      performance: {
        expression: "surprised",
        gesture: "tilt"
      }
    },
    returned: {
      reply: "啊，你来了。三娘让我在这儿歇着……你要坐吗？这边还有地方。",
      performance: {
        expression: "neutral",
        gesture: "gesture"
      }
    }
  },
  kouzi: {
    initial: {
      reply: "哎，新来的。别站那儿挡光，我正看这道缝呢。……外头现在什么动静？",
      performance: {
        expression: "serious",
        gesture: "tilt"
      }
    },
    returned: {
      reply: "哎，找我？站稳了再说，这边管子松着。别伸手，我自己下得来。",
      performance: {
        expression: "neutral",
        gesture: "gesture"
      }
    }
  },
  bajin: { initial: {
    reply: "来人止步。此处是哨站正门，往来均须验签。把凭签拿出来，有什么事，一并说清楚。",
    performance: {
      expression: "neutral",
      gesture: "gesture"
    }
  } },
  changyounian: { initial: {
    reply: "这位，且留步。烽火台不是寻常走动的地方，不知是哪一位放你上来的？若有公事，不妨先说给我听。",
    performance: {
      expression: "neutral",
      gesture: "tilt"
    }
  } }
};
function Ss(e, t) {
  const s = ro[t], a = e.facts.includes("captives_arrived") && s.returned ? s.returned : s.initial;
  return {
    id: `greeting-${t}`,
    kind: "greeting",
    player: "",
    ...structuredClone(a),
    action: null,
    scene: e.location.scene,
    facts: [...e.knowledge[t]]
  };
}
function Ya(e) {
  const t = e.lastReply;
  if (!t) return null;
  const s = e.conversations[t.person].at(-1);
  return s?.id === t.turnId ? {
    person: t.person,
    turn: s
  } : null;
}
function Rs(e) {
  const t = Ya(e);
  return t?.turn.action === "finish" && !e.facts.includes("chapter_completed") ? t.person : null;
}
var ta = Object.freeze({
  encounterReach: 14,
  alarmTicks: 900,
  explorationSpeed: 1.65,
  playerTextLimit: 2e3,
  replyTextLimit: 8e3
});
function Qa(e) {
  return {
    weapon: e.weapon,
    oaths: [],
    relics: e.equipped.map((t) => e.collection.find((s) => s.id === t))
  };
}
function oo(e, t) {
  if (e.phase !== "exploration" || !Ce[e.location.scene].safe) return "unavailable";
  if (t.length > Q.relicSlots) return "capacity";
  if (new Set(t).size !== t.length || t.some((a) => !e.collection.some((n) => n.id === a))) return "invalid";
  const s = {
    weapon: e.weapon,
    oaths: [],
    relics: e.collection.filter((a) => t.includes(a.id))
  };
  return t.some((a) => !cs(s, a)) ? "dependency" : null;
}
function Cs(e, t, s) {
  e.facts.includes(t) || e.facts.push(t);
  const a = s ?? [...vt.filter((n) => e.people[n].scene === e.location.scene), ...Ra.filter((n) => Ne[n].scene === e.location.scene)];
  for (const n of a) e.knowledge[n].includes(t) || e.knowledge[n].push(t);
}
function io(e) {
  const t = e.checkpoint;
  return vs(e.location.scene, new Set(e.facts), t?.player ?? e.location.position, t?.seed ?? e.seed, t?.player.hp ?? e.hp, e.facts.includes("alarm_raised") && !e.facts.includes("alarm_silenced"))?.field;
}
function lo(e) {
  const t = Gt[e.location.scene];
  Cs(e, t.complete);
  const s = Qa(e);
  t.boss && (e.hp = Math.min(Q.maxHp, e.hp + 20 + z(s, "renewal") * Ee.renewalZoneHeal)), e.offers = hr(e, fr(e.weapon).flatMap((a) => {
    const n = e.collection.find((r) => r.id === a)?.rank ?? 0;
    return n < Q.maxRelicRank && cs(s, a) && (sa[a].chapter === 0 || e.facts.includes("warden_defeated")) ? [{
      id: a,
      rank: n + 1
    }] : [];
  }), 3), e.phase = e.offers.length ? "reward" : "exploration", e.battle = null, e.checkpoint = null;
}
function jn(e, t) {
  if (!(e.pendingParley || Rs(e))) {
    if (e.phase === "battle" && e.battle) {
      const s = io(e);
      s || be("invalid"), Zr(e.battle, t, Qa(e), s);
      const a = e.battle;
      e.hp = a.player.hp, e.location.position = {
        x: a.player.x,
        y: a.player.y
      }, e.location.facing = a.player.facing, ["gate", "beacon"].includes(e.location.scene) && !e.facts.includes("alarm_silenced") && (e.alarmTicks++, e.alarmTicks >= ta.alarmTicks && Cs(e, "alarm_raised")), a.status === "won" ? lo(e) : a.status === "lost" && (e.phase = "lost");
    } else if (e.phase === "exploration") {
      const s = Ce[e.location.scene], a = new Set(e.facts);
      Qr(e.location, t.move, Rt(s, a), ta.explorationSpeed);
      const n = Gt[s.id], r = s.anchors.encounter;
      if (n && !a.has(n.complete) && r && Math.hypot(e.location.position.x - r.x, e.location.position.y - r.y) <= (n.triggerRadius ?? ta.encounterReach)) {
        const i = vs(s.id, a, e.location.position, Math.floor(xa(e) * 4294967296), e.hp, a.has("alarm_raised") && !a.has("alarm_silenced"));
        e.battle = Or(i.setup, Qa(e), i.field), e.checkpoint = structuredClone(e.battle), e.phase = "battle";
      }
    }
    (e.phase === "exploration" || e.phase === "battle") && to(e);
  }
}
var wa = Object.freeze({
  minimum: 0,
  maximum: 100,
  changeMin: 2,
  changeMax: 4,
  bands: [
    0,
    21,
    41,
    61,
    81
  ]
});
function dn(e) {
  return wa.bands.filter((t) => e >= t).length - 1;
}
var Ft = {
  none: "保持这一句的表情与姿态",
  nod: "轻轻点头一次",
  tilt: "略侧头打量，再回正",
  shake: "轻轻摇头一次",
  gesture: "抬起空着的手掌，作一个轻缓的示意",
  withdraw: "外伸的手略向内收，停一下再放松"
}, co = {
  sanniang: {
    expressions: {
      neutral: "平静倾听",
      smile: "真诚愉快地微笑",
      teasing: "从容、有一点逗弄的笑意",
      blush: "脸颊泛红，仍看向对方",
      rest: "安心合眼、短暂休憩",
      serious: "收起笑意，认真而冷静",
      worried: "眉间担忧，仍专注看着对方",
      sad: "垂眼含泪，流露难过",
      displeased: "收起客气，冷淡地表达不悦",
      fond: "眼帘半垂，仍看着对方，微张嘴温柔回应",
      laugh: "笑弯眼睛，自然地笑出声",
      surprised: "睁大眼，微张嘴，短暂失去从容"
    },
    gestures: Ft
  },
  anian: {
    expressions: {
      neutral: "略带出神地听着",
      smile: "回过神来，露出自然坦率的微笑",
      laugh: "玩得高兴，放开地笑出声",
      blush: "脸颊明显泛红，有些迟疑地看着对方",
      fond: "眼帘半垂，带着柔和笑意回应对方",
      rest: "安心合眼，短暂休憩",
      surprised: "睁大眼，微张嘴，忽然回过神",
      worried: "眉间担忧，留神听着",
      displeased: "皱眉抿嘴，明显不高兴",
      sad: "垂眼难过，嘴角低下来"
    },
    gestures: Ft
  },
  kouzi: {
    expressions: {
      neutral: "利落、直接地看着对方",
      blush: "脸颊泛红，别开目光，嘴上仍有些倔",
      smile: "办成事情后，露出利落得意的笑",
      teasing: "挑起一边眉梢，嘴角带着促狭的笑",
      laugh: "忘了绷着，痛快地笑出声",
      fond: "目光难得柔和下来，微张嘴想说真心话",
      serious: "收起玩笑，冷静专注",
      surprised: "睁大眼，微张嘴，有些不敢相信",
      worried: "眉间紧起来，尽量藏住担心",
      displeased: "目光变锐，明确表示不悦",
      sad: "垂下眼，咬住话头，不愿露出受伤的样子"
    },
    gestures: Ft
  },
  laobai: {
    expressions: {
      neutral: "松松地站着，听对方说话",
      smile: "眉眼松开，好相处地笑了笑",
      teasing: "挑起一边眉梢，带着自嘲的促狭笑意",
      laugh: "没绷住，真心笑出声",
      blush: "脸颊泛红，目光躲开，有些措手不及",
      fond: "目光柔和下来，半垂眼帘，微张嘴回应",
      serious: "玩笑收住，目光安静而认真",
      surprised: "眉梢抬起，睁大眼，话停了一下",
      worried: "眉间微皱，藏不住担心",
      sad: "垂下目光，笑意消失，安静地难过"
    },
    gestures: Ft
  },
  bajin: {
    expressions: {
      neutral: "绷着脸，警惕地审视来人",
      suspicious: "眯起眼，带着怀疑审视",
      angry: "眉头压紧，硬声发令",
      worried: "眉间露出紧张，眼神有些慌",
      relieved: "脸上稍松，仍然保持警惕",
      resigned: "垂下目光，不情愿地让步"
    },
    gestures: {
      ...Ft,
      gesture: "略抬拿签的手，作一个示意",
      withdraw: "拿签的手略向内收，再放松"
    }
  },
  changyounian: {
    expressions: {
      neutral: "眯着眼，保持克制的官家神色",
      smile: "带着分寸的客气微笑",
      squint: "眼睛眯得更紧，费力辨认",
      displeased: "客气收住，神色冷下来",
      worried: "眉间绷紧，露出一丝不安",
      relieved: "眉眼稍松，露出疲惫的淡笑"
    },
    gestures: Ft
  }
};
function uo(e) {
  return co[e];
}
var ho = (e) => kt(e, ls), On = (e) => kt(e, rs), Zn = (e) => kt(e, is);
function fo(e) {
  const t = Ga(e);
  switch (t.type) {
    case "start":
    case "restart":
      return {
        type: t.type,
        weapon: ho(t.weapon),
        outfit: Zn(t.outfit),
        traveler: so(t.traveler),
        chapter: kt(t.chapter, [It.id])
      };
    case "purchase":
    case "equip":
      return {
        type: t.type,
        id: Zn(t.id)
      };
    case "interact":
      return {
        type: "interact",
        id: no(t.id)
      };
    case "choice":
      return {
        type: "choice",
        id: kt(t.id, gs),
        person: kt(t.person, vt)
      };
    case "greet":
      return {
        type: "greet",
        person: kt(t.person, Ms)
      };
    case "loadout":
      return {
        type: "loadout",
        equipped: ao(An(t.equipped, Q.relicSlots, On))
      };
    case "input": {
      const s = An(t.spans, Q.maxInputTicks, (a) => {
        const n = Ga(a);
        return Tn(n.dash), Tn(n.skill), {
          move: Ln(n.move, 0, 8),
          dash: n.dash,
          skill: n.skill,
          ticks: Ln(n.ticks, 1, Q.maxInputTicks)
        };
      });
      return (!s.length || s.reduce((a, n) => a + n.ticks, 0) > Q.maxInputTicks) && be("invalid"), {
        type: "input",
        spans: s
      };
    }
    case "relic":
      return {
        type: "relic",
        id: On(t.id)
      };
    case "leave":
    case "retry":
    case "retreat":
    case "resolve_parley":
    case "accept_reply":
      return { type: t.type };
    default:
      return be("invalid");
  }
}
function po(e, t) {
  const s = Ht(null), a = B(!1), n = B(""), r = Ht(null), i = B(!1), u = B(!1), o = Ht(null), c = B(null), d = X(() => s.value?.replyFailure?.actionId === c.value ? null : s.value?.replyFailure ?? null), l = X(() => i.value || !!s.value?.conversation), h = B(!1), f = B(!1);
  let g = !1, v = null;
  const b = X(() => a.value || l.value || u.value || !!r.value || !s.value?.ready || s.value.writeState !== "ready" || s.value.pending);
  function x(L) {
    if (g || s.value && L.data.revision < s.value.data.revision) return;
    const $ = o.value;
    (s.value?.data.active?.id !== L.data.active?.id || $ && L.data.active?.conversations[$.person].some((O) => O.id === $.actionId)) && (o.value = null), s.value = L;
  }
  const _ = X(() => {
    if (o.value) return o.value;
    if (s.value?.conversation) return {
      ...s.value.conversation,
      status: "sending"
    };
    const L = s.value?.replyFailure;
    return !L || L.regenerating || s.value?.data.active?.conversations[L.person].some(($) => $.id === L.actionId) ? null : {
      actionId: L.actionId,
      person: L.person,
      text: L.playerText,
      regenerating: !1,
      status: "failed"
    };
  });
  async function p(L, $) {
    if (g || a.value) return !1;
    a.value = !0, v = null, n.value = "";
    try {
      const O = await e.request(`game/expedition/${L}`, {
        chatIdentity: t,
        ...L === "rebuild" ? { actionId: Oa() } : {},
        ...$
      }, 35e3), T = v;
      return x(T && T.data.revision >= O.result.data.revision ? T : O.result), h.value = !1, f.value = !1, s.value?.writeState === "ready" && !s.value.pending && L !== "read" && (r.value = null), !0;
    } catch (O) {
      if (!g) {
        h.value = !0, v && x(v), n.value = Et(O);
        const T = O && typeof O == "object" && "code" in O ? String(O.code) : "";
        f.value = T === "expedition_data_invalid", $ && (T.startsWith("expedition_save_") || T.startsWith("host_request_")) && (r.value = $);
      }
      return !1;
    } finally {
      g || (a.value = !1);
    }
  }
  const w = e.subscribe((L) => {
    if (g) return;
    if (L.type === "game/expedition/error") {
      const O = L.payload;
      O.chatIdentity === t && (n.value = Et(O), f.value = O.code === "expedition_data_invalid");
      return;
    }
    if (L.type !== "game/expedition/state") return;
    const $ = L.payload;
    $.chatIdentity === t && (a.value ? v = $.state : x($.state));
  });
  async function M() {
    const L = r.value;
    return !await p("confirm") || !s.value || s.value.writeState !== "ready" || s.value.pending ? !1 : L && s.value.data.revision === L.revision ? p("act", L) : (r.value = null, u.value = !1, !0);
  }
  async function S(L, $, O) {
    if (b.value || g) return !1;
    const T = Oa();
    o.value = {
      actionId: T,
      person: L,
      text: $,
      regenerating: !!O,
      status: "sending"
    }, i.value = !0, a.value = !0, n.value = "", v = null;
    try {
      const V = await e.request(O ? "game/expedition/regenerate" : "game/expedition/talk", {
        chatIdentity: t,
        actionId: T,
        revision: s.value.data.revision,
        person: L,
        text: $,
        ...O ? { turnId: O } : {}
      }, 18e4), ee = v;
      return x(ee && ee.data.revision >= V.result.data.revision ? ee : V.result), !0;
    } catch (V) {
      if (!g) {
        v && x(v);
        const ee = V && typeof V == "object" && "code" in V ? String(V.code) : V instanceof Error ? V.message : "";
        if (ee === "expedition_cancelled")
          return n.value = "", !1;
        u.value = ee.startsWith("host_request_") || ee.startsWith("expedition_save_"), n.value = u.value ? Z.aiUnknown : s.value?.replyFailure?.actionId === T ? "" : Et(V);
      }
      return !1;
    } finally {
      i.value = !1, g || (a.value = !1, o.value?.actionId === T && (o.value = O ? null : {
        ...o.value,
        status: "failed"
      }));
    }
  }
  async function I() {
    if (l.value)
      try {
        await e.request("game/expedition/cancel", { chatIdentity: t }, 35e3);
      } catch (L) {
        g || (n.value = Et(L));
      }
  }
  const A = X(() => h.value || !!r.value || u.value || !s.value || s.value.pending || s.value.writeState !== "ready");
  return {
    view: s,
    busy: a,
    error: n,
    blocked: b,
    failed: r,
    talking: l,
    uncertainTalk: u,
    talk: S,
    outgoing: _,
    cancelTalk: I,
    recoveryRequired: A,
    dataInvalid: f,
    conversationFailure: d,
    dismissConversationFailure() {
      c.value = s.value?.replyFailure?.actionId ?? null;
    },
    rebuild: () => p("rebuild"),
    dismissError() {
      A.value || (n.value = "");
    },
    notice: X(() => n.value || (s.value && (s.value.pending || s.value.writeState !== "ready") ? te.saveError : "")),
    read: () => p("read"),
    recover: M,
    act: (L) => b.value ? Promise.resolve(!1) : p("act", {
      actionId: Oa(),
      revision: s.value.data.revision,
      command: fo(L)
    }),
    dispose() {
      g = !0, w();
    }
  };
}
function mo(e) {
  const t = Ht(null), s = Ht(!1);
  let a = [], n = 0, r = null, i = !1;
  function u() {
    const l = e.view.value?.data.active;
    if (t.value = l ? structuredClone(l) : null, t.value) for (const h of a) for (let f = 0; f < h.ticks; f++) jn(t.value, h);
    s.value = a.length > 0;
  }
  const o = pe(e.view, () => {
    !r && !a.length && u();
  }, { immediate: !0 });
  async function c() {
    if (r)
      return await r ? c() : !1;
    if (!a.length) return !e.blocked.value;
    if (e.blocked.value || i) return !1;
    const l = a;
    a = [], n = 0, r = e.act({
      type: "input",
      spans: l
    });
    const h = await r;
    return r = null, h ? u() : e.failed.value || (a = l.concat(a), n = a.reduce((f, g) => f + g.ticks, 0)), s.value = a.length > 0 || !h, h;
  }
  function d(l) {
    const h = t.value;
    !h || i || e.failed.value || e.uncertainTalk.value || e.notice.value || n >= Q.maxInputTicks || !["exploration", "battle"].includes(h.phase) || h.phase === "exploration" && !l.move && !eo(h) || (jn(h, l), Ur(a, l), n++, s.value = !0, qs(t), (n >= Q.checkpointTicks || !["exploration", "battle"].includes(h.phase)) && c());
  }
  return {
    current: t,
    dirty: s,
    input: d,
    flush: c,
    sync: u,
    async recover() {
      return await e.recover() ? (u(), c()) : !1;
    },
    dispose() {
      i = !0, o();
    }
  };
}
function vo(e) {
  let t = null, s = null, a = null, n = !1, r = !1, i = null, u = -1, o = 0, c = 0, d = 0, l = 0, h = 0;
  function f(v, b, x, _ = "sine", p = v * 0.8, w = 0) {
    if (!n || !t || !s || t.state !== "running") return;
    const M = t.createOscillator(), S = t.createGain(), I = t.currentTime + w;
    M.type = _, M.frequency.setValueAtTime(v, I), M.frequency.exponentialRampToValueAtTime(Math.max(30, p), I + b), S.gain.setValueAtTime(1e-4, I), S.gain.exponentialRampToValueAtTime(x, I + 9e-3), S.gain.exponentialRampToValueAtTime(1e-4, I + b), M.connect(S).connect(s), M.start(I), M.stop(I + b), M.onended = () => {
      M.disconnect(), S.disconnect();
    };
  }
  function g(v, b, x, _) {
    if (!n || !t || !s || !a || t.state !== "running") return;
    const p = t.createBufferSource(), w = t.createBiquadFilter(), M = t.createGain(), S = t.currentTime;
    p.buffer = a, w.type = "bandpass", w.Q.value = 0.65, w.frequency.setValueAtTime(x, S), w.frequency.exponentialRampToValueAtTime(_, S + v), M.gain.setValueAtTime(1e-4, S), M.gain.exponentialRampToValueAtTime(b, S + 8e-3), M.gain.exponentialRampToValueAtTime(1e-4, S + v), p.connect(w).connect(M).connect(s), p.start(S), p.stop(S + v), p.onended = () => {
      p.disconnect(), w.disconnect(), M.disconnect();
    };
  }
  return {
    async enable(v) {
      if (!r) {
        n = v;
        try {
          if (!v) {
            t && await t.suspend();
            return;
          }
          if (!t) {
            t = new AudioContext(), s = t.createGain(), s.gain.value = 0.55, s.connect(t.destination), a = t.createBuffer(1, t.sampleRate, t.sampleRate);
            const b = a.getChannelData(0);
            for (let x = 0; x < b.length; x++) b[x] = Math.random() * 2 - 1;
          }
          await t.resume();
        } catch {
          n = !1, r || e();
        }
      }
    },
    tick(v) {
      (!i || v.tick < u) && (u = -1, o = v.player.hp, c = v.kills, d = v.player.skill, l = v.serial, h = v.player.combo), i = v, u !== v.tick && (u = v.tick, v.player.hp < o && (g(0.16, 0.17, 800, 120), f(95, 0.2, 0.12, "triangle", 42)), v.kills > c && (f(659, 0.22, 0.045), f(988, 0.3, 0.025, "sine", 980, 0.035)), v.player.combo > h && g(0.095, 0.08, 2700, 500), v.player.dashTime === 7 && g(0.2, 0.09, 500, 2600), v.player.skill > d && (g(0.24, 0.12, 2200, 250), f(165, 0.35, 0.075, "triangle", 82), f(660, 0.36, 0.035, "sine", 440, 0.02)), v.effects.some((b) => b.id > l && b.kind === "lightning") && (g(0.12, 0.1, 4400, 1e3), f(1200, 0.08, 0.018, "sine", 210)), v.effects.some((b) => b.id > l && (b.kind === "block" || b.kind === "parry")) && (f(1350, 0.18, 0.07, "triangle", 740), f(2200, 0.11, 0.025, "sine", 1600)), v.effects.some((b) => b.id > l && b.kind === "ward-hit") && f(510, 0.16, 0.06, "sine", 250), v.effects.some((b) => b.id > l && b.kind === "ward-break") && (g(0.25, 0.1, 3600, 650), f(720, 0.3, 0.05, "sine", 120)), v.status === "won" && [
        392,
        494,
        587,
        784
      ].forEach((b, x) => f(b, 0.65, 0.04, "sine", b, x * 0.075)), v.status === "lost" && f(147, 0.7, 0.06, "triangle", 73), o = v.player.hp, c = v.kills, d = v.player.skill, l = v.serial, h = v.player.combo);
    },
    dispose() {
      r = !0, n = !1, t && (t.close().catch(e), t = null), s = null, a = null;
    }
  };
}
var y = {
  grass: "#a5afc1",
  grassLight: "#c2c9d8",
  grassDark: "#909bb1",
  soil: "#67717e",
  stone: "#c4c7d9",
  light: "#edf0fa",
  mortar: "#8290a9",
  slate: "#465271",
  roof: "#3d4666",
  roofLight: "#667396",
  timber: "#42465c",
  wood: "#9d8171",
  shadow: "#2a354f",
  brass: "#bf926f",
  cloth: "#d9c9be",
  leaf: "#556e83",
  leafLight: "#8fabc0",
  amber: "#ad927c",
  amberLight: "#d9b993",
  rose: "#bfa3bd",
  water: "#627fba",
  ripple: "#c7d9f1",
  ember: "#ffcb92",
  pottery: "#ad7d74",
  undercroft: "#485977",
  wetStone: "#98abc9",
  marble: "#cbd5ea",
  marbleLight: "#e4eafa",
  root: "#64627a",
  rootLight: "#9290a1",
  sky: "#cbd5f0",
  haze: "#e3e6f6",
  window: "#c4d1e5",
  distantGround: "#8596b2",
  distantLeaf: "#a2b0c8",
  distantWall: "#bac5df",
  distantRoof: "#818cac",
  street: "#a2acc3",
  streetStone: "#bdc5d7",
  streetSeam: "#98a3ba"
}, at = {
  height: 23,
  distance: 25,
  lead: 5,
  minimumWidth: 42,
  mobileWidth: 26,
  tallSpan: 28,
  shortSpan: 19,
  settlementScale: 0.88
}, je = {
  ward: "#75c7eb",
  edge: "#e5f6ff",
  block: "#dcc08a",
  parry: "#fff2c9",
  enamel: "#42647c",
  silver: "#e4e7df"
}, Ke = {
  familiar: "#8cc9bc",
  empowered: "#f1d89e",
  crest: "#9daedc",
  page: "#f2ecda",
  cover: "#4d5876"
}, za = [
  {
    sky: y.sky,
    haze: y.haze,
    stone: y.stone,
    light: y.light,
    floor: y.grass,
    tile: y.grassLight,
    seam: y.mortar,
    dark: y.shadow,
    trim: y.brass,
    accent: y.ember,
    foliage: y.leaf,
    flower: y.rose,
    water: y.water
  },
  {
    sky: "#bfcfe9",
    haze: "#dde5f5",
    stone: "#dce3ed",
    light: "#f4f1ff",
    floor: "#abb6cb",
    tile: "#b2bcd0",
    seam: "#93a1bb",
    dark: "#364869",
    trim: "#c4bcdf",
    accent: "#9cbeff",
    foliage: "#626ca0",
    flower: "#e0b2dd",
    water: "#88a0bc"
  },
  {
    sky: "#f3d8b0",
    haze: "#fbebd2",
    stone: "#f0ddba",
    light: "#fff4da",
    floor: "#c9bda5",
    tile: "#cfc3ac",
    seam: "#b6a88f",
    dark: "#5a565d",
    trim: "#c99249",
    accent: "#ffd481",
    foliage: "#b87056",
    flower: "#ffe2a3",
    water: "#a6b8b0"
  },
  {
    sky: "#e0c6bb",
    haze: "#f0dccc",
    stone: "#bfada1",
    light: "#eee3ce",
    floor: "#a9a1a0",
    tile: "#b4aaa5",
    seam: "#88878c",
    dark: "#3e4a55",
    trim: "#c18c59",
    accent: "#ffb06d",
    foliage: "#8a634b",
    flower: "#ffd6a5",
    water: "#c77446"
  },
  {
    sky: "#c1e4f1",
    haze: "#e0f4f8",
    stone: "#d7e9ed",
    light: "#f6ffff",
    floor: "#a7c5d2",
    tile: "#b0cfd9",
    seam: "#8dabbc",
    dark: "#365773",
    trim: "#afcdd9",
    accent: "#9ce4f0",
    foliage: "#6395ad",
    flower: "#edf5ff",
    water: "#599aba"
  },
  {
    sky: "#c9c1e6",
    haze: "#e5dff5",
    stone: "#ddd6ec",
    light: "#f8f3ff",
    floor: "#b8b0ce",
    tile: "#c4bcd9",
    seam: "#9f95b5",
    dark: "#44395e",
    trim: "#d5ba8e",
    accent: "#c6aff9",
    foliage: "#766a9f",
    flower: "#eadba9",
    water: "#9482bb"
  }
], go = {
  storm: "#428dad",
  fire: "#b96839",
  frost: "#558eaf",
  guard: "#4e8776",
  life: "#ad5261",
  skill: "#8170ac",
  risk: "#a54853",
  blade: "#a98243",
  bow: "#498362",
  staff: "#8170ac",
  daggers: "#a95176",
  grimoire: "#578476",
  cannon: "#987347"
}, W1 = Object.fromEntries(Object.entries(sa).map(([e, t]) => [e, go[t.family]]));
function yo(e, t, s) {
  const a = /* @__PURE__ */ new Set();
  let n = {
    x: 0,
    y: 0
  }, r = !1, i = !1;
  const u = [
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Space",
    "KeyE",
    "Escape"
  ];
  function o(h) {
    if (!(!u.includes(h.code) || h.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(h.target.tagName)) && !(h.code === "Space" && h.target instanceof HTMLElement && h.target.closest("button"))) {
      if (h.preventDefault(), h.stopPropagation(), s(), h.code === "Escape") {
        h.repeat || t();
        return;
      }
      a.add(h.code), !h.repeat && h.code === "Space" && (r = !0), !h.repeat && h.code === "KeyE" && (i = !0);
    }
  }
  function c(h) {
    a.delete(h.code);
  }
  function d() {
    a.clear(), n = {
      x: 0,
      y: 0
    }, r = !1, i = !1;
  }
  function l() {
    d(), t();
  }
  return e.addEventListener("keydown", o), window.addEventListener("keyup", c), window.addEventListener("blur", l), {
    frame() {
      const h = n.x || Number(a.has("KeyD") || a.has("ArrowRight")) - Number(a.has("KeyA") || a.has("ArrowLeft")), f = n.y || Number(a.has("KeyS") || a.has("ArrowDown")) - Number(a.has("KeyW") || a.has("ArrowUp")), g = {
        move: Math.hypot(h, f) < 0.15 ? 0 : (Math.round((Math.atan2(f, h) + Math.PI / 2) / (Math.PI / 4)) + 8 - 1) % 8 + 1,
        dash: r,
        skill: i
      };
      return r = !1, i = !1, g;
    },
    stick(h, f) {
      n = {
        x: h,
        y: f
      };
    },
    dash() {
      r = !0, s();
    },
    skill() {
      i = !0, s();
    },
    clear: d,
    dispose() {
      d(), e.removeEventListener("keydown", o), window.removeEventListener("keyup", c), window.removeEventListener("blur", l);
    }
  };
}
function bo(e, t) {
  let s = null;
  function a(r) {
    if (!s || r.pointerId !== s.id) return;
    const i = s.surface.getBoundingClientRect(), u = i.width * 0.36, o = (r.clientX - i.left - i.width / 2) / u, c = (r.clientY - i.top - i.height / 2) / u, d = Math.max(1, Math.hypot(o, c));
    e(o / d, c / d);
  }
  function n() {
    const r = s;
    s = null, e(0, 0), r?.surface.hasPointerCapture(r.id) && r.surface.releasePointerCapture(r.id);
  }
  return {
    down(r) {
      if (s || r.button !== 0) return;
      t();
      const i = r.currentTarget;
      i.setPointerCapture(r.pointerId), s = {
        id: r.pointerId,
        surface: i
      }, a(r);
    },
    move: a,
    release(r) {
      s?.id === r.pointerId && n();
    },
    clear: n
  };
}
function Ka(e) {
  const t = new _n();
  t.absarc(0, 0, 1.1, 0, Math.PI, !1), t.lineTo(-0.86, 0), t.absarc(0, 0, 0.86, Math.PI, 0, !0), t.closePath();
  const s = {
    box: new sr(1, 1, 1),
    sphere: new ar(1, 20, 14),
    rock: new kn(1, 0),
    crown: new kn(1, 1),
    cylinder: new tr(1, 1, 1, 24),
    cone: new rr(1, 1, 12),
    disc: new nr(1, 48),
    ring: new ja(0.965, 1, 64),
    arc: new ja(0.87, 1, 40, 1, -0.2, Math.PI * 1.3),
    torus: new Mn(1, 0.08, 8, 40),
    stroke: new ja(0.975, 1, 48, 1, -0.2, Math.PI * 1.3),
    crescent: new Mn(1, 0.14, 6, 24, Math.PI * 1.45),
    arch: new Sn(t, {
      depth: 1,
      bevelEnabled: !1,
      curveSegments: 24
    }).translate(0, 0, -0.5)
  }, a = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Set();
  function i(h, f = !1, g = 1, v = !1) {
    const b = `${h}/${f}/${g}/${v}`;
    let x = n.get(b);
    return x || (x = f ? new Js({
      color: h,
      transparent: g < 1,
      opacity: g,
      depthWrite: g === 1,
      side: 2
    }) : new es({
      color: h,
      map: e?.get(h) ?? null,
      roughness: v ? 0.34 : 0.88,
      metalness: v ? 0.45 : 0.02,
      side: 2
    }), n.set(b, x)), x;
  }
  function u(h, f, g, v, b = [
    0,
    0,
    0
  ], x = !1, _ = 1, p = !1) {
    let w = s[f];
    if (!x && f === "box" && e?.has(g)) {
      w = w.clone(), r.add(w);
      const S = w.getAttribute("position"), I = w.getAttribute("normal"), A = w.getAttribute("uv");
      for (let L = 0; L < A.count; L++) {
        const $ = Math.abs(I.getX(L)) > 0.5 ? S.getZ(L) * v[2] : S.getX(L) * v[0], O = Math.abs(I.getY(L)) > 0.5 ? S.getZ(L) * v[2] : S.getY(L) * v[1];
        A.setXY(L, $ / 8, O / 8);
      }
    }
    const M = new dt(w, i(g, x, _, p));
    return M.scale.set(...v), M.position.set(...b), M.castShadow = !x, M.receiveShadow = !x, h.add(M), M;
  }
  function o(h, f = [
    0,
    0,
    0
  ]) {
    const g = new Jt();
    return g.position.set(...f), h.add(g), g;
  }
  function c(h, f, g, v, b, x = 1, _ = !1, p = 0.04) {
    const w = u(h, _ ? "disc" : "ring", f, [
      g,
      g,
      1
    ], [
      v,
      p,
      b
    ], !0, x);
    return w.rotation.x = -Math.PI / 2, w;
  }
  function d(h, f, g, v = [
    0,
    0,
    0
  ], b = 0) {
    const x = e?.has(g) ?? !1, _ = JSON.stringify([
      f,
      b,
      x
    ]);
    let p = a.get(_);
    if (!p) {
      const M = new _n();
      if (f.forEach(([S, I], A) => A ? M.lineTo(S, I) : M.moveTo(S, I)), M.closePath(), p = b ? new Sn(M, {
        depth: b,
        steps: 1,
        bevelEnabled: !0,
        bevelThickness: b * 0.3,
        bevelSize: b * 0.3,
        bevelSegments: 2
      }) : new Xs(M), x) {
        const S = p.getAttribute("uv");
        for (let I = 0; I < S.count; I++) S.setXY(I, S.getX(I) / 8, S.getY(I) / 8);
      }
      a.set(_, p);
    }
    const w = new dt(p, i(g));
    return w.position.set(...v), w.castShadow = !0, w.receiveShadow = !0, h.add(w), w;
  }
  function l(h) {
    h.updateMatrixWorld(!0);
    const f = h.matrixWorld.clone().invert(), g = new Jn(), v = /* @__PURE__ */ new Map();
    h.traverse((x) => {
      if (!(x instanceof dt) || Array.isArray(x.material)) return;
      const _ = (x.geometry.index ? x.geometry.toNonIndexed() : x.geometry.clone()).applyMatrix4(g.multiplyMatrices(f, x.matrixWorld)), p = `${x.material.uuid}/${x.castShadow}/${x.receiveShadow}`;
      let w = v.get(p);
      w || (w = {
        material: x.material,
        castShadow: x.castShadow,
        receiveShadow: x.receiveShadow,
        geometries: []
      }, v.set(p, w)), w.geometries.push(_);
    }), h.clear();
    const b = [];
    for (const { material: x, castShadow: _, receiveShadow: p, geometries: w } of v.values()) {
      const M = ss(w);
      if (w.forEach((I) => I.dispose()), !M) throw new Error("expedition_geometry_merge");
      const S = new dt(M, x);
      S.castShadow = _, S.receiveShadow = p, h.add(S), b.push(M);
    }
    return () => {
      h.clear(), b.forEach((x) => x.dispose());
    };
  }
  return {
    mesh: u,
    group: o,
    ring: c,
    shape: d,
    material: i,
    bake: l,
    geometries: s,
    dispose() {
      Object.values(s).forEach((h) => h.dispose()), a.forEach((h) => h.dispose()), r.forEach((h) => h.dispose()), n.forEach((h) => h.dispose());
    }
  };
}
function wo(e, t, s, a) {
  const n = za[s], r = Q.arena, { mesh: i, group: u, ring: o } = e, c = (g, v, b, x = n.stone) => i(g, "box", x, v, b);
  function d(g, v, b, x = !0) {
    const _ = u(t, [
      g,
      0,
      v
    ]);
    c(_, [
      1.65,
      0.38,
      1.65
    ], [
      0,
      0.15,
      0
    ]), c(_, [
      1.3,
      0.3,
      1.3
    ], [
      0,
      0.49,
      0
    ], n.light), c(_, [
      0.91,
      b,
      0.91
    ], [
      0,
      b / 2 + 0.6,
      0
    ]);
    for (const p of [-0.38, 0.38]) c(_, [
      0.08,
      b - 0.35,
      0.12
    ], [
      p,
      b / 2 + 0.6,
      0.48
    ], n.light);
    return c(_, [
      1.3,
      0.24,
      1.3
    ], [
      0,
      b + 0.6,
      0
    ], n.light), c(_, [
      1.56,
      0.3,
      1.56
    ], [
      0,
      b + 0.85,
      0
    ], n.dark), x && (i(_, "cone", n.trim, [
      0.2,
      0.65,
      0.2
    ], [
      0,
      b + 1.24,
      0
    ]), c(_, [
      0.16,
      0.6,
      0.08
    ], [
      0,
      b - 0.15,
      0.52
    ], n.trim)), _;
  }
  function l(g, v, b, x) {
    d(g - b / 2, v, x - 2), d(g + b / 2, v, x - 2);
    const _ = u(t, [
      g,
      x - 2,
      v
    ]);
    i(_, "arch", n.light, [
      b / 2,
      2.3,
      1.15
    ]);
    for (let p = 1; p < 10; p++) {
      const w = p / 10 * Math.PI, M = c(_, [
        0.025,
        0.64,
        0.025
      ], [
        Math.cos(w) * b * 0.49,
        Math.sin(w) * 2.25,
        0.59
      ], n.trim);
      M.rotation.z = w - Math.PI / 2;
    }
    c(_, [
      0.6,
      0.9,
      1.3
    ], [
      0,
      2.28,
      0
    ], n.trim);
  }
  function h(g, v, b = 1) {
    const x = u(t, [
      g,
      0,
      v
    ]);
    x.scale.setScalar(b);
    for (let _ = 0; _ < 5; _++) {
      const p = _ * 2.4, w = i(x, "rock", _ % 2 ? n.foliage : n.accent, [
        0.55,
        0.8 + _ % 2 * 0.3,
        0.45
      ], [
        Math.cos(p) * 0.4,
        0.5,
        Math.sin(p) * 0.4
      ]);
      w.rotation.z = Math.sin(p) * 0.4;
    }
    for (let _ = 0; _ < 3; _++) i(x, "rock", n.flower, [
      0.13,
      0.16,
      0.13
    ], [
      Math.sin(_ * 4) * 0.5,
      1,
      Math.cos(_ * 4) * 0.4
    ]);
  }
  function f(g, v, b) {
    const x = u(t, [
      g,
      0,
      v
    ]);
    x.scale.setScalar(b);
    const _ = i(x, "cylinder", n.dark, [
      0.15,
      3.5,
      0.19
    ], [
      0,
      1.65,
      0
    ]);
    _.rotation.z = -0.1;
    for (let p = 0; p < 6; p++) {
      const w = p * 2.4;
      i(x, "rock", p % 2 ? n.foliage : n.accent, [
        1.65,
        0.88,
        1.4
      ], [
        Math.cos(w) * 0.95,
        3 + Math.sin(w) * 0.5,
        Math.sin(w) * 0.85
      ]);
    }
  }
  c(t, [
    180,
    0.3,
    180
  ], [
    0,
    -4.1,
    0
  ], n.water);
  for (let g = 0; g < 16; g++) c(t, [
    3 + g % 4 * 2,
    0.015,
    0.055
  ], [
    Math.sin(g * 7) * 32,
    -3.92,
    Math.cos(g * 3) * 25
  ], n.haze);
  c(t, [
    r * 2 + 2.4,
    2.4,
    r * 2 + 2.4
  ], [
    0,
    -1.5,
    0
  ], n.dark), c(t, [
    r * 2 + 1.1,
    0.42,
    r * 2 + 1.1
  ], [
    0,
    -0.42,
    0
  ], n.trim), c(t, [
    r * 2 + 0.5,
    0.35,
    r * 2 + 0.5
  ], [
    0,
    -0.14,
    0
  ], n.floor);
  for (let g = -10; g <= 10; g += 2) for (let v = -10; v <= 10; v += 2) c(t, [
    1.96,
    0.045,
    1.96
  ], [
    g,
    0.025,
    v
  ], (g * 3 + v + 40) % 8 === 0 ? n.tile : n.floor);
  if (a) {
    o(t, n.trim, 5.35, 0, 0, 1, !1, 0.058), o(t, n.light, 5.18, 0, 0, 0.6, !1, 0.059), o(t, n.seam, 4.72, 0, 0, 0.65, !1, 0.061);
    for (let g = 0; g < 8; g++) {
      const v = g * Math.PI / 4, b = c(t, [
        0.18,
        0.025,
        0.55
      ], [
        Math.cos(v) * 5.04,
        0.065,
        Math.sin(v) * 5.04
      ], n.trim);
      b.rotation.y = -v + Math.PI / 2;
    }
    if (s === 1) i(t, "crescent", n.seam, [
      3,
      3,
      0.12
    ], [
      0,
      0.065,
      0
    ]).rotation.set(-Math.PI / 2, 0, 0.7);
    else {
      const g = [];
      for (let b = 0; b < (s === 2 ? 24 : 16); b++) {
        const x = b * Math.PI * 2 / (s === 2 ? 24 : 16), _ = b % 2 ? 0.85 : s === 2 ? 2.6 : b % 4 ? 1.8 : 3.2;
        g.push([Math.cos(x) * _, Math.sin(x) * _]);
      }
      const v = e.shape(t, g, n.seam, [
        0,
        0.061,
        0
      ]);
      v.rotation.x = -Math.PI / 2, o(t, n.floor, 0.65, 0, 0, 1, !0, 0.065);
    }
  }
  for (const g of [-1, 1]) for (let v = 0; v < 4; v++) {
    const b = g * (7 + v % 2), x = -7 + v * 4, _ = c(t, [
      0.035,
      0.016,
      0.55 + v * 0.1
    ], [
      b,
      0.055,
      x
    ], n.seam);
    _.rotation.y = v * 1.3;
    const p = c(t, [
      0.028,
      0.015,
      0.3
    ], [
      b + 0.1,
      0.055,
      x + 0.3
    ], n.seam);
    p.rotation.y = v * 1.3 + 0.8;
  }
  for (const g of [-r - 0.35, r + 0.35]) {
    c(t, [
      0.38,
      0.18,
      r * 2 + 1
    ], [
      g,
      0.08,
      0
    ], n.light);
    for (let v = -10; v <= 10; v += 5) d(g + Math.sign(g) * 0.5, v, v === -10 ? 3.6 : 1.35);
  }
  for (let g = 0; g < 6; g++) c(t, [
    7.2,
    0.24,
    1
  ], [
    0,
    -0.12 - g * 0.26,
    r + 0.65 + g * 0.8
  ], g % 2 ? n.stone : n.light);
  l(0, -r - 3, 8, 6.3);
  for (const g of [-1, 1]) {
    c(t, [
      5,
      3.2,
      1.9
    ], [
      g * 8.4,
      1.45,
      -r - 3
    ], n.dark), c(t, [
      5.5,
      0.3,
      2.3
    ], [
      g * 8.4,
      3.2,
      -r - 3
    ], n.light);
    const v = u(t, [
      g * 5.8,
      4.8,
      -r - 2.9
    ]);
    c(v, [
      2,
      0.08,
      0.08
    ], [
      0,
      0,
      0
    ], n.trim);
    for (let b = 0; b < 5; b++) c(v, [
      0.35,
      2.6 - Math.abs(b - 2) * 0.12,
      0.08
    ], [
      (b - 2) * 0.34,
      -1.35,
      Math.sin(b * 2) * 0.08
    ], b % 2 ? n.foliage : n.dark);
    if (c(v, [
      0.12,
      1.8,
      0.09
    ], [
      0,
      -1.15,
      0.13
    ], n.trim), s < 3) {
      for (let b = 0; b < 4; b++) h(g * (12.8 + b % 2), -9 + b * 5, 0.8 + b * 0.1);
      f(g * 15, -13, 1.5), f(g * 17, 1, 1.7);
    } else if (s === 3) for (let b = 0; b < 3; b++) {
      const x = u(t, [
        g * 15,
        0,
        -9 + b * 7
      ]);
      i(x, "cylinder", n.dark, [
        1.4,
        2.8,
        1.4
      ], [
        0,
        1.4,
        0
      ]), i(x, "cylinder", n.trim, [
        0.7,
        4.5,
        0.7
      ], [
        0,
        4.9,
        0
      ]), c(x, [
        1.5,
        1,
        0.2
      ], [
        0,
        1,
        1.3
      ], n.accent), i(x, "torus", n.trim, [
        1.1,
        1.1,
        0.3
      ], [
        0,
        1.2,
        1.4
      ]);
    }
    else if (s === 4) {
      for (let x = 0; x < 5; x++) i(t, "rock", x % 2 ? n.light : n.accent, [
        1,
        2.2 + x % 3,
        0.9
      ], [
        g * (13.5 + x % 2),
        1.2,
        -9 + x * 4
      ]).rotation.z = g * -0.2;
      const b = u(t, [
        g * 17,
        0,
        -13
      ]);
      c(b, [
        0.22,
        8,
        0.22
      ], [
        0,
        3.5,
        0
      ], n.dark), e.shape(b, [
        [0, 0],
        [3, -1],
        [0, -4]
      ], n.light, [
        0,
        6.5,
        0
      ]);
    } else {
      for (let x = 0; x < 4; x++) {
        const _ = u(t, [
          g * 14,
          0,
          -10 + x * 6
        ]);
        c(_, [
          2.4,
          3.5,
          1
        ], [
          0,
          1.75,
          0
        ], n.dark);
        for (let p = 0; p < 3; p++) {
          c(_, [
            2.6,
            0.12,
            1.1
          ], [
            0,
            0.8 + p,
            0
          ], n.trim);
          for (let w = 0; w < 5; w++) c(_, [
            0.27,
            0.65 + w % 2 * 0.12,
            0.6
          ], [
            -0.85 + w * 0.4,
            1.2 + p,
            0.1
          ], w % 2 ? n.foliage : n.stone);
        }
      }
      const b = i(t, "torus", n.trim, [
        3.4,
        4,
        0.5
      ], [
        g * 18,
        6.2,
        -13
      ]);
      b.rotation.y = g * 0.3;
    }
    c(t, [
      7,
      1.4,
      18
    ], [
      g * 17,
      -0.7,
      -3
    ], n.dark), c(t, [
      6.7,
      0.1,
      17.7
    ], [
      g * 17,
      0.06,
      -3
    ], n.seam);
    for (const b of [-3.5, 3.5]) c(t, [
      0.22,
      0.25,
      18.2
    ], [
      g * 17 + b,
      0.13,
      -3
    ], n.stone);
    c(t, [
      9,
      1.8,
      10
    ], [
      g * 15,
      -0.9,
      -17
    ], n.dark), c(t, [
      8.7,
      0.1,
      9.7
    ], [
      g * 15,
      0.06,
      -17
    ], n.seam);
  }
  for (let g = 0; g < 7; g++) {
    const v = (g - 3) * 8, b = -26 - g % 3 * 6, x = 7 + g * 5 % 7;
    if (c(t, [
      5.2,
      x,
      5.5
    ], [
      v,
      x / 2 - 3,
      b
    ], n.stone), c(t, [
      5.8,
      0.4,
      6
    ], [
      v,
      x - 3,
      b
    ], n.light), s === 1) {
      const _ = i(t, "crescent", n.trim, [
        1.5,
        1.5,
        1.5
      ], [
        v,
        x - 0.8,
        b
      ]);
      _.rotation.z = 0.9;
    } else if (s === 2) i(t, "cone", n.trim, [
      3.4,
      4.8,
      3.4
    ], [
      v,
      x - 0.8,
      b
    ]);
    else if (s === 3) {
      for (const _ of [-1.3, 1.3]) i(t, "cylinder", n.dark, [
        0.7,
        5 + g % 2 * 2,
        0.7
      ], [
        v + _,
        x - 1,
        b
      ]);
      c(t, [
        3.8,
        0.25,
        4
      ], [
        v,
        x - 2.5,
        b
      ], n.trim);
    } else if (s === 4) {
      i(t, "cone", n.light, [
        3.2,
        4.5,
        3.2
      ], [
        v,
        x - 0.8,
        b
      ]);
      for (const _ of [-1, 1]) i(t, "rock", n.accent, [
        0.4,
        2,
        0.4
      ], [
        v + _,
        x - 3,
        b + 3
      ]);
    } else if (s === 5)
      i(t, "rock", n.trim, [
        1.4,
        2.3,
        1.4
      ], [
        v,
        x + 0.7,
        b
      ]), i(t, "torus", n.accent, [
        2,
        2,
        2
      ], [
        v,
        x - 1,
        b
      ]).rotation.x = Math.PI / 2;
    else {
      for (const _ of [
        -2,
        0,
        2
      ]) c(t, [
        0.7,
        1.2,
        5.6
      ], [
        v + _,
        x - 2.35,
        b
      ], n.light);
      g % 2 && f(v + 1, b + 2, 1.5);
    }
    for (const _ of [
      -1.5,
      0,
      1.5
    ]) c(t, [
      0.5,
      2.8,
      0.12
    ], [
      v + _,
      x - 5.6,
      b + 2.8
    ], n.dark);
  }
  for (const g of a?.obstacles ?? []) {
    const v = u(t, [
      g.x,
      0,
      g.y
    ]);
    i(v, "cylinder", n.dark, [
      g.radius,
      0.22,
      g.radius
    ], [
      0,
      0.11,
      0
    ]), i(v, "cylinder", n.stone, [
      g.radius * 0.85,
      1.15,
      g.radius * 0.85
    ], [
      0,
      0.78,
      0
    ]), i(v, "cylinder", n.light, [
      g.radius,
      0.2,
      g.radius
    ], [
      0,
      1.4,
      0
    ]), i(v, "rock", n.accent, [
      0.28,
      0.58,
      0.28
    ], [
      0,
      1.9,
      0
    ]);
    for (let b = 0; b < 6; b++) {
      const x = b * Math.PI / 3;
      c(v, [
        0.09,
        0.8,
        0.09
      ], [
        Math.cos(x) * g.radius * 0.86,
        0.8,
        Math.sin(x) * g.radius * 0.86
      ], n.trim);
    }
  }
  if (!a) {
    i(t, "cylinder", n.dark, [
      2.1,
      0.16,
      2.1
    ], [
      0,
      0.08,
      -8
    ]), i(t, "cylinder", n.light, [
      1.95,
      0.14,
      1.95
    ], [
      0,
      0.2,
      -8
    ]), o(t, n.trim, 1.68, 0, -8, 1, !1, 0.28);
    for (const g of [-1, 1]) {
      h(g * 3, -8, 1.2), h(g * 4, -10, 0.85);
      const v = u(t, [
        g * 2.6,
        0.5,
        -6
      ]);
      i(v, "box", n.dark, [
        0.5,
        0.16,
        0.5
      ]), i(v, "box", n.flower, [
        0.3,
        0.55,
        0.3
      ], [
        0,
        0.35,
        0
      ]), i(v, "cone", n.trim, [
        0.42,
        0.3,
        0.42
      ], [
        0,
        0.74,
        0
      ]);
    }
  }
  return e.bake(t);
}
function xo(e, t, s) {
  const a = e.group(t, [
    0,
    1.3,
    0
  ]);
  a.scale.setScalar(1.5);
  const n = e.group(a), r = e.group(a, [
    0,
    0.5,
    0
  ]), i = e.group(r), u = s === "female", o = u ? 0.225 : 0.255, c = nt.traveler.fabric, d = "#574a40", l = "#d7ab8b", h = "#463f3b";
  e.mesh(n, "sphere", c, [
    o,
    0.28,
    0.155
  ], [
    0,
    -0.04,
    0
  ]), e.mesh(n, "cylinder", c, [
    u ? 0.165 : 0.185,
    0.24,
    0.16
  ], [
    0,
    -0.25,
    0
  ]), e.mesh(n, "cylinder", d, [
    0.196,
    0.06,
    0.175
  ], [
    0,
    -0.24,
    0
  ]), e.mesh(n, "box", "#d5b77b", [
    0.07,
    0.067,
    0.025
  ], [
    0,
    -0.24,
    0.178
  ]), e.mesh(n, "cylinder", l, [
    0.066,
    0.16,
    0.07
  ], [
    0,
    0.265,
    0
  ]), e.mesh(r, "sphere", l, [
    u ? 0.161 : 0.172,
    0.22,
    0.165
  ]), e.mesh(i, "sphere", h, [
    0.18,
    0.125,
    0.173
  ], [
    0,
    0.135,
    -0.022
  ]);
  for (const _ of [-1, 1])
    e.mesh(r, "sphere", l, [
      0.027,
      0.042,
      0.027
    ], [
      _ * 0.166,
      -0.01,
      0
    ]), e.mesh(r, "sphere", "#303b3b", [
      0.019,
      0.023,
      0.012
    ], [
      _ * 0.061,
      0.016,
      0.155
    ]), e.mesh(r, "box", h, [
      0.047,
      0.012,
      0.014
    ], [
      _ * 0.064,
      0.062,
      0.154
    ]), e.mesh(i, "sphere", h, [
      0.035,
      0.12,
      0.08
    ], [
      _ * 0.157,
      0.035,
      -0.036
    ]);
  if (e.mesh(r, "sphere", l, [
    0.027,
    0.041,
    0.028
  ], [
    0,
    -0.025,
    0.16
  ]), e.mesh(r, "box", "#a86e60", [
    0.045,
    9e-3,
    0.012
  ], [
    0,
    -0.1,
    0.148
  ]), u) {
    const _ = e.group(i, [
      0,
      0.06,
      -0.17
    ]);
    for (let p = 0; p < 4; p++) e.mesh(_, "sphere", h, [
      0.064 - p * 9e-3,
      0.09,
      0.063 - p * 8e-3
    ], [
      p % 2 ? 0.014 : -0.014,
      -p * 0.115,
      0
    ]);
    e.mesh(_, "box", c, [
      0.066,
      0.032,
      0.066
    ], [
      0,
      -0.33,
      0
    ]);
  }
  const f = [], g = [];
  for (const _ of [-1, 1]) {
    const p = e.group(a, [
      _ * o,
      0.12,
      0
    ]);
    f.push(p), e.mesh(p, "cylinder", c, [
      0.076,
      0.27,
      0.078
    ], [
      0,
      -0.12,
      0
    ]), e.mesh(p, "cylinder", "#e5dfcd", [
      0.081,
      0.085,
      0.081
    ], [
      0,
      -0.27,
      0
    ]), e.mesh(p, "cylinder", l, [
      0.052,
      0.14,
      0.057
    ], [
      0,
      -0.36,
      8e-3
    ]), e.mesh(p, "sphere", l, [
      0.06,
      0.075,
      0.047
    ], [
      0,
      -0.45,
      0.015
    ]);
    const w = e.group(a, [
      _ * 0.105,
      -0.32,
      0
    ]);
    g.push(w), e.mesh(w, "cylinder", "#434e55", [
      0.078,
      0.35,
      0.085
    ], [
      0,
      -0.15,
      0
    ]), e.mesh(w, "cylinder", d, [
      0.085,
      0.23,
      0.091
    ], [
      0,
      -0.39,
      0
    ]), e.mesh(w, "sphere", d, [
      0.089,
      0.066,
      0.155
    ], [
      0,
      -0.485,
      0.056
    ]);
  }
  i.removeFromParent();
  const v = [
    n,
    r,
    i,
    ...f,
    ...g
  ].map((_) => e.bake(_));
  r.add(i);
  const b = [];
  a.traverse((_) => {
    _ instanceof dt && _.material === e.material(c) && b.push(_);
  });
  let x = null;
  return {
    body: a,
    hand: e.group(f[1], [
      0,
      -0.45,
      0.015
    ]),
    dress(_) {
      if (_ !== x) {
        x = _;
        for (const p of b) p.material = e.material(nt[_].fabric);
        i.visible = ![
          "helm",
          "hat",
          "hood"
        ].includes(nt[_].head);
      }
    },
    pose(_, p, w, M, S, I) {
      const A = !S && w ? Math.sin(p * 0.55) * 0.48 : 0;
      a.position.y = 1.3 + (!S && w ? Math.abs(Math.sin(p * 0.55)) * 0.025 : 0), a.rotation.set(!S && M ? 0.16 : 0, Math.PI / 2 - _, 0), g.forEach((L, $) => {
        L.rotation.x = ($ ? -1 : 1) * A;
      }), f.forEach((L, $) => {
        L.rotation.set($ && I ? -0.55 : ($ ? 1 : -1) * A * 0.65, 0, ($ ? -1 : 1) * 0.1);
      });
    },
    dispose() {
      v.forEach((_) => _()), a.removeFromParent();
    }
  };
}
function Mo(e, t, s) {
  const a = nt[s], { mesh: n, group: r, shape: i } = e, u = r(t, [
    0,
    0.2,
    -0.23
  ]), o = r(t, [
    0,
    0.328,
    0
  ]), c = r(t, [
    0,
    0.55,
    0
  ]);
  o.scale.set(0.64, 0.78, 0.72);
  const d = a.silhouette === "robe" || a.silhouette === "coat";
  if (i(u, [
    [-0.23, 0],
    [0.23, 0],
    [0.38, d ? -0.68 : -0.48],
    [0.1, d ? -0.77 : -0.59],
    [-0.36, d ? -0.68 : -0.5]
  ], a.fabric), i(u, [
    [-0.04, -0.08],
    [0.04, -0.08],
    [0.055, d ? -0.61 : -0.45],
    [0, d ? -0.68 : -0.5],
    [-0.05, d ? -0.61 : -0.45]
  ], a.metal, [
    0,
    0,
    -0.012
  ]), n(t, "torus", a.fabric, [
    0.2,
    0.15,
    0.19
  ], [
    0,
    0.19,
    0
  ]).rotation.x = Math.PI / 2, a.silhouette === "armor") {
    n(t, "sphere", a.metal, [
      0.295,
      0.18,
      0.27
    ], [
      0,
      -0.15,
      0
    ], !1, 1, !0), n(t, "rock", a.glow, [
      0.065,
      0.09,
      0.025
    ], [
      0,
      -0.07,
      0.285
    ]);
    for (const l of [-1, 1]) n(t, "rock", a.metal, [
      0.15,
      0.12,
      0.17
    ], [
      l * 0.3,
      -0.02,
      0
    ], !1, 1, !0);
  } else d && (n(t, "cone", a.fabric, [
    0.34,
    0.46,
    0.27
  ], [
    0,
    -0.2,
    -0.025
  ]), i(t, [
    [-0.07, 0],
    [0.07, 0],
    [0.14, -0.42],
    [-0.14, -0.42]
  ], a.metal, [
    0,
    -0.02,
    0.245
  ]), n(t, "rock", a.glow, [
    0.055,
    0.065,
    0.035
  ], [
    0,
    -0.12,
    0.285
  ]));
  if (a.head === "helm") {
    n(o, "sphere", a.metal, [
      0.31,
      0.13,
      0.265
    ], [
      0,
      0.44,
      -0.015
    ], !1, 1, !0);
    for (const l of [-1, 1]) n(o, "box", a.metal, [
      0.065,
      0.22,
      0.17
    ], [
      l * 0.285,
      0.29,
      -0.02
    ], !1, 1, !0);
  } else if (a.head === "hat")
    n(o, "cylinder", a.fabric, [
      0.43,
      0.045,
      0.32
    ], [
      0,
      0.46,
      0
    ]), n(o, "cone", a.fabric, [
      0.23,
      0.48,
      0.23
    ], [
      0.055,
      0.7,
      -0.02
    ]).rotation.z = -0.18, n(o, "torus", a.metal, [
      0.245,
      0.245,
      0.24
    ], [
      0,
      0.52,
      -0.01
    ]).rotation.x = Math.PI / 2;
  else if (a.head === "hood") {
    n(o, "sphere", a.fabric, [
      0.345,
      0.35,
      0.265
    ], [
      0,
      0.22,
      -0.12
    ]);
    for (const l of [-1, 1]) n(o, "sphere", a.fabric, [
      0.075,
      0.19,
      0.08
    ], [
      l * 0.285,
      0.19,
      0.055
    ]);
  } else if (a.head === "crown") {
    n(o, "torus", a.metal, [
      0.28,
      0.28,
      0.28
    ], [
      0,
      0.48,
      0
    ], !1, 1, !0).rotation.x = Math.PI / 2;
    for (let l = 0; l < 5; l++) {
      const h = l * Math.PI * 2 / 5;
      n(o, "cone", a.metal, [
        0.045,
        0.2,
        0.045
      ], [
        Math.sin(h) * 0.27,
        0.57,
        Math.cos(h) * 0.27
      ]);
    }
  } else if (a.head === "horns") for (const l of [-1, 1]) {
    const h = r(o, [
      l * 0.26,
      0.5,
      -0.06
    ]);
    h.rotation.z = l * -0.45, n(h, "cylinder", a.metal, [
      0.035,
      0.44,
      0.03
    ], [
      0,
      0.18,
      0
    ]);
    for (const f of [0.16, 0.3]) n(h, "cone", a.metal, [
      0.025,
      0.22,
      0.025
    ], [
      l * 0.06,
      f,
      0
    ]).rotation.z = l * -0.8;
  }
  else if (a.head === "goggles") {
    n(o, "torus", "#4c4a42", [
      0.32,
      0.22,
      0.27
    ], [
      0,
      0.4,
      0
    ]).rotation.x = Math.PI / 2;
    for (const l of [-1, 1])
      n(o, "torus", a.metal, [
        0.095,
        0.075,
        0.05
      ], [
        l * 0.115,
        0.39,
        0.24
      ]), n(o, "sphere", a.glow, [
        0.08,
        0.06,
        0.045
      ], [
        l * 0.115,
        0.39,
        0.24
      ]);
  }
  switch (s) {
    case "guardian":
      n(o, "cone", a.fabric, [
        0.08,
        0.28,
        0.1
      ], [
        0,
        0.67,
        -0.06
      ]);
      break;
    case "moonweaver":
      n(o, "crescent", a.metal, [
        0.15,
        0.15,
        0.05
      ], [
        0,
        0.67,
        0.19
      ]).rotation.z = 0.8;
      break;
    case "sovereign":
      for (const l of [-1, 1]) n(t, "cone", a.metal, [
        0.1,
        0.2,
        0.12
      ], [
        l * 0.35,
        0.12,
        -0.03
      ]).rotation.z = l * -0.5;
      break;
    case "ranger":
      n(t, "cylinder", "#79543d", [
        0.095,
        0.46,
        0.085
      ], [
        -0.25,
        0.1,
        -0.31
      ]).rotation.z = -0.35;
      for (let l = 0; l < 3; l++) n(t, "cylinder", a.metal, [
        0.012,
        0.32,
        0.012
      ], [
        -0.21 + l * 0.04,
        0.4,
        -0.29
      ]);
      n(o, "cone", a.glow, [
        0.06,
        0.25,
        0.04
      ], [
        -0.31,
        0.48,
        -0.05
      ]).rotation.z = -0.6;
      break;
    case "paladin":
      for (const l of [-1, 1]) i(t, [
        [0, 0],
        [l * 0.22, 0.24],
        [l * 0.18, -0.05],
        [l * 0.05, -0.12]
      ], a.metal, [
        l * 0.32,
        0.02,
        -0.06
      ]);
      break;
    case "witch":
      for (const l of [-1, 1])
        n(t, "sphere", a.glow, [
          0.05,
          0.065,
          0.04
        ], [
          l * 0.27,
          -0.16,
          0.17
        ]), n(t, "box", a.metal, [
          0.07,
          0.025,
          0.07
        ], [
          l * 0.27,
          -0.09,
          0.17
        ]);
      break;
    case "assassin":
      n(t, "sphere", a.metal, [
        0.21,
        0.045,
        0.055
      ], [
        0,
        0.045,
        0.25
      ]), i(t, [
        [0, 0],
        [0.1, -0.07],
        [0.08, -0.29],
        [0, -0.19]
      ], a.metal, [
        -0.1,
        -0.02,
        0.27
      ]);
      break;
    case "machinist":
      n(t, "box", a.metal, [
        0.38,
        0.4,
        0.18
      ], [
        0,
        0.06,
        -0.35
      ], !1, 1, !0);
      for (const l of [-1, 1]) n(t, "cylinder", "#c99767", [
        0.06,
        0.32,
        0.06
      ], [
        l * 0.14,
        0.21,
        -0.38
      ]);
      n(t, "rock", a.glow, [
        0.09,
        0.14,
        0.05
      ], [
        0,
        0.06,
        -0.46
      ]);
      break;
    case "beastcaller":
      for (let l = -2; l <= 2; l++) n(t, "rock", l % 2 ? a.fabric : a.metal, [
        0.07,
        0.17,
        0.045
      ], [
        l * 0.11,
        -0.07,
        0.21
      ]).rotation.z = l * 0.27;
      break;
    case "frostbound":
      for (let l = -2; l <= 2; l++) n(t, "sphere", "#f6ffff", [
        0.08,
        0.075,
        0.09
      ], [
        l * 0.115,
        5e-3,
        0.13
      ]);
      for (const l of [-1, 1]) n(t, "rock", a.glow, [
        0.09,
        0.36,
        0.09
      ], [
        l * 0.3,
        0.22,
        -0.35
      ]).rotation.z = l * -0.5;
      break;
    case "stargazer":
      n(c, "torus", a.metal, [
        0.43,
        0.43,
        0.43
      ], [
        0,
        0.16,
        0
      ], !1, 1, !0).rotation.x = 0.6;
      for (let l = 0; l < 3; l++) {
        const h = l * Math.PI * 2 / 3;
        n(c, "rock", a.glow, [
          0.04,
          0.075,
          0.04
        ], [
          Math.cos(h) * 0.47,
          0.16,
          Math.sin(h) * 0.47
        ]);
      }
      break;
    case "traveler":
      break;
  }
  return {
    cape: u,
    animate(l, h) {
      c.rotation.y = h ? 0.4 : l * 0.014;
    }
  };
}
function ko(e, t, s, a, n, r) {
  const { mesh: i, group: u, shape: o } = e, c = "#d6b881", d = "#fff0c1", l = (h, f, g) => {
    for (const v of [-1, 1]) i(s, "sphere", d, [
      0.09,
      0.055,
      0.06
    ], [
      v * g,
      h,
      f
    ], !0);
  };
  switch (n) {
    case "thornheart":
      i(t, "cone", "#576e58", [
        1.6,
        2.9,
        1.3
      ], [
        0,
        1.45,
        0
      ]), i(s, "rock", "#8da17f", [
        0.8,
        1,
        0.65
      ], [
        0,
        2.3,
        0.5
      ]), l(2.6, 1.06, 0.28);
      for (let h = 0; h < 7; h++) {
        const f = h * Math.PI * 2 / 7, g = u(t, [
          Math.cos(f) * 0.8,
          2.6,
          Math.sin(f) * 0.6
        ]);
        g.rotation.z = Math.cos(f) * 0.8, i(g, "cone", "#526451", [
          0.18,
          2.4,
          0.18
        ], [
          0,
          0.9,
          0
        ]), i(g, "rock", r.foliage, [
          0.6,
          0.6,
          0.4
        ], [
          0,
          1.3,
          0
        ]), i(t, "cone", "#67765a", [
          0.3,
          2,
          0.3
        ], [
          Math.cos(f),
          0.28,
          Math.sin(f)
        ]).rotation.z = 1.15;
      }
      i(t, "rock", "#ebbb73", [
        0.35,
        0.55,
        0.2
      ], [
        0,
        1.6,
        1.1
      ]);
      break;
    case "astrologer":
      i(t, "cone", "#777191", [
        0.85,
        2.2,
        0.75
      ], [
        0,
        1.8,
        0
      ]), i(s, "sphere", "#c3c1db", [
        0.5,
        0.6,
        0.42
      ], [
        0,
        3.1,
        0
      ]), i(s, "box", "#4c4469", [
        0.94,
        0.18,
        0.16
      ], [
        0,
        3.2,
        0.38
      ]);
      for (const h of [
        1.35,
        1.8,
        2.25
      ]) i(a, "torus", c, [
        h,
        h,
        h
      ], [
        0,
        2.2,
        0
      ], !1, 1, !0).rotation.set(h * 0.7, 0.5, h);
      i(a, "sphere", "#d6dbff", [
        0.23,
        0.23,
        0.23
      ], [
        1.8,
        2.3,
        0.3
      ], !0);
      break;
    case "phoenix":
      i(t, "rock", "#ac6249", [
        0.65,
        1.3,
        0.7
      ], [
        0,
        1.8,
        0
      ]), i(s, "sphere", "#e4ac68", [
        0.4,
        0.5,
        0.43
      ], [
        0,
        3.15,
        0.25
      ]), l(3.25, 0.63, 0.18), i(s, "cone", c, [
        0.18,
        0.55,
        0.15
      ], [
        0,
        3.03,
        0.76
      ]).rotation.x = Math.PI / 2;
      for (const h of [-1, 1]) {
        for (let f = 0; f < 5; f++) o(a, [
          [0, 0],
          [h * (2.4 - f * 0.25), 0.95 - f * 0.22],
          [h * (2 - f * 0.24), -0.1 - f * 0.24],
          [0, -0.45]
        ], f % 2 ? "#e2a465" : "#d47c4f", [
          h * 0.4,
          2.5,
          -0.1 - f * 0.06
        ]);
        i(t, "cone", "#e3a25b", [
          0.18,
          1.5,
          0.25
        ], [
          h * 0.3,
          0.6,
          -0.6
        ]).rotation.x = -0.8;
      }
      break;
    case "forgemaster":
      i(t, "box", "#675756", [
        1.8,
        2.1,
        1.2
      ], [
        0,
        1.6,
        0
      ]), i(t, "box", "#9b6148", [
        1.2,
        1.6,
        0.17
      ], [
        0,
        1.55,
        0.7
      ]), i(s, "cylinder", "#b08563", [
        0.7,
        0.7,
        0.6
      ], [
        0,
        3.05,
        0
      ]), i(s, "box", "#ffd18c", [
        0.65,
        0.1,
        0.08
      ], [
        0,
        3.12,
        0.63
      ], !0);
      for (const h of [-1, 1])
        i(t, "cylinder", r.dark, [
          0.36,
          0.8,
          0.38
        ], [
          h * 0.55,
          0.5,
          0
        ]), i(t, "sphere", "#c9976e", [
          0.65,
          0.55,
          0.55
        ], [
          h * 1.05,
          2.5,
          0
        ], !1, 1, !0);
      a.position.set(1.4, 1.7, 0.4), i(a, "cylinder", "#765948", [
        0.1,
        2.3,
        0.1
      ]), i(a, "box", "#444e57", [
        1.8,
        0.8,
        0.9
      ], [
        0,
        1.3,
        0
      ]), i(a, "box", "#ffc482", [
        0.5,
        0.72,
        0.95
      ], [
        0,
        1.3,
        0
      ]);
      break;
    case "colossus":
      i(t, "sphere", "#565d63", [
        1.45,
        1.6,
        0.95
      ], [
        0,
        2.15,
        0
      ]), i(t, "torus", "#b68d66", [
        0.78,
        0.78,
        0.45
      ], [
        0,
        2.25,
        0.82
      ], !1, 1, !0), i(t, "sphere", "#ffb77b", [
        0.57,
        0.57,
        0.2
      ], [
        0,
        2.25,
        1
      ], !0), i(s, "box", "#818883", [
        1.3,
        0.5,
        1
      ], [
        0,
        3.7,
        0
      ]), l(3.73, 0.51, 0.3);
      for (const h of [-1, 1])
        i(t, "box", "#818883", [
          0.8,
          1.2,
          0.95
        ], [
          h * 0.8,
          0.6,
          0
        ]), i(a, "cylinder", "#6b7375", [
          0.65,
          2.1,
          0.65
        ], [
          h * 1.75,
          1.85,
          0
        ]), i(a, "box", "#b29370", [
          1.1,
          0.8,
          1.1
        ], [
          h * 1.75,
          0.8,
          0.15
        ]);
      break;
    case "frostqueen":
      i(t, "cone", "#82a9c1", [
        1.1,
        2.7,
        0.95
      ], [
        0,
        1.8,
        0
      ]), i(s, "sphere", "#d5e9ec", [
        0.45,
        0.58,
        0.4
      ], [
        0,
        3.35,
        0
      ]), l(3.4, 0.39, 0.18);
      for (let h = -2; h <= 2; h++) i(s, "rock", "#d8fbff", [
        0.11,
        0.48 - Math.abs(h) * 0.08,
        0.11
      ], [
        h * 0.18,
        3.94,
        0.02
      ]);
      for (const h of [-1, 1]) o(t, [
        [0, 0],
        [h * 0.95, 0.8],
        [h * 0.5, -1.3],
        [0, -0.5]
      ], "#bddeeb", [
        h * 0.5,
        2.7,
        -0.35
      ]);
      a.position.set(1.05, 1.9, 0), i(a, "cylinder", "#aec9d5", [
        0.045,
        2.5,
        0.045
      ]), i(a, "rock", "#ddfbff", [
        0.28,
        0.5,
        0.2
      ], [
        0,
        1.5,
        0
      ]);
      break;
    case "leviathan":
      for (let h = 0; h < 5; h++) {
        const f = 1 - h * 0.14;
        i(t, "sphere", h % 2 ? "#658c9c" : "#7da9b8", [
          f,
          f * 0.8,
          f
        ], [
          Math.sin(h * 0.6) * 0.4,
          0.8,
          0.5 - h * 0.8
        ]), i(t, "cone", "#d7e9dc", [
          0.2 * f,
          0.6 * f,
          0.25 * f
        ], [
          0,
          1.5 - h * 0.13,
          0.4 - h * 0.7
        ]);
      }
      i(s, "rock", "#7da9b8", [
        1.05,
        0.7,
        0.85
      ], [
        0,
        1.05,
        1
      ]), l(1.32, 1.65, 0.43);
      for (const h of [-1, 1])
        o(a, [
          [0, 0],
          [h * 1.4, 0.1],
          [h * 0.8, -0.7]
        ], "#b6d6d8", [
          h * 0.7,
          0.7,
          0
        ]), i(s, "cone", "#e4efde", [
          0.15,
          1,
          0.15
        ], [
          h * 0.72,
          1.65,
          1.2
        ]).rotation.z = h * -0.7;
      break;
    case "archivist":
      i(t, "cone", "#685881", [
        0.95,
        2.6,
        0.8
      ], [
        0,
        2,
        0
      ]), i(s, "rock", "#e7dcc4", [
        0.45,
        0.62,
        0.38
      ], [
        0,
        3.6,
        0
      ]), l(3.65, 0.38, 0.16);
      for (let h = 0; h < 5; h++) {
        const f = h * Math.PI * 2 / 5, g = u(a, [
          Math.cos(f) * 1.7,
          2.5 + Math.sin(f) * 0.6,
          Math.sin(f) * 1.3
        ]);
        g.rotation.z = f * 0.3, i(g, "box", "#baa481", [
          0.55,
          0.72,
          0.14
        ]), i(g, "box", "#f1e4c6", [
          0.48,
          0.65,
          0.15
        ], [
          0,
          0,
          0.03
        ]);
      }
      i(s, "torus", c, [
        0.75,
        0.75,
        0.75
      ], [
        0,
        4.25,
        0
      ]).rotation.x = Math.PI / 2;
      break;
    case "voidknight":
      i(t, "box", "#51486f", [
        0.95,
        1.5,
        0.65
      ], [
        0,
        1.75,
        0
      ]), i(s, "rock", "#b8afcc", [
        0.43,
        0.66,
        0.4
      ], [
        0,
        2.95,
        0
      ]), l(3, 0.4, 0.17);
      for (const h of [-1, 1]) {
        i(t, "box", "#867995", [
          0.33,
          0.9,
          0.4
        ], [
          h * 0.3,
          0.55,
          0
        ]), i(t, "rock", "#b8afcc", [
          0.5,
          0.28,
          0.38
        ], [
          h * 0.6,
          2.4,
          0
        ]);
        const f = u(a, [
          h * 0.85,
          1.8,
          0.2
        ]);
        f.rotation.z = h * -0.25, o(f, [
          [-0.07, 0],
          [0.15, 0],
          [0.3, 1.5],
          [0.12, 2.25],
          [-0.13, 1.7]
        ], "#dfc9ff");
      }
      o(t, [
        [-0.4, 0],
        [0.4, 0],
        [0.85, -2.1],
        [0, -1.4],
        [-0.65, -2.3]
      ], "#4a4266", [
        0,
        2.45,
        -0.4
      ]);
      break;
  }
}
function _o(e, t) {
  const s = e.group(t), a = e.group(s), n = [
    [0, 0.35],
    [0.16, 0.32],
    [0.26, 0.22],
    [0.25, -0.02],
    [0.19, -0.18],
    [0.09, -0.29],
    [0, -0.34],
    [-0.09, -0.29],
    [-0.19, -0.18],
    [-0.25, -0.02],
    [-0.26, 0.22],
    [-0.16, 0.32]
  ], r = e.shape(a, n, je.block, [
    0,
    0,
    0
  ], 0.055), i = e.shape(a, n, je.enamel, [
    0,
    0,
    0.057
  ], 0.025);
  i.scale.set(0.87, 0.87, 1), e.shape(a, n, je.enamel, [
    0,
    0,
    -0.018
  ]).scale.set(0.87, 0.87, 1);
  for (const c of [-0.025, 0.09])
    e.shape(a, [
      [0, 0.24],
      [0.08, 0.12],
      [0.045, -0.07],
      [0, -0.2],
      [-0.045, -0.07],
      [-0.08, 0.12]
    ], je.silver, [
      0,
      0,
      c
    ]), e.mesh(a, "rock", je.block, [
      0.035,
      0.06,
      0.015
    ], [
      0,
      0.075,
      c + Math.sign(c) * 0.014
    ], !1, 1, !0);
  let u = 0, o = -1;
  return s.visible = !1, { update(c, d, l, h, f) {
    const g = d ? 1 : 0, v = Math.max(0, Math.min(4, h - o));
    u = f || o < 0 || h < o ? g : u + (g - u) * (1 - Math.exp(-v * 0.85)), o = h, s.visible = c === "blade" || d || u > 0.04, s.position.set(-0.4 + u * 0.12, -0.1 + u * 0.3, 0.17 + u * 0.25), s.rotation.set(0.12 - u * 0.22, 0.15 - u * 0.3, -0.16 + u * 0.22), a.scale.setScalar(0.94 + u * 0.07), r.material = e.material(l ? je.parry : c === "blade" ? je.block : je.ward, !1, 1, !0), i.material = e.material(d ? "#617f99" : je.enamel);
  } };
}
function So(e, t) {
  const s = e.group(t), a = new Ys({
    transparent: !0,
    depthWrite: !1,
    uniforms: {
      tint: { value: new nn(je.ward) },
      impact: { value: 0 }
    },
    vertexShader: `varying vec3 surfaceNormal; varying vec3 viewDirection;
            void main() { vec4 p = modelViewMatrix * vec4(position, 1.0); surfaceNormal = normalMatrix * normal;
                viewDirection = -p.xyz; gl_Position = projectionMatrix * p; }`,
    fragmentShader: `uniform vec3 tint; uniform float impact; varying vec3 surfaceNormal; varying vec3 viewDirection;
            void main() { float rim = pow(1.0 - abs(dot(normalize(surfaceNormal), normalize(viewDirection))), 2.2);
                gl_FragColor = vec4(mix(tint, vec3(1.0), rim * .4 + impact * .3), .045 + rim * .65 + impact * .16);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }`
  }), n = new dt(e.geometries.sphere, a);
  return n.scale.set(1.12, 1.4, 1.12), n.position.y = 1.3, s.add(n), s.visible = !1, {
    update(r, i) {
      s.visible = !!r && r.ward > 0, !(!r || !s.visible) && (s.position.set(r.x, 0, r.y), a.uniforms.impact.value = i, s.scale.setScalar(1 + i * 0.035));
    },
    dispose() {
      a.dispose(), s.removeFromParent();
    }
  };
}
function Ro(e, t) {
  const s = e.group(t, [
    0,
    0.15,
    0.12
  ]), a = [];
  s.rotation.set(-0.45, 0, -0.2);
  for (const d of [-1, 1]) {
    const l = e.group(s);
    e.mesh(l, "box", Ke.cover, [
      0.25,
      0.055,
      0.44
    ], [
      d * 0.125,
      0,
      0
    ]), e.mesh(l, "box", Ke.page, [
      0.22,
      0.06,
      0.38
    ], [
      d * 0.12,
      0.04,
      0
    ]), a.push(l);
  }
  const n = e.group(s, [
    0,
    0.085,
    0
  ]);
  e.mesh(n, "box", "#fffced", [
    0.22,
    0.012,
    0.37
  ], [
    0.11,
    0,
    0
  ]);
  const r = e.mesh(s, "rock", Ke.empowered, [
    0.07,
    0.1,
    0.07
  ], [
    0,
    0.3,
    0
  ], !1, 1, !0), i = e.mesh(s, "torus", Ke.crest, [
    0.17,
    0.17,
    0.17
  ], [
    0,
    0.31,
    0
  ], !0, 0.65);
  i.rotation.x = Math.PI / 2;
  let u = 0, o = 0.15, c = -1;
  return { update(d, l, h, f) {
    const g = f || c < 0 || h < c ? 1 : 1 - Math.exp(-Math.min(4, h - c) * 0.5);
    c = h, u += ((d ? 1 : 0) - u) * g, o += ((l ? 0.5 : d ? 0.28 : 0.15) - o) * g, s.position.y = o, s.rotation.x = -0.45 + (o - 0.15) * 0.7, a[0].rotation.z = -0.65 + u * 0.5, a[1].rotation.z = 0.65 - u * 0.5, n.rotation.z = f ? 0.2 : 0.2 + u * (Math.sin(h * 0.18) + 1) * 1.3, r.scale.set(0.07 + u * 0.025, 0.1 + u * 0.06, 0.07 + u * 0.025), i.visible = d, f || (r.rotation.y = h * 0.08);
  } };
}
function zs(e, t, s = 1) {
  const a = e.group(t);
  a.scale.setScalar(s), e.shape(a, [
    [0.02, -0.44],
    [0.11, -0.41],
    [0.27, -0.2],
    [0.29, 0.12],
    [0.18, 0.42],
    [0.04, 0.51],
    [0.1, 0.28],
    [0.14, 0],
    [0.08, -0.25]
  ], "#ceac6e", [
    0,
    0,
    0.06
  ]), e.mesh(a, "box", "#f5f3dc", [
    0.012,
    0.94,
    0.015
  ], [
    0.04,
    0.03,
    0.07
  ]), e.mesh(a, "box", "#705444", [
    0.09,
    0.18,
    0.09
  ], [
    0.12,
    0,
    0.06
  ]);
}
function Ps(e, t, s) {
  const a = e.group(t), n = xo(e, a, s), r = n.body, i = e.ring(a, "#193f49", 0.6, 0, 0, 0.14, !0), u = e.group(r), o = n.hand, c = e.group(u), d = _o(e, u);
  let l = null, h = -1, f = Math.PI / 2, g = null, v = null, b = null, x = 0, _ = 0;
  function p(w, M) {
    if (!(w === v && M === b)) {
      if (v = w, b = M, c.clear(), o.clear(), l = null, g = Mo(e, c, b), n.dress(b), v === "blade")
        e.mesh(o, "cylinder", "#624d42", [
          0.035,
          0.28,
          0.035
        ], [
          0,
          -0.08,
          0.06
        ]), e.mesh(o, "box", "#d4b470", [
          0.32,
          0.05,
          0.11
        ], [
          0,
          0.07,
          0.06
        ], !1, 1, !0), e.shape(o, [
          [-0.07, 0.1],
          [0.07, 0.1],
          [0.07, 0.65],
          [0, 0.83],
          [-0.07, 0.65]
        ], "#f5f8ef", [
          0,
          0,
          0.07
        ], 0.018), e.shape(o, [
          [0, 0.1],
          [0.07, 0.1],
          [0.07, 0.65],
          [0, 0.83]
        ], "#9cc6ce", [
          0,
          0,
          0.094
        ]);
      else if (v === "bow") zs(e, o);
      else if (v === "staff")
        e.mesh(o, "cylinder", "#796889", [
          0.035,
          1.12,
          0.035
        ], [
          0,
          0.18,
          0.04
        ]), e.mesh(o, "torus", "#d8bc80", [
          0.19,
          0.24,
          0.18
        ], [
          0,
          0.85,
          0.04
        ], !1, 1, !0), e.mesh(o, "rock", "#b9ecff", [
          0.11,
          0.18,
          0.1
        ], [
          0,
          0.85,
          0.04
        ]);
      else if (v === "daggers") for (const S of [-1, 1]) {
        const I = e.group(o, [
          S < 0 ? -0.58 : 0,
          0,
          0
        ]);
        e.mesh(I, "box", "#974953", [
          0.07,
          0.2,
          0.07
        ]), e.shape(I, [
          [-0.045, 0.1],
          [0.05, 0.1],
          [0.035, 0.34],
          [0, 0.47],
          [-0.06, 0.27]
        ], "#dce9ed", [
          0,
          0,
          0.03
        ]);
      }
      else if (v === "grimoire") l = Ro(e, o);
      else if (v === "cannon") {
        const S = e.group(o, [
          0.02,
          0.08,
          0.17
        ]);
        S.rotation.x = Math.PI / 2, e.mesh(S, "cylinder", "#586e77", [
          0.12,
          0.55,
          0.12
        ], [
          0,
          0.1,
          0
        ], !1, 1, !0), e.mesh(S, "torus", "#d2a96c", [
          0.15,
          0.15,
          0.15
        ], [
          0,
          0.39,
          0
        ], !1, 1, !0).rotation.x = Math.PI / 2, e.mesh(o, "box", "#906749", [
          0.22,
          0.16,
          0.2
        ], [
          0,
          -0.1,
          0.13
        ]);
      }
    }
  }
  return {
    root: a,
    update(w, M, S, I, A, L, $ = !1) {
      p(M, S), d.update(M, !!w?.shield, !!w?.guard, I, A);
      const O = A || h < 0 || I < h ? 1 : 1 - Math.exp(-Math.min(4, I - h) * 0.65);
      h = I;
      const T = L ? Math.PI / 2 + 0.23 : w?.facing ?? Math.PI / 2;
      f += Math.atan2(Math.sin(T - f), Math.cos(T - f)) * O;
      const V = !!w && Math.abs(w.x - x) + Math.abs(w.y - _) > 1e-3, ee = !!w?.dashTime;
      a.position.set(w?.x ?? 0, L ? 0.3 : 0, w?.y ?? -8), a.scale.setScalar(L ? 1.65 : 1), n.pose(f, I, V, ee, A, !!w?.swing || $), g.cape.rotation.x = A ? -0.15 : -0.15 - (V ? 0.5 : 0.06) - Math.sin(I * 0.15) * 0.12, g.animate(I, A);
      const F = w?.swing && !A ? Math.sin(w.swing / (M === "cannon" ? 16 : 9) * Math.PI) : 0;
      o.rotation.z += (($ ? -0.3 : -0.2 - F * 1.3) - o.rotation.z) * O, o.rotation.x += (($ ? -0.25 : 0.1 + F * 0.6) - o.rotation.x) * O, l && l.update(!!w?.resonance, $, I, A), i.scale.set(0.6 + (ee ? 0.25 : 0), 0.6, 1), w && (x = w.x, _ = w.y);
    },
    dispose() {
      n.dispose(), a.removeFromParent();
    }
  };
}
function hn(e, t, s, a) {
  const { mesh: n, group: r } = e, i = r(t), u = r(i), o = r(u), c = r(u), d = [], l = xe(s), h = de[s].radius;
  e.ring(i, "#1d3540", h * 1.15, 0, 0, 0.16, !0);
  const f = "#cfad70", g = "#fff0b0", v = a.dark;
  function b($, O, T) {
    const V = r(u, [
      $,
      T,
      O
    ]);
    n(V, "box", v, [
      0.32,
      T,
      0.42
    ], [
      0,
      -T / 2,
      0
    ]), n(V, "box", a.stone, [
      0.38,
      0.22,
      0.55
    ], [
      0,
      -T + 0.11,
      0.1
    ]), d.push(V);
  }
  function x($, O, T = "#d9e8df") {
    n($, "box", f, [
      0.55,
      0.1,
      0.24
    ], [
      0,
      0.25,
      0
    ], !1, 1, !0), n($, "box", v, [
      0.11,
      0.4,
      0.11
    ]), n($, "box", T, [
      0.2,
      O,
      0.13
    ], [
      0,
      O / 2 + 0.35,
      0
    ], !1, 1, !0), n($, "cone", T, [
      0.15,
      0.4,
      0.13
    ], [
      0,
      O + 0.5,
      0
    ]);
  }
  if (s === "charger") {
    n(u, "rock", a.stone, [
      0.58,
      0.58,
      0.9
    ], [
      0,
      0.7,
      0
    ]), n(c, "rock", v, [
      0.43,
      0.45,
      0.46
    ], [
      0,
      0.73,
      0.7
    ]);
    for (const $ of [-0.27, 0.27]) {
      const O = n(c, "cone", f, [
        0.15,
        0.7,
        0.15
      ], [
        $,
        1.15,
        0.9
      ]);
      O.rotation.x = 0.55, n(c, "sphere", g, [
        0.05,
        0.04,
        0.06
      ], [
        $,
        0.82,
        1.02
      ], !0), b($, -0.42, 0.45), b($, 0.45, 0.45);
    }
    for (let $ = 0; $ < 3; $++) n(u, "cone", a.accent, [
      0.2,
      0.45,
      0.25
    ], [
      0,
      1.25,
      -0.5 + $ * 0.4
    ]);
  } else if (s === "weaver") {
    n(u, "cone", "#63689d", [
      1.45,
      3,
      1.2
    ], [
      0,
      2.1,
      0
    ]), n(u, "cone", a.light, [
      0.8,
      1.8,
      0.65
    ], [
      0,
      2.65,
      0.3
    ]), n(c, "sphere", v, [
      0.6,
      0.72,
      0.45
    ], [
      0,
      4,
      0
    ]);
    const $ = n(c, "crescent", f, [
      1.35,
      1.35,
      0.8
    ], [
      0,
      4.35,
      -0.3
    ], !1, 1, !0);
    $.rotation.z = 0.87;
    for (const O of [-0.23, 0.23]) n(c, "sphere", "#e4e3ff", [
      0.09,
      0.055,
      0.05
    ], [
      O,
      4.08,
      0.45
    ], !0);
    for (const O of [-1, 1]) {
      const T = r(u, [
        O * 0.8,
        3.3,
        0
      ]);
      T.rotation.z = O * 0.65, n(T, "cone", "#757caf", [
        0.5,
        1.8,
        0.45
      ], [
        0,
        -0.65,
        0
      ]), n(T, "sphere", a.light, [
        0.22,
        0.25,
        0.22
      ], [
        0,
        -1.45,
        0.1
      ]), d.push(T);
    }
    for (let O = 0; O < 5; O++) {
      const T = O / 5 * Math.PI * 2, V = n(o, "rock", a.accent, [
        0.2,
        0.34,
        0.2
      ], [
        Math.cos(T) * 1.95,
        3.3 + Math.sin(T) * 1.1,
        -0.3
      ]);
      V.rotation.z = T;
    }
  } else if (s === "king") {
    b(-0.5, 0, 0.8), b(0.5, 0, 0.8), n(u, "cone", "#7c4550", [
      1.8,
      3.6,
      0.8
    ], [
      0,
      2,
      -0.3
    ]), n(u, "box", v, [
      1.6,
      1.7,
      1
    ], [
      0,
      2.1,
      0
    ]), n(u, "rock", f, [
      0.5,
      0.9,
      0.3
    ], [
      0,
      2.25,
      0.62
    ]);
    for (const $ of [-1, 1]) n(u, "rock", a.stone, [
      0.85,
      0.5,
      0.7
    ], [
      $ * 0.95,
      2.95,
      0
    ]);
    n(c, "sphere", v, [
      0.65,
      0.8,
      0.5
    ], [
      0,
      3.6,
      0
    ]), n(c, "box", g, [
      0.48,
      0.08,
      0.09
    ], [
      0,
      3.7,
      0.51
    ], !0), n(c, "torus", f, [
      0.86,
      0.86,
      0.86
    ], [
      0,
      4.6,
      0
    ], !1, 1, !0).rotation.x = Math.PI / 2;
    for (let $ = 0; $ < 7; $++) {
      const O = $ * Math.PI * 2 / 7;
      n(c, "cone", f, [
        0.17,
        0.85,
        0.17
      ], [
        Math.cos(O) * 0.78,
        4.85,
        Math.sin(O) * 0.78
      ]);
    }
    o.position.set(1.55, 1.35, 0.2), o.rotation.z = -0.3, x(o, 3.4, "#f6dc9f"), n(u, "box", a.stone, [
      0.5,
      1.2,
      0.5
    ], [
      -1.15,
      2,
      0.1
    ]);
  } else if (s === "warden") {
    b(-0.65, 0.05, 0.85), b(0.65, 0.05, 0.85), n(u, "cylinder", v, [
      1.1,
      1.85,
      0.8
    ], [
      0,
      1.9,
      0
    ]), n(u, "box", a.stone, [
      1.1,
      1.45,
      0.35
    ], [
      0,
      2,
      0.72
    ]), n(u, "rock", a.accent, [
      0.28,
      0.4,
      0.14
    ], [
      0,
      2.1,
      0.94
    ]);
    for (const O of [-1, 1])
      n(u, "rock", a.stone, [
        0.83,
        0.6,
        0.7
      ], [
        O * 1.03,
        2.7,
        0
      ]), n(u, "box", f, [
        0.7,
        0.1,
        0.8
      ], [
        O * 1.08,
        2.45,
        0.1
      ], !1, 1, !0);
    n(c, "sphere", a.stone, [
      0.73,
      0.77,
      0.63
    ], [
      0,
      3.2,
      0
    ]), n(c, "box", v, [
      1.12,
      0.33,
      0.2
    ], [
      0,
      3.22,
      0.54
    ]), n(c, "box", g, [
      0.74,
      0.095,
      0.05
    ], [
      0,
      3.22,
      0.66
    ], !0), n(c, "cone", a.foliage, [
      0.27,
      1.1,
      0.5
    ], [
      0,
      4,
      -0.2
    ]);
    const $ = r(u, [
      -1.32,
      1.5,
      0.6
    ]);
    n($, "box", v, [
      1.2,
      1.8,
      0.25
    ]), n($, "box", f, [
      1,
      1.58,
      0.28
    ]), n($, "box", a.foliage, [
      0.85,
      1.42,
      0.31
    ]), n($, "rock", a.light, [
      0.28,
      0.4,
      0.1
    ], [
      0,
      0.1,
      0.22
    ]), o.position.set(1.5, 1.8, 0.25), n(o, "cylinder", "#766450", [
      0.1,
      2.5,
      0.1
    ]), n(o, "box", v, [
      1.25,
      0.9,
      0.9
    ], [
      0,
      1.4,
      0
    ]), n(o, "box", f, [
      0.24,
      0.96,
      0.94
    ], [
      0,
      1.4,
      0
    ], !1, 1, !0), n(o, "box", a.light, [
      0.22,
      0.77,
      0.74
    ], [
      0.65,
      1.4,
      0
    ]);
  } else if (xe(s)) ko(e, u, c, o, s, a);
  else if (s === "wisp")
    n(u, "rock", a.accent, [
      0.35,
      0.6,
      0.35
    ], [
      0,
      1,
      0
    ]), n(c, "torus", f, [
      0.48,
      0.6,
      0.4
    ], [
      0,
      1,
      0
    ]), n(c, "sphere", "#f7f5e8", [
      0.12,
      0.13,
      0.1
    ], [
      0,
      1.05,
      0.31
    ], !0), n(u, "cone", a.light, [
      0.16,
      0.6,
      0.16
    ], [
      0,
      0.35,
      0
    ]).rotation.z = Math.PI;
  else if (s === "stalker") {
    n(u, "sphere", a.dark, [
      0.4,
      0.35,
      0.65
    ], [
      0,
      0.55,
      0
    ]), n(c, "rock", a.foliage, [
      0.33,
      0.38,
      0.32
    ], [
      0,
      0.75,
      0.5
    ]);
    for (const $ of [-1, 1])
      b($ * 0.27, -0.25, 0.35), n(c, "cone", f, [
        0.09,
        0.35,
        0.09
      ], [
        $ * 0.21,
        1.09,
        0.42
      ]), n(c, "sphere", g, [
        0.05,
        0.04,
        0.035
      ], [
        $ * 0.15,
        0.8,
        0.77
      ], !0), n(o, "cone", a.light, [
        0.09,
        0.38,
        0.08
      ], [
        $ * 0.37,
        0.3,
        0.5
      ]).rotation.x = Math.PI / 2;
  } else if (s === "bomber")
    b(-0.22, 0, 0.45), b(0.22, 0, 0.45), n(u, "sphere", "#85654c", [
      0.5,
      0.6,
      0.4
    ], [
      0,
      0.95,
      0
    ]), n(c, "sphere", a.stone, [
      0.35,
      0.38,
      0.31
    ], [
      0,
      1.62,
      0
    ]), n(c, "box", a.dark, [
      0.63,
      0.15,
      0.08
    ], [
      0,
      1.69,
      0.3
    ]), n(u, "cylinder", "#ac7b54", [
      0.3,
      0.75,
      0.3
    ], [
      0,
      1.05,
      -0.4
    ]), n(o, "sphere", "#404c57", [
      0.25,
      0.25,
      0.25
    ], [
      0.56,
      1.1,
      0.18
    ]), n(o, "cone", "#ffca88", [
      0.07,
      0.3,
      0.07
    ], [
      0.56,
      1.41,
      0.18
    ]);
  else {
    const $ = s === "priest", O = s === "guard";
    if ($ ? n(u, "cone", "#767da5", [
      0.55,
      1.5,
      0.5
    ], [
      0,
      0.95,
      0
    ]) : (b(-0.22, 0, 0.5), b(0.22, 0, 0.5), n(u, "box", v, [
      0.72,
      0.85,
      0.52
    ], [
      0,
      0.92,
      0
    ])), n(u, "box", a.stone, [
      0.5,
      0.55,
      0.15
    ], [
      0,
      1,
      0.3
    ]), n(c, "sphere", a.stone, [
      0.43,
      0.45,
      0.38
    ], [
      0,
      1.63,
      0
    ]), n(c, "box", v, [
      0.68,
      0.17,
      0.12
    ], [
      0,
      1.65,
      0.32
    ]), n(c, "box", g, [
      0.39,
      0.045,
      0.05
    ], [
      0,
      1.65,
      0.39
    ], !0), $)
      n(c, "cone", "#626a9c", [
        0.55,
        0.8,
        0.5
      ], [
        0,
        2.14,
        0
      ]), o.position.set(0.52, 1, 0.1), n(o, "cylinder", f, [
        0.04,
        1.6,
        0.04
      ]), n(o, "rock", "#d1dcff", [
        0.22,
        0.32,
        0.22
      ], [
        0,
        0.95,
        0
      ]);
    else {
      n(c, "box", a.foliage, [
        0.12,
        0.38,
        0.55
      ], [
        0,
        2,
        -0.07
      ]);
      for (const T of [-1, 1]) n(u, "rock", a.stone, [
        0.28,
        0.23,
        0.3
      ], [
        T * 0.45,
        1.22,
        0
      ]);
      o.position.set(0.54, 1, 0.2), s === "archer" ? zs(e, o, 1.3) : (o.rotation.z = -0.3, x(o, 0.75)), O && (n(u, "box", f, [
        0.85,
        1.1,
        0.18
      ], [
        -0.4,
        0.95,
        0.46
      ]), n(u, "box", a.foliage, [
        0.72,
        0.92,
        0.22
      ], [
        -0.4,
        0.95,
        0.47
      ]));
    }
  }
  const _ = r(i, [
    0,
    l ? 5.5 : s === "charger" ? 1.7 : 2.45,
    0
  ]);
  n(_, "box", "#233f48", [
    1.06,
    0.105,
    0.02
  ], [
    0,
    0,
    0
  ], !0);
  const p = n(_, "box", "#f0ba83", [
    1,
    0.055,
    0.03
  ], [
    0,
    0,
    0.02
  ], !0), w = [];
  u.traverse(($) => {
    $ instanceof dt && w.push({
      mesh: $,
      material: $.material
    });
  });
  let M = 0, S = -100, I = 0, A = 0;
  const L = o.rotation.z;
  return {
    root: i,
    bar: _,
    update($, O, T) {
      const V = Math.abs($.x - I) + Math.abs($.y - A) > 5e-3;
      I = $.x, A = $.y, M && !$.windup && (S = O), M = $.windup;
      const ee = $.windup ? 1 - $.windup / de[$.kind].windup : 0, F = Math.max(0, 1 - (O - S) / 10);
      i.position.set($.x, 0, $.y), u.rotation.y = Math.PI / 2 - $.angle, u.position.y = T ? 0 : s === "weaver" || s === "priest" ? 0.13 + Math.sin(O * 0.055) * 0.1 : V ? Math.abs(Math.sin(O * 0.3)) * 0.055 : 0, u.rotation.x = T ? 0 : -ee * 0.16 + F * 0.2, c.rotation.z = !T && s === "king" ? Math.sin(O * 0.035) * 0.08 : 0, o.rotation.x = T ? 0 : ee * -1.3 + F * 1.4, o.rotation.z = L + (T ? 0 : ee * -0.35);
      for (let U = 0; U < d.length; U++) d[U].rotation.x = !T && V ? Math.sin(O * 0.32 + U * Math.PI) * 0.28 : 0;
      for (const U of w) U.mesh.material = $.marked > 2 && !T ? e.material("#fff6dd") : U.material;
      _.visible = !l && $.hp < $.maxHp, p.scale.x = $.hp / $.maxHp, p.position.x = ($.hp / $.maxHp - 1) * 0.5;
    }
  };
}
var se = {
  danger: "#c34740",
  warning: "#ec8754",
  magic: "#8bd9f2",
  frost: "#addffc",
  gold: "#fff0bb",
  heal: "#75dbb0",
  fire: "#f0ad55"
};
function Co(e, t) {
  const s = /* @__PURE__ */ new Map();
  function a(r, i, u = 1, o = !1) {
    const c = Math.max(0.1, Math.min(1, Math.round(u * 10) / 10)), d = `${r}/${i}/${c}/${o}`;
    let l = s.get(d);
    l || (l = {
      list: [],
      used: 0
    }, s.set(d, l));
    let h = l.list[l.used++];
    return h || (h = e.mesh(t, r, i, [
      1,
      1,
      1
    ], [
      0,
      0,
      0
    ], !o, c), l.list.push(h)), h.visible = !0, h.rotation.set(0, 0, 0), h.scale.set(1, 1, 1), h;
  }
  function n(r, i, u, o, c, d = 1, l = 0.09) {
    const h = a(r, i, d);
    return h.position.set(o, l, c), h.scale.set(u, u, 1), h.rotation.x = -Math.PI / 2, h;
  }
  return { update(r, i) {
    for (const o of s.values())
      o.used = 0, o.list.forEach((c) => c.visible = !1);
    if (!r) return;
    const u = r.player;
    if (n("ring", "#f2f6e2", 0.64, u.x, u.y, 0.8), u.dashTime && !i) for (let o = 1; o <= 3; o++) {
      const c = a("cone", se.gold, 0.7 - o * 0.15);
      c.position.set(u.x - Math.cos(u.dashAngle) * o * 0.43, 0.45, u.y - Math.sin(u.dashAngle) * o * 0.43), c.scale.set(0.13, u.dashTime / 8 * 1.7, 0.13), c.rotation.set(0, -u.dashAngle, -Math.PI / 2);
    }
    if (!r.boss && (r.encounter === "siege" || r.encounter === "ritual")) {
      const o = r.objective;
      r.encounter === "ritual" && (n("disc", se.magic, 2.5, o.x, o.y, 0.12), n("ring", se.magic, 2.5, o.x, o.y), n("ring", se.gold, 2.2, o.x, o.y, 0.8));
      const c = a("cylinder", "#526b79");
      c.position.set(o.x, 0.3, o.y), c.scale.set(0.5, 0.6, 0.5);
      const d = a("rock", r.encounter === "siege" ? se.fire : se.magic);
      if (d.position.set(o.x, 1, o.y), d.scale.set(0.23, 0.5, 0.23), r.encounter === "siege") {
        d.position.y = 1.35, d.scale.set(0.4, 0.85, 0.4);
        const l = a("cone", se.gold, 0.8);
        l.position.set(o.x, 1.4, o.y), l.scale.set(0.2, 0.85, 0.2), n("ring", se.fire, 0.9, o.x, o.y, 0.8);
      }
      i || (d.rotation.y = r.tick * 0.025);
    }
    for (const o of r.companions)
      if (!(o.hp <= 0 || o.life <= 0))
        if (n("ring", se.heal, 0.4, o.x, o.y, 0.8), o.kind === "turret") {
          const c = a("cylinder", "#687c81");
          c.position.set(o.x, 0.25, o.y), c.scale.set(0.4, 0.5, 0.4);
          const d = a("box", "#bd9a68");
          d.position.set(o.x, 0.65, o.y), d.scale.set(0.9, 0.2, 0.25), d.rotation.y = -o.angle;
          const l = a("sphere", se.magic);
          l.position.set(o.x + Math.cos(o.angle) * 0.45, 0.65, o.y + Math.sin(o.angle) * 0.45), l.scale.setScalar(0.11);
        } else {
          const c = o.kind === "familiar" && u.resonance > 0, d = c ? 1.5 : 1, l = o.kind === "shade" ? "#a6acd8" : c ? Ke.empowered : Ke.familiar, h = i ? 0 : Math.sin(r.tick * 0.1 + o.id) * 0.08, f = a("sphere", l, 1, !0);
          f.position.set(o.x, 0.55 * d + h, o.y), f.scale.set(0.3 * d, 0.36 * d, 0.3 * d);
          for (const v of [-1, 1]) {
            const b = a("cone", l, 1, !0);
            b.position.set(o.x + v * 0.2 * d, 0.93 * d + h, o.y), b.scale.set(0.08 * d, 0.22 * d, 0.08 * d);
          }
          const g = a("sphere", "#35475b");
          if (g.position.set(o.x + Math.cos(o.angle) * 0.28 * d, 0.63 * d + h, o.y + Math.sin(o.angle) * 0.28 * d), g.scale.setScalar(0.07 * d), c) {
            const v = a("torus", Ke.crest, 1, !0);
            v.position.set(o.x, 1.45 + h, o.y), v.rotation.x = Math.PI / 2, v.scale.setScalar(0.32);
            for (let b = 0; b < 3; b++) {
              const x = b * Math.PI * 2 / 3, _ = a("rock", Ke.crest, 1, !0);
              _.position.set(o.x + Math.cos(x) * 0.32, 1.55 + h, o.y + Math.sin(x) * 0.32), _.scale.set(0.08, 0.17, 0.08);
            }
          }
        }
    for (const o of r.enemies) {
      if (xe(o.kind) && o.phase > 1) {
        const c = de[o.kind].radius + 0.55;
        if (n("ring", o.kind === "king" ? se.fire : se.magic, c, o.x, o.y, 0.65), !i) for (let d = 0; d < o.phase + 2; d++) {
          const l = r.tick * 0.025 + d * Math.PI * 2 / (o.phase + 2), h = a("rock", o.kind === "king" ? se.fire : se.magic, 0.8);
          h.position.set(o.x + Math.cos(l) * c, 0.55 + Math.sin(l * 2) * 0.2, o.y + Math.sin(l) * c), h.scale.set(0.08, 0.19, 0.08);
        }
      }
      if (o.windup) {
        const c = 1 - o.windup / de[o.kind].windup;
        if (n("ring", se.warning, de[o.kind].radius + 0.35, o.x, o.y, 0.8), o.kind === "charger") {
          const d = Math.min(9, Math.hypot(o.target.x - o.x, o.target.y - o.y)), l = a("box", se.danger, 0.3);
          l.scale.set(0.75, 0.035, d), l.position.set(o.x + Math.cos(o.angle) * d / 2, 0.09, o.y + Math.sin(o.angle) * d / 2), l.rotation.y = Math.PI / 2 - o.angle, n("ring", se.danger, 0.5, o.target.x, o.target.y, 0.9);
        } else if (o.kind === "archer") {
          const d = Math.hypot(o.target.x - o.x, o.target.y - o.y), l = a("box", se.warning, 0.6);
          l.position.set((o.x + o.target.x) / 2, 0.11, (o.y + o.target.y) / 2), l.scale.set(d, 0.03, 0.09), l.rotation.y = -o.angle;
        } else o.kind === "bomber" ? n("ring", se.warning, 1.9, o.target.x, o.target.y) : (o.kind === "soldier" || o.kind === "guard" || o.kind === "stalker") && (n("disc", se.danger, de[o.kind].reach, o.target.x, o.target.y, 0.15 + c * 0.2), n("ring", se.danger, de[o.kind].reach, o.target.x, o.target.y));
      }
      if (o.chill && n("ring", se.frost, de[o.kind].radius + 0.13, o.x, o.y), o.exposed && n("arc", se.gold, de[o.kind].radius + 0.3, o.x, o.y, 0.9), o.burn && !i) for (let c = 0; c < 3; c++) {
        const d = a("rock", se.fire, 0.8);
        d.position.set(o.x + Math.sin(c * 2) * 0.3, 0.35 + (r.tick + c * 7) % 20 / 18, o.y + Math.cos(c * 2) * 0.3), d.scale.set(0.08, 0.2, 0.08);
      }
      o.kind === "priest" && n("ring", "#a39aca", 3.5, o.x, o.y, 0.4);
    }
    for (const o of r.hazards) {
      const c = o.friendly ? o.kind === "fire" ? se.fire : se.magic : se.danger;
      if (o.kind === "beam") {
        const d = a("box", c, o.wait ? 0.3 : 0.75);
        d.position.set(o.x + Math.cos(o.angle) * o.length / 2, 0.11, o.y + Math.sin(o.angle) * o.length / 2), d.scale.set(o.length, 0.04, o.width * 2), d.rotation.y = -o.angle;
        for (const l of [0, o.length]) n("disc", c, o.width, o.x + Math.cos(o.angle) * l, o.y + Math.sin(o.angle) * l, o.wait ? 0.3 : 0.75);
        continue;
      }
      if (o.kind === "ring") {
        n("ring", c, o.inner, o.x, o.y), n("ring", c, o.radius, o.x, o.y);
        for (let d = 1; d <= 4; d++) n("ring", c, o.inner + (o.radius - o.inner) * d / 5, o.x, o.y, o.wait ? 0.35 : 0.8);
        continue;
      }
      if (n("disc", c, o.radius, o.x, o.y, o.wait ? 0.2 : 0.4), n("ring", c, o.radius, o.x, o.y), o.wait) {
        n("ring", c, o.radius * (1 - Math.min(1, o.wait / 45)), o.x, o.y, 0.7);
        const d = a("box", c, 0.7);
        d.position.set(o.x, 0.12, o.y), d.scale.set(0.08, 0.02, 0.6);
        const l = a("box", c, 0.7);
        l.position.copy(d.position), l.scale.set(0.6, 0.02, 0.08);
      } else if (!i) {
        n("ring", se.gold, o.radius * (0.7 + Math.sin(r.tick * 0.1) * 0.1), o.x, o.y, 0.7, 0.25);
        for (let d = 0; d < 6; d++) {
          const l = d * Math.PI / 3, h = a("cone", c, 0.7);
          h.position.set(o.x + Math.cos(l) * o.radius * 0.65, 0.45, o.y + Math.sin(l) * o.radius * 0.65), h.scale.set(0.15, 0.9, 0.15);
        }
      }
    }
    for (const o of r.shots) {
      const c = o.friendly ? se.gold : se.danger, d = a("sphere", o.friendly ? "#fffbea" : "#fff1c9");
      d.position.set(o.x, 0.6, o.y), d.scale.set(0.11, 0.11, 0.11);
      const l = a("sphere", c, 0.8);
      l.position.copy(d.position), l.scale.set(0.21, 0.18, 0.21);
      const h = a("cone", c, 0.5);
      h.position.set(o.x - Math.cos(o.angle) * 0.38, 0.6, o.y - Math.sin(o.angle) * 0.38), h.scale.set(0.14, 0.75, 0.14), h.rotation.set(0, -o.angle, -Math.PI / 2);
    }
    for (const o of r.effects) {
      const c = 1 - o.life / (o.kind === "slash" ? 9 : 15);
      if (o.kind === "slash") {
        const d = n("arc", se.gold, o.size, o.x, o.y, 0.3 * (1 - c), 0.42);
        d.rotation.z = -o.angle - 0.9 + c * 0.4;
        const l = n("stroke", "#fff4d2", o.size, o.x, o.y, 0.9 * (1 - c), 0.43);
        l.rotation.z = d.rotation.z;
      } else if (o.kind === "resonance") {
        n("ring", Ke.crest, o.size * (i ? 1 : 0.6 + c * (2 - c)), o.x, o.y, 0.8 - c * 0.6, 0.16);
        for (const d of r.companions) {
          if (d.kind !== "familiar" || d.hp <= 0 || d.life <= 0) continue;
          const l = d.x - u.x, h = d.y - u.y, f = a("box", Ke.empowered, 1 - c * 0.7);
          f.position.set((u.x + d.x) / 2, 1.1, (u.y + d.y) / 2), f.scale.set(Math.hypot(l, h), 0.045, 0.045), f.rotation.y = -Math.atan2(h, l);
        }
        for (let d = 0; d < 4; d++) {
          const l = d * Math.PI / 2 + (i ? 0 : c), h = a("rock", Ke.empowered, 1 - c * 0.4);
          h.position.set(u.x + Math.cos(l) * 0.95, 1.7 + (i ? 0 : c * 0.5), u.y + Math.sin(l) * 0.95), h.scale.set(0.08, 0.18, 0.08);
        }
      } else if (o.kind === "lightning") {
        for (let d = 0; d < 4; d++) {
          const l = a("box", d % 2 ? "#ffffff" : se.magic, 1 - c * 0.6);
          l.scale.set(0.09 + (1 - c) * 0.09, 1.05, 0.08), l.position.set(o.x + (d % 2 ? 0.14 : -0.14), 0.5 + d * 0.85, o.y), l.rotation.z = d % 2 ? -0.35 : 0.35;
        }
        n("ring", se.magic, 0.4 + c, o.x, o.y, 1 - c);
      } else if (o.kind === "block" || o.kind === "parry" || o.kind === "ward-hit" || o.kind === "ward-break") {
        const d = o.kind === "block" || o.kind === "parry", l = o.kind === "ward-break", h = d ? o.kind === "parry" ? je.parry : je.block : je.ward;
        if (d) {
          const f = a("ring", h, 1 - c);
          f.position.set(o.x + Math.cos(o.angle) * 0.7, 1.3, o.y + Math.sin(o.angle) * 0.7), f.rotation.y = Math.PI / 2 - o.angle, f.scale.setScalar(0.6 + c * (o.kind === "parry" ? 1.3 : 0.6));
        }
        for (let f = 0; f < (l ? 6 : 4); f++) {
          const g = f * 2.4 + o.id, v = a(l ? "rock" : "box", h, 1 - c), b = i ? 1.1 : 0.7 + c * (l ? 1.5 : 0.6);
          v.position.set(o.x + Math.cos(g) * b, 0.7 + f % 3 * 0.55, o.y + Math.sin(g) * b), v.scale.set(0.07 * (1 - c), (l ? 0.3 : 0.16) * (1 - c), 0.04), v.rotation.set(g, g, g);
        }
      } else if (o.kind === "heal") n("ring", se.heal, 0.4 + c, o.x, o.y, 1 - c);
      else {
        const d = o.kind === "hit" ? se.danger : se.gold;
        if (n("ring", d, o.size * (0.4 + c), o.x, o.y, 1 - c), !i) for (let l = 0; l < 7; l++) {
          const h = l * 2.4 + o.id, f = a("rock", d, 1 - c * 0.8);
          f.position.set(o.x + Math.cos(h) * c * o.size, 0.4 + Math.sin(c * Math.PI) * 0.8, o.y + Math.sin(h) * c * o.size), f.scale.set(0.1 * (1 - c), 0.28 * (1 - c), 0.1 * (1 - c)), f.rotation.z = h;
        }
      }
    }
  } };
}
function zo(e) {
  const t = document.createElement("div"), s = document.createElement("i");
  t.className = "exp-world-ward", t.style.setProperty("--ward-color", je.ward), t.setAttribute("role", "meter"), t.setAttribute("aria-label", te.ward), t.setAttribute("aria-valuemin", "0"), t.setAttribute("aria-valuemax", String(Q.maxHp)), t.append(s);
  const a = document.createElement("div");
  a.className = "exp-world-defense", e.append(t, a), t.hidden = !0, a.hidden = !0;
  const n = new rt();
  let r = null, i = 0, u = 0, o = null;
  function c(d, l, h, f, g, v, b) {
    n.set(l, h, f).project(g), d.style.left = `${(n.x * 0.5 + 0.5) * v}px`, d.style.top = `${(-n.y * 0.5 + 0.5) * b}px`;
  }
  return {
    update(d, l, h, f) {
      if (d !== r && (r = d, i = 0, o = null, u = 0), t.hidden = !d || d.player.ward <= 0, a.hidden = !d, !d) return;
      const g = d.player;
      t.hidden || (s.style.width = `${g.ward / Q.maxHp * 100}%`, t.setAttribute("aria-valuenow", String(g.ward)), c(t, g.x, 0, g.y, l, h, f));
      const v = d.effects.filter((x) => x.id > i && x.kind in te.defenseFeedback), b = v.find((x) => x.kind === "parry" || x.kind === "ward-break") ?? v.at(-1);
      b && (o = b.kind, u = d.tick + 27), i = d.serial, d.tick >= u && (o = null), a.hidden = !o && !g.shield, a.dataset.state = o ?? "blocking", a.textContent = o ? te.defenseFeedback[o] : g.shield ? te.guardActive : "", c(a, g.x, g.shield ? 3.65 : 3.05, g.y, l, h, f);
    },
    dispose() {
      t.remove(), a.remove();
    }
  };
}
function Po(e, t, s, a) {
  const { width: n, depth: r } = a.footprint, i = n >= r, u = Math.max(1, Math.floor(Math.max(n, r) / 5));
  e.mesh(t, "box", y.mortar, [
    n,
    0.4,
    r
  ], [
    0,
    0.2,
    0
  ]);
  for (let o = 0; o < u; o++) {
    const c = i ? n / u : n, d = i ? r : r / u, l = e.group(s, [
      i ? -n / 2 + (o + 0.5) * c : 0,
      0,
      i ? 0 : -r / 2 + (o + 0.5) * d
    ]), h = (a.height ?? 4) + (o % 3 - 1) * 0.35, f = a.kind === "workshop";
    e.mesh(l, "box", o % 2 ? y.stone : y.cloth, [
      c - 0.15,
      h - 0.4,
      d - 0.15
    ], [
      0,
      (h + 0.4) / 2,
      0
    ]);
    for (const x of [-c / 2 + 0.12, c / 2 - 0.12]) e.mesh(l, "box", y.timber, [
      0.18,
      h,
      d
    ], [
      x,
      h / 2,
      0
    ]);
    for (const x of [0.7, h - 0.3]) e.mesh(l, "box", y.wood, [
      c,
      0.15,
      d
    ], [
      0,
      x,
      0
    ]);
    const g = e.group(l, [
      0,
      h + 0.24,
      0
    ]);
    g.rotation.x = -0.18;
    const v = !i && u > 1 ? d - 0.03 : d + 0.7;
    e.mesh(g, "box", y.roof, [
      c + 0.6,
      0.16,
      v
    ]);
    for (let x = -c / 2; x <= c / 2; x += 0.8) e.mesh(g, "box", y.roofLight, [
      0.055,
      0.07,
      v
    ], [
      x,
      0.12,
      0
    ]);
    e.mesh(g, "box", y.brass, [
      c + 0.65,
      0.12,
      0.13
    ], [
      0,
      0.03,
      v / 2
    ]);
    const b = e.group(l, [
      0,
      0,
      d / 2
    ]);
    e.mesh(b, "box", y.shadow, [
      1.05,
      2.1,
      0.1
    ], [
      -c * 0.19,
      1.1,
      0
    ]);
    for (const x of [
      -0.4,
      -0.13,
      0.14,
      0.41
    ]) e.mesh(b, "box", y.wood, [
      0.24,
      1.95,
      0.12
    ], [
      -c * 0.19 + x,
      1.06,
      0.04
    ]);
    if (e.mesh(b, "box", y.shadow, [
      0.9,
      0.9,
      0.12
    ], [
      c * 0.27,
      2.25,
      0.03
    ]), e.mesh(b, "box", y.ember, [
      0.7,
      0.67,
      0.14
    ], [
      c * 0.27,
      2.25,
      0.1
    ], !0), e.mesh(b, "box", y.timber, [
      0.07,
      0.85,
      0.16
    ], [
      c * 0.27,
      2.25,
      0.15
    ]), e.mesh(b, "box", y.timber, [
      0.85,
      0.07,
      0.16
    ], [
      c * 0.27,
      2.25,
      0.15
    ]), d >= 4 && (i || o === u - 1)) {
      const x = e.group(b, [
        0,
        2.8,
        0.55
      ]);
      x.rotation.x = 0.22, e.mesh(x, "box", a.tint === "rose" ? y.rose : y.cloth, [
        c * 0.8,
        0.045,
        1.6
      ]), e.mesh(x, "box", y.light, [
        0.55,
        0.015,
        0.45
      ], [
        -c * 0.17,
        0.035,
        0.35
      ]);
    }
    if (f) {
      e.mesh(l, "box", y.wood, [
        c * 0.65,
        0.2,
        0.8
      ], [
        0,
        1.1,
        d / 2 - 0.5
      ]);
      for (let x = 0; x < 3; x++) e.mesh(l, "cylinder", y.brass, [
        0.18,
        0.6,
        0.18
      ], [
        (x - 1) * 0.55,
        1.4,
        d / 2 - 0.5
      ]).rotation.z = Math.PI / 2;
    } else
      e.mesh(l, "box", y.slate, [
        0.6,
        h * 0.38,
        0.7
      ], [
        -c * 0.3,
        h + 0.55,
        -d * 0.2
      ]), e.mesh(l, "box", y.shadow, [
        0.75,
        0.15,
        0.85
      ], [
        -c * 0.3,
        h * 1.19 + 0.6,
        -d * 0.2
      ]);
  }
}
function $o(e, t, s) {
  const a = e.group(t, [
    s.width / 2 + 0.04,
    0,
    0
  ]);
  a.rotation.y = Math.PI / 2;
  const n = Math.min(4.8, s.depth - 0.7);
  e.mesh(a, "box", y.timber, [
    n,
    0.16,
    2.2
  ], [
    0,
    3.25,
    1
  ]), e.mesh(a, "box", y.cloth, [
    n - 0.15,
    2.35,
    1.75
  ], [
    0,
    4.5,
    0.86
  ]);
  for (const i of [-n / 2 + 0.1, n / 2 - 0.1]) {
    e.mesh(a, "box", y.timber, [
      0.16,
      2.5,
      1.9
    ], [
      i,
      4.5,
      0.9
    ]);
    const u = e.mesh(a, "box", y.wood, [
      0.15,
      1,
      0.15
    ], [
      i,
      3,
      0.4
    ]);
    u.rotation.x = -0.68;
  }
  e.mesh(a, "box", y.shadow, [
    1.3,
    1,
    0.05
  ], [
    0,
    4.55,
    1.76
  ]), e.mesh(a, "box", y.ember, [
    1.03,
    0.77,
    0.06
  ], [
    0,
    4.55,
    1.8
  ], !0), e.mesh(a, "box", y.timber, [
    0.07,
    0.95,
    0.1
  ], [
    0,
    4.55,
    1.85
  ]);
  for (const i of [-0.78, 0.78]) e.mesh(a, "box", y.wood, [
    0.26,
    1.15,
    0.12
  ], [
    i,
    4.55,
    1.83
  ]);
  const r = e.group(a, [
    0,
    5.8,
    1.1
  ]);
  r.rotation.x = 0.14, e.mesh(r, "box", y.roof, [
    n + 0.45,
    0.16,
    2.5
  ]);
  for (let i = -n / 2; i < n / 2; i += 0.6) e.mesh(r, "box", y.roofLight, [
    0.07,
    0.1,
    2.53
  ], [
    i,
    0.1,
    0
  ]);
  e.mesh(a, "box", y.wood, [
    1.2,
    1.9,
    0.08
  ], [
    0,
    1,
    0.04
  ]), e.mesh(a, "box", y.timber, [
    0.1,
    0.4,
    0.06
  ], [
    0.3,
    1,
    0.11
  ]);
}
function Eo(e, t) {
  e.mesh(t, "box", y.mortar, [
    4,
    0.2,
    4
  ], [
    0,
    0.1,
    0
  ]), e.mesh(t, "box", y.slate, [
    1.45,
    1.1,
    1.15
  ], [
    0,
    0.75,
    0
  ]), e.mesh(t, "box", y.shadow, [
    0.95,
    0.55,
    0.04
  ], [
    0,
    0.62,
    0.59
  ]), e.mesh(t, "box", y.ember, [
    0.62,
    0.24,
    0.05
  ], [
    0,
    0.52,
    0.62
  ], !0);
  for (const s of [
    -0.22,
    0,
    0.22
  ]) e.mesh(t, "box", y.shadow, [
    0.05,
    0.48,
    0.07
  ], [
    s,
    0.62,
    0.67
  ]);
  e.mesh(t, "cylinder", y.shadow, [
    0.13,
    2.5,
    0.13
  ], [
    -0.48,
    2.25,
    -0.4
  ]), e.mesh(t, "cylinder", y.pottery, [
    0.36,
    0.48,
    0.36
  ], [
    0.2,
    1.52,
    0
  ]), e.mesh(t, "cylinder", y.shadow, [
    0.38,
    0.07,
    0.38
  ], [
    0.2,
    1.79,
    0
  ]);
  for (let s = 0; s < 5; s++) e.mesh(t, "box", y.wood, [
    0.8,
    0.16,
    0.2
  ], [
    1.25,
    0.3 + s % 3 * 0.18,
    -0.5 + Math.floor(s / 3) * 0.24
  ]);
  e.mesh(t, "cylinder", y.timber, [
    0.38,
    0.65,
    0.38
  ], [
    -1.15,
    0.52,
    0.5
  ]);
  for (let s = 0; s < 5; s++) e.mesh(t, "rock", y.shadow, [
    0.18,
    0.16,
    0.17
  ], [
    -1.15 + Math.sin(s * 2) * 0.2,
    0.87,
    0.5 + Math.cos(s * 2) * 0.2
  ]);
}
function Io(e, t, s, a) {
  e.mesh(t, "box", y.wood, [
    s,
    0.16,
    a
  ], [
    0,
    1,
    0
  ]);
  for (const n of [-1, 1]) e.mesh(t, "box", y.timber, [
    0.18,
    1,
    a - 0.2
  ], [
    n * (s / 2 - 0.2),
    0.5,
    0
  ]);
  e.mesh(t, "box", y.cloth, [
    s * 0.4,
    0.025,
    a * 0.8
  ], [
    -s * 0.2,
    1.1,
    0
  ]);
  for (let n = 0; n < 5; n++)
    e.mesh(t, "cylinder", n % 2 ? y.pottery : y.slate, [
      0.16,
      0.32 + n % 2 * 0.15,
      0.16
    ], [
      s * 0.04 + n * 0.43,
      1.28,
      -0.3
    ]), e.mesh(t, "cylinder", y.wood, [
      0.17,
      0.055,
      0.17
    ], [
      s * 0.04 + n * 0.43,
      1.47 + n % 2 * 0.075,
      -0.3
    ]);
  for (let n = 0; n < 3; n++) e.mesh(t, "box", y.light, [
    0.8,
    0.12,
    0.48
  ], [
    -s * 0.25,
    1.18 + n * 0.12,
    0.12
  ]);
  e.mesh(t, "cylinder", y.pottery, [
    0.3,
    0.18,
    0.3
  ], [
    s * 0.22,
    1.19,
    0.45
  ]);
}
function Lo(e, t, s) {
  const a = new rt(...s.from), n = new rt(...s.to), r = n.clone().sub(a), i = r.length(), u = s.kind === "pipe", o = u ? 0.23 : 0.018, c = e.mesh(t, "cylinder", u ? y.brass : y.timber, [
    o,
    i,
    o
  ], a.clone().add(n).multiplyScalar(0.5).toArray());
  if (c.quaternion.setFromUnitVectors(new rt(0, 1, 0), r.normalize()), u) for (let d = 1; d < i; d += 3.7) {
    const l = a.clone().addScaledVector(r, d);
    e.mesh(t, "cylinder", y.wood, [
      0.28,
      0.16,
      0.28
    ], l.toArray()).quaternion.copy(c.quaternion), e.mesh(t, "box", y.shadow, [
      0.12,
      0.65,
      0.12
    ], [
      l.x,
      l.y - 0.3,
      l.z
    ]);
  }
  else for (let d = 2; d < i - 2; d += 1.9) {
    const l = a.clone().addScaledVector(r, d), h = e.group(t, l.toArray());
    h.rotation.y = Math.atan2(r.x, r.z) + Math.PI / 2, e.shape(h, [
      [-0.55, 0],
      [0.55, 0],
      [0.5, -1.05],
      [-0.45, -1.12]
    ], Math.floor(d) % 2 ? y.cloth : y.light);
    for (const f of [-1, 1]) e.mesh(h, "box", y.wood, [
      0.07,
      0.17,
      0.06
    ], [
      f * 0.42,
      -0.02,
      0.03
    ]);
  }
}
function Ao(e, t, s) {
  const { width: a, depth: n } = s.footprint;
  if (s.kind === "ledger") {
    e.mesh(t, "box", y.wood, [
      a,
      0.18,
      n
    ], [
      0,
      1.18,
      0
    ]);
    for (const u of [-1, 1]) e.mesh(t, "box", y.timber, [
      0.25,
      1.1,
      n - 0.4
    ], [
      u * (a / 2 - 0.3),
      0.55,
      0
    ]);
    for (let u = -1; u <= 1; u++)
      e.mesh(t, "box", y.slate, [
        0.85,
        0.17,
        1.1
      ], [
        u * 1.2,
        1.35,
        -0.3
      ]), e.mesh(t, "box", y.light, [
        0.77,
        0.025,
        0.98
      ], [
        u * 1.2,
        1.45,
        -0.3
      ]), e.mesh(t, "box", y.brass, [
        0.08,
        0.025,
        1.13
      ], [
        u * 1.2,
        1.48,
        -0.3
      ]);
    e.mesh(t, "cylinder", y.brass, [
      0.18,
      0.25,
      0.18
    ], [
      a * 0.28,
      1.4,
      n * 0.28
    ]), e.mesh(t, "box", y.light, [
      1.1,
      0.024,
      0.65
    ], [
      -a * 0.2,
      1.3,
      n * 0.28
    ]);
    return;
  }
  e.mesh(t, "box", y.timber, [
    a,
    0.16,
    n
  ], [
    0,
    0.08,
    0
  ]);
  const r = Math.max(1, Math.floor(n / 2.2)), i = Math.max(1, Math.floor(a / 1.8));
  for (let u = 0; u < r; u++) for (let o = 0; o < i; o++) {
    const c = -a / 2 + (o + 0.5) * a / i, d = -n / 2 + (u + 0.5) * n / r, l = a / i - 0.22, h = n / r - 0.24;
    if (s.kind === "fuel") {
      for (let f = 0; f < 5; f++) e.mesh(t, "box", f % 2 ? y.wood : y.timber, [
        l,
        0.2,
        h / 2 - 0.07
      ], [
        c,
        0.28 + f * 0.24,
        d + f % 2 * 0.12
      ]);
      e.mesh(t, "box", y.cloth, [
        l + 0.08,
        0.055,
        h
      ], [
        c,
        1.42,
        d
      ]);
    } else {
      const f = 0.85 + (u + o) % 3 * 0.22;
      e.mesh(t, "box", y.wood, [
        l,
        f,
        h
      ], [
        c,
        0.16 + f / 2,
        d
      ]);
      for (const g of [-1, 1]) e.mesh(t, "box", y.timber, [
        0.11,
        f + 0.04,
        h + 0.05
      ], [
        c + g * l * 0.32,
        0.16 + f / 2,
        d
      ]);
      e.mesh(t, "box", y.light, [
        0.32,
        0.4,
        0.03
      ], [
        c,
        0.7,
        d + h / 2 + 0.02
      ]), e.mesh(t, "box", y.rose, [
        0.09,
        0.09,
        0.04
      ], [
        c,
        0.61,
        d + h / 2 + 0.045
      ]);
      for (let g = -0.25; g <= 0.25; g += 0.25) e.mesh(t, "box", y.timber, [
        l,
        0.015,
        0.016
      ], [
        c,
        f + 0.17,
        d + g * h
      ]);
      (u + o) % 3 === 0 && (e.mesh(t, "box", y.cloth, [
        l * 0.75,
        0.38,
        h * 0.55
      ], [
        c,
        f + 0.37,
        d - 0.18
      ]), e.mesh(t, "box", y.timber, [
        0.055,
        0.4,
        h * 0.57
      ], [
        c,
        f + 0.37,
        d - 0.18
      ])), e.mesh(t, "box", y.light, [
        0.32,
        0.018,
        0.45
      ], [
        c + l * 0.23,
        f + 0.19,
        d + h * 0.25
      ]);
    }
  }
}
function To(e, t, s, a) {
  for (let n = 0; n < 3; n++) e.mesh(t, "box", y.slate, [
    s * 0.65,
    0.08,
    0.7
  ], [
    0,
    2.19 + n * 0.08,
    a * 0.22
  ]);
  e.mesh(t, "box", y.rose, [
    s * 0.6,
    0.03,
    0.08
  ], [
    0,
    2.41,
    a * 0.22 + 0.25
  ]), e.mesh(t, "cylinder", y.pottery, [
    0.22,
    0.15,
    0.22
  ], [
    s * 0.35,
    0.17,
    a * 0.35
  ]), e.mesh(t, "cylinder", y.shadow, [
    0.18,
    0.014,
    0.18
  ], [
    s * 0.35,
    0.25,
    a * 0.35
  ]);
  for (const n of [-0.17, 0.17]) e.mesh(t, "box", y.wood, [
    0.23,
    0.12,
    0.44
  ], [
    n,
    0.08,
    -a * 0.37
  ]);
  e.mesh(t, "box", y.rose, [
    0.42,
    0.045,
    0.3
  ], [
    0.3,
    0.9,
    a * 0.2
  ]);
}
function $s(e, t, s, a, n = 2.8) {
  e.mesh(t, "cylinder", y.shadow, [
    0.055,
    n,
    0.055
  ], [
    s,
    n / 2,
    a
  ]), e.mesh(t, "box", y.brass, [
    0.4,
    0.08,
    0.4
  ], [
    s,
    n,
    a
  ]), e.mesh(t, "box", y.ember, [
    0.22,
    0.38,
    0.22
  ], [
    s,
    n + 0.21,
    a
  ], !0), e.mesh(t, "cone", y.shadow, [
    0.32,
    0.24,
    0.32
  ], [
    s,
    n + 0.51,
    a
  ]);
  for (const r of [-1, 1]) e.mesh(t, "box", y.shadow, [
    0.035,
    0.4,
    0.035
  ], [
    s + r * 0.14,
    n + 0.2,
    a + 0.14
  ]);
}
function Es(e, t, s, a, n, r) {
  const i = s / 2 + 0.45, u = Math.atan2(r, i), o = Math.hypot(i, r);
  for (const c of [-1, 1]) {
    const d = e.group(t, [
      c * i / 2,
      n + r / 2,
      0
    ]);
    d.rotation.z = -c * u, e.mesh(d, "box", y.roof, [
      o + 0.2,
      0.18,
      a + 1.1
    ]);
    for (let l = 0; l < Math.ceil(o / 0.65); l++) e.mesh(d, "box", l % 3 ? y.roof : y.roofLight, [
      0.14,
      0.07,
      a + 1.15
    ], [
      -o / 2 + l * 0.65,
      0.13,
      0
    ]);
    e.mesh(d, "box", y.shadow, [
      0.2,
      0.24,
      a + 1.25
    ], [
      c * o / 2,
      -0.05,
      0
    ]);
  }
  e.mesh(t, "box", y.brass, [
    0.24,
    0.23,
    a + 1.4
  ], [
    0,
    n + r + 0.14,
    0
  ]);
  for (const c of [-a / 2 - 0.08, a / 2 + 0.08])
    e.shape(t, [
      [-s / 2, 0],
      [s / 2, 0],
      [0, r]
    ], y.light, [
      0,
      n,
      c
    ], 0.08), e.mesh(t, "box", y.timber, [
      0.15,
      r,
      0.18
    ], [
      0,
      n + r / 2,
      c + 0.12
    ]);
}
function pa(e, t, s, a, n, r = 1.1) {
  e.mesh(t, "box", y.shadow, [
    r,
    1.45,
    0.12
  ], [
    s,
    n,
    a
  ]), e.mesh(t, "box", y.window, [
    r - 0.18,
    1.25,
    0.14
  ], [
    s,
    n,
    a + 0.07
  ]);
  for (const i of [-1, 1])
    e.mesh(t, "box", y.wood, [
      0.13,
      1.6,
      0.2
    ], [
      s + i * r / 2,
      n,
      a + 0.12
    ]), e.mesh(t, "box", y.light, [
      r + 0.28,
      0.14,
      0.26
    ], [
      s,
      n + i * 0.8,
      a + 0.12
    ]);
  e.mesh(t, "box", y.timber, [
    0.07,
    1.3,
    0.16
  ], [
    s,
    n,
    a + 0.16
  ]), e.mesh(t, "box", y.timber, [
    r,
    0.06,
    0.16
  ], [
    s,
    n,
    a + 0.16
  ]);
}
function jo(e, t, s) {
  const { width: a, depth: n } = s.footprint, r = s.kind === "clinic", i = r ? 3.7 : 5;
  e.mesh(t, "box", y.stone, [
    a - 0.3,
    i,
    n - 0.3
  ], [
    0,
    i / 2,
    0
  ]), e.mesh(t, "box", y.light, [
    a - 0.4,
    i - 1,
    n - 0.1
  ], [
    0,
    i / 2 + 0.4,
    0
  ]);
  for (const d of [-a / 2 + 0.15, a / 2 - 0.15]) for (const l of [-n / 2 + 0.15, n / 2 - 0.15]) e.mesh(t, "box", y.timber, [
    0.27,
    i,
    0.27
  ], [
    d,
    i / 2,
    l
  ]);
  for (const d of [0.8, i - 0.25]) e.mesh(t, "box", y.timber, [
    a,
    0.18,
    n
  ], [
    0,
    d,
    0
  ]);
  for (const d of [-a * 0.29, a * 0.29]) pa(e, t, d, n / 2, 2.3, r ? 1.6 : 1.2);
  const u = e.group(t, [
    a / 2,
    0,
    0
  ]);
  u.rotation.y = Math.PI / 2;
  for (const d of [-n * 0.27, n * 0.27]) pa(e, u, d, 0.03, 2.3);
  e.mesh(t, "box", y.shadow, [
    1.9,
    2.65,
    0.13
  ], [
    0,
    1.35,
    n / 2
  ]);
  for (const d of [-1, 1]) e.mesh(t, "box", y.wood, [
    0.85,
    2.5,
    0.12
  ], [
    d * 0.46,
    1.3,
    n / 2 + 0.08
  ]);
  e.mesh(t, "sphere", y.brass, [
    0.07,
    0.07,
    0.05
  ], [
    0.23,
    1.15,
    n / 2 + 0.19
  ]), Es(e, t, a, n, i, r ? 1.15 : 3.2);
  const o = e.group(t, [
    -a * 0.27,
    i,
    -n * 0.18
  ]), c = r ? 2.1 : 3.3;
  if (e.mesh(o, "box", y.stone, [
    1.1,
    c,
    1.2
  ], [
    0,
    c / 2,
    0
  ]), e.mesh(o, "box", y.light, [
    1.4,
    0.3,
    1.5
  ], [
    0,
    c - 0.2,
    0
  ]), e.mesh(o, "box", y.shadow, [
    0.85,
    0.04,
    0.95
  ], [
    0,
    c - 0.03,
    0
  ]), r) {
    const d = e.group(t, [
      0,
      2.9,
      n / 2 + 1
    ]);
    d.rotation.x = 0.19;
    for (let l = -6; l <= 6; l++) e.mesh(d, "box", l % 3 ? y.cloth : y.light, [
      0.74,
      0.04,
      2.3
    ], [
      l * 0.75,
      0,
      0
    ]);
    for (const l of [-1, 1]) e.mesh(t, "box", y.timber, [
      0.09,
      0.12,
      2.1
    ], [
      l * 4.5,
      2.6,
      n / 2 + 0.95
    ]);
    e.mesh(d, "box", y.rose, [
      1,
      0.014,
      0.65
    ], [
      -2.2,
      0.034,
      0.3
    ]);
    for (let l = -3; l <= 3; l++)
      e.mesh(t, "box", y.timber, [
        0.025,
        0.35,
        0.025
      ], [
        l * 0.45 - 3,
        2.5,
        n / 2 + 0.16
      ]), e.mesh(t, "cone", y.leaf, [
        0.17,
        0.6,
        0.15
      ], [
        l * 0.45 - 3,
        2.05,
        n / 2 + 0.16
      ]);
    for (const l of [-a * 0.29, a * 0.29]) e.mesh(t, "box", y.ember, [
      1.35,
      1.15,
      0.015
    ], [
      l,
      2.3,
      n / 2 + 0.151
    ], !0);
    e.mesh(t, "box", y.slate, [
      0.9,
      1.2,
      0.14
    ], [
      2.8,
      2.8,
      n / 2 + 0.25
    ]), e.mesh(t, "cylinder", y.brass, [
      0.21,
      0.47,
      0.06
    ], [
      2.8,
      2.75,
      n / 2 + 0.36
    ]), e.mesh(t, "box", y.brass, [
      0.18,
      0.16,
      0.1
    ], [
      2.8,
      3.08,
      n / 2 + 0.36
    ]);
  } else
    pa(e, t, 0, n / 2 + 0.09, i + 1, 0.9), e.mesh(t, "box", y.timber, [
      a + 0.4,
      0.26,
      0.24
    ], [
      0,
      3.5,
      n / 2 + 0.25
    ]);
}
function Oo(e, t, s) {
  const a = s.height, n = s.footprint.width, r = s.tint === "amber", i = s.tint === "rose", u = r ? y.amber : i ? y.rose : y.leaf, o = r ? y.amberLight : i ? "#dfb2a1" : y.leafLight, c = e.mesh(t, "cylinder", y.timber, [
    0.24,
    a * 0.67,
    0.28
  ], [
    0,
    a * 0.33,
    0
  ]);
  c.rotation.z = 0.06;
  for (let d = 0; d < 3; d++) {
    const l = e.group(t, [
      0,
      a * 0.39,
      0
    ]);
    l.rotation.set(0.4 * Math.sin(d * 2), 0, (d - 1) * 0.65), e.mesh(l, "cylinder", y.timber, [
      0.095,
      a * 0.32,
      0.095
    ], [
      0,
      a * 0.16,
      0
    ]);
  }
  for (let d = 0; d < 9; d++) {
    const l = d * 2.4, h = d === 8 ? 0.1 : n * 0.56, f = e.mesh(t, "crown", d % 3 ? u : o, [
      n * 0.49 + 0.4,
      a * 0.16,
      n * 0.45 + 0.4
    ], [
      Math.sin(l) * h,
      a * (0.68 + d % 3 * 0.11),
      Math.cos(l) * h
    ]);
    f.rotation.set(d * 0.37, d * 0.61, 0.14), f.receiveShadow = !1;
  }
}
function Zo(e, t, s) {
  const { width: a, depth: n } = s.footprint, r = s.height;
  e.mesh(t, "box", y.stone, [
    a,
    r,
    n
  ], [
    0,
    r / 2,
    0
  ]);
  for (const i of [
    1,
    r * 0.55,
    r - 0.6
  ]) e.mesh(t, "box", y.light, [
    a + 0.25,
    0.3,
    n + 0.25
  ], [
    0,
    i,
    0
  ]);
  for (const i of [-a / 2 + 0.3, a / 2 - 0.3]) e.mesh(t, "box", y.mortar, [
    0.55,
    r - 1,
    n + 0.15
  ], [
    i,
    r / 2,
    0
  ]);
  for (const i of [r * 0.35, r * 0.7]) pa(e, t, 0, n / 2 + 0.02, i, 0.7);
  Es(e, t, a + 0.35, n + 0.35, r, r * 0.32), e.mesh(t, "cylinder", y.brass, [
    0.055,
    2.7,
    0.055
  ], [
    0,
    r * 1.32 + 1.2,
    0
  ]), e.shape(t, [
    [0, 0],
    [1.6, -0.3],
    [1.2, -0.75],
    [0, -0.95]
  ], y.cloth, [
    0.05,
    r * 1.32 + 2.4,
    0
  ]);
}
function Uo(e, t, s, a, n) {
  const r = a.footprint, i = e.group(t, [
    r.x,
    0,
    r.z
  ]), u = e.group(s, [
    r.x,
    0,
    r.z
  ]);
  switch (a.kind) {
    case "dwelling":
    case "workshop":
      Po(e, i, u, a);
      break;
    case "stove":
      Eo(e, i);
      break;
    case "medicine":
      Io(e, i, r.width, r.depth);
      break;
    case "cargo":
    case "fuel":
    case "ledger":
      Ao(e, i, a);
      break;
    case "clinic":
    case "storehouse":
      e.mesh(i, "box", y.mortar, [
        r.width,
        0.3,
        r.depth
      ], [
        0,
        0.15,
        0
      ]), jo(e, u, a);
      break;
    case "tree":
      e.mesh(i, "box", y.soil, [
        r.width,
        0.18,
        r.depth
      ], [
        0,
        0.08,
        0
      ]);
      for (let o = 0; o < 7; o++) {
        const c = o * 0.9;
        e.mesh(i, "rock", y.grassDark, [
          0.7,
          0.3,
          0.5
        ], [
          Math.sin(c) * r.width * 0.33,
          0.2,
          Math.cos(c) * r.depth * 0.33
        ]);
      }
      Oo(e, u, a);
      break;
    case "tower":
      Zo(e, u, a);
      break;
    case "column": {
      const o = a.height, c = Math.min(r.width, r.depth) * 0.3;
      e.mesh(i, "box", y.mortar, [
        r.width,
        0.35,
        r.depth
      ], [
        0,
        0.17,
        0
      ]), e.mesh(i, "box", y.light, [
        r.width * 0.84,
        0.35,
        r.depth * 0.84
      ], [
        0,
        0.5,
        0
      ]), e.mesh(u, "cylinder", y.stone, [
        c,
        o - 1.1,
        c
      ], [
        0,
        o / 2,
        0
      ]);
      for (let d = 0; d < 10; d++) {
        const l = d * Math.PI / 5;
        e.mesh(u, "box", y.light, [
          0.085,
          o - 2,
          0.085
        ], [
          Math.sin(l) * c,
          o / 2,
          Math.cos(l) * c
        ]);
      }
      for (const d of [0.85, o - 0.7]) e.mesh(u, "cylinder", y.brass, [
        c * 1.15,
        0.18,
        c * 1.15
      ], [
        0,
        d,
        0
      ]);
      e.mesh(u, "box", y.light, [
        r.width,
        0.4,
        r.depth
      ], [
        0,
        o - 0.3,
        0
      ]), e.mesh(u, "box", y.slate, [
        r.width * 0.9,
        0.3,
        r.depth * 0.9
      ], [
        0,
        o,
        0
      ]);
      break;
    }
    case "beacon":
      e.mesh(i, "box", y.mortar, [
        r.width,
        0.28,
        r.depth
      ], [
        0,
        0.14,
        0
      ]), e.mesh(i, "cylinder", y.stone, [
        2.5,
        0.5,
        2.5
      ], [
        0,
        0.5,
        0
      ]), e.mesh(u, "cylinder", y.slate, [
        1.35,
        3.9,
        1.35
      ], [
        0,
        2.3,
        0
      ]);
      for (const o of [
        1.2,
        3.5,
        4.4
      ]) e.mesh(u, "cylinder", y.brass, [
        1.55,
        0.2,
        1.55
      ], [
        0,
        o,
        0
      ]);
      e.mesh(u, "cylinder", y.shadow, [
        2.2,
        0.5,
        2.2
      ], [
        0,
        4.8,
        0
      ]), e.mesh(u, "torus", y.brass, [
        2.3,
        2.3,
        1.4
      ], [
        0,
        5.1,
        0
      ]).rotation.x = Math.PI / 2;
      for (let o = 0; o < 6; o++) {
        const c = o * Math.PI / 3, d = e.group(u, [
          Math.sin(c) * 2.1,
          4.8,
          Math.cos(c) * 2.1
        ]);
        d.rotation.y = c, e.shape(d, [
          [-0.12, 0],
          [0.12, 0],
          [0.2, 1.8],
          [0, 2.4],
          [-0.2, 1.8]
        ], y.brass, [
          0,
          0,
          0
        ], 0.14);
      }
      break;
    case "bunk":
      To(e, i, r.width, r.depth);
      for (const o of [0.55, 1.9])
        e.mesh(i, "box", y.timber, [
          r.width - 0.5,
          0.18,
          r.depth - 0.5
        ], [
          0,
          o,
          0
        ]), e.mesh(i, "box", y.cloth, [
          r.width - 0.8,
          0.18,
          r.depth - 0.9
        ], [
          0,
          o + 0.16,
          0
        ]), e.mesh(i, "box", y.light, [
          r.width - 1,
          0.24,
          1.2
        ], [
          0,
          o + 0.28,
          -r.depth / 2 + 1.3
        ]);
      for (const o of [-1, 1]) for (const c of [-1, 1]) e.mesh(i, "box", y.shadow, [
        0.12,
        2.7,
        0.12
      ], [
        o * (r.width / 2 - 0.3),
        1.35,
        c * (r.depth / 2 - 0.3)
      ]);
      break;
    case "root": {
      const o = a.height, c = r.width * 0.23;
      e.mesh(i, "rock", y.soil, [
        r.width * 0.5,
        0.65,
        r.depth * 0.5
      ], [
        0,
        0.1,
        0
      ]);
      for (let d = 0; d < 5; d++) {
        const l = d * Math.PI * 0.4, h = r.width * 0.25, f = e.group(u, [
          Math.sin(l) * c * 0.45,
          0,
          Math.cos(l) * c * 0.45
        ]);
        f.rotation.y = l;
        const g = e.mesh(f, "cylinder", d % 2 ? y.root : y.rootLight, [
          c * 0.65,
          o * 0.64,
          c * 0.49
        ], [
          0,
          o * 0.3,
          0
        ]);
        g.rotation.z = 0.13;
        const v = e.group(f, [
          0,
          o * 0.48,
          0
        ]);
        v.rotation.z = 0.4 + d * 0.12, e.mesh(v, "cone", y.root, [
          c * 0.47,
          o * 0.55,
          c * 0.4
        ], [
          0,
          o * 0.25,
          0
        ]);
        const b = e.mesh(f, "cone", y.root, [
          c * 0.5,
          h * 1.4,
          c * 0.4
        ], [
          h * 0.6,
          0.7,
          0
        ]);
        b.rotation.z = -1.15;
      }
      if (o > 8) {
        e.mesh(u, "rock", y.shadow, [
          c * 0.65,
          o * 0.22,
          0.35
        ], [
          0,
          o * 0.38,
          c * 0.65
        ]), e.mesh(u, "rock", y.brass, [
          c * 0.16,
          o * 0.16,
          0.15
        ], [
          0,
          o * 0.4,
          c * 0.68
        ], !0);
        for (let d = 0; d < 7; d++) e.mesh(u, "crown", d % 2 ? y.leaf : y.leafLight, [
          1.4,
          0.8,
          1.2
        ], [
          Math.sin(d * 2) * c,
          o * 0.55 + d * 0.4,
          Math.cos(d * 2) * c
        ]);
      }
      break;
    }
    case "arch": {
      const o = a.height;
      e.mesh(u, "arch", y.light, [
        r.width / 2 - 0.4,
        3.1,
        r.depth * 0.65
      ], [
        0,
        o - 3,
        0
      ]), e.mesh(u, "box", y.brass, [
        0.8,
        1.4,
        r.depth * 0.75
      ], [
        0,
        o + 0.2,
        0
      ]);
      for (const c of [-1, 1]) {
        const d = e.group(u, [
          c * (r.width / 2 - 0.5),
          o - 2.2,
          r.depth / 2 - 0.4
        ]);
        e.mesh(d, "box", y.brass, [
          1.5,
          0.08,
          0.1
        ]), e.shape(d, [
          [-0.6, 0],
          [0.6, 0],
          [0.6, -2.5],
          [0, -2.9],
          [-0.6, -2.5]
        ], y.slate, [
          0,
          -0.05,
          0.06
        ]), e.mesh(d, "box", y.cloth, [
          0.08,
          1.9,
          0.06
        ], [
          0,
          -1.2,
          0.14
        ]);
      }
      break;
    }
    case "wall": {
      const o = a.height, c = Math.min(o, 0.65);
      a.wallUse === "homes" && $o(e, u, r), e.mesh(i, "box", y.mortar, [
        r.width,
        c,
        r.depth
      ], [
        0,
        c / 2,
        0
      ]), o > c && e.mesh(u, "box", n ? y.marble : y.stone, [
        r.width,
        o - c,
        r.depth
      ], [
        0,
        (o + c) / 2,
        0
      ]), e.mesh(u, "box", y.light, [
        r.width + 0.12,
        0.23,
        r.depth + 0.12
      ], [
        0,
        o,
        0
      ]);
      const d = r.width > r.depth, l = Math.max(r.width, r.depth);
      if (n) {
        for (const h of [1.1, o - 0.55]) e.mesh(u, "box", y.light, [
          r.width + 0.15,
          0.22,
          r.depth + 0.15
        ], [
          0,
          h,
          0
        ]);
        for (let h = -l / 2 + 3; h < l / 2 - 1; h += 6) for (const f of [-1, 1]) {
          const g = e.group(u, [
            d ? h : f * (r.width / 2 + 0.04),
            0,
            d ? f * (r.depth / 2 + 0.04) : h
          ]);
          g.rotation.y = d ? f < 0 ? Math.PI : 0 : f * Math.PI / 2;
          const v = o * 0.61, b = Math.min(2.1, o * 0.3);
          e.mesh(g, "box", y.undercroft, [
            1.5,
            b,
            0.05
          ], [
            0,
            v,
            0
          ]);
          for (const x of [
            -0.55,
            0,
            0.55
          ]) e.mesh(g, "box", y.shadow, [
            0.07,
            b,
            0.06
          ], [
            x,
            v,
            0.06
          ]);
          for (const x of [-1, 1]) e.mesh(g, "box", y.light, [
            1.9,
            0.15,
            0.2
          ], [
            0,
            v + x * b / 2,
            0.06
          ]);
          e.mesh(g, "box", y.stone, [
            0.45,
            o - 1,
            0.32
          ], [
            2.2,
            o / 2,
            0
          ]);
        }
        break;
      }
      for (let h = -l / 2 + 1; h < l / 2; h += 3.5) {
        o > 4 && e.mesh(u, "box", y.stone, d ? [
          1.3,
          0.85,
          r.depth
        ] : [
          r.width,
          0.85,
          1.3
        ], [
          d ? h : 0,
          o + 0.55,
          d ? 0 : h
        ]);
        for (let f = 0; f < Math.floor(o / 0.9); f++) e.mesh(u, "box", y.mortar, d ? [
          0.035,
          0.6,
          0.025
        ] : [
          0.025,
          0.6,
          0.035
        ], [
          d ? h + f % 2 * 0.7 : r.width / 2 + 0.01,
          0.55 + f * 0.85,
          d ? r.depth / 2 + 0.01 : h + f % 2 * 0.7
        ]);
      }
      break;
    }
    case "water":
      e.mesh(i, "box", y.water, [
        r.width,
        0.12,
        r.depth
      ], [
        0,
        -0.18,
        0
      ]);
      for (let o = 0; o < r.width * r.depth / 9; o++) {
        const c = Math.sin(o * 7.3) * (r.width / 2 - 0.8), d = Math.cos(o * 3.7) * (r.depth / 2 - 0.3);
        e.mesh(i, "box", y.ripple, [
          0.4 + o % 4 * 0.3,
          0.012,
          0.04
        ], [
          c,
          -0.11,
          d
        ], !0);
      }
      break;
    case "planter":
      e.mesh(i, "box", y.stone, [
        r.width,
        0.55,
        r.depth
      ], [
        0,
        0.275,
        0
      ]), e.mesh(i, "box", y.soil, [
        r.width - 0.35,
        0.1,
        r.depth - 0.35
      ], [
        0,
        0.57,
        0
      ]);
      for (let o = -r.width / 2 + 0.65; o < r.width / 2; o += 1) for (let c = -r.depth / 2 + 0.6; c < r.depth / 2; c += 0.95) {
        const d = Math.sin(o * 7 + c * 19), l = r.width > 8 ? 0.63 : 0.37;
        e.mesh(i, "crown", d > 0.3 ? y.leafLight : y.leaf, [
          l,
          0.32 + d * 0.1,
          l * 0.9
        ], [
          o + d * 0.15,
          0.81,
          c
        ]), d > 0.5 && e.mesh(i, "rock", d > 0.8 ? y.light : y.rose, [
          0.1,
          0.12,
          0.1
        ], [
          o + 0.1,
          1.13,
          c
        ]);
      }
      break;
    case "thicket":
      e.mesh(i, "box", y.soil, [
        r.width,
        0.2,
        r.depth
      ], [
        0,
        0.07,
        0
      ]);
      for (let o = -r.width / 2 + 0.7; o < r.width / 2; o += 1.3) for (let c = -r.depth / 2 + 0.65; c < r.depth / 2; c += 1.25) {
        const d = Math.sin(o * 13 + c * 7), l = 0.6 + d * 0.2;
        e.mesh(i, "crown", d > 0 ? y.leaf : y.leafLight, [
          0.7,
          l,
          0.7
        ], [
          o,
          l * 0.75,
          c
        ]), d > 0.75 && e.mesh(i, "rock", y.amberLight, [
          0.16,
          0.15,
          0.16
        ], [
          o,
          l * 1.65,
          c
        ]);
      }
      break;
    case "wagon":
      e.mesh(i, "box", y.wood, [
        r.width - 1,
        0.35,
        r.depth - 1.2
      ], [
        0,
        1.1,
        0
      ]);
      for (const o of [-1, 1]) {
        for (let c = 0; c < 3; c++) e.mesh(i, "box", y.wood, [
          0.12,
          0.24,
          r.depth - 1
        ], [
          o * (r.width / 2 - 0.5),
          1.4 + c * 0.29,
          0
        ]);
        for (const c of [-r.depth * 0.28, r.depth * 0.28]) {
          if (a.damaged && o < 0 && c > 0) {
            e.mesh(i, "torus", y.shadow, [
              0.7,
              0.7,
              0.7
            ], [
              -r.width / 2 + 0.8,
              0.18,
              c
            ]).rotation.x = Math.PI / 2, e.mesh(i, "box", y.wood, [
              1.1,
              0.1,
              0.1
            ], [
              -r.width / 2 + 0.8,
              0.18,
              c
            ]), e.mesh(i, "box", y.wood, [
              0.1,
              0.1,
              1.1
            ], [
              -r.width / 2 + 0.8,
              0.18,
              c
            ]);
            continue;
          }
          e.mesh(i, "torus", y.shadow, [
            0.7,
            0.7,
            0.7
          ], [
            o * (r.width / 2 - 0.2),
            0.76,
            c
          ]).rotation.y = Math.PI / 2;
          for (let d = 0; d < 4; d++) {
            const l = e.mesh(i, "box", y.wood, [
              0.09,
              1.25,
              0.09
            ], [
              o * (r.width / 2 - 0.2),
              0.76,
              c
            ]);
            l.rotation.x = d * Math.PI / 4;
          }
        }
      }
      e.mesh(i, "box", y.cloth, [
        1.4,
        0.8,
        1.8
      ], [
        0,
        1.7,
        -0.8
      ]), e.mesh(i, "cylinder", y.timber, [
        0.45,
        0.9,
        0.45
      ], [
        0.6,
        1.8,
        1
      ]);
      break;
    case "supplies":
      for (let o = 0; o < 4; o++) {
        const c = e.group(i, [
          o % 2 * 1.5 - 0.75,
          o === 3 ? 1.3 : 0,
          o < 2 ? -0.7 : 0.7
        ]);
        e.mesh(c, "box", y.wood, [
          1.2,
          1.2,
          1.2
        ], [
          0,
          0.6,
          0
        ]);
        for (const d of [-1, 1]) e.mesh(c, "box", y.timber, [
          0.1,
          1.25,
          1.3
        ], [
          d * 0.43,
          0.6,
          0
        ]);
        e.mesh(c, "box", y.light, [
          0.32,
          0.35,
          0.02
        ], [
          0,
          0.7,
          0.62
        ]);
      }
      break;
    case "bench":
      e.mesh(i, "box", y.wood, [
        r.width - 0.3,
        0.18,
        r.depth - 0.2
      ], [
        0,
        0.72,
        0
      ]), e.mesh(i, "box", y.wood, [
        0.13,
        0.75,
        r.depth - 0.2
      ], [
        -r.width / 2 + 0.1,
        1.12,
        0
      ]);
      for (const o of [-1, 1]) e.mesh(i, "box", y.shadow, [
        r.width - 0.5,
        0.7,
        0.22
      ], [
        0,
        0.35,
        o * (r.depth / 2 - 0.5)
      ]);
      break;
    case "ruin":
      e.mesh(i, "box", y.stone, [
        r.width,
        0.5,
        r.depth
      ], [
        0,
        0.25,
        0
      ]);
      for (let o = 0; o < 3; o++) {
        const c = -r.width * 0.3 + o * r.width * 0.3, d = (a.height ?? 3) * (1 - o * 0.22), l = r.width * 0.11;
        e.mesh(u, "cylinder", y.stone, [
          l,
          d,
          l
        ], [
          c,
          d / 2 + 0.3,
          -r.depth * 0.2
        ]), e.mesh(u, "box", y.light, [
          l * 2.6,
          0.25,
          l * 2.6
        ], [
          c,
          d + 0.3,
          -r.depth * 0.2
        ]);
        for (let h = 0; h < 6; h++) {
          const f = h * Math.PI / 3;
          e.mesh(u, "box", y.mortar, [
            0.055,
            d * 0.8,
            0.055
          ], [
            c + Math.sin(f) * l,
            d / 2 + 0.3,
            -r.depth * 0.2 + Math.cos(f) * l
          ]);
        }
      }
      e.mesh(i, "rock", y.grassDark, [
        r.width * 0.4,
        0.3,
        r.depth * 0.3
      ], [
        0,
        0.7,
        r.depth * 0.2
      ]);
      break;
  }
  return u.children.length > 0;
}
var aa = 1e-7;
function Xa(e, t, s) {
  return (t[0] - e[0]) * (s[1] - e[1]) - (t[1] - e[1]) * (s[0] - e[0]);
}
function Un(e, t, s, a) {
  const n = [];
  for (let r = 0; r < e.length; r++) {
    const i = e[r], u = e[(r + 1) % e.length], o = Xa(t, s, i), c = Xa(t, s, u), d = a ? o >= -1e-7 : o <= aa, l = a ? c >= -1e-7 : c <= aa;
    if (d && n.push(i), d !== l && Math.abs(o - c) > aa) {
      const h = o / (o - c);
      n.push([i[0] + (u[0] - i[0]) * h, i[1] + (u[1] - i[1]) * h]);
    }
  }
  return n;
}
function Is(e) {
  return Math.abs(e.reduce((t, s, a) => t + s[0] * e[(a + 1) % e.length][1] - s[1] * e[(a + 1) % e.length][0], 0)) / 2;
}
function No(e, t) {
  let s = e;
  const a = [];
  for (let n = 0; n < t.length && s.length >= 3; n++) {
    const r = t[n], i = t[(n + 1) % t.length], u = Un(s, r, i, !1);
    Is(u) > aa && a.push(u), s = Un(s, r, i, !0);
  }
  return a;
}
function Do(e, t, s) {
  const a = t[0] - e[0], n = t[1] - e[1], r = s / (2 * Math.hypot(a, n)), i = -n * r, u = a * r;
  return [
    [e[0] + i, e[1] + u],
    [e[0] - i, e[1] - u],
    [t[0] - i, t[1] - u],
    [t[0] + i, t[1] + u]
  ];
}
function Ls(e, t) {
  const s = [];
  for (const a of e) {
    for (let n = 1; n < a.points.length; n++) s.push(Do(a.points[n - 1], a.points[n], a.width + t));
    for (const [n, r] of a.points.slice(1, -1)) s.push(Array.from({ length: 12 }, (i, u) => {
      const o = u * Math.PI / 6, c = (a.width + t) / 2;
      return [n + Math.cos(o) * c, r + Math.sin(o) * c];
    }));
  }
  return s;
}
function Fo(e, t = 0) {
  const s = Ls(e, t), a = [];
  for (let n = 0; n < s.length; n++) {
    let r = [s[n]];
    for (let i = 0; i < n && r.length; i++) r = r.flatMap((u) => No(u, s[i]));
    a.push(...r.filter((i) => Is(i) > aa));
  }
  return a;
}
function Bo(e, t, s, a) {
  const n = s === "marble", r = s === "street";
  for (const [o, c, d] of [[
    0.4,
    0.025,
    n ? y.brass : r ? y.streetSeam : y.mortar
  ], [
    0,
    0.04,
    n ? y.slate : r ? y.streetStone : y.stone
  ]]) for (const l of Fo(t, o)) {
    const h = l.reduce((v, b) => v + b[0], 0) / l.length, f = l.reduce((v, b) => v + b[1], 0) / l.length, g = e.shape(a(h, f), l.map((v) => [v[0], -v[1]]), d, [
      0,
      c,
      0
    ]);
    g.rotation.x = -Math.PI / 2, g.castShadow = !1;
  }
  const i = Ls(t, 0.4);
  let u = 0;
  for (const o of t) {
    for (let c = 1; c < o.points.length; c++, u++) {
      const d = o.points[c - 1], l = o.points[c], h = l[0] - d[0], f = l[1] - d[1], g = Math.hypot(h, f);
      for (let v = 1.5; v < g; v += 1.65) {
        const b = d[0] + h * v / g, x = d[1] + f * v / g;
        if (i.some((p, w) => w !== u && p.every((M, S) => Xa(M, p[(S + 1) % p.length], [b, x]) >= -1e-7))) continue;
        const _ = e.mesh(a(b, x), "box", n ? y.shadow : r ? y.streetSeam : y.mortar, [
          o.width - 0.08,
          0.012,
          0.025
        ], [
          b,
          0.049,
          x
        ]);
        if (_.rotation.y = Math.atan2(h, f), _.castShadow = !1, r) {
          const p = e.mesh(a(b, x), "box", y.streetSeam, [
            0.025,
            0.012,
            1.4
          ], [
            b + Math.cos(v) * 0.55,
            0.049,
            x
          ]);
          p.rotation.y = Math.atan2(h, f), p.castShadow = !1;
        }
      }
    }
    u += o.points.length - 2;
  }
}
function qo(e, t) {
  const s = e.x - e.width / 2, a = s + e.width, n = e.z - e.depth / 2, r = n + e.depth, i = Math.max(s, t.x - t.width / 2), u = Math.min(a, t.x + t.width / 2), o = Math.max(n, t.z - t.depth / 2), c = Math.min(r, t.z + t.depth / 2);
  return i >= u || o >= c ? [e] : [
    [
      s,
      n,
      a,
      o
    ],
    [
      s,
      c,
      a,
      r
    ],
    [
      s,
      o,
      i,
      c
    ],
    [
      u,
      o,
      a,
      c
    ]
  ].filter(([d, l, h, f]) => h > d && f > l).map(([d, l, h, f]) => ({
    x: (d + h) / 2,
    z: (l + f) / 2,
    width: h - d,
    depth: f - l
  }));
}
function Nn(e, t, s) {
  const a = s[0] - t[0], n = s[1] - t[1], r = Math.max(0, Math.min(1, ((e.x - t[0]) * a + (e.y - t[1]) * n) / (a * a + n * n)));
  return Math.hypot(e.x - t[0] - a * r, e.y - t[1] - n * r);
}
function Wo(e, t, s) {
  const a = [], n = /* @__PURE__ */ new Map(), r = [], i = new er(), u = new rt(), o = new or(), c = [];
  function d(p, w) {
    const M = `${Math.floor(p / 16)}:${Math.floor(w / 16)}`;
    let S = n.get(M);
    return S || (S = e.group(t), n.set(M, S)), S;
  }
  let l = [s.bounds];
  for (const p of s.features.filter((w) => w.kind === "water")) l = l.flatMap((w) => qo(w, p.footprint));
  const h = s.surface === "grass", f = s.surface === "marble", g = s.surface === "street", v = h ? y.grass : g ? y.street : s.surface === "wet" ? y.wetStone : f ? y.marble : y.stone;
  for (const p of l)
    if (e.mesh(d(p.x, p.z), "box", v, [
      p.width,
      0.6,
      p.depth
    ], [
      p.x,
      -0.32,
      p.z
    ]).castShadow = !1, !h && !g) for (let w = p.x - p.width / 2; w < p.x + p.width / 2; w += 4) for (let M = p.z - p.depth / 2; M < p.z + p.depth / 2; M += 4) {
      const S = Math.min(4, p.x + p.width / 2 - w), I = Math.min(4, p.z + p.depth / 2 - M), A = f ? Math.round(w / 4 + M / 4) % 2 ? y.marble : y.marbleLight : v;
      e.mesh(d(w, M), "box", A, [
        S - 0.04,
        0.018,
        I - 0.04
      ], [
        w + S / 2,
        -9e-3,
        M + I / 2
      ]).castShadow = !1;
    }
  if (Bo(e, s.roads, s.surface, d), g) for (let p = 0; p < 320; p++) {
    const w = s.bounds.x + Math.sin(p * 127.13) * (s.bounds.width / 2 - 3), M = s.bounds.z + Math.cos(p * 53.71) * (s.bounds.depth / 2 - 3), S = {
      x: w,
      y: M
    };
    if (s.features.some((L) => Wa(S, L.footprint))) continue;
    const I = Math.min(...s.roads.flatMap((L) => L.points.slice(1).map(($, O) => Nn(S, L.points[O], $))));
    if (I < 2 || I > 9) continue;
    const A = e.mesh(d(w, M), "box", p % 3 ? y.streetSeam : y.streetStone, [
      0.4 + p % 3 * 0.18,
      0.025,
      0.25
    ], [
      w,
      -2e-3,
      M
    ]);
    A.rotation.y = p * 0.41, A.castShadow = !1;
  }
  if (f) {
    const p = d(0, -17);
    for (const w of [
      4,
      4.4,
      5.5
    ]) e.ring(p, y.brass, w, 0, -17, 1, !1, 0.09);
    for (let w = 0; w < 12; w++) {
      const M = w * Math.PI / 6;
      e.shape(p, [
        [0, 0],
        [0.35, 0.7],
        [0, 2.5],
        [-0.35, 0.7]
      ], y.brass, [
        Math.sin(M) * 4.6,
        0.095,
        -17 + Math.cos(M) * 4.6
      ]).rotation.set(-Math.PI / 2, 0, M);
    }
  }
  for (const p of s.suspended ?? []) {
    const w = e.group(t);
    Lo(e, w, p), a.push(e.bake(w)), r.push({
      root: w,
      bounds: new ma().setFromObject(w).expandByScalar(0.1)
    });
  }
  const { bounds: b } = s;
  for (let p = 0; p < (h ? 420 : 0); p++) {
    const w = b.x + Math.sin(p * 127.13) * (b.width / 2 - 3), M = b.z + Math.cos(p * 53.71) * (b.depth / 2 - 3), S = {
      x: w,
      y: M
    };
    if (s.features.some((A) => Wa(S, {
      ...A.footprint,
      width: A.footprint.width + 1.5,
      depth: A.footprint.depth + 1.5
    })) || s.roads.some((A) => A.points.slice(1).some((L, $) => Nn(S, A.points[$], L) < A.width / 2 + 1))) continue;
    const I = d(w, M);
    if (p % 4 === 0) {
      const A = Array.from({ length: 9 }, ($, O) => {
        const T = O * Math.PI * 2 / 9, V = 1 + Math.sin(O * 7 + p) * 0.3;
        return [Math.cos(T) * V * (1.2 + p % 3), Math.sin(T) * V * (0.7 + p % 2)];
      }), L = e.shape(I, A, p % 8 ? y.grassDark : y.grassLight, [
        w,
        5e-3,
        M
      ]);
      L.rotation.x = -Math.PI / 2;
    } else {
      for (let A = 0; A < 3; A++) {
        const L = e.mesh(I, "cone", p % 3 ? y.grassDark : y.leafLight, [
          0.035,
          0.3 + A * 0.09,
          0.035
        ], [
          w + (A - 1) * 0.16,
          0.15,
          M
        ]);
        L.rotation.z = (A - 1) * 0.35;
      }
      p % 11 === 0 && e.mesh(I, "rock", y.light, [
        0.12,
        0.13,
        0.12
      ], [
        w,
        0.38,
        M
      ]);
    }
  }
  for (const p of s.features) {
    const w = p.footprint, M = w.width > w.depth, S = Math.max(w.width, w.depth), I = p.kind === "wall" ? Math.ceil(S / 7) : 1, A = e.group(t);
    A.name = p.id;
    for (let L = 0; L < I; L++) {
      const $ = -S / 2 + (L + 0.5) * S / I, O = I === 1 ? w : {
        ...w,
        x: w.x + (M ? $ : 0),
        z: w.z + (M ? 0 : $),
        width: M ? S / I : w.width,
        depth: M ? w.depth : S / I
      }, T = I === 1 ? A : e.group(A);
      Uo(e, d(O.x, O.z), T, {
        ...p,
        footprint: O
      }, s.vista === "interior") ? (a.push(e.bake(T)), r.push({
        root: T,
        bounds: new ma().setFromObject(T).expandByScalar(0.35)
      })) : T.removeFromParent();
    }
  }
  for (const p of s.roads.slice(0, 1)) for (let w = 1; w < p.points.length; w++) {
    const [M, S] = p.points[w];
    if (!(s.vista === "camp" && Math.hypot(M, S - 8) < 13))
      for (const I of [-1, 1]) $s(e, d(M, S), M + I * (p.width / 2 + 0.6), S);
  }
  const x = e.group(t), _ = s.vista === "interior";
  if (e.mesh(x, "box", _ ? y.undercroft : y.distantGround, [
    300,
    8,
    300
  ], [
    0,
    -4.65,
    0
  ]).castShadow = !1, s.vista === "camp") for (let p = 0; p < 13; p++) {
    const w = -55 - p % 2 * 6, M = -44 + p * 7, S = 7 + p % 3 * 2;
    e.mesh(x, "box", y.distantWall, [
      10,
      S,
      6.5
    ], [
      w,
      S / 2,
      M
    ]);
    const I = e.mesh(x, "box", y.distantRoof, [
      11,
      0.28,
      7.5
    ], [
      w,
      S,
      M
    ]);
    I.rotation.z = -0.16;
    for (let A = -1; A <= 1; A++) e.mesh(x, "box", p % 4 ? y.shadow : y.ember, [
      0.05,
      0.7,
      0.6
    ], [
      w + 5.03,
      S - 1.7,
      M + A * 1.6
    ], p % 4 === 0);
  }
  for (let p = 0; p < (_ ? 0 : 12); p++) {
    const w = (p % 2 ? 1 : -1) * (b.width / 2 + 15 + p % 3 * 8), M = b.z - 25 + p * 7;
    e.mesh(x, "crown", p % 3 ? y.distantGround : y.distantLeaf, [
      17 + p % 4 * 3,
      6 + p % 3 * 2,
      22
    ], [
      w,
      -3,
      M
    ]);
  }
  for (let p = 0; p < (_ || s.vista === "garden" ? 0 : 9); p++) {
    const w = (p - 4) * 12, M = b.z - b.depth / 2 - 15 - p % 3 * 6, S = 9 + p % 4 * 3;
    e.mesh(x, "box", y.distantWall, [
      9,
      S,
      9
    ], [
      w,
      S / 2 - 2,
      M
    ]), e.mesh(x, "cone", y.distantRoof, [
      7,
      6,
      7
    ], [
      w,
      S + 1,
      M
    ]);
    for (let I = -1; I <= 1; I++) e.mesh(x, "box", y.distantGround, [
      0.8,
      2.5,
      0.08
    ], [
      w + I * 2.2,
      S - 4,
      M + 4.55
    ]);
  }
  if (!_ && s.vista !== "garden") {
    const p = b.z - b.depth / 2 - 28;
    e.mesh(x, "cylinder", y.distantWall, [
      9,
      36,
      9
    ], [
      -17,
      17,
      p
    ]);
    for (const w of [
      10,
      22,
      33
    ]) e.mesh(x, "cylinder", y.distantRoof, [
      10,
      1.2,
      10
    ], [
      -17,
      w,
      p
    ]);
    for (let w = 0; w < 6; w++) {
      const M = w * Math.PI / 3, S = -17 + Math.sin(M) * 8.8, I = p + Math.cos(M) * 8.8;
      e.mesh(x, "box", y.distantRoof, [
        1.4,
        40,
        1.4
      ], [
        S,
        19,
        I
      ]);
      const A = e.mesh(x, "box", y.ember, [
        1,
        7,
        0.12
      ], [
        -17 + Math.sin(M) * 9.02,
        26,
        p + Math.cos(M) * 9.02
      ], !0);
      A.rotation.y = M;
    }
    e.mesh(x, "cylinder", y.distantWall, [
      4.2,
      15,
      4.2
    ], [
      -17,
      42,
      p
    ]), e.mesh(x, "cone", y.distantRoof, [
      5,
      7,
      5
    ], [
      -17,
      53,
      p
    ]);
  }
  a.push(e.bake(x));
  for (const p of n.values()) a.push(e.bake(p));
  return {
    update(p, w) {
      i.direction.copy(u.set(Math.sin(w), at.height / at.distance, Math.cos(w)).normalize());
      for (const M of r) {
        c.length = 0;
        for (const S of [0.1, 1.6])
          if (i.origin.set(p.x, S, p.y), o.ray.copy(i), i.intersectsBox(M.bounds) && o.intersectObject(M.root, !0, c), c.length) break;
        M.root.visible = c.length === 0;
      }
    },
    dispose() {
      a.forEach((p) => p()), t.clear();
    }
  };
}
function Ho(e, t, s, a, n, r, i = !0) {
  const u = r.has("captives_arrived"), o = e.group(t, [
    a,
    0,
    n
  ]), c = e.group(t), d = s === "sanniang", l = s === "laobai", h = s === "kouzi";
  o.rotation.y = d ? 0.25 : -0.35, i && (h || s === "anian") && (o.position.y = -0.3), o.scale.setScalar(l ? 1.24 : h ? 1.06 : s === "anian" ? 1.19 : 1.12);
  const f = d ? "#343d59" : l ? "#596a80" : h ? "#53617a" : "#79647d", g = "#615047", v = "#dfbaa0", b = l ? 0.39 : h ? 0.25 : 0.29, x = l ? 0.31 : 0.23, _ = [];
  for (const F of [-1, 1]) {
    const U = e.group(o, [
      F * 0.16,
      0.78,
      F > 0 ? 0.03 : -0.04
    ]);
    U.rotation.x = i && (h || s === "anian") ? -1.15 : F * 0.06, _.push(U), e.mesh(U, "cylinder", "#48545d", [
      0.115,
      0.61,
      0.12
    ], [
      0,
      -0.28,
      0
    ]), e.mesh(U, "cylinder", g, [
      0.135,
      0.37,
      0.14
    ], [
      0,
      -0.53,
      0
    ]), e.mesh(U, "sphere", g, [
      0.14,
      0.12,
      0.23
    ], [
      0,
      -0.69,
      0.08
    ]);
  }
  e.mesh(o, "sphere", f, [
    b,
    0.46,
    0.22
  ], [
    0,
    1.24,
    0
  ]), e.mesh(o, "cylinder", f, [
    x,
    0.34,
    0.21
  ], [
    0,
    0.92,
    0
  ]), e.mesh(o, "cylinder", g, [
    x + 0.015,
    0.08,
    0.23
  ], [
    0,
    1.01,
    0
  ]), e.mesh(o, "box", "#c6aa72", [
    0.13,
    0.11,
    0.03
  ], [
    0,
    1.01,
    0.244
  ]), e.mesh(o, "cylinder", v, [
    0.095,
    0.2,
    0.1
  ], [
    0,
    1.68,
    0
  ]);
  const p = e.group(o, [
    0,
    1.93,
    0.025
  ]);
  p.rotation.x = d ? 0.1 : -0.025, e.mesh(p, "sphere", v, [
    0.215,
    0.285,
    0.22
  ]);
  const w = d ? "#272b42" : h ? "#643d41" : s === "anian" ? "#483b40" : "#30343e";
  e.mesh(p, "sphere", w, [
    0.23,
    0.18,
    0.23
  ], [
    0,
    0.16,
    -0.025
  ]);
  for (const F of [-1, 1])
    e.mesh(p, "sphere", w, [
      0.045,
      0.17,
      0.095
    ], [
      F * 0.2,
      0.02,
      -0.03
    ]), e.mesh(p, "sphere", "#303b3b", [
      0.026,
      0.033,
      0.013
    ], [
      F * 0.083,
      0.025,
      0.216
    ]), e.mesh(p, "box", w, [
      0.069,
      0.018,
      0.016
    ], [
      F * 0.086,
      0.093,
      0.219
    ]), e.mesh(p, "sphere", v, [
      0.036,
      0.062,
      0.045
    ], [
      F * 0.212,
      -0.025,
      0
    ]);
  e.mesh(p, "sphere", v, [
    0.035,
    0.05,
    0.045
  ], [
    0,
    -0.025,
    0.223
  ]), e.mesh(p, "box", "#b47f70", [
    0.06,
    0.012,
    0.014
  ], [
    0,
    -0.126,
    0.194
  ]);
  for (const F of [-1, 1]) {
    const U = e.group(o, [
      F * b,
      1.48,
      0
    ]);
    U.rotation.z = F * 0.11, U.rotation.x = d ? F > 0 ? -0.85 : -0.2 : F > 0 ? -0.4 : -0.1, e.mesh(U, "cylinder", f, [
      0.11,
      0.39,
      0.12
    ], [
      0,
      -0.17,
      0
    ]), e.mesh(U, "cylinder", d ? "#e8e1cc" : "#80969d", [
      0.12,
      0.14,
      0.13
    ], [
      0,
      -0.39,
      0
    ]), e.mesh(U, "cylinder", v, [
      0.076,
      0.22,
      0.085
    ], [
      0,
      -0.51,
      0
    ]), e.mesh(U, "sphere", v, [
      0.09,
      0.105,
      0.075
    ], [
      0,
      -0.65,
      0
    ]), d && F > 0 && (e.mesh(U, "cylinder", "#b67e3f", [
      0.073,
      0.21,
      0.073
    ], [
      0,
      -0.68,
      0.1
    ]), e.mesh(U, "cylinder", "#dbc8a2", [
      0.045,
      0.055,
      0.045
    ], [
      0,
      -0.55,
      0.1
    ]));
  }
  if (d) {
    e.mesh(o, "cylinder", f, [
      0.125,
      0.23,
      0.12
    ], [
      0,
      1.66,
      0
    ]), e.shape(o, [
      [-0.21, 0.36],
      [0.21, 0.36],
      [0.3, -0.36],
      [-0.3, -0.36]
    ], "#eee7d3", [
      0,
      1.02,
      0.238
    ], 0.014), e.mesh(o, "box", "#d0c4a4", [
      0.18,
      0.17,
      0.025
    ], [
      0.07,
      0.85,
      0.276
    ]);
    for (const F of [-1, 1]) {
      const U = e.mesh(o, "box", "#eee7d3", [
        0.052,
        0.53,
        0.025
      ], [
        F * 0.16,
        1.39,
        0.19
      ]);
      U.rotation.z = -F * 0.15;
    }
    e.mesh(p, "sphere", w, [
      0.19,
      0.17,
      0.13
    ], [
      0.09,
      -0.03,
      -0.22
    ]), e.mesh(p, "cylinder", "#dfba7a", [
      0.014,
      0.38,
      0.014
    ], [
      0.12,
      0.03,
      -0.26
    ]).rotation.z = 1.2, e.mesh(o, "cone", f, [
      0.4,
      0.85,
      0.32
    ], [
      0,
      0.66,
      0
    ]), e.mesh(o, "cylinder", "#803f4e", [
      0.27,
      0.075,
      0.245
    ], [
      0,
      1.01,
      0
    ]), e.shape(o, [
      [-0.35, 0.2],
      [0.35, 0.2],
      [0.43, -0.22],
      [-0.43, -0.22]
    ], f, [
      0,
      1.43,
      -0.23
    ], 0.018), e.mesh(o, "box", g, [
      0.24,
      0.28,
      0.17
    ], [
      -0.31,
      0.9,
      -0.05
    ]);
  } else if (l) {
    e.mesh(o, "sphere", f, [
      0.34,
      0.35,
      0.2
    ], [
      0,
      1.17,
      0.1
    ]), e.shape(o, [
      [-0.41, 0.34],
      [0.41, 0.34],
      [0.49, -0.58],
      [0.18, -0.7],
      [-0.35, -0.57]
    ], "#627a92", [
      0,
      1.18,
      -0.26
    ], 0.025), e.mesh(o, "box", "#aeb7b6", [
      0.44,
      0.14,
      0.11
    ], [
      0,
      1.62,
      0.19
    ]);
    const F = e.group(o, [
      -0.36,
      1.1,
      0.2
    ]);
    F.rotation.z = -0.18, e.mesh(F, "box", "#7a624b", [
      0.32,
      0.42,
      0.075
    ]), e.mesh(F, "box", "#e4dfcd", [
      0.27,
      0.36,
      0.025
    ], [
      0,
      0,
      0.047
    ]), e.mesh(o, "cylinder", "#e4dfcd", [
      0.13,
      0.25,
      0.14
    ], [
      0.16,
      0.36,
      0.06
    ]);
  } else if (h) {
    if (e.mesh(o, "cylinder", "#b48859", [
      0.18,
      0.17,
      0.17
    ], [
      0,
      1.65,
      0
    ]), e.mesh(o, "box", "#b48859", [
      0.17,
      0.38,
      0.04
    ], [
      0.08,
      1.42,
      0.24
    ]), e.mesh(o, "cylinder", "#74869e", [
      0.025,
      0.48,
      0.025
    ], [
      -0.36,
      0.67,
      0.18
    ]), e.mesh(o, "box", "#74869e", [
      0.13,
      0.11,
      0.055
    ], [
      -0.36,
      0.92,
      0.18
    ]), u && i) {
      o.position.y = 0.5;
      const F = e.mesh(c, "cylinder", "#849b95", [
        0.24,
        2.4,
        0.24
      ], [
        a,
        0.72,
        n
      ]);
      F.rotation.z = Math.PI / 2;
      for (const U of [-1, 1]) e.mesh(c, "box", "#637b7c", [
        0.2,
        0.7,
        0.6
      ], [
        a + U * 0.8,
        0.35,
        n
      ]);
    }
    e.mesh(o, "box", "#e7dbc4", [
      0.28,
      0.22,
      0.23
    ], [
      0.16,
      0.53,
      0.03
    ]), e.mesh(o, "box", "#6f5540", [
      0.24,
      0.21,
      0.15
    ], [
      -0.3,
      1,
      0.12
    ]), r.has("supplies_secured") && e.mesh(o, "cylinder", "#8caaa7", [
      0.035,
      0.44,
      0.035
    ], [
      -0.32,
      1.11,
      0.22
    ]), e.mesh(o, "box", "#6b5944", [
      0.52,
      0.43,
      0.03
    ], [
      0,
      1.29,
      0.24
    ]);
  } else {
    e.mesh(o, "cone", f, [
      0.36,
      1.05,
      0.28
    ], [
      0,
      0.67,
      0
    ]), e.mesh(p, "sphere", w, [
      0.22,
      0.48,
      0.16
    ], [
      0,
      -0.26,
      -0.17
    ]);
    for (let U = 0; U < 3; U++) {
      const H = e.mesh(o, "box", "#ded3b5", [
        0.29,
        0.34,
        0.018
      ], [
        -0.12 + U * 0.02,
        1.02,
        0.31 + U * 0.023
      ]);
      H.rotation.z = U * 0.1;
    }
    const F = e.mesh(o, "box", "#d8ba87", [
      0.075,
      0.83,
      0.04
    ], [
      0,
      1.25,
      0.22
    ]);
    F.rotation.z = -0.55, e.mesh(o, "box", g, [
      0.42,
      0.44,
      0.21
    ], [
      0.21,
      0.91,
      -0.28
    ]);
  }
  const M = e.ring(t, "#e8c77b", 0.75, a, n, 0.8);
  p.removeFromParent(), _.forEach((F) => F.removeFromParent());
  const S = _.map((F) => e.bake(F)), I = e.bake(o), A = e.bake(p), L = e.bake(c);
  o.add(p, ..._);
  const $ = o.position.y, O = o.rotation.y, T = {
    x: a,
    y: n
  };
  let V = -1 / 0, ee = 0;
  return {
    root: o,
    ring: M,
    id: s,
    position: T,
    seated: i,
    locate(F, U) {
      const H = T.x !== F.position.x || T.y !== F.position.y;
      return H && (V = U), ee = F.facing, T.x = F.position.x, T.y = F.position.y, o.position.x = T.x, o.position.z = T.y, M.position.x = T.x, M.position.z = T.y, H;
    },
    update(F, U, H) {
      const ie = U - V < 120, ot = Math.hypot(F.x - T.x, F.y - T.y) < 10;
      M.visible = ot;
      const Me = ie ? Math.PI / 2 - ee : ot ? Math.atan2(F.x - T.x, F.y - T.y) : O, le = Math.atan2(Math.sin(Me - o.rotation.y), Math.cos(Me - o.rotation.y));
      o.rotation.y += H ? le : le * 0.16, o.position.y = $ + (H ? 0 : Math.sin(U * 15e-4 + a) * 0.012), p.rotation.y = H ? 0 : Math.sin(U * 8e-4 + n) * 0.04, i || _.forEach((we, Je) => {
        we.rotation.x = H || !ie ? 0 : Math.sin(U * 0.012 + Je * Math.PI) * 0.45;
      });
    },
    dispose() {
      I(), A(), L(), S.forEach((F) => F()), o.removeFromParent(), c.removeFromParent(), M.removeFromParent();
    }
  };
}
function Vo(e, t, s, a) {
  const n = e.group(t), r = Gt[s.id], i = Object.values(Ne).find((l) => l.scene === s.id);
  let u = a, o = !1;
  const c = (r?.waves[0] ?? []).map((l) => {
    const h = hn(e, n, l.kind, za[0]);
    h.bar.removeFromParent();
    const f = s.anchors[l.anchor], g = i?.sentryExits[l.anchor], v = g ? s.anchors[g] : f, b = a.has(r.complete) ? v : f;
    return h.root.position.set(b.x, 0, b.y), {
      ...h,
      home: f,
      aside: v,
      dispose: e.bake(h.root)
    };
  }), d = () => {
    n.visible = !o && !!r && (!!i || !u.has(r.complete));
  };
  return d(), {
    setFacts(l) {
      u = l, d();
    },
    setEncounterActive(l) {
      o = l, d();
    },
    animate(l) {
      if (!n.visible) return !1;
      let h = !1;
      for (const f of c) {
        const g = u.has(r.complete) ? f.aside : f.home, v = g.x - f.root.position.x, b = g.y - f.root.position.z, x = Math.hypot(v, b);
        if (x < 1e-3) continue;
        const _ = l ? 1 : Math.min(1, 0.36 / x);
        f.root.position.x += v * _, f.root.position.z += b * _, f.root.rotation.y = x > 0.4 ? Math.atan2(v, b) : 0, h = !0;
      }
      return h;
    },
    dispose() {
      c.forEach((l) => l.dispose()), n.removeFromParent();
    }
  };
}
function Go(e, t, s, a) {
  const n = Ne[s], r = hn(e, t, n.kind, za[0]);
  r.bar.removeFromParent();
  const i = e.bake(r.root), u = { ...ba(s, a) };
  r.root.position.set(u.x, 0, u.y);
  let o = a;
  return {
    id: s,
    root: r.root,
    position: u,
    setFacts(c) {
      o = c;
    },
    update(c, d) {
      const l = ba(s, o), h = c.x - l.x, f = c.y - l.y, g = Math.hypot(h, f), v = g <= n.approachRadius, b = v && !o.has(n.complete) ? 1 : 0, x = l.x + (g ? h / g * b : 0), _ = l.y + (g ? f / g * b : 0), p = u.x + u.y + r.root.rotation.y;
      u.x += d ? x - u.x : (x - u.x) * 0.22, u.y += d ? _ - u.y : (_ - u.y) * 0.22, Math.abs(x - u.x) + Math.abs(_ - u.y) < 0.01 && (u.x = x, u.y = _);
      const w = v ? Math.atan2(h, f) : 0, M = Math.atan2(Math.sin(w - r.root.rotation.y), Math.cos(w - r.root.rotation.y));
      return r.root.rotation.y += d || Math.abs(M) < 5e-3 ? M : M * 0.2, r.root.position.set(u.x, 0, u.y), p !== u.x + u.y + r.root.rotation.y;
    },
    dispose() {
      i(), r.root.removeFromParent();
    }
  };
}
var Te = (e, t, s, a = Math.PI) => ({
  position: {
    x: e,
    y: t
  },
  wait: s,
  facing: a
}), Yo = { camp: [
  {
    id: "mender",
    activity: "mend",
    coat: "rose",
    phase: 0,
    route: [Te(-12, 23.2, 0)]
  },
  {
    id: "patient",
    activity: "warm",
    coat: "blue",
    phase: 1.3,
    route: [Te(-21, 12.5, 0, -0.4)]
  },
  {
    id: "helper",
    activity: "dressings",
    coat: "cream",
    phase: 2.7,
    route: [Te(-24, 11.9, 0, -0.8)]
  },
  {
    id: "stove-tender",
    activity: "cook",
    coat: "blue",
    phase: 0.7,
    route: [Te(-2.8, 6, 0, Math.PI / 2)]
  },
  {
    id: "water-carrier",
    activity: "water",
    coat: "cream",
    phase: 3,
    route: [
      Te(-31, 18, 6, -Math.PI / 2),
      Te(-27, 16, 0),
      Te(-23, 13, 7, Math.PI),
      Te(-27, 16, 0)
    ]
  },
  {
    id: "delivery",
    activity: "deliver",
    coat: "rose",
    phase: 12,
    route: [
      Te(10, 7, 6),
      Te(5, 10, 0),
      Te(-8, 13, 0),
      Te(-18, 14, 8, Math.PI),
      Te(-8, 13, 0),
      Te(5, 10, 0)
    ]
  }
] }, Qo = 0.85;
function Dn(e, t) {
  const s = e.route;
  if (s.length === 1) return {
    position: s[0].position,
    facing: s[0].facing,
    walking: !1
  };
  const a = s.map((r, i) => {
    const u = s[(i + 1) % s.length].position;
    return r.wait + Math.hypot(u.x - r.position.x, u.y - r.position.y) / Qo;
  });
  let n = (t + e.phase) % a.reduce((r, i) => r + i, 0);
  for (let r = 0; r < s.length; r++) {
    if (n > a[r]) {
      n -= a[r];
      continue;
    }
    const i = s[r], u = s[(r + 1) % s.length].position;
    if (n <= i.wait) return {
      position: i.position,
      facing: i.facing,
      walking: !1
    };
    const o = (n - i.wait) / (a[r] - i.wait);
    return {
      position: {
        x: i.position.x + (u.x - i.position.x) * o,
        y: i.position.y + (u.y - i.position.y) * o
      },
      facing: Math.atan2(u.x - i.position.x, u.y - i.position.y),
      walking: !0
    };
  }
  throw new Error("expedition_local_route_invalid");
}
function Ko(e, t) {
  return e === null ? 0 : Math.min(0.1, Math.max(0, (t - e) / 1e3));
}
function Xo(e, t) {
  e.updateWorldMatrix(!0, !0);
  const s = e.matrixWorld.clone().invert(), a = new Jn(), n = [];
  e.traverse((u) => {
    if (!(u instanceof dt)) return;
    const o = (u.geometry.index ? u.geometry.toNonIndexed() : u.geometry.clone()).applyMatrix4(a.multiplyMatrices(s, u.matrixWorld)), c = u.material.color, d = new ir(new Float32Array(o.getAttribute("position").count * 3), 3);
    for (let l = 0; l < d.count; l++) d.setXYZ(l, c.r, c.g, c.b);
    o.setAttribute("color", d), n.push(o);
  });
  const r = ss(n);
  if (n.forEach((u) => u.dispose()), !r) throw new Error("expedition_geometry_merge");
  e.clear();
  const i = new dt(r, t);
  return i.receiveShadow = !0, e.add(i), () => {
    r.dispose(), e.clear();
  };
}
function Jo(e, t, s, a) {
  const n = e.group(t), r = e.group(n), i = [], u = [], o = {
    blue: y.slate,
    rose: y.rose,
    cream: y.cloth
  }[s.coat], c = s.activity === "mend" || s.activity === "warm", d = "#dfbda7", l = c ? 0.75 : 1.05;
  e.mesh(r, "box", o, [
    0.59,
    0.68,
    0.38
  ], [
    0,
    l,
    0
  ]), e.mesh(r, "crown", d, [
    0.23,
    0.27,
    0.21
  ], [
    0,
    l + 0.61,
    0
  ]), e.mesh(r, "crown", y.timber, [
    0.245,
    0.17,
    0.225
  ], [
    0,
    l + 0.77,
    -0.02
  ]), e.mesh(r, "box", y.wood, [
    0.62,
    0.055,
    0.41
  ], [
    0,
    l - 0.23,
    0
  ]), e.mesh(r, "box", y.cloth, [
    0.26,
    0.35,
    0.04
  ], [
    0,
    l + 0.12,
    0.21
  ]);
  for (const f of [-1, 1]) {
    const g = e.group(n, [
      f * 0.36,
      l + 0.22,
      0
    ]);
    i.push(g), e.mesh(g, "box", o, [
      0.17,
      0.44,
      0.19
    ], [
      0,
      -0.2,
      0
    ]), e.mesh(g, "crown", d, [
      0.1,
      0.11,
      0.1
    ], [
      0,
      -0.46,
      0.02
    ]);
    const v = e.group(n, [
      f * 0.16,
      l - 0.31,
      0
    ]);
    u.push(v), e.mesh(v, "box", y.timber, [
      0.2,
      c ? 0.3 : 0.59,
      0.22
    ], [
      0,
      c ? -0.12 : -0.26,
      c ? 0.2 : 0
    ]), e.mesh(v, "box", y.shadow, [
      0.22,
      0.16,
      0.34
    ], [
      0,
      c ? -0.34 : -0.56,
      0.07
    ]);
  }
  if (c && e.mesh(r, "box", y.wood, [
    0.62,
    0.55,
    0.6
  ], [
    0,
    0.275,
    -0.12
  ]), s.activity === "water") for (const f of [-1, 1]) e.mesh(i[f > 0 ? 1 : 0], "box", y.wood, [
    0.36,
    0.39,
    0.36
  ], [
    f * 0.13,
    -0.65,
    0
  ]);
  else s.activity === "deliver" ? (e.mesh(r, "box", y.wood, [
    0.65,
    0.47,
    0.5
  ], [
    0,
    l - 0.05,
    0.45
  ]), e.mesh(r, "box", y.light, [
    0.18,
    0.17,
    0.025
  ], [
    0,
    l - 0.05,
    0.72
  ])) : s.activity === "mend" || s.activity === "dressings" ? e.mesh(r, "box", y.light, [
    0.52,
    0.055,
    0.4
  ], [
    0,
    l - 0.22,
    0.36
  ]) : s.activity === "warm" && e.mesh(r, "box", y.pottery, [
    0.2,
    0.22,
    0.2
  ], [
    0,
    l + 0.1,
    0.38
  ]);
  n.traverse((f) => {
    f.castShadow = !1;
  });
  const h = [
    r,
    ...i,
    ...u
  ].map((f) => Xo(f, a));
  return {
    root: n,
    body: r,
    arms: i,
    legs: u,
    dispose() {
      h.forEach((f) => f()), n.removeFromParent();
    }
  };
}
function ei(e, t, s) {
  const a = new es({
    vertexColors: !0,
    roughness: 0.95
  }), n = (Yo[s] ?? []).map((u) => ({
    spec: u,
    model: Jo(e, t, u, a),
    time: 0
  }));
  let r = null, i = null;
  return {
    animate(u, o, c, d) {
      const l = c ? 0 : Ko(r, o);
      r = o;
      let h = n.length > 0 && i !== c;
      i = c;
      for (const f of n) {
        const { spec: g, model: v } = f, b = Dn(g, f.time), x = Math.hypot(b.position.x - u.x, b.position.y - u.y) < 27 && d(b.position);
        if (v.root.visible !== x && (v.root.visible = x, h = !0), !x) continue;
        f.time += l;
        const _ = Dn(g, f.time), p = c ? 0 : Math.sin(f.time * (_.walking ? 5.5 : 1.5) + g.phase);
        v.root.position.set(_.position.x, 0, _.position.y), v.root.rotation.y = _.facing, v.body.position.y = _.walking ? Math.abs(p) * 0.035 : 0, v.legs.forEach((w, M) => {
          w.rotation.x = _.walking ? p * 0.35 * (M ? 1 : -1) : 0;
        }), v.arms.forEach((w, M) => {
          w.rotation.x = _.walking ? p * 0.24 * (M ? -1 : 1) : -0.6 + p * 0.13 * (M ? 1 : -1), g.activity === "deliver" && (w.rotation.x = -0.75), g.activity === "warm" && (w.rotation.x = -1.1), g.activity === "cook" && !M && (w.rotation.x = -0.8 + p * 0.3);
        }), h = l > 0 || h;
      }
      return h;
    },
    dispose() {
      n.forEach((u) => u.model.dispose()), a.dispose();
    }
  };
}
function ti(e, t, s, a) {
  const n = Wo(e, t, s.landscape), r = e.group(t), i = e.group(t), u = Vo(e, t, s, a), o = ei(e, i, s.id), c = [], d = Ra.filter((v) => Ne[v].scene === s.id).map((v) => Go(e, i, v, a));
  let l = -1, h = null, f = null;
  function g(v) {
    const b = [...v].sort().join("/");
    if (b === f) return;
    f = b, d.forEach((_) => _.setFacts(v)), h?.(), u.setFacts(v);
    for (const _ of ka(s, v)) {
      const p = _.position;
      if (_.kind === "exit") {
        for (const w of [-1, 1]) $s(e, r, p.x + w * 1.7, p.y, 1.5);
        e.mesh(r, "box", y.brass, [
          3,
          0.025,
          0.35
        ], [
          p.x,
          0.12,
          p.y
        ]).castShadow = !1;
      } else if (_.target.kind === "inspect" && _.target.passage === "warning")
        e.mesh(r, "box", y.timber, [
          0.12,
          1.8,
          0.12
        ], [
          p.x,
          0.9,
          p.y
        ]), e.mesh(r, "box", y.wood, [
          1.4,
          0.7,
          0.13
        ], [
          p.x,
          1.6,
          p.y
        ]), e.mesh(r, "box", y.light, [
          0.7,
          0.4,
          0.025
        ], [
          p.x,
          1.6,
          p.y + 0.08
        ]);
      else if (_.target.kind === "inspect" && _.target.passage === "orders") {
        e.mesh(r, "box", y.slate, [
          2.2,
          0.8,
          1.2
        ], [
          p.x,
          0.4,
          p.y - 0.8
        ]);
        const w = e.mesh(r, "box", y.light, [
          1.8,
          0.08,
          0.9
        ], [
          p.x,
          0.85,
          p.y - 0.8
        ]);
        w.rotation.x = 0.2;
        for (let M = -1; M <= 1; M++) e.mesh(r, "cylinder", y.brass, [
          0.12,
          0.12,
          0.12
        ], [
          p.x + M * 0.45,
          0.95,
          p.y - 0.55
        ]);
      }
    }
    if (s.id === "camp") {
      const _ = s.landscape.features.find((p) => p.kind === "clinic").footprint;
      if (v.has("clinic_helped")) {
        const p = s.landscape.features.find((w) => w.kind === "bench").footprint;
        for (const w of [-1, 1])
          e.mesh(r, "cylinder", "#ede3c9", [
            0.16,
            0.22,
            0.16
          ], [
            p.x,
            0.91,
            p.z + w * 0.65
          ]), e.mesh(r, "cylinder", "#99704c", [
            0.125,
            0.012,
            0.125
          ], [
            p.x,
            1.024,
            p.z + w * 0.65
          ]);
      }
      if (v.has("receiving_arranged")) for (const p of [-1, 1]) {
        const w = _.x + p * 2.4, M = _.z + _.depth / 2 - 0.2, S = e.group(r, [
          w,
          0.2,
          M
        ]);
        S.rotation.x = -0.16;
        for (const I of [-1, 1]) e.mesh(S, "cylinder", y.timber, [
          0.055,
          2.9,
          0.055
        ], [
          I * 0.42,
          1.4,
          0
        ]);
        e.mesh(S, "box", v.has("captives_arrived") ? "#bdccc0" : "#eee7d1", [
          0.76,
          2.2,
          0.09
        ], [
          0,
          1.4,
          0.05
        ]);
        for (const I of [0.7, 2.1]) e.mesh(S, "box", y.timber, [
          0.94,
          0.055,
          0.08
        ], [
          0,
          I,
          0.12
        ]);
      }
      if (v.has("warden_defeated")) {
        const p = s.landscape.features.find((w) => w.kind === "wagon").footprint;
        for (let w = 0; w < 4; w++) {
          const M = e.group(r, [
            p.x + (w % 2 ? 0.65 : -0.65),
            1.4,
            p.z + (w < 2 ? -0.9 : 0.6)
          ]);
          e.mesh(M, "box", y.wood, [
            1.1,
            0.75,
            1.2
          ], [
            0,
            0.375,
            0
          ]);
          for (const S of [-1, 1]) e.mesh(M, "box", y.brass, [
            0.08,
            0.78,
            1.22
          ], [
            S * 0.35,
            0.38,
            0
          ]);
          e.mesh(M, "box", y.light, [
            0.25,
            0.025,
            0.55
          ], [
            0,
            0.77,
            0
          ]);
        }
      }
    }
    for (const _ of s.objects) {
      if (_.kind !== "switch") continue;
      const p = s.anchors[_.anchor], w = v.has(_.fact), M = e.group(r, [
        p.x,
        0,
        p.y
      ]);
      e.mesh(M, "box", y.slate, [
        0.7,
        0.65,
        0.7
      ], [
        0,
        0.325,
        0
      ]), e.mesh(M, "box", y.brass, [
        0.5,
        0.1,
        0.5
      ], [
        0,
        0.7,
        0
      ]);
      const S = e.group(M, [
        0,
        0.75,
        0
      ]);
      S.rotation.z = w ? 0.65 : -0.65, e.mesh(S, "cylinder", y.brass, [
        0.065,
        0.7,
        0.065
      ], [
        0,
        0.35,
        0
      ]), e.mesh(S, "cylinder", y.timber, [
        0.09,
        0.44,
        0.09
      ], [
        0,
        0.73,
        0
      ]).rotation.z = Math.PI / 2;
    }
    const x = Rt(s, v);
    for (const _ of s.landscape.gates) {
      const p = _.footprint, w = p.width > p.depth, M = Math.max(p.width, p.depth), S = e.group(r, [
        p.x,
        0,
        p.z
      ]);
      w || (S.rotation.y = Math.PI / 2);
      for (const I of [-1, 1]) e.mesh(S, "box", y.stone, [
        0.35,
        3.2,
        0.7
      ], [
        I * M / 2,
        1.6,
        0
      ]);
      if (e.mesh(S, "box", y.light, [
        M + 0.5,
        0.35,
        0.9
      ], [
        0,
        3.25,
        0
      ]), x.closedGates.has(_.id)) {
        for (let I = -M / 2 + 0.2; I < M / 2; I += 0.4) e.mesh(S, "box", y.shadow, [
          0.065,
          3,
          0.1
        ], [
          I,
          1.5,
          0
        ]);
        for (const I of [0.4, 2.5]) e.mesh(S, "box", y.brass, [
          M,
          0.12,
          0.15
        ], [
          0,
          I,
          0
        ]);
      } else e.mesh(S, "box", y.shadow, [
        M,
        0.42,
        0.16
      ], [
        0,
        3,
        0
      ]);
    }
    for (const _ of s.landscape.features) {
      if (_.kind !== "beacon" || v.has("alarm_silenced")) continue;
      const p = _.footprint, w = e.mesh(r, "cylinder", y.timber, [
        0.045,
        4.8,
        0.045
      ], [
        p.x + 3.3,
        2.7,
        p.z + 2.5
      ]);
      w.rotation.z = -0.32;
      for (let M = 0; M < 5; M++) e.mesh(r, "rock", M % 2 ? y.ember : y.cloth, [
        0.55,
        1.2 + M % 3 * 0.3,
        0.55
      ], [
        p.x + Math.sin(M * 2) * 0.7,
        5.4 + M % 3 * 0.3,
        p.z + Math.cos(M * 2) * 0.7
      ], !0);
    }
    h = e.bake(r);
  }
  return g(a), {
    setFacts: g,
    people: c,
    parleyPeople: d,
    setPeople(v, b) {
      let x = !1;
      for (const _ of vt) {
        const p = v[_], w = Sa[_].home, M = Ce[w.scene].anchors[w.anchor], S = p.mode === "idle" && (p.scene === "cells" || p.scene === w.scene && Math.hypot(p.position.x - M.x, p.position.y - M.y) < 1);
        let I = c.find((A) => A.id === _);
        I && (p.scene !== s.id || I.seated !== S) && (I.dispose(), c.splice(c.indexOf(I), 1), I = void 0, x = !0), p.scene === s.id && (I || (I = Ho(e, i, _, p.position.x, p.position.y, new Set(f?.split("/")), S), c.push(I), x = !0), x = I.locate(p, b) || x);
      }
      return x;
    },
    setEncounterActive(v) {
      u.setEncounterActive(v), d.forEach((b) => {
        b.root.visible = !v;
      });
    },
    update: n.update,
    animate(v, b, x, _) {
      const p = Math.floor(b / 80);
      if (p === l) return !1;
      l = p;
      let w = u.animate(x);
      w = o.animate(v, b, x, _) || w;
      for (const M of d) w = M.update(v, x) || w;
      for (const M of c) Math.hypot(M.position.x - v.x, M.position.y - v.y) < 22 ? (M.update(v, b, x), w = !x || w) : M.ring.visible = !1;
      return w;
    },
    dispose() {
      o.dispose(), c.splice(0).forEach((v) => v.dispose()), d.forEach((v) => v.dispose()), i.removeFromParent(), h?.(), u.dispose(), n.dispose();
    }
  };
}
var ai = "" + new URL("ember-assets/texture-stone-VVv9Pl_s.webp", import.meta.url).href, ni = "" + new URL("ember-assets/texture-plaster-Cljz23wF.webp", import.meta.url).href, si = "" + new URL("ember-assets/texture-slate-BGr9mHj3.webp", import.meta.url).href, ri = "" + new URL("ember-assets/texture-ground-DGpe7Gdj.webp", import.meta.url).href;
function oi(e, t) {
  const s = new Qs(), a = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Map();
  let i = 0, u = !1;
  function o(c, d) {
    i++;
    const l = s.load(c, (h) => {
      if (u) {
        h.dispose();
        return;
      }
      i--, r.delete(c);
      for (const f of d) a.set(f, h);
      e(), t(r.size, i);
    }, void 0, () => {
      u || (i--, n.delete(l), l.dispose(), r.set(c, d), t(r.size, i));
    });
    l.colorSpace = sn, l.wrapS = l.wrapT = lr, l.anisotropy = 2, n.add(l);
  }
  for (const [c, d] of [
    [ai, [
      y.stone,
      y.wetStone,
      y.marble,
      y.marbleLight
    ]],
    [ni, [y.light]],
    [si, [y.roof, y.roofLight]],
    [ri, [
      y.grass,
      y.grassLight,
      y.grassDark
    ]]
  ]) o(c, d);
  return {
    maps: a,
    retry() {
      if (!u && i === 0) {
        for (const [c, d] of r) o(c, d);
        t(r.size, i);
      }
    },
    dispose() {
      u = !0, n.forEach((c) => c.dispose()), n.clear(), a.clear(), r.clear();
    }
  };
}
function ii(e, t, s) {
  const a = new ts({
    antialias: !0,
    alpha: !1,
    powerPreference: s.world ? "default" : "high-performance"
  });
  a.outputColorSpace = sn, a.toneMapping = 7, a.toneMappingExposure = 1, a.setPixelRatio(Math.min(devicePixelRatio || 1, s.world ? 1.4 : 1.8)), a.shadowMap.enabled = !0, a.shadowMap.type = 2, e.append(a.domElement);
  const n = document.createElement("div");
  n.className = "exp-world-labels", n.setAttribute("aria-hidden", "true"), e.append(n);
  const r = new Xn(), i = new as(-10, 10, 10, -10, 0.1, 180), u = Ka();
  r.add(new ns("#effbff", "#74918a", 2));
  const o = new Na("#fff4e5", 1.9);
  o.position.set(-12, 25, 13), o.castShadow = !0;
  const c = s.world ? 1024 : 1536;
  o.shadow.mapSize.set(c, c), Object.assign(o.shadow.camera, {
    left: -23,
    right: 23,
    top: 24,
    bottom: -24,
    far: 80
  }), o.shadow.bias = -4e-4, o.shadow.normalBias = 0.035, o.shadow.radius = 3, r.add(o);
  const d = new Na("#c3edff", 1.1);
  d.position.set(7, 8, -15), r.add(d);
  const l = new Jt(), h = new Jt(), f = new Jt();
  r.add(l, h, f);
  const g = Ps(u, h, s.traveler.gender), v = Co(u, f), b = So(u, f), x = zo(n), _ = /* @__PURE__ */ new Map(), p = /* @__PURE__ */ new Map(), w = [], M = matchMedia("(prefers-reduced-motion: reduce)"), S = new rt(), I = new rt();
  let A = null, L = "", $ = "", O = "", T = null, V = null, ee = NaN, F = NaN, U = NaN, H = null, ie = 0, ot = 0, Me = 1, le = 1, we = !0, Je = !1, Fe = !1, Be = 0, Ve = -1, Pe = 0, Ie = !1;
  const yt = s.world ? oi(() => {
    L = "", we = !0, s.invalidate?.();
  }, (ye, Le) => s.artworkStatus?.(ye, Le)) : null;
  function ce() {
    const ye = e.getBoundingClientRect();
    Me = Math.max(1, ye.width), le = Math.max(1, ye.height), a.setSize(Me, le, !1), we = !0, Ie = !1, s.invalidate?.();
  }
  const qe = new ResizeObserver(ce);
  qe.observe(e), ce();
  function et(ye) {
    ye.preventDefault(), Fe = !0, t();
  }
  a.domElement.addEventListener("webglcontextlost", et);
  function Zt(ye, Le, bt, Ge, ke = !1) {
    if (Math.abs(ye) < 1) return;
    const W = document.createElement("span");
    W.className = ke ? "exp-damage is-player" : ye < 0 ? "exp-damage is-heal" : "exp-damage", W.textContent = `${ye < 0 ? "+" : ""}${Math.ceil(Math.abs(ye))}`, n.append(W), w.push({
      element: W,
      position: new rt(Le, 2, bt),
      born: Ge
    });
  }
  function Yt() {
    for (const ye of _.values())
      h.remove(ye.actor.root), ye.marker.remove();
    _.clear(), w.splice(0).forEach((ye) => ye.element.remove());
  }
  function oa(ye) {
    return Ie ? (I.set(ye.x, 1, ye.y).project(i), Math.abs(I.x) < 1.15 && Math.abs(I.y) < 1.15) : !0;
  }
  return {
    draw(ye, Le, bt, Ge = "battle", ke = 0, W) {
      if (Je || Fe) return;
      const We = performance.now(), G = Ge === "battle" ? ye : null, $a = G?.tick ?? (M.matches ? 0 : ke * 0.025), Ut = (G?.tick ?? -1) !== Ve, Qt = `${Le.weapon}/${Le.outfit}/${bt}`;
      if (!W && !we && Ge === $ && Qt === O && G === T && (!Ut && G || !G && (Ge === "between" || M.matches || ke - Be < 40))) return;
      Be = ke;
      const Kt = za[bt], ia = W ? W.definition.id : `${bt}:${G?.boss ?? !1}:${!!G}`;
      if (ia !== L) {
        if (p.forEach((K) => K.remove()), p.clear(), A?.(), W) {
          const K = Ka(yt?.maps);
          V = ti(K, l, W.definition, W.facts);
          const J = V;
          A = () => {
            J.dispose(), K.dispose();
          };
        } else
          V = null, A = wo(u, l, bt, G);
        Ie = !1, L = ia, r.background = new nn(Kt.sky), r.fog = new Ks(Kt.haze, 42, 95);
      } else W && H !== W.facts && V?.setFacts(W.facts);
      (!!G != !!T || G && T && G.tick < Ve) && (Yt(), Pe = G?.player.hp ?? 0);
      const Nt = !W && Ge !== "battle", it = Me < 600, N = it || le < 400, D = Me / le, j = W ? (it ? at.mobileWidth : Math.max(at.minimumWidth, D * (le < 400 ? at.shortSpan : at.tallSpan))) * (W.definition.safe && !G ? at.settlementScale : 1) : Nt ? it ? 13 : 28 : it ? 18.5 : Math.max(27, D * (le < 400 ? 14 : 23)), _e = Math.max(0, Q.arena - j / 2 + 0.5), Ct = W ? W.location.position.x : G ? N ? G.player.x * 0.62 : Math.max(-_e, Math.min(_e, G.player.x * 0.62)) : it ? 0 : 5.5, zt = W ? W.location.position.y - at.lead : G ? G.player.y * (N ? 0.62 : 0.2) - 0.4 : it ? -4.2 : -11.8;
      W && Math.hypot(ee - W.location.position.x, F - W.location.position.y) > 8 && (Ie = !1);
      const Os = Math.abs(S.x - Ct) + Math.abs(S.z - zt) < 0.015, Zs = W && V?.setPeople(W.people, ke), Us = W && V?.animate(W.location.position, ke, M.matches, oa);
      if (W && !we && Ie && Os && Qt === O && G === T && !Ut && ee === W.location.position.x && F === W.location.position.y && U === W.location.facing && H === W.facts && !Us && !Zs) return;
      !Ie || M.matches ? (S.set(Ct, 0, zt), Ie = !0) : (S.x += (Ct - S.x) * 0.14, S.z += (zt - S.z) * 0.14), i.left = -j / 2, i.right = j / 2, i.top = j / D / 2, i.bottom = -i.top;
      const Ea = Nt ? 0 : 1 * Math.PI / 4, pn = W ? at.distance : 25;
      i.position.set(S.x + Math.sin(Ea) * pn, W ? at.height : 28, S.z + Math.cos(Ea) * pn), i.lookAt(S.x, 0, S.z), i.updateProjectionMatrix(), i.updateMatrixWorld(), W && (V?.setEncounterActive(!!G), V?.update(W.location.position, Ea)), p.forEach((K) => {
        K.hidden = !0;
      });
      const Ns = new Set(W && !G ? [...un(W.definition, W.location.position, W.facts, W.people), ...Ca(W.definition.id, W.location.position, W.facts)].map((K) => K.target.id) : []);
      for (const K of [...V?.people ?? [], ...V?.parleyPeople ?? []]) {
        if (G || !W || Math.hypot(K.position.x - W.location.position.x, K.position.y - W.location.position.y) > 10) continue;
        let J = p.get(K.id);
        J || (J = document.createElement("span"), J.className = "exp-person-name", J.textContent = pt(K.id), n.append(J), p.set(K.id, J)), J.textContent = Ns.has(K.id) ? `${pt(K.id)} · ${oe.actions.talk}` : pt(K.id), I.set(K.position.x, 2.9 + K.root.position.y, K.position.y).project(i);
        const Ae = (I.x * 0.5 + 0.5) * Me, lt = (-I.y * 0.5 + 0.5) * le;
        J.hidden = Ae < 30 || Ae > Me - 30 || lt < 20 || lt > le - 20, J.style.transform = `translate(${Ae}px,${lt}px) translate(-50%,-100%)`;
      }
      s.world && (o.position.set(S.x - 12, 25, S.z + 13), o.target.position.set(S.x, 0, S.z), o.target.updateMatrixWorld());
      const Ds = W ? {
        ...W.location.position,
        facing: W.location.facing,
        dashTime: 0,
        swing: 0,
        shield: 0,
        guard: 0,
        resonance: 0
      } : null;
      g.update(G?.player ?? Ds, Le.weapon, Le.outfit, $a, M.matches, Nt, !!G?.effects.some((K) => K.kind === "resonance"));
      for (const K of G?.enemies ?? []) {
        let J = _.get(K.id);
        if (!J) {
          const Aa = document.createElement("i");
          Aa.className = xe(K.kind) ? "exp-threat is-boss" : "exp-threat", n.append(Aa), J = {
            actor: hn(u, h, K.kind, Kt),
            hp: K.hp,
            death: null,
            marker: Aa
          }, _.set(K.id, J);
        }
        J.hp > K.hp && Ut && Zt(J.hp - K.hp, K.x, K.y, G.tick), J.hp = K.hp, J.actor.update(K, G.tick, M.matches), J.actor.bar.quaternion.copy(i.quaternion), I.set(K.x, 1.2, K.y).project(i);
        const Ae = (I.x * 0.5 + 0.5) * Me, lt = (-I.y * 0.5 + 0.5) * le, vn = Math.min(18, Me / 2), gn = Math.min(it ? 132 : 95, le * 0.3), Fs = Math.max(gn, le - Math.min(130, le * 0.3)), Ia = Math.max(vn, Math.min(Me - vn, Ae)), La = Math.max(gn, Math.min(Fs, lt));
        J.marker.hidden = Math.abs(Ae - Ia) + Math.abs(lt - La) < 10, J.marker.style.transform = `translate(${Ia}px,${La}px) rotate(${Math.atan2(lt - La, Ae - Ia) + Math.PI / 2}rad)`;
      }
      for (const [K, J] of _) {
        if (G?.enemies.some((lt) => lt.id === K)) continue;
        J.death === null && (J.death = G?.tick ?? 0, G && J.hp > 0 && Zt(J.hp, J.actor.root.position.x, J.actor.root.position.z, G.tick));
        const Ae = ((G?.tick ?? 0) - J.death) / 12;
        J.actor.bar.visible = !1, J.marker.hidden = !0, J.actor.root.scale.setScalar(Math.max(0, 1 - Ae)), (Ae >= 1 || !G || M.matches) && (h.remove(J.actor.root), J.marker.remove(), _.delete(K));
      }
      G && Ut && (Pe !== G.player.hp && Zt(Pe - G.player.hp, G.player.x, G.player.y, G.tick, Pe > G.player.hp), Pe = G.player.hp), v.update(G, M.matches);
      const mn = G?.effects.filter((K) => K.kind === "ward-hit").at(-1);
      b.update(G?.player ?? null, mn ? Math.max(0, (mn.life - 5) / 10) : 0), x.update(G, i, Me, le);
      for (let K = w.length - 1; K >= 0; K--) {
        const J = w[K], Ae = ((G?.tick ?? 0) - J.born) / 27;
        if (Ae >= 1 || !G) {
          J.element.remove(), w.splice(K, 1);
          continue;
        }
        I.copy(J.position), I.y += M.matches ? 0 : Ae * 0.9, I.project(i), J.element.style.transform = `translate(${(I.x * 0.5 + 0.5) * Me}px,${(-I.y * 0.5 + 0.5) * le}px)`, J.element.style.opacity = String(Math.min(1, (1 - Ae) * 3));
      }
      a.render(r, i), ie++, ot += performance.now() - We, we = !1, $ = Ge, O = Qt, T = G, Ve = G?.tick ?? -1, W && (ee = W.location.position.x, F = W.location.position.y, U = W.location.facing, H = W.facts);
    },
    invalidate() {
      we = !0, s.invalidate?.();
    },
    retryArtwork() {
      yt?.retry();
    },
    stats() {
      return {
        draws: ie,
        submitMs: ot,
        calls: a.info.render.calls,
        triangles: a.info.render.triangles,
        geometries: a.info.memory.geometries,
        textures: a.info.memory.textures
      };
    },
    dispose() {
      Je = !0, qe.disconnect(), a.domElement.removeEventListener("webglcontextlost", et), Yt(), g.dispose(), x.dispose(), b.dispose(), A?.(), yt?.dispose(), o.shadow.dispose(), u.dispose(), r.clear(), a.dispose(), a.forceContextLoss(), a.domElement.remove(), n.remove();
    }
  };
}
function Ja(e) {
  if (e.kind === "exit") return `${oe.actions.travel} ${oe.scenes[e.target.to]}`;
  const t = e.target;
  switch (t.kind) {
    case "person":
      return `${oe.actions.talk} · ${oe.people[t.person]}`;
    case "enemy":
      return `${oe.actions.talk} · ${pt(t.enemy)}`;
    case "inspect":
      return oe.passages[t.passage].title;
    case "rest":
      return oe.actions.rest;
    case "switch":
      return oe.switches[t.fact];
  }
}
var li = ["aria-label"], ci = { class: "journey-heading" }, ui = {
  key: 0,
  class: "journey-artwork-issue",
  role: "status"
}, di = ["disabled"], hi = {
  key: 1,
  class: "journey-controls"
}, fi = ["aria-label"], pi = {
  key: 0,
  class: "journey-interaction"
}, mi = {
  key: 1,
  class: "journey-interaction journey-battle-actions"
}, vi = {
  key: 0,
  class: "journey-resource"
}, gi = [
  "max",
  "value",
  "aria-label"
], yi = ["disabled"], bi = ["disabled"], wi = {
  key: 2,
  class: "journey-overlay"
}, xi = /* @__PURE__ */ He({
  __name: "ExplorationField",
  props: {
    world: {},
    traveler: {},
    paused: { type: Boolean },
    weapon: {},
    outfit: {},
    battle: {}
  },
  emits: [
    "input",
    "interact",
    "pause",
    "resume",
    "error"
  ],
  setup(e, { expose: t, emit: s }) {
    const a = e, n = s, r = B(null), i = B(null), u = B({
      x: 0,
      y: 0
    }), o = B(null), c = B({
      failed: 0,
      pending: 0
    }), d = X(() => a.battle ? [] : [
      ...Ca(a.world.definition.id, a.world.location.position, a.world.facts),
      ...Yr(a.world.definition, a.world.location, a.world.facts),
      ...un(a.world.definition, a.world.location.position, a.world.facts, a.world.people)
    ]), l = X(() => d.value.find((U) => U.target.id === o.value) ?? null), h = X(() => a.weapon === "grimoire" ? te.contractPower : te.resource);
    let f = null, g = null, v = 0, b = 0, x = 0, _ = !1, p = !0;
    const w = bo((U, H) => {
      u.value = {
        x: U * 26,
        y: H * 26
      }, g?.stick(U, H);
    }, () => r.value?.focus({ preventScroll: !0 }));
    function M() {
      w.clear(), g?.clear(), x = 0;
    }
    function S() {
      M(), n("pause");
    }
    function I() {
      f?.retryArtwork();
    }
    function A() {
      document.hidden ? (cancelAnimationFrame(v), v = 0, S()) : (f?.invalidate(), L());
    }
    function L() {
      !v && !_ && p && (b = 0, v = requestAnimationFrame(F));
    }
    function $() {
      !a.paused && l.value && (M(), n("interact", l.value.target.id));
    }
    function O(U) {
      (!U || U.detail === 0) && g?.dash();
    }
    function T(U) {
      (!U || U.detail === 0) && g?.skill();
    }
    function V(U, H) {
      U.button === 0 && g?.[H]();
    }
    function ee() {
      const U = d.value.findIndex((H) => H.target.id === o.value);
      o.value = d.value[(U + 1) % d.value.length]?.target.id ?? null;
    }
    function F(U) {
      if (v = 0, _ || !p) return;
      !a.paused && !document.hidden && (v = requestAnimationFrame(F));
      const H = b ? Math.min(100, U - b) : 0;
      if (b = U, !a.paused && !document.hidden)
        for (x += H; x >= 1e3 / Q.hz && !a.paused; ) {
          x -= 1e3 / Q.hz;
          const ie = g.frame();
          if (ie.skill && !a.battle) {
            $();
            break;
          }
          n("input", ie);
        }
      else x = 0;
      if (!document.hidden) try {
        f?.draw(a.battle ?? null, a, 0, "battle", U, a.world);
      } catch (ie) {
        cancelAnimationFrame(v), v = 0, M(), n("error", ie);
      }
    }
    return pe(d, (U) => {
      U.some((H) => H.target.id === o.value) || (o.value = U[0]?.target.id ?? null);
    }, { immediate: !0 }), pe(() => a.world.definition.id, () => {
      M(), o.value = d.value[0]?.target.id ?? null, r.value?.focus({ preventScroll: !0 });
    }), pe(() => a.paused, (U) => {
      M(), L(), U || r.value?.focus({ preventScroll: !0 });
    }), pe(() => [
      a.world.definition,
      a.world.facts,
      a.world.location.position.x,
      a.world.location.position.y,
      a.weapon,
      a.outfit
    ], L), Ot(() => {
      try {
        f = ii(i.value, () => {
          S(), n("error", /* @__PURE__ */ new Error("expedition_webgl_context_lost"));
        }, {
          traveler: a.traveler,
          world: !0,
          invalidate: L,
          artworkStatus: (U, H) => {
            c.value = {
              failed: U,
              pending: H
            };
          }
        });
      } catch (U) {
        n("error", U);
        return;
      }
      g = yo(r.value, S, () => {
      }), document.addEventListener("visibilitychange", A), L(), r.value?.focus({ preventScroll: !0 });
    }), tn(() => {
      p = !1, cancelAnimationFrame(v), v = 0, S();
    }), Gn(() => {
      p = !0, L();
    }), _t(() => {
      _ = !0, cancelAnimationFrame(v), M(), g?.dispose(), document.removeEventListener("visibilitychange", A), f?.dispose();
    }), t({
      stats: () => f?.stats(),
      focus: () => r.value?.focus({ preventScroll: !0 })
    }), (U, H) => (P(), E("section", {
      ref_key: "root",
      ref: r,
      class: "journey-field",
      tabindex: "0",
      "aria-label": e.battle ? m(te).controls : m(oe).actions.controls
    }, [
      k("div", {
        ref_key: "canvas",
        ref: i,
        class: "journey-canvas"
      }, null, 512),
      k("header", ci, [k("h1", null, C(m(oe).scenes[e.world.definition.id]), 1), wn(U.$slots, "status", {}, void 0, !0)]),
      c.value.failed ? (P(), E("div", ui, [k("span", null, C(m(oe).artwork.unavailable), 1), k("button", {
        type: "button",
        disabled: c.value.pending > 0,
        onClick: I
      }, C(c.value.pending ? m(oe).artwork.loading : m(oe).artwork.retry), 9, di)])) : Y("", !0),
      e.paused ? Y("", !0) : (P(), E("div", hi, [
        k("div", {
          class: "journey-stick",
          role: "group",
          "aria-label": m(oe).actions.move,
          onPointerdown: H[0] || (H[0] = ut((...ie) => m(w).down && m(w).down(...ie), ["prevent"])),
          onPointermove: H[1] || (H[1] = ut((...ie) => m(w).move && m(w).move(...ie), ["prevent"])),
          onPointerup: H[2] || (H[2] = (...ie) => m(w).release && m(w).release(...ie)),
          onPointercancel: H[3] || (H[3] = (...ie) => m(w).release && m(w).release(...ie)),
          onLostpointercapture: H[4] || (H[4] = (...ie) => m(w).release && m(w).release(...ie)),
          onContextmenu: H[5] || (H[5] = ut(() => {
          }, ["prevent"]))
        }, [k("span", { style: na({ transform: `translate(${u.value.x}px, ${u.value.y}px)` }) }, null, 4)], 40, fi),
        l.value ? (P(), E("div", pi, [k("button", {
          type: "button",
          class: "journey-act",
          onClick: $
        }, [H[9] || (H[9] = k("kbd", null, "E", -1)), Ze(C(m(Ja)(l.value)), 1)]), d.value.length > 1 ? (P(), E("button", {
          key: 0,
          type: "button",
          class: "journey-switch",
          onClick: ee
        }, C(m(oe).actions.next), 1)) : Y("", !0)])) : Y("", !0),
        e.battle ? (P(), E("div", mi, [
          [
            "blade",
            "staff",
            "grimoire"
          ].includes(e.weapon) ? (P(), E("div", vi, [
            k("span", null, C(e.battle.player.resonance > 0 ? m(te).resonanceActive : h.value), 1),
            k("meter", {
              min: "0",
              max: m(st).maxPower,
              value: e.battle.player.resource,
              "aria-label": h.value
            }, null, 8, gi),
            k("small", null, C(e.battle.player.resonance > 0 ? m(te).secondsLeft(e.battle.player.resonance) : Math.floor(e.battle.player.resource)), 1)
          ])) : Y("", !0),
          k("button", {
            class: "journey-act",
            type: "button",
            disabled: e.battle.player.dash > 0,
            onPointerdown: H[6] || (H[6] = ut((ie) => V(ie, "dash"), ["prevent"])),
            onClick: O
          }, [
            k("kbd", null, C(m(te).dashKey), 1),
            Ze(C(m(te).dash), 1),
            k("small", null, C(e.battle.player.dash > 0 ? m(te).secondsLeft(e.battle.player.dash) : m(te).ready), 1)
          ], 40, yi),
          k("button", {
            class: "journey-act",
            type: "button",
            disabled: e.battle.player.skill > 0,
            onPointerdown: H[7] || (H[7] = ut((ie) => V(ie, "skill"), ["prevent"])),
            onClick: T
          }, [
            k("kbd", null, C(m(te).skillKey), 1),
            Ze(C(m(wt)[e.weapon].action), 1),
            k("small", null, C(e.battle.player.skill > 0 ? m(te).secondsLeft(e.battle.player.skill) : m(te).ready), 1)
          ], 40, bi)
        ])) : Y("", !0)
      ])),
      e.paused ? (P(), E("div", wi, [wn(U.$slots, "overlay", {}, () => [k("button", {
        class: "journey-act",
        type: "button",
        onClick: H[8] || (H[8] = (ie) => n("resume"))
      }, C(m(oe).actions.resume), 1)], !0)])) : Y("", !0)
    ], 8, li));
  }
}), Mi = /* @__PURE__ */ gt(xi, [["__scopeId", "data-v-2f3c7684"]]);
function ki(e) {
  const t = new Set(e.location.visited), s = new Set(e.facts), a = /* @__PURE__ */ new Map();
  for (const n of e.location.visited) for (const r of ka(Ce[n], s)) {
    if (r.kind !== "exit") continue;
    const i = r.target.to, u = [n, i].sort().join("/");
    t.add(i), a.set(u, {
      id: u,
      from: n,
      to: i
    });
  }
  return {
    scenes: [...t],
    links: [...a.values()]
  };
}
function _i(e, t) {
  const a = [], n = (r) => ({
    x: Math.max(t.x - t.width / 2 + 3, Math.min(t.x + t.width / 2 - 3, r.x)),
    y: Math.max(t.z - t.depth / 2 + 3, Math.min(t.z + t.depth / 2 - 3, r.y))
  });
  for (const r of e) {
    let i = n(r), u = -1;
    for (let o = 0; o <= 48; o++) {
      const c = Math.ceil(o / 8) * 5.2, d = o * Math.PI / 4, l = n({
        x: r.x + Math.cos(d) * c,
        y: r.y + Math.sin(d) * c
      }), h = Math.min(1 / 0, ...a.map((f) => Math.hypot(f.x - l.x, f.y - l.y)));
      if (h > u && (i = l, u = h), h >= 5.2) break;
    }
    a.push(i);
  }
  return a;
}
var Si = "" + new URL("ember-assets/city-title-PvPTt7VM.webp", import.meta.url).href, Ri = "" + new URL("ember-assets/city-title-mobile-DjRh8y0I.webp", import.meta.url).href, Ci = "" + new URL("ember-assets/chapter-outpost-eNUTzzZ8.webp", import.meta.url).href, zi = "" + new URL("ember-assets/weapon-blade-cX_cx3lv.webp", import.meta.url).href, Pi = "" + new URL("ember-assets/weapon-bow-dl92j0XJ.webp", import.meta.url).href, $i = "" + new URL("ember-assets/weapon-staff-BlMY2GK0.webp", import.meta.url).href, Ei = "" + new URL("ember-assets/weapon-daggers-BP7rLrAU.webp", import.meta.url).href, Ii = "" + new URL("ember-assets/weapon-grimoire-CrYKQ0FK.webp", import.meta.url).href, Li = "" + new URL("ember-assets/weapon-cannon-9qcVnfRp.webp", import.meta.url).href, Ai = "" + new URL("ember-assets/scene-camp-BGT9GK8h.webp", import.meta.url).href, Ti = "" + new URL("ember-assets/scene-crossroads-DameO7fS.webp", import.meta.url).href, ji = "" + new URL("ember-assets/scene-gate-MnD2gO90.webp", import.meta.url).href, Oi = "" + new URL("ember-assets/scene-beacon-CzhjDyj7.webp", import.meta.url).href, Zi = "" + new URL("ember-assets/scene-waterway-CTX5alhT.webp", import.meta.url).href, Ui = "" + new URL("ember-assets/scene-cells-DA9NefcD.webp", import.meta.url).href, Ni = "" + new URL("ember-assets/scene-hall-D9VKJOHX.webp", import.meta.url).href, Di = "" + new URL("ember-assets/scene-roots-3TArgp-z.webp", import.meta.url).href, Fi = "" + new URL("ember-assets/cg-arrival-CkFm1ndl.webp", import.meta.url).href, Bi = "" + new URL("ember-assets/cg-ending-FbNUmL5I.webp", import.meta.url).href, en = {
  city: Si,
  cityMobile: Ri,
  chapter: Ci
}, qi = {
  blade: zi,
  bow: Pi,
  staff: $i,
  daggers: Ei,
  grimoire: Ii,
  cannon: Li
}, As = {
  camp: Ai,
  crossroads: Ti,
  gate: ji,
  beacon: Oi,
  waterway: Zi,
  cells: Ui,
  hall: Ni,
  roots: Di
}, Fn = {
  arrival: Fi,
  ending: Bi
}, Wi = { class: "ember-map-header" }, Hi = ["src"], Vi = ["aria-pressed"], Gi = ["viewBox", "aria-label"], Yi = [
  "x1",
  "y1",
  "x2",
  "y2",
  "stroke-dasharray"
], Qi = ["transform"], Ki = ["fill"], Xi = {
  y: "22",
  "text-anchor": "middle"
}, Ji = ["viewBox", "aria-label"], el = [
  "x",
  "y",
  "width",
  "height"
], tl = ["points", "stroke-width"], al = [
  "x",
  "y",
  "width",
  "height",
  "fill"
], nl = ["cx", "cy"], sl = [
  "x1",
  "y1",
  "x2",
  "y2"
], rl = [
  "cx",
  "cy",
  "fill"
], ol = ["x", "y"], il = {
  key: 2,
  class: "ember-map-key"
}, ll = {
  key: 3,
  class: "ember-map-places"
}, cl = /* @__PURE__ */ He({
  __name: "CampaignMap",
  props: { campaign: {} },
  emits: ["close"],
  setup(e, { emit: t }) {
    const s = e, a = t, n = B(!1), r = B(null), i = B(!1), u = B(null), o = B({
      width: 400,
      height: 400
    }), c = new ResizeObserver((p) => {
      for (const w of p) {
        const { width: M, height: S } = w.contentRect;
        w.target === r.value ? i.value = M > S * 1.55 : o.value = {
          width: M,
          height: S
        };
      }
    });
    pe(u, (p, w) => {
      w && c.unobserve(w), p && c.observe(p);
    }), Ot(() => {
      c.observe(r.value);
    }), _t(() => c.disconnect());
    const d = {
      camp: [52, 89],
      crossroads: [52, 66],
      gate: [25, 44],
      beacon: [25, 22],
      hall: [52, 10],
      cells: [79, 32],
      waterway: [79, 54],
      roots: [16, 70]
    }, l = X(() => ki(s.campaign)), h = X(() => Object.fromEntries(l.value.scenes.map((p) => {
      const [w, M] = d[p], { width: S, height: I } = o.value;
      return [p, i.value ? [50 + (104 - M) / 104 * (S - 100), 10 + (w - 10) / 80 * (I - 40)] : [45 + w / 104 * (S - 90), 10 + M / 104 * (I - 40)]];
    }))), f = X(() => l.value.links), g = X(() => Ce[s.campaign.location.scene]), v = X(() => g.value.landscape.bounds), b = X(() => `${v.value.x - v.value.width / 2 - 5} ${v.value.z - v.value.depth / 2 - 5} ${v.value.width + 10} ${v.value.depth + 10}`), x = X(() => xs(s.campaign)), _ = X(() => {
      const p = _i(x.value.map((w) => w.position), v.value);
      return x.value.map((w, M) => ({
        ...w,
        marker: p[M]
      }));
    });
    return (p, w) => (P(), E("div", {
      ref_key: "root",
      ref: r,
      class: At(["ember-map", {
        "ember-map-wide": i.value,
        "ember-map-local": !n.value
      }])
    }, [
      k("div", Wi, [
        k("img", {
          src: m(As)[g.value.id],
          alt: "",
          decoding: "async"
        }, null, 8, Hi),
        k("h2", null, C(n.value ? m(Z).chapterMap : m(oe).scenes[g.value.id]), 1),
        k("div", null, [k("button", {
          type: "button",
          "aria-pressed": n.value,
          onClick: w[0] || (w[0] = (M) => n.value = !n.value)
        }, C(n.value ? m(Z).localMap : m(Z).chapterMap), 9, Vi), k("button", {
          type: "button",
          onClick: w[1] || (w[1] = (M) => a("close"))
        }, C(m(Z).close), 1)])
      ]),
      n.value ? (P(), E("svg", {
        key: 0,
        ref_key: "routeMap",
        ref: u,
        viewBox: `0 0 ${o.value.width} ${o.value.height}`,
        role: "img",
        "aria-label": m(Z).chapterMap,
        class: "ember-route-map"
      }, [(P(!0), E(re, null, Oe(f.value, (M) => (P(), E("line", {
        key: M.id,
        x1: h.value[M.from][0],
        y1: h.value[M.from][1],
        x2: h.value[M.to][0],
        y2: h.value[M.to][1],
        stroke: "#9ab5ae",
        "stroke-width": "1.5",
        "stroke-dasharray": e.campaign.location.visited.includes(M.from) && e.campaign.location.visited.includes(M.to) ? void 0 : "4 4"
      }, null, 8, Yi))), 128)), (P(!0), E(re, null, Oe(h.value, (M, S) => (P(), E("g", {
        key: S,
        transform: `translate(${M.join(",")})`
      }, [
        k("circle", {
          r: "6",
          fill: S === g.value.id ? "#bf6242" : e.campaign.location.visited.includes(S) ? "#366678" : "#b6c9c2",
          stroke: "#fffcef",
          "stroke-width": "1.5"
        }, null, 8, Ki),
        k("text", Xi, C(e.campaign.location.visited.includes(S) ? m(oe).scenes[S] : m(Z).unknownArea), 1),
        k("title", null, C(e.campaign.location.visited.includes(S) ? m(oe).scenes[S] : m(Z).unknownArea), 1)
      ], 8, Qi))), 128))], 8, Gi)) : (P(), E("svg", {
        key: 1,
        viewBox: b.value,
        role: "img",
        "aria-label": m(oe).scenes[g.value.id]
      }, [
        k("rect", {
          x: v.value.x - v.value.width / 2,
          y: v.value.z - v.value.depth / 2,
          width: v.value.width,
          height: v.value.depth,
          rx: "2",
          fill: "#d4e5d9"
        }, null, 8, el),
        (P(!0), E(re, null, Oe(g.value.landscape.roads, (M, S) => (P(), E("polyline", {
          key: S,
          points: M.points.map((I) => I.join(",")).join(" "),
          fill: "none",
          stroke: "#f8f1d9",
          "stroke-width": M.width,
          "stroke-linejoin": "round"
        }, null, 8, tl))), 128)),
        (P(!0), E(re, null, Oe(g.value.landscape.features, (M) => (P(), E("rect", {
          key: M.id,
          x: M.footprint.x - M.footprint.width / 2,
          y: M.footprint.z - M.footprint.depth / 2,
          width: M.footprint.width,
          height: M.footprint.depth,
          fill: M.kind === "water" ? "#6eb8c6" : M.kind === "tree" || M.kind === "thicket" ? "#80a28a" : "#8a9e9f",
          rx: ".5"
        }, null, 8, al))), 128)),
        k("circle", {
          cx: e.campaign.location.position.x,
          cy: e.campaign.location.position.y,
          r: "3.2",
          fill: "none",
          stroke: "#c84f3c",
          "stroke-width": "1"
        }, [k("title", null, C(m(Z).here), 1)], 8, nl),
        (P(!0), E(re, null, Oe(_.value, (M, S) => (P(), E("g", { key: M.target.id }, [
          k("line", {
            x1: M.position.x,
            y1: M.position.y,
            x2: M.marker.x,
            y2: M.marker.y,
            stroke: "#a3642a",
            "stroke-width": ".5"
          }, null, 8, sl),
          k("circle", {
            cx: M.marker.x,
            cy: M.marker.y,
            r: "2.4",
            fill: M.kind === "exit" ? "#356987" : "#a3642a"
          }, null, 8, rl),
          k("text", {
            class: "ember-map-number",
            x: M.marker.x,
            y: M.marker.y + 1.1,
            "text-anchor": "middle"
          }, C(S + 1), 9, ol),
          k("title", null, C(m(Ja)(M)), 1)
        ]))), 128))
      ], 8, Ji)),
      n.value ? (P(), E("p", il, C(m(Z).mapKey), 1)) : (P(), E("ol", ll, [(P(!0), E(re, null, Oe(x.value, (M) => (P(), E("li", { key: M.target.id }, C(m(Ja)(M)), 1))), 128))]))
    ], 2));
  }
}), ul = /* @__PURE__ */ gt(cl, [["__scopeId", "data-v-3622629e"]]), Bn = {
  map: {
    body: "M8 15 24 9 40 15 56 9 56 49 40 55 24 49 8 55Z",
    detail: "M24 9V49 M40 15V55 M14 38 20 31 30 36 47 23 M44 19 50 25 M50 19 44 25"
  },
  blade: {
    body: "M31 5 38 15 26 39 20 35Z M18 32 30 39 27 44 15 37Z M19 41 24 44 17 57 12 54Z",
    detail: "M31 12 23 35 M15 54 20 45"
  },
  bow: {
    body: "M19 7Q51 28 21 57L25 48Q40 31 24 16Z M30 31 50 27 45 34Z",
    detail: "M19 7 28 32 21 57 M13 37 48 29 M13 37 15 30 M13 37 20 39"
  },
  staff: {
    body: "M29 28 35 29 31 58 26 57Z M32 6 42 17 32 30 22 17Z",
    detail: "M32 6 32 30 M22 17 42 17 M19 9 15 13 M45 22 48 18 M23 46 35 47"
  },
  daggers: {
    body: "M10 7 28 25 23 36 16 29Z M54 7 36 25 41 36 48 29Z M22 39 29 33 35 52 29 55Z M42 39 35 33 29 52 35 55Z",
    detail: "M12 34 31 29 M52 34 33 29"
  },
  grimoire: {
    body: "M9 15Q22 9 32 17 43 9 55 15L52 51Q40 45 32 53 22 45 12 51Z",
    detail: "M32 17 32 53 M16 23 26 26 M38 26 48 23 M17 33 25 35 M39 35 47 33"
  },
  cannon: {
    body: "M15 23 51 16 55 32 21 40Z M23 42 42 42 48 54 14 54Z",
    detail: "M46 17 50 33 M23 24 27 37 M32 42 32 52 M11 15 6 10 M13 23 5 23"
  },
  wardrobe: {
    body: "M21 12 28 9 36 9 43 12 54 23 45 31 42 26 42 54 22 54 22 26 19 31 10 23Z",
    detail: "M28 9Q32 25 36 9 M27 46 37 46"
  },
  "storm-step": {
    body: "M23 10 40 13 34 37 46 43 44 52 17 52 15 44 23 35Z",
    detail: "M30 15 25 28 35 25 27 40 M19 45 43 45 M17 56 45 56"
  },
  conductor: {
    body: "M30 7 36 18 31 47 27 53 24 46Z M17 22 44 26 42 32 16 28Z",
    detail: "M12 12 8 20 17 18 11 28 M48 35 54 31 49 42 56 41 M20 56 35 56"
  },
  momentum: {
    body: "M32 12 41 17 45 27 42 40 31 48 21 42 17 30 21 19Z M31 22 36 29 32 37 27 30Z",
    detail: "M9 31A23 23 0 0 1 43 10 M43 5 44 11 38 13 M55 30A23 23 0 0 1 20 53 M20 59 18 53 25 51"
  },
  cinder: {
    body: "M32 7C38 23 49 27 46 42 44 52 20 57 17 42 14 33 21 24 25 21 23 33 29 35 32 7Z",
    detail: "M32 34Q44 47 32 52 24 49 32 34 M12 20 15 17 M48 16 51 21"
  },
  wildfire: {
    body: "M24 8 41 8 39 16 39 24Q53 37 44 50 32 58 21 50 11 39 26 24L26 16Z",
    detail: "M24 16 40 16 M20 35Q32 30 45 35 M31 34Q24 47 33 49 43 46 35 39 M30 5 37 5"
  },
  "blood-price": {
    body: "M32 7C36 21 49 28 46 40 42 58 19 56 17 41 15 30 28 19 32 7Z",
    detail: "M28 27 22 39 28 46 M34 34 42 26 M36 47 47 50 M14 14 19 19"
  },
  frost: {
    body: "M32 12C21 12 21 24 20 33L15 43Q32 51 49 43L44 33C43 24 43 12 32 12Z M28 48 36 48 35 54 29 54Z",
    detail: "M29 6 35 6 35 12 M18 39 46 39 M32 20 32 34 M26 24 38 30 M38 24 26 30"
  },
  shatter: {
    body: "M29 8 39 23 34 43 24 47 20 27Z M43 35 52 37 42 52 37 48Z M12 14 17 18 14 25 8 21Z",
    detail: "M29 8 29 30 24 47 M20 27 39 23 M15 48 20 53 M30 54 30 59"
  },
  echo: {
    body: "M27 17 39 23 39 42 27 48 17 41 17 24Z M27 25 32 28 32 38 27 41 23 37 23 28Z",
    detail: "M41 15Q58 32 41 50 M47 7Q69 32 47 57 M9 30 5 34"
  },
  hunter: {
    body: "M26 9 41 16 42 33 32 45 17 38 13 22Z M28 17 35 21 36 31 30 36 22 33 20 24Z M28 44 35 44 34 57 26 57Z",
    detail: "M28 21 28 32 M23 27 34 27 M7 10 12 15 M45 44 50 49"
  },
  piercing: {
    body: "M48 7Q23 7 17 36L13 52 28 45Q48 29 48 7Z",
    detail: "M9 57 40 17 M21 43 21 29 M28 35 29 20 M33 30 43 28 M38 23 46 19"
  },
  orbit: {
    body: "M32 20 42 26 41 37 31 44 22 38 21 27Z M49 10 54 13 53 18 48 20 45 15Z",
    detail: "M21 11C-4 19 13 52 44 50 64 48 54 26 45 21 M19 41C5 45 2 36 15 24 26 14 43 11 49 13"
  },
  thorns: {
    body: "M32 12A20 20 0 1 1 31.9 12M32 19A13 13 0 1 0 32.1 19Z",
    detail: "M19 16 15 5 27 12 M43 17 54 14 48 27 M46 43 52 54 38 51 M16 44 5 46 12 34"
  },
  aegis: {
    body: "M32 7 50 15 46 39 32 55 18 39 14 15Z M32 15 42 20 39 36 32 45 25 36 22 20Z",
    detail: "M32 15 32 45 M22 20 39 36 M42 20 25 36"
  },
  siphon: {
    body: "M32 12 48 23 44 44 29 54 15 39 18 21Z",
    detail: "M18 21 29 31 48 23 M29 31 29 54 M18 34 25 34 29 25 34 41 38 33 45 33"
  },
  focus: {
    body: "M32 7 49 24 42 45 32 55 20 44 15 24Z",
    detail: "M32 7 32 55 M15 24 49 24 M15 24 32 40 49 24 M22 12 17 7 M49 49 54 54"
  },
  renewal: {
    body: "M21 19 43 19 47 46 39 53 24 53 17 46Z M26 6 38 6 41 16 23 16Z",
    detail: "M24 23 23 44 40 44 39 23 M32 27 36 35 32 40 28 35Z M17 47 46 47"
  },
  execution: {
    body: "M45 7 48 19 34 38 27 31Z M22 31 37 43 32 48 17 35Z M21 41 28 47 18 57 12 51Z",
    detail: "M42 16 30 33 M36 25 41 27 M10 15 17 20 M10 27 15 26"
  },
  "last-stand": {
    body: "M32 6 48 17 44 42 32 56 20 42 16 17Z",
    detail: "M32 19Q43 35 34 44 22 39 28 30L32 35Z M9 42 15 45 M49 45 55 42"
  },
  quicksilver: {
    body: "M29 8 43 13 38 29 45 38 39 53 19 51 15 40 26 31Z",
    detail: "M7 23 19 23 M5 31 16 31 M30 14 27 24 M21 45 38 46"
  },
  magnet: {
    body: "M13 13 24 13 24 35Q32 46 40 35L40 13 51 13 51 36Q32 66 13 36Z",
    detail: "M13 24 24 24 M40 24 51 24 M32 7 32 19 M7 46 4 51 M57 46 60 51"
  },
  wardstone: {
    body: "M32 10 47 22 43 45 32 54 21 45 17 22Z",
    detail: "M24 26 40 26 38 38 32 44 26 38Z M9 19 13 15 M51 15 55 19"
  },
  pilgrim: {
    body: "M28 9 35 9 35 41 43 46 42 52 21 52 20 46 28 41Z",
    detail: "M28 20 35 20 M10 50Q4 24 20 15 M14 13 21 14 19 21 M47 18 53 26 47 34"
  },
  gambit: {
    body: "M20 10 45 10 51 46 26 55 13 29Z",
    detail: "M32 18 41 31 33 42 24 30Z M21 16 22 19 M43 42 44 46"
  },
  riposte: {
    body: "M32 9 48 17 43 41 32 52 21 41 16 17Z",
    detail: "M23 31 41 31 M34 23 42 31 34 39 M10 16 6 23 M54 40 58 34"
  },
  "shield-break": {
    body: "M30 8 17 16 21 41 28 51 31 36 26 28 33 20Z M37 10 49 17 44 41 35 52 36 36 31 28 38 20Z",
    detail: "M9 34 15 31 M50 31 57 34"
  },
  "cleave-wave": {
    body: "M43 8 47 18 28 37 22 31Z M17 31 34 44 29 48 13 36Z M17 42 24 47 16 56 10 51Z",
    detail: "M43 28Q58 36 49 50 M48 23Q66 35 56 53"
  },
  duelist: {
    body: "M14 10 32 31 27 36 11 21Z M50 10 53 21 30 48 24 43Z",
    detail: "M11 41 27 54 M37 41 53 54 M32 6 32 16"
  },
  "blood-dance": {
    body: "M46 8 49 18 29 39 23 33Z M16 34 33 47 29 51 12 38Z M22 45 28 50 20 58 14 53Z",
    detail: "M17 9Q7 22 17 26 27 22 17 9 M37 42Q49 43 49 54"
  },
  valor: {
    body: "M32 7 39 20 54 23 43 35 44 50 32 44 20 50 21 35 10 23 25 20Z",
    detail: "M32 20 39 29 32 37 25 29Z"
  },
  ricochet: {
    body: "M44 7 54 11 49 22 46 16 26 36 22 32 42 12Z",
    detail: "M10 55 24 39 18 27 9 23 M38 34 47 43 53 40 M50 34 54 40 49 46"
  },
  "split-arrow": {
    body: "M32 6 40 18 35 18 35 53 29 53 29 18 24 18Z",
    detail: "M32 39 13 20 M9 27 12 18 21 18 M32 39 51 20 M43 18 52 18 55 27"
  },
  pinning: {
    body: "M32 7 40 21 35 21 35 45 29 45 29 21 24 21Z",
    detail: "M14 35 50 35 M17 41 47 41 M16 52Q32 43 48 52 M32 45 32 57"
  },
  "distance-draw": {
    body: "M17 8Q53 31 17 56L23 44Q39 31 23 20Z",
    detail: "M17 8 30 31 17 56 M8 32 55 32 M48 25 56 32 48 39"
  },
  "hunter-mark": {
    body: "M32 19 44 31 32 43 20 31Z",
    detail: "M32 6 32 16 M32 46 32 57 M7 31 17 31 M47 31 57 31 M18 13A23 23 0 0 1 47 16 M46 49A23 23 0 0 1 16 47"
  },
  trapper: {
    body: "M12 21 52 21 48 48 16 48Z",
    detail: "M18 21 21 48 M27 21 29 48 M37 21 35 48 M46 21 43 48 M14 31 50 31 M15 40 49 40 M32 8 32 17 M25 12 39 12"
  },
  nova: {
    body: "M32 7 38 22 53 17 45 31 56 42 40 42 32 57 25 42 9 42 20 31 12 17 26 22Z",
    detail: "M32 22 39 32 32 42 25 32Z"
  },
  inferno: {
    body: "M17 10 42 10 49 17 47 52 17 52Z",
    detail: "M32 21Q46 39 35 46 24 45 25 33L31 36Z M42 10 42 18 49 18"
  },
  fracture: {
    body: "M16 15 27 22 32 9 39 22 50 15 45 45 19 45Z",
    detail: "M21 51 43 51 M29 23 26 33 34 35 30 45 M8 37 13 35 M51 35 57 37"
  },
  overload: {
    body: "M32 7 49 26 40 49 23 49 14 26Z",
    detail: "M32 7 32 20 24 31 38 28 30 43 32 55 M14 26 24 31 M38 28 49 26"
  },
  orbitals: {
    body: "M32 23 42 32 32 42 22 32Z M9 28 16 33 12 40 5 35Z M45 10 53 14 50 22 42 18Z",
    detail: "M20 14Q45 4 54 33 52 54 27 54 11 50 10 42 M17 24Q33 13 45 36"
  },
  convergence: {
    body: "M32 20 43 32 32 44 21 32Z",
    detail: "M6 7 23 23 M15 22 24 24 22 15 M58 7 41 23 M42 15 40 24 49 22 M32 58 32 46 M26 50 32 44 38 50"
  },
  backstab: {
    body: "M46 7 49 18 28 38 22 32Z M17 34 32 45 27 49 12 38Z M21 46 27 50 18 58 12 53Z",
    detail: "M11 12 24 12 24 25 M36 38Q50 35 53 46 M48 41 54 47 58 40"
  },
  shadowstep: {
    body: "M18 10 28 16 25 35 35 44 32 53 11 53 8 44 17 33Z",
    detail: "M36 12 45 18 42 34 53 44 50 52 40 52 M34 26 40 26 M36 32 39 32"
  },
  hemorrhage: {
    body: "M32 7 48 29 43 48 21 48 16 29Z",
    detail: "M19 30 27 30 31 21 36 39 40 30 46 30 M24 53 40 53"
  },
  "execution-chain": {
    body: "M15 12 26 10 34 18 26 29 15 30 7 22Z M38 35 49 33 57 41 49 52 38 53 30 45Z",
    detail: "M21 21 44 44 M43 8 52 17 M43 17 52 8"
  },
  smoke: {
    body: "M25 28 39 28 45 44 40 54 23 54 18 44Z",
    detail: "M25 35 39 35 M29 24Q14 23 18 14 24 8 30 17 M35 24Q49 22 46 13 39 6 35 15 M31 5 31 11"
  },
  venom: {
    body: "M44 7 50 13 25 43 18 38Z M17 39 24 44 15 58 11 55Z",
    detail: "M35 11 47 21 M20 31 31 41 M49 31Q39 46 49 49 59 46 49 31"
  },
  "pack-bond": {
    body: "M32 21 43 32 39 47 25 47 21 32Z M13 14 20 21 15 28 7 23Z M51 14 57 23 49 28 44 21Z",
    detail: "M18 41 12 36 6 41 M46 41 52 36 58 41 M32 10 32 17"
  },
  martyr: {
    body: "M32 12Q21 12 20 27L15 41 49 41 44 27Q43 12 32 12Z",
    detail: "M27 47 37 47 32 54Z M32 21 32 35 M25 28 39 28 M29 6 35 6"
  },
  covenant: {
    body: "M19 12 30 16 28 28 17 32 10 23Z M45 12 54 23 47 32 36 28 34 16Z M24 37 40 37 44 49 32 56 20 49Z",
    detail: "M20 23 32 33 44 23 M32 33 32 47"
  },
  frenzy: {
    body: "M15 8 26 17 22 44 15 55 12 32Z M33 7 42 17 35 48 29 57 29 31Z M50 13 56 23 47 47 39 54 45 30Z",
    detail: "M13 23 23 26 M30 21 39 24 M46 27 53 30"
  },
  "soul-harvest": {
    body: "M20 24 44 24 48 50 16 50Z M27 9 37 9 42 20 22 20Z",
    detail: "M32 29Q41 39 32 45 23 39 32 29 M10 7 9 15 16 20 M53 7 55 15 48 20 M17 55 47 55"
  },
  command: {
    body: "M18 8 45 8 45 56 32 48 18 56Z",
    detail: "M32 16 27 29 38 26 28 42 M22 12 40 12"
  },
  shrapnel: {
    body: "M21 24 36 17 47 38 32 48Z",
    detail: "M25 29 40 23 M14 12 21 18 M41 7 39 15 M54 21 47 24 M52 49 46 44 M21 50 17 56 M9 35 18 34"
  },
  minefield: {
    body: "M20 22 44 22 51 40 44 51 20 51 13 40Z",
    detail: "M32 10 32 22 M25 10 39 10 M13 40 51 40 M25 30 39 30 M25 45 39 45"
  },
  overclock: {
    body: "M27 8 37 8 39 16 48 19 54 27 49 35 48 45 39 48 36 56 26 56 23 48 14 45 10 35 15 27 16 18 25 16Z",
    detail: "M32 21 25 34 35 32 30 43 M42 9 50 5 M53 50 58 54"
  },
  bunker: {
    body: "M11 22 18 12 46 12 53 22 50 50 14 50Z",
    detail: "M13 26 51 26 M22 33 42 33 42 42 22 42Z M19 55 45 55"
  },
  salvage: {
    body: "M42 8 38 21 46 25 55 15 55 30 44 38 33 34 17 55 10 49 28 28 27 16Z",
    detail: "M14 49 17 50 M9 15 18 15 18 24 9 24Z"
  },
  railgun: {
    body: "M13 19 47 12 50 22 20 30Z M20 35 51 27 54 37 20 45Z M24 47 39 44 43 55 19 55Z",
    detail: "M5 33 57 20 M50 17 58 20 53 27"
  },
  battle: {
    body: "M17 7 32 25 27 30 13 17Z M47 7 51 17 23 49 17 44Z",
    detail: "M10 37 27 53 M38 37 54 52 M35 38 46 51 M17 48 11 55 M45 48 52 55"
  },
  elite: {
    body: "M32 8 48 21 44 42 32 55 20 42 16 21Z",
    detail: "M24 27 28 29 M40 27 36 29 M24 39 40 39 M32 18 32 35 M9 24 5 34 M55 24 59 34"
  },
  camp: {
    body: "M32 12C33 26 47 27 41 39 36 48 23 47 21 36 21 30 27 23 27 23L28 33Z",
    detail: "M14 47 49 57 M15 57 49 47 M15 18 11 23 M46 16 48 21"
  },
  shrine: {
    body: "M32 7 41 21 32 34 23 21Z M19 42 45 42 49 53 15 53Z",
    detail: "M12 58 52 58 M32 7 32 34 M9 23 15 23 M49 23 55 23 M20 36 16 40 M44 36 48 40"
  },
  merchant: {
    body: "M13 28 51 28 48 53 16 53Z M18 11 46 11 54 27 10 27Z",
    detail: "M24 12 21 26 M40 12 43 26 M23 35 23 46 M41 35 41 46 M28 33 36 33 36 52"
  },
  boss: {
    body: "M13 19 24 26 32 9 40 26 51 19 46 45 18 45Z",
    detail: "M18 51 46 51 M25 35 25 38 M39 35 39 38 M32 30 32 41"
  },
  crown: {
    body: "M10 18 23 28 32 10 41 28 54 18 47 46 17 46Z",
    detail: "M19 53 45 53 M32 28 37 35 32 41 27 35Z"
  },
  coin: {
    body: "M32 9A23 23 0 1 1 31.9 9 M32 16A16 16 0 1 0 32.1 16Z",
    detail: "M32 21 40 32 32 43 24 32Z"
  },
  heart: {
    body: "M32 52 12 32C0 14 22 6 32 20 43 6 64 15 52 32Z",
    detail: ""
  },
  bag: {
    body: "M20 22 44 22 50 51 14 51Z",
    detail: "M24 22 24 12 40 12 40 22 M15 32Q32 41 49 32 M28 35 36 35 36 43 28 43Z"
  },
  journal: {
    body: "M15 10 48 10 48 54 15 54Z",
    detail: "M22 10 22 54 M31 22 41 22 M31 29 39 29 M10 20 17 20 M10 42 17 42"
  },
  sound: {
    body: "M13 25 23 25 35 14 35 50 23 39 13 39Z",
    detail: "M43 22Q54 32 43 42 M49 15Q64 32 49 49"
  },
  mute: {
    body: "M13 25 23 25 35 14 35 50 23 39 13 39Z",
    detail: "M44 25 56 39 M56 25 44 39"
  },
  pause: {
    body: "M20 15 27 15 27 49 20 49Z M37 15 44 15 44 49 37 49Z",
    detail: ""
  },
  close: {
    body: "",
    detail: "M18 18 46 46 M46 18 18 46"
  },
  arrow: {
    body: "",
    detail: "M12 32 51 32 M37 18 51 32 37 46"
  },
  lock: {
    body: "M17 28 47 28 47 53 17 53Z",
    detail: "M23 28 23 19A9 9 0 0 1 41 19L41 28 M32 38 32 45"
  },
  dash: {
    body: "M34 12 52 31 34 51 26 43 36 31 26 20Z",
    detail: "M10 21 23 21 M5 32 23 32 M10 43 23 43"
  },
  help: {
    body: "",
    detail: "M22 22C22 8 47 10 43 26 41 33 32 30 32 39 M32 49 32 51"
  }
}, dl = {
  class: "exp-icon",
  viewBox: "0 0 64 64",
  fill: "none",
  "aria-hidden": "true"
}, hl = ["d"], fl = ["d"], pl = /* @__PURE__ */ He({
  __name: "ExpeditionIcon",
  props: { name: {} },
  setup(e) {
    return (t, s) => (P(), E("svg", dl, [k("path", {
      d: m(Bn)[e.name].body,
      fill: "currentColor",
      "fill-opacity": ".17",
      "fill-rule": "evenodd",
      stroke: "currentColor",
      "stroke-width": "2.2",
      "stroke-linejoin": "round"
    }, null, 8, hl), k("path", {
      d: m(Bn)[e.name].detail,
      stroke: "currentColor",
      "stroke-width": "2.2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    }, null, 8, fl)]));
  }
}), $t = pl, ml = { class: "exp-wardrobe" }, vl = { class: "exp-fitting-body" }, gl = { class: "exp-preview-stage" }, yl = ["aria-label"], bl = {
  key: 0,
  class: "exp-preview-error",
  role: "alert"
}, wl = { class: "exp-preview-tools" }, xl = ["aria-label"], Ml = ["disabled"], kl = { class: "exp-outfit-info" }, _l = { class: "exp-muted" }, Sl = { class: "exp-fitting-actions" }, Rl = {
  key: 0,
  class: "exp-muted"
}, Cl = ["disabled"], zl = { key: 2 }, Pl = { class: "exp-purchase-confirm" }, $l = ["disabled"], El = ["disabled"], Il = ["aria-label"], Ll = ["aria-pressed", "onClick"], Al = ["src"], Tl = /* @__PURE__ */ He({
  __name: "ExpeditionWardrobe",
  props: {
    data: {},
    traveler: {},
    balance: {},
    blocked: { type: Boolean },
    weapon: {}
  },
  emits: ["command"],
  setup(e, { emit: t }) {
    const s = e, a = t, n = B(s.data.equippedOutfit), r = B(!1), i = B(0), u = B(!1), o = B(null), c = B(null), d = B({}), l = X(() => nt[n.value]), h = X(() => Za(s.data, n.value)), f = X(() => cr.find((A) => Fa[A].awardKey === l.value.achievement)), g = X(() => is.filter((A) => Za(s.data, A) || nt[A].achievement === null || Object.values(Gt).some((L) => L.boss && Fa[L.boss].awardKey === nt[A].achievement)));
    let v = null, b = !0, x = 0, _ = () => {
    };
    pe([
      n,
      i,
      () => s.weapon
    ], () => {
      b = !0, _(), r.value = !1;
    });
    function p(A) {
      n.value = A, c.value?.scrollTo({ top: 0 });
    }
    function w() {
      x = performance.now() + 1100, b = !0, _();
    }
    function M() {
      r.value = !1, a("command", {
        type: "purchase",
        id: n.value
      });
    }
    function S() {
      b = !0;
      let A;
      try {
        A = new ts({
          antialias: !0,
          alpha: !1
        });
      } catch {
        u.value = !0;
        return;
      }
      A.outputColorSpace = sn, A.toneMapping = 7, A.setPixelRatio(Math.min(devicePixelRatio, 1.8));
      const L = new Xn(), $ = Ka(), O = new Jt(), T = Ps($, O, s.traveler.gender);
      L.background = new nn("#d1e0e1"), L.add(O, new ns("#fff6e3", "#627c93", 2.7));
      const V = new Na("#fff6e0", 3);
      V.position.set(-3, 5, 6), L.add(V);
      const ee = new as(-2.35, 2.35, 2.35, -2.35, 0.1, 30), F = new ma();
      function U(ce) {
        T.update({
          x: 0,
          y: 0,
          facing: Math.PI / 2,
          dashTime: 0,
          swing: 0,
          shield: 0,
          guard: 0,
          resonance: 0
        }, s.weapon, ce, 0, !0, !1), T.root.position.set(0, 0.1, 0), T.root.rotation.y = -0.2, T.root.scale.setScalar(1.35);
      }
      for (const ce of g.value)
        U(ce), F.union(new ma().setFromObject(O));
      const H = F.getSize(new rt()), ie = F.getCenter(new rt()), ot = H.y * 0.5 + H.z * 0.1 + 0.2, Me = Math.hypot(H.x, H.z) * 0.5 + 0.2;
      ee.position.set(0, ie.y + 0.8, 7), ee.lookAt(0, ie.y, 0);
      function le(ce) {
        const qe = Math.max(ot, Me / ce);
        ee.left = -qe * ce, ee.right = -ee.left, ee.top = qe, ee.bottom = -qe, ee.updateProjectionMatrix();
      }
      le(1), A.setSize(144, 144, !1);
      try {
        for (const ce of g.value)
          U(ce), A.render(L, ee), d.value[ce] = A.domElement.toDataURL("image/png");
      } catch {
        u.value = !0, T.dispose(), $.dispose(), L.clear(), A.dispose(), A.forceContextLoss();
        return;
      }
      o.value.append(A.domElement);
      let we = 0, Je = 1, Fe = 1;
      const Be = new ResizeObserver(() => {
        const ce = o.value.getBoundingClientRect();
        Je = Math.max(1, ce.width), Fe = Math.max(1, ce.height), A.setSize(Je, Fe, !1), le(Je / Fe), b = !0, _();
      });
      Be.observe(o.value);
      const Ve = matchMedia("(prefers-reduced-motion: reduce)");
      function Pe(ce) {
        ce.preventDefault(), u.value = !0, cancelAnimationFrame(we), we = 0;
      }
      A.domElement.addEventListener("webglcontextlost", Pe);
      function Ie(ce) {
        if (we = 0, u.value || document.hidden || !b && (ce > x || Ve.matches)) return;
        const qe = ce < x && !Ve.matches, et = ce * 0.03;
        T.update({
          x: qe ? Math.sin(et * 0.4) * 0.03 : 0,
          y: 0,
          facing: Math.PI / 2,
          dashTime: 0,
          swing: qe ? 8 - et % 8 : 0,
          shield: 0,
          guard: 0,
          resonance: 0
        }, s.weapon, n.value, et, Ve.matches, !1), T.root.position.set(0, 0.1, 0), T.root.rotation.y = Number(i.value) * Math.PI / 180, T.root.scale.setScalar(1.35);
        try {
          A.render(L, ee), b = !1;
        } catch {
          u.value = !0;
        }
        qe && !u.value && _();
      }
      _ = () => {
        !we && !u.value && !document.hidden && (we = requestAnimationFrame(Ie));
      };
      function yt() {
        document.hidden ? (cancelAnimationFrame(we), we = 0) : (b = !0, _());
      }
      document.addEventListener("visibilitychange", yt), _(), v = () => {
        _ = () => {
        }, cancelAnimationFrame(we), Be.disconnect(), document.removeEventListener("visibilitychange", yt), A.domElement.removeEventListener("webglcontextlost", Pe), T.dispose(), $.dispose(), L.clear(), A.dispose(), A.forceContextLoss(), A.domElement.remove();
      };
    }
    function I() {
      v?.(), v = null, u.value = !1, S();
    }
    return Ot(S), _t(() => v?.()), (A, L) => (P(), E("div", ml, [k("section", {
      ref_key: "fitting",
      ref: c,
      class: "exp-fitting"
    }, [k("div", vl, [k("div", gl, [k("div", {
      ref_key: "host",
      ref: o,
      class: "exp-outfit-preview",
      "aria-label": m(Bt)[n.value].name
    }, [u.value ? (P(), E("div", bl, [k("p", null, C(m(te).presentationError.rendering), 1), k("button", {
      type: "button",
      onClick: I
    }, C(m(Z).reload), 1)])) : Y("", !0)], 8, yl), k("div", wl, [k("label", null, [Ze(C(m(te).rotate), 1), Wt(k("input", {
      "onUpdate:modelValue": L[0] || (L[0] = ($) => i.value = $),
      type: "range",
      min: "-180",
      max: "180",
      step: "5",
      "aria-label": m(te).rotate
    }, null, 8, xl), [[an, i.value]])]), k("button", {
      type: "button",
      disabled: u.value,
      onClick: w
    }, C(m(te).previewAction), 9, Ml)])]), k("div", kl, [
      k("h3", null, C(m(Bt)[n.value].name), 1),
      k("p", null, C(m(Bt)[n.value].detail), 1),
      k("p", _l, C(m(te).wardrobeNote), 1)
    ])]), k("div", Sl, [m(Cn)(e.data.active) ? Y("", !0) : (P(), E("p", Rl, C(m(Z).safeWardrobe), 1)), h.value ? (P(), E("button", {
      key: 1,
      type: "button",
      class: "exp-primary",
      disabled: e.blocked || !m(Cn)(e.data.active) || e.data.equippedOutfit === n.value,
      onClick: L[1] || (L[1] = ($) => a("command", {
        type: "equip",
        id: n.value
      }))
    }, C(e.data.equippedOutfit === n.value ? m(te).equipped : m(te).equip), 9, Cl)) : f.value ? (P(), E("p", zl, C(m(te).unlockWeapon(m(Da)[f.value])), 1)) : r.value ? (P(), E(re, { key: 3 }, [k("p", null, C(m(te).buyOutfit(m(Bt)[n.value].name, l.value.price)), 1), k("div", Pl, [k("button", {
      type: "button",
      class: "exp-primary",
      disabled: e.blocked || e.balance < l.value.price,
      onClick: M
    }, C(m(te).confirm), 9, $l), k("button", {
      type: "button",
      onClick: L[2] || (L[2] = ($) => r.value = !1)
    }, C(m(te).cancel), 1)])], 64)) : (P(), E("button", {
      key: 4,
      type: "button",
      class: "exp-primary",
      disabled: e.blocked || e.balance < l.value.price,
      onClick: L[3] || (L[3] = ($) => r.value = !0)
    }, C(e.balance < l.value.price ? m(te).noCoins : m(te).purchase) + " · " + C(m(te).coins(l.value.price)), 9, El))])], 512), k("div", {
      class: "exp-outfit-rack",
      "aria-label": m(te).tryOn
    }, [(P(!0), E(re, null, Oe(g.value, ($) => (P(), E("button", {
      key: $,
      type: "button",
      "aria-pressed": n.value === $,
      onClick: (O) => p($)
    }, [
      d.value[$] ? (P(), E("img", {
        key: 0,
        class: "exp-outfit-swatch",
        src: d.value[$],
        alt: ""
      }, null, 8, Al)) : Y("", !0),
      k("strong", null, C(m(Bt)[$].name), 1),
      k("small", null, C(e.data.equippedOutfit === $ ? m(te).equipped : m(Za)(e.data, $) ? m(te).owned : m(nt)[$].price ? m(te).coins(m(nt)[$].price) : m(te).achievement), 1)
    ], 8, Ll))), 128))], 8, Il)]));
  }
}), jl = Tl;
function Ol(e, t = 1) {
  const s = [];
  for (const a of e.matchAll(/<!-- stage:(\d+):(\d+) -->\s*([\s\S]*?)<!-- \/stage -->/g)) {
    if (Number(a[1]) !== t) continue;
    const n = Number(a[2]);
    (s[n] || n >= wa.bands.length) && be("narrative_unavailable");
    const r = /* @__PURE__ */ new Map();
    for (const u of a[3].matchAll(/<!-- field:([a-z]+) -->\s*([^]*?)(?=<!-- field:|$)/g))
      r.has(u[1]) && be("narrative_unavailable"), r.set(u[1], u[2].replace(/^[^:\n]+:\s*/, "").trim());
    const i = (u) => {
      const o = r.get(u);
      return o || be("narrative_unavailable"), o;
    };
    s[n] = {
      name: i("name"),
      relationship: i("relationship"),
      memory: r.get("memory") ?? "",
      shadow: r.get("shadow") ?? "",
      intimacy: i("intimacy"),
      secret: r.get("secret") ?? null
    };
  }
  return wa.bands.some((a, n) => !s[n]) && be("narrative_unavailable"), s;
}
function Zl(e, t, s) {
  const a = e[dn(t.affection)];
  return {
    relationship: a.relationship,
    shadow: a.shadow,
    intimacy: a.intimacy,
    personalPast: e.slice(0, t.highestBand + 1).map((n) => n.memory).filter(Boolean),
    secret: a.secret,
    disclosedSecret: s ? e.find((n) => n.secret)?.secret ?? null : null
  };
}
var Ul = async (e, t) => {
  const s = await fetch(`/${Gs}/modules/xiaobai-os/docs/expedition-cards/${e}.md`, {
    signal: t,
    cache: "no-cache"
  });
  s.ok || be("narrative_unavailable");
  const a = await s.text();
  return a.trim() || be("narrative_unavailable"), a;
};
async function Nl(e, t, s = Ul) {
  const [a, n, r, i, u] = await Promise.all([
    s("system-prompt", t),
    s("world", t),
    s("player", t),
    s("meta-protocol", t),
    Promise.all(Ms.map(async (x) => ({
      id: x,
      document: await s(De(x) ? x : Ne[x].card, t)
    })))
  ]), o = u.map(({ id: x, document: _ }) => {
    const p = [..._.matchAll(/<!-- public -->\s*([\s\S]*?)\s*<!-- \/public -->/g)];
    return (p.length !== 1 || !p[0][1].trim()) && be("narrative_unavailable"), {
      id: x,
      introduction: p[0][1].trim(),
      document: _.replace(p[0][0], "").trim()
    };
  }), c = o.map((x) => x.introduction).join(`
`), d = o.find((x) => x.id === e).document, l = {
    system: a,
    world: n,
    player: r,
    protocol: i,
    npcs: c
  };
  if (!De(e)) {
    const x = /<!-- opening:([a-z]+\.initial) -->\s*([\s\S]*?)\s*<!-- \/opening -->/.exec(d);
    return (!x || x[1] !== `${e}.initial`) && be("narrative_unavailable"), {
      ...l,
      character: d.slice(0, x.index).replace(/# 开场\s*$/, "").trim(),
      stages: [],
      opening: {
        initial: x[2],
        returned: null
      }
    };
  }
  const [h, f] = await Promise.all(["openings", `${e}-stages`].map((x) => s(x, t))), g = new Map([...h.matchAll(/<!-- opening:([a-z]+\.(?:initial|returned)) -->\s*([\s\S]*?)\s*<!-- \/opening -->/g)].map((x) => [x[1], x[2].trim()])), v = g.get(`${e}.initial`), b = g.get(`${e}.returned`) ?? null;
  return (!v || (e === "anian" || e === "kouzi") && !b) && be("narrative_unavailable"), {
    ...l,
    character: d,
    stages: Ol(f),
    opening: {
      initial: v,
      returned: b
    }
  };
}
function Ts(e) {
  return Kr[e];
}
function Dl(e, t, s = []) {
  if (!De(t)) {
    const i = Ne[t];
    return e.facts.includes(i.complete) || e.pendingParley ? {} : {
      attack: he.attack,
      ...e.facts.includes(i.intel) ? { pass: he.pass } : {}
    };
  }
  const a = Object.fromEntries(Xr(e.facts, t, e.people[t]).map((i) => [i, cn[i].meaning])), n = Ts(t), r = e.relationships[t].affection;
  if (n && !e.facts.includes(n) && r >= wa.bands[4] && s[dn(r)]?.secret && (a.share_secret = he.shareSecret), Jr(e, t)) {
    a.follow = he.follow, a.stay = he.stay;
    for (const i of ys(e, t).filter((u) => u.accessible && u.solo)) a[`go:${i.id}`] = he.go(i.name);
  }
  return a;
}
var js = "dialogue", Pa = `<${js}>`, fn = `</${js}>`, H1 = new RegExp(`${Pa}([\\s\\S]*?)${fn}`, "i"), V1 = new RegExp(Pa, "i");
function qn(e) {
  const t = e.affectionDelta ? e.affectionDelta > 0 ? "up" : "down" : null;
  return `${Pa}
${e.reply}
${fn}
${JSON.stringify({
    action: e.action,
    affection: t,
    performance: e.performance ?? null
  })}`;
}
function Fl(e) {
  return `［开工强调］：

每次输出均由两部分组成：XML 正文与 JSON 操作，缺一不可。

在${Pa}…${fn}中用【${e}】的身份第一人称叙事。在JSON 对象中提交操作。
开工：`;
}
function Bl(e) {
  return e.map((t) => ({
    id: t,
    event: os[t]
  }));
}
function ql(e) {
  const t = /* @__PURE__ */ new Set();
  let s;
  return e.filter((a) => a.kind !== "receipt").flatMap((a) => {
    const n = a.facts.filter((u) => !t.has(u)), r = {
      ...a.scene === s ? {} : { place: oe.scenes[a.scene] },
      ...n.length ? { newEvents: n } : {}
    };
    a.facts.forEach((u) => t.add(u)), s = a.scene;
    const i = Object.keys(r).length ? `<scene>
${JSON.stringify(r)}
</scene>
` : "";
    return a.kind === "greeting" ? [{
      role: "assistant",
      content: qn(a)
    }] : [{
      role: "user",
      content: i + a.player
    }, {
      role: "assistant",
      content: qn(a)
    }];
  });
}
function Wl(e, t) {
  return t ? e.findIndex((s) => s.id === t.throughId) + 1 : 0;
}
function Hl(e, t) {
  const s = new Set(e.facts), a = De(t) ? e.people[t] : null, n = Ce[De(t) ? e.people[t].scene : Ne[t].scene], r = De(t) ? e.people[t].position : ba(t, s), i = un(n, r, s, e.people), u = Ca(n.id, r, s).filter((o) => $e(Rt(n, s), r, o.position));
  return {
    place: oe.scenes[n.id],
    movement: a ? {
      mode: a.mode,
      destination: a.destination ? ln[a.destination].name : null
    } : null,
    nearby: [...i, ...u].filter((o) => o.target.id !== t).map((o) => pt(o.target.id))
  };
}
function Vl(e, t, s = []) {
  const a = Dl(e, t, s), n = Object.keys(a), r = {
    person: pt(t),
    ...Hl(e, t),
    events: Bl(e.knowledge[t]),
    actions: n,
    actionMeanings: a
  };
  if (!De(t)) {
    const i = Ne[t];
    return {
      ...r,
      rescued: !1,
      resolved: e.facts.includes(i.complete)
    };
  }
  return {
    ...r,
    map: ys(e, t),
    rescued: e.knowledge[t].includes("captives_arrived"),
    affection: e.relationships[t].affection
  };
}
function Xt(e, t) {
  return `<${e}>
${t}
</${e}>`;
}
function Gl(e, t, s, a, n = e.memories[t]) {
  const r = Vl(e, t, a.stages), i = uo(t), u = De(t) ? Ts(t) : null, o = De(t) ? Zl(a.stages, e.relationships[t], !!u && e.facts.includes(u)) : null, { actions: c, actionMeanings: d, events: l, ...h } = r, f = {
    actions: d,
    performance: i
  }, g = {
    memory: n?.text ?? null,
    events: l,
    ...h,
    opening: e.conversations[t].some((v) => v.kind === "dialogue") || !De(t) && e.facts.includes(Ne[t].complete) ? null : r.rescued ? a.opening.returned : a.opening.initial,
    stage: o
  };
  return {
    systemPrompt: [
      a.system.trim(),
      Xt("background", a.world.trim()),
      Xt("player", `${a.player.trim()}

${JSON.stringify({
        ...e.traveler,
        outfit: Bt[e.outfit].detail,
        equipment: wt[e.weapon].equipment
      }, null, 2)}`),
      Xt("NPCs", `${a.npcs}

${a.character.trim()}`)
    ].join(`

`),
    messages: [
      {
        role: "user",
        content: `${Xt("meta_protocol", `${a.protocol.trim()}

${Xt("operations", JSON.stringify(f, null, 2))}`)}

<story>
${JSON.stringify(g, null, 2)}`
      },
      ...ql(e.conversations[t].length ? e.conversations[t].slice(Wl(e.conversations[t], n)) : [Ss(e, t)]),
      {
        role: "user",
        content: `${s}
</story>

${Fl(r.person)}`
      }
    ]
  };
}
var Wn = Object.freeze({
  trigger: 128e3,
  inputBudget: 158e3,
  recentExchanges: 5,
  outputTokens: 6e3
});
function Yl(e, t, s, a) {
  const n = Gl(e, t, s, a), r = Hs({ messages: [{
    role: "system",
    content: n.systemPrompt
  }, ...n.messages] }), i = Ta(n.systemPrompt), u = Ta(e.memories[t]?.text ?? ""), o = Ta(JSON.stringify(n.messages.slice(1, -1)));
  return {
    used: r,
    system: i,
    memory: u,
    history: o,
    situation: Math.max(0, r - i - u - o),
    limit: Wn.inputBudget,
    trigger: Wn.trigger
  };
}
var Ql = ["aria-label", "aria-expanded"], Kl = {
  class: "ember-affection-heart",
  viewBox: "2 3 20 19",
  "aria-hidden": "true"
}, Xl = ["offset"], Jl = ["offset"], ec = ["fill"], tc = ["aria-label", "aria-expanded"], ac = {
  key: 1,
  class: "ember-meter-popover"
}, nc = ["aria-label"], sc = { class: "ember-meter-total" }, rc = { key: 0 }, oc = { class: "ember-meter-total" }, ic = { key: 2 }, lc = { role: "status" }, cc = /* @__PURE__ */ He({
  __name: "ConversationMeters",
  props: {
    campaign: {},
    person: {},
    draft: {}
  },
  setup(e) {
    const t = e, s = Ht(null), a = B(null), n = B(0), r = B("");
    let i = null, u;
    async function o() {
      i?.abort(), i = new AbortController();
      const v = i;
      s.value = null, r.value = "";
      try {
        const b = await Nl(t.person, v.signal);
        v.signal.aborted || (s.value = b);
      } catch (b) {
        v.signal.aborted || (r.value = Et(b));
      }
    }
    pe(() => t.person, () => {
      a.value = null, n.value = 0, o();
    }, { immediate: !0 });
    const c = X(() => De(t.person) ? t.campaign.relationships[t.person].affection : 0), d = `ember-affection-${Qn()}`, l = X(() => `${100 - c.value}%`), h = X(() => s.value?.stages[dn(c.value)]?.name ?? ""), f = X(() => s.value ? Yl(t.campaign, t.person, t.draft, s.value) : null);
    pe(c, (v, b) => {
      u && clearTimeout(u), n.value = v - b, u = setTimeout(() => {
        n.value = 0;
      }, 2200);
    }), Kn(() => (a.value = null, !0), () => !!a.value), _t(() => {
      i?.abort(), u && clearTimeout(u);
    });
    const g = (v) => `${(v / 1e3).toFixed(1)}k`;
    return (v, b) => (P(), E("div", {
      class: "ember-meters",
      onKeydown: b[3] || (b[3] = Ws(ut((x) => a.value = null, ["stop"]), ["esc"]))
    }, [
      m(De)(e.person) ? (P(), E("button", {
        key: 0,
        type: "button",
        class: "ember-meter-button",
        "aria-label": m(he).affection,
        "aria-expanded": a.value === "affection",
        onClick: b[0] || (b[0] = (x) => a.value = a.value === "affection" ? null : "affection")
      }, [(P(), E("svg", Kl, [k("defs", null, [k("linearGradient", {
        id: d,
        x1: "0",
        y1: "4",
        x2: "0",
        y2: "21",
        gradientUnits: "userSpaceOnUse"
      }, [k("stop", {
        offset: l.value,
        class: "ember-affection-empty"
      }, null, 8, Xl), k("stop", {
        offset: l.value,
        class: "ember-affection-filled"
      }, null, 8, Jl)])]), k("path", {
        d: "M12 21C10.6 19.8 3 14.7 3 8.5C3 5.9 5.1 4 7.5 4C9.4 4 11 5 12 6.5C13 5 14.6 4 16.5 4C18.9 4 21 5.9 21 8.5C21 14.7 13.4 19.8 12 21Z",
        fill: `url(#${d})`
      }, null, 8, ec)])), n.value ? (P(), E("small", {
        key: 0,
        class: At(["ember-affection-change", { "is-down": n.value < 0 }]),
        role: "status"
      }, C(n.value > 0 ? "+" : "") + C(n.value), 3)) : Y("", !0)], 8, Ql)) : Y("", !0),
      k("button", {
        type: "button",
        class: "ember-meter-button",
        "aria-label": m(he).context,
        "aria-expanded": a.value === "context",
        onClick: b[1] || (b[1] = (x) => a.value = a.value === "context" ? null : "context")
      }, [k("span", {
        class: At(["ember-meter-ring", { "is-warning": f.value && f.value.used >= f.value.trigger }]),
        style: na({ "--meter-fill": `${Math.min(1, (f.value?.used ?? 0) / (f.value?.limit ?? 1)) * 360}deg` })
      }, [...b[4] || (b[4] = [k("span", null, null, -1)])], 6)], 8, tc),
      a.value ? (P(), E("section", ac, [
        k("header", null, [k("strong", null, C(a.value === "affection" ? m(he).affection : m(he).context), 1), k("button", {
          type: "button",
          "aria-label": m(he).close,
          onClick: b[2] || (b[2] = (x) => a.value = null)
        }, "×", 8, nc)]),
        a.value === "affection" ? (P(), E(re, { key: 0 }, [k("p", sc, [Ze(C(c.value) + " ", 1), b[5] || (b[5] = k("small", null, "/ 100", -1))]), r.value ? Y("", !0) : (P(), E("p", rc, C(h.value || m(he).loading), 1))], 64)) : f.value ? (P(), E(re, { key: 1 }, [
          k("p", oc, C(g(f.value.used)) + " / " + C(g(f.value.limit)), 1),
          k("dl", null, [(P(!0), E(re, null, Oe(m(he).contextParts, (x, _) => (P(), E(re, { key: _ }, [k("dt", null, C(x), 1), k("dd", null, C(g(f.value[_])), 1)], 64))), 128))]),
          k("p", null, C(m(he).threshold(f.value.trigger - f.value.used)), 1),
          k("small", null, C(m(he).estimate), 1)
        ], 64)) : r.value ? Y("", !0) : (P(), E("p", ic, C(m(he).loading), 1)),
        r.value ? (P(), E(re, { key: 3 }, [k("p", lc, C(r.value), 1), k("button", {
          type: "button",
          onClick: o
        }, C(m(he).retry), 1)], 64)) : Y("", !0)
      ])) : Y("", !0)
    ], 32));
  }
}), uc = /* @__PURE__ */ gt(cc, [["__scopeId", "data-v-ea63f6c2"]]), dc = ["aria-label"], hc = { class: "ember-weapon-layout" }, fc = { class: "ember-weapon-list" }, pc = ["name", "value"], mc = {
  class: "ember-weapon-profile",
  "aria-live": "polite",
  "aria-atomic": "true"
}, vc = ["src"], gc = { class: "ember-weapon-skill" }, yc = /* @__PURE__ */ He({
  __name: "WeaponSelection",
  props: {
    modelValue: { required: !0 },
    modelModifiers: {}
  },
  emits: ["update:modelValue"],
  setup(e) {
    const t = Vn(e, "modelValue"), s = Qn();
    return (a, n) => (P(), E("fieldset", {
      class: "ember-weapon-selector",
      "aria-label": m(ue).chooseWeapon
    }, [k("div", hc, [k("div", fc, [(P(!0), E(re, null, Oe(m(ls), (r) => (P(), E("label", {
      key: r,
      class: At({ "is-selected": t.value === r })
    }, [
      Wt(k("input", {
        "onUpdate:modelValue": n[0] || (n[0] = (i) => t.value = i),
        type: "radio",
        name: m(s),
        value: r
      }, null, 8, pc), [[Yn, t.value]]),
      Ye($t, { name: r }, null, 8, ["name"]),
      k("span", null, C(m(wt)[r].name), 1)
    ], 2))), 128))]), k("div", mc, [
      (P(), E("img", {
        key: t.value,
        class: "ember-weapon-art",
        src: m(qi)[t.value],
        alt: "",
        decoding: "async",
        width: "640",
        height: "640"
      }, null, 8, vc)),
      k("h3", null, C(m(wt)[t.value].name), 1),
      k("p", null, C(m(wt)[t.value].detail), 1),
      k("div", gc, [k("strong", null, C(m(wt)[t.value].action), 1), k("p", null, C(m(wt)[t.value].skill), 1)])
    ])])], 8, dc));
  }
}), bc = /* @__PURE__ */ gt(yc, [["__scopeId", "data-v-0c0d4e2b"]]), wc = ["src"], xc = /* @__PURE__ */ He({
  __name: "WorldFrontispiece",
  setup(e) {
    const t = B(null), s = B(null), a = new ResizeObserver((n) => {
      const { width: r, height: i } = n[0].contentRect;
      s.value = r <= 700 && i > r;
    });
    return Ot(() => a.observe(t.value)), _t(() => a.disconnect()), (n, r) => (P(), E("div", {
      ref_key: "root",
      ref: t,
      class: "ember-frontispiece",
      "aria-hidden": "true"
    }, [s.value !== null ? (P(), E("img", {
      key: 0,
      src: s.value ? m(en).cityMobile : m(en).city,
      alt: "",
      fetchpriority: "high",
      decoding: "async",
      width: "1376",
      height: "768"
    }, null, 8, wc)) : Y("", !0)], 512));
  }
}), Mc = /* @__PURE__ */ gt(xc, [["__scopeId", "data-v-f5a6e0d9"]]), kc = ["aria-label"], _c = {
  key: 0,
  class: "entry-title"
}, Sc = { class: "entry-city" }, Rc = ["aria-label"], Cc = ["disabled"], zc = ["disabled"], Pc = ["disabled"], $c = ["disabled"], Ec = {
  key: 0,
  class: "entry-save"
}, Ic = ["disabled"], Lc = { for: "ember-traveler-name" }, Ac = ["maxlength", "placeholder"], Tc = ["value"], jc = {
  class: "entry-primary",
  type: "submit"
}, Oc = {
  key: 1,
  class: "entry-chapters"
}, Zc = ["src"], Uc = {
  class: "entry-numeral",
  "aria-hidden": "true"
}, Nc = { class: "entry-chapter-body" }, Dc = { key: 0 }, Fc = { class: "entry-forthcoming" }, Bc = { class: "entry-traveler" }, qc = {
  key: 0,
  class: "entry-restart"
}, Wc = ["disabled"], Hc = {
  key: 0,
  "aria-hidden": "true"
}, Vc = /* @__PURE__ */ He({
  __name: "JourneyEntry",
  props: {
    campaign: {},
    ready: { type: Boolean },
    busy: { type: Boolean },
    blocked: { type: Boolean }
  },
  emits: ["start", "continue"],
  setup(e, { expose: t, emit: s }) {
    const a = e, n = s, r = B("title"), i = B(!1), u = B(a.campaign?.traveler.name ?? ""), o = B(a.campaign?.traveler.gender ?? null), c = B(a.campaign?.weapon ?? "blade"), d = B(!1), l = B(null), h = B(null), f = X(() => ({
      title: Z.title,
      identity: ue.identity,
      chapters: ue.chooseChapter,
      weapon: ue.chooseWeapon
    })[r.value]);
    pe(r, async () => {
      await qt(), h.value && (h.value.scrollTop = 0), l.value?.focus({ preventScroll: !0 });
    });
    function g() {
      i.value = !0, d.value = !1, r.value = "identity";
    }
    function v() {
      u.value.trim() && o.value && (u.value = u.value.trim(), r.value = "chapters");
    }
    function b() {
      r.value = r.value === "weapon" ? "chapters" : r.value === "chapters" && i.value ? "identity" : "title";
    }
    function x() {
      a.campaign && !i.value ? n("continue") : r.value = "weapon";
    }
    function _() {
      !o.value || !u.value.trim() || a.blocked || a.campaign && !d.value || n("start", {
        traveler: {
          name: u.value.trim(),
          gender: o.value
        },
        weapon: c.value,
        chapter: It.id
      });
    }
    return t({ back: () => r.value === "title" ? !1 : (b(), !0) }), (p, w) => (P(), E("section", {
      class: At(["ember-entry", { "is-title": r.value === "title" }]),
      "aria-label": m(Z).title
    }, [
      Ye(Mc),
      w[10] || (w[10] = k("div", { class: "entry-shade" }, null, -1)),
      r.value === "title" ? (P(), E("div", _c, [
        k("p", Sc, C(m(ue).city), 1),
        k("h1", {
          ref_key: "heading",
          ref: l,
          tabindex: "-1"
        }, C(m(Z).title), 513),
        k("nav", { "aria-label": m(Z).title }, [
          e.campaign ? (P(), E("button", {
            key: 0,
            class: "entry-primary",
            type: "button",
            disabled: !e.ready || e.blocked,
            onClick: w[0] || (w[0] = (M) => n("continue"))
          }, [Ze(C(m(Z).resume), 1), w[6] || (w[6] = k("span", { "aria-hidden": "true" }, "→", -1))], 8, Cc)) : (P(), E("button", {
            key: 1,
            class: "entry-primary",
            type: "button",
            disabled: !e.ready || e.blocked,
            onClick: g
          }, [Ze(C(e.ready ? m(ue).begin : m(ue).loading), 1), w[7] || (w[7] = k("span", { "aria-hidden": "true" }, "→", -1))], 8, zc)),
          e.campaign ? (P(), E("button", {
            key: 2,
            type: "button",
            disabled: !e.ready || e.blocked,
            onClick: w[1] || (w[1] = (M) => {
              i.value = !1, r.value = "chapters";
            })
          }, C(m(ue).chapters), 9, Pc)) : Y("", !0),
          e.campaign ? (P(), E("button", {
            key: 3,
            type: "button",
            disabled: !e.ready || e.blocked,
            onClick: g
          }, C(m(ue).newJourney), 9, $c)) : Y("", !0)
        ], 8, Rc),
        e.campaign ? (P(), E("p", Ec, [k("span", null, C(e.campaign.traveler.name), 1), k("span", null, C(m(_s)), 1)])) : Y("", !0)
      ])) : (P(), E("div", {
        key: 1,
        ref_key: "sheet",
        ref: h,
        class: "entry-sheet"
      }, [
        k("header", null, [k("button", {
          type: "button",
          disabled: e.busy,
          onClick: b
        }, "← " + C(m(ue).back), 9, Ic), k("span", null, C(m(Z).title), 1)]),
        k("h2", {
          ref_key: "heading",
          ref: l,
          tabindex: "-1"
        }, C(f.value), 513),
        r.value === "identity" ? (P(), E("form", {
          key: 0,
          class: "entry-identity",
          onSubmit: ut(v, ["prevent"])
        }, [
          k("label", Lc, C(m(ue).name), 1),
          Wt(k("input", {
            id: "ember-traveler-name",
            "onUpdate:modelValue": w[2] || (w[2] = (M) => u.value = M),
            maxlength: m(24),
            placeholder: m(ue).namePlaceholder,
            required: "",
            autocomplete: "off",
            pattern: ".*\\S.*"
          }, null, 8, Ac), [[an, u.value]]),
          k("fieldset", null, [k("legend", null, C(m(ue).gender), 1), (P(!0), E(re, null, Oe(m(ks), (M) => (P(), E("label", { key: M }, [Wt(k("input", {
            "onUpdate:modelValue": w[3] || (w[3] = (S) => o.value = S),
            type: "radio",
            name: "ember-traveler-gender",
            value: M,
            required: ""
          }, null, 8, Tc), [[Yn, o.value]]), k("span", null, C(m(ue).genders[M]), 1)]))), 128))]),
          k("button", jc, [Ze(C(m(ue).next), 1), w[8] || (w[8] = k("span", { "aria-hidden": "true" }, "→", -1))])
        ], 32)) : r.value === "chapters" ? (P(), E("div", Oc, [k("button", {
          type: "button",
          class: "entry-chapter",
          onClick: x
        }, [
          k("img", {
            class: "entry-chapter-art",
            src: m(en).chapter,
            alt: "",
            decoding: "async"
          }, null, 8, Zc),
          k("span", Uc, C(m(It).numeral), 1),
          k("span", Nc, [
            k("small", null, C(m(It).number), 1),
            k("strong", null, C(m(It).title), 1),
            k("span", null, C(m(Z).opening), 1),
            e.campaign && !i.value ? (P(), E("small", Dc, C(e.campaign.facts.includes("chapter_completed") ? m(ue).completeChapter : m(ue).currentChapter), 1)) : Y("", !0)
          ]),
          w[9] || (w[9] = k("span", {
            class: "entry-chapter-arrow",
            "aria-hidden": "true"
          }, "→", -1))
        ]), k("div", Fc, [k("span", null, C(m(ue).nextChapter), 1), k("span", null, C(m(ue).forthcoming), 1)])])) : (P(), E("form", {
          key: 2,
          class: "entry-loadout",
          onSubmit: ut(_, ["prevent"])
        }, [
          k("p", Bc, [k("strong", null, C(u.value), 1), k("span", null, C(o.value ? m(ue).genders[o.value] : "") + " · " + C(m(ue).identityRole), 1)]),
          Ye(bc, {
            modelValue: c.value,
            "onUpdate:modelValue": w[4] || (w[4] = (M) => c.value = M)
          }, null, 8, ["modelValue"]),
          e.campaign ? (P(), E("label", qc, [Wt(k("input", {
            "onUpdate:modelValue": w[5] || (w[5] = (M) => d.value = M),
            type: "checkbox",
            required: ""
          }, null, 512), [[Bs, d.value]]), k("span", null, C(m(ue).restartWarning), 1)])) : Y("", !0),
          k("button", {
            class: "entry-primary",
            type: "submit",
            disabled: e.blocked
          }, [Ze(C(e.busy ? m(ue).entering : e.campaign ? m(ue).confirmRestart : m(ue).enter), 1), e.busy ? Y("", !0) : (P(), E("span", Hc, "→"))], 8, Wc)
        ], 32))
      ], 512))
    ], 10, kc));
  }
}), Gc = /* @__PURE__ */ gt(Vc, [["__scopeId", "data-v-93861d5f"]]), Yc = [
  "aria-label",
  "title",
  "disabled"
], Qc = ["disabled"], Kc = [
  "maxlength",
  "aria-label",
  "placeholder"
], Xc = ["aria-label", "title"], Jc = [
  "aria-label",
  "title",
  "disabled"
], eu = /* @__PURE__ */ He({
  __name: "DialogueComposer",
  props: /* @__PURE__ */ yn({
    blocked: { type: Boolean },
    talking: { type: Boolean },
    canRegenerate: { type: Boolean },
    retrying: { type: Boolean },
    conclusion: {}
  }, {
    modelValue: { required: !0 },
    modelModifiers: {}
  }),
  emits: /* @__PURE__ */ yn([
    "send",
    "cancel",
    "regenerate",
    "continue"
  ], ["update:modelValue"]),
  setup(e, { emit: t }) {
    const s = Vn(e, "modelValue"), a = e, n = t, r = B(null), i = B(!1);
    let u = null, o = 0;
    function c() {
      r.value && (r.value.style.height = "44px", r.value.style.height = `${Math.min(132, r.value.scrollHeight + 2)}px`);
    }
    function d() {
      !a.blocked && s.value.trim() && n("send");
    }
    function l(h) {
      Vs(h, i.value) && (h.preventDefault(), d());
    }
    return pe(s, async () => {
      await qt(), c();
    }), pe(r, (h, f) => {
      f && u?.unobserve(f), h && (c(), u?.observe(h));
    }, { flush: "post" }), Ot(() => {
      c(), u = new ResizeObserver((h) => {
        const f = h[0].contentRect.width;
        f !== o && (o = f, c());
      }), r.value && u.observe(r.value);
    }), _t(() => u?.disconnect()), (h, f) => (P(), E("form", {
      class: "ember-composer",
      onSubmit: ut(d, ["prevent"])
    }, [
      k("button", {
        class: "ember-regenerate",
        type: "button",
        "aria-label": e.retrying ? m(he).retrySend : m(he).regenerate,
        title: e.retrying ? m(he).retrySend : m(he).regenerate,
        disabled: e.blocked || !e.canRegenerate,
        onClick: f[0] || (f[0] = (g) => n("regenerate"))
      }, [...f[6] || (f[6] = [k("svg", {
        viewBox: "0 0 24 24",
        "aria-hidden": "true"
      }, [k("path", { d: "M4 10a8 8 0 1 1 1 7M4 4v6h6" })], -1)])], 8, Yc),
      e.conclusion ? (P(), E("button", {
        key: 0,
        class: "ember-continue",
        type: "button",
        disabled: e.blocked,
        onClick: f[1] || (f[1] = (g) => n("continue"))
      }, [Ze(C(e.conclusion === "fight" ? m(he).fight : m(he).continue), 1), f[7] || (f[7] = k("span", { "aria-hidden": "true" }, "→", -1))], 8, Qc)) : Wt((P(), E("textarea", {
        key: 1,
        ref_key: "input",
        ref: r,
        "onUpdate:modelValue": f[2] || (f[2] = (g) => s.value = g),
        rows: "1",
        maxlength: m(ta).playerTextLimit,
        "aria-label": m(Z).input,
        placeholder: m(Z).input,
        enterkeyhint: "enter",
        onKeydown: l,
        onCompositionstart: f[3] || (f[3] = (g) => i.value = !0),
        onCompositionend: f[4] || (f[4] = (g) => i.value = !1)
      }, null, 40, Kc)), [[an, s.value]]),
      e.talking ? (P(), E("button", {
        key: 2,
        type: "button",
        "aria-label": m(Z).cancel,
        title: m(Z).cancel,
        onClick: f[5] || (f[5] = (g) => n("cancel"))
      }, [...f[8] || (f[8] = [k("svg", {
        viewBox: "0 0 24 24",
        "aria-hidden": "true"
      }, [k("rect", {
        x: "6",
        y: "6",
        width: "12",
        height: "12",
        rx: "2"
      })], -1)])], 8, Xc)) : e.conclusion ? Y("", !0) : (P(), E("button", {
        key: 3,
        type: "submit",
        "aria-label": m(Z).send,
        title: m(Z).send,
        disabled: e.blocked || !s.value.trim()
      }, [...f[9] || (f[9] = [k("svg", {
        viewBox: "0 0 24 24",
        "aria-hidden": "true"
      }, [k("path", { d: "M12 19V5m-6 6 6-6 6 6" })], -1)])], 8, Jc))
    ], 32));
  }
}), tu = /* @__PURE__ */ gt(eu, [["__scopeId", "data-v-640a5540"]]), au = "" + new URL("ember-assets/sanniang-body-B_tq-dMO.webp", import.meta.url).href, nu = "" + new URL("ember-assets/sanniang-arm-Bm6H1dRj.webp", import.meta.url).href, su = "" + new URL("ember-assets/sanniang-neutral-DXTdZp3i.webp", import.meta.url).href, ru = "" + new URL("ember-assets/sanniang-smile-noV3jnDd.webp", import.meta.url).href, ou = "" + new URL("ember-assets/sanniang-teasing-Dg0_1bnn.webp", import.meta.url).href, iu = "" + new URL("ember-assets/sanniang-blush-CCS7mL7q.webp", import.meta.url).href, lu = "" + new URL("ember-assets/sanniang-relaxed-DW4eA74n.webp", import.meta.url).href, cu = "" + new URL("ember-assets/sanniang-serious-CwUT-_7U.webp", import.meta.url).href, uu = "" + new URL("ember-assets/sanniang-worried-BfIdgkTU.webp", import.meta.url).href, du = "" + new URL("ember-assets/sanniang-sad-COe1aNTp.webp", import.meta.url).href, hu = "" + new URL("ember-assets/sanniang-displeased-C2M9rHVA.webp", import.meta.url).href, fu = "" + new URL("ember-assets/sanniang-fond-BPtREJDc.webp", import.meta.url).href, pu = "" + new URL("ember-assets/sanniang-laugh-DiCXV8k0.webp", import.meta.url).href, mu = "" + new URL("ember-assets/sanniang-surprised-BV1JYuTz.webp", import.meta.url).href, vu = "" + new URL("ember-assets/anian-body-DCOYRRf4.webp", import.meta.url).href, gu = "" + new URL("ember-assets/anian-neutral-CUA1T09A.webp", import.meta.url).href, yu = "" + new URL("ember-assets/anian-arm-CxeZ5EK2.webp", import.meta.url).href, bu = "" + new URL("ember-assets/anian-blush-C8gvbv5I.webp", import.meta.url).href, wu = "" + new URL("ember-assets/anian-displeased-Dy2sm-18.webp", import.meta.url).href, xu = "" + new URL("ember-assets/anian-fond-WFHkgJZI.webp", import.meta.url).href, Mu = "" + new URL("ember-assets/anian-laugh-D2ZZqjUz.webp", import.meta.url).href, ku = "" + new URL("ember-assets/anian-rest-B5smyaQa.webp", import.meta.url).href, _u = "" + new URL("ember-assets/anian-sad-957wfM7Z.webp", import.meta.url).href, Su = "" + new URL("ember-assets/anian-surprised-CRBE7-3g.webp", import.meta.url).href, Ru = "" + new URL("ember-assets/anian-worried-CoEnP0Ls.webp", import.meta.url).href, Cu = "" + new URL("ember-assets/anian-smile-vqfRMj9V.webp", import.meta.url).href, zu = "" + new URL("ember-assets/kouzi-body-pi_GesdX.webp", import.meta.url).href, Pu = "" + new URL("ember-assets/kouzi-neutral-BHN8FRWd.webp", import.meta.url).href, $u = "" + new URL("ember-assets/kouzi-arm-Dt1k7QS3.webp", import.meta.url).href, Eu = "" + new URL("ember-assets/kouzi-displeased-u3BA-oF8.webp", import.meta.url).href, Iu = "" + new URL("ember-assets/kouzi-fond-BNLlxNvH.webp", import.meta.url).href, Lu = "" + new URL("ember-assets/kouzi-laugh-CmRDrIYh.webp", import.meta.url).href, Au = "" + new URL("ember-assets/kouzi-sad--tSsbCmM.webp", import.meta.url).href, Tu = "" + new URL("ember-assets/kouzi-serious-CUEjL5ps.webp", import.meta.url).href, ju = "" + new URL("ember-assets/kouzi-smile-DQS1bOIn.webp", import.meta.url).href, Ou = "" + new URL("ember-assets/kouzi-surprised-D_m47QNy.webp", import.meta.url).href, Zu = "" + new URL("ember-assets/kouzi-teasing-HV1Xbjwg.webp", import.meta.url).href, Uu = "" + new URL("ember-assets/kouzi-worried-noVjOF-2.webp", import.meta.url).href, Nu = "" + new URL("ember-assets/kouzi-blush-D1R6yAj4.webp", import.meta.url).href, Du = "" + new URL("ember-assets/laobai-body-CiCiUXaK.webp", import.meta.url).href, Fu = "" + new URL("ember-assets/laobai-arm-BPcvdc_G.webp", import.meta.url).href, Bu = "" + new URL("ember-assets/laobai-neutral-BszZr6uU.webp", import.meta.url).href, qu = "" + new URL("ember-assets/laobai-smile-B6Lrl5WC.webp", import.meta.url).href, Wu = "" + new URL("ember-assets/laobai-teasing-D7aVLAY_.webp", import.meta.url).href, Hu = "" + new URL("ember-assets/laobai-laugh-C7nooIV7.webp", import.meta.url).href, Vu = "" + new URL("ember-assets/laobai-blush-DhABNQ2i.webp", import.meta.url).href, Gu = "" + new URL("ember-assets/laobai-fond-Bi7eZfNv.webp", import.meta.url).href, Yu = "" + new URL("ember-assets/laobai-serious-CWzUzqsj.webp", import.meta.url).href, Qu = "" + new URL("ember-assets/laobai-surprised-DWl6WaG1.webp", import.meta.url).href, Ku = "" + new URL("ember-assets/laobai-worried-NHYVPdJS.webp", import.meta.url).href, Xu = "" + new URL("ember-assets/laobai-sad-Dh9Oip1e.webp", import.meta.url).href, Ju = "" + new URL("ember-assets/bajin-body-CP5YAbCV.webp", import.meta.url).href, ed = "" + new URL("ember-assets/bajin-neutral-CpkizK1M.webp", import.meta.url).href, td = "" + new URL("ember-assets/bajin-arm-BokEMFK-.webp", import.meta.url).href, ad = "" + new URL("ember-assets/bajin-angry-0gZe6btz.webp", import.meta.url).href, nd = "" + new URL("ember-assets/bajin-relieved-wp9h8D8n.webp", import.meta.url).href, sd = "" + new URL("ember-assets/bajin-resigned-xaqeiOk2.webp", import.meta.url).href, rd = "" + new URL("ember-assets/bajin-suspicious-BahktpZg.webp", import.meta.url).href, od = "" + new URL("ember-assets/bajin-worried-DbSEIW6Z.webp", import.meta.url).href, id = "" + new URL("ember-assets/changyounian-body-DOfy0pe5.webp", import.meta.url).href, ld = "" + new URL("ember-assets/changyounian-neutral-Dvjv70fG.webp", import.meta.url).href, cd = "" + new URL("ember-assets/changyounian-arm-CWiq1e__.webp", import.meta.url).href, ud = "" + new URL("ember-assets/changyounian-displeased-Bd-oNqUw.webp", import.meta.url).href, dd = "" + new URL("ember-assets/changyounian-relieved-BbpArqR5.webp", import.meta.url).href, hd = "" + new URL("ember-assets/changyounian-smile-DW4L1gw7.webp", import.meta.url).href, fd = "" + new URL("ember-assets/changyounian-squint-K1sh8q-4.webp", import.meta.url).href, pd = "" + new URL("ember-assets/changyounian-worried-FQS8Z8hb.webp", import.meta.url).href, md = {
  sanniang: {
    body: au,
    arm: nu,
    heads: {
      neutral: su,
      smile: ru,
      teasing: ou,
      blush: iu,
      rest: lu,
      serious: cu,
      worried: uu,
      sad: du,
      displeased: hu,
      fond: fu,
      laugh: pu,
      surprised: mu
    },
    headOrigin: "58% 34%",
    armOrigin: "34.6% 67%",
    armDirection: 1
  },
  anian: {
    body: vu,
    arm: yu,
    heads: {
      neutral: gu,
      smile: Cu,
      blush: bu,
      displeased: wu,
      fond: xu,
      laugh: Mu,
      rest: ku,
      sad: _u,
      surprised: Su,
      worried: Ru
    },
    headOrigin: "58.140% 35.108%",
    armOrigin: "40.814% 67.258%",
    armDirection: 1
  },
  kouzi: {
    body: zu,
    arm: $u,
    heads: {
      neutral: Pu,
      blush: Nu,
      displeased: Eu,
      fond: Iu,
      laugh: Lu,
      sad: Au,
      serious: Tu,
      smile: ju,
      surprised: Ou,
      teasing: Zu,
      worried: Uu
    },
    headOrigin: "44.500% 34.677%",
    armOrigin: "74.625% 64.687%",
    armDirection: -1
  },
  laobai: {
    body: Du,
    arm: Fu,
    heads: {
      neutral: Bu,
      smile: qu,
      teasing: Wu,
      laugh: Hu,
      blush: Vu,
      fond: Gu,
      serious: Yu,
      surprised: Qu,
      worried: Ku,
      sad: Xu
    },
    headOrigin: "57.065% 33.026%",
    armOrigin: "25.543% 70.203%",
    armDirection: 1
  },
  bajin: {
    body: Ju,
    arm: td,
    heads: {
      neutral: ed,
      angry: ad,
      relieved: nd,
      resigned: sd,
      suspicious: rd,
      worried: od
    },
    headOrigin: "55.618% 32.031%",
    armOrigin: "89.888% 63.203%",
    armDirection: -1
  },
  changyounian: {
    body: id,
    arm: cd,
    heads: {
      neutral: ld,
      displeased: ud,
      relieved: dd,
      smile: hd,
      squint: fd,
      worried: pd
    },
    headOrigin: "56.559% 32.847%",
    armOrigin: "30.000% 70.620%",
    armDirection: 1
  }
}, vd = {
  nod: {
    joint: "head",
    frames: [
      "translateY(0) rotate(0)",
      "translateY(2.5px) rotate(2deg)",
      "translateY(0) rotate(0)"
    ],
    duration: 1e3
  },
  tilt: {
    joint: "head",
    frames: [
      "rotate(0)",
      "rotate(-5deg)",
      "rotate(-5deg)",
      "rotate(0)"
    ],
    duration: 1750
  },
  shake: {
    joint: "head",
    frames: [
      "rotate(0)",
      "rotate(-2deg)",
      "rotate(2deg)",
      "rotate(-1deg)",
      "rotate(0)"
    ],
    duration: 1350
  },
  gesture: {
    joint: "arm",
    angles: [
      0,
      8,
      6,
      0
    ],
    duration: 1600
  },
  withdraw: {
    joint: "arm",
    angles: [
      0,
      -8,
      -8,
      0
    ],
    duration: 1800
  }
};
function gd(e, t, s) {
  if (e === "none") return null;
  const a = vd[e], n = a.joint === "arm" ? a.angles.map((r) => `rotate(${r * s}deg)`) : a.frames;
  return t[a.joint].animate(n.map((r) => ({ transform: r })), {
    duration: a.duration,
    easing: "ease-in-out",
    iterations: 1
  });
}
var yd = ["src"], bd = ["src"], wd = ["src"], xd = /* @__PURE__ */ He({
  __name: "DialogueActor",
  props: {
    person: {},
    performance: {},
    animate: { type: Boolean }
  },
  setup(e) {
    const t = e, s = B(null), a = B(null), n = B(null), r = X(() => md[t.person]), i = B(!1), u = B(0);
    let o = 0, c = !1, d = !1, l = null, h, f;
    function g() {
      d = !0, l?.cancel(), l = null;
    }
    function v() {
      if (!(!t.animate || d || i.value || o < 3 || !c)) {
        if (document.hidden || f?.matches) {
          g();
          return;
        }
        a.value && n.value && (d = !0, l = gd(t.performance?.gesture ?? "none", {
          head: a.value,
          arm: n.value
        }, r.value.armDirection));
      }
    }
    function b() {
      o++, v();
    }
    function x() {
      i.value = !0, g();
    }
    function _() {
      o = 0, i.value = !1, u.value++;
    }
    function p() {
      document.hidden && g();
    }
    function w() {
      f?.matches && g();
    }
    return pe(() => t.animate, (M) => {
      M ? v() : g();
    }), Ot(() => {
      f = matchMedia("(prefers-reduced-motion: reduce)"), (document.hidden || f.matches) && g(), f.addEventListener("change", w), document.addEventListener("visibilitychange", p), h = new IntersectionObserver((M) => {
        c = M[0].isIntersecting && M[0].intersectionRatio >= 0.25, c ? v() : l && g();
      }, { threshold: 0.25 }), s.value && h.observe(s.value);
    }), tn(g), _t(() => {
      g(), h?.disconnect(), f?.removeEventListener("change", w), document.removeEventListener("visibilitychange", p);
    }), (M, S) => (P(), E("span", {
      ref_key: "root",
      ref: s,
      class: At(["ember-dialogue-actor", { "actor-failed": i.value }])
    }, [i.value ? (P(), E("button", {
      key: 1,
      type: "button",
      onClick: _
    }, C(m(he).reloadArtwork), 1)) : (P(), E(re, { key: 0 }, [
      (P(), E("img", {
        key: "body-" + u.value,
        src: r.value.body,
        alt: "",
        width: "420",
        height: "495",
        decoding: "async",
        loading: "lazy",
        onLoad: b,
        onError: x
      }, null, 40, yd)),
      (P(), E("img", {
        key: "head-" + u.value,
        ref_key: "head",
        ref: a,
        class: "actor-head",
        src: r.value.heads[e.performance?.expression ?? "neutral"],
        style: na({ transformOrigin: r.value.headOrigin }),
        alt: "",
        width: "420",
        height: "495",
        decoding: "async",
        loading: "lazy",
        onLoad: b,
        onError: x
      }, null, 44, bd)),
      (P(), E("img", {
        key: "arm-" + u.value,
        ref_key: "arm",
        ref: n,
        class: "actor-arm",
        src: r.value.arm,
        style: na({ transformOrigin: r.value.armOrigin }),
        alt: "",
        width: "420",
        height: "495",
        decoding: "async",
        loading: "lazy",
        onLoad: b,
        onError: x
      }, null, 44, wd))
    ], 64))], 2));
  }
}), Md = /* @__PURE__ */ gt(xd, [["__scopeId", "data-v-606c2ccc"]]), kd = { class: "ember-npc-bubble" }, _d = { class: "ember-npc-line" }, Sd = /* @__PURE__ */ He({
  __name: "DialogueBubble",
  props: {
    person: {},
    reply: {},
    performance: {},
    animate: { type: Boolean }
  },
  setup(e) {
    return (t, s) => (P(), E("div", kd, [Ye(Md, {
      person: e.person,
      performance: e.performance,
      animate: e.animate
    }, null, 8, [
      "person",
      "performance",
      "animate"
    ]), k("p", _d, C(e.reply), 1)]));
  }
}), Hn = /* @__PURE__ */ gt(Sd, [["__scopeId", "data-v-83753490"]]), Rd = { class: "ember-campaign" }, Cd = { class: "ember-health" }, zd = [
  "max",
  "value",
  "aria-label"
], Pd = { class: "ember-objective" }, $d = { class: "ember-save" }, Ed = ["aria-label"], Id = ["aria-label"], Ld = ["aria-label"], Ad = ["aria-label"], Td = ["aria-label"], jd = {
  key: 3,
  class: "ember-boss"
}, Od = [
  "max",
  "value",
  "aria-label"
], Zd = {
  key: 4,
  class: "ember-alarm"
}, Ud = ["aria-label"], Nd = ["disabled"], Dd = ["disabled"], Fd = {
  key: 6,
  class: "ember-conversation-notice",
  role: "status"
}, Bd = { key: 0 }, qd = { class: "ember-prose" }, Wd = ["aria-label"], Hd = {
  key: 0,
  class: "ember-panel-heading"
}, Vd = ["aria-label"], Gd = ["aria-pressed"], Yd = ["aria-pressed"], Qd = ["disabled"], Kd = { class: "ember-prose ember-prologue" }, Xd = { class: "ember-objective-panel" }, Jd = { class: "ember-journal" }, e1 = { class: "ember-pack-heading" }, t1 = { key: 0 }, a1 = { key: 1 }, n1 = { class: "ember-relics" }, s1 = { key: 0 }, r1 = ["disabled", "onClick"], o1 = { class: "ember-dialogue-heading" }, i1 = { class: "ember-person-heading" }, l1 = ["disabled"], c1 = {
  key: 0,
  class: "ember-player-line"
}, u1 = {
  key: 1,
  class: "ember-dialogue-issue"
}, d1 = { key: 2 }, h1 = { class: "ember-prose" }, f1 = {
  key: 3,
  class: "ember-prose"
}, p1 = ["aria-busy"], m1 = {
  key: 0,
  class: "ember-dialogue-issue",
  role: "status"
}, v1 = {
  key: 2,
  class: "ember-dialogue-issue",
  role: "status"
}, g1 = { key: 0 }, y1 = { class: "ember-prose" }, b1 = { key: 3 }, w1 = {
  key: 6,
  class: "ember-prose"
}, x1 = ["src"], M1 = { class: "ember-prose" }, k1 = ["src"], _1 = { class: "ember-prose" }, S1 = { class: "ember-continued" }, R1 = { class: "ember-relics" }, C1 = ["disabled", "onClick"], z1 = ["disabled"], P1 = { class: "ember-prose" }, $1 = ["disabled"], E1 = ["disabled"], I1 = ["disabled"], L1 = { class: "ember-pause-actions" }, A1 = ["aria-pressed"], T1 = { class: "ember-help ember-keyboard-help" }, j1 = { class: "ember-help ember-touch-help" }, O1 = /* @__PURE__ */ He({
  __name: "ExpeditionRoom",
  props: {
    bridge: {},
    chatIdentity: {},
    generationActive: { type: Boolean }
  },
  setup(e) {
    const t = e, s = po(t.bridge, t.chatIdentity), a = mo(s), { view: n, notice: r, busy: i, blocked: u, talking: o, outgoing: c, conversationFailure: d } = s, { current: l, dirty: h } = a, f = B(!0), g = B(!1), v = B(!1), b = B(0), x = B(!1), _ = B(null), p = B(null), w = B("relics"), M = X(() => p.value === "map" ? Z.map : p.value === "journal" ? Z.journal : p.value === "build" ? Z.build : p.value === "person" ? pt(S.value) : p.value === "passage" ? oe.passages[I.value].title : p.value === "arrival" ? oe.scenes.camp : p.value === "ending" || p.value === "prologue" ? _s : l.value?.phase === "reward" ? Z.reward : l.value?.phase === "lost" ? Z.fallen : Z.pause), S = B("sanniang"), I = B("warning"), A = B(null), L = B({}), $ = X({
      get: () => L.value[S.value] ?? "",
      set: (N) => {
        L.value[S.value] = N;
      }
    }), O = B(null), T = B(!1), V = /* @__PURE__ */ new Map(), ee = B(null), F = B(null), U = B(null), H = X((N) => {
      const D = l.value?.facts ?? [];
      return N && N.size === D.length && D.every((j) => N.has(j)) ? N : new Set(D);
    }), ie = X(() => l.value ? {
      definition: Ce[l.value.location.scene],
      location: l.value.location,
      facts: H.value,
      people: l.value.people
    } : null), ot = X(() => l.value ? { "--scene-art": `url("${As[l.value.location.scene]}")` } : void 0), Me = X(() => l.value?.outfit ?? n.value?.data.equippedOutfit ?? "traveler"), le = X(() => l.value ? Rs(l.value) : null), we = X(() => l.value?.pendingParley ? l.value.pendingParley.decision === "attack" ? "fight" : "continue" : le.value ? "continue" : void 0), Je = X(() => !x.value || !l.value || !!l.value.pendingParley || !!le.value || f.value || !!p.value || !!r.value || o.value || v.value || t.generationActive || !["exploration", "battle"].includes(l.value.phase) || !n.value?.ready || n.value.pending || n.value.writeState !== "ready"), Fe = X(() => l.value?.battle?.enemies.find((N) => xe(N.kind))), Be = X(() => l.value?.conversations[S.value] ?? []), Ve = X(() => l.value && !Be.value.length ? Ss(l.value, S.value) : null), Pe = X(() => O.value?.person === S.value ? {
      ...O.value,
      status: T.value ? "sending" : "failed"
    } : c.value?.person === S.value && !c.value.regenerating && !Be.value.some((N) => N.id === c.value?.actionId) ? c.value : null), Ie = X(() => Pe.value?.status === "failed"), yt = X(() => l.value && Ya(l.value)?.person === S.value), ce = B(null), qe = X(() => l.value?.collection.map((N) => {
      const D = l.value.equipped.includes(N.id) ? l.value.equipped.filter((j) => j !== N.id) : [...l.value.equipped, N.id];
      return {
        ...N,
        equipped: D,
        issue: oo(l.value, D)
      };
    }) ?? []), et = vo(() => {
      s.error.value = te.presentationError.sound, g.value = !1;
    });
    let Zt = !1;
    function Yt() {
      (p.value || l.value && ["exploration", "battle"].includes(l.value.phase)) && ke();
    }
    async function oa() {
      await We({ type: "resolve_parley" }) && (p.value = null, await qt(), U.value?.focus());
    }
    async function ye() {
      le.value ? await We({ type: "accept_reply" }) : await oa();
    }
    xn(A, Yt), Kn(() => x.value ? p.value ? (Yt(), !0) : f.value ? !1 : (Le(), !0) : _.value?.back() ?? !1), xn(F, () => {
      !i.value && !v.value && !t.generationActive && s.dismissError();
    });
    function Le() {
      f.value = !0, a.flush();
    }
    function bt() {
      p.value = null, Le();
    }
    async function Ge(N) {
      f.value = !0, p.value = N, N === "build" && (w.value = "relics"), await a.flush();
    }
    async function ke() {
      if (!le.value) {
        if (l.value?.pendingParley) {
          l.value.pendingParley.decision === "pass" && await oa();
          return;
        }
        !r.value && !t.generationActive && (x.value = !0, p.value = null, f.value = !1, await qt(), U.value?.focus());
      }
    }
    function W() {
      x.value = !0, l.value?.pendingParley || le.value ? (S.value = l.value?.pendingParley?.enemy ?? le.value, p.value = "person", f.value = !0) : ke();
    }
    async function We(N) {
      if (f.value = !0, !await a.flush()) return !1;
      const D = await s.act(N);
      return D && (a.sync(), f.value = !1, p.value || (await qt(), U.value?.focus())), D;
    }
    async function G(N) {
      await We({
        type: l.value ? "restart" : "start",
        ...N,
        outfit: Me.value
      }) && (x.value = !0, p.value = "prologue");
    }
    function $a() {
      f.value = !0, p.value = null, x.value = !1, a.flush();
    }
    async function Ut(N) {
      if (!l.value) return;
      f.value = !0;
      const D = [...xs(l.value), ...Ca(l.value.location.scene, l.value.location.position, new Set(l.value.facts))].find((_e) => _e.target.id === N), j = D?.kind === "object" ? D.target : null;
      if (j?.kind === "person" || j?.kind === "enemy") {
        const _e = j.kind === "person" ? j.person : j.enemy;
        S.value = _e, p.value = "person", await a.flush() && !l.value.conversations[_e].length && await s.act({
          type: "greet",
          person: _e
        }) && a.sync();
        return;
      }
      await We({
        type: "interact",
        id: N
      }) && j?.kind === "inspect" && (I.value = j.passage, p.value = "passage");
    }
    async function Qt() {
      const N = S.value, D = $.value.trim();
      if (!(u.value || T.value || !D || we.value)) {
        L.value[N] = "", O.value = {
          person: N,
          text: D
        }, T.value = !0, V.delete(N);
        try {
          if (!await a.flush()) return;
          const j = s.talk(N, D);
          O.value = null, await j && a.sync();
        } finally {
          T.value = !1;
        }
      }
    }
    async function Kt() {
      if (!(u.value || T.value || !l.value))
        if (V.delete(S.value), Ie.value && Pe.value) {
          const N = Pe.value, D = s.talk(N.person, N.text);
          O.value = null, await D && a.sync();
        } else {
          const N = Ya(l.value);
          N?.person === S.value && await s.talk(S.value, N.turn.player, N.turn.id) && a.sync();
        }
    }
    function ia() {
      const N = ee.value;
      N && V.set(S.value, {
        top: N.scrollTop,
        latest: N.scrollHeight - N.clientHeight - N.scrollTop < 32
      });
    }
    function Nt() {
      const N = ee.value;
      if (!N || V.get(S.value)?.latest === !1) return;
      const D = ce.value ? N.querySelector('[data-fresh-reply="true"]') : null;
      N.scrollTop = D && D.offsetHeight > N.clientHeight ? D.getBoundingClientRect().top - N.getBoundingClientRect().top + N.scrollTop - 12 : N.scrollHeight;
    }
    async function it() {
      await a.recover() && (f.value = !0, b.value++);
    }
    return pe(() => t.generationActive, (N) => {
      N && Le();
    }), pe(() => [l.value?.pendingParley, le.value], ([N, D]) => {
      (N || D) && (S.value = N?.enemy ?? D, p.value = "person", f.value = !0);
    }, { immediate: !0 }), pe(g, (N) => {
      et.enable(N);
    }), pe(l, (N) => {
      g.value && N?.battle && et.tick(N.battle);
    }), pe(() => n.value?.data, (N, D) => {
      if (!N?.active || !D?.active || N.active.id !== D.active.id) return;
      const j = new Set(D.active.facts), _e = new Set(N.active.facts);
      !j.has("chapter_completed") && _e.has("chapter_completed") ? p.value = "ending" : !j.has("captives_arrived") && _e.has("captives_arrived") && (p.value = "arrival");
    }), pe(() => l.value?.id, () => {
      L.value = {}, O.value = null, V.clear();
    }), pe([p, S], () => {
      ce.value = null;
    }), pe(r, (N) => {
      N && (ce.value = null);
    }), pe(() => [S.value, Be.value], ([N, D], [j, _e]) => {
      const Ct = D.filter((zt) => zt.kind === "dialogue").at(-1);
      N === j && p.value === "person" && Ct && !_e.some((zt) => zt.id === Ct.id) && (ce.value = Ct.id);
    }), pe([ee, S], ([N, D]) => {
      const j = V.get(D);
      N && (N.scrollTop = j && !j.latest ? j.top : N.scrollHeight);
    }, { flush: "post" }), pe(ee, (N, D, j) => {
      if (!N) return;
      const _e = new ResizeObserver(Nt);
      _e.observe(N), j(() => _e.disconnect());
    }, { flush: "post" }), pe(() => [
      Be.value.length,
      o.value,
      Pe.value,
      ce.value
    ], async () => {
      await qt(), Nt();
    }), Ot(async () => {
      await s.read(), Zt = !0;
    }), Gn(() => {
      Zt && !h.value && s.read();
    }), tn(() => {
      ce.value = null, Le();
    }), _t(() => {
      a.dispose(), s.dispose(), et.dispose();
    }), (N, D) => (P(), E("section", Rd, [
      x.value ? Y("", !0) : (P(), Pt(Gc, {
        key: 0,
        ref_key: "entry",
        ref: _,
        campaign: m(l),
        ready: !!m(n)?.ready,
        busy: m(i),
        blocked: m(u) || e.generationActive,
        onStart: G,
        onContinue: W
      }, null, 8, [
        "campaign",
        "ready",
        "busy",
        "blocked"
      ])),
      x.value && m(l) && ie.value ? (P(), Pt(Mi, {
        key: b.value,
        ref_key: "field",
        ref: U,
        world: ie.value,
        traveler: m(l).traveler,
        paused: Je.value,
        weapon: m(l).weapon,
        outfit: Me.value,
        battle: m(l).battle,
        onInput: m(a).input,
        onInteract: Ut,
        onPause: Le,
        onResume: ke,
        onError: D[0] || (D[0] = (j) => v.value = !0)
      }, {
        status: bn(() => [m(l) ? (P(), E(re, { key: 0 }, [
          k("div", Cd, [k("meter", {
            min: 0,
            max: m(Q).maxHp,
            value: m(l).hp,
            "aria-label": m(te).hp
          }, null, 8, zd), k("span", null, C(Math.ceil(m(l).hp)) + " / " + C(m(Q).maxHp), 1)]),
          k("p", Pd, C(m(Rn)(m(l))), 1),
          k("small", $d, C(m(o) ? m(Z).thinking : m(i) ? m(Z).saving : m(h) ? "" : m(Z).saved), 1)
        ], 64)) : Y("", !0)]),
        overlay: bn(() => [...D[16] || (D[16] = [k("span", null, null, -1)])]),
        _: 1
      }, 8, [
        "world",
        "traveler",
        "paused",
        "weapon",
        "outfit",
        "battle",
        "onInput"
      ])) : Y("", !0),
      x.value && m(l) && !m(l).pendingParley && !le.value ? (P(), E("nav", {
        key: 2,
        class: "ember-tools",
        "aria-label": m(Z).prepare
      }, [
        k("button", {
          type: "button",
          "aria-label": m(Z).map,
          onClick: D[1] || (D[1] = (j) => Ge("map"))
        }, [Ye($t, { name: "map" }), k("span", null, C(m(Z).map), 1)], 8, Id),
        k("button", {
          type: "button",
          "aria-label": m(Z).build,
          onClick: D[2] || (D[2] = (j) => Ge("build"))
        }, [Ye($t, { name: "bag" }), k("span", null, C(m(Z).build), 1)], 8, Ld),
        k("button", {
          type: "button",
          "aria-label": m(Z).journal,
          onClick: D[3] || (D[3] = (j) => Ge("journal"))
        }, [Ye($t, { name: "journal" }), k("span", null, C(m(Z).journal), 1)], 8, Ad),
        k("button", {
          type: "button",
          "aria-label": m(Z).pause,
          onClick: bt
        }, [Ye($t, { name: "pause" }), k("span", null, C(m(Z).pause), 1)], 8, Td)
      ], 8, Ed)) : Y("", !0),
      x.value && Fe.value && !p.value ? (P(), E("div", jd, [k("strong", null, C(m(Da)[Fe.value.kind]), 1), k("meter", {
        min: "0",
        max: Fe.value.maxHp,
        value: Fe.value.hp,
        "aria-label": m(Da)[Fe.value.kind]
      }, null, 8, Od)])) : Y("", !0),
      x.value && m(l)?.phase === "battle" && ["gate", "beacon"].includes(m(l).location.scene) && !H.value.has("alarm_silenced") ? (P(), E("div", Zd, C(H.value.has("alarm_raised") ? m(Z).alarmRaised : m(Z).alarmSeconds(Math.ceil((m(ta).alarmTicks - m(l).alarmTicks) / m(Q).hz))), 1)) : Y("", !0),
      m(r) || v.value || e.generationActive ? (P(), E("section", {
        key: 5,
        ref_key: "noticePanel",
        ref: F,
        class: "ember-notice",
        role: "alertdialog",
        "aria-modal": "true",
        "aria-label": m(Z).noticeTitle,
        tabindex: "-1"
      }, [k("p", null, C(v.value ? m(Z).renderError : e.generationActive ? m(Z).generation : m(r)), 1), v.value ? (P(), E("button", {
        key: 0,
        type: "button",
        onClick: D[4] || (D[4] = (j) => {
          v.value = !1, b.value++;
        })
      }, C(m(Z).reload), 1)) : m(s).dataInvalid.value && !e.generationActive ? (P(), E(re, { key: 1 }, [k("p", null, C(m(Z).rebuildWarning), 1), k("button", {
        type: "button",
        disabled: m(i),
        onClick: D[5] || (D[5] = (...j) => m(s).rebuild && m(s).rebuild(...j))
      }, C(m(Z).rebuild), 9, Nd)], 64)) : e.generationActive ? Y("", !0) : (P(), E("button", {
        key: 2,
        type: "button",
        disabled: m(i),
        onClick: D[6] || (D[6] = (j) => m(s).recoveryRequired.value ? it() : m(s).dismissError())
      }, C(m(s).recoveryRequired.value ? m(Z).recover : m(Z).acknowledge), 9, Dd))], 8, Ud)) : Y("", !0),
      m(d) && !m(r) && (p.value !== "person" || S.value !== m(d).person) ? (P(), E("aside", Fd, [
        k("strong", null, C(m(pt)(m(d).person)), 1),
        k("p", null, C(m(Et)(m(d))), 1),
        m(d).text ? (P(), E("details", Bd, [k("summary", null, C(m(Z).receivedReply), 1), k("p", qd, C(m(d).text), 1)])) : Y("", !0),
        k("button", {
          type: "button",
          onClick: D[7] || (D[7] = (...j) => m(s).dismissConversationFailure && m(s).dismissConversationFailure(...j))
        }, C(m(Z).acknowledge), 1)
      ])) : Y("", !0),
      x.value && m(l) && !m(r) && !v.value && !e.generationActive && (p.value || f.value || m(l).phase === "reward" || m(l).phase === "lost") ? (P(), E("div", {
        key: 7,
        class: "ember-curtain",
        style: na(p.value === "person" ? ot.value : void 0)
      }, [k("section", {
        ref_key: "dialog",
        ref: A,
        class: At(["ember-panel", {
          "ember-wide": p.value === "map" || p.value === "build" && w.value === "wardrobe",
          "ember-map-panel": p.value === "map",
          "ember-wardrobe-panel": p.value === "build" && w.value === "wardrobe",
          "ember-dialogue": p.value === "person"
        }]),
        role: "dialog",
        "aria-modal": "true",
        "aria-label": M.value,
        tabindex: "-1"
      }, [p.value !== "map" && p.value !== "person" ? (P(), E("header", Hd, [
        k("h2", null, C(M.value), 1),
        p.value === "build" ? (P(), E("nav", {
          key: 0,
          class: "ember-pack-tabs",
          "aria-label": m(Z).build
        }, [k("button", {
          type: "button",
          "aria-pressed": w.value === "relics",
          onClick: D[8] || (D[8] = (j) => w.value = "relics")
        }, C(m(ue).equipment), 9, Gd), k("button", {
          type: "button",
          "aria-pressed": w.value === "wardrobe",
          onClick: D[9] || (D[9] = (j) => w.value = "wardrobe")
        }, C(m(Z).wardrobe), 9, Yd)], 8, Vd)) : Y("", !0),
        p.value !== "prologue" && m(l).pendingParley?.decision !== "attack" && (p.value || m(l).phase !== "lost" && m(l).phase !== "reward") ? (P(), E("button", {
          key: 1,
          type: "button",
          disabled: !!m(l).pendingParley && m(u),
          onClick: ke
        }, C(m(Z).close), 9, Qd)) : Y("", !0)
      ])) : Y("", !0), p.value === "map" ? (P(), Pt(ul, {
        key: 1,
        campaign: m(l),
        onClose: ke
      }, null, 8, ["campaign"])) : p.value === "prologue" ? (P(), E(re, { key: 2 }, [k("p", Kd, C(m(Z).opening), 1), k("button", {
        class: "ember-primary",
        type: "button",
        onClick: ke
      }, C(m(Z).start), 1)], 64)) : p.value === "journal" ? (P(), E(re, { key: 3 }, [k("p", Xd, C(m(Rn)(m(l))), 1), k("ol", Jd, [(P(!0), E(re, null, Oe(m(l).facts, (j) => (P(), E("li", { key: j }, C(m(os)[j]), 1))), 128))])], 64)) : p.value === "build" ? (P(), E(re, { key: 4 }, [w.value === "wardrobe" && m(n) ? (P(), Pt(jl, {
        key: 0,
        data: m(n).data,
        traveler: m(l).traveler,
        balance: m(n).balance,
        blocked: m(u),
        weapon: m(l).weapon,
        onCommand: We
      }, null, 8, [
        "data",
        "traveler",
        "balance",
        "blocked",
        "weapon"
      ])) : (P(), E(re, { key: 1 }, [
        k("div", e1, [k("strong", null, C(m(l).traveler.name), 1), k("span", null, C(m(ue).genders[m(l).traveler.gender]) + " · " + C(m(ue).identityRole), 1)]),
        k("small", null, C(m(Z).slots(m(l).equipped.length, m(Q).relicSlots)), 1),
        k("p", null, C(m(wt)[m(l).weapon].name) + " · " + C(m(dr)(m(l).weapon)), 1),
        m(l).location.scene !== "camp" ? (P(), E("p", t1, C(m(Z).safeBuild), 1)) : Y("", !0),
        m(l).collection.length ? Y("", !0) : (P(), E("p", a1, C(m(Z).emptyBuild), 1)),
        k("div", n1, [(P(!0), E(re, null, Oe(qe.value, (j) => (P(), E("article", { key: j.id }, [
          Ye($t, { name: j.id }, null, 8, ["name"]),
          k("h3", null, [Ze(C(m(la)[j.id].name) + " ", 1), k("small", null, C(m(te).rank(j.rank)), 1)]),
          k("p", null, C(m(la)[j.id].detail), 1),
          j.issue === "dependency" || j.issue === "capacity" ? (P(), E("small", s1, C(m(Z).loadoutIssue[j.issue]), 1)) : Y("", !0),
          k("button", {
            type: "button",
            disabled: m(u) || !!j.issue,
            onClick: (_e) => We({
              type: "loadout",
              equipped: j.equipped
            })
          }, C(m(l).equipped.includes(j.id) ? m(Z).takeOff : m(Z).putOn), 9, r1)
        ]))), 128))])
      ], 64))], 64)) : p.value === "person" ? (P(), E(re, { key: 5 }, [
        k("header", o1, [
          k("div", i1, [k("h2", null, C(m(pt)(S.value)), 1), k("small", null, C(m(oe).scenes[m(l).location.scene]), 1)]),
          (P(), Pt(uc, {
            key: S.value,
            campaign: m(l),
            person: S.value,
            draft: $.value
          }, null, 8, [
            "campaign",
            "person",
            "draft"
          ])),
          !le.value && m(l).pendingParley?.decision !== "attack" ? (P(), E("button", {
            key: 0,
            type: "button",
            disabled: !!m(l).pendingParley && m(u),
            onClick: ke
          }, C(m(Z).close), 9, l1)) : Y("", !0)
        ]),
        k("div", {
          ref_key: "transcript",
          ref: ee,
          class: "ember-dialogue-scroll",
          role: "log",
          "aria-live": "polite",
          onScroll: ia
        }, [
          Ve.value ? (P(), Pt(Hn, {
            key: 0,
            person: S.value,
            reply: Ve.value.reply,
            performance: Ve.value.performance,
            animate: !1
          }, null, 8, [
            "person",
            "reply",
            "performance"
          ])) : Y("", !0),
          (P(!0), E(re, null, Oe(Be.value, (j) => (P(), E(re, { key: j.id }, [
            j.kind !== "greeting" ? (P(), E("p", c1, [k("small", null, C(m(l).traveler.name), 1), Ze(C(j.player), 1)])) : Y("", !0),
            j.issue ? (P(), E("p", u1, C(m(he).issues[j.issue]), 1)) : Y("", !0),
            j.kind === "receipt" && j.issue === "reply_invalid" ? (P(), E("details", d1, [k("summary", null, C(m(he).rawReply), 1), k("p", h1, C(j.reply), 1)])) : j.kind === "receipt" ? (P(), E("p", f1, C(j.reply), 1)) : (P(), Pt(Hn, {
              key: 4,
              person: S.value,
              reply: j.reply,
              performance: j.performance,
              animate: ce.value === j.id,
              "data-fresh-reply": ce.value === j.id
            }, null, 8, [
              "person",
              "reply",
              "performance",
              "animate",
              "data-fresh-reply"
            ]))
          ], 64))), 128)),
          Pe.value ? (P(), E(re, { key: 1 }, [k("p", {
            class: "ember-player-line",
            "aria-busy": Pe.value.status === "sending"
          }, [k("small", null, C(m(l).traveler.name), 1), Ze(C(Pe.value.text), 1)], 8, p1), Ie.value ? (P(), E("p", m1, C(m(he).sendFailed), 1)) : Y("", !0)], 64)) : Y("", !0),
          m(d)?.person === S.value && !Be.value.some((j) => j.id === m(d)?.actionId) ? (P(), E("div", v1, [
            k("p", null, C(m(Et)(m(d))), 1),
            m(d).text ? (P(), E("details", g1, [k("summary", null, C(m(Z).receivedReply), 1), k("p", y1, C(m(d).text), 1)])) : Y("", !0),
            k("button", {
              type: "button",
              onClick: D[10] || (D[10] = (...j) => m(s).dismissConversationFailure && m(s).dismissConversationFailure(...j))
            }, C(m(Z).acknowledge), 1)
          ])) : Y("", !0),
          m(o) ? (P(), E("p", b1, C(m(Z).thinking), 1)) : Y("", !0)
        ], 544),
        Ye(tu, {
          modelValue: $.value,
          "onUpdate:modelValue": D[11] || (D[11] = (j) => $.value = j),
          blocked: m(u) || T.value || e.generationActive,
          talking: m(o),
          "can-regenerate": !!yt.value || Ie.value,
          retrying: Ie.value,
          conclusion: we.value,
          onSend: Qt,
          onRegenerate: Kt,
          onContinue: ye,
          onCancel: m(s).cancelTalk
        }, null, 8, [
          "modelValue",
          "blocked",
          "talking",
          "can-regenerate",
          "retrying",
          "conclusion",
          "onCancel"
        ])
      ], 64)) : p.value === "passage" ? (P(), E("p", w1, C(m(oe).passages[I.value].body), 1)) : p.value === "arrival" ? (P(), E(re, { key: 7 }, [
        k("img", {
          class: "ember-story-art",
          src: m(Fn).arrival,
          alt: "",
          decoding: "async"
        }, null, 8, x1),
        k("p", M1, C(m(Z).received), 1),
        k("button", {
          class: "ember-primary",
          type: "button",
          onClick: ke
        }, C(m(Z).resume), 1)
      ], 64)) : p.value === "ending" ? (P(), E(re, { key: 8 }, [
        k("img", {
          class: "ember-story-art",
          src: m(Fn).ending,
          alt: "",
          decoding: "async"
        }, null, 8, k1),
        k("h2", null, C(m(Z).endingTitle), 1),
        k("p", _1, C(m(Z).ending), 1),
        k("strong", S1, C(m(Z).continued), 1),
        k("p", null, C(m(Z).optional), 1),
        k("button", {
          class: "ember-primary",
          type: "button",
          onClick: ke
        }, C(m(Z).remain), 1)
      ], 64)) : m(l).phase === "reward" ? (P(), E(re, { key: 9 }, [
        k("p", null, C(m(Z).rewardDetail), 1),
        k("div", R1, [(P(!0), E(re, null, Oe(m(l).offers, (j) => (P(), E("button", {
          key: j.id,
          type: "button",
          disabled: m(u),
          onClick: (_e) => We({
            type: "relic",
            id: j.id
          })
        }, [
          Ye($t, { name: j.id }, null, 8, ["name"]),
          k("h3", null, [Ze(C(m(la)[j.id].name) + " ", 1), k("small", null, C(m(te).rank(j.rank)), 1)]),
          k("p", null, C(m(la)[j.id].detail), 1)
        ], 8, C1))), 128))]),
        k("button", {
          type: "button",
          disabled: m(u),
          onClick: D[12] || (D[12] = (j) => We({ type: "leave" }))
        }, C(m(Z).skip), 9, z1)
      ], 64)) : m(l).phase === "lost" ? (P(), E(re, { key: 10 }, [
        k("p", P1, C(m(Z).fallenDetail), 1),
        k("button", {
          class: "ember-primary",
          type: "button",
          disabled: m(u),
          onClick: D[13] || (D[13] = (j) => We({ type: "retry" }))
        }, C(m(Z).retry), 9, $1),
        k("button", {
          type: "button",
          disabled: m(u),
          onClick: D[14] || (D[14] = (j) => We({ type: "retreat" }))
        }, C(m(Z).retreat), 9, E1)
      ], 64)) : (P(), E(re, { key: 11 }, [
        k("button", {
          class: "ember-primary",
          type: "button",
          disabled: !!m(r) || e.generationActive,
          onClick: ke
        }, C(m(Z).resume), 9, I1),
        k("div", L1, [k("button", {
          type: "button",
          "aria-pressed": g.value,
          onClick: D[15] || (D[15] = (j) => g.value = !g.value)
        }, C(m(Z).sound), 9, A1)]),
        k("details", null, [
          k("summary", null, C(m(ue).controls), 1),
          k("p", T1, C(m(Z).controls), 1),
          k("p", j1, C(m(Z).touchControls), 1)
        ]),
        k("button", {
          type: "button",
          onClick: $a
        }, C(m(ue).title), 1)
      ], 64))], 10, Wd)], 4)) : Y("", !0)
    ]));
  }
}), G1 = O1;
export {
  G1 as default
};
