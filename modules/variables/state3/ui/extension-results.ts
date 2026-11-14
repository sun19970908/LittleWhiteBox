import type { ExtensionDetails } from '../types.js';
import { EXTENSION_COPY as C } from '../extensions/copy.js';

export function showExtensionDetails(root: HTMLElement, extensions?: ExtensionDetails) {
    if (!extensions) {return;}
    const details = document.createElement('details'), summary = document.createElement('summary');
    summary.textContent = C.trace; details.append(summary);
    if (extensions.modelRequests !== undefined) {
        const count = document.createElement('p'); count.textContent = C.modelRequests(extensions.modelRequests); details.append(count);
    }
    for (const call of extensions.calls) {
        const title = document.createElement('p'), output = document.createElement('pre');
        title.textContent = `${call.kind === 'tool' ? C.tools : C.phases[call.kind]} · ${call.name}`;
        output.textContent = JSON.stringify({ path: call.path, input: call.input, output: call.output, error: call.error }, null, 2);
        details.append(title, output);
    }
    root.append(details);
}
