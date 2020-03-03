// tslint:disable: only-arrow-functions
import _ from '../vendors/lodash';
import * as events from '../vendors/events';
import '../vendors/reflect-metadata';

import { routedNestedProxy, isPositiveInt } from '../utils/routed-nested-proxy';
import { Defer, Deferred } from '../utils/defer';
import { WXService, wxService } from './wx-service';
import { dataChannel } from './data-channel';

const CIVILIZED_WXA_DEPROXY_SYMBOL = Symbol('Civilized Wxa Deproxy Symbol');

const WX_ALLOWED_PROP_TYPES = new Set([String, Number, Boolean, Object, Array]);

export class CivilizedApp {
    [k: string]: any;

    globalData: { [k: string]: any } = {};

    wxService = wxService;
}

interface AbstractWxaApp {
    globalData: { [k: string]: any };
}

export interface CivilizedApp extends AbstractWxaApp, events.EventEmitter {

}

export function WxaApp<T extends typeof CivilizedApp>(constructor: T) {
    const baseObj: any = {};

    const WX_APP_HOOKS = [
        'hide', 'error', 'pageNotFound'
    ];

    let tickOne = true;

    wx.nextTick(() => {
        tickOne = false;
    });

    baseObj.onLaunch = function (...args: any[]) {

        Object.assign(this, events.EventEmitter.prototype);
        events.EventEmitter.call(this as any);

        const source = this.__proto__.__proto__;

        Object.setPrototypeOf(CivilizedApp.prototype, source);
        Object.setPrototypeOf(this, constructor.prototype);

        constructor.call(this);

        wx.nextTick(() => {
            this.emit('launch', ...args);
        });
    };

    baseObj.onShow = function (...args: any[]) {
        if (tickOne) {
            wx.nextTick(() => {
                this.emit('show', ...args);
            });

            return;
        }
        this.emit('show', ...args);
    };

    for (const x of WX_APP_HOOKS) {
        baseObj[`on${x[0].toUpperCase()}${x.slice(1)}`] = function (...args: any[]) {
            this.emit(x, ...args);
        };
    }

    baseObj.globalData = {};

    App(baseObj);

}


interface WxaPageDecoratorOptions {
    listenPageScroll?: boolean;
    registerShareHandler?: string | symbol | { title?: string; path?: string; imageUrl?: string } | boolean | Function;
    initialData?: { [k: string]: any };
    [k: string]: any;
}

// tslint:disable-next-line: no-unnecessary-class
export class CivilizedPage {
    // tslint:disable-next-line: variable-name
    static __wxaProfile: {
        methods?: { [k: string]: any };
        properties?: { [k: string]: any };
        paramters?: { [k: string]: any };
        class?: WxaPageDecoratorOptions | WxaComponentDecoratorOptions;
    };

    static data: { [k: string]: any };

    ctx: { [k: string]: any };

    _currentTick = 0;
    _tickTrackMap = new Map<number, Deferred<void>>();

