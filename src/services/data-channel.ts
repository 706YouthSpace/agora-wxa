import EventEmitter from '../vendors/events';

export const dataChannel = new EventEmitter();
// tslint:disable-next-line: no-magic-numbers
dataChannel.setMaxListeners(65535);
