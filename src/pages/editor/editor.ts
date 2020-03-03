import _ from '../../vendors/lodash';
import { CivilizedPage, WxaPage, wxaViewProperty, wxaViewMethod, wxaViewParam } from '../../services/wrapper';
import { gdt } from '../../app';
import wxService from '../../services/wx-service';
import { ApplicationDialogControl } from '../../components/application-dialog/application-dialog';

// tslint:disable: object-literal-sort-keys
// Page({});
@WxaPage({
    registerShareHandler: {
        title: '在706发帖',
        path: '/pages/editor/editor'
    }
})
export class EditorPage extends CivilizedPage {

    @wxaViewProperty()
    activeModal?: string;

    @wxaViewProperty()
    imgDraft: string[] = [];

    @wxaViewProperty()
    textDraft: string = '';

    @wxaViewProperty()
    tagsDraft: string[] = [];

    @wxaViewProperty()
    currentEditingTagIndex?: number;

    @wxaViewProperty()
    draftingTag?: boolean = false;

    submitionLock = false;

    templates: any = {
        话题讨论: '研讨主题：\n',
        公共活动: '活动主题：\n活动时间：\n活动地点：\n组织者：\n',
        私人求助信息: '求助主题：\n'
    };


    @wxaViewProperty()
    dialogControl = new ApplicationDialogControl();

    constructor() {
        super();

        this.activeModal = 'templateSelect';

        this.setData({ backBtnEnabled: getCurrentPages()[0] !== this });
    }

    @wxaViewMethod()
    setToTextDraft(@wxaViewParam('detail.value') val: string) {
        this.textDraft = val;
    }

    @wxaViewMethod()
    editTag(@wxaViewParam('currentTarget.dataset.tagIndex') index: number) {
        this.currentEditingTagIndex = index;
    }

    @wxaViewMethod()
    finishTagEdit(
        @wxaViewParam('currentTarget.dataset.tagIndex') index: number,
        @wxaViewParam('detail.value') inputValue: string) {

        this.tagsDraft[index] = inputValue;
        this.tagsDraft = _.uniq(_.compact(this.tagsDraft));
        this.currentEditingTagIndex = NaN;
    }

    @wxaViewMethod()
    finishTagCreate(@wxaViewParam('detail.value') inputValue: string) {
        if (inputValue) {
            this.tagsDraft.push(inputValue);
        }
        this.tagsDraft = _.compact(_.uniq(this.tagsDraft));
        this.draftingTag = false;
        this.currentEditingTagIndex = NaN;
    }

    @wxaViewMethod()
    startTagCreate() {
        this.draftingTag = true;
    }


    @wxaViewMethod()
    dismissModal() {
        this.activeModal = '';
    }

    @wxaViewMethod()
    showTagEdit() {
        this.activeModal = 'tagEdit';
    }

    @wxaViewMethod()
    applyTemplate(@wxaViewParam('currentTarget.dataset.template') template?: string) {
        if (template) {
            this.textDraft = this.templates[template];
            this.tagsDraft.length = 0;
            this.tagsDraft.push(template);
            // console.log(this.tagsDraft);
        }
    }

    @wxaViewMethod()
    async chooseImages() {
        const MAX_IMAGES = 9;
        const quotaLeft = MAX_IMAGES - this.imgDraft.length;
        if (quotaLeft <= 0) {
            return;
        }

        const { tempFilePaths: pickedImages } = await this.wxService.chooseImage({
            count: quotaLeft
        });
        this.imgDraft.push(...pickedImages);

        return pickedImages;
    }

    @wxaViewMethod()
    unselectImage(@wxaViewParam('currentTarget.dataset.index') index: number) {
        this.imgDraft.splice(index, 1);
    }

    async uploadImages() {
        const results = await Promise.all(this.imgDraft.map(gdt.uploadFile.bind(gdt)));

        return results;
    }

    @wxaViewMethod()
    async submit() {
        if (this.submitionLock) {
            return;
        }
        this.submitionLock = true;
        try {
            const images = [];
            if (this.imgDraft.length) {
                images.push(...(await this.uploadImages()));
            }
            if (!images.length && !this.textDraft) {
                return;
            }

            const post = await gdt.publishPost(this.textDraft, this.tagsDraft, images.map((x) => x._id));

            if (post.blocked) {
                await this.dialogControl.open('content-blocked');

                return;
            }

        } catch (err) {
            // tslint:disable-next-line: no-magic-numbers
            if (err && err.status === 40008) {
                await this.dialogControl.open('content-redundant');

                return;
            }

            // tslint:disable-next-line: no-magic-numbers
            if (err && err.status === 40303) {
                await this.dialogControl.open('not-activated');
                wxService.navigateBack(1);

                return;
            }
        } finally {
            this.submitionLock = false;
        }

        gdt.emit('shouldRefreshPost');
        wxService.navigateBack(1);

    }

}

