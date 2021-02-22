/// <reference types="node" />
export interface VadWindow {
    start: number;
    end: number;
}
export interface VadSegment {
    start: number;
    end: number;
}
export interface VadSegmentEx {
    start: number;
    end: number;
    density: number;
}
export interface VadResult {
    frames: number[];
    windows: VadWindow[];
    segments: VadSegment[];
}
export interface BlankPosition {
    start: number;
    length: number;
}
export declare class WaveVad {
    private _vad;
    constructor(mode: number);
    /**
     *
     * @param buffer
     * @param rate
     */
    private static isInBound;
    /**
     *
     * @param buffer
     * @param rate
     */
    private static isOutBound;
    /**
     * return ratio of 1/all
     * @param buffer array of 1|0
     */
    private static calcDensity;
    /**
     * add a fix time span to head of each window
     * @param {VadWindow[]} windows target windows
     * @param {number} leadin leadin time in ms
     * @return {VadWindow[]} windows after leadin added
     */
    private static addLeadIn;
    /**
     * merge windows by a minimal interval(above which will remains in different segments)
     * @param {VadWindow[]} windows windows
     * @param {number} minInterval interval in ms
     * @return {VadSegment[]} result segments
     */
    private static merge;
    /**
     * getIsSpeechFromWavFile
     * @param {Buffer} buffer target wave file buffer (assuming a 16bit linear PCM)
     * @param {number} frameLen the tiny unit(by ms) that will detect by WebRTC (cpp)
     * @return {Array} array of IsSpeech
     */
    private getIsSpeechFromBuffer;
    /**
     * getIsSpeechFromWavFile
     * @param {string} wavFile target wave file (assuming a 16bit linear PCM)
     * @param {number} frameLen the tiny unit(by ms) that will detect by WebRTC (cpp)
     * @return {Array} array of IsSpeech
     */
    private getIsSpeechFromWavFile;
    private getIsSpeech;
    private static getSegmentsOfSpeech;
    private getSplitOfSpeech;
    private static standardDeviation;
    private static average;
    private getEqualParts;
    /**
     * output the time segments of speech
     * @param {string} wavFile target wave file (assuming a 16bit linear PCM)
     * @param {number} frameLen the tiny unit(by ms) that will detect by WebRTC (cpp)
     * @param {number} windowLen the unit time span(by ms) that will be put together then apply some algorithm (such as >90% = in, <10% = out)
     * @param {number} inbound speech if speech/all is more than this value
     * @param {number} outbound blank if speech/all is less than this value
     * @param {number | null} leadin leadin time added to head of each window
     * @param {number | null} minInterval minimal interval to merge windows to segments
     * @return {Object} frame detect result and segments of speech
     * {
     *     frames: [0, 1, 0, 1...],
     *     windows: [{start: , end: }, {start: , end: } ...]
     *     segments: [{start: , end: }, {start: , end: } ...]
     * }
     */
    getSegmentsFromFile(wavFile: string, frameLen: number, windowLen: number, inbound?: number, outbound?: number, leadin?: number | null, minInterval?: number | null): Promise<VadResult>;
    /**
     * output the time segments of speech
     * @param {Buffer} buffer target wave file buffer (assuming a 16bit linear PCM)
     * @param {number} frameLen the tiny unit(by ms) that will detect by WebRTC (cpp)
     * @param {number} windowLen the unit time span(by ms) that will be put together then apply some algorithm (such as >90% = in, <10% = out)
     * @param {number} inbound speech if speech/all is more than this value
     * @param {number} outbound blank if speech/all is less than this value
     * @param {number | null} leadin leadin time added to head of each window
     * @param {number | null} minInterval minimal interval to merge windows to segments
     * @return {Object} frame detect result and segments of speech
     * {
     *     frames: [0, 1, 0, 1...],
     *     windows: [{start: , end: }, {start: , end: } ...]
     *     segments: [{start: , end: }, {start: , end: } ...]
     * }
     */
    getSegmentsFromBuffer(buffer: Buffer, frameLen: number, windowLen: number, inbound?: number, outbound?: number, leadin?: number | null, minInterval?: number | null): Promise<VadResult>;
    /**
     * split wav file by non-voice
     *
     * @param {string} wavFile target wave file (assuming a 16bit linear PCM)
     * @param {number} frameLen the tiny unit(by ms) that will detect by WebRTC (cpp)
     * @param {number} windowLen the unit time span(by ms) that will be put together then apply some algorithm
     * @param {number} voiceThreshold blank if speech/all is less than this value
     * @param {number | null} leadin minimum leadin time added to head of each window (should be < minInterval)
     * @param {number | null} minInterval split segments if blank longer than this value
     * @param {number | null} minLength minimal length of each segment (small pieces will be merged to one)
     * @return {Object} frame detect result and split of speech
     */
    getSplitFromFile(wavFile: string, frameLen: number, windowLen: number, voiceThreshold: number, leadin: number, minInterval: number, minLength: number): Promise<VadResult>;
    /**
     * split wav file by non-voice
     *
     * @param {Buffer} buffer target wave file buffer(assuming a 16bit linear PCM)
     * @param {number} frameLen the tiny unit(by ms) that will detect by WebRTC (cpp)
     * @param {number} windowLen the unit time span(by ms) that will be put together then apply some algorithm
     * @param {number} voiceThreshold blank if speech/all is less than this value
     * @param {number | null} leadin minimum leadin time added to head of each window (should be < minInterval)
     * @param {number | null} minInterval split segments if blank longer than this value
     * @param {number | null} minLength minimal length of each segment (small pieces will be merged to one)
     * @return {Object} frame detect result and split of speech
     */
    getSplitFromBuffer(buffer: Buffer, frameLen: number, windowLen: number, voiceThreshold: number, leadin: number, minInterval: number, minLength: number): Promise<VadResult>;
    /**
     * split wav file into equal parts by approximate count
     *
     * @param {string} wavFile target wave file (assuming a 16bit linear PCM)
     * @param {number} frameLen the tiny unit(by ms) that will detect by WebRTC (cpp)
     * @param {number} windowLen the unit time span(by ms) that will be put together then apply some algorithm
     * @param {number} voiceThreshold blank if speech/all is less than this value
     * @param {number} minInterval split segments if blank longer than this value
     * @param {number} approxCount approximate count of the parts
     * @return {Object} frame detect result and split of speech
     */
    getEqualPartsFromFile(wavFile: string, frameLen: number, windowLen: number, voiceThreshold: number, minInterval: number, approxCount: number): Promise<VadResult>;
    /**
     * split wav file into equal parts by approximate count
     *
     * @param {Buffer} buffer target wave file buffer(assuming a 16bit linear PCM)
     * @param {number} frameLen the tiny unit(by ms) that will detect by WebRTC (cpp)
     * @param {number} windowLen the unit time span(by ms) that will be put together then apply some algorithm
     * @param {number} voiceThreshold blank if speech/all is less than this value
     * @param {number} minInterval split segments if blank longer than this value
     * @param {number} approxCount approximate count of the parts
     * @return {Object} frame detect result and split of speech
     */
    getEqualPartsFromBuffer(buffer: Buffer, frameLen: number, windowLen: number, voiceThreshold: number, minInterval: number, approxCount: number): Promise<VadResult>;
}
