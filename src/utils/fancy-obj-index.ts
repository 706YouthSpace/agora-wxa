import nestedProxy from './nested-proxy';
import EventEmitter from '../vendors/events';
import _ from '../vendors/lodash';
import { carefulMerge } from './careful-merge';
import { dataChannel } from '../services/data-channel';


export class FancyObjIndex<T extends object> {

    index: { [k: string]: T } = {};
    proxy: { [k: string]: T };
    revoke: () => void;
    proxyMap: WeakMap<object, object>;

    deProxySymbol: symbol = Symbol('FancyObjIndex Deproxy Symbol');

    eventChannel: EventEmitter = dataChannel;

    modifiers: Array<(obj: T) => void> = [];

    constructor() {
        const msgReg: Array<[string, object, string?]> = [];
        let routineFlag = false;
        const msgRoutine = () => {
            routineFlag = true;
            wx.nextTick(() => {
                routineFlag = false;
                for (const [event, target, key] of msgReg) {
                    this.eventChannel.emit(event, this.proxyMap.get(target), target, key);
                }
                msgReg.length = 0;
            });
        };
        const { proxy, revoke, proxyMap } = nestedProxy(
            this.index,
            {
                set: (tgt, key, val, _receiver) => {
                    if (typeof key === 'string') {
                        if (tgt[key] !== val) {
                            tgt[key] = val;
                            if (tgt === this.index) {
                                msgReg.push(['new', val, key]);
                            } else {
                                msgReg.push(['change', tgt, key]);
                            }
                            if (!routineFlag) {
                                msgRoutine();
                            }
                        }

                        return true;
                    }

                    return undefined;
                },
                deleteProperty: (tgt, key) => {
                    const ref = tgt[key as any];
                    // tslint:disable-next-line: no-dynamic-delete
                    delete tgt[key as any];
                    if (typeof key === 'string') {
                        if (tgt === this.index) {
                            msgReg.push(['delete', ref, key]);
                        } else {
                            msgReg.push(['change', tgt, key]);
                        }

                        return true;
                    }

                    return true;
                }
            },
            this.deProxySymbol
        );

        this.proxy = proxy;
        this.revoke = revoke;
        this.proxyMap = proxyMap;
    }

    addModifier(func: (obj: T) => void) {
        this.modifiers.push(func);
    }

    applyModifiers(obj: T) {
        for (const func of this.modifiers) {

            func(obj);

        }

        return obj;
    }

    set(id: string, obj: T) {
        if (typeof obj !== 'object' || !obj) {
            throw new Error('Invalid object to process');
        }
        let instance = this.proxy[id];
        if (!instance) {
            instance = this.applyModifiers(obj);
            this.proxy[id] = instance;

            return this.get(id);
        }

        carefulMerge(instance, obj);

        return this.applyModifiers(instance);
    }

    get(id: string) {
        return this.proxy[id];
    }

    has(id: string) {
        return this.get(id) === undefined;
    }

}

