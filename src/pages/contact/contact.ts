import { CivilizedPage, WxaPage, wxaViewProperty, wxaViewMethod, wxaViewParam } from '../../services/wrapper';
import { gdt } from '../../app';
import { User } from '../../interfaces/user';
import _ from '../../vendors/lodash';

// tslint:disable: object-literal-sort-keys
// Page({});
@WxaPage({
    registerShareHandler: 'makeShareInfo'
})
export class ContactPage extends CivilizedPage {
    @wxaViewProperty()
    backBtnEnabled?: boolean;

    uid?: string;

    @wxaViewProperty()
    user?: User;

    contacts: User[] = [];

    @wxaViewProperty()
    aToz: any[] = [];

    @wxaViewProperty()
    letterCursor?: string;

    @wxaViewProperty()
    entities: any[] = [];

    @wxaViewProperty()
    hidden?: boolean = true;

    @wxaViewProperty()
    boxTop?: number;

    @wxaViewProperty()
    barTop?: number;

    @wxaViewProperty()
    scrollToAnchor?: string;

    @wxaViewProperty()
    CustomBar?: number;

    constructor() {
        super();

        const custom = wx.getMenuButtonBoundingClientRect();
        this.CustomBar = custom.bottom + custom.top - this.wxService.systemInfo.statusBarHeight;


        this.once('ready', () => {
            wx.createSelectorQuery().select('.indexBar-box').boundingClientRect((res) => {
                this.boxTop = res.top;
            }).exec();

            wx.createSelectorQuery().select('.indexes').boundingClientRect((res) => {
                this.barTop = res.top;
            }).exec();
        });

        this.setData({ backBtnEnabled: getCurrentPages()[0] !== this });

        this.on('load', async (query) => {
            if (query.uid) {
                this.uid = query.uid;
                this.user = gdt.dataIndex.user.get(this.uid!);
                this.contacts = await gdt.getUserFriends(this.uid!);
            } else {
                await gdt.userPromise;
                this.uid = gdt.user!._id;
                this.user = gdt.user;
                if (gdt.user!.friends) {
                    this.contacts = gdt.user!.friends;
                } else {
                    this.contacts = await gdt.getAllMyFriends();
                }
            }
            this.prepare();
        });
    }

    prepare() {
        const ATOZNUM = 26;
        const ASCIIBASE = 65;
        const aToz = [];
        const aTozIdx: any = {};
        for (let i = 0; i < ATOZNUM; i++) {
            const x = String.fromCharCode(ASCIIBASE + i);
            aToz[i] = { letter: x, data: [] as User[] };
            aTozIdx[x] = aToz[i];
        }

        const defaultTarget = { letter: '-', data: [] };
        aToz.push(defaultTarget);

        for (const contact of this.contacts) {
            if (contact.profile && contact.profile.nickNamePinyin) {
                const x = contact.profile.nickNamePinyin[0].toUpperCase();
                const matched = aTozIdx[x] || defaultTarget;

                matched.data.push(contact);
            }
        }

        const filtered = aToz.filter((x) => {
            return x.data.length;
        });

        filtered.forEach((x) => {
            x.data = _.sortBy(x.data, 'profile.nickNamePinyin');
        });

        this.aToz = aToz.map((x) => x.letter);
        this.letterCursor = this.aToz[0];
        this.entities = filtered;

        return;
    }

    @wxaViewMethod()
    moveCursorStartInner(@wxaViewParam('target.id') id: string) {
        this.hidden = false;
        this.letterCursor = this.aToz[id as any];
    }

    @wxaViewMethod()
    moveCursorStopInner() {
        this.hidden = true;
        this.letterCursor = this.letterCursor;
    }

    @wxaViewMethod()
    onMoveCursor(@wxaViewParam('touches[0].clientY') firstY: number) {
        if (firstY > this.boxTop!) {
            // tslint:disable-next-line: no-magic-numbers
            const offsetIndex = Math.floor((firstY - this.boxTop!) / 20);
            const charactor = this.aToz[offsetIndex];
            if (!charactor) {
                return;
            }
            this.letterCursor = charactor;
        }
    }

    @wxaViewMethod()
    moveCursorStart() {
        this.hidden = false;
    }

    @wxaViewMethod()
    moveCursorStop() {
        this.hidden = true;
        this.scrollToAnchor = this.letterCursor;
    }


    @wxaViewMethod()
    gotoFellow(@wxaViewParam('currentTarget.dataset.uid') uid: string) {
        if (this.user && this.user.activated && uid) {
            this.wxService.navigateTo('/pages/fellow/fellow?uid=' + uid);
        }
    }


    makeShareInfo() {
        if (this.user) {
            return {
                title: `${this.user.profile!.nickName} 在706的好友`,
                path: `/pages/contact/contact?uid=${this.user._id}`
            };
        }

        return { title: '在706的好友', path: '/pages/contact/contact' };
    }
}

