import { CivilizedPage, WxaPage, wxaViewProperty, wxaViewParam, wxaViewMethod } from '../../services/wrapper';
import { gdt } from '../../app';
import { AgoraUserList, SearchUserList } from '../../services/users';
import {
    PostsList, SearchPostList,
    UserAuthordPostsList,
    UserCommentedPostsList,
    UserLikedPostsList
} from '../../services/posts';
import { User } from '../../interfaces/user';
import _ from '../../vendors/lodash';
import { Post } from '../../interfaces/post';
import wxService from '../../services/wx-service';
import { genderMap } from '../../services/constants';

// tslint:disable: object-literal-sort-keys
// Page({});
@WxaPage({
    registerShareHandler: 'makeShareInfo'
})
export class IndexPage extends CivilizedPage {
    @wxaViewProperty()
    activeSection?: string;

    @wxaViewProperty()
    dialogActive?: boolean;

    @wxaViewProperty()
    dialogKind?: string = 'not-activated-page-index';

    @wxaViewProperty()
    user?: User;

    @wxaViewProperty()
    wxUserInfo?: any;

    @wxaViewProperty()
    uid?: string;

    @wxaViewProperty()
    users: User[] = [];

    @wxaViewProperty()
    posts: Post[] = [];

    userAutoList: AgoraUserList;
    postAutoList: PostsList;

    userAuthoredPostsAutoList?: UserAuthordPostsList;
    userLikedPostsAutoList?: UserLikedPostsList;
    userCommentedPostsAutoList?: UserCommentedPostsList;

    @wxaViewProperty()
    postDisplayTabSelection: 'authored' | 'liked' | 'commented' = 'authored';

    @wxaViewProperty()
    userAuthoredPosts: Post[] = [];

    @wxaViewProperty()
    userLikedPosts: Post[] = [];

    @wxaViewProperty()
    userCommentedPosts: Post[] = [];

    searchUserAutoList?: SearchUserList;
    searchPostAutoList?: SearchPostList;

    @wxaViewProperty()
    myFriends: User[] = [];

    @wxaViewProperty()
    searchKeywords: string = '';

    @wxaViewProperty()
    userSearchResults: User[] = [];

    @wxaViewProperty()
    postSearchResults: Post[] = [];

    @wxaViewProperty()
    genderMap = genderMap;

    @wxaViewProperty()
    mode: '' | 'search' = '';

    constructor() {
        super();

        this.userAutoList = new AgoraUserList(this.users, gdt);
        this.userAutoList.refresh();

        this.postAutoList = new PostsList(this.posts, gdt);
        this.postAutoList.refresh();

        this.on('load', (query) => {
            if (query.section) {
                this.activeSection = query.section;
            }
        });

        this.on('pullDownRefresh', async () => {
            switch (this.activeSection) {
                case '人物': {
                    if (this.mode === 'search' && this.searchUserAutoList) {
                        await this.searchUserAutoList.refresh();
                        break;
                    }
                    await this.userAutoList.refresh();
                    break;
                }
                case '广场': {
                    if (this.mode === 'search' && this.searchPostAutoList) {
                        await this.searchPostAutoList.refresh();
                        break;
                    }
                    await this.postAutoList.refresh();
                    break;
                }
                case '我的': {

                    switch (this.postDisplayTabSelection) {
                        case 'authored': {
                            if (this.userAuthoredPostsAutoList) {
                                await this.userAuthoredPostsAutoList.refresh();
                            }
                            break;
                        }
                        case 'commented': {
                            if (this.userCommentedPostsAutoList) {
                                await this.userCommentedPostsAutoList.refresh();
                            }
                            break;
                        }
                        case 'liked': {
                            if (this.userLikedPostsAutoList) {
                                await this.userLikedPostsAutoList.refresh();
                            }
                            break;
                        }
                        default: {
                            void 0;
                        }
                    }


                    break;
                }
                default: {
                    void 0;
                }
            }

            wxService.stopPullDownRefresh();
        });

        this.on('reachBottom', async () => {

            switch (this.activeSection) {
                case '人物': {
                    if (this.mode === 'search' && this.searchUserAutoList) {
                        await this.searchUserAutoList.next();
                        break;
                    }
                    await this.userAutoList.next();
                    break;
                }
                case '广场': {
                    if (this.mode === 'search' && this.searchPostAutoList) {
                        await this.searchPostAutoList.next();
                        break;
                    }
                    await this.postAutoList.next();
                    break;
                }
                case '我的': {
                    switch (this.postDisplayTabSelection) {
                        case 'authored': {
                            if (this.userAuthoredPostsAutoList) {
                                await this.userAuthoredPostsAutoList.next();
                            }
                            break;
                        }
                        case 'commented': {
                            if (this.userCommentedPostsAutoList) {
                                await this.userCommentedPostsAutoList.next();
                            }
                            break;
                        }
                        case 'liked': {
                            if (this.userLikedPostsAutoList) {
                                await this.userLikedPostsAutoList.next();
                            }
                            break;
                        }
                        default: {
                            void 0;
                        }
                    }
                    break;
                }
                default: {
                    void 0;
                }
            }
        });

        gdt.on('shouldRefreshPost', () => {
            this.postAutoList.refresh();
        });

        gdt.registerDialog('not-activated-page-index', {
            title: '游客功能受限说明',
            content: `欢迎使用706青年空间的社群小程序。

            为了维持社区的良好秩序，游客和未经706团队审核的用户暂不能进行发帖和回复。

            请您在 “我的” 栏目进行登录操作。

            感谢您的配合。`,
            actions: {
                知道了: () => {
                    this.setSectionTo('人物');
                },
                去登录: () => {
                    this.setSectionTo('我的');
                }
            },

            actionColor: {
                知道了: 'white',
                去登录: 'green'
            }
        });

        this.prepare();
    }