    constructor() {
        let setDataShouldRun = false;
        let fullSync = false;
        let dataToSet: any = {};

        const setDataTickRoutine = () => {
            if (!setDataShouldRun) {
                setDataShouldRun = true;
                wx.nextTick(() => {
                    if (setDataShouldRun) {
                        const currentTick = this._currentTick;
                        this._currentTick += 1;
                        // console.log('DATA:', fullSync ? this.data : dataToSet);
                        this.setData(fullSync ? this.data : dataToSet, () => {
                            for (const tickNum of this._tickTrackMap.keys()) {
                                if (currentTick >= tickNum) {
                                    const theDeferred = this._tickTrackMap.get(tickNum)!;
                                    theDeferred.resolve();
                                    this._tickTrackMap.delete(tickNum);
                                }
                            }
                        });
                        dataToSet = {};
                        setDataShouldRun = false;
                        fullSync = false;
                    }
                });
            }
        };

        const prepareDataSet = (route: string, val: any) => {
            let noPointToSet = false;
            for (const x in dataToSet) {
                if (dataToSet.hasOwnProperty(x)) {
                    if (x.startsWith(`${route}.`) || x.startsWith(`${route}[`)) {
                        // tslint:disable-next-line: no-dynamic-delete
                        delete dataToSet[x];
                        continue;
                    } else if (route.startsWith(`${x}.`) || route.startsWith(`${x}[`)) {
                        noPointToSet = true;
                        break;
                    }

                }
            }
            if (!noPointToSet) {
                dataToSet[route] = val;
            }
        };

        const { proxy, revoke, routeTrack, getRoutes, proxyMap } = routedNestedProxy(
            this.data,
            {
                set: (tgt, key, value, _recever, routes) => {
                    tgt[key as any] = value;
                    for (const route of routes) {
                        const access = makeSetDataAccessPath(tgt, route, key);

                        if (access) {
                            prepareDataSet(access, value);
                        } else if (route) {
                            prepareDataSet(route, tgt);
                        } else {
                            fullSync = true;
                        }
                    }

                    setDataTickRoutine();

                    return true;
                },
                deleteProperty: (tgt, key, routes) => {

                    // tslint:disable-next-line: no-dynamic-delete
                    delete tgt[key as any];

                    for (const route of routes) {
                        const access = makeSetDataAccessPath(tgt, route, key);
                        if (access) {
                            prepareDataSet(access, null);
                        } else if (route) {
                            prepareDataSet(route, tgt);
                        } else {
                            fullSync = true;
                        }
                    }

                    setDataTickRoutine();

                    return true;
                }
            },
            CIVILIZED_WXA_DEPROXY_SYMBOL
        );

        const listener = (changedObj: any, actualObj: any, changedKey: string) => {
            if (!routeTrack.has(changedObj)) {
                return;
            }

            const ourVersionOfChangedObj = proxyMap.get(changedObj);
            if (!ourVersionOfChangedObj) {
                return;
            }

            const ourVersionOfVal = ourVersionOfChangedObj[changedKey];

            const activeRoutes = getRoutes(changedObj);
            let i = 0;
            for (const route of activeRoutes) {
                const routeToBeSet = makeSetDataAccessPath(actualObj, route, changedKey);
                if (routeToBeSet) {
                    i += 1;
                    prepareDataSet(routeToBeSet, ourVersionOfVal);
                }
            }

            if (i) {
                setDataTickRoutine();
            }
        };
        dataChannel.on('change', listener);
        this.ctx = proxy;
        this.once('unload', () => {
            revoke();
            dataChannel.off('change', listener);
        });
    }

    viewTick() {
        const currentTick = this._currentTick;
        let currentTrack = this._tickTrackMap.get(currentTick);
        if (!currentTrack) {
            currentTrack = Defer();
            this._tickTrackMap.set(currentTick, currentTrack);
        }

        return currentTrack.promise;
    }
}

interface AbstractWxaPage {
    data: { [k: string]: any };

    route: string;
    setData: (data?: { [k: string]: any }, callback?: () => void) => void;
}

export interface CivilizedPage extends AbstractWxaPage, events.EventEmitter {
    wxService: WXService;
}

