// Frozen native exports from SillyTavern 1.14.0:
// public/scripts/personas.js and public/script.js. Also verified in 1.17.0 and 1.18.0.
export let user_avatar = '';
export const default_user_avatar = 'img/user-default.png';
export const default_avatar = 'img/ai4.png';

export function getThumbnailUrl(type, file, t = false) {
    return `/thumbnail?type=${type}&file=${encodeURIComponent(file)}${t ? `&t=${Date.now()}` : ''}`;
}
