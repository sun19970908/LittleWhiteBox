import type { MaintenanceFunctionDeclaration } from '../../../capabilities/maintenance/registry.js';
import { WORLD_WRITE_LIMITS as L } from '../../../domains/world/types.js';

const text = (maxLength: number, description: string) => ({ type: 'string', maxLength, description });

export function worldEditTool(saveDescription: string): MaintenanceFunctionDeclaration {
    return { type: 'function', function: {
        name: 'WorldEdit',
        description: [
            'Edit overview and news in one atomic batch. Unmentioned items remain; existing items keep their order, new items appear first in input order. A failed batch changes nothing.',
            `Maximum ${L.news} current items. Text limits count Unicode code points.`,
            saveDescription,
        ].join('\n'),
        parameters: { type: 'object', additionalProperties: false, properties: {
            overview: text(L.overview, 'Wider-world atmosphere. Omit to keep; an empty string clears it.'),
            upsert: { type: 'array', maxItems: L.news, description: 'Complete new or replacement articles. Reuse the same ID to continue an item.', items: {
                type: 'object', additionalProperties: false, required: ['id', 'title', 'body'], properties: {
                    id: text(L.id, 'Stable non-empty article ID. Each ID appears once in this batch, in upsert or remove.'),
                    title: text(L.title, 'Non-empty article title.'),
                    body: text(L.body, 'Non-empty plain-text news brief. Used for reading and story background; its opening is also the list preview.'),
                },
            } },
            remove: { type: 'array', maxItems: L.news, items: text(L.id, 'Article ID to retire. A missing ID is already removed.') },
        } },
    } };
}

export const WORLD_TOOLS: readonly MaintenanceFunctionDeclaration[] = Object.freeze([
    { type: 'function', function: {
        name: 'WorldRead',
        description: 'Read the complete current draft, including article bodies omitted from the initial reference data and changes from successful edits. Returns {overview,news:[{id,title,body}]}, without truncation.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
    } },
    worldEditTool([
        'Changes remain in the draft until the app saves after the run. Returns {ok,status,changed,data:{overview,news},errors:[{path,message}]}. status is updated, unchanged (already matches; success) or failed.',
        'errors also lists unresolved changes from earlier failed batches, even when this call succeeds. These corrections must be completed before the publication can be saved.',
        'Resolve a rejected article with a valid upsert or remove. remove deletes an existing article; for a rejected new ID it abandons that proposal. To retain an existing article, upsert its complete values from WorldRead, shortening the body if needed to meet the writing limit. Resolve a rejected overview by resubmitting the desired or unchanged overview.',
    ].join('\n')),
]);
