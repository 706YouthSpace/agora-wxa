import EventEmitter from '../vendors/events';
import { Defer } from '../utils/defer';
import * as request from './request';
import nestedProxy from '../utils/nested-proxy';

const SUCCESS_EVENT_PREFIX = 'wx-event-';
const FAILURE_EVENT_PREFIX = 'wx-err-';
const COMPLETE_EVENT_PREFIX = 'wx-activity-';

export class WXService extends EventEmitter {
    _cached: { [k: string]: Promise<any> } = {};

    systemInfo: wx.GetSystemInfoSyncResult = wx.getSystemInfoSync();
    updateManager?: wx.UpdateManager;
    launchOptions: wx.LaunchOptionsApp = wx.getLaunchOptionsSync();
    logManager: wx.LogManager = wx.getLogManager();
    showOptions?: wx.OnAppShowCallbackResult;

    localServices: Map<string, Map<string, [string, number]>> = new Map();
    _mdnsDiscovering = false;

    localStorageSnapshot: Map<string, {
        [key: string]: object;
    }> = new Map();

    _localStorageRevoker: Map<string, Function> = new Map();

    backgroundAudioManager: wx.BackgroundAudioManager = wx.getBackgroundAudioManager();
    recordManager: wx.RecorderManager = wx.getRecorderManager();
    fileSystemManager: wx.FileSystemManager = wx.getFileSystemManager();

    constructor() {
        super();
        this._readySystemInfo();
        this._readyAppLevelEvents();
        this._readyUpdateManager();
        this._readyLocalServiceDiscovery();
        this._readyLocationChange();
    }

    _promisify<T>(attrib: string, wxAttrib: string, nocache: any = false): Promise<T> {
        const cached = this._cached[attrib];
        if (cached && !nocache) {
            return cached;
        }
        const deferred = Defer<T>();

        ((wx as any)[wxAttrib])({
            success: (x: T) => {
                deferred.resolve(x);
                this.emit(`${SUCCESS_EVENT_PREFIX}${attrib}`, x);
            },
            // tslint:disable-next-line: object-literal-sort-keys
            fail: (x: wx.GeneralCallbackResult) => {
                deferred.reject(x);
                this.emit(`${FAILURE_EVENT_PREFIX}${attrib}`, x);
            },
            complete: (x: T | wx.GeneralCallbackResult) => {
                this.emit(`${COMPLETE_EVENT_PREFIX}${attrib}`, x);
            }
        });

        this._cached[attrib] = deferred.promise;

        return deferred.promise;
    }
    _typicalCall<T>(eventName: string, wxAttrib: string, params: object = {}, overrideResult?: any): Promise<T> {
        const deferred = Defer<T>();

        ((wx as any)[wxAttrib])({
            ...params,
            success: (x: T) => {
                deferred.resolve(x);
                this.emit(`${SUCCESS_EVENT_PREFIX}${eventName}`, overrideResult ? overrideResult : x);
            },
            // tslint:disable-next-line: object-literal-sort-keys
            fail: (x: wx.GeneralCallbackResult) => {
                deferred.reject(x);
                this.emit(`${FAILURE_EVENT_PREFIX}${eventName}`, x);
            },
            complete: (x: T | wx.GeneralCallbackResult) => {
                this.emit(`${COMPLETE_EVENT_PREFIX}${eventName}`, x);
            }
        });

        return deferred.promise;
    }
    _listenerFor(eventName: string) {
        return (...x: any[]) => {
            this.emit(`${SUCCESS_EVENT_PREFIX}${eventName}`, ...x);
        };
    }
    _errorListenerFor(eventName: string) {
        return (...x: any[]) => {
            this.emit(`${FAILURE_EVENT_PREFIX}${eventName}`, ...x);
        };
    }

    // tslint:disable:unified-signatures
    wxOn(event: 'checkingUpdate' | 'updateReady' | 'updateFailed', listener: (result: wx.GeneralCallbackResult) => any): this;
    wxOn(event: 'audioInterruptionBegin' | 'audioInterruptionEnd', listener: (result: wx.GeneralCallbackResult) => any): this;

