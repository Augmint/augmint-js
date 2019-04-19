export function promiseTimeout(ms: number, promise: Promise<any>): any {
    let id: ReturnType<typeof setTimeout>;
    const timeout = new Promise((resolve, reject) => {
        id = setTimeout(() => {
            reject("Timed out in " + ms + "ms.");
        }, ms);
    });

    return Promise.race([promise, timeout])
        .then(result => {
            clearTimeout(id);
            return result;
        })
        .catch(error => {
            clearTimeout(id);
            throw error;
        });
}
