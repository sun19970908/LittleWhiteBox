import type { ValidateFunction } from 'ajv';
import type { StoredDelta } from './engine/difference.js';
import type { createFunctionRunner } from './engine/functions.js';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };
export type Path = string[];
export type UpdateStage = 'before' | 'after';
export type Schema = boolean | Record<string, unknown>;
export interface Expression {
    literal?: Json; get?: Path; before?: Path; param?: Path;
    op?: string; args?: Expression[]; call?: string;
}
export interface Effect { path: Path; value: Expression }
export interface Rule extends Effect { id: string; kind: 'derive' | 'correct'; description: string }
export interface Action { id: string; title: string; stages?: UpdateStage[]; parameters: Schema; description: string; requires: Expression; effects: Effect[]; conversions: Effect[] }
export interface Trigger { id: string; description: string; timing?: 'batch' | 'action'; when: Expression; effects: Effect[] }
export interface Definition {
    format: number; name: string; updates: UpdateStage[]; schema: Schema; initial: JsonObject;
    access: { path: Path; write: string[]; stages?: UpdateStage[]; description: string; update?: string }[];
    rules: Rule[]; actions: Action[]; triggers?: Trigger[];
    constraints: { id: string; test: Expression; description: string }[];
    functions: Record<string, { reads: Path[]; description: string }>;
    views: Record<string, { paths: Path[]; description: string }>;
}
export interface Bundle { definition: Definition; functions: Record<string, string> }
export interface Compiled {
    bundle: Bundle; definition: Definition; rules: Rule[];
    actions: Map<string, Action & { validate: ValidateFunction }>;
    validate: ValidateFunction;
}
export type Operation = ({ op: 'set'; path: Path; value: Json } | { op: 'remove'; path: Path } | { op: 'inc'; path: Path; delta: number } | { action: string; params: JsonObject }) & { [note: string]: unknown };
export interface Source { kind: 'input' | 'action' | 'derive' | 'correct' | 'trigger'; id?: string; title?: string; description?: string }
export interface Change { path: Path; before?: Json; after?: Json; removed: boolean }
export type Comparison = 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte';
export interface ConditionValue { kind: 'field' | 'parameter' | 'value'; name?: string; path?: Path; before?: boolean; value?: Json }
export type Condition = { kind: 'comparison'; operator: Comparison; left: ConditionValue; right: ConditionValue }
    | { kind: 'any'; conditions: Condition[] }
    | { kind: 'function'; id: string; description: string; expected: boolean }
    | { kind: 'value'; operand: ConditionValue; expected: boolean };
export interface ParameterIssue { keyword: string; path: Path; name: string; params: Record<string, unknown> }
export interface Diagnostic { code: string; message?: string; path?: unknown; rule?: string; actionTitle?: string; condition?: Condition; parameters?: ParameterIssue[]; [key: string]: unknown }
export interface Failure { ok: false; diagnostics: Diagnostic[] }
export interface Success {
    ok: true; state: Json; changes: Change[]; provenance: (Change & { source: Source })[];
    actions: { id: string; params?: JsonObject }[]; diagnostics: Diagnostic[];
    committed?: boolean; saved?: boolean; version?: string; receipt?: Receipt;
    persistence?: Diagnostic;
    /** Live restoration feedback only; never stored in receipts or chat metadata. */
    restoration?: Diagnostic[];
    annotations?: { index: number; path?: Path; action?: string; fields: [string, unknown][] }[];
}
export type Result = Success | Failure;
export interface RunOptions { signal?: AbortSignal; stage?: UpdateStage }
export interface EvaluationContext extends RunOptions { bundle: Bundle; before?: Json; state: Json; params: JsonObject; functions?: ReturnType<typeof createFunctionRunner> }
export interface Receipt {
    id: string; revision: number; source: string; delta: StoredDelta; actions: Success['actions'];
    applied?: StoredDelta;
    beforeUpdate?: BeforeUpdate;
}
/** Owned by the USER receipt: survives reload, and disappears with that receipt. */
export interface BeforeUpdate {
    inputDigest: string;
    outcome: 'applied' | 'rejected' | 'skipped' | 'undone' | 'failed';
    diagnostics: Diagnostic[];
}
export interface SwipeRecord { entries: Receipt[] }
export interface History {
    format: 2; roots: string[]; version: string; revision: number;
    checkpoints: { floor: number; revision: number; state: Json }[];
}
export interface Snapshot {
    state: Json;
    history?: History; records: SwipeRecord[]; index: number;
    /** Last floor with receipts, including unselected reply alternatives; -1 if empty. */
    lastReceiptIndex: number;
    target: { floor: number; swipeId: number };
}
export interface HostAdapter<S extends Snapshot = Snapshot> {
    bundle(): Bundle;
    capture(index?: number): S;
    isCurrent(snapshot: S): boolean;
    assertMutable(snapshot: S): void;
    publish(snapshot: S, update: { state: Json; history: History; records: SwipeRecord[]; invalidateFrom?: number }): () => Promise<void>;
    committed?(result: Success): void;
}
