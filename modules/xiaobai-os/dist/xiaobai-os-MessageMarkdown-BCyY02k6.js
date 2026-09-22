/* eslint-disable */
import { n as d, t as m } from "./xiaobai-os-message-markdown-p_WvGylV.js";
import { K as f, M as p, b as h, g as b, z as k } from "./xiaobai-os-runtime-dom.esm-bundler-BcM9c-Z9.js";
var g = /* @__PURE__ */ h({
  __name: "MessageMarkdown",
  props: { text: {} },
  setup(c) {
    const a = c, r = f(null), l = /* @__PURE__ */ new Set([
      "p",
      "br",
      "em",
      "i",
      "strong",
      "b",
      "del",
      "s",
      "u",
      "code",
      "pre",
      "blockquote",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "a"
    ]), i = /* @__PURE__ */ new Set([
      "script",
      "style",
      "custom-style",
      "iframe",
      "object",
      "embed",
      "svg",
      "math"
    ]);
    return k([r, () => a.text], () => {
      if (!r.value) return;
      const t = document.createElement("template");
      t.innerHTML = d(a.text, { htmlFenceMode: "code" });
      for (const e of t.content.querySelectorAll("*")) {
        const o = e.localName;
        if (i.has(o)) {
          e.remove();
          continue;
        }
        if (o === "img") {
          e.replaceWith(document.createTextNode(e.getAttribute("alt") ?? ""));
          continue;
        }
        if (!l.has(o)) {
          e.replaceWith(...e.childNodes);
          continue;
        }
        const s = e.getAttribute("href") ?? "", n = e.getAttribute("start") ?? "";
        for (const u of [...e.attributes]) e.removeAttribute(u.name);
        o === "a" && /^(?:https?:\/\/|mailto:)/i.test(s) && (e.setAttribute("href", s), e.setAttribute("target", "_blank"), e.setAttribute("rel", "noopener noreferrer")), o === "ol" && /^\d+$/.test(n) && e.setAttribute("start", n);
      }
      m(t.content, {
        codeBlockClassName: "os-markdown-codeblock",
        codeCopyClassName: "os-markdown-code-copy"
      }), r.value.replaceChildren(t.content);
    }, { flush: "post" }), (t, e) => (p(), b("div", {
      ref_key: "surface",
      ref: r,
      class: "os-message-markdown"
    }, null, 512));
  }
}), M = g;
export {
  M as t
};
