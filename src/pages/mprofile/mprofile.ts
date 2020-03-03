import _ from '../../vendors/lodash';
import { CivilizedPage, WxaPage, wxaViewProperty, wxaViewMethod, wxaViewParam } from '../../services/wrapper';
import { gdt } from '../../app';
import wxService from '../../services/wx-service';
import { Genders as predefinedGenders } from '../../interfaces/user'
const PS_PLACEHOLDER = `讲讲您的个人经历如教育、工作、项目、看过的书，做过的事等。
请分行陈列，例如：
（1）2016年参加某夏令营，为乡村的孩子开设了音乐与舞蹈的夏令营课程。
（2）2016年衡水湖半马；2017北马；2018泰山全马。
（3）爬上了我们大学校园所有的天台。
`;

const AB_PLACEHOLDER = `介绍一下自己的技能
说说自己擅长或掌握的知识和技能，比如
（1）指弹吉他练了5年
（2）做过2年人文旅行领队，掌握四川本地丰富的人文知识
（3）擅长策划桌游剧本游戏
`;

const IN_PLACEHOLDER = `说说你正在做的事情还有关心的议题
介绍在北京或未来想做的事情，比如
（1）关注城市流动人口与环境问题
（2）准备申请北美地区社会科学方面的硕士项目
（3） 成立一个儿童保护的NGO
（4）参与某创业项目
`;

const plMap: any = {
    brefSkills: AB_PLACEHOLDER,
    brefConcerns: IN_PLACEHOLDER,
    brefExperience: PS_PLACEHOLDER
};

const predefinedTags = '学术，科技，人文，艺术，音乐，摄影，戏剧，公益，心理，电影，纪录片，美术'.split('，');


// const LONG_TEXT_TPL = `（1）
// （2）
// （3）`;

// Page({});
@WxaPage()
export class ProfileModificationPage extends CivilizedPage {
    @wxaViewProperty()
    backBtnEnabled?: boolean;

    @wxaViewProperty()
    profile?: { [k: string]: any };

    @wxaViewProperty()
    userInfo?: { [k: string]: any };

    @wxaViewProperty()
    preferences?: { [k: string]: any };

    @wxaViewProperty()
    originalPreferences?: { [k: string]: any };

    @wxaViewProperty()
    region: string[] = [];

    @wxaViewProperty()
    modal: string = '';

    @wxaViewProperty()
    avaliableTags: string[] = _.clone(predefinedTags);

    @wxaViewProperty()
    genders: { [k: string]: string[] } = _.clone(predefinedGenders)

    @wxaViewProperty()
    genderIndex?: number;


    submitionLock: boolean = false;

    constructor() {
        super();
        this.prepareUserInfo();
        this.prepareUserPreferences();
        this.setData({ backBtnEnabled: getCurrentPages()[0] !== this });
    }

    async prepareUserInfo() {
        this.userInfo = (await gdt.userInfo) as any;
        this.profile = _.cloneDeep(this.userInfo);
        if (this.profile) {
            this.region = [this.profile.province || '北京', this.profile.city || '海淀'];

            for (const k in plMap) {
                if (plMap.hasOwnProperty(k) && !this.profile[k]) {
                    this.profile[k] = plMap[k];
                }
            }
            this.genderIndex = this.genders.values.indexOf(this.profile['gender'])
        }
    }

    async prepareUserPreferences() {
        this.originalPreferences = _.get(await gdt.userPreference, 'profilePrivaicy') || {};
        this.preferences = _.cloneDeep(this.originalPreferences);
    }

    @wxaViewMethod()
    bindPickerChange(@wxaViewParam('detail.value') val: number) {
        if (this.profile) {
            this.profile.gender = this.genders.values[val]
            this.genderIndex = val
        }
    }

    @wxaViewMethod()
    syncAvatar(@wxaViewParam('detail.userInfo') val: any) {
        if (this.profile && val) {
            this.profile.avatarUrl = val.avatarUrl;
        }

    }

    @wxaViewMethod()
    onRegionChange(@wxaViewParam('detail.value') val: string[]) {
        const province = val[0].substring(0, 2);
        let city = val[1];
        if (val[0] === val[1]) {
            city = val[2];
        }

        if (city.endsWith('市') || city.endsWith('区')) {
            city = city.substring(0, city.length - 1);
        }
        if (this.profile) {
            this.profile.province = province;
            this.profile.city = city;
        }
        this.region[0] = province || '北京';
        this.region[1] = city || '海淀';

    }

    @wxaViewMethod()
    onRegionCancle() {

        if (this.profile && this.userInfo) {
            this.profile.province = this.userInfo.province;
            this.profile.city = this.userInfo.city;
        }

    }

    @wxaViewMethod()
    toggleFakePlaceholder(@wxaViewParam('detail.value') val: string, @wxaViewParam('currentTarget.dataset.pl') tpl: string) {
        if (!this.profile) {
            return;
        }
        if (!tpl) {
            return;
        }

        if (val && val !== '(1) ') {
            if (this.profile[tpl] === plMap[tpl]) {
                this.profile[tpl] = '(1) ';
            }

            return;
        }

        this.profile[tpl] = plMap[tpl];

    }

