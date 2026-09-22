// One subscription per resident floor, released with its ChatSurface lease.
// This changes presentation only: no generation, storage or synthetic host events.
export function createStorySummaryMessageDecorator({ isEnabled, mountButton, subscribeToggle }) {
    return (element, mesid) => {
        let releaseButton;
        function reconcile() {
            if (isEnabled()) {
                releaseButton ??= mountButton(element, mesid);
            } else {
                releaseButton?.();
                releaseButton = undefined;
            }
        }

        const unsubscribe = subscribeToggle(reconcile);
        try {
            reconcile();
        } catch (error) {
            unsubscribe();
            throw error;
        }
        return () => {
            unsubscribe();
            releaseButton?.();
            releaseButton = undefined;
        };
    };
}