    wxOn(event: 'appShow', listener: (showParam: wx.OnAppShowCallbackResult) => any): this;
    wxOn(event: 'appHide', listener: (result: wx.GeneralCallbackResult) => any): this;

    wxOn(event: 'globalDebugEnabled' | 'globalDebugDisabled', listener: (result: wx.GeneralCallbackResult) => any): this;

    wxOn(event: 'switchTab' | 'reLaunch' | 'redirectTo' | 'navigateTo', listener: (url: string) => any): this;
    wxOn(event: 'navigateBack', listener: (delta: number) => any): this;

    wxOn(event: 'showToast' | 'hideToast', listener: (result: wx.GeneralCallbackResult) => any): this;

    wxOn(event: 'showModal', listener: (result: wx.ShowModalSuccessCallbackResult) => any): this;

    wxOn(event: 'showLoading' | 'hideLoading', listener: (result: wx.GeneralCallbackResult) => any): this;

    wxOn(event: 'showActionSheet', listener: (result: wx.ShowActionSheetSuccessCallbackResult) => any): this;

    wxOn(event: 'showNavigationBarLoading' | 'hideNavigationBarLoading', listener: (result: wx.GeneralCallbackResult) => any): this;

    wxOn(event: 'setNavigationBarTitle' | 'setNavigationBarColor', listener: (result: wx.GeneralCallbackResult) => any): this;

    wxOn(event: 'setBackgroundTextStyle' | 'setBackgroundColor', listener: (result: wx.GeneralCallbackResult) => any): this;

    wxOn(event: 'showTabBarRedDot', listener: (index: number) => any): this;
    wxOn(event: 'showTabBar' | 'setTabBarStyle' | 'hideTabBar', listener: (result: wx.GeneralCallbackResult) => any): this;

    wxOn(event: 'setTabBarBadge' | 'setTabBarItem' | 'removeTabBarBadge' | 'hideTabBarRedDot', listener: (index: number) => any): this;

    wxOn(event: 'loadFontFace', listener: (family: string) => any): this;

    wxOn(event: 'startPullDownRefresh' | 'stopPullDownRefresh', listener: (result: wx.GeneralCallbackResult) => any): this;

    wxOn(event: 'setTopBarText', listener: (text: string) => any): this;

    wxOn(event: 'pageScrollTo', listener: (result: {
        scrollTop?: number;
        duration?: number;
        selector?: string;
    }) => any): this;



    wxOn(event: 'systemInfo', listener: (sysInfo: wx.GetSystemInfoSuccessCallbackResult) => any): this;

    wxOn(event: string, listener: (...argv: any[]) => any) {
        return this.on(`${SUCCESS_EVENT_PREFIX}${event}`, listener);
    }

    wxOnce(event: string, listener: (...argv: any[]) => any) {
        return this.once(`${SUCCESS_EVENT_PREFIX}${event}`, listener);
    }

    wxRemoveListener(event: string, listener: (...argv: any[]) => any) {
        return this.removeListener(`${SUCCESS_EVENT_PREFIX}${event}`, listener);
    }



    wxCatch(event: 'pageNotFound', catcher: (sysInfo: wx.GeneralCallbackResult) => any): this;
    wxCatch(event: 'error', catcher: (stack: string) => any): this;

    wxCatch(event: string, catcher: (...argv: any[]) => any) {
        return this.on(`${FAILURE_EVENT_PREFIX}${event}`, catcher);
    }

    wxRemoveCatcher(event: string, listener: (...argv: any[]) => any) {
        return this.removeListener(`${FAILURE_EVENT_PREFIX}${event}`, listener);
    }

    getSystemInfo() {
        return this._promisify<wx.GetSystemInfoSuccessCallbackResult>('systemInfo', 'getSystemInfo', 'WITHOUT_CACHE');
    }

    _readySystemInfo() {
        this.on('systemInfo', (x) => {
            Object.assign(this.systemInfo, x);
        });

    }

    get menuButtonBoundingClientRect() {
        return wx.getMenuButtonBoundingClientRect();
    }

