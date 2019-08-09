export { flatten, collectPromises };

function flatten<T>(arr: T[][]): T[] {
    return ([] as T[]).concat(...arr);
}
function collectPromises<S, T>(sources: S[], extractor: (s: S) => Promise<T[]>): Promise<T[]> {
    return Promise.all(sources.map(extractor)).then(flatten);
}
