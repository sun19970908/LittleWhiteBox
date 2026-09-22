// The composition root supplies the owning feature's continuation predicate.
// No persisted "deferred" status: a postponed floor remains an ordinary L0 gap.
let isContinuationPending = () => false;

export function configureL0ContinuationCheck(check) {
    isContinuationPending = check;
}

export function isL0FloorDeferred(chat, floor = chat.length - 1) {
    const message = chat[floor];
    return floor === chat.length - 1 && !!message && !message.is_user && isContinuationPending(message);
}