    _readyUpdateManager() {
        if (this.updateManager) {
            return;
        }
        this.updateManager = wx.getUpdateManager();
        this.updateManager.onCheckForUpdate(this._listenerFor('checkingUpdate'));
        this.updateManager.onUpdateReady(this._listenerFor('updateReady'));
        this.updateManager.onUpdateFailed(this._listenerFor('updateFailed'));

        return this.updateManager;
    }

    _readyAppLevelEvents() {

        wx.onPageNotFound(this._errorListenerFor('pageNotFound'));
        wx.onError(this._errorListenerFor('error'));

        if (wx.onAudioInterruptionEnd) {
            wx.onAudioInterruptionEnd(this._listenerFor('audioInterruptionEnd'));
        }

        if (wx.onAudioInterruptionBegin) {
            wx.onAudioInterruptionBegin(this._listenerFor('audioInterruptionBegin'));
        }

        wx.onAppShow(this._listenerFor('appShow'));
        this.wxOn('appShow', (showParam: wx.OnAppShowCallbackResult) => {
            this.showOptions = showParam;
        });

        wx.onAppHide(this._listenerFor('appHide'));

        wx.onWindowResize(this._listenerFor('windowResize'));

        if (wx.onKeyboardHeightChange) {
            wx.onKeyboardHeightChange(this._listenerFor('keyboardHeightChange'));
        }

    }

    fuckingSetGlobalDebugFlag(state: boolean = true) {
        if (state) {
            return this._typicalCall('globalDebugEnabled', 'setEnableDebug', { enableDebug: true });
        }

        return this._typicalCall('globalDebugDisabled', 'setEnableDebug', { enableDebug: false });
    }

    switchTab(url: string) {
        return this._typicalCall('switchTab', 'switchTab', { url }, url);
    }

    reLaunch(url: string) {
        return this._typicalCall('reLaunch', 'reLaunch', { url }, url);
    }

    redirectTo(url: string) {
        return this._typicalCall('redirectTo', 'redirectTo', { url }, url);
    }

    navigateTo(url: string) {
        return this._typicalCall('navigateTo', 'navigateTo', { url }, url);
    }

    navigateBack(delta: number) {
        return this._typicalCall('navigateBack', 'navigateBack', { delta }, delta);
    }

    showToast(title: string, options: {
        icon?: 'success' | 'loading' | 'none';
        image?: string;
        duration?: number;
        mask?: boolean;
    } = {}) {
        return this._typicalCall('showToast', 'showToast', { title, ...options });
    }
    hideToast() {
        return this._typicalCall('hideToast', 'hideToast');
    }

    showModal(options: {
        title?: string;
        content?: string;
        showCancel?: boolean;
        cancelText?: string;
        cancelColor?: string;
        confirmText?: string;
        confirmColor?: string;
    } = {}) {
        return this._typicalCall('showModal', 'showModal', options);
    }

    showLoading(title: string, options: {
        mask?: boolean;
    } = {}) {
        return this._typicalCall('showLoading', 'showLoading', { title, ...options });
    }
    hideLoading() {
        return this._typicalCall('hideLoading', 'hideLoading');
    }

    showActionSheet(itemList: string[], options: {
        itemColor?: string;
    } = {}) {
        return this._typicalCall('showActionSheet', 'showActionSheet', { itemList, ...options });
    }

    showNavigationBarLoading() {
        return this._typicalCall('showNavigationBarLoading', 'showNavigationBarLoading');
    }
    hideNavigationBarLoading() {
        return this._typicalCall('hideNavigationBarLoading', 'hideNavigationBarLoading');
    }
    setNavigationBarTitle(title: string) {
        return this._typicalCall('setNavigationBarTitle', 'setNavigationBarTitle', { title });
    }
    setNavigationBarColor(frontColor: string, backgroundColor: string, options: {
        animation?: {
            duration?: number;
            timingFunc?: string;
        };
    } = {}) {
        return this._typicalCall('setNavigationBarTitle', 'setNavigationBarTitle', { frontColor, backgroundColor, ...options });
    }

    setBackgroundTextStyle(textStyle: 'dark' | 'light') {
        return this._typicalCall('setBackgroundTextStyle', 'setBackgroundTextStyle', { textStyle });
    }