export function WxaPage(options: WxaPageDecoratorOptions = {}) {
    // tslint:disable-next-line: cyclomatic-complexity
    return function WxaPageDecorator<T extends typeof CivilizedPage>(constructor: T) {
        if (!constructor.hasOwnProperty('__wxaProfile')) {
            Object.defineProperty(constructor, '__wxaProfile', { value: Object.create(constructor.__wxaProfile || {}) });
        }
        constructor.__wxaProfile.class = { ...(constructor.__wxaProfile.class || {}), ...options };
        const baseObj: any = {};
        const WX_PAGE_HOOKS = [
            'show', 'ready', 'hide', 'unload', 'pullDownRefresh', 'reachBottom', 'resize', 'tabItemTap'
        ];

        for (const x of WX_PAGE_HOOKS) {
            baseObj[`on${x[0].toUpperCase()}${x.slice(1)}`] = function (...args: any[]) {
                this.emit(x, ...args);
            };
        }

        baseObj.onLoad = function (...args: any[]) {
            Object.assign(this, events.EventEmitter.prototype);
            events.EventEmitter.call(this);

            const source = this.__proto__.__proto__;

            if (Object.getPrototypeOf(CivilizedPage.prototype) !== source) {
                Object.setPrototypeOf(CivilizedPage.prototype, source);
            }

            Object.setPrototypeOf(this, constructor.prototype);
            const origData = this.data;

            Object.defineProperty(this, 'data', {
                enumerable: true,
                get: () => origData,
                set: (x) => this.setData(x),

            });
            this.wxService = wxService;
            constructor.call(this);

            this.emit('load', ...args);

            this.setData(this.data);
        };

        const classOps = constructor.__wxaProfile.class;

        if (constructor.data) {
            baseObj.data = constructor.data;
        }

        if (classOps) {
            if (classOps.listenPageScroll) {
                baseObj.onPageScroll = function (...args: any[]) {
                    this.emit('pageScroll', ...args);
                };
            }

            if (classOps.registerShareHandler) {
                switch (typeof classOps.registerShareHandler) {
                    case 'string':
                    case 'symbol': {
                        baseObj.onShareAppMessage = function (...args: any[]) {
                            return this[classOps.registerShareHandler as (string | symbol)](...args);
                        };
                        break;
                    }

                    case 'function': {
                        baseObj.onShareAppMessage = function (...args: any[]) {
                            return (classOps.registerShareHandler as Function).apply(this, args);
                        };
                        break;
                    }

                    case 'object': {

                        baseObj.onShareAppMessage = function (_args: any[]) {
                            return classOps.registerShareHandler;
                        };
                        break;
                    }

                    case 'boolean': {
                        baseObj.onShareAppMessage = function (_args: any[]) {
                            return {};
                        };
                        break;
                    }

                    default: {
                        void 0;
                    }
                }
            }

            if (classOps.initialData) {
                baseObj.data = classOps.initialData;
            }
        }

        const methodOps = constructor.__wxaProfile.methods;
        const paramOps = constructor.__wxaProfile.paramters;
        const propOps = constructor.__wxaProfile.properties;

        if (paramOps) {
            for (const propName in paramOps) {
                if (paramOps.hasOwnProperty(propName)) {
                    const decorationOptions: string[] = paramOps[propName];
                    if (!decorationOptions) {
                        throw new Error('Unable to find param decoration options for prop: ' + propName);
                    }
                    const func = (constructor.prototype as any)[propName];
                    if (!func || !func.call) {
                        throw new Error('Unable to find host function for pram decoration on constructor prototype: ' + propName);
                    }
                    (constructor.prototype as any)[propName] = function (event: any) {
                        if (arguments.length === 1 && (typeof event === 'object') && (event !== null) && event.type &&
                            (event.timeStamp || event.timestamp)    // WTF for the wx developers.
                        ) {
                            const argv: any[] = [event];
                            decorationOptions.forEach((x, i) => {
                                if (x) {
                                    argv[i] = _.get(event, x);
                                }
                            });

                            return func.call(this, ...argv);
                        }

                        return func.call(this, ...arguments);

                    };
                }
            }
        }

        if (methodOps) {
            for (const propName in methodOps) {
                if (methodOps.hasOwnProperty(propName)) {
                    const decorationOptions: WxaViewMethodDecoratorOptions = methodOps[propName];
                    if (!decorationOptions) {
                        throw new Error('Unable to find method decoration options for prop: ' + propName);
                    }

                    if (decorationOptions.__static) {
                        const func = (constructor as any)[propName];
                        if (decorationOptions.name && decorationOptions.name !== propName) {
                            (constructor as any)[decorationOptions.name] = func;
                        }
                        // const funcName = decorationOptions.name || propName;
                        // methods[funcName] = func;

                    } else {
                        const func = (constructor.prototype as any)[propName];
                        if (decorationOptions.name && decorationOptions.name !== propName) {
                            (constructor.prototype as any)[decorationOptions.name] = func;
                        }
                        // const funcName = decorationOptions.name || propName;
                        // methods[funcName] = func;
                    }
                }
            }
        }

        if (propOps) {
            for (const propName in propOps) {
                if (propOps.hasOwnProperty(propName)) {
                    const decorationOptions: WxaViewPropertyDecoratorOptions = propOps[propName];
                    if (!decorationOptions) {
                        throw new Error('Unable to find property decoration options for prop: ' + propName);
                    }

                    if (constructor.prototype.hasOwnProperty(propName)) {
                        throw new Error('Decorator is not supposed to override existing class property or method: ' + propName);
                    }

                    Object.defineProperty(constructor.prototype, propName, {
                        get() {
                            if (decorationOptions.name) {
                                return _.get(this.ctx, decorationOptions.name);
                            }

                            return this.ctx[propName];
                        },

                        set(v: any) {
                            if (decorationOptions.name) {
                                return _.set(this.ctx, decorationOptions.name, v);
                            }

                            this.ctx[propName] = v;
                        },

                        enumerable: true
                    });

                    if (decorationOptions.expose) {
                        if (!baseObj.properties) {
                            baseObj.properties = {};
                        }

                        if (decorationOptions.expose === true) {
                            const tsType = Reflect.getMetadata('design:type', constructor, propName);
                            baseObj.properties[decorationOptions.name || propName] = {
                                type: tsType === Object ? null : (tsType || null)
                            };
                        } else if (Array.isArray(decorationOptions.expose)) {
                            let exceptionalType = false;

                            for (const x of decorationOptions.expose) {
                                if (!WX_ALLOWED_PROP_TYPES.has(x)) {
                                    exceptionalType = true;
                                    break;
                                }
                            }
                            if (exceptionalType || decorationOptions.expose.length === 0) {
                                baseObj.properties[decorationOptions.name || propName] = {
                                    type: null
                                };
                            } else if (decorationOptions.expose.length === 1) {
                                baseObj.properties[decorationOptions.name || propName] = {
                                    type: decorationOptions.expose[0]
                                };
                            } else {
                                baseObj.properties[decorationOptions.name || propName] = {
                                    type: decorationOptions.expose[0],
                                    types: decorationOptions.expose
                                };
                            }
                        } else {
                            const configObj = decorationOptions.expose;
                            if (!configObj.type) {
                                const tsType = Reflect.getMetadata('design:type', constructor, propName);
                                configObj.type = tsType || null;
                            }
                            baseObj.properties[decorationOptions.name || propName] = configObj;
                        }
                    }
                }
            }
        }


        Page(baseObj);
    };
}

