import { WxaComponent, CivilizedComponent, wxaViewProperty, wxaViewParam, wxaViewMethod } from '../../services/wrapper';
import wxService from '../../services/wx-service';

@WxaComponent({
    options: {
        addGlobalClass: true,
        multipleSlots: true
    }
})
export class LayoutComponent extends CivilizedComponent {

    @wxaViewProperty({
        expose: true
    })
    activeSection?: string;

    @wxaViewProperty({
        expose: true
    })
    backBtnEnabled?: boolean;

    @wxaViewProperty({
        expose: true
    })
    alternativeMode?: boolean;

    mtapCount: number = 0;
    mtapTs: number = 0;

    constructor() {
        super();

        const e = this.wxService.systemInfo;

        const initData: any = {};

        initData.bgColor = 'bg-gradual-green';
        initData.StatusBar = e.statusBarHeight;
        const custom = wx.getMenuButtonBoundingClientRect();
        initData.Custom = custom;
        initData.CustomBar = custom.bottom + custom.top - e.statusBarHeight;

        this.data = initData;
    }

    @wxaViewMethod()
    sectionChange(@wxaViewParam('currentTarget.dataset.section') section: string) {
        this.triggerEvent('sectionChange', { section }, {});
        const nowTs = Date.now();
        const delta = nowTs - this.mtapTs;
        // tslint:disable-next-line: no-magic-numbers
        if (delta <= 500) {
            this.mtapCount += 1;
            this.triggerEvent('multiTap', { taps: this.mtapCount }, {});
        } else {
            this.mtapCount = 1;
        }
        this.mtapTs = nowTs;
    }

    @wxaViewMethod()
    onlyButtonLongPress(@wxaViewParam('currentTarget.dataset.sectionLong') section: string) {
        this.triggerEvent('sectionChange', { section }, {});
        const nowTs = Date.now();
        const delta = nowTs - this.mtapTs;
        // tslint:disable-next-line: no-magic-numbers
        if (delta <= 5000) {
            this.mtapCount += 1;
            this.triggerEvent('multiTap', { taps: this.mtapCount }, {});
        } else {
            this.mtapCount = 1;
        }
        this.mtapTs = nowTs;
    }

    @wxaViewMethod()
    gotoContact() {
        wxService.navigateTo('/pages/contact/contact');
    }

}
