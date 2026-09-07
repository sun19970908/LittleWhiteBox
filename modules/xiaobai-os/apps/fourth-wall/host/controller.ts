import { createDefaultFourthWallGlobalSettings } from '../domain/defaults.js';
import {
    addSession,
    appendMessage,
    clearSession,
    deleteMessage,
    deleteSession,
    editMessage,
    getActiveSession,
    prepareRegeneration,
    renameSession,
    switchSession,
    updateChatSettings,
} from '../domain/state.js';
import { buildFourthWallCommentaryPrompt, buildFourthWallPrompt } from '../domain/prompt.js';
import { projectGenerationProgress, projectGenerationResult } from '../domain/response-projection.js';
import { createFourthWallCommentaryRuntime } from './commentary-runtime.js';
import { createFourthWallGenerationRuntime, type FourthWallGenerateResponse } from './generation-runtime.js';
import type {
    FourthWallCapturedCommentary,
    FourthWallChatSnapshot,
    FourthWallChatState,
    FourthWallClientState,
    FourthWallCommentaryKind,
    FourthWallGenerationResult,
    FourthWallGlobalSettings,
    FourthWallGlobalSettingsPatch,
} from '../types.js';
import type { XiaobaiOsAppRuntime, XiaobaiOsChatIdentity } from '../../../types.js';
import type { FourthWallMutationOptions } from './repository.js';
import type { FourthWallImageProtocol } from './image-protocol.js';
import type { FourthWallVoiceProtocol } from './voice-protocol.js';

type UnknownRecord = Record<string, unknown>;

interface ControllerChatRepository {
    prepareCurrentChatFourthWall: () => Promise<FourthWallChatState>;
    readCurrentChatFourthWall: () => FourthWallChatState | null;
    mutateCurrentChatFourthWall: (
        action: (current: FourthWallChatState) => FourthWallChatState,
        options?: FourthWallMutationOptions,
    ) => Promise<FourthWallChatState>;
}

interface ControllerSettingsRepository {
    read: () => { apps: { fourthWall: FourthWallGlobalSettings } } | null;
    mutateFourthWall: (action: (current: FourthWallGlobalSettings) => FourthWallGlobalSettings) => Promise<unknown>;
}

interface CommentaryCaptured extends FourthWallCapturedCommentary {
    chatState: FourthWallChatState;
    sessionId: string;
    globalSettings: FourthWallGlobalSettings;
}

interface CommentaryDependencies {
    subscribe?: (handler: (event: { kind?: string }) => Promise<boolean>) => (() => void) | void;
    capture?: (event: { kind?: string }) => FourthWallCapturedCommentary | null;
    show?: (text: string) => void;
    hide?: () => void;
    random?: () => number;
    now?: () => number;
    setTimer?: (callback: () => void, milliseconds: number) => ReturnType<typeof setTimeout>;
    clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
    cooldownMs?: number;
}

interface ControllerDependencies {
    chatRepository: ControllerChatRepository;
    settingsRepository: ControllerSettingsRepository;
    getChatIdentity: () => XiaobaiOsChatIdentity | { key?: unknown } | string | null;
    getChatSnapshot: () => FourthWallChatSnapshot | null;
    generateResponse: FourthWallGenerateResponse;
    loadAgentConfig: () => unknown | Promise<unknown>;
    imageProtocol?: FourthWallImageProtocol;
    voiceProtocol?: FourthWallVoiceProtocol;
    commentary?: CommentaryDependencies | null;
    now?: () => number;
    createId?: () => string;
}

interface Activation {
    generation: number;
    chatIdentity: string;
    post?: (type: string, payload?: unknown, responseId?: string) => unknown;
}

interface GenerationRun {
    activationGeneration: number;
    chatIdentity: string;
    sessionId: string;
    requestId: string;
}

function identityKey(identity: ControllerDependencies['getChatIdentity'] extends () => infer T ? T : never): string {
    if (typeof identity === 'string') {
        return identity;
    }
    return String(identity?.key || '');
}

function createSessionId(): string {
    if (globalThis.crypto?.randomUUID) {
        return `session-${globalThis.crypto.randomUUID()}`;
    }
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error || 'unknown_error');
}

