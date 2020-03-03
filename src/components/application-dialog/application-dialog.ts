
import { WxaComponent, CivilizedComponent, wxaViewProperty, wxaViewMethod, wxaViewParam } from '../../services/wrapper';
import { gdt } from '../../app';
import { User } from '../../interfaces/user';
import _ from '../../vendors/lodash';
import { DialogProfile } from '../../services/global-data-context';
import { Deferred, Defer } from '../../utils/defer';


@WxaComponent({
    options: {
        addGlobalClass: true,
        // multipleSlots: true
    }
})
export class ApplicationDialogComponent extends CivilizedComponent {

    @wxaViewProperty()
    user?: User;

    @wxaViewProperty()
    title?: string;

    @wxaViewProperty()
    content?: string;

    @wxaViewProperty()
    actions?: string[];

    @wxaViewProperty({
        expose: true
    })
    active?: boolean;

    @wxaViewProperty()
    show?: boolean;

    @wxaViewProperty({
        expose: true,
    })
    kind?: string;

    @wxaViewProperty({
        expose: true,
    })
    control?: ApplicationDialogControl;

    @wxaViewProperty()
    activeProfile?: DialogProfile;

    @wxaViewProperty()
    actionTextMap?: { [k: string]: string };

    @wxaViewProperty()
    actionColorMap?: { [k: string]: string };


    profiles: { [k: string]: DialogProfile } = {
        'not-activated': {
            title: '功能受限说明',
            content: `为了维持社区的良好秩序，未经706团队审核通过的用户暂不能进行发帖和回复。

            请您耐心等待管理员审核。

            感谢您的配合。`,

            actions: {
                知道了: undefined
            },
            actionColor: {
                知道了: 'white'
            }
        },
        'content-blocked': {
            title: '内容被限制传播',
            content: `自动内容过滤系统认定您所发布的内容不适合被传播。
            
            该内容在本平台的传播已被限制，暂时只有管理员可以看到这条内容。
            
            管理员将对您发布的内容进行人工二次审核，如果自动过滤系统的处置有误，将人工解除内容的传播限制。

            您可以修改内容后重新发布，但请不要重复发布此内容。`,

            actions: {
                知道了: undefined
            },
            actionColor: {
                知道了: 'white'
            }
        },

        'content-redundant': {
            title: '内容重复',
            content: `因您最近发布过与此条内容一模一样的内容，本次发布的内容已被系统拒绝。
            
            请您不要重复发布内容。`,
            actions: {
                知道了: undefined
            },
            actionColor: {
                知道了: 'white'
            }

        }
    };

    constructor() {
        super();

        gdt.userPromise.then((r) => {
            this.user = r;
        });

        this.on('propertyUpdate', (propName, val) => {
            switch (propName) {

                case 'kind': {
                    this._setKind(val);

                    break;
                }

                case 'active': {
                    const boolval = Boolean(val);

                    if (!boolval) {
                        this.dismissModal();
                        break;
                    }

                    wx.nextTick(() => {
                        if (this.activeProfile) {
                            this.show = true;
                        }
                    });

                    break;
                }

                case 'control': {
                    if (val && val.kind) {
                        this._setKind(val.kind);
                    }
                    if (val && val.hasOwnProperty('active')) {
                        const boolval = Boolean(val.active);

                        if (!boolval) {
                            this.dismissModal();
                        } else {
                            wx.nextTick(() => {
                                if (this.activeProfile) {
                                    this.show = true;
                                }
                            });
                        }
                    }
                    break;
                }

                default: {
                    void 0;
                }
            }
        });

        const dialogListener = (dialogName: string) => {
            if (this.kind === dialogName) {
                this._setKind(dialogName);
            }
        };
        gdt.on('dialogRegister', dialogListener);

        this.once('detached', () => {
            gdt.removeListener('dialogRegister', dialogListener);
        });
    }

    _setKind(kind: string) {
        const profileFound = gdt.dialogs[kind] || this.profiles[kind];

        if (profileFound) {
            this.activeProfile = profileFound;

            this.actions = Object.keys(profileFound.actions || {});

            this.title = this.activeProfile.title;
            this.content = this.activeProfile.content;

            this.actionColorMap = profileFound.actionColor;
            this.actionTextMap = profileFound.actionText;
        }
    }

    @wxaViewMethod()
    dismissModal() {
        this._dialogReturn(undefined);
        this.show = false;
    }

    _dialogReturn(val: any) {
        this.triggerEvent('dialogResult', { kind: this.kind, result: val });
        if (this.control && this.control.deferred) {
            this.control.deferred.resolve(val);
        }
    }

    // @wxaViewMethod()
    // async confirmModal() {

    //     if (this.activeProfile) {
    //         const actions = this.activeProfile.actions || {};
    //         if (actions.hasOwnProperty('confirm')) {
    //             const val = actions.confirm;
    //             if (typeof val === 'function') {
    //                 this.triggerEvent('dialogResult', { kind: this.kind, result: await val() });
    //             }
    //         } else {
    //             this.triggerEvent('dialogResult', { kind: this.kind, result: undefined });
    //         }
    //     }

    //     this.show = false;
    // }

    @wxaViewMethod()
    async customModalAction(@wxaViewParam('currentTarget.dataset.action') action: string) {

        if (this.activeProfile) {
            const actions = this.activeProfile.actions || {};
            if (actions.hasOwnProperty(action)) {
                const val = actions[action];
                if (typeof val === 'function') {
                    this._dialogReturn(await val());
                } else {
                    this._dialogReturn(await val);
                }
            } else {
                this._dialogReturn(undefined);
            }
        }


        this.show = false;
    }


}

export class ApplicationDialogControl {
    kind?: string;
    active?: boolean;
    deferred?: Deferred<any>;
    constructor(kind?: string, active?: boolean) {
        this.kind = kind;
        this.active = active;
    }


    open(kind?: string) {
        if (kind) {
            this.kind = kind;
        }
        if (this.deferred) {
            this.deferred.reject(new Error('Overrriden'));
        }
        this.deferred = Defer();
        this.active = true;

        return this.deferred.promise;
    }

    close() {
        this.active = false;
    }
}
