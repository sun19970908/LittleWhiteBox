// Kept in its own build chunk so DevTools can skip only this forwarding frame.
export function createConsoleForwarder(original, capture) {
    return (...args) => {
        if (capture(args)) return;
        return original(...args);
    };
}