function isUnconfirmedSave(error: unknown): boolean {
    return (
        error !== null &&
        typeof error === 'object' &&
        (('code' in error && error.code === 'SAVE_UNCONFIRMED') || ('uncertain' in error && error.uncertain === true))
    );
}

function normalizeGlobalSettings(
    current: FourthWallGlobalSettings,
    patch: FourthWallGlobalSettingsPatch = {},
): FourthWallGlobalSettings {
    const next = structuredClone(current);
    if (patch.image) {
        next.image.enablePrompt = patch.image.enablePrompt === true;
    }
    if (patch.voice) {
        next.voice.enabled = patch.voice.enabled === true;
    }
    if (patch.commentary) {
        if (Object.hasOwn(patch.commentary, 'enabled')) {
            next.commentary.enabled = patch.commentary.enabled === true;
        }
        if (Object.hasOwn(patch.commentary, 'probability')) {
            const probability = Number(patch.commentary.probability);
            if (!Number.isInteger(probability) || probability < 1 || probability > 99) {
                throw new Error('吐槽概率必须是 1 到 99 的整数');
            }
            next.commentary.probability = probability;
        }
    }
    if (patch.promptTemplates) {
        const keys: Array<keyof FourthWallGlobalSettings['promptTemplates']> = [
            'topuser',
            'confirm',
            'metaProtocol',
            'bottom',
        ];
        for (const key of keys) {
            if (Object.hasOwn(patch.promptTemplates, key)) {
                next.promptTemplates[key] = String(patch.promptTemplates[key]);
            }
        }
    }
    return next;
}

function classifyGenerationError(error: unknown): 'configuration' | 'parse' | 'network' {
    const message = describeError(error);
    if (/api key|配置|provider|model/i.test(message)) {
        return 'configuration';
    }
    if (/parse|格式|<msg>/i.test(message)) {
        return 'parse';
    }
    return 'network';
}

