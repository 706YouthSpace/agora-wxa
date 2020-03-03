

export function isNative(obj: any) {
    if (typeof obj !== 'object') {
        return false;
    }

    if (obj instanceof Promise) {
        return true;
    }

    if (obj instanceof Date) {
        return true;
    }

    if (obj instanceof RegExp) {
        return true;
    }

    if (obj instanceof Map) {
        return true;
    }

    if (obj instanceof Set) {
        return true;
    }

    return false;
}
