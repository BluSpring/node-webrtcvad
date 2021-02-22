/// <reference types="node" />
import { EventEmitter } from 'events';
export declare class VadSession {
    private static _vad;
    constructor();
    static create(identity: string): EventEmitter;
}
