import { AnchorList } from "../utils/fancy-list";
import { GlobalDataContext } from './global-data-context';
import { Post } from '../interfaces/post';


export class PostsList extends AnchorList<Post> {

    gdt: GlobalDataContext;

    constructor(list: Post[], gdt: GlobalDataContext) {
        super(list);
        this.gdt = gdt;
    }

    identifier(post: Post) {

        return post._id;
    }

    async fetchNext(anchor: string) {
        const results = await this.gdt.listPosts(anchor);

        if (Array.isArray(results) && results.length) {
            const theLastOne: Post = results[results.length - 1];
            this.anchor = theLastOne.updatedAt.toString();
        }

        return results;
    }
}

export class SearchPostList extends AnchorList<Post> {

    gdt: GlobalDataContext;

    keywords: string;

    constructor(keywords: string, list: Post[], gdt: GlobalDataContext) {
        if (!keywords) {
            throw new Error('Keywords required.');
        }
        super(list);
        this.gdt = gdt;
        this.keywords = keywords;
        this.anchor = '0';
    }

    identifier(user: Post) {
        return user._id;
    }

    async fetchNext(anchor: string) {
        // tslint:disable-next-line: no-magic-numbers
        const results = await this.gdt.searchForPosts(this.keywords, 20, anchor);

        if (Array.isArray(results) && results.length) {
            this.anchor = `${this.list.length + results.length}`;
        }

        return results;
    }
}

export class UserAuthordPostsList extends AnchorList<Post> {

    gdt: GlobalDataContext;
    uid: string;

    constructor(uid: string, list: Post[], gdt: GlobalDataContext) {
        super(list);
        this.gdt = gdt;
        this.uid = uid;
    }

    identifier(post: Post) {

        return post._id;
    }

    async fetchNext(anchor: string) {
        const results = await this.gdt.getUserPosts(this.uid, anchor);

        if (Array.isArray(results) && results.length) {
            const theLastOne: Post = results[results.length - 1];
            this.anchor = theLastOne.createdAt.toString();
        }

        return results;
    }
}

export class UserLikedPostsList extends AnchorList<Post> {

    gdt: GlobalDataContext;
    uid: string;

    constructor(uid: string, list: Post[], gdt: GlobalDataContext) {
        super(list);
        this.gdt = gdt;
        this.uid = uid;
    }

    identifier(post: Post) {

        return post._id;
    }

    async fetchNext(anchor: string) {
        const results = await this.gdt.getUserPostsWhichLiked(this.uid, anchor);

        if (Array.isArray(results) && results.length) {
            const theLastOne: Post = results[results.length - 1];
            this.anchor = (theLastOne.likedAt || theLastOne.createdAt).toString();
        }

        return results;
    }
}

export class UserCommentedPostsList extends AnchorList<Post> {

    gdt: GlobalDataContext;
    uid: string;

    constructor(uid: string, list: Post[], gdt: GlobalDataContext) {
        super(list);
        this.gdt = gdt;
        this.uid = uid;
    }

    identifier(post: Post) {

        return post._id;
    }

    async fetchNext(anchor: string) {
        const results = await this.gdt.getUserPostsWhichCommented(this.uid, anchor);

        if (Array.isArray(results) && results.length) {
            const theLastOne: Post = results[results.length - 1];
            this.anchor = (theLastOne.commentedAt || theLastOne.createdAt).toString();
        }

        return results;
    }
}
