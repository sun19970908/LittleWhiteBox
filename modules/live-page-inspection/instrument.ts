import { COLLECTOR_KEY } from './contract';

// The same source is safe to share between blob-cache users; no frame-specific token.
// Calling the parent synchronously installs listeners before the first author script.
export function instrumentPageHtml(html: string): string {
    const script = '<script>try{if(typeof parent[' + JSON.stringify(COLLECTOR_KEY) + ']==="function")parent['
        + JSON.stringify(COLLECTOR_KEY) + '](window)}catch(e){if(e.name!=="SecurityError")throw e}</script>';
    let inserted = false;
    const withHead = html.replace(/<!--[\s\S]*?-->|<([a-z][\w:-]*)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/giu, (match, tag: string | undefined) => {
        if (inserted || !tag || !['head', 'script'].includes(tag.toLowerCase())) { return match; }
        inserted = true;
        return tag.toLowerCase() === 'head' ? match + script : script + match;
    });
    if (inserted) { return withHead; }
    const root = /<html\b[^>]*>/iu;
    if (root.test(html)) {return html.replace(root, match => match + '<head>' + script + '</head>');}
    return script + html;
}
