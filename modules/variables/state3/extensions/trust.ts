import { extension_settings, getContext } from '../../../../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../../../../script.js';
import { digest } from '../definition/digest.js';
import { reject } from '../engine/diagnostics.js';
import { requestExtensionConsent } from '../ui/extension-consent.js';
import type { Bundle } from '../types.js';

interface TrustSettings { state3ExtensionTrust?: Record<string, string> }
let pending: { key: string; signal?: AbortSignal; answer: Promise<boolean> } | undefined;
const settings = () => (extension_settings as typeof extension_settings & { LittleWhiteBox: TrustSettings }).LittleWhiteBox;
function card() {
    const ctx = getContext();
    const selected = ctx.characterId === undefined ? undefined : ctx.characters?.[Number(ctx.characterId)];
    if (!selected?.avatar) {reject('character-missing');}
    return selected;
}
function hostCode(bundle: Bundle) {
    const tools = Object.fromEntries(Object.entries(bundle.definition.extensions?.tools || {})
        .filter(([, entry]) => entry.enabled).map(([name]) => [name, bundle.tools![name]]));
    const scripts = Object.fromEntries((['prepare', 'committed'] as const)
        .filter(name => bundle.definition.extensions?.scripts?.[name]?.enabled).map(name => [name, bundle.scripts![name]]));
    return Object.keys(tools).length || Object.keys(scripts).length ? digest({ tools, scripts }) : undefined;
}
export function extensionTrust(bundle: Bundle): 'unused' | 'allowed' | 'required' {
    const hash = hostCode(bundle);
    return !hash ? 'unused' : settings().state3ExtensionTrust?.[card().avatar] === hash ? 'allowed' : 'required';
}
export function revokeExtensionTrust(avatar = card().avatar) {
    const trusted = settings().state3ExtensionTrust;
    if (!trusted || !Object.hasOwn(trusted, avatar)) {return;}
    delete trusted[avatar];
    if (!Object.keys(trusted).length) {delete settings().state3ExtensionTrust;}
    saveSettingsDebounced();
}
export async function assertExtensionTrust(bundle: Bundle, signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (extensionTrust(bundle) === 'required') {reject('extension-untrusted');}
}
export async function authorizeExtensions(bundle: Bundle, signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (extensionTrust(bundle) !== 'required') {return;}
    const selected = card(), hash = hostCode(bundle)!;
    const key = selected.avatar + ':' + hash;
    if (!pending || pending.key !== key || pending.signal?.aborted) {pending = { key, signal, answer: requestExtensionConsent(selected.name, signal) };}
    const request = pending;
    let accepted: boolean;
    try {accepted = await request.answer;}
    finally {if (pending === request) {pending = undefined;}}
    signal?.throwIfAborted();
    if (!accepted) {reject('extension-untrusted');}
    if (card().avatar !== selected.avatar) {reject('stale-target');}
    (settings().state3ExtensionTrust ??= {})[selected.avatar] = hash;
    saveSettingsDebounced();
}
