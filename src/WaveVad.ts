import {Vad} from './index';
import WaveFile from 'wavefile';
import fs from 'fs';


export interface VadWindow{
    start: number,
    end: number
}
export interface VadSegment{
    start: number,
    end: number
}
export interface VadSegmentEx{
    start: number,
    end: number,
    density: number
}
export interface VadResult {
    frames: number[]
    windows: VadWindow[]
    segments: VadSegment[]
}
export interface BlankPosition{
    start: number,
    length: number
}

export class WaveVad{

    private _vad: Vad;

    constructor(mode: number) {
        this._vad = new Vad(mode);
    }

    /**
     *
     * @param buffer
     * @param rate
     */
    private static isInBound(buffer: number[], rate: number) {
        return WaveVad.calcDensity(buffer) >= rate;
    }

    /**
     *
     * @param buffer
     * @param rate
     */
    private static isOutBound(buffer: number[], rate: number) {
        return WaveVad.calcDensity(buffer) <= rate;
    }

    /**
     * return ratio of 1/all
     * @param buffer array of 1|0
     */
    private static calcDensity(buffer: number[]) {
        return buffer.filter(digit => digit > 0).length / buffer.length;
    }

    /**
     * add a fix time span to head of each window
     * @param {VadWindow[]} windows target windows
     * @param {number} leadin leadin time in ms
     * @return {VadWindow[]} windows after leadin added
     */
    private static addLeadIn(windows: VadWindow[], leadin: number) {
        return windows.map((item) => {
            const start = item.start - leadin;
            return {
                start: start < 0 ? 0 : start,
                end: item.end
            }
        });
    }

    /**
     * merge windows by a minimal interval(above which will remains in different segments)
     * @param {VadWindow[]} windows windows
     * @param {number} minInterval interval in ms
     * @return {VadSegment[]} result segments
     */
    private static merge(windows: VadWindow[], minInterval: number) {
        const segments = [];
        for (let i = 0; i < windows.length; i++) {
            const segment = windows[i];
            if (segments.length === 0 || segments[segments.length - 1].end + minInterval < segment.start) {
                segments.push(segment);
            } else {
                segments[segments.length - 1].end = segment.end;
            }
        }
        return segments;
    }

    /**
     * getIsSpeechFromWavFile
     * @param {Buffer} buffer target wave file buffer (assuming a 16bit linear PCM)
     * @param {number} frameLen the tiny unit(by ms) that will detect by WebRTC (cpp)
     * @return {Array} array of IsSpeech
     */
    private async getIsSpeechFromBuffer(buffer: Buffer, frameLen: number): Promise<Array<number>> {
        const waffle: WaveFile = new WaveFile(buffer);
        return await this.getIsSpeech(waffle, frameLen);
    }

