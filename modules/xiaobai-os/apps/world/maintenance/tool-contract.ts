import type { MaintenanceFunctionDeclaration } from '../../../capabilities/maintenance/registry.js';
import { WORLD_LIMITS as L } from '../../../domains/world/types.js';

const text = (maxLength: number, description: string) => ({ type: 'string', maxLength, description });

export const WORLD_TOOLS: readonly MaintenanceFunctionDeclaration[] = Object.freeze([
    { type: 'function', function: {
        name: 'WorldRead',
        description: 'Read the complete current draft, including article bodies omitted from the initial reference data and changes from successful edits. Returns {overview,news:[{id,title,summary,body}]}, without truncation.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
    } },
    { type: 'function', function: {
        name: 'WorldEdit',
        description: [
            'Maintain the current draft in one atomic batch. Unmentioned items remain; existing items keep their order, new items appear first in input order.',
            `Maximum ${L.news} current items. Text limits count Unicode code points.`,
            'Returns {ok,status,changed,data:{overview,news},errors:[{path,message}]}. status is updated, unchanged or failed. unchanged is success, not a reason to retry. A failed batch changes nothing; correct its affected items before committing other edits.',
            'errors also lists unresolved changes from earlier failed batches, even when this call succeeds. These corrections must be completed before the publication can be saved.',
            'Resolve a rejected article with a valid upsert or remove. remove deletes an existing article; for a rejected new ID it abandons that proposal. To abandon a change while keeping an existing article, upsert its complete unchanged values from WorldRead. Resolve a rejected overview by resubmitting the desired or unchanged overview.',
        ].join('\n'),
        parameters: { type: 'object', additionalProperties: false, properties: {
            overview: text(L.overview, 'Wider-world atmosphere. Omit to keep; an empty string clears it.'),
            upsert: { type: 'array', maxItems: L.news, description: 'Complete new or replacement articles. Reuse the same ID to continue an item.', items: {
                type: 'object', additionalProperties: false, required: ['id', 'title', 'summary', 'body'], properties: {
                    id: text(L.id, 'Stable non-empty article ID. Each ID appears once in this batch, in upsert or remove.'),
                    title: text(L.title, 'Non-empty article title.'),
                    summary: text(L.summary, 'Non-empty standalone news summary for both the list and story background.'),
                    body: text(L.body, 'Non-empty full article in plain-text paragraphs.'),
                },
            } },
            remove: { type: 'array', maxItems: L.news, items: text(L.id, 'Article ID to retire. A missing ID is already removed.') },
        } },
    } },
]);
