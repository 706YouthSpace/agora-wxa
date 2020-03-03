import { WxaComponent, CivilizedComponent, wxaViewProperty, wxaViewMethod, wxaViewParam } from '../../services/wrapper';
import { Post } from '../../interfaces/post';
import { gdt } from '../../app';
import { User } from '../../interfaces/user';

@WxaComponent({
    options: {
        addGlobalClass: true,
        multipleSlots: true
    }
})
export class PostItemComponent extends CivilizedComponent {

    @wxaViewProperty({
        expose: true
    })
    post?: Post;

    @wxaViewProperty({
        expose: true
    })
    isDetail?: boolean;

    @wxaViewProperty({
        expose: true
    })
    mode?: string;

    @wxaViewProperty()
    user?: User;

    @wxaViewProperty()
    showAdminOptions?: boolean;

    @wxaViewProperty()
    adminTarget?: Post;

    @wxaViewProperty()
    adminTargetBref?: string = '';

    constructor() {
        super();

        gdt.userPromise.then((r) => {
            this.user = r;
        });
    }

    @wxaViewMethod()
    onAuthorTapped(@wxaViewParam('currentTarget.dataset.uid') uid: string) {
        if (!(this.user && this.user.activated)) {
            return;
        }
        if (this.isDetail) {
            this.wxService.navigateTo('/pages/fellow/fellow?uid=' + uid);

            return;
        }

        if (this.post) {
            this.wxService.navigateTo('/pages/post/post?postId=' + this.post._id);
        }

    }

    @wxaViewMethod()
    onDetailTapped(@wxaViewParam('currentTarget.dataset.postId') postId: string) {
        if (this.isDetail) {
            return;
        }
        if (postId) {
            this.wxService.navigateTo('/pages/post/post?postId=' + postId);

            return;
        }

        if (this.post) {
            this.wxService.navigateTo('/pages/post/post?postId=' + this.post._id);
        }

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
    onCommentTapped(@wxaViewParam('currentTarget.dataset.postId') postId?: string) {
        if (!this.post) {
            return;
        }
        this.triggerEvent('comment', { postId: postId || this.post._id });
    }

    @wxaViewMethod()
    onLikeTapped(@wxaViewParam('currentTarget.dataset.postId') postId?: string) {
        if (!this.post) {
            return;
        }
        this.triggerEvent('like', { postId: postId || this.post._id });
    }

    @wxaViewMethod()
    onUnlikeTapped(@wxaViewParam('currentTarget.dataset.postId') postId?: string) {
        if (!this.post) {
            return;
        }
        this.triggerEvent('unlike', { postId: postId || this.post._id });
    }

    @wxaViewMethod()
    dismissAdmin() {
        this.showAdminOptions = false;
    }

    @wxaViewMethod()
    showAdmin(@wxaViewParam('currentTarget.dataset.target') postToAdmin: Post) {
        this.adminTarget = postToAdmin;
        if (this.adminTarget) {
            // tslint:disable-next-line: no-magic-numbers
            this.adminTargetBref = (this.adminTarget.content || '').slice(0, 8);
        }
        this.showAdminOptions = true;
    }

    @wxaViewMethod()
    async blockPost() {
        if (!this.adminTarget) {
            return;
        }

        const r = await gdt.markPostBlocked(this.adminTarget._id, true);

        return r;
    }

    @wxaViewMethod()
    async unblockPost() {
        if (!this.adminTarget) {
            return;
        }

        const r = gdt.markPostBlocked(this.adminTarget._id, false);

        return r;
    }

}
