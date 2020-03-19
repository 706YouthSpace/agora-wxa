import EventEmitter from '../vendors/events';
import _ from '../vendors/lodash';
import wxService from './wx-service';
import { RequestOptions, request, upload, UploadOptions } from './request';
import dayjs from '../vendors/dayjs';
import { User } from '../interfaces/user';
import { Post } from '../interfaces/post';
import { humanReadableNumber } from '../utils/number-display';
import { FancyObjIndex } from '../utils/fancy-obj-index';
import { carefulMerge } from '../utils/careful-merge';

const API_BASE_URI = 'https://api.wxa1.706er.com';
const ROUTINE_STORAGE_KEY = 'ROUTINE';

export interface DialogProfile {
    title: string;
    content: string;

    actions?: {
        [k: string]: any;
    },

    actionText?: {
        [k: string]: string;
    },

    actionColor?: {
        [k: string]: string;
    }
}

export class GlobalDataContext extends EventEmitter {

    wxService = wxService;

    localState = wxService.getStorageProxy(ROUTINE_STORAGE_KEY, 'SYNC');

    user?: User;

    isLoading: boolean = false;
    pendingRequests: number = 0;

    dataIndex = {
        user: new FancyObjIndex<User>(),
        post: new FancyObjIndex<Post>()
    };

    dialogs: { [k: string]: DialogProfile } = {};

    constructor() {
        super();
        this.once('me', async (user: any) => {
            this.user = user;
            if (!user.profile) {
                const userInfo = await this.wxService.getUserInfo({ lang: "zh_CN" }).catch();
                if (userInfo) {
                    const newUser = await this.updateProfile(userInfo.userInfo);
                    carefulMerge(user, newUser);
                }
            }

            this.emit('newMe', user);

        });

        this.on('newMe', (newMe: User) => {
            if (this.user) {
                carefulMerge(this.user, newMe);
            }
        });

        this.on('loading', () => {
            const originalPendingRequests = this.pendingRequests;
            this.pendingRequests += 1;
            if (originalPendingRequests === 0) {
                wx.showLoading({ title: '加载中' });
            }
        });

        this.on('loadingComplete', () => {
            this.pendingRequests -= 1;
            if (this.pendingRequests <= 0) {
                this.pendingRequests = 0;
                wx.hideLoading({});
            }
        });


        this.dataIndex.post.addModifier((post) => {
            if (post.counter) {
                const mappedCounter: any = {};
                for (const x in post.counter) {
                    if (post.counter.hasOwnProperty(x)) {
                        const val = post.counter[x];
                        mappedCounter[x] = humanReadableNumber(val);
                    }
                }
                if (post._counter) {
                    carefulMerge(post._counter, mappedCounter);
                } else {
                    post._counter = mappedCounter;
                }
            }
            post._createdAt = dayjs(post.createdAt).format('YYYY年MM月DD日 HH:mm');
            post._updatedAt = dayjs(post.updatedAt).format('YYYY年MM月DD日 HH:mm');

            if (post.author) {
                if (typeof post.author === 'string') {
                    post.author = this.dataIndex.user.get(post.author) || post.author;
                } else if (post.author._id) {
                    const userInstance = this.dataIndex.user.get(post.author._id);
                    if (userInstance !== post.author) {
                        post.author = this.dataIndex.user.set(post.author._id, post.author);
                    }
                }
            }

        });

        this.dataIndex.user.addModifier((user) => {
            if (user.counter) {
                const mappedCounter: any = {};
                for (const x in user.counter) {
                    if (user.counter.hasOwnProperty(x)) {
                        const val = user.counter[x];
                        mappedCounter[x] = humanReadableNumber(val);
                    }
                }

                if (user._counter) {
                    carefulMerge(user._counter, mappedCounter);
                } else {
                    user._counter = mappedCounter;
                }

            }
            user._lastActiveAt = dayjs(user.lastActiveAt).format('YYYY年MM月DD日 HH:mm');

            return user;
        });
    }

    get userPromise(): Promise<User> {

        if (this.user) {
            return Promise.resolve(this.user);
        }

        return new Promise((resolve, _reject) => {
            this.once('me', resolve);
        });
    }

    get userInfo() {

        if (this.user && this.user.profile) {
            return Promise.resolve(this.user.profile);
        }

        return new Promise((resolve, _reject) => {
            this.once('newMe', (user) => {
                return resolve(user.profile);
            });
        });
    }

    get userPreference() {

        if (this.user) {
            return Promise.resolve(this.user.preferences);
        }

        return new Promise((resolve, _reject) => {
            this.once('newMe', (user) => {
                return resolve(user.preferences);
            });
        });
    }