interface WxaViewPropertyDecoratorOptions {
    name?: string | symbol;
    expose?: true | Array<typeof Object | typeof Number | typeof String | typeof Array | typeof Boolean> | {
        type?: typeof Object | typeof Number | typeof String | typeof Array | typeof Boolean | null;
        optionalTypes?: Array<typeof Object | typeof Number | typeof String | typeof Array | typeof Boolean>;
        value?: any;
    };
    [k: string]: any;
}

export function wxaViewProperty(options: WxaViewPropertyDecoratorOptions = {}) {
    return function wxaViewPropertyDecorator(_target: any, propName: string | symbol) {

        if ((typeof _target) === 'function') {
            throw new Error('wxaViewPropertyDecorator could only be applied to instance props.');
        }

        const target = _target.constructor;
        if (!target.hasOwnProperty('__wxaProfile')) {
            Object.defineProperty(target, '__wxaProfile', { value: Object.create(target.__wxaProfile || null) });
        }
        target.__wxaProfile.properties = target.__wxaProfile.properties || {};
        target.__wxaProfile.properties[propName] = { ...(target.__wxaProfile.properties[propName] || {}), ...options };
    };
}

interface WxaViewMethodDecoratorOptions {
    name?: string | symbol;
    __static?: boolean;
    [k: string]: any;
}

export function wxaViewMethod(options: WxaViewMethodDecoratorOptions = {}) {
    return function wxaViewMethodDecorator(constructorOrPrototype: any, propName: string | symbol) {
        let target;
        if ((typeof constructorOrPrototype) === 'function') {
            target = constructorOrPrototype;
            if (!target.hasOwnProperty('__wxaProfile')) {
                Object.defineProperty(target, '__wxaProfile', { value: Object.create(target.__wxaProfile || null) });
            }
            target.__wxaProfile.methods = target.__wxaProfile.methods || {};
            target.__wxaProfile.methods[propName] = { ...(target.__wxaProfile.methods[propName] || {}), ...options, __static: true };

            return;
        } else if ((typeof constructorOrPrototype) === 'object') {
            target = constructorOrPrototype.constructor;
            if (!target.hasOwnProperty('__wxaProfile')) {
                Object.defineProperty(target, '__wxaProfile', { value: Object.create(target.__wxaProfile || null) });
            }
            target.__wxaProfile.methods = target.__wxaProfile.methods || {};
            target.__wxaProfile.methods[propName] = { ...(target.__wxaProfile.methods[propName] || {}), ...options };

            return;
        }

        throw new Error('Could not decide where to put decoration data');

    };
}

