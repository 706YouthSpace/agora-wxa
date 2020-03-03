import _ from '../vendors/lodash';

// function isObject(obj: any) {
//     if ((typeof obj) === 'object' && obj !== null) {
//         return true;
//     }
//     // if ((typeof obj) === 'function') {
//     //     return true;
//     // }

//     return false;
// }

export function carefulMerge(target: any, source: any) {
    // if (!isObject(target)) {
    //     return source;
    // }
    // if (!isObject(source)) {
    //     return target;
    // }
    // for (const k of Object.getOwnPropertyNames(source)) {
    //     const t = target[k];
    //     const s = source[k];
    //     if (t === s) {
    //         continue;
    //     }
    //     const to = isObject(t);
    //     const so = isObject(s);
    //     if (to && so) {
    //         carefulMerge(t, s);
    //     }
    //     if (to && !so) {
    //         target[k] = s;
    //         continue;
    //     }
    //     if (!to && so) {
    //         target[k] = s;
    //         continue;
    //     }
    //     if (!to && !so) {
    //         target[k] = s;
    //         continue;
    //     }
    // }

    // return target;

    return _.merge(target, source);
}

export default carefulMerge;
