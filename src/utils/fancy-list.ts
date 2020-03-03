import _ from '../vendors/lodash';
// import { carefulMerge } from './careful-merge';

export abstract class FancyList<T = any> {

    list: T[];

    realList: T[];

    constructor(list: T[] = []) {
        this.list = list;
        this.realList = (list as any).__target || list;
    }

    abstract next(): Promise<T[]>;
    abstract refresh(): Promise<T[]>;

}

export abstract class AnchorList<T = any, A = string> extends FancyList<T> {

    anchor?: A;
    isComplete: boolean = false;
    index: Map<string, T> = new Map();

    abstract fetchNext(anchor?: A): Promise<T[]>;
    abstract identifier(item: T): string;

    async next() {
        if (this.isComplete) {
            return [];
        }
        const result = await this.fetchNext(this.anchor);

        if (result.length === 0) {
            this.isComplete = true;
        }
        for (const record of result) {
            const id = this.identifier(record);
            if (this.index.has(id)) {
                // const current = this.index.get(id)!;
                // carefulMerge(current, record);
                // const idx = this.realList.indexOf(current);
                // this.list[idx] = current;
            } else {
                this.list.push(record);
                this.index.set(id, record);
            }
        }

        return result;
    }

    async refresh() {
        const result = await this.fetchNext();
        
        for (const record of result.reverse()) {
            const id = this.identifier(record);
            if (this.index.has(id)) {
                // const current = this.index.get(id)!;

                // carefulMerge(current, record);
                // const idx = this.realList.indexOf(current);
                // this.list[idx] = current;
            } else {
                this.list.unshift(record);
                this.index.set(id, record);
            }

        }

        return result;
    }

}