export function wxaViewParam(accessPath: string = '') {
    return function wxaViewParamDecorator(_target: any, funcName: string | symbol, parameterIndex: number) {

        if ((typeof _target) === 'function') {
            throw new Error('wxaViewParamDecorator could only be applied to instance methods.');
        }

        const target = _target.constructor;
        if (!target.hasOwnProperty('__wxaProfile')) {
            Object.defineProperty(target, '__wxaProfile', { value: Object.create(target.__wxaProfile || null) });
        }
        target.__wxaProfile.paramters = target.__wxaProfile.paramters || {};
        let paramHost = target.__wxaProfile.paramters[funcName];
        if (!paramHost) {
            paramHost = [];
            target.__wxaProfile.paramters[funcName] = paramHost;
        }
        paramHost[parameterIndex] = accessPath;
    };
}


interface WxaComponentDecoratorOptions {
    relations?: {
        [targetComponentName: string]: 'parent' | 'child' | 'ancestor' | 'descendant';
    };
    properties?: {
        [propName: string]: {
            type?: typeof Object | typeof Number | typeof String | typeof Array | typeof Boolean | null;
            optionalTypes?: Array<typeof Object | typeof Number | typeof String | typeof Array | typeof Boolean>;
            value?: any;
        };
    };
    externalClasses?: string[];
    options?: {
        multipleSlots?: boolean;
        addGlobalClass?: boolean;
    };
    initialData?: { [k: string]: any };
    [k: string]: any;
}

// tslint:disable-next-line: no-unnecessary-class
export class CivilizedComponent {
    // tslint:disable-next-line: variable-name
    static __wxaProfile: {
        methods?: { [k: string]: any };
        properties?: { [k: string]: any };
        paramters?: { [k: string]: any };
        class?: WxaComponentDecoratorOptions;
    };

    static data: { [k: string]: any };

    ctx: { [k: string]: any };

    _currentTick = 0;
    _tickTrackMap = new Map<number, Deferred<void>>();

    constructor() {
        let setDataShouldRun = false;
        let fullSync = false;
        let dataToSet: any = {};

        const setDataTickRoutine = () => {
            if (!setDataShouldRun) {
                setDataShouldRun = true;
                wx.nextTick(() => {
                    if (setDataShouldRun) {
                        const currentTick = this._currentTick;
                        this._currentTick += 1;
                        // console.log('COMP DATA:', fullSync ? this.data : dataToSet);
                        this.setData(fullSync ? this.data : dataToSet, () => {
                            for (const tickNum of this._tickTrackMap.keys()) {
                                if (currentTick >= tickNum) {
                                    const theDeferred = this._tickTrackMap.get(tickNum)!;
                                    theDeferred.resolve();
                                    this._tickTrackMap.delete(tickNum);
                                }
                            }
                        });
                        dataToSet = {};
                        setDataShouldRun = false;
                        fullSync = false;
                    }
                });
            }
        };

        const prepareDataSet = (route: string, val: any) => {
            let noPointToSet = false;
            for (const x in dataToSet) {
                if (dataToSet.hasOwnProperty(x)) {
                    if (x.startsWith(`${route}.`) || x.startsWith(`${route}[`)) {
                        // tslint:disable-next-line: no-dynamic-delete
                        delete dataToSet[x];
                        continue;
                    } else if (route.startsWith(`${x}.`) || route.startsWith(`${x}[`)) {
                        noPointToSet = true;
                        break;
                    }

                }
            }
            if (!noPointToSet) {
                dataToSet[route] = val;
            }
        };

        const { proxy, revoke, routeTrack, getRoutes, proxyMap } = routedNestedProxy(
            this.data,
            {
                set: (tgt, key, value, _recever, routes) => {
                    tgt[key as any] = value;
                    for (const route of routes) {
                        const access = makeSetDataAccessPath(tgt, route, key);

                        if (access) {
                            prepareDataSet(access, value);
                        } else if (route) {
                            prepareDataSet(route, tgt);
                        } else {
                            fullSync = true;
                        }
                    }

                    setDataTickRoutine();

                    return true;
                },

                deleteProperty: (tgt, key, routes) => {
                    // tslint:disable-next-line: no-dynamic-delete
                    delete tgt[key as any];

                    for (const route of routes) {
                        const access = makeSetDataAccessPath(tgt, route, key);

                        if (access) {
                            prepareDataSet(access, null);
                        } else if (route) {
                            prepareDataSet(route, tgt);
                        } else {
                            fullSync = true;
                        }
                    }

                    setDataTickRoutine();

                    return true;
                }
            },
            CIVILIZED_WXA_DEPROXY_SYMBOL
        );

        const listener = (changedObj: any, actualObj: object, changedKey: string) => {
            if (!routeTrack.has(changedObj)) {
                return;
            }

            const ourVersionOfChangedObj = proxyMap.get(changedObj);
            if (!ourVersionOfChangedObj) {
                return;
            }

            const ourVersionOfVal = ourVersionOfChangedObj[changedKey];

            const activeRoutes = getRoutes(changedObj);
            let i = 0;
            for (const route of activeRoutes) {
                const routeToBeSet = makeSetDataAccessPath(actualObj, route, changedKey);
                if (routeToBeSet) {
                    i += 1;
                    prepareDataSet(routeToBeSet, ourVersionOfVal);
                }
            }

            if (i) {
                setDataTickRoutine();
            }
        };
        dataChannel.on('change', listener);
        this.ctx = proxy;
        this.once('detached', () => {
            revoke();
            dataChannel.off('change', listener);
        });
    }

