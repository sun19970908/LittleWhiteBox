import type { Campaign, DialogueEffects } from './types.js';
import type { Participant } from '../content/participants.js';
import { fault } from '../random.js';

/** One bounded checkpoint: no transcripts, summaries, battle frames or nested snapshots. */
export function dialogueEffects(campaign: Campaign): DialogueEffects {
    const { seed, facts, knowledge, relationships, people, pendingParley } = campaign;
    return structuredClone({ seed, facts, knowledge, relationships, people, pendingParley });
}
export function latestReply(campaign: Campaign) {
    const checkpoint = campaign.lastReply;
    if (!checkpoint) { return null; }
    const turn = campaign.conversations[checkpoint.person].at(-1);
    return turn?.id === checkpoint.turnId ? { person: checkpoint.person, turn } : null;
}
export function pendingEnding(campaign: Campaign) {
    const reply = latestReply(campaign);
    return reply?.turn.action === 'finish' && !campaign.facts.includes('chapter_completed') ? reply.person : null;
}
export function rewindReply(campaign: Campaign, person: Participant, turnId: string): Campaign {
    const latest = latestReply(campaign), checkpoint = campaign.lastReply;
    if (!checkpoint || latest?.person !== person || latest.turn.id !== turnId) { fault('stale'); }
    const candidate = structuredClone(campaign);
    Object.assign(candidate, structuredClone(checkpoint.before));
    candidate.conversations[person].pop();
    delete candidate.lastReply;
    return candidate;
}
