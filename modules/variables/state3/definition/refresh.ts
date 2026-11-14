import { CARD_EXTENSION } from './format.js';
import { decodeBundle } from './card-files.js';
import { compileDefinition } from './compile.js';
import { digest } from './digest.js';
import { equal } from '../engine/data.js';
import { reject } from '../engine/diagnostics.js';

interface Card { avatar: string; data?: { extensions?: Record<string, unknown> } }
interface Host {
    current(): Card;
    read(avatar: string, signal?: AbortSignal): Promise<Card>;
    changed(): Promise<void>;
}
export interface RefreshOptions { avatar: string; signal?: AbortSignal }
export interface RefreshResult { ok: true; changed: boolean; version: string | null }

/** External sync reloads one owned leaf; editor drafts and chat state are untouched. */
export function createRuleRefresh(host: Host) {
    return async ({ avatar, signal }: RefreshOptions): Promise<RefreshResult> => {
        const selected = host.current();
        if (selected.avatar !== avatar) {reject('stale-target');}
        const previous = structuredClone(selected.data?.extensions?.[CARD_EXTENSION]);
        const saved = await host.read(avatar, signal);
        signal?.throwIfAborted();
        const current = host.current();
        if (current.avatar !== avatar || saved.avatar !== avatar) {reject('stale-target');}
        if (!equal(previous, current.data?.extensions?.[CARD_EXTENSION])) {reject('rules-conflict');}
        const next = saved.data?.extensions?.[CARD_EXTENSION], changed = !equal(previous, next);
        if (changed) {
            current.data ??= {}; current.data.extensions ??= {};
            if (next === undefined) {delete current.data.extensions[CARD_EXTENSION];}
            else {current.data.extensions[CARD_EXTENSION] = next;}
            // Publish even malformed external data: continuing to use old rules
            // would hide the error and allow stale work to commit.
            await host.changed();
        }
        const version = next === undefined ? null : digest(compileDefinition(decodeBundle(next)).bundle);
        return { ok: true, changed, version };
    };
}