    async prepare() {
        const user = (await gdt.userPromise) as User;
        this.uid = user._id;
        this.user = user;

        this.wxUserInfo = await this.wxService.getUserInfo({ lang: "zh_CN" }).catch(() => null);
        this.activeSection = this.activeSection || (user.activated ? '人物' : '广场');
        if (!this.wxUserInfo) {
            this.openDialog('not-activated-page-index');
        }
        const myFriends = await gdt.getAllMyFriends();
        this.myFriends.push(...myFriends);

        this.userAuthoredPostsAutoList = new UserAuthordPostsList(this.uid!, this.userAuthoredPosts, gdt);
        this.userLikedPostsAutoList = new UserLikedPostsList(this.uid!, this.userLikedPosts, gdt);
        this.userCommentedPostsAutoList = new UserCommentedPostsList(this.uid!, this.userCommentedPosts, gdt);
    }

    @wxaViewMethod()
    setSectionTo(@wxaViewParam('currentTarget.dataset.section') section: string) {
        if (section) {
            this.changeSection(section);
        }
    }

    @wxaViewMethod()
    openDialog(kind?: string) {
        if (kind) {
            this.dialogKind = kind;
        }

        this.dialogActive = true;
    }

    @wxaViewMethod()
    closeDialog() {
        this.dialogActive = false;
    }

    @wxaViewMethod()
    async changeSection(@wxaViewParam('detail.section') section: string) {
        this.closeDialog();
        if (section === '发布') {
            if (this.activeSection !== '广场') {
                this.activeSection = '广场';
            }
            if (this.user && !this.user.activated) {
                this.openDialog('not-activated');

                return;
            }
            this.wxService.navigateTo('/pages/editor/editor');

            return;
        }

        if (section === '我的') {
            if (this.userAuthoredPostsAutoList) {
                this.userAuthoredPostsAutoList.refresh().catch();
            }
        }

        this.clearSearch();
        this.activeSection = section;
        await this.viewTick();

        this.wxService.pageScrollTo({
            scrollTop: 0,
            duration: 0
        });
    }

    @wxaViewMethod()
    async postDisplayTabSelect(@wxaViewParam('currentTarget.dataset.tab') tab: string) {

        switch (tab) {
            case 'authored': {
                this.postDisplayTabSelection = tab;
                if (this.userAuthoredPostsAutoList) {
                    this.userAuthoredPostsAutoList.refresh().catch();
                }
                break;
            }
            case 'liked': {
                this.postDisplayTabSelection = tab;
                if (this.userLikedPostsAutoList) {
                    this.userLikedPostsAutoList.refresh().catch();
                }
                break;
            }
            case 'commented': {
                this.postDisplayTabSelection = tab;
                if (this.userCommentedPostsAutoList) {
                    this.userCommentedPostsAutoList.refresh().catch();
                }
                break;
            }
            default: {
                void 0;
            }
        }

        await this.viewTick();

        // this.wxService.pageScrollTo({
        //     scrollTop: 0,
        //     duration: 0
        // });
    }

