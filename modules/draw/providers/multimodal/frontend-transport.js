import protocol from '../../shared/multimodal-image-protocol.cjs';
import references from '../../shared/reference-image-contract.cjs';
import { MediaApiError } from '../../../../shared/media-api.js';
import { mergeAbortSignals } from '../../../../shared/common/abort-utils.js';
import { imageBlob } from '../../shared/image-collection.js';
import { createImageRequestAttempt, imageHttpFailure } from '../../shared/image-request-outcome.js';
import { createSerialImageRequestQueue } from '../../shared/serial-image-request-queue.js';
import { runSequentialImageBatch } from '../../shared/sequential-image-batch.js';
import { MULTIMODAL_COPY as COPY } from './copy.js';

const queues = new Map();

export function createMultimodalFrontendTransport(provider, { fetchImage = (...args) => fetch(...args) } = {}) {
    const adapter = protocol.protocols[provider];
    if (!queues.has(provider)) queues.set(provider, createSerialImageRequestQueue());
    const queue = queues.get(provider);
    const requestImage = (context, item, { signal, onStarting, onQueued } = {}) => queue.enqueue(async () => {
        const attempt = createImageRequestAttempt();
        try {
            const { url, ...request } = adapter.request(context, item.request);
            if (await onStarting?.() === false) return null;
            const timeout = AbortSignal.timeout(item.timeout);
            const requestSignal = mergeAbortSignals(signal, timeout);
            attempt.submit(requestSignal);
            const response = await fetchImage(url, { ...request, method: 'POST', signal: requestSignal, redirect: 'error' });
            if (!response.ok) throw imageHttpFailure(new Error(COPY.imageHttpFailure(response.status)), response.status);
            const { values, incomplete, code, reason } = adapter.result(await response.json(), item.request.payload);
            const all = item.request.resultMode === 'all';
            const images = [];
            let invalid = incomplete;
            for (const value of values) {
                try {
                    if (references.base64Size(value.data) <= 0) throw new MediaApiError('invalid_result');
                    const blob = imageBlob(value.data);
                    if (value.mimeType !== undefined && value.mimeType !== blob.type) throw new MediaApiError('invalid_result');
                    if (!all) return value.data;
                    images.push(blob);
                } catch (error) {
                    if (!(error instanceof MediaApiError)) throw error;
                    invalid = true;
                }
            }
            if (!images.length) {
                const error = new Error(code === 'image_blocked' ? COPY.imageBlocked : COPY.imageMissing(reason));
                error.code = values.length ? 'invalid_result' : code;
                throw error;
            }
            if (invalid) throw new MediaApiError('partial_result', { partialResult: { images } });
            return images;
        } catch (error) {
            throw attempt.failure(error);
        }
    }, { signal, onQueued });

    return {
        requestImage,
        runBatch({ compiledBatch: { context, items }, signal, checkChat, onStateChange, onItemStarting, onItemReady, onItemSettled }) {
            return runSequentialImageBatch({ count: items.length, signal, onItemReady, onItemSettled,
                request: index => requestImage(context, items[index], {
                    signal,
                    onQueued: detail => onStateChange?.('queued', detail),
                    async onStarting() {
                        checkChat?.();
                        if (await onItemStarting?.({ index }) === false) return false;
                        onStateChange?.('gen', { current: index + 1, total: items.length });
                    },
                }),
            });
        },
    };
}