    /**
     * getIsSpeechFromWavFile
     * @param {string} wavFile target wave file (assuming a 16bit linear PCM)
     * @param {number} frameLen the tiny unit(by ms) that will detect by WebRTC (cpp)
     * @return {Array} array of IsSpeech
     */
    private async getIsSpeechFromWavFile(wavFile: string, frameLen: number): Promise<Array<number>> {
        const waffle: WaveFile = await new Promise((resolve, reject) => {
            fs.readFile(wavFile, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(new WaveFile(data));
                }
            });
        });
        return await this.getIsSpeech(waffle, frameLen);
    }

    private async getIsSpeech(wav: WaveFile, frameLen: number): Promise<Array<number>> {
        // @ts-ignore
        const sampleRate: number = wav.fmt.sampleRate;
        // @ts-ignore
        const samples: any[] = wav.data.samples;

        const frameStep = sampleRate / 1000 * frameLen * 2;
        // the result of every frame in 1/0
        const res = [];
        for (let index = 0; index < samples.length; index = index + frameStep) {
            const end = Math.min(index + frameStep, samples.length);
            const frame = samples.slice(index, end);
            const result = this._vad.isSpeech(frame, sampleRate);
            res.push(result ? 1 : 0);
        }
        return res;
    }

    private static async getSegmentsOfSpeech(frames: number[], frameLen: number, windowLen: number,
                                     inbound: number = 0.9, outbound: number = 0.1,
                                     leadin: number | null = null, minInterval: number | null = null): Promise<VadResult> {
        const windowFrameCount = windowLen / frameLen;
        let isInbound = false;
        const windows: VadWindow[] = [];
        let segments: VadSegment[] = [];
        for (let i = 0; i < frames.length - windowFrameCount; i++) {
            const segment = frames.slice(i, i + windowFrameCount);
            if (isInbound) {
                if (WaveVad.isOutBound(segment, outbound)) {
                    isInbound = false;
                    windows[windows.length - 1].end = (i + windowFrameCount) * frameLen;
                    // jump to end of window
                    i = i + windowFrameCount;
                }
            } else {
                if (WaveVad.isInBound(segment, inbound)) {
                    isInbound = true;
                    windows.push({
                        start: i * frameLen,
                        end: 0
                    });
                    // jump to end of window
                    i = i + windowFrameCount;
                }
            }
        }
        if (isInbound && windows.length > 0) {
            windows[windows.length - 1].end = frames.length * frameLen;
        }
        if (leadin && minInterval) {
            segments = WaveVad.merge(WaveVad.addLeadIn(windows, leadin), minInterval);
        }
        return {
            frames: frames,
            windows: windows,
            segments: segments
        };
    }

    private async getSplitOfSpeech(frames: number[], frameLen: number, windowLen: number, voiceThreshold: number, leadin: number, minInterval: number, minLength: number): Promise<VadResult> {
        const windowFrameCount = windowLen / frameLen;
        const leadinFrameCount = leadin / frameLen;
        const intervalFrameCount = minInterval / frameLen;
        const minLenFrameCount = minLength / frameLen;
        let lengthOfBlank = 0;
        const splitPoints = [];
        for (let i = 0; i < frames.length - windowFrameCount; i++) {
            const win = frames.slice(i, i + windowFrameCount);
            const out = WaveVad.isOutBound(win, voiceThreshold);
            if (out) {
                lengthOfBlank++;
            } else {
                // out --> in
                if (lengthOfBlank >= intervalFrameCount) {
                    // jump to end of window
                    // ** split point belong to next segment (start point) **
                    // i = i + windowFrameCount;
                    splitPoints.push(i - leadinFrameCount);
                }
                // re-calculate length
                lengthOfBlank = 0;
            }
        }
        const segments: VadSegmentEx[] = [];
        for (let index = 0; index < splitPoints.length; index++) {
            const start = segments.length === 0 ? 0 : segments[segments.length - 1].end;
            if (splitPoints[index] - start >= minLenFrameCount) {
                segments.push({
                    start: start,
                    end: splitPoints[index],
                    density: WaveVad.calcDensity(frames.slice(start, splitPoints[index]))
                });
            }
        }
        if (segments.length > 0) {
            segments.push({
                start: segments[segments.length - 1].end,
                end: frames.length,
                density: WaveVad.calcDensity(frames.slice(segments[segments.length - 1].end))
            });
        } else {
            segments.push({
                start: 0,
                end: frames.length,
                density: WaveVad.calcDensity(frames)
            });
        }
        return {
            frames: frames,
            windows: [],
            segments: segments.map(item => {
                item.start = item.start * frameLen;
                item.end = item.end * frameLen;
                return item;
            })
        }
    }

    private static standardDeviation(values: number[]) {
        const avg = WaveVad.average(values);
        const squareDiffs = values.map((val: number) => {
            const diff = val - avg;
            return diff * diff;
        });
        return Math.sqrt(WaveVad.average(squareDiffs));
    }

    private static average(values: number[]) {
        return values.reduce((sum: number, value: number) => {
            return sum + value;
        }, 0);
    }

    private async getEqualParts(frames: number[], frameLen: number, windowLen: number, voiceThreshold: number, minInterval: number, approxCount: number): Promise<VadResult> {
        const approxSplit = approxCount - 1;
        const windowFrameCount = windowLen / frameLen;
        const intervalFrameCount = minInterval / frameLen;
        let lengthOfBlank = 0;
        const blankPos: BlankPosition[] = [];
        const getSegments = (splitPos: BlankPosition[]) => {
            const segments = [];
            let start = 0;
            for (let i = 0; i < splitPos.length; i++) {
                const end = splitPos[i].start + (splitPos[i].length / 2);
                segments.push({
                    start: start * frameLen,
                    end: end * frameLen
                });
                start = end;
            }
            segments.push({
                start: start * frameLen,
                end: frames.length * frameLen
            });
            return segments;
        };
        const pickSubSet = (origin: any[], start: number, depth: number): any[] => {
            // pick 1 element each time and combine with next depth (until depth = 0)
            if (depth > 0) {
                let combined = [];
                for (let i = start; i <= origin.length - depth - 1; i++) {
                    const below = pickSubSet(origin, i + 1, depth - 1);
                    for (let j = 0; j < below.length; j++) {
                        combined.push([origin[i], ...below[j]]);
                    }
                }
                return combined;
            } else {
                return origin.map(item => [item]);
            }
        };

        for (let i = 0; i < frames.length - windowFrameCount; i++) {
            const win = frames.slice(i, i + windowFrameCount);
            const out = WaveVad.isOutBound(win, voiceThreshold);
            if (out) {
                lengthOfBlank++;
            } else {
                // out --> in
                if (lengthOfBlank >= intervalFrameCount) {
                    // jump to end of window
                    // ** split point belong to next segment (start point) **
                    blankPos.push({
                        start: i - lengthOfBlank,
                        length: lengthOfBlank
                    });
                    i = i + windowFrameCount;
                }
                // re-calculate length
                lengthOfBlank = 0;
            }
        }
        if (approxSplit >= blankPos.length) {
            return {
                frames: frames,
                windows: [],
                segments: getSegments(blankPos)
            }
        } else {
            blankPos.sort((a: any, b: any) => b.length - a.length);
            const selectedPos = JSON.parse(JSON.stringify(blankPos.slice(0, Math.min(approxSplit * 2, blankPos.length))));
            const allCombines: BlankPosition[][] = pickSubSet(selectedPos, 0, approxSplit - 1);
            let bestStd = Number.MAX_VALUE;
            let best: VadSegment[] = [];
            allCombines.forEach(item => {
                const segments: VadSegment[] = getSegments(item.sort((a, b) => a.start - b.start));
                const std = WaveVad.standardDeviation(segments.map(seg => seg.end - seg.start));
                if (bestStd > std) {
                    best = segments;
                    bestStd = std;
                }
            });
            return {
                frames: frames,
                windows: [],
                segments: best
            }
        }
    }

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
    public async getSegmentsFromFile(wavFile: string, frameLen: number, windowLen: number,
                                     inbound: number = 0.9, outbound: number = 0.1,
                                     leadin: number | null = null, minInterval: number | null = null): Promise<VadResult> {
        const res = await this.getIsSpeechFromWavFile(wavFile, frameLen);
        return await WaveVad.getSegmentsOfSpeech(res, frameLen, windowLen, inbound, outbound, leadin, minInterval);
    }

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
    public async getSegmentsFromBuffer(buffer: Buffer, frameLen: number, windowLen: number,
                                     inbound: number = 0.9, outbound: number = 0.1,
                                     leadin: number | null = null, minInterval: number | null = null): Promise<VadResult> {
        const res = await this.getIsSpeechFromBuffer(buffer, frameLen);
        return await WaveVad.getSegmentsOfSpeech(res, frameLen, windowLen, inbound, outbound, leadin, minInterval);
    }

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
    public async getSplitFromFile(wavFile: string, frameLen: number, windowLen: number, voiceThreshold: number, leadin: number, minInterval: number, minLength: number): Promise<VadResult> {
        const frames = await this.getIsSpeechFromWavFile(wavFile, frameLen);
        return this.getSplitOfSpeech(frames, frameLen, windowLen, voiceThreshold, leadin, minInterval, minLength);
    }

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
    public async getSplitFromBuffer(buffer: Buffer, frameLen: number, windowLen: number, voiceThreshold: number, leadin: number, minInterval: number, minLength: number): Promise<VadResult> {
        const frames = await this.getIsSpeechFromBuffer(buffer, frameLen);
        return this.getSplitOfSpeech(frames, frameLen, windowLen, voiceThreshold, leadin, minInterval, minLength);
    }

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
    public async getEqualPartsFromFile(wavFile: string, frameLen: number, windowLen: number, voiceThreshold: number, minInterval: number, approxCount: number): Promise<VadResult> {
        const frames = await this.getIsSpeechFromWavFile(wavFile, frameLen);
        return this.getEqualParts(frames, frameLen, windowLen, voiceThreshold, minInterval, approxCount);
    }

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
    public async getEqualPartsFromBuffer(buffer: Buffer, frameLen: number, windowLen: number, voiceThreshold: number, minInterval: number, approxCount: number): Promise<VadResult> {
        const frames = await this.getIsSpeechFromBuffer(buffer, frameLen);
        return this.getEqualParts(frames, frameLen, windowLen, voiceThreshold, minInterval, approxCount);
    }

}
