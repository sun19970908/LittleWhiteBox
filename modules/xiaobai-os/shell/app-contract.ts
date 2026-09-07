import type { XiaobaiOsFrameBridge } from './app-src/frame-bridge.js';

export interface XiaobaiOsAppProps {
    bridge: XiaobaiOsFrameBridge;
    initialState: unknown;
}
