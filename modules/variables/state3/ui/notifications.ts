import { COPY, playerErrorText } from './copy.js';
interface Toast { error(message: string, title?: string): void; info(message: string): void }
const toast = () => (globalThis as typeof globalThis & { toastr?: Toast }).toastr;
export const notifyError = (error: unknown) => toast()?.error(playerErrorText(error), COPY.title);
export const notifyInfo = (message: string) => toast()?.info(message);
