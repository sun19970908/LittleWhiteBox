/* eslint-disable */
var b = "LittleWhiteBox-XiaobaiOS", I = class extends Error {
  code;
  phase;
  retryable;
  requiresAppRetry;
  constructor(r) {
    super(r.message || r.error || "host_request_failed"), this.name = "HostRequestError", this.code = r.error || "host_request_failed", this.phase = r.phase || "host", this.retryable = r.retryable !== !1, this.requiresAppRetry = r.requiresAppRetry === !0;
  }
};
function d() {
  return `xiaobai-os-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
function A() {
  const r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Set();
  let a = !1, n = null;
  function u(e, s = {}, t = "") {
    const o = n && e !== "app/activate" && e !== "app/retry" && e !== "os/frame-ready" && e !== "os/close", c = o && !t ? d() : t;
    parent.postMessage({
      source: b,
      type: e,
      requestId: c,
      ...o ? n : {},
      payload: s
    }, window.location.origin);
  }
  function p(e) {
    const s = String(e.requestId || "");
    if (!s) return !1;
    const t = r.get(s);
    if (!t || t.session && (e.appId !== t.session.appId || e.activationToken !== t.session.activationToken)) return !1;
    r.delete(s), clearTimeout(t.timer);
    const o = e.payload;
    return o?.ok === !1 ? t.reject(new I(o)) : t.resolve(o), !0;
  }
  function l(e) {
    e.origin !== window.location.origin || e.source !== parent || e.data?.source !== "LittleWhiteBox-XiaobaiOS" || typeof e.data.type != "string" || p(e.data) || i.forEach((s) => s(e.data));
  }
  function h() {
    a || (a = !0, window.addEventListener("message", l), u("os/frame-ready"));
  }
  function m(e, s = {}, t = 15e3) {
    const o = d();
    return new Promise((c, f) => {
      const _ = setTimeout(() => {
        r.delete(o), f(/* @__PURE__ */ new Error("host_request_timeout"));
      }, t);
      r.set(o, {
        resolve: c,
        reject: f,
        timer: _,
        session: n ? { ...n } : null
      }), u(e, s, o);
    });
  }
  function g(e) {
    n = Object.freeze({ ...e });
  }
  function q() {
    const e = n;
    if (n = null, !!e)
      for (const [s, t] of r)
        t.session?.activationToken === e.activationToken && (clearTimeout(t.timer), t.reject(/* @__PURE__ */ new Error("app_inactive")), r.delete(s));
  }
  function w() {
    return n ? { ...n } : null;
  }
  function E(e) {
    return i.add(e), () => i.delete(e);
  }
  function S() {
    a && window.removeEventListener("message", l), a = !1, i.clear(), r.forEach((e) => {
      clearTimeout(e.timer), e.reject(/* @__PURE__ */ new Error("frame_bridge_disposed"));
    }), r.clear(), n = null;
  }
  return Object.freeze({
    start: h,
    post: u,
    request: m,
    subscribe: E,
    setAppSession: g,
    clearAppSession: q,
    getAppSession: w,
    dispose: S
  });
}
export {
  A as n,
  I as t
};
