export interface RequestOptions {
    expect?: 'binary' | 'text' | 'json';
    body?: any;
    header?: { [k: string]: string };
    query?: { [k: string]: string|number|boolean };
}

export function request(method: string, url: string, options: RequestOptions = {}) {
    const qObj: wx.RequestOption = {
        url,
        method: method.toUpperCase() as any,

    };

    switch (options.expect) {
        case 'binary': {
            qObj.dataType = 'binary';
            qObj.responseType = 'arraybuffer';
            break;
        }

        case 'text': {
            qObj.dataType = 'text';
            qObj.responseType = 'text';
            break;
        }

        case 'json':
        default: {
            qObj.dataType = 'json';
        }
    }

    if (options.header) {
        qObj.header = options.header;
    }

    if (options.body) {
        qObj.data = options.body;
    }

    if (options.query) {
        const query: any = options.query;
        const queryString = Object.keys(query).map((x) => {
            const k = x;
            const v = query[k];

            return `${encodeURIComponent(k)}=${v === undefined ? '' : encodeURIComponent(v)}`;
        }).join('&');
        if (qObj.url.includes('?')) {
            qObj.url = qObj.url.replace(/\?/, `?${queryString}&`);
        } else {
            qObj.url = `${qObj.url}?${queryString}`;
        }
    }
    let requestTask: wx.RequestTask | undefined;
    const thePromise = new Promise((resolve, reject) => {
        qObj.success = resolve;
        qObj.fail = reject;
        requestTask = wx.request(qObj);
    }) as Promise<wx.RequestSuccessCallbackResult> & { task?: wx.RequestTask };

    thePromise.task = requestTask;

    return thePromise;
}

export interface DownloadOptions {
    header?: { [k: string]: string };
    query?: { [k: string]: string|number|boolean };
    filePath?: string;
}

export function download(url: string, options: DownloadOptions = {}) {
    const qObj: wx.DownloadFileOption = {
        url
    };

    if (options.header) {
        qObj.header = options.header;
    }

    if (options.query) {
        const query: any = options.query;
        const queryString = Object.keys(query).map((x) => {
            const k = x;
            const v = query[k];

            return `${encodeURIComponent(k)}=${v === undefined ? '' : encodeURIComponent(v)}`;
        }).join('&');
        if (qObj.url.includes('?')) {
            qObj.url = qObj.url.replace(/\?/, `?${queryString}&`);
        } else {
            qObj.url = `${qObj.url}?${queryString}`;
        }
    }

    if (options.filePath) {
        qObj.filePath = options.filePath;
    }
    let downloadTask: wx.DownloadTask | undefined;
    const thePromise = new Promise((resolve, reject) => {
        qObj.success = resolve;
        qObj.fail = reject;
        downloadTask = wx.downloadFile(qObj);
    }) as Promise<{
        tempFilePath?: string;
        filePath?: string;
        statusCode: number;
    }> & {
        task?: wx.DownloadTask;
    };
    thePromise.task = downloadTask;

    return thePromise;
}

export interface UploadOptions {
    query?: { [k: string]: string };
    header?: { [k: string]: string };
    formData?: object;
}

export function upload(url: string, filePath: string, name: string, options: UploadOptions = {}) {
    const qObj: wx.UploadFileOption = {
        filePath,
        name,
        url,
    };

    if (options.header) {
        qObj.header = options.header;
    }

    if (options.query) {
        const query: any = options.query;
        const queryString = Object.keys(query).map((x) => {
            const k = x;
            const v = query[k];

            return `${encodeURIComponent(k)}=${v === undefined ? '' : encodeURIComponent(v)}`;
        }).join('&');
        if (qObj.url.includes('?')) {
            qObj.url = qObj.url.replace(/\?/, `?${queryString}&`);
        } else {
            qObj.url = `${qObj.url}?${queryString}`;
        }
    }

    if (options.formData) {
        qObj.formData = options.formData;
    }

    let uploadTask: wx.UploadTask | undefined;
    const thePromise = new Promise((resolve, reject) => {
        qObj.success = resolve;
        qObj.fail = reject;
        uploadTask = wx.uploadFile(qObj);
    }) as Promise<{
        data: string;
        statusCode: number;
    }> & {
        task?: wx.UploadTask;
    };
    thePromise.task = uploadTask;

    return thePromise;
}

export interface ConnectWebSocketOptions {
    query?: { [k: string]: string };
    header?: { [k: string]: string };
    protocols?: string[];
    tcpNoDelay?: boolean;
}

export function connectWebSocket(url: string, options: ConnectWebSocketOptions = {}) {
    const qObj: wx.ConnectSocketOption = {
        url
    };

    if (options.header) {
        qObj.header = options.header;
    }

    if (options.query) {
        const query: any = options.query;
        const queryString = Object.keys(query).map((x) => {
            const k = x;
            const v = query[k];

            return `${encodeURIComponent(k)}=${v === undefined ? '' : encodeURIComponent(v)}`;
        }).join('&');
        if (qObj.url.includes('?')) {
            qObj.url = qObj.url.replace(/\?/, `?${queryString}&`);
        } else {
            qObj.url = `${qObj.url}?${queryString}`;
        }
    }

    if (options.protocols) {
        qObj.protocols = options.protocols;
    }

    if (options.tcpNoDelay) {
        qObj.tcpNoDelay = options.tcpNoDelay;
    }


    let wsTask: wx.SocketTask | undefined;
    const thePromise = new Promise((resolve, reject) => {
        qObj.success = () => resolve(wsTask);
        qObj.fail = reject;
        wsTask = wx.connectSocket(qObj);
    }) as Promise<wx.SocketTask> & {
        task?: wx.SocketTask;
    };
    thePromise.task = wsTask;

    return thePromise;
}
