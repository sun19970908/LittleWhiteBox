/* eslint-disable */
import { getRequestHeaders as g } from "../../../../../../../script.js";
import { extensionFolderPath as m } from "../../../core/constants.js";
import { normalizeAgentSettings as l } from "../../agent-core/config.js";
import { resolveActiveProviderConfig as p } from "../../agent-core/provider-resolution.js";
import { loadSharedAgentSettings as c, saveSharedAgentSettings as f } from "../../agent-core/settings-repository.js";
import { AssistantStorage as i } from "../../../core/server-storage.js";
var s = null;
function u(t) {
  const e = String(t || "");
  return /^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(e) || e.startsWith("/") || e.startsWith("./") || e.startsWith("../") ? e : `/${e}`;
}
function a() {
  return s || (s = import(u(`${m}/modules/xiaobai-os/dist/xiaobai-os-agent.js`)).then((t) => (t.configureXiaobaiOsAgent?.({ requestHeadersProvider: () => g?.() || {} }), t)).catch((t) => {
    throw s = null, t;
  })), s;
}
function h() {
  const t = {
    loadConfig: async () => await c({ storage: i }),
    saveConfig: async (e) => await f(e, {
      storage: i,
      silent: !1
    }),
    async openSession(e) {
      const n = p(l(e || {})), r = (await a()).openXiaobaiOsAgentSession(n);
      return Object.freeze({
        providerConfig: n,
        supportsSessionToolLoop: r.supportsSessionToolLoop,
        async run(o) {
          return await r.run({
            systemPrompt: o.systemPrompt,
            messages: o.messages,
            tools: o.tools || [],
            temperature: o.temperature ?? n.temperature,
            maxTokens: o.maxTokens ?? n.maxTokens,
            reasoning: o.reasoning ?? n.reasoning,
            signal: o.signal,
            onStreamProgress: o.onStreamProgress,
            toolResponses: o.toolResponses,
            finalAnswerReminderText: o.finalAnswerReminderText
          });
        }
      });
    },
    async run(e) {
      return await (await t.openSession(e.config)).run(e);
    },
    async pullModels(e, n) {
      return await (await a()).pullXiaobaiOsAgentModels(e, { signal: n });
    },
    async testConnection(e, n) {
      return await (await a()).testXiaobaiOsAgentConnection(e, { signal: n });
    }
  };
  return Object.freeze(t);
}
export {
  h as createXiaobaiOsAgentGateway
};