    viewTick() {
        const currentTick = this._currentTick;
        let currentTrack = this._tickTrackMap.get(currentTick);
        if (!currentTrack) {
            currentTrack = Defer();
            this._tickTrackMap.set(currentTick, currentTrack);
        }

        return currentTrack.promise;
    }
}

interface AbstractWxaComponent {
    is: string;
    id: string;

    dataset: { [k: string]: any };

    data: { [k: string]: any };
    properties: { [k: string]: any };

    setData: (data?: { [k: string]: any }, callback?: () => void) => void;
    hasBehavior: (savage: object) => void;
    triggerEvent: (name: string, detail?: { [k: string]: any }, options?: { bubbles?: boolean; composed?: boolean; capturePhase?: boolean }) => void;
    createSelectorQuery: () => wx.SelectorQuery;
    createIntersectionObserver: () => wx.IntersectionObserver;
    selectComponent: (selector: string) => AbstractWxaComponent;
    selectAllComponents: (selector: string) => AbstractWxaComponent[];
    getRelationNodes: (relationKey: string) => AbstractWxaComponent[];
    groupSetData: (callback: Function) => void;
    getTabBar: () => AbstractWxaComponent;
    getPageId: () => string;
}

interface CivilizedWxaComponentMixin {
    wxService: WXService;
}

export interface CivilizedComponent extends CivilizedWxaComponentMixin, AbstractWxaComponent, events.EventEmitter {

}