export function createFourthWallController({
    chatRepository,
    settingsRepository,
    getChatIdentity,
    getChatSnapshot,
    generateResponse,
    loadAgentConfig,
    imageProtocol,
    voiceProtocol,
    commentary = null,
    now = Date.now,
    createId = createSessionId,
}: ControllerDependencies): XiaobaiOsAppRuntime & {
    activate: NonNullable<XiaobaiOsAppRuntime['activate']>;
    handleMessage: NonNullable<XiaobaiOsAppRuntime['handleMessage']>;
} {
    if (
        !chatRepository ||
        !settingsRepository ||
        typeof getChatIdentity !== 'function' ||
        typeof getChatSnapshot !== 'function' ||
        typeof generateResponse !== 'function' ||
        typeof loadAgentConfig !== 'function'
    ) {
        throw new TypeError('fourth-wall controller dependencies are incomplete');
    }

    let activation: Activation | null = null;
    let activationGeneration = 0;

    const generationRuntime = createFourthWallGenerationRuntime({ generateResponse, loadAgentConfig });

    function getGlobalSettings(): FourthWallGlobalSettings {
        const root = settingsRepository.read();
        if (!root) {
            throw new Error('小白 OS 设置尚未准备');
        }
        return root.apps.fourthWall;
    }

    function buildClientState(chatState: FourthWallChatState): FourthWallClientState {
        const snapshot = getChatSnapshot();
        return {
            chatIdentity: snapshot?.chatIdentity || identityKey(getChatIdentity()),
            userName: String(snapshot?.userName || 'User'),
            characterName: String(snapshot?.characterName || 'Assistant'),
            userAvatar: String(snapshot?.userAvatar || ''),
            characterAvatar: String(snapshot?.characterAvatar || ''),
            chat: structuredClone(chatState),
            global: structuredClone(getGlobalSettings()),
            capabilities: {
                image: imageProtocol?.getCapabilities?.() || { available: false },
                voice: voiceProtocol?.getCapabilities?.() || { available: false },
            },
        };
    }

    function assertActivation(payload: UnknownRecord = {}, expectedSession = false): Activation {
        if (!activation) {
            throw new Error('四次元壁 APP 未激活');
        }
        const currentIdentity = identityKey(getChatIdentity());
        if (
            !currentIdentity ||
            currentIdentity !== activation.chatIdentity ||
            String(payload.chatIdentity || '') !== activation.chatIdentity
        ) {
            throw new Error('聊天已切换，请重新打开四次元壁');
        }
        if (expectedSession && !String(payload.sessionId || '')) {
            throw new Error('四次元壁记录标识缺失');
        }
        return activation;
    }

    function assertSameActivation(
        expected: Activation,
        payload: UnknownRecord = {},
        expectedSession = false,
    ): Activation {
        const current = assertActivation(payload, expectedSession);
        if (current !== expected) {
            throw new Error('四次元壁页面已切换，请重试');
        }
        return current;
    }

    function post(type: string, payload: unknown = {}): void {
        activation?.post?.(type, payload);
    }

    function emitState(chatState: FourthWallChatState): FourthWallClientState {
        const state = buildClientState(chatState);
        post('fourth-wall/state', { state });
        return state;
    }

    function isRunCurrent(run: GenerationRun): boolean {
        return (
            !!activation &&
            activation.generation === run.activationGeneration &&
            activation.chatIdentity === run.chatIdentity &&
            identityKey(getChatIdentity()) === run.chatIdentity
        );
    }

    function launchGeneration({
        chatState,
        sessionId,
        userInput,
        requestId,
    }: {
        chatState: FourthWallChatState;
        sessionId: string;
        userInput: string;
        requestId: string;
    }): void {
        const session = chatState.sessions.find((item) => item.id === sessionId);
        if (!session) {
            throw new Error('四次元壁记录不存在');
        }
        const currentActivation = activation;
        if (!currentActivation) {
            throw new Error('四次元壁 APP 未激活');
        }
        const run: GenerationRun = {
            activationGeneration: currentActivation.generation,
            chatIdentity: currentActivation.chatIdentity,
            sessionId,
            requestId,
        };
        const builtPrompt = buildFourthWallPrompt({
            userInput,
            history: session.history,
            chatSnapshot: getChatSnapshot(),
            settings: chatState.settings,
            globalSettings: getGlobalSettings(),
        });
        post('fourth-wall/generation', { requestId, status: 'started', sessionId });
        generationRuntime.start({
            requestId,
            builtPrompt,
            stream: chatState.settings.stream,
            disableAssistantPrefill: chatState.settings.disableAssistantPrefill,
            onProgress(result: FourthWallGenerationResult) {
                if (!isRunCurrent(run)) {
                    return;
                }
                post('fourth-wall/generation', {
                    requestId,
                    sessionId,
                    status: 'progress',
                    ...projectGenerationProgress(result),
                });
            },
            async onComplete(result: FourthWallGenerationResult) {
                if (!isRunCurrent(run)) {
                    return;
                }
                const projected = projectGenerationResult(result);
                try {
                    const next = await chatRepository.mutateCurrentChatFourthWall(
                        (state) => {
                            if (state.activeSessionId !== sessionId) {
                                throw new Error('记录已切换，回复未保存');
                            }
                            return appendMessage(state, sessionId, {
                                role: 'ai',
                                content: projected.text,
                                thinking: projected.thinking || undefined,
                                ts: now(),
                            });
                        },
                        {
                            beforeCommit() {
                                if (!isRunCurrent(run)) {
                                    throw new Error('generation_result_invalidated');
                                }
                            },
                        },
                    );
                    if (!isRunCurrent(run)) {
                        return;
                    }
                    emitState(next);
                    post('fourth-wall/generation', {
                        requestId,
                        sessionId,
                        status: 'complete',
                        ...projected,
                    });
                } catch (error) {
                    if (!isRunCurrent(run)) {
                        return;
                    }
                    const unconfirmed = isUnconfirmedSave(error);
                    if (unconfirmed) {
                        const retained = chatRepository.readCurrentChatFourthWall();
                        if (retained) {
                            emitState(retained);
                        }
                    }
                    post('fourth-wall/generation', {
                        requestId,
                        sessionId,
                        status: 'error',
                        kind: 'save',
                        message: unconfirmed
                            ? `回复已生成，但保存结果未确认：${describeError(error)}`
                            : `回复已生成，但未保存：${describeError(error)}`,
                        draft: unconfirmed ? undefined : projected,
                    });
                }
            },
            onError(error: unknown) {
                if (!isRunCurrent(run)) {
                    return;
                }
                post('fourth-wall/generation', {
                    requestId,
                    sessionId,
                    status: 'error',
                    kind: classifyGenerationError(error),
                    message: describeError(error),
                });
            },
            onCancelled() {
                if (!isRunCurrent(run)) {
                    return;
                }
                post('fourth-wall/generation', { requestId, sessionId, status: 'cancelled' });
            },
        });
    }

    const commentaryRuntime = commentary
        ? createFourthWallCommentaryRuntime({
              ...commentary,
              getSettings: () => {
                  try {
                      return getGlobalSettings().commentary;
                  } catch {
                      return { enabled: false, probability: 30 };
                  }
              },
              isForegroundActive: () => activation !== null,
              async capture(event: { kind?: string }): Promise<CommentaryCaptured | null> {
                  const host = commentary.capture?.(event);
                  if (!host) {
                      return null;
                  }
                  let chatState;
                  try {
                      chatState =
                          chatRepository.readCurrentChatFourthWall() ||
                          (await chatRepository.prepareCurrentChatFourthWall());
                  } catch {
                      return null;
                  }
                  if (!chatState || identityKey(getChatIdentity()) !== host.chatIdentity) {
                      return null;
                  }
                  const session = getActiveSession(chatState);
                  if (!session) {
                      return null;
                  }
                  return {
                      ...host,
                      chatState,
                      sessionId: session.id,
                      globalSettings: structuredClone(getGlobalSettings()),
                  };
              },
              async generate(captured: CommentaryCaptured, signal: AbortSignal): Promise<string> {
                  const builtPrompt = buildFourthWallCommentaryPrompt({
                      targetText: captured.text,
                      type: captured.kind,
                      history:
                          captured.chatState.sessions.find((item) => item.id === captured.sessionId)?.history || [],
                      chatSnapshot: captured.chatSnapshot,
                      settings: captured.chatState.settings,
                      globalSettings: captured.globalSettings,
                  });
                  if (!builtPrompt) {
                      return '';
                  }
                  const result = await generateResponse({
                      config: await loadAgentConfig(),
                      builtPrompt,
                      stream: false,
                      disableAssistantPrefill: captured.chatState.settings.disableAssistantPrefill,
                      signal,
                  });
                  return projectGenerationResult(result).text;
              },
              async commit(captured: CommentaryCaptured, text: string, signal: AbortSignal): Promise<void> {
                  if (identityKey(getChatIdentity()) !== captured.chatIdentity) {
                      throw new Error('聊天已切换');
                  }
                  const prefixes: Record<FourthWallCommentaryKind, string> = {
                      ai_message: '(glanced at the last line) ',
                      edit_own: '(caught you sneaking edits) ',
                      edit_ai: '(noticed you edited my line) ',
                  };
                  await chatRepository.mutateCurrentChatFourthWall(
                      (state) => appendMessage(state, captured.sessionId, {
                          role: 'ai',
                          content: `${prefixes[captured.kind]}${text}`,
                          ts: now(),
                          type: 'commentary',
                      }),
                      {
                          beforeCommit() {
                              if (signal.aborted || identityKey(getChatIdentity()) !== captured.chatIdentity) {
                                  throw new Error('commentary_result_invalidated');
                              }
                          },
                      },
                  );
              },
          })
        : null;

    async function activate(
        { post: postToFrame }: { post?: Activation['post'] } = {},
    ): Promise<FourthWallClientState> {
        cancelForeground('reactivated');
        const identity = getChatIdentity();
        const chatIdentity = identityKey(identity);
        if (!chatIdentity) {
            throw new Error('请先打开一个聊天');
        }
        const generation = ++activationGeneration;
        const chatState = await chatRepository.prepareCurrentChatFourthWall();
        if (identityKey(getChatIdentity()) !== chatIdentity || generation !== activationGeneration) {
            throw new Error('聊天已切换，请重新打开四次元壁');
        }
        const clientState = buildClientState(chatState);
        activation = { generation, chatIdentity, post: postToFrame };
        commentaryRuntime?.cancel();
        return clientState;
    }

    function deactivate(reason = 'deactivated'): void {
        cancelForeground(reason);
    }

    async function mutateBoundChat(
        current: Activation,
        payload: UnknownRecord,
        action: (state: FourthWallChatState) => FourthWallChatState,
    ): Promise<FourthWallChatState> {
        let next: FourthWallChatState;
        try {
            next = await chatRepository.mutateCurrentChatFourthWall(action);
        } catch (error) {
            if (isUnconfirmedSave(error)) {
                assertSameActivation(current, payload);
                const retained = chatRepository.readCurrentChatFourthWall();
                if (retained) {
                    emitState(retained);
                }
            }
            throw error;
        }
        assertSameActivation(current, payload);
        return next;
    }

    async function mutateChat(
        payload: UnknownRecord,
        action: (state: FourthWallChatState) => FourthWallChatState,
    ): Promise<FourthWallClientState> {
        const current = assertActivation(payload, true);
        const next = await mutateBoundChat(current, payload, action);
        return emitState(next);
    }

    async function mutateGlobalSettings(
        current: Activation,
        payload: UnknownRecord,
        action: (settings: FourthWallGlobalSettings) => FourthWallGlobalSettings,
    ): Promise<void> {
        try {
            await settingsRepository.mutateFourthWall(action);
        } catch (error) {
            if (isUnconfirmedSave(error)) {
                assertSameActivation(current, payload);
                const retained = chatRepository.readCurrentChatFourthWall();
                if (retained) {
                    emitState(retained);
                }
            }
            throw error;
        }
    }

    async function handleMessage(
        message: { type: string; requestId?: string; payload?: unknown },
    ): Promise<unknown> {
        const payload =
            message.payload && typeof message.payload === 'object' && !Array.isArray(message.payload)
                ? (message.payload as UnknownRecord)
                : {};
        const action = message.type.slice('fourth-wall/'.length);

        if (action === 'cancel') {
            assertActivation(payload);
            return { cancelled: generationRuntime.cancel('user-cancelled') };
        }
        if (action === 'refresh') {
            assertActivation(payload);
            const state = chatRepository.readCurrentChatFourthWall();
            if (!state) {
                throw new Error('四次元壁聊天数据不存在');
            }
            return emitState(state);
        }
        if (action === 'update-chat-settings') {
            const patch =
                payload.patch && typeof payload.patch === 'object' && !Array.isArray(payload.patch)
                    ? (payload.patch as Partial<FourthWallChatState['settings']>)
                    : {};
            return await mutateChat(payload, (state) => updateChatSettings(state, patch));
        }
        if (action === 'switch-session') {
            generationRuntime.cancel('session-switched');
            return await mutateChat(payload, (state) => switchSession(state, String(payload.targetSessionId || '')));
        }
        if (action === 'add-session') {
            generationRuntime.cancel('session-created');
            return await mutateChat(payload, (state) =>
                addSession(state, {
                    id: createId(),
                    name: payload.name,
                    createdAt: now(),
                }),
            );
        }
        if (action === 'rename-session') {
            return await mutateChat(payload, (state) =>
                renameSession(state, String(payload.sessionId || ''), payload.name),
            );
        }
        if (action === 'delete-session') {
            generationRuntime.cancel('session-deleted');
            return await mutateChat(payload, (state) => deleteSession(state, String(payload.sessionId || '')));
        }
        if (action === 'edit-message') {
            return await mutateChat(payload, (state) =>
                editMessage(state, String(payload.sessionId || ''), Number(payload.messageIndex), payload.content),
            );
        }
        if (action === 'delete-message') {
            return await mutateChat(payload, (state) =>
                deleteMessage(state, String(payload.sessionId || ''), Number(payload.messageIndex)),
            );
        }
        if (action === 'clear-history') {
            generationRuntime.cancel('history-cleared');
            return await mutateChat(payload, (state) => clearSession(state, String(payload.sessionId || '')));
        }
        if (action === 'send') {
            const current = assertActivation(payload, true);
            if (generationRuntime.isRunning()) {
                throw new Error('已有回复正在生成');
            }
            const userInput = String(payload.content || '').trim();
            const sessionId = String(payload.sessionId || '');
            const next = await mutateBoundChat(current, payload, (state) =>
                appendMessage(state, sessionId, {
                        role: 'user',
                        content: userInput,
                        ts: now(),
                    }),
            );
            const clientState = emitState(next);
            launchGeneration({
                chatState: next,
                sessionId,
                userInput,
                requestId: String(message.requestId || ''),
            });
            return clientState;
        }
        if (action === 'regenerate') {
            const current = assertActivation(payload, true);
            generationRuntime.cancel('regenerated');
            let userInput = '';
            const sessionId = String(payload.sessionId || '');
            const next = await mutateBoundChat(current, payload, (state) => {
                    const prepared = prepareRegeneration(state, sessionId);
                    userInput = prepared.userInput;
                    return prepared.state;
            });
            const clientState = emitState(next);
            launchGeneration({
                chatState: next,
                sessionId,
                userInput,
                requestId: String(message.requestId || ''),
            });
            return clientState;
        }
        if (action === 'update-global-settings') {
            const current = assertActivation(payload);
            const patch =
                payload.patch && typeof payload.patch === 'object' && !Array.isArray(payload.patch)
                    ? (payload.patch as FourthWallGlobalSettingsPatch)
                    : {};
            await mutateGlobalSettings(current, payload, (settings) => normalizeGlobalSettings(settings, patch));
            commentaryRuntime?.sync();
            assertSameActivation(current, payload);
            const chatState = chatRepository.readCurrentChatFourthWall();
            if (!chatState) {
                throw new Error('四次元壁聊天数据不存在');
            }
            return emitState(chatState);
        }
        if (action === 'restore-prompts') {
            const current = assertActivation(payload);
            const defaults = createDefaultFourthWallGlobalSettings();
            await mutateGlobalSettings(current, payload, (settings) => ({
                ...settings,
                promptTemplates: defaults.promptTemplates,
            }));
            assertSameActivation(current, payload);
            const chatState = chatRepository.readCurrentChatFourthWall();
            if (!chatState) {
                throw new Error('四次元壁聊天数据不存在');
            }
            return emitState(chatState);
        }
        if (action === 'image-check') {
            assertActivation(payload, true);
            if (!imageProtocol) {
                throw new Error('画图能力不可用');
            }
            return await imageProtocol.check({ tags: payload.tags });
        }
        if (action === 'image-generate') {
            const current = assertActivation(payload, true);
            if (!imageProtocol) {
                throw new Error('画图能力不可用');
            }
            return await imageProtocol.generate({
                requestId: payload.mediaRequestId,
                tags: payload.tags,
                onProgress(progress) {
                    if (activation === current) {
                        post('fourth-wall/image-progress', { mediaRequestId: payload.mediaRequestId, ...progress });
                    }
                },
            });
        }
        if (action === 'image-cancel') {
            assertActivation(payload);
            if (!imageProtocol) {
                return { cancelled: false };
            }
            return { cancelled: imageProtocol.cancel(payload.mediaRequestId) };
        }
        if (action === 'voice-play') {
            const current = assertActivation(payload, true);
            if (!voiceProtocol) {
                throw new Error('TTS 能力不可用');
            }
            return voiceProtocol.play({
                requestId: payload.mediaRequestId,
                text: payload.text,
                emotion: payload.emotion,
                onState(state) {
                    if (activation === current) {
                        post('fourth-wall/voice-state', state);
                    }
                },
            });
        }
        if (action === 'voice-stop') {
            assertActivation(payload);
            if (!voiceProtocol) {
                return { stopped: false };
            }
            return { stopped: voiceProtocol.stop(String(payload.mediaRequestId || '')) };
        }
        throw new Error('unsupported_fourth_wall_action');
    }

    function cancelForeground(reason: string): void {
        activationGeneration += 1;
        activation = null;
        generationRuntime.cancel(reason);
        imageProtocol?.cancelAll?.();
        voiceProtocol?.cancelAll?.();
    }

    return Object.freeze({
        activate,
        deactivate,
        handleMessage,
        cancelForeground,
        cancelAll(reason: string) {
            cancelForeground(reason);
            commentaryRuntime?.cancel();
        },
        handleWindowOpened() {
            commentaryRuntime?.cancel();
        },
        handleChatChanged() {
            commentaryRuntime?.cancel();
        },
        startBackground() {
            commentaryRuntime?.start();
        },
        stopBackground() {
            commentaryRuntime?.stop();
        },
    });
}