    setBackgroundColor(options: {
        backgroundColor?: string;
        backgroundColorTop?: string;
        backgroundColorBottom?: string;
    } = {}) {
        return this._typicalCall('setBackgroundColor', 'setBackgroundColor', options);
    }

    showTabBarRedDot(index: number) {
        return this._typicalCall('showTabBarRedDot', 'showTabBarRedDot', undefined, index);
    }

    showTabBar(options: {
        animation?: boolean;
    } = {}) {
        return this._typicalCall('showTabBar', 'showTabBar', options);
    }

    setTabBarStyle(options: {
        color?: string;
        selectedColor?: string;
        backgroundColor?: string;
        borderStyle?: 'black' | 'white';
    } = {}) {
        return this._typicalCall('setTabBarStyle', 'setTabBarStyle', options);
    }

    setTabBarItem(index: number, options: {
        text?: string;
        iconPath?: string;
        selectedIconPath?: string;
    } = {}) {
        return this._typicalCall('setTabBarItem', 'setTabBarItem', { index, ...options }, index);
    }

    setTabBarBadge(index: number, text: string) {
        return this._typicalCall('setTabBarBadge', 'setTabBarBadge', { index, text }, index);
    }

    removeTabBarBadge(index: number) {
        return this._typicalCall('removeTabBarBadge', 'removeTabBarBadge', { index }, index);
    }

    hideTabBarRedDot(index: number) {
        return this._typicalCall('hideTabBarRedDot', 'hideTabBarRedDot', { index }, index);
    }

    hideTabBar(options: {
        animation?: boolean;
    } = {}) {
        return this._typicalCall('hideTabBar', 'hideTabBar', options);
    }

    loadFontFace(family: string, source: string, options: {
        desc?: {
            style?: 'normal' | 'italic' | 'oblique';
            weight?: 'normal' | 'bold' | '100' | '900' | string;
            variant?: 'normal' | 'small-caps' | 'inherit' | string;
        };
    } = {}) {
        return this._typicalCall('loadFontFace', 'loadFontFace', { family, source, ...options }, family);
    }

    startPullDownRefresh() {
        return this._typicalCall('startPullDownRefresh', 'startPullDownRefresh');
    }
    stopPullDownRefresh() {
        return this._typicalCall('stopPullDownRefresh', 'stopPullDownRefresh');
    }

    pageScrollTo(options: {
        scrollTop?: number;
        duration?: number;
        selector?: string;
    } = {}) {
        return this._typicalCall('pageScrollTo', 'pageScrollTo', options, options);
    }

    createAnimation(options: wx.CreateAnimationOption) {
        return wx.createAnimation(options);
    }

    setTopBarText(text: string) {
        return this._typicalCall('setTopBarText', 'setTopBarText', { text }, text);
    }

    getSelectedTextRange() {
        const deferred = Defer<{ start: number; end: number }>();

        wx.getSelectedTextRange({
            complete: (x: any) => {
                this.emit(`${SUCCESS_EVENT_PREFIX}selectedTextRange`, x);
            }
        });

        return deferred.promise;
    }

    request(method: string, url: string, options?: request.RequestOptions) {
        return request.request(method, url, options);
    }

    downloadFile(url: string, options?: request.DownloadOptions) {
        return request.download(url, options);
    }

    uploadFile(url: string, filePath: string, name: string, options?: request.UploadOptions) {
        return request.upload(url, filePath, name, options);
    }

    connectWebSocket(url: string, options?: request.ConnectWebSocketOptions) {
        return request.connectWebSocket(url, options);
    }

    _readyLocalServiceDiscovery() {

        wx.onLocalServiceResolveFail(this._listenerFor('localServiceResolveFail'));

        wx.onLocalServiceLost((result) => {
            if (result.serviceType && result.serviceName) {
                const fraction = this.localServices.get(result.serviceType);
                if (fraction) {
                    fraction.delete(result.serviceName);
                }
                this.emit(`${SUCCESS_EVENT_PREFIX}localServiceLost`, result);
            }
        });

        wx.onLocalServiceFound((result) => {
            if (result.serviceType && result.serviceName) {
                let fraction = this.localServices.get(result.serviceType);
                if (!fraction) {
                    fraction = new Map();
                    this.localServices.set(result.serviceType, fraction);
                }
                fraction.set(result.serviceName, [result.ip, result.port]);
                this.emit(`${SUCCESS_EVENT_PREFIX}localServiceFound`, result);
            }
        });

        wx.onLocalServiceDiscoveryStop(this._listenerFor('localServiceDiscoveryStop'));
    }

