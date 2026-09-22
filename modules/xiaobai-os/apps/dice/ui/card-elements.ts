export function diceSpan(className: string, text = ''): HTMLSpanElement {
    const element = document.createElement('span');
    element.className = className; element.textContent = text;
    return element;
}