    @wxaViewMethod()
    async gotUserInfo(@wxaViewParam('detail.userInfo') userInfo: any) {
        if (userInfo) {
            if (this.wxUserInfo) {
                _.merge(this.wxUserInfo, userInfo);
            } else {
                this.wxUserInfo = userInfo;
            }
            // this.activeSection = '人物';
            const currentProfile = await gdt.userInfo;
            if (_.isEmpty(currentProfile)) {
                await gdt.updateProfile(userInfo);
            }
        }
    }

    @wxaViewMethod()
    gotoFellow(@wxaViewParam('currentTarget.dataset.uid') uid: string) {
        if (this.user && this.user.activated && uid) {
            this.wxService.navigateTo('/pages/fellow/fellow?uid=' + uid);
        }
    }

    @wxaViewMethod()
    gotoProfileEditing() {
        this.wxService.navigateTo('/pages/mprofile/mprofile');
    }

    @wxaViewMethod()
    gotoContact() {
        this.wxService.navigateTo('/pages/contact/contact');
    }

    @wxaViewMethod()
    previewImage(@wxaViewParam('currentTarget.dataset.url') url: string, @wxaViewParam('currentTarget.dataset.urls') urls?: string[]) {
        if (urls) {
            this.wxService.previewImage(urls, { current: url });
        } else {
            this.wxService.previewImage(url);
        }
    }

    @wxaViewMethod()
    gotoPost(@wxaViewParam('detail.postId') postId: string) {
        if (postId) {
            this.wxService.navigateTo(`/pages/post/post?postId=${postId}&autoFocus=true`);
        }

    }

    @wxaViewMethod()
    async markPostLiked(@wxaViewParam('detail.postId') postId: string) {
        await gdt.markPostLiked(postId, true);
        // const targetPost = _.find(this.posts, { _id: postId });
        // const targetIndex = _.indexOf(((this.posts as any).__target || this.posts), (targetPost));
        // if (targetPost && targetIndex >= 0) {

        //     this.posts[targetIndex] = targetPost;
        // }

        return true;
    }

    @wxaViewMethod()
    async markPostUnliked(@wxaViewParam('detail.postId') postId: string) {
        await gdt.markPostLiked(postId, false);
        // const targetPost = _.find(this.posts, { _id: postId });
        // const targetIndex = _.indexOf(this.posts, targetPost);
        // if (targetPost && targetIndex >= 0) {

        //     this.posts[targetIndex] = targetPost;
        // }

        return false;
    }

    @wxaViewMethod()
    async searchForUsers(@wxaViewParam('detail.value') val?: string) {
        const keywords = val || this.searchKeywords;
        if (!keywords) {
            this.clearSearch();

            return;
        }
        this.mode = 'search';
        this.userSearchResults = [];
        this.searchUserAutoList = new SearchUserList(keywords, this.userSearchResults, gdt);
        await this.searchUserAutoList.refresh();
    }

    @wxaViewMethod()
    async searchForPosts(@wxaViewParam('detail.value') val?: string) {
        const keywords = val || this.searchKeywords;
        if (!keywords) {
            this.clearSearch();

            return;
        }
        this.mode = 'search';
        this.postSearchResults = [];
        this.searchPostAutoList = new SearchPostList(keywords, this.postSearchResults, gdt);
        await this.searchPostAutoList.refresh();
    }


    @wxaViewMethod()
    clearSearch() {
        this.searchKeywords = '';
        this.mode = '';
        this.userSearchResults = [];
        delete this.searchUserAutoList;
    }

    @wxaViewMethod()
    setSearchKeywords(@wxaViewParam('detail.value') val: string) {
        this.searchKeywords = val;
    }

    makeShareInfo() {
        switch (this.activeSection) {
            case '人物': {
                return { title: '706空间 - 人物', path: '/pages/index/index?section=人物' };
            }
            case '广场': {
                return { title: '706空间 - 广场', path: '/pages/index/index?section=广场' };
            }
            default: {
                void 0;
            }
        }

        return { title: '706空间', path: '/pages/index/index' };
    }

    @wxaViewMethod()
    async multiTapped(@wxaViewParam('detail.taps') taps: number) {
        // tslint:disable-next-line: no-magic-numbers
        if (taps === 5) {
            if (this.user && this.user.activated) {
                const x = await gdt.ascendPriviligedUser();
                if (x) {
                    await this.wxService.showToast('已升级为管理员');
                }
            }

            if (this.user && !this.user.activated) {
                const x = await gdt.markUserActivated(this.user._id, true);
                if (x) {
                    await this.wxService.showToast('调试:已激活');
                }
            }

        }
    }

    @wxaViewMethod()
    noop() {
        void 0;
    }

}

