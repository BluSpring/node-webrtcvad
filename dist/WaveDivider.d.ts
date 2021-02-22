/// <reference types="node" />
export declare class WaveDivider {
    /**
     * divide wav file into multi parts, by setting of options
     * @param {Buffer} audio wave (.wav) file buffer
     * @param {VADOptions} options options
     * @return {Promise<BufferResult[]>} result
     */
    static divideBuffer(audio: Buffer, options: VADOptions): Promise<BufferResult[]>;
    private static groupSpans;
    private static mergeConnectedSpans;
    private static splitBySpanGroups;
}
export interface VADOptions {
    aggressiveness: number;
    frameLen: number;
    windowLen: number;
    triggerIn: number;
    triggerOut: number;
    leadIn: number;
    minInterval: number;
    mode: VADMode;
    parts: number;
    minLen: number;
}
export declare enum VADMode {
    MIN_LENGTH_TRIM = "MIN_LENGTH_TRIM",
    MIN_LENGTH_NO_TRIM = "MIN_LENGTH_NO_TRIM",
    EQUAL_PARTS = "EQUAL_PARTS"
}
interface BufferResult {
    start: number;
    end: number;
    buffer: Buffer;
}
export {};
