export async function promiseTimeout<T>(ms: number, promise: Promise<T>): Promise<T | never> {
    let id: ReturnType<typeof setTimeout>;
    const timeout: Promise<never> = new Promise(
        (resolve: () => never, reject: (reason?: any) => void): void => {
            id = setTimeout(() => {
                reject("Timed out in " + ms + "ms.");
            }, ms);
        }
    );

    return Promise.race([promise, timeout])
        .then((result: T) => {
            clearTimeout(id);
            return result;
        })
        .catch((error: any) => {
            clearTimeout(id);
            throw error;
        });
}
