
import _ from '../vendors/lodash';
import { isNative } from './util';

interface PatchedProxyHandler<T extends object> {
    getPrototypeOf?(target: T, ): object | null;
    setPrototypeOf?(target: T, v: any): boolean;
    isExtensible?(target: T): boolean;
    preventExtensions?(target: T): boolean;
    getOwnPropertyDescriptor?(target: T, p: PropertyKey): PropertyDescriptor | undefined;
    has?(target: T, p: PropertyKey): boolean;
    get?(target: T, p: PropertyKey, receiver: any): any;
    set?(target: T, p: PropertyKey, value: any, receiver: any): boolean | void;
    deleteProperty?(target: T, p: PropertyKey): boolean;
    defineProperty?(target: T, p: PropertyKey, attributes: PropertyDescriptor): boolean;
    enumerate?(target: T): PropertyKey[];
    ownKeys?(target: T): PropertyKey[];
    apply?(target: T, thisArg: any, argArray?: any): any;
    construct?(target: T, argArray: any, newTarget?: any): object;
}

function isObject(obj: any) {
    if ((typeof obj) === 'object' && obj !== null) {
        return true;
    }
    // if ((typeof obj) === 'function') {
    //     return true;
    // }

    return false;
}

export function nestedProxy<T extends object>(
    target: T, handlers: PatchedProxyHandler<T>, deproxySymbol: symbol = Symbol('Default NestedProxy Deproxy Symbol')
) {
    const proxyMap = new WeakMap<object, any>();
    const revocations = new Set<Function>();

    const modifiedHandlers: ProxyHandler<T> = {};

    function deproxy(obj: any): any {
        if (!isObject(obj)) {
            return obj;
        }
        const x = obj[deproxySymbol];
        if (x) {
            return deproxy(x);
        }

        return obj;
    }

    modifiedHandlers.get = (tgt: any, key, _receiver) => {
        const bareTgt = deproxy(tgt);
        if (handlers.get) {
            const result = handlers.get(bareTgt, key, _receiver);
            if (result !== undefined && result !== null) {
                return result;
            }
        }
        // if (key === 'WHOIAM') {
        //     return deproxySymbol.toString();
        // }
        if (key === deproxySymbol) {
            return bareTgt;
        }
        const orig = bareTgt[key];
        if (typeof key === 'symbol') {
            return orig;
        }
        if (isNative(orig)) {
            return orig;
        }

        const bareObj = deproxy(orig);
        const refProxy = proxyMap.get(bareObj);
        if (refProxy) {
            return refProxy;
        }

        if (isObject(bareObj) && (typeof key === 'string')) {
            const proxy = wrap(bareObj);

            return proxy;
        }

        return orig;
    };

    modifiedHandlers.set = (tgt: any, key, val, _receiver) => {
        const bareTgt = deproxy(tgt);
        const bareVal = deproxy(val);
        // console.log(tgt, key, val, route);
        if (handlers.set) {
            const result = handlers.set(bareTgt, key, bareVal, _receiver);
            if (result === false) {
                return result;
            }
            if (result === undefined) {
                if (typeof key === 'symbol') {
                    bareTgt[key] = val;

                    return true;
                }

                bareTgt[key] = val;
            }
        } else {
            bareTgt[key] = val;
        }


        // const orig = bareTgt[key];
        // if (isObject(bareVal) && (typeof key === 'string')) {
        //     if (orig === val) {
        //         return true;
        //     }

        //     if (orig === bareVal) {
        //         return true;
        //     }

        //     wrap(bareVal);

        //     return true;
        // }

        return true;
    };

    for (const x in handlers) {
        if (x !== 'get' && x !== 'set') {
            (modifiedHandlers as any)[x] = (handlers as any)[x];
        }
    }
    // let serial = 0;
    // const dedup = new Set();
    function wrap(obj: object) {
        const bareObj = deproxy(obj);
        // if (dedup.has(wrap)) {

        // }
        if (proxyMap.has(bareObj)) {
            return proxyMap.get(bareObj);
        }
        // const i = serial++;
        const x = { ...modifiedHandlers };
        // const origGet = x.get!;
        // x.get = (tgt: any, key, _receiver) => {
        //     if (key === 'WHOIAM') {
        //         return i;
        //     }

        //     return origGet(tgt, key, _receiver);
        // };
        const { proxy, revoke } = Proxy.revocable(bareObj, x);

        proxyMap.set(bareObj, proxy);
        revocations.add(revoke);

        // for (const key of Object.getOwnPropertyNames(bareObj)) {
        //     const val = (bareObj as any)[key];
        //     const bareVal = deproxy(val);
        //     if (isObject(bareVal)) {
        //         wrap(val);
        //     }
        // }

        return proxy;
    }


    const rootProxy = wrap(target);



    const revokeFunc = () => {
        for (const x of revocations) {
            x();
        }
    };

    return { proxy: rootProxy, revoke: revokeFunc, proxyMap };
}

export default nestedProxy;
