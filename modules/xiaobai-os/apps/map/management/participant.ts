import type { ManagementParticipant, ManagementTool } from '../../../capabilities/management/index.js';
import { MANAGEMENT_READ_CHARS, textPage } from '../../../capabilities/management/read-page.js';
import { createEmptyMapDomain } from '../../../domains/map/state.js';
import type { MapService } from '../application/service.js';
import { compileAtlasIntent } from '../tools/atlas-intent-compiler.js';
import { compileSceneIntent } from '../tools/scene-intent-compiler.js';
import { readAtlas } from '../tools/atlas-reader.js';
import { resolveSceneKey, sceneForTool } from '../tools/scene-reader.js';
import { mapTools } from '../tools/tool-contract.js';
import { createManagementSave } from '../../../capabilities/management/save.js';
import { jsonValuesEqual } from '../../../host/json-values-equal.js';
import { createMapReadBaseline } from './read-baseline.js';

export function createMapManagement(map: MapService, player: () => { actorKey: 'player'; displayName: string }): ManagementParticipant {
    return { id: 'map', label: '地图', confirmPending: map.confirmPending,
        async open() {
            await map.refreshCurrent();
            let current = map.readCurrent().map ?? createEmptyMapDomain();
            const baseline = createMapReadBaseline(current);
            const saving = createManagementSave(map.confirmPending);
            const tools: ManagementTool[] = mapTools('Saves valid edits. Returns {ok,status,data}; status is saved, partial, unchanged or failed. data contains the edit report {ok,status,changed,applied,skipped,warnings,hint?,data?}; its status describes the edit, while the outer status describes persistence.').map(tool => {
                const definition = structuredClone(tool) as ManagementTool['definition'];
                const name = definition.function.name;
                const read = name.endsWith('Read');
                if (name === 'MapAtlasRead') {
                    const properties = definition.function.parameters.properties as Record<string, Record<string, unknown>>;
                    properties.mode.enum = ['summary', 'locations', 'links', 'actors'];
                    properties.limit.maximum = 20;
                    properties.limit.description = 'Page size; default and maximum 20.';
                    definition.function.description = 'Read the current atlas. Default data contains counts and player position; collection data contains the named collection, count, returned, truncated, nextOffset and revision. Locations include hasScene. Use existing keys for edits.';
                } else if (name === 'MapSceneRead') {
                    (definition.function.parameters.properties as Record<string, unknown>).offset = { type: 'integer', minimum: 0 };
                    definition.function.description = `Read one scene in MapSceneEdit vocabulary, or null if it has no layout. data contains a JSON text page with text, offset, nextOffset and totalChars, at most ${MANAGEMENT_READ_CHARS} characters. Continue at nextOffset to read the rest.`;
                }
                return { definition, effect: read ? 'read' : 'write', label: ({ MapAtlasRead: '查看图册', MapSceneRead: '查看场景', MapAtlasEdit: '修改图册', MapSceneEdit: '修改场景' } as Record<string, string>)[name],
                    target: args => String(args.scene ?? args.query ?? args.mode ?? '') };
            });
            return {
                recover: saving.recover,
                confirmSaved: saving.confirmSaved,
                prompt: '# Map\nThe atlas holds places, routes and actor positions; scenes hold spatial layouts. Initial data contains atlas counts and the player position. Use MapAtlasRead collections to find place or actor keys, and MapSceneRead for layout edits. Supply spatial facts; the map generates appearance from categories, materials and geometry.',
                initial: readAtlas(current, { mode: 'summary' }).data,
                tools,
                async execute(name, args, guard) {
                    if (name.endsWith('Read')) { await map.refreshCurrent(); current = map.readCurrent().map ?? createEmptyMapDomain(); }
                    if (name === 'MapAtlasRead') {
                        if (args.mode === 'document' || Number(args.limit ?? 20) > 20) { throw new Error('map_read_page_required'); }
                        const data = readAtlas(current, { ...args, limit: args.limit ?? 20 }).data as Record<string, unknown>;
                        baseline.atlas(current, data);
                        return { ok: true, status: 'read', data };
                    }
                    if (name === 'MapSceneRead') {
                        const key = resolveSceneKey(current, String(args.scene ?? ''));
                        const owner = current.atlas.locations.find(l => l.sceneKey === key);
                        const scene = current.scenes[key];
                        baseline.scene(current, key, Number(args.offset ?? 0));
                        return { ok: true, status: 'read', data: textPage(JSON.stringify(scene && owner ? sceneForTool(scene, owner) : null), args.offset) };
                    }
                    if (!['MapAtlasEdit', 'MapSceneEdit'].includes(name)) { throw new Error('management_tool_unknown'); }
                    await map.refreshCurrent(); current = map.readCurrent().map ?? createEmptyMapDomain();
                    const compiled = name === 'MapAtlasEdit' ? compileAtlasIntent(current, args, player()) : compileSceneIntent(current, args, player());
                    if (!compiled.edits.length) { return { ok: compiled.result.ok, status: compiled.result.ok ? 'unchanged' : 'failed', data: compiled.result }; }
                    baseline.assertEdits(current, compiled.edits);
                    const expected = current;
                    const result = { ok: compiled.result.ok, status: compiled.result.status === 'partial' ? 'partial' as const : 'saved' as const, data: compiled.result };
                    return saving.run(async commitGuard => {
                        const saved = await map.replaceCurrent(compiled.domain, { expectedRevision: expected.revision, beforeCommit: () => { if (!commitGuard()) { throw new Error('management_context_changed'); } } });
                        current = saved.map ?? createEmptyMapDomain();
                        baseline.saved(current, compiled.edits);
                        return result;
                    }, async () => {
                        await map.refreshCurrent(); current = map.readCurrent().map ?? createEmptyMapDomain();
                        if (current.revision === expected.revision + 1 && jsonValuesEqual(current.atlas, compiled.domain.atlas) && jsonValuesEqual(current.scenes, compiled.domain.scenes)) { baseline.saved(current, compiled.edits); return { status: 'confirmed', result }; }
                        return { status: jsonValuesEqual(current, expected) ? 'unchanged' : 'superseded' };
                    }, guard);
                },
            };
        },
    };
}
