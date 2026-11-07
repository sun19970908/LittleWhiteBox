import { COPY, errorText } from './copy.js';
interface Toast { error(message: string, title?: string): void; info(message: string): void }
const toast = () => (globalThis as typeof globalThis & { toastr?: Toast }).toastr;
export const notifyError = (error: unknown) => toast()?.error(errorText(error), COPY.title);
export const notifyInfo = (message: string) => toast()?.info(message);
