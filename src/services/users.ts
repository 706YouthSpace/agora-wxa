import { AnchorList } from "../utils/fancy-list";
import { User } from '../interfaces/user';
import { GlobalDataContext } from './global-data-context';


export class AgoraUserList extends AnchorList<User> {

    gdt: GlobalDataContext;

    constructor(list: User[], gdt: GlobalDataContext) {
        super(list);
        this.gdt = gdt;
    }

    identifier(user: User) {
        return user._id;
    }

    async fetchNext(anchor: string) {
        const results = await this.gdt.listUserAgora(anchor);

        if (Array.isArray(results) && results.length) {
            const theLastOne: User = results[results.length - 1];
            this.anchor = theLastOne._id;
        }

        return results;
    }
}


export class SearchUserList extends AnchorList<User> {

    gdt: GlobalDataContext;

    keywords: string;

    constructor(keywords: string, list: User[], gdt: GlobalDataContext) {
        if (!keywords) {
            throw new Error('Keywords required.');
        }
        super(list);
        this.gdt = gdt;
        this.keywords = keywords;
        this.anchor = '0';
    }

    identifier(user: User) {
        return user._id;
    }

    async fetchNext(anchor: string) {
        // tslint:disable-next-line: no-magic-numbers
        const results = await this.gdt.searchForUsers(this.keywords, 30, anchor);

        if (Array.isArray(results) && results.length) {
            this.anchor = `${this.list.length + results.length}`;
        }

        return results;
    }
}
