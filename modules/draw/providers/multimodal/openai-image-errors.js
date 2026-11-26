import protocol from '../../shared/multimodal-image-protocol.cjs';
import { ImageRequestOutcome, imageHttpOutcome, withImageRequestOutcome } from '../../shared/image-request-outcome.js';
import { MULTIMODAL_COPY as COPY } from './copy.js';

const codes = protocol.OPENAI_IMAGE_CODES;

const messages = Object.freeze({
    [codes.imagesNotFound]: () => COPY.imagesNotFound,
    [codes.responsesNotFound]: () => COPY.responsesNotFound,
    [codes.noImage]: () => COPY.responsesNoImage,
    [codes.failed]: COPY.responsesFailed,
    [codes.interrupted]: () => COPY.responsesInterrupted,
    [codes.connectionLost]: () => COPY.responsesInterrupted,
    [codes.timedOut]: () => COPY.responsesTimedOut,
    [codes.invalidPrompt]: () => COPY.invalidOpenAiPrompt(protocol.OPENAI_IMAGE_PROMPT_LIMIT),
    invalid_result: () => COPY.invalidOpenAiImage,
    upstream_error: (status, reason) => (imageHttpOutcome(status) === ImageRequestOutcome.UNKNOWN
        ? COPY.openAiUnknownHttp(status, reason) : COPY.openAiHttpFailure(status, reason)),
});
export const isOpenAiImageDisplayError = error => Object.hasOwn(messages, error?.code);

export function openAiResultOutcome({ code, status }) {
    if ([codes.interrupted, codes.timedOut, codes.connectionLost].includes(code)) return ImageRequestOutcome.UNKNOWN;
    if ([codes.failed, codes.noImage, 'invalid_result'].includes(code)) return ImageRequestOutcome.REJECTED;
    if (code === codes.invalidPrompt) return ImageRequestOutcome.NOT_SUBMITTED;
    if (status) return imageHttpOutcome(status);
}

export function formatOpenAiImageError(error, referenceCount) {
    const { code, status, reason } = error;
    if (!isOpenAiImageDisplayError(error)) return error;
    const references = referenceCount && (status || code === codes.failed) ? ` ${COPY.imageFailureReferences(referenceCount)}` : '';
    const failure = Object.assign(new Error(messages[code](status, reason) + references), { code });
    if (status !== undefined) failure.status = status;
    const outcome = openAiResultOutcome(failure);
    return outcome ? withImageRequestOutcome(failure, outcome) : failure;
}
