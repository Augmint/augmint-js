export { flatten, collectPromises, mapMap };

function flatten<T>(arr: T[][]): T[] {
    return ([] as T[]).concat(...arr);
}

function collectPromises<S, T>(sources: S[], extractor: (s: S) => Promise<T[]>): Promise<T[]> {
    return Promise.all(sources.map(extractor)).then(flatten);
}

function mapMap<K, V1, V2>(map: Map<K, V1>, fun: (v: V1) => V2): Map<K, V2> {
    return new Map(Array.from(map, ([key, val]) => [key, fun(val)]));
}
