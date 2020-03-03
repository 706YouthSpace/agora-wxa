import { User } from './user';
export interface Post {
    _id: string;

    title: string;

    coverUrl?: string;

    wxaIds?: string;

    author: User;
    inReplyToPost: string;

    content: string;

    tags?: string[];

    images?: string[];
    video?: string;
    attachments?: { [k: string]: string };

    reference?: string;

    comments?: Post[];

    blocked?: boolean;

    liked?: boolean;
    likedAt?: number;
    commentedAt?: number;

    createdAt: number;
    updatedAt: number;

    postReferences?: string[];

    counter?: {
        [k: string]: number;
    }

    _counter?: {
        [k: string]: string;
    }

    _createdAt: string;
    _updatedAt: string;
}
