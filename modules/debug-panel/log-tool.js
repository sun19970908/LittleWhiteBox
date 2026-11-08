import { xbLog } from '../../core/debug-core.js';

export function readLogs() {
    return { ok: true, enabled: xbLog.isEnabled(), ...xbLog.snapshot() };
}
