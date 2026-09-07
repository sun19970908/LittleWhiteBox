export interface PromptContextCharacter {
    readonly characterKey: string;
    readonly displayName: string;
    readonly description: string;
    readonly personality: string;
    readonly scenario: string;
}

export interface PromptContextMessage {
    readonly index: number;
    readonly role: 'user' | 'assistant';
    readonly speakerName: string;
    readonly text: string;
    readonly swipeId: number | string | null;
}

export interface PromptContextSnapshot {
    readonly player: { readonly displayName: string; readonly persona: string };
    readonly characters: readonly PromptContextCharacter[];
    readonly recentMessages: readonly PromptContextMessage[];
    readonly worldInfo: {
        readonly before: string;
        readonly after: string;
        readonly depth: readonly string[];
    };
    readonly storyEvents: string;
}

export interface PromptContextInput {
    readonly player?: unknown;
    readonly characters?: unknown;
    readonly recentMessages?: unknown;
    readonly worldInfo?: unknown;
    readonly storyEvents?: unknown;
}

export interface PromptContextCapture {
    readonly chatIdentity: string;
    readonly contextSnapshot: PromptContextSnapshot;
    readonly assistantCount: number;
}

export interface PromptContextCaptureOptions {
    /** Disable world-info scanning when checking live state against a frozen request. */
    readonly includeWorldInfo?: boolean;
    /** Inclusive chat message boundary. Defaults to the current chat tail. */
    readonly throughMessageIndex?: number;
    /** Recent context contains only messages before this index. */
    readonly recentBeforeIndex?: number;
    /** Caller-owned exclusion from recent prose and world-info scan (indices stay native). */
    readonly excludeMessageIndices?: readonly number[];
    /** Current feature conversation, newest first; scanned but not injected as story prose. */
    readonly worldInfoScanMessages?: readonly string[];
}

export interface PromptContextAdapter {
    currentChatIdentity: () => string;
    capture: (options?: PromptContextCaptureOptions) => Promise<PromptContextCapture>;
}
