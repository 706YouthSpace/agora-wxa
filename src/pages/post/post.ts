import _ from '../../vendors/lodash';
import { CivilizedPage, WxaPage, wxaViewProperty, wxaViewMethod, wxaViewParam, semaphore } from '../../services/wrapper';
import { gdt } from '../../app';
import wxService from '../../services/wx-service';
import { Post } from '../../interfaces/post';

// tslint:disable: object-literal-sort-keys
// Page({});
@WxaPage({
    registerShareHandler: 'makeShareInfo'
})
export class PostPage extends CivilizedPage {
    @wxaViewProperty()
    backBtnEnabled?: boolean;

    @wxaViewProperty()
    inputBottomHeight?: number;

    @wxaViewProperty()
    post?: Post;

    @wxaViewProperty()
    commentDraft?: string;

    @wxaViewProperty()
    commentReference?: string;

    @wxaViewProperty()
    imgDraft: string[] = [];

    @wxaViewProperty()
    textareaHidden: boolean = true;

    @wxaViewProperty()
    dialogActive?: boolean;

    @wxaViewProperty()
    dialogKind?: string = 'not-activated';

    constructor() {
        super();

        this.on('load', (query) => {
            if (query.autoFocus !== undefined) {
                this.textareaHidden = false;
            }
            if (query.postId) {
                this.preparePostInfo(query.postId);

                return;
            }

            wxService.navigateBack(1);

        });

        this.setData({ backBtnEnabled: getCurrentPages()[0] !== this });
    }

    async preparePostInfo(postId: string) {
        const post = await gdt.getPost(postId);
        this.post = post;
    }

    @wxaViewMethod()
    startComment(@wxaViewParam('detail.height') inputHeight: number) {
        this.inputBottomHeight = inputHeight;

        if (this.textareaHidden) {
            this.textareaHidden = false;
        }

    }

    @wxaViewMethod()
    stopComment(@wxaViewParam('detail.value') inputValue: string) {
        this.inputBottomHeight = 0;
        this.commentDraft = inputValue;
        this.textareaHidden = true;
    }

    @wxaViewMethod()
    onInput(@wxaViewParam('detail.value') inputValue: string) {
        this.commentDraft = inputValue;
    }

    @wxaViewMethod()
    focusOn(@wxaViewParam('detail.postId') postId: string) {
        if (!this.post) {
            return;
        }
        this.textareaHidden = false;
        if (postId !== this.post._id) {
            this.commentReference = postId;
        }
    }

    @semaphore()
    @wxaViewMethod()
    async commitComment(@wxaViewParam('detail.value') inputValue?: string) {
        this.textareaHidden = true;
        if (gdt.user && !gdt.user.activated) {
            this.openDialog('not-activated');

            return;
        }
        const commentDraft = inputValue || this.commentDraft;
        console.log('WTF', commentDraft);
        this.inputBottomHeight = 0;
        if (!this.post) {
            return;
        }
        if (!commentDraft && !this.imgDraft.length) {
            return;
        }
        const images = [];
        if (this.imgDraft.length) {
            images.push(...(await Promise.all(this.imgDraft.map(gdt.uploadFile.bind(gdt)))));
        }

        try {
            const newComment = await gdt.commentOnPost(this.post._id, commentDraft, this.commentReference, images.map((x) => x._id));
            this.post = this.post;
            this.commentDraft = '';
            this.imgDraft = [];

            if (newComment.blocked) {
                this.openDialog('content-blocked');

                return;
            }

            wx.pageScrollTo({ scrollTop: Infinity, duration: 300 });

            return newComment;
        } catch (err) {
            // tslint:disable-next-line: no-magic-numbers
            if (err && err.status === 40008) {
                this.openDialog('content-redundant');

                return;
            }

            // tslint:disable-next-line: no-magic-numbers
            if (err && err.status === 40303) {
                this.openDialog('not-activated');

                return;
            }

            throw err;
        }

    }

    @wxaViewMethod()
    async chooseImages() {

        const { tempFilePaths: pickedImages } = await this.wxService.chooseImage({
            count: 9
        });
        if (pickedImages && pickedImages.length) {
            this.imgDraft = pickedImages;
        }

        return pickedImages;
    }


    @wxaViewMethod()
    async markPostLiked(@wxaViewParam('detail.postId') postId: string) {
        if (!this.post) {
            return;
        }

        await gdt.markPostLiked(postId, true);
        // if (postId === this.post._id) {
        //     this.post = this.post;
        // } else if (this.post.comments && this.post.comments.length) {
        //     const targetPost = _.find(this.post.comments, { _id: postId });
        //     const targetIndex = _.indexOf(this.post.comments, targetPost);
        //     if (targetPost && targetIndex >= 0) {

        //         this.post.comments[targetIndex] = targetPost;
        //     }
        // }


        return true;
    }

    @wxaViewMethod()
    async markPostUnliked(@wxaViewParam('detail.postId') postId: string) {
        if (!this.post) {
            return;
        }

        await gdt.markPostLiked(postId, false);

        // if (postId === this.post._id) {
        //     this.post = this.post;
        // } else if (this.post.comments && this.post.comments.length) {
        //     const targetPost = _.find(this.post.comments, { _id: postId });
        //     const targetIndex = _.indexOf(this.post.comments, targetPost);
        //     if (targetPost && targetIndex >= 0) {

        //         this.post.comments[targetIndex] = targetPost;
        //     }
        // }

        return false;
    }


    makeShareInfo() {
        if (this.post) {
            if (this.post.author) {
                return {
                    title: `${this.post.author.profile!.nickName} 的帖子 - 706空间`,
                    path: `/pages/post/post?postId=${this.post._id}`
                };
            }
        }

        return {
            title: `706空间`,
            path: '/pages/index/index'
        };
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

}

