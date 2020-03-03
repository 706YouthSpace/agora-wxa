export interface User {
    _id: string;
    wxOpenId: string;
    wxUnionId?: string;
    wxaId: string;
    createdAt: number;
    lastActiveAt: number;
    profile?: {
        nickName: string;
        nickNamePinyin?: string;
        realName?: string;
        gender?: 'male' | 'female';
        avatarUrl?: string;
        province?: string;
        country?: string;
        city?: string;

        tags?: string[];

        school?: string;
        researchField?: string;

        organization?: string;
        position?: string;

        brefExperience?: string;
        brefSkills?: string;
        brefConcerns?: string;
        brefOthers?: string;

    };

    preferences?: {
        profilePrivacy?: {
            [k: string]: 'public' | 'contact' | 'private';
        };

        friending?: 'needs-confirmation' | 'allow-anyone' | 'disallow-everyone';
    }

    activated?: boolean;
    privileged?: boolean;

    friends?: User[];

    counter?: { [k: string]: number };
    _counter?: { [k: string]: string };
    _lastActiveAt?: string;
}