    runLocalServiceDiscovery(serviceType: string) {
        let fraction = this.localServices.get(serviceType);
        if (!fraction) {
            fraction = new Map();
            this.localServices.set(serviceType, fraction);
        }
        const result = Defer();
        wx.startLocalServiceDiscovery({
            serviceType,
            fail: result.reject,
            success: () => {
                fraction!.clear();

                const stopListener = () => {
                    this.emit(`${SUCCESS_EVENT_PREFIX}localServiceDiscoveryStop`);
                    result.resolve(fraction);
                    wx.offLocalServiceDiscoveryStop(stopListener);
                };

                wx.onLocalServiceDiscoveryStop(stopListener);
            }
        });

        (result.promise as any).services = fraction;

        return result.promise as Promise<Map<string, [string, number]>> & {
            services: Map<string, [string, number]>;
        };
    }

    createUDPSocket() {
        const sock = wx.creatUDPSocket();

        // sock.bind();

        return sock;
    }

    getStorageProxy(storageKey: string, sync?: any) {

        const storageHandler = (storage: any) => {
            let snapshot = this.localStorageSnapshot.get(storageKey);
            if (!snapshot) {
                snapshot = {};
                this.localStorageSnapshot.set(storageKey, snapshot);
            }

            Object.assign(snapshot, storage.data);

            let shouldSyncToStorage = false;

            const arrangeSync = () => {
                if (!shouldSyncToStorage) {
                    shouldSyncToStorage = true;
                    wx.nextTick(() => {
                        if (shouldSyncToStorage) {
                            wx.setStorage({
                                key: storageKey,
                                data: snapshot
                            });
                            shouldSyncToStorage = false;
                        }
                    });
                }
            };

            const revokableProxy = nestedProxy<any>(snapshot, {
                set: (target, propKey, val) => {
                    arrangeSync();

                    target[propKey as any] = val;

                    return true;
                },

                deleteProperty: (target, propKey) => {
                    arrangeSync();

                    // tslint:disable-next-line: no-dynamic-delete
                    delete target[propKey as any];

                    return true;
                }

            });

            this._localStorageRevoker.set(storageKey, revokableProxy.revoke);

            return revokableProxy.proxy;
        };

        if (sync) {
            const storage = wx.getStorageSync(storageKey);

            return storageHandler(storage);
        }

        const result = Defer();
        wx.getStorage({
            key: storageKey,
            success: (x) => result.resolve(storageHandler(x)),
            fail: result.reject
        });

        return result.promise;
    }

    removeStorage(storageKey: string) {
        this.localStorageSnapshot.delete(storageKey);
        const revokeFunc = this._localStorageRevoker.get(storageKey);

        if (revokeFunc) {
            revokeFunc();
            this._localStorageRevoker.delete(storageKey);
        }

        return this._typicalCall<string>('removeStorage', 'removeStorage', { key: storageKey }, storageKey);
    }

    clearStorage(storageKey: string) {
        this.localStorageSnapshot.clear();

        for (const x of this._localStorageRevoker.values()) {
            x();
        }

        this._localStorageRevoker.clear();

        return this._typicalCall<string>('removeStorage', 'removeStorage', { key: storageKey }, storageKey);
    }

    saveImage(filePath: string) {
        return this._typicalCall<string>('saveImage', 'saveImageToPhotosAlbum', { filePath }, filePath);
    }

    previewImage(urls: string | string[], options: {
        current?: string;
    } = {}) {
        if (typeof urls === 'string') {
            return this._typicalCall<string>('previewImage', 'previewImage', { urls: [urls], ...options }, urls);
        }

        return this._typicalCall<string[]>('previewImage', 'previewImage', { urls, ...options }, urls);
    }

    getImageInfo(src: string) {
        return this._typicalCall<wx.GetImageInfoSuccessCallbackResult>('getImageInfo', 'getImageInfo', { src });
    }

