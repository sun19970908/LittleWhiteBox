// V5 interleaves prose and private status blocks; text outside wrappers remains prose.
export function passageText(text: string) {
    let prose = '', cursor = 0, status = false;
    for (const match of String(text || '').matchAll(/<(\/?)(meta-chapter|meta-status)>|<!--meta-write:complete-->/g)) {
        if (!status) {prose += text.slice(cursor, match.index);}
        if (match[2]) {status = !match[1] && match[2] === 'meta-status';}
        cursor = match.index + match[0].length;
    }
    if (!status) {prose += String(text || '').slice(cursor);}
    return prose.trim();
}
