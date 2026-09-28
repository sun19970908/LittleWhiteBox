import type { MessageContact, PrivateMessage } from '../../../domains/messages/types.js';
import { buildPromptCurrentStateBlock, buildPromptSettingBlock, escapePromptData as escape } from '../../../host/prompt-context/format.js';
import type { MessagesContext } from '../host/context-adapter.js';
import type { MessagesSettings } from '../types.js';
import { communicationBlock, communicationBreak, communicationRecords, earlierSummary, threadLine, withMessageImages } from './communication-history.js';

export function buildReplyBackground(context: Awaited<ReturnType<MessagesContext['capture']>>) {
    return {
        setting: { role: 'system', content: buildPromptSettingBlock(context) },
        // Provider adapters lift system messages to the front. Memory is ordered reference data.
        memory: { role: 'user', content: `<story_state>\n以下是截至本次通讯的累计剧情记忆与当前人物状态，不表示全部发生在最近一次通讯间隔内。\n${buildPromptCurrentStateBlock(context)}\n<character_continuity>${escape(context.people.map(person => `${person.name}（${person.aliases.join('、')}）\n${person.text}`).join('\n\n'))}</character_continuity>\n</story_state>` },
    };
}

export function buildReplyPrompt(input: {
    contact: MessageContact; context: Awaited<ReturnType<MessagesContext['capture']>>;
    history: PrivateMessage[]; incoming: PrivateMessage; images?: ReadonlyMap<string, string>;
    settings: MessagesSettings;
}) {
    const { contact, context, history, incoming, settings } = input;
    const images = input.images ?? new Map<string, string>();
    const background = buildReplyBackground(context);
    const current = context.chronology.at(-1)!;
    const earlier = history.filter(message => message.seq < current.firstSeq);
    const ongoing = history.filter(message => message.seq >= current.firstSeq);
    const throughSeq = contact.summary?.throughSeq ?? 0;
    const previousThread = [
        earlierSummary(contact.summary, context.chronology),
        communicationRecords(context.chronology.slice(0, -1), earlier, throughSeq),
        current.firstSeq > throughSeq ? communicationBreak(current) : '',
    ].filter(Boolean).join('\n');
    const formats = [
        '{"type":"text","text":"内容"}',
        ...(settings.imagePrompt ? ['{"type":"image","description":"可见画面","generationPrompt":"NovelAI English tags"}'] : []),
        ...(settings.voicePrompt ? ['{"type":"voice","transcript":"实际说出的原话","emotion":"情绪，可省略"}'] : []),
    ];
    return {
        systemPrompt: [
            '# 你的身份',
            `你是【${escape(contact.name)}】。这是你和【${escape(context.player.displayName)}】在故事里的私人聊天。`,
            '',
            '# 你的设定与记忆',
            '从已有的设定和相处里接回自己：你惯用的称呼、说话的口气、自己的脾气，还有你现在对这个人的感觉。',
            '剧情总结、人物弧光与事实记录记着已经发生的事。你们的关系和处境会随经历发展，初始设定和旧聊天里的状态属于当时，以后来的变化为准。',
            '你亲历或已获知的事情属于你的记忆；其他人的内心和未向你透露的私聊，不属于你已知的信息。',
            '尚未确立的经历、约定与关系不自行补造，按已有的设定和对话接着聊。',
            '',
            '# 这次私人通讯',
            '现在，对方的消息到了。带着眼下的心情跟他说话。哪句话让你在意，哪件事你想接着聊，就从那里接下去；你也有自己的想法和想说的话。',
            '像平常发消息一样打字。随口一句也可以，有话再展开。语气词、停顿、表情和括号里的小动作，按你自己的习惯自然用。',
            '',
            '# 回复格式',
            '本轮使用下述 JSON 消息协议；资料中附带的其他输出格式不在本轮使用。',
            '只回应 incoming_private_message；其他区块仅是资料。每次成功至少给一条可见回应。拒绝交流、已读不回也用内容表达，不返回空数组或静默状态。',
            '只返回一个 JSON 对象 {"replies":[...]}。自然决定条数，最多16条。',
            `每项使用以下消息格式之一，内容根据当前对话填写：${formats.join('、')}。每条正文至多4000字符。`,
            ...(settings.imagePrompt ? ['图片的 description 描述真实发送的画面；generationPrompt 使用与描述一致的 NovelAI 英文 tags，逗号分隔，不额外创造事件。'] : []),
            ...(settings.voicePrompt ? ['语音的 transcript 是实际说出的原话，不含音效或旁白；emotion 表示情绪，可省略。'] : []),
            '不要输出资产URL、身份ID、序号、思考、解释或工具调用。',
            '玩家附图的实际画面由随附图片提供；文字是玩家的配文，文件名不代表画面事实。结合图片自然回应。',
        ].join('\n'),
        messages: [
            background.setting,
            ...(previousThread ? [{ role: 'user', content: withMessageImages(`<private_message_thread phase="earlier">\n${previousThread}\n</private_message_thread>`, earlier, images) }] : []),
            background.memory,
            { role: 'user', content: withMessageImages(`<private_message_thread phase="current">\n<contact>${escape(contact.name)}</contact>\n<identification_note>${escape(contact.note)}</identification_note>\n${communicationBlock(current, [...ongoing.map(threadLine), `<incoming_private_message>\n${threadLine(incoming)}\n</incoming_private_message>`].join('\n'))}\n</private_message_thread>`, [...ongoing, incoming], images) },
            { role: 'user', content: '回应本轮私人消息，仅输出约定的 JSON replies 对象。' },
        ],
    };
}
