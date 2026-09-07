import type { XiaobaiOsStoragePort } from '../kernel/contracts.js';

export type { XiaobaiOsStoragePort };

export class XiaobaiOsStorageError extends Error {
    readonly httpStatus?: number;

    constructor(
        readonly code: string,
        message: string,
        readonly retryable: boolean,
        options: { cause?: unknown; httpStatus?: number } = {},
    ) {
        super(message, options);
        this.name = 'XiaobaiOsStorageError';
        this.httpStatus = options.httpStatus;
    }
}