    compressImage(src: string, options: {
        quality?: number;
    } = {}) {
        return this._typicalCall<{ tempFilePath: string }>('compressImage', 'compressImage', { src, ...options });
    }


    chooseMessageFile(maxCount: number, options: {
        type?: 'all' | 'video' | 'image' | 'file';
        extension?: string[];
    } = {}) {
        return this._typicalCall<{
            tempFiles: Array<{
                path: string;
                size: number;
                name: string;
                type: string;
                time?: number;
            }>;
        }>('chooseMessageFile', 'chooseMessageFile', { count: maxCount, ...options });
    }

    chooseImage(options: {
        count?: number;
        sizeType?: Array<'original' | 'compressed'>;
        sourceType?: Array<'album' | 'camera'>;
    } = {}) {
        return this._typicalCall<wx.ChooseImageSuccessCallbackResult>('chooseImage', 'chooseImage', options);
    }

    saveVideo(filePath: string) {
        return this._typicalCall<string>('saveVideo', 'saveVideoToPhotosAlbum', { filePath }, filePath);
    }

    chooseVideo(options: {
        sourceType?: Array<'album' | 'camera'>;
        compressed?: boolean;
        maxDuration?: number;
        camera?: 'front' | 'back';
    } = {}) {
        return this._typicalCall<wx.ChooseVideoSuccessCallbackResult>('chooseVideo', 'chooseVideo', options);
    }

    setInnerAudioOption(options: {
        mixWithOther?: boolean;
        obeyMuteSwitch?: boolean;
    } = {}) {
        return this._typicalCall<typeof options>('setInnerAudioOption', 'setInnerAudioOption', options, options);
    }

    createInnerAudioContext() {
        return wx.createInnerAudioContext();
    }

    createCameraContext() {
        return wx.createCameraContext();
    }

    _readyLocationChange() {

        if (wx.onLocationChange) {
            wx.onLocationChange(this._listenerFor('locationChange'));
        }
    }

    startLocationUpdate() {
        return this._typicalCall<wx.GeneralCallbackResult>('startLocationUpdate', 'startLocationUpdate');
    }

    startLocationUpdateBackground() {
        return this._typicalCall<wx.GeneralCallbackResult>('startLocationUpdateBackground', 'startLocationUpdateBackground');
    }

    stopLocationUpdate() {
        return this._typicalCall<wx.GeneralCallbackResult>('stopLocationUpdate', 'stopLocationUpdate');
    }

    openLocation(latitude: number, lontitude: number, options: {
        scale?: number;
        name?: string;
        address?: string;
    } = {}) {
        return this._typicalCall<wx.GeneralCallbackResult>('openLocation', 'openLocation', {
            latitude,
            lontitude,
            ...options
        });
    }

    getLocation(options: {
        type?: 'wgs84' | 'gcj02';
        altitude?: boolean;
    } = {}) {
        return this._typicalCall<wx.GetLocationSuccessCallbackResult>('getLocation', 'getLocation', options);
    }

    chooseLocation() {
        return this._typicalCall<wx.ChooseLocationSuccessCallbackResult>('chooseLocation', 'chooseLocation');
    }

    updateShareMenu(options: {
        withShareTicket?: boolean;
        isUpdatableMessage?: boolean;
        activityId?: string;
        templateInfo?: {
            paramterList: Array<{ name: string; value: string }>;
        };
    } = {}) {
        return this._typicalCall<wx.GeneralCallbackResult>('updateShareMenu', 'updateShareMenu', options);
    }

    showShareMenu(options: {
        withShareTicket?: boolean;
    } = {}) {
        return this._typicalCall<wx.GeneralCallbackResult>('showShareMenu', 'showShareMenu', options);
    }

    hideShareMenu() {
        return this._typicalCall<wx.GeneralCallbackResult>('hideShareMenu', 'hideShareMenu');
    }

    getShareInfo(options: {
        shareTicket?: boolean;
        timeout?: number;
    } = {}) {
        return this._typicalCall<wx.GetShareInfoSuccessCallbackResult>('getShareInfo', 'getShareInfo', options);
    }

