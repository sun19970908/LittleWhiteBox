let loading: Promise<FontFace> | undefined;
export async function loadMapSymbols(): Promise<void> {
    if (!loading) {
        const relativePath = ['..', '..', '..', 'libs', 'material-symbols', 'material-symbols-rounded.woff2'].join('/');
        const url = new URL(relativePath, import.meta.url);
        loading = new FontFace('Xiaobai Map Symbols', `url("${url.href}")`, { display: 'block', weight: '400' }).load();
        loading.catch(() => {loading = undefined;});
    }
    document.fonts.add(await loading);
}
