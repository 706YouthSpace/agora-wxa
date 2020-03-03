import { WxaComponent, CivilizedComponent, wxaViewProperty, wxaViewMethod } from '../../services/wrapper';

@WxaComponent({
    options: {
        addGlobalClass: true,
        multipleSlots: true
    }
})
export class CustomHeaderComponent extends CivilizedComponent {

    @wxaViewProperty({
        expose: true
    })
    backBtnEnabled?: boolean;

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
    goBack() {
        this.wxService.navigateBack(0);
    }

    @wxaViewMethod()
    goHome() {
        this.wxService.redirectTo('/pages/index/index');
    }

}
