
import { CivilizedApp, WxaApp } from './services/wrapper';
import _ from './vendors/lodash';
import { GlobalDataContext } from './services/global-data-context';
export interface MyApp {
    globalData: {
        userInfo?: wx.UserInfo;
    },

    userInfoReadyCallback?(res: wx.UserInfo): void
}

export const gdt = new GlobalDataContext();

@WxaApp
export class MyCivilizedApp extends CivilizedApp {
    gdt = gdt;

    constructor() {
        super();

        this.gdt.login();

    }
}


