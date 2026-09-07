import assert from 'node:assert/strict';
import test from 'node:test';

import { createHostPromptContextAdapter } from '../host/prompt-context/capture.js';

const user = (mes, name = '玩家') => ({ is_user: true, is_system: false, mes, name });
const assistant = (mes, name = '角色') => ({ is_user: false, is_system: false, mes, name, swipe_id: 0 });

test('host prompt context keeps the accepted boundary out of recent history while scanning it for active world info', async () => {
    const scans = [];
    const storyBoundaries = [];
    const context = {
        chatId: 'chat-a',
        groupId: null,
        characterId: 0,
        name1: '玩家',
        name2: '角色',
        characters: [{ avatar: 'role.png', name: '角色' }],
        maxContext: 131_072,
        worldInfoIncludeNames: true,
        powerUserSettings: { persona_description: '旅人' },
        getCharacterCardFields() {
            return {
                persona: '旅人（已展开）',
                description: '角色描述',
                personality: '角色性格',
                charDepthPrompt: '角色深度提示',
                scenario: '当前场景',
                creatorNotes: '创作者注释',
            };
        },
        chat: [user('旧 U'), assistant('旧 A'), user('接受 U'), assistant('接受 A'), user('触发 U')],
        async getWorldInfoPrompt(messages, budget, dryRun, globalScanData) {
            scans.push({ messages, budget, dryRun, globalScanData });
            return { worldInfoBefore: '激活设定', worldInfoAfter: '', worldInfoDepth: [] };
        },
    };
    const adapter = createHostPromptContextAdapter({
        readContext: () => context,
        readStoryEvents(through) {storyBoundaries.push(through); return 'L2 事件';},
    });
    const captured = await adapter.capture({ throughMessageIndex: 3, recentBeforeIndex: 2 });

    assert.deepEqual(captured.contextSnapshot.recentMessages.map(message => message.text), ['旧 U', '旧 A']);
    assert.deepEqual(scans, [{
        messages: ['角色: 接受 A', '玩家: 接受 U', '角色: 旧 A', '玩家: 旧 U'],
        budget: 131_072,
        dryRun: true,
        globalScanData: {
            personaDescription: '旅人（已展开）',
            characterDescription: '角色描述',
            characterPersonality: '角色性格',
            characterDepthPrompt: '角色深度提示',
            scenario: '当前场景',
            creatorNotes: '创作者注释',
            trigger: 'normal',
        },
    }]);
    assert.deepEqual(storyBoundaries, [3]);
    assert.equal(captured.contextSnapshot.storyEvents, 'L2 事件');
    assert.equal(JSON.stringify(captured.contextSnapshot).includes('触发 U'), false);
});

test('world info and Story Summary failures omit only their optional blocks', async () => {
    const failures = [];
    const context = {
        chatId: 'chat-a', groupId: null, characterId: 0, name1: '玩家', name2: '角色',
        characters: [], chat: [user('U'), assistant('A')],
        async getWorldInfoPrompt() {throw new Error('world failed');},
    };
    const adapter = createHostPromptContextAdapter({
        readContext: () => context,
        readStoryEvents() {throw new Error('summary failed');},
        report: error => failures.push(error.message),
    });
    const captured = await adapter.capture();
    assert.deepEqual(captured.contextSnapshot.worldInfo, { before: '', after: '', depth: [] });
    assert.equal(captured.contextSnapshot.storyEvents, '');
    assert.deepEqual(failures.sort(), ['summary failed', 'world failed']);
});
