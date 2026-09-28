export function notifySillyTavernSuccess({ title, message }: { title: string; message: string }): void {
    // Same global toast as /echo severity=success, without parsing text as commands/macros.
    const toastr = window.toastr as unknown as {
        success?(message: string, title: string, options: { escapeHtml: boolean; timeOut: number }): void;
    } | undefined;
    toastr?.success?.(message, title, { escapeHtml: true, timeOut: 8_000 });
}