export function WxaComponent(options: WxaComponentDecoratorOptions = {}) {
    // tslint:disable-next-line: cyclomatic-complexity
    return function WxaComponentDecorator<T extends typeof CivilizedComponent>(constructor: T) {
        if (!constructor.hasOwnProperty('__wxaProfile')) {
            Object.defineProperty(constructor, '__wxaProfile', { value: Object.create(constructor.__wxaProfile || {}) });
        }
        constructor.__wxaProfile.class = { ...(constructor.__wxaProfile.class || {}), ...options };
        const baseObj: any = {};
        const WX_COMPONENT_HOOKS = [
            'ready', 'moved', 'detached', 'error'
        ];

        const lifetimes: { [k: string]: any } = {};
        baseObj.lifetimes = lifetimes;
        for (const x of WX_COMPONENT_HOOKS) {
            lifetimes[x] = function (...args: any[]) {
                this.emit(x, ...args);
            };
        }

        const WX_PAGE_HOOKS = [
            'show', 'hide', 'resize'
        ];

        const pageLifetimes: { [k: string]: any } = {};
        baseObj.pageLifetimes = pageLifetimes;

        for (const x of WX_PAGE_HOOKS) {
            pageLifetimes[x] = function (...args: any[]) {
                this.emit(`page${x[0].toUpperCase()}${x.slice(1)}`, ...args);
            };
        }

        lifetimes.created = function (..._args: any[]) {
            const source = this.__proto__.__proto__;
            if (Object.getPrototypeOf(CivilizedComponent.prototype) !== source) {
                Object.setPrototypeOf(CivilizedComponent.prototype, source);
            }
            Object.setPrototypeOf(this, constructor.prototype);
            Object.assign(this, events.EventEmitter.prototype);

            events.EventEmitter.call(this);

            // this.app = getApp();

            // const origData = this.data;

            // Object.defineProperty(this, 'data', {
            //     enumerable: true,
            //     get: () => origData,
            //     set: (x) => this.setData(x)
            // });

        };

        lifetimes.attached = function (...args: any[]) {
            const origData = this.data;
            Object.defineProperty(this, 'data', {
                get: () => origData,
                set: (x) => this.setData(x)
            });
            this.wxService = wxService;
            constructor.call(this);

            this.emit('created');
            this.emit('attached', ...args);

            this.setData(this.data);
        };

        const classOps: WxaComponentDecoratorOptions = constructor.__wxaProfile.class;

        if (constructor.data) {
            baseObj.data = constructor.data;
        }

        if (classOps) {
            if (classOps.options) {
                baseObj.options = classOps.options;
            }

            if (classOps.relations) {
                const WX_RELATION_HOOKS = ['linked', 'linkChanged', 'unlinked'];
                const relations: any = {};
                baseObj.relations = relations;
                for (const relationName in classOps.relations) {
                    if (classOps.relations.hasOwnProperty(relationName)) {
                        const relationOptions: any = {
                            type: classOps.relations[relationName],
                        };
                        for (const x of WX_RELATION_HOOKS) {
                            relationOptions[x] = function (...argv: any[]) {
                                this.emit(x, relationName, ...argv);
                            };
                        }
                        relations[relationName] = relationOptions;
                    }
                }
            }

            if (classOps.initialData) {
                baseObj.data = classOps.initialData;
            }

            if (classOps.properties) {
                baseObj.properties = classOps.properties;
            }

            if (classOps.externalClasses) {
                baseObj.externalClass = classOps.externalClasses;
            }
        }

        let methodOps = constructor.__wxaProfile.methods;
        const paramOps = constructor.__wxaProfile.paramters;
        const propOps = constructor.__wxaProfile.properties;

        const methods: any = {};
        baseObj.methods = methods;

        if (paramOps) {
            for (const propName in paramOps) {
                if (paramOps.hasOwnProperty(propName)) {
                    const decorationOptions: string[] = paramOps[propName];
                    if (!decorationOptions) {
                        throw new Error('Unable to find param decoration options for prop: ' + propName);
                    }
                    const func = (constructor.prototype as any)[propName];
                    if (!func || !func.call) {
                        throw new Error('Unable to find host function for pram decoration on constructor prototype: ' + propName);
                    }
                    (constructor.prototype as any)[propName] = function (event: any) {

                        if (arguments.length === 1 && (typeof event === 'object') && (event !== null) && event.type &&
                            (event.timeStamp || event.timestamp)    // WTF for the wx developers.
                        ) {
                            const argv: any[] = [event];
                            decorationOptions.forEach((x, i) => {
                                if (x) {
                                    argv[i] = _.get(event, x);
                                }
                            });

                            return func.call(this, ...argv);
                        }

                        return func.call(this, ...arguments);

                    };

                    if (!methodOps) {
                        methodOps = {};
                    }

                    if (!methodOps[propName]) {
                        methodOps[propName] = {};
                    }
                }
            }
        }

        if (methodOps) {
            for (const propName in methodOps) {
                if (methodOps.hasOwnProperty(propName)) {
                    const decorationOptions: WxaViewMethodDecoratorOptions = methodOps[propName];
                    if (!decorationOptions) {
                        throw new Error('Unable to find method decoration options for prop: ' + propName);
                    }

                    if (decorationOptions.__static) {
                        const func = (constructor as any)[propName];
                        if (decorationOptions.name && decorationOptions.name !== propName) {
                            (constructor as any)[decorationOptions.name] = func;
                        }
                        // const funcName = decorationOptions.name || propName;
                        // methods[funcName] = func;

                    } else {
                        const func = (constructor.prototype as any)[propName];
                        if (decorationOptions.name && decorationOptions.name !== propName) {
                            (constructor.prototype as any)[decorationOptions.name] = func;
                        }
                        // const funcName = decorationOptions.name || propName;
                        // methods[funcName] = func;
                    }
                }
            }
        }

        if (propOps) {
            for (const propName in propOps) {
                if (propOps.hasOwnProperty(propName)) {
                    const decorationOptions: WxaViewPropertyDecoratorOptions = propOps[propName];
                    if (!decorationOptions) {
                        throw new Error('Unable to find property decoration options for prop: ' + propName);
                    }

                    if (constructor.prototype.hasOwnProperty(propName)) {
                        throw new Error('Decorator is not supposed to override existing class property or method: ' + propName);
                    }

                    Object.defineProperty(constructor.prototype, propName, {
                        get() {
                            if (decorationOptions.name) {
                                return _.get(this.ctx, decorationOptions.name);
                            }

                            return this.ctx[propName];
                        },

                        set(v: any) {
                            if (decorationOptions.name) {
                                return _.set(this.ctx, decorationOptions.name, v);
                            }

                            this.ctx[propName] = v;
                        },

                        enumerable: true
                    });

                    if (decorationOptions.expose) {
                        if (!baseObj.properties) {
                            baseObj.properties = {};
                        }
                        if (decorationOptions.expose === true) {
                            const tsType = Reflect.getMetadata('design:type', constructor, propName);
                            baseObj.properties[decorationOptions.name || propName] = {
                                type: tsType === Object ? null : (tsType || null)
                            };
                        } else if (Array.isArray(decorationOptions.expose)) {
                            let exceptionalType = false;

                            for (const x of decorationOptions.expose) {
                                if (!WX_ALLOWED_PROP_TYPES.has(x)) {
                                    exceptionalType = true;
                                    break;
                                }
                            }
                            if (exceptionalType || decorationOptions.expose.length === 0) {
                                baseObj.properties[decorationOptions.name || propName] = {
                                    type: null
                                };

                            } else if (decorationOptions.expose.length === 1) {
                                baseObj.properties[decorationOptions.name || propName] = {
                                    type: decorationOptions.expose[0]
                                };
                            } else {
                                baseObj.properties[decorationOptions.name || propName] = {
                                    type: decorationOptions.expose[0],
                                    types: decorationOptions.expose
                                };
                            }
                        } else {
                            const configObj = decorationOptions.expose;
                            if (!configObj.type) {
                                const tsType = Reflect.getMetadata('design:type', constructor, propName);
                                configObj.type = tsType || null;
                            }
                            baseObj.properties[decorationOptions.name || propName] = configObj;
                        }
                    }
                }
            }
        }

        if (baseObj.properties) {
            const observers: any = {};
            baseObj.observers = observers;
            for (const propName in baseObj.properties) {
                if (baseObj.properties.hasOwnProperty(propName)) {
                    const propDesc = baseObj.properties[propName];
                    const observeName = (propDesc.type === Object || propDesc.type === null) ? `${propName}.**` : propName;
                    observers[observeName] = function (...argv: any[]) {
                        this.emit('propertyUpdate', propName, ...argv);
                    };
                }
            }
        }


        Component(baseObj);
    };
}

function makeSetDataAccessPath(tgt: object, route: string, key: string | number | symbol) {
    if (!route) {
        return key.toString();
    }
    let access = route;

    if (Array.isArray(tgt)) {
        if (!isPositiveInt(key)) {
            return '';
        }
        access += `[${key.toString()}]`;

        return access;
    }

    access += `.${key.toString()}`;

    return access;
}

export function semaphore(cap: number = 1) {
    let s = 0;

    return function semaphoreDecorator(_target: any, _propName: string | symbol, propDesc: PropertyDescriptor) {

        const func: Function = propDesc.value;

        if (typeof func !== 'function') {
            throw new Error('Invalid use of semaphore decorator');
        }

        function newFunc(this: any, ...argv: any[]) {
            if (s >= cap) {
                return;
            }
            s += 1;

            try {
                const r = func.apply(this, argv);
                if (r.then && typeof r.then === 'function') {
                    r.then(() => s -= 1, () => s -= 1);
                } else {
                    s -= 1;
                }

                return r;
            } catch (err) {
                s -= 1;
                throw err;
            }
        }

        propDesc.value = newFunc;

        return propDesc;
    };
}

// tslint:disable-next-line: max-file-line-count
