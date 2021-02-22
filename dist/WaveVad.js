"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaveVad = void 0;
const index_1 = require("./index");
const wavefile_1 = __importDefault(require("wavefile"));
const fs_1 = __importDefault(require("fs"));
class WaveVad {
    constructor(mode) {
        this._vad = new index_1.Vad(mode);
    }
    /**
     *
     * @param buffer
     * @param rate
     */
    static isInBound(buffer, rate) {
        return WaveVad.calcDensity(buffer) >= rate;
    }
    /**
     *
     * @param buffer
     * @param rate
     */
    static isOutBound(buffer, rate) {
        return WaveVad.calcDensity(buffer) <= rate;
    }
    /**
     * return ratio of 1/all
     * @param buffer array of 1|0
     */
    static calcDensity(buffer) {
        return buffer.filter(digit => digit > 0).length / buffer.length;
    }
    /**
     * add a fix time span to head of each window
     * @param {VadWindow[]} windows target windows
     * @param {number} leadin leadin time in ms
     * @return {VadWindow[]} windows after leadin added
     */
    static addLeadIn(windows, leadin) {
        return windows.map((item) => {
            const start = item.start - leadin;
            return {
                start: start < 0 ? 0 : start,
                end: item.end
            };
        });
    }
    /**
     * merge windows by a minimal interval(above which will remains in different segments)
     * @param {VadWindow[]} windows windows
     * @param {number} minInterval interval in ms
     * @return {VadSegment[]} result segments
     */
    static merge(windows, minInterval) {
        const segments = [];
        for (let i = 0; i < windows.length; i++) {
            const segment = windows[i];
            if (segments.length === 0 || segments[segments.length - 1].end + minInterval < segment.start) {
                segments.push(segment);
            }
            else {
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
    getIsSpeechFromBuffer(buffer, frameLen) {
        return __awaiter(this, void 0, void 0, function* () {
            const waffle = new wavefile_1.default(buffer);
            return yield this.getIsSpeech(waffle, frameLen);
        });
    }
    /**
     * getIsSpeechFromWavFile
     * @param {string} wavFile target wave file (assuming a 16bit linear PCM)
     * @param {number} frameLen the tiny unit(by ms) that will detect by WebRTC (cpp)
     * @return {Array} array of IsSpeech
     */
    getIsSpeechFromWavFile(wavFile, frameLen) {
        return __awaiter(this, void 0, void 0, function* () {
            const waffle = yield new Promise((resolve, reject) => {
                fs_1.default.readFile(wavFile, (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(new wavefile_1.default(data));
                    }
                });
            });
            return yield this.getIsSpeech(waffle, frameLen);
        });
    }
    getIsSpeech(wav, frameLen) {
        return __awaiter(this, void 0, void 0, function* () {
            // @ts-ignore
            const sampleRate = wav.fmt.sampleRate;
            // @ts-ignore
            const samples = wav.data.samples;
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
        });
    }
    static getSegmentsOfSpeech(frames, frameLen, windowLen, inbound = 0.9, outbound = 0.1, leadin = null, minInterval = null) {
        return __awaiter(this, void 0, void 0, function* () {
            const windowFrameCount = windowLen / frameLen;
            let isInbound = false;
            const windows = [];
            let segments = [];
            for (let i = 0; i < frames.length - windowFrameCount; i++) {
                const segment = frames.slice(i, i + windowFrameCount);
                if (isInbound) {
                    if (WaveVad.isOutBound(segment, outbound)) {
                        isInbound = false;
                        windows[windows.length - 1].end = (i + windowFrameCount) * frameLen;
                        // jump to end of window
                        i = i + windowFrameCount;
                    }
                }
                else {
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
        });
    }
    getSplitOfSpeech(frames, frameLen, windowLen, voiceThreshold, leadin, minInterval, minLength) {
        return __awaiter(this, void 0, void 0, function* () {
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
                }
                else {
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
            const segments = [];
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
            }
            else {
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
            };
        });
    }
    static standardDeviation(values) {
        const avg = WaveVad.average(values);
        const squareDiffs = values.map((val) => {
            const diff = val - avg;
            return diff * diff;
        });
        return Math.sqrt(WaveVad.average(squareDiffs));
    }
    static average(values) {
        return values.reduce((sum, value) => {
            return sum + value;
        }, 0);
    }
    getEqualParts(frames, frameLen, windowLen, voiceThreshold, minInterval, approxCount) {
        return __awaiter(this, void 0, void 0, function* () {
            const approxSplit = approxCount - 1;
            const windowFrameCount = windowLen / frameLen;
            const intervalFrameCount = minInterval / frameLen;
            let lengthOfBlank = 0;
            const blankPos = [];
            const getSegments = (splitPos) => {
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
            const pickSubSet = (origin, start, depth) => {
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
                }
                else {
                    return origin.map(item => [item]);
                }
            };
            for (let i = 0; i < frames.length - windowFrameCount; i++) {
                const win = frames.slice(i, i + windowFrameCount);
                const out = WaveVad.isOutBound(win, voiceThreshold);
                if (out) {
                    lengthOfBlank++;
                }
                else {
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
                };
            }
            else {
                blankPos.sort((a, b) => b.length - a.length);
                const selectedPos = JSON.parse(JSON.stringify(blankPos.slice(0, Math.min(approxSplit * 2, blankPos.length))));
                const allCombines = pickSubSet(selectedPos, 0, approxSplit - 1);
                let bestStd = Number.MAX_VALUE;
                let best = [];
                allCombines.forEach(item => {
                    const segments = getSegments(item.sort((a, b) => a.start - b.start));
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
                };
            }
        });
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
    getSegmentsFromFile(wavFile, frameLen, windowLen, inbound = 0.9, outbound = 0.1, leadin = null, minInterval = null) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.getIsSpeechFromWavFile(wavFile, frameLen);
            return yield WaveVad.getSegmentsOfSpeech(res, frameLen, windowLen, inbound, outbound, leadin, minInterval);
        });
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
    getSegmentsFromBuffer(buffer, frameLen, windowLen, inbound = 0.9, outbound = 0.1, leadin = null, minInterval = null) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.getIsSpeechFromBuffer(buffer, frameLen);
            return yield WaveVad.getSegmentsOfSpeech(res, frameLen, windowLen, inbound, outbound, leadin, minInterval);
        });
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
    getSplitFromFile(wavFile, frameLen, windowLen, voiceThreshold, leadin, minInterval, minLength) {
        return __awaiter(this, void 0, void 0, function* () {
            const frames = yield this.getIsSpeechFromWavFile(wavFile, frameLen);
            return this.getSplitOfSpeech(frames, frameLen, windowLen, voiceThreshold, leadin, minInterval, minLength);
        });
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
    getSplitFromBuffer(buffer, frameLen, windowLen, voiceThreshold, leadin, minInterval, minLength) {
        return __awaiter(this, void 0, void 0, function* () {
            const frames = yield this.getIsSpeechFromBuffer(buffer, frameLen);
            return this.getSplitOfSpeech(frames, frameLen, windowLen, voiceThreshold, leadin, minInterval, minLength);
        });
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
    getEqualPartsFromFile(wavFile, frameLen, windowLen, voiceThreshold, minInterval, approxCount) {
        return __awaiter(this, void 0, void 0, function* () {
            const frames = yield this.getIsSpeechFromWavFile(wavFile, frameLen);
            return this.getEqualParts(frames, frameLen, windowLen, voiceThreshold, minInterval, approxCount);
        });
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
    getEqualPartsFromBuffer(buffer, frameLen, windowLen, voiceThreshold, minInterval, approxCount) {
        return __awaiter(this, void 0, void 0, function* () {
            const frames = yield this.getIsSpeechFromBuffer(buffer, frameLen);
            return this.getEqualParts(frames, frameLen, windowLen, voiceThreshold, minInterval, approxCount);
        });
    }
}
exports.WaveVad = WaveVad;