    async login() {
        const r = await this.wxService.login();

        const result = await this.loginWithAuthorizationCode(r.code);

        return result;
    }

    composeApiUrl(uri: string) {
        return `${API_BASE_URI}/${uri}`.replace(/((?!\:)\/+)/gi, '/').replace(/\:\//, '://').replace(/\/+$/, '');
    }

    simpleApiCall<T = any>(method: string, uri: string, otherOptions: {
        notSimple?: boolean;
        autoLoadingState?: boolean;
    } & RequestOptions = {}): Promise<T> & { task?: wx.RequestTask } {
        const queryOptions = otherOptions || {};
        if (this.localState.sessionToken) {
            const queryHeaders = queryOptions.header || {};
            queryHeaders['X-Session-Token'] = this.localState.sessionToken;
            queryOptions.header = queryHeaders;
        }
        let simpleMode = true;
        if (queryOptions.notSimple) {
            simpleMode = false;
        }
        delete queryOptions.notSimple;

        let autoLoadingState = true;
        if (queryOptions.autoLoadingState === false) {
            autoLoadingState = false;
        }
        delete queryOptions.autoLoadingState;

        if (autoLoadingState) {
            this.emit('loading');
        }

        return request(
            method,
            this.composeApiUrl(uri),
            queryOptions
        ).then((res) => {
            if (autoLoadingState) {
                this.emit('loadingComplete');
            }
            if (res.header) {
                const TOKEN_HEADER_NAME = 'X-Set-Session-Token';
                const tokenValue = res.header[TOKEN_HEADER_NAME] || res.header[TOKEN_HEADER_NAME.toLowerCase()];
                if (tokenValue) {
                    this.localState.sessionToken = tokenValue;
                    this.emit('sessionToken', tokenValue);
                }
                if (res.header['Set-Cookie']) {
                    this.emit('cookie', res.header['Set-Cookie']);
                }
            }
            let body = res.data as any;

            if (typeof body === 'string') {
                try {
                    body = JSON.parse(body);
                } catch (err) {
                    void 0;
                }
            }
            if (simpleMode) {
                // tslint:disable-next-line: no-magic-numbers
                if (res.statusCode !== 200) {
                    return Promise.reject(body);
                }

                if (body && body.data) {
                    return body.data;
                }

                return body;
            }

            return body || res;
        }).catch((err) => {
            if (autoLoadingState) {
                this.emit('loadingComplete');
            }

            // wx.showToast({
            //     title: '请求失败，请稍后重试',
            //     duration: 2000,
            //     icon: 'none',
            // });

            return Promise.reject(err);
        });
    }

    simpleApiUpload<T = any>(localPath: string, uri: string, otherOptions: {
        notSimple?: boolean;
        autoLoadingState?: boolean;
        multipartName?: string;
    } & UploadOptions = {}): Promise<T> & { task?: wx.UploadTask } {
        const queryOptions = otherOptions || {};
        if (this.localState.sessionToken) {
            const queryHeaders = queryOptions.header || {};
            queryHeaders['X-Session-Token'] = this.localState.sessionToken;
            queryOptions.header = queryHeaders;
        }
        let simpleMode = true;
        if (queryOptions.notSimple) {
            simpleMode = false;
        }
        delete queryOptions.notSimple;

        let autoLoadingState = false;
        if (queryOptions.autoLoadingState) {
            autoLoadingState = true;
        }
        delete queryOptions.autoLoadingState;

        if (autoLoadingState) {
            this.emit('loading');
        }

        return upload(
            this.composeApiUrl(uri),
            localPath,
            otherOptions.multipartName || 'file',
            otherOptions
        ).then((res) => {
            if (autoLoadingState) {
                this.emit('loadingComplete');
            }
            // if (res.header) {
            //     const TOKEN_HEADER_NAME = 'X-Set-Session-Token';
            //     const tokenValue = res.header[TOKEN_HEADER_NAME] || res.header[TOKEN_HEADER_NAME.toLowerCase()];
            //     if (tokenValue) {
            //         this.localState.set('sessionToken', tokenValue);
            //         this.emit('sessionToken', tokenValue);
            //     }
            //     if (res.header['Set-Cookie']) {
            //         this.emit('cookie', res.header['Set-Cookie']);
            //     }
            // }
            if (simpleMode) {
                let body = res.data as any;

                if (typeof body === 'string') {
                    try {
                        body = JSON.parse(body);
                    } catch (err) {
                        void 0;
                    }
                }

                // tslint:disable-next-line: no-magic-numbers
                if (res.statusCode !== 200) {
                    return Promise.reject(body);
                }

                if (body && body.data) {
                    return body.data;
                }

                return body;
            }

            return res;
        }).catch((err) => {
            if (autoLoadingState) {
                this.emit('loadingComplete');
            }

            // wx.showToast({
            //     title: '请求失败，请稍后重试',
            //     duration: 2000,
            //     icon: 'none',
            // });

            return Promise.reject(err);
        });
    }

    async loginWithAuthorizationCode(code: string) {
        const me = await this.simpleApiCall('POST', '/login', {
            body: {
                code
            }
        });
        const indexedMe = this.dataIndex.user.set(me._id, me);
        this.emit('me', indexedMe);

        return indexedMe;
    }

    async updateProfile(profile: object) {
        const result = await this.simpleApiCall('POST', '/my/profile', {
            body: profile
        });

        this.emit('newMe', result);

        return result;
    }

    async updateProfilePrivacy(privacy: object) {
        const result = await this.simpleApiCall('POST', '/my/preferences/profilePrivaicy', {
            body: privacy
        });

        this.emit('newMe', result);

        return result;
    }

    async listUserAgora(anchor?: string, limit: number = 15) {
        await this.userPromise;
        const query: any = { limit };
        if (anchor) {
            query.anchor = anchor;
        }

        const result = await this.simpleApiCall('GET', '/users', { query });
        const userIndex = this.dataIndex.user;
        const mappedUsers = result.map((user: User) => userIndex.set(user._id, user));

        return mappedUsers;
    }

    async searchForUsers(keywords: string, limit: number = 30, anchor?: number | string) {
        await this.userPromise;
        const query: any = { keywords, limit, anchor };

        const result = await this.simpleApiCall('GET', '/users/search', { query });

        return result;
    }

    async getUserProfile(uid: string, incView: boolean = false) {

        const user = await this.simpleApiCall('GET', `/user/${uid}/profile`, {
            query: {
                incView
            }

        });

        return this.dataIndex.user.set(user._id, user);
    }

    async getUserFriends(uid: string) {
        const result = await this.simpleApiCall('GET', `/user/${uid}/friends`);
        const mappedUsers = result.map((user: User) => this.dataIndex.user.set(user._id, user));

        return mappedUsers;
    }

    async getUserPosts(uid: string, anchor?: string, limit: number = 15) {
        const posts = await this.simpleApiCall('GET', `/user/${uid}/posts`, { query: { limit, anchor: anchor || '' } });

        for (const x of posts) {
            this.dataIndex.post.applyModifiers(x);
        }

        return posts;
    }

    async getUserPostsWhichLiked(uid: string, anchor?: string, limit: number = 15) {
        const posts = await this.simpleApiCall('GET', `/user/${uid}/posts`, { query: { byLikes: true, limit, anchor: anchor || '' } });

        for (const x of posts) {
            this.dataIndex.post.applyModifiers(x);
        }

        return posts;
    }

    async getUserPostsWhichCommented(uid: string, anchor?: string, limit: number = 15) {
        const posts = await this.simpleApiCall('GET', `/user/${uid}/posts`, { query: { byComment: true, limit, anchor: anchor || '' } });

        for (const x of posts) {
            this.dataIndex.post.applyModifiers(x);
        }

        return posts;
    }

    async publishPost(content: string, tags?: string[], imageIds?: string[]) {
        const query: any = { content };
        if (Array.isArray(tags) && tags.length) {
            query.tags = tags;
        }
        if (Array.isArray(imageIds) && imageIds.length) {
            query.images = imageIds;
        }

        const post = await this.simpleApiCall('POST', `/posts`, {
            body: query
        });

        const postIndex = this.dataIndex.post;

        const postInstance = postIndex.set(post._id, post);

        postInstance.author = this.user!;

        return post as Post;
    }

    async commentOnPost(postId: string, content: string | undefined, referenceId?: string, imageIds?: string[]) {
        const query: any = { content };
        if (referenceId) {
            query.ref = referenceId;
        }
        if (Array.isArray(imageIds) && imageIds.length) {
            query.images = imageIds;
        }

        const comment = await this.simpleApiCall('POST', `/post/${postId}`, {
            body: query
        });

        const postIndex = this.dataIndex.post;

        comment.author = this.user;

        const commentInstance = postIndex.set(comment._id, comment);

        const post = postIndex.get(postId);
        if (post) {
            if (!post.counter) {
                post.counter = {};
            }
            post.counter.comments = (post.counter.comments || 0) + 1;
            if (!post.comments) {
                post.comments = [];
            }
            post.comments.push(commentInstance);
        }

        postIndex.applyModifiers(post);

        return comment;
    }

    async listPosts(anchor?: string, limit: number = 15) {
        await this.userPromise;
        const query: any = { limit };
        if (anchor) {
            query.anchor = anchor;
        }

        const results = await this.simpleApiCall('GET', '/posts', { query });

        const postIndex = this.dataIndex.post;

        const mappedPosts = results.map((post: Post) => postIndex.set(post._id, post));

        return mappedPosts;
    }

    async searchForPosts(keywords: string, limit: number = 30, anchor?: number | string) {
        await this.userPromise;
        const query: any = { keywords, limit, anchor };

        const result = await this.simpleApiCall('GET', '/posts/search', { query });

        return result;
    }

    async getPost(postId: string) {
        await this.userPromise;

        const result = await this.simpleApiCall('GET', `/post/${postId}`, { notSimple: true });


        const post = result.data;

        const postIndex = this.dataIndex.post;
        const userIndex = this.dataIndex.user;

        if (result.meta && Array.isArray(result.meta.authors)) {
            for (const author of result.meta.authors) {
                userIndex.set(author._id, author);
            }
        }
        const postInstance = postIndex.set(post._id, post);

        if (Array.isArray(post.comments)) {

            postInstance.comments = post.comments.map((comment: Post) => {
                if (Array.isArray(comment.postReferences) && comment.postReferences.length >= 2) {
                    comment.reference = comment.postReferences[1]!;
                }

                return postIndex.set(comment._id, comment);
            });
        }

        return postInstance;
    }

    async markPostLiked(postId: string, liked: boolean = true) {
        const query: any = { action: liked ? 'like' : 'unlike' };

        const result = await this.simpleApiCall('POST', `/post/${postId}/liked`, {
            body: query
        });

        const postIndex = this.dataIndex.post;
        const postInstance = postIndex.get(postId);
        if (postInstance) {
            postInstance.liked = liked;
            if (!postInstance.counter) {
                postInstance.counter = {};
            }
            postInstance.counter.likes = postInstance.counter.likes || 0;
            postInstance.counter.likes = liked ? postInstance.counter.likes + 1 : postInstance.counter.likes - 1;

            postIndex.applyModifiers(postInstance);
        }

        return result;
    }

    async getAllMyFriends() {
        await this.userPromise;

        const results = await this.simpleApiCall('GET', '/my/friends');

        if (this.user) {
            this.user.friends = results;
        }

        return results;
    }

    async friendUser(uid: string, blacklisted?: boolean) {
        await this.userPromise;

        const results = await this.simpleApiCall('POST', '/my/friends', {
            body: {
                uid,
                blacklisted
            }
        });

        if (this.user) {
            if (blacklisted) {
                _.remove(this.user.friends || [], { _id: uid });
            } else {
                const user = this.dataIndex.user.get(uid);
                if (user && this.user.friends) {
                    this.user.friends.push(user);
                }
            }
        }


        return results;
    }

    async unfriendUser(uid: string) {
        await this.userPromise;

        const results = await this.simpleApiCall('POST', '/my/friends', {
            query: {
                action: 'unfriend'
            },
            body: {
                uid
            }
        });

        if (this.user) {
            _.remove(this.user.friends || [], { _id: uid });
        }

        return results;
    }

    async uploadFile(localPath: string) {
        const result = await this.simpleApiUpload(localPath, '/my/files');

        this.emit('fileUpload', result, localPath);

        return result;
    }

    async ascendPriviligedUser() {
        const user = await this.userPromise;

        const result = await this.simpleApiCall('POST', '/su', { body: { uid: user._id } });

        return result;
    }


    async markPostBlocked(postId: string, blocked: boolean = true) {

        const result = await this.simpleApiCall('POST', `/post/${postId}/blocked`, {
            body: {
                value: blocked
            }
        });

        const postIndex = this.dataIndex.post;
        const postInstance = postIndex.get(postId);
        if (postInstance) {
            postInstance.blocked = blocked;
            postIndex.applyModifiers(postInstance);
        }

        return result;
    }

    async markUserActivated(userId: string, activated: boolean = true) {

        const result = await this.simpleApiCall('POST', `/user/${userId}/activated`, {
            body: {
                value: activated
            }
        });

        const userIndex = this.dataIndex.user;
        const userInstance = userIndex.get(userId);
        if (userInstance) {
            userInstance.activated = activated;
            userIndex.applyModifiers(userInstance);
        }

        return result;
    }

    registerDialog(name: string, dialog: DialogProfile) {

        this.dialogs[name] = dialog;

        this.emit('dialogRegister', name, dialog);
    }

}

