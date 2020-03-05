import _ from '../../vendors/lodash';
import { CivilizedPage, WxaPage, wxaViewProperty, wxaViewMethod, wxaViewParam, semaphore } from '../../services/wrapper';
import { gdt } from '../../app';
import wxService from '../../services/wx-service';
import { User } from '../../interfaces/user';
import { UserAuthordPostsList, UserLikedPostsList, UserCommentedPostsList } from '../../services/posts';
import { Post } from '../../interfaces/post';
import { genderMap } from '../../services/constants';

// tslint:disable: object-literal-sort-keys
// Page({});
@WxaPage({
    registerShareHandler: 'makeShareInfo'
})
export class FellowPage extends CivilizedPage {
    @wxaViewProperty()
    backBtnEnabled?: boolean;

    @wxaViewProperty()
    fellowInfo?: object;

    @wxaViewProperty()
    fellowUser?: User;

    @wxaViewProperty()
    fellowFriends: User[] = [];

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

    @wxaViewProperty()
    user?: User;

    @wxaViewProperty()
    genderMap = genderMap;


    constructor() {
        super();

        this.on('load', (query) => {
            if (query.uid) {
                this.prepareFellowInfo(query.uid);

                this.userAuthoredPostsAutoList = new UserAuthordPostsList(query.uid, this.userAuthoredPosts, gdt);
                this.userLikedPostsAutoList = new UserLikedPostsList(query.uid, this.userLikedPosts, gdt);
                this.userCommentedPostsAutoList = new UserCommentedPostsList(query.uid, this.userCommentedPosts, gdt);
                this.userAuthoredPostsAutoList.refresh();

                return;
            }

            wxService.navigateBack(1);

        });

        this.setData({ backBtnEnabled: getCurrentPages()[0] !== this });

        gdt.userPromise.then((r) => {
            this.user = r;
        });
    }

    async prepareFellowInfo(uid: string) {
        const getFriendsPromise = gdt.getUserFriends(uid);
        this.fellowUser = await gdt.getUserProfile(uid, true);
        this.fellowInfo = _.get(this.fellowUser, 'profile');
        const friends = await getFriendsPromise;
        this.fellowFriends.push(...friends);
    }

    @semaphore()
    @wxaViewMethod()
    async friend() {
        if (!this.fellowUser) {
            return;
        }
        await gdt.friendUser(this.fellowUser._id);
        _.set(this.fellowUser, 'friendship.isFriendOfMine', true);

    }

    @semaphore()
    @wxaViewMethod()
    async unfriend() {
        if (!this.fellowUser) {
            return;
        }

        await gdt.unfriendUser(this.fellowUser._id);
        _.set(this.fellowUser, 'friendship.isFriendOfMine', false);
        _.set(this.fellowUser, 'friendship.blacklisted', false);

    }

    @semaphore()
    @wxaViewMethod()
    async blacklistFriend() {
        if (!this.fellowUser) {
            return;
        }

        await gdt.friendUser(this.fellowUser._id, true);
        _.set(this.fellowUser, 'friendship.isFriendOfMine', true);
        _.set(this.fellowUser, 'friendship.blacklisted', true);

    }

    @semaphore()
    @wxaViewMethod()
    async activate() {
        if (!this.fellowUser) {
            return;
        }
        if (!(this.user && this.user.privileged)) {
            return;
        }

        await gdt.markUserActivated(this.fellowUser._id, true);
        this.fellowUser.activated = true;
    }

    @semaphore()
    @wxaViewMethod()
    async deactivate() {
        if (!this.fellowUser) {
            return;
        }
        if (!(this.user && this.user.privileged)) {
            return;
        }

        await gdt.markUserActivated(this.fellowUser._id, false);
        this.fellowUser.activated = false;
    }

    @semaphore()
    @wxaViewMethod()
    async unblacklistFriend() {
        if (!this.fellowUser) {
            return;
        }

        await gdt.friendUser(this.fellowUser._id, false);
        _.set(this.fellowUser, 'friendship.isFriendOfMine', true);
        _.set(this.fellowUser, 'friendship.blacklisted', false);

    }

    @wxaViewMethod()
    gotoContact() {
        if (this.fellowUser) {
            this.wxService.navigateTo('/pages/contact/contact?uid=' + this.fellowUser._id);
        }
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
    gotoPost(@wxaViewParam('detail.postId') postId: string) {
        if (postId) {
            this.wxService.navigateTo(`/pages/post/post?postId=${postId}&autoFocus=true`);
        }

    }

    makeShareInfo() {
        if (this.fellowUser) {
            return {
                title: `${this.fellowUser.profile!.nickName || 'Ta'} 在706`,
                path: `/pages/fellow/fellow?uid=${this.fellowUser._id}`
            };
        }

        return {};
    }

    @wxaViewMethod()
    copyToClipBoard(@wxaViewParam('currentTarget.dataset.copy') data: string) {
        this.wxService.setClipboardData(data);
    }
}