    @wxaViewMethod()
    injectBrackets(
        @wxaViewParam('detail.value') val: string,
        @wxaViewParam('currentTarget.dataset.pl') tpl: string
    ) {
        if (!this.profile) {
            return;
        }
        if (!tpl) {
            return;
        }

        if (val.endsWith('\n') && (val.length > this.profile[tpl].length)) {
            const lns = val.split(/\n?\(\d+\)/);

            this.profile[tpl] = val + `(${lns.length}) `;

            return;
        }

        this.profile[tpl] = val;
    }

    @wxaViewMethod()
    setProfileField(
        @wxaViewParam('detail.value') val: string,
        @wxaViewParam('currentTarget.dataset.pl') tpl: string
    ) {
        if (!this.profile) {
            return;
        }
        if (!tpl) {
            return;
        }

        if (!this.profile.hasOwnProperty(tpl)) {
            this.profile[tpl] = val;
        } else if (val) {
            this.profile[tpl] = val;
        }
    }

    @wxaViewMethod()
    toogleProfileVisibility(
        @wxaViewParam('currentTarget.dataset.pl') field: string
    ) {
        if (!this.preferences) {
            return;
        }
        if (!field) {
            return;
        }

        const val = this.preferences[field];

        switch (val) {
            case 'public': {
                this.preferences[field] = 'contact';
                break;
            }
            case 'private': {
                this.preferences[field] = 'public';
                break;
            }
            case 'contact': {
                this.preferences[field] = 'private';
                break;
            }
            default: {
                if (field === 'cellphone') {
                    this.preferences[field] = 'public';
                    break;
                }
                this.preferences[field] = 'contact';
            }
        }

    }

    @wxaViewMethod()
    tagEdit() {
        if (!this.profile) {
            return;
        }
        let curTags = _.get(this.profile, 'tags');
        if (!curTags) {
            curTags = [];
            this.profile.tags = curTags;
        }
        for (const x of curTags) {
            _.pull(this.avaliableTags, x);
        }
        this.modal = 'tagEdit';
    }

    @wxaViewMethod()
    hideModal() {
        this.modal = '';
    }

    @wxaViewMethod()
    addTag(@wxaViewParam('currentTarget.dataset.tag') tag: string) {
        if (!this.profile) {
            return;
        }
        if (!Array.isArray(this.profile.tags)) {
            this.profile.tags = [];
        }
        const tags: string[] = this.profile.tags;

        if (tags.indexOf(tag) < 0) {
            this.profile.tags.push(tag);
        }
        _.pull(this.avaliableTags, tag);
    }

    @wxaViewMethod()
    removeTag(@wxaViewParam('currentTarget.dataset.tag') tag: string) {
        if (!this.profile) {
            return;
        }
        if (!Array.isArray(this.profile.tags)) {
            this.profile.tags = [];
        }
        const tags: string[] = this.profile.tags;

        if (this.avaliableTags.indexOf(tag) < 0) {
            this.avaliableTags.push(tag);
        }
        _.pull(tags, tag);
    }

    @wxaViewMethod()
    async save() {
        if (this.submitionLock) {
            return;
        }
        this.submitionLock = true;
        const normalizedProfile = _.clone(this.profile || {});
        for (const k in plMap) {

            if (plMap.hasOwnProperty(k)) {
                if (normalizedProfile[k] === plMap[k]) {
                    // tslint:disable-next-line: no-dynamic-delete
                    delete normalizedProfile[k];
                }
            }
        }
        const resultPromises = [];
        if (!_.isEqual(normalizedProfile, this.userInfo)) {
            for (const x in normalizedProfile) {
                if (normalizedProfile.hasOwnProperty(x)) {
                    if (x === 'tags') {
                        if (_.isEqual(normalizedProfile[x], this.userInfo![x])) {
                            // tslint:disable-next-line: no-dynamic-delete
                            delete normalizedProfile[x];
                            continue;
                        }
                    }
                    if (normalizedProfile[x] === this.userInfo![x]) {
                        // tslint:disable-next-line: no-dynamic-delete
                        delete normalizedProfile[x];
                    }
                }
            }
            const updateProfilePromise = gdt.updateProfile(normalizedProfile);
            resultPromises.push(updateProfilePromise);
        }
        if (!_.isEmpty(this.preferences) && !_.isEqual(this.preferences, this.originalPreferences)) {
            const normalizedPreferences = _.clone(this.preferences) || {};
            for (const x in normalizedPreferences) {
                if (normalizedPreferences.hasOwnProperty(x)) {

                    if (normalizedPreferences[x] === this.originalPreferences![x]) {
                        // tslint:disable-next-line: no-dynamic-delete
                        delete normalizedPreferences[x];
                    }
                }
            }

            const updatePreferencesPromise = gdt.updateProfilePrivacy(normalizedPreferences);
            resultPromises.push(updatePreferencesPromise);
        }
        try {
            await Promise.all(resultPromises);
            wxService.navigateBack(1);
        } finally {
            this.submitionLock = false;
        }
    }


    // @wxaViewMethod()
    // syncWxPhoneNumber(@wxaViewParam('detail.value') val: boolean) {


    // }


}