    login(options: {
        timeout?: number;
    } = {}) {
        return this._typicalCall<wx.LoginSuccessCallbackResult>('login', 'login', options);
    }

    checkSession() {
        return this._typicalCall<wx.GeneralCallbackResult>('checkSession', 'checkSession');
    }

    navigateToMiniProgram(appId: string, options: {
        path?: string;
        extraData?: object;
        envVersion?: 'develop' | 'trail' | 'release';
        timeout?: number;
    } = {}) {
        return this._typicalCall<string>('navigateToMiniProgram', 'navigateToMiniProgram', { appId, ...options }, appId);
    }

    navigateBackMiniProgram(options: {
        extraData?: object;
    } = {}) {
        return this._typicalCall('navigateBackMiniProgram', 'navigateBackMiniProgram', options);
    }

    getUserInfo(options: {
        withCredentials?: boolean;
        lang?: 'en' | 'zh_CN' | 'zh_TW';
    } = {}) {
        const deferred = Defer<wx.GetUserInfoSuccessCallbackResult>();

        wx.getUserInfo({
            ...options,
            success: (x) => {
                deferred.resolve(x);
                this.emit(`${SUCCESS_EVENT_PREFIX}getUserInfo`, x);
                if (x.userInfo) {
                    this.emit(`${SUCCESS_EVENT_PREFIX}userInfo`, x.userInfo);
                }
            },
            // tslint:disable-next-line: object-literal-sort-keys
            fail: (x: wx.GeneralCallbackResult) => {
                deferred.reject(x);
                this.emit(`${FAILURE_EVENT_PREFIX}getUserInfo`, x);
            },
            complete: (x: wx.GeneralCallbackResult) => {
                this.emit(`${COMPLETE_EVENT_PREFIX}getUserInfo`, x);
            }
        });

        return deferred.promise;
    }

    reportMonitor(name: string, v: number) {
        return wx.reportMonitor(name, v);
    }

    reportAnalytics(name: string, v: object) {
        return wx.reportMonireportAnalyticstor(name, v);
    }

    requestPayment(options: {
        timestamp: string;
        nonceStr: string;
        package: string;
        signType: 'MD5' | 'HMAC-SHA256';
        paySign: string;
    }) {
        return this._typicalCall('requestPayment', 'requestPayment', options);
    }

    authorize(scope: string) {
        return this._typicalCall('authorize', 'authorize', { scope }, scope);
    }

    openSetting() {
        return this._typicalCall<wx.OpenSettingSuccessCallbackResult>('openSetting', 'openSetting');
    }

    getSetting() {
        return this._typicalCall<wx.GetSettingSuccessCallbackResult>('getSetting', 'getSetting');
    }

    chooseAddress() {
        return this._typicalCall<wx.ChooseAddressSuccessCallbackResult>('chooseAddress', 'chooseAddress');
    }

    openCard(cardList: Array<{ cardId: string; code: string }>) {
        return this._typicalCall<wx.GeneralCallbackResult>('openCard', 'openCard', cardList);
    }

    addCard(cardList: Array<{ cardId: string; cardExt: string }>) {
        return this._typicalCall<wx.AddCardSuccessCallbackResult>('addCard', 'addCard', cardList);
    }

    chooseInvoiceTitle() {
        return this._typicalCall<wx.ChooseInvoiceTitleSuccessCallbackResult>('chooseInvoiceTitle', 'chooseInvoiceTitle');
    }

    chooseInvoice() {
        return this._typicalCall<wx.ChooseInvoiceSuccessCallbackResult>('chooseInvoice', 'chooseInvoice');
    }

    getWeRunData() {
        return this._typicalCall<wx.GetWeRunDataSuccessCallbackResult>('getWeRunData', 'getWeRunData');
    }

    setClipboardData(data: string) {
        return this._typicalCall<wx.SetClipboardDataSuccessCallback>('setClipboardData', 'setClipboardData', { data }, data);
    }

    getClipboardData() {
        return this._typicalCall<wx.GetClipboardDataSuccessCallback>('getClipboardData', 'getClipboardData');
    }

}
export const wxService = new WXService();

export default wxService;
