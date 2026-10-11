import type { Campaign, ConversationTurn } from '../campaign/types.js';
import type { Participant } from './participants.js';
import type { Performance } from '../performance/catalog.js';

type Greeting = { reply: string; performance: Performance };
/** Authored first speech, shared by the visible transcript and model history. */
const GREETINGS: Record<Participant, { initial: Greeting; returned?: Greeting }> = {
    sanniang: { initial: { reply: '先坐一坐。檐下不常见生面孔，身上可有哪里不舒服？路上受的凉、磕碰的小伤，都可以同我说。', performance: { expression: 'smile', gesture: 'gesture' } } },
    laobai: { initial: { reply: '生面孔啊。找人，还是找路？找人我倒认得几个，找路嘛……我这条腿，眼下只能给你指指。', performance: { expression: 'teasing', gesture: 'tilt' } } },
    anian: {
        initial: { reply: '嗯？……你不是这里的人。是来接我们的吗？这些货签我还留着，就是泡皱了。', performance: { expression: 'surprised', gesture: 'tilt' } },
        returned: { reply: '啊，你来了。三娘让我在这儿歇着……你要坐吗？这边还有地方。', performance: { expression: 'neutral', gesture: 'gesture' } },
    },
    kouzi: {
        initial: { reply: '哎，新来的。别站那儿挡光，我正看这道缝呢。……外头现在什么动静？', performance: { expression: 'serious', gesture: 'tilt' } },
        returned: { reply: '哎，找我？站稳了再说，这边管子松着。别伸手，我自己下得来。', performance: { expression: 'neutral', gesture: 'gesture' } },
    },
    bajin: { initial: { reply: '来人止步。此处是哨站正门，往来均须验签。把凭签拿出来，有什么事，一并说清楚。', performance: { expression: 'neutral', gesture: 'gesture' } } },
    changyounian: { initial: { reply: '这位，且留步。烽火台不是寻常走动的地方，不知是哪一位放你上来的？若有公事，不妨先说给我听。', performance: { expression: 'neutral', gesture: 'tilt' } } },
};

export function greetingTurn(campaign: Campaign, person: Participant): ConversationTurn {
    const options = GREETINGS[person];
    const speech = campaign.facts.includes('captives_arrived') && options.returned ? options.returned : options.initial;
    return { id: `greeting-${person}`, kind: 'greeting', player: '', ...structuredClone(speech), action: null,
        scene: campaign.location.scene, facts: [...campaign.knowledge[person]] };
}
export function greet(campaign: Campaign, person: Participant) {
    if (!campaign.conversations[person].length) { campaign.conversations[person].push(greetingTurn(campaign, person)); }
}
