import _ from '../vendors/lodash';
import { isNative } from './util';

interface RoutedProxyHandler<T extends object> {
    getPrototypeOf?(target: T, routes: string[]): object | null;
    setPrototypeOf?(target: T, v: any, routes: string[]): boolean;
    isExtensible?(target: T, routes: string[]): boolean;
    preventExtensions?(target: T, routes: string[]): boolean;
    getOwnPropertyDescriptor?(target: T, p: PropertyKey, routes: string[]): PropertyDescriptor | undefined;
    has?(target: T, p: PropertyKey, routes: string[]): boolean;
    get?(target: T, p: PropertyKey, receiver: any, routes: string[]): any;
    set?(target: T, p: PropertyKey, value: any, receiver: any, routes: string[]): boolean | undefined;
    deleteProperty?(target: T, p: PropertyKey, routes: string[]): boolean | undefined;
    defineProperty?(target: T, p: PropertyKey, attributes: PropertyDescriptor, routes: string[]): boolean;
    enumerate?(target: T, routes: string[]): PropertyKey[];
    ownKeys?(target: T, routes: string[]): PropertyKey[];
    apply?(target: T, thisArg: any, argArray?: any, routes?: string[]): any;
    construct?(target: T, argArray: any, newTarget?: any, routes?: string[]): object;
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

export function isPositiveInt(dig: any) {
    return Math.abs(parseInt(dig)).toString() === dig.toString();
}

export function routedNestedProxy<T extends object>(
    target: T, handlers: RoutedProxyHandler<T>, deproxySymbol: symbol = Symbol('Default RoutedNestedProxy Deproxy Symbol')
) {
    const proxyMap = new WeakMap<object, any>();
    const routeTrack = new WeakMap<Object, Set<string>>();
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

    const bareRoot = deproxy(target);

    function clearRoute(bareTgt: any, routeToClear: string) {
        const routeSet = routeTrack.get(bareTgt);
        if (!routeSet) {
            return;
        }

        for (const route of routeSet.values()) {
            if (route.startsWith(routeToClear)) {
                routeSet.delete(route);
                const o = _.get(bareRoot, route);
                if (o) {
                    clearRoute(o, route);
                }
            }
        }
    }

    function setRoute(bareTgt: any, routeToSet: string) {
        const routeSet = routeTrack.get(bareTgt);
        if (!routeSet) {
            return;
        }

        routeSet.add(routeToSet);

        for (const key of Object.getOwnPropertyNames(bareTgt)) {
            const val = bareTgt[key];
            if (isObject(val)) {
                const trackRoute = (Array.isArray(bareTgt) && isPositiveInt(key)) ?
                    `${routeToSet}[${key as string}]` :
                    `${routeToSet ? routeToSet + '.' : routeToSet}${key as string}`;
                setRoute(val, trackRoute);
            }
        }
    }

    function getRoutes(tgt: object) {
        const bareObj = deproxy(tgt);
        const routeSet = routeTrack.get(bareObj);
        if (!routeSet) {
            throw new TypeError('Unable to find route set for active target');
            // return null;
        }
        const activeRoutes: string[] = [];
        const deadRoutes: string[] = [];
        for (const route of routeSet.values()) {
            if (route === '' && target === bareObj) {
                activeRoutes.push(route);
                continue;
            }
            if (_.get(target, route) === bareObj) {
                activeRoutes.push(route);
                continue;
            }
            deadRoutes.push(route);
        }
        for (const x of deadRoutes) {
            clearRoute(tgt, x);
        }
        // if (!activeRoutes.length) {
        //     throw new TypeError('Unable to find valid route for active target');
        // }

        return activeRoutes;
    }

    modifiedHandlers.get = (tgt: any, key, _receiver) => {
        const bareTgt = deproxy(tgt);
        const routes = getRoutes(tgt);
        if (handlers.get && routes.length) {
            const result = handlers.get(tgt, key, _receiver, routes);
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
        // const propDesc = Object.getOwnPropertyDescriptor(bareTgt, key);

        if (isNative(orig)) {
            return orig;
        }

        const bareObj = deproxy(orig);
        const refProxy = proxyMap.get(bareObj);
        if (refProxy) {
            return refProxy;
        }

        if (isObject(bareObj) && (typeof key === 'string') && routes.length) {
            const proxy = wrap(bareObj, bareTgt, key);

            return proxy;
        }

        return orig;
    };

    modifiedHandlers.set = (tgt: any, key, val, _receiver) => {
        const bareTgt = deproxy(tgt);
        const orig = bareTgt[key];
        const routes = getRoutes(bareTgt);
        const bareVal = deproxy(val);
        // console.log(tgt, key, val, route);
        if (handlers.set && routes.length) {
            const result = handlers.set(bareTgt, key, bareVal, _receiver, routes);
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
        if (isObject(bareVal) && (typeof key === 'string') && routes.length) {
            if (orig === bareVal) {
                return true;
            }

            if (proxyMap.has(orig)) {
                const trackRoutes = (Array.isArray(bareTgt) && isPositiveInt(key)) ?
                    routes.map((route) => `${route}[${key as string}]`) : routes.map((route) => `${route ? route + '.' : route}${key as string}`);

                for (const r of trackRoutes) {
                    clearRoute(orig, r);
                }
            }

            wrap(bareVal, bareTgt, key);

            return true;
        }

        return true;
    };

    modifiedHandlers.deleteProperty = (tgt: any, key) => {

        const bareTgt = deproxy(tgt);
        const orig = bareTgt[key];
        const routes = getRoutes(bareTgt);
        // console.log(tgt, key, val, route);
        if (handlers.deleteProperty && routes.length) {
            const result = handlers.deleteProperty(bareTgt, key, routes);
            if (result === false) {
                return result;
            }
            if (result === undefined) {
                if (typeof key === 'symbol') {
                    // tslint:disable-next-line: no-dynamic-delete
                    delete bareTgt[key];

                    return true;
                }

                // tslint:disable-next-line: no-dynamic-delete
                delete bareTgt[key];
            }
        } else {
            // tslint:disable-next-line: no-dynamic-delete
            delete bareTgt[key];
        }

        if ((typeof key === 'string') && routes.length) {
            const trackRoutes = (Array.isArray(bareTgt) && isPositiveInt(key)) ?
                routes.map((route) => `${route}[${key as string}]`) : routes.map((route) => `${route ? route + '.' : route}${key as string}`);

            for (const r of trackRoutes) {
                clearRoute(orig, r);
            }

            return true;
        }

        return true;
    };

    for (const x in handlers) {
        if (x !== 'get' && x !== 'set' && x !== 'deleteProperty') {
            (modifiedHandlers as any)[x] = function (...argv: any[]) {
                const route = getRoutes(argv[0]);

                return (handlers as any)[x].call(this, ...argv, route);
            };
        }
    }

    function wrap(bareObj: object, bareParent?: object, wrapKey: string = '') {
        const parentRouteSet = bareParent ? routeTrack.get(bareParent) : new Set<string>(['']);
        if (!parentRouteSet) {
            throw new Error('Unable to finde routeset for parentObj');
        }
        const parentRoutes = Array.from(parentRouteSet);
        const newRoutes = (Array.isArray(bareParent) && isPositiveInt(wrapKey)) ?
            parentRoutes.map((route) => `${route}[${wrapKey as string}]`) :
            parentRoutes.map((route) => `${route ? route + '.' : route}${wrapKey as string}`);

        if (proxyMap.has(bareObj)) {
            const routeSet = routeTrack.get(bareObj);
            if (routeSet) {
                for (const route of newRoutes) {
                    routeSet.add(route);
                }
            } else {
                routeTrack.set(bareObj, new Set(newRoutes));
            }

            for (const route of newRoutes) {
                setRoute(bareObj, route);
            }

            return proxyMap.get(bareObj);
        }
        const { proxy, revoke } = Proxy.revocable(bareObj, modifiedHandlers);

        proxyMap.set(bareObj, proxy);
        routeTrack.set(bareObj, new Set(newRoutes));
        revocations.add(revoke);

        for (const key of Object.getOwnPropertyNames(bareObj)) {
            const val = (bareObj as any)[key];
            const bareVal = deproxy(val);

            if (isObject(bareVal)) {
                const trackRoutes = (Array.isArray(bareObj) && isPositiveInt(key)) ?
                    newRoutes.map((route) => `${route}[${key as string}]`) :
                    newRoutes.map((route) => `${route ? route + '.' : route}${key as string}`);
                if (!proxyMap.has(bareVal)) {
                    wrap(bareVal, bareObj, key);
                } else {
                    const routeSet = routeTrack.get(bareVal);
                    if (routeSet) {
                        for (const trackRoute of trackRoutes) {
                            routeSet.add(trackRoute);
                        }
                    } else {
                        routeTrack.set(bareVal, new Set(trackRoutes));
                    }
                }
            }
        }

        return proxy;
    }


    if (!isObject(bareRoot)) {
        throw new Error('Only object could be proxied');
    }

    const rootProxy = wrap(bareRoot);

    const revokeFunc = () => {
        for (const x of revocations) {
            x();
        }
    };

    return { proxy: rootProxy, revoke: revokeFunc, proxyMap, getRoutes, routeTrack };
}

export default routedNestedProxy;
