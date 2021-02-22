"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Vad = void 0;
const addon = require('../build/Release/nodewebrtcvad');
class Vad {
    constructor(mode) {
        this._vad = addon.create();
        addon.init(this._vad);
        addon.set_mode(this._vad, mode);
    }
    setMode(mode) {
        addon.set_mode(this._vad, mode);
    }
    isSpeech(buf, sampleRate, length = 0) {
        const len = length || (buf.length / 2);
        if (len * 2 > buf.length) {
            throw `buffer hs ${buf.length} frames, but length argument was ${len}`;
        }
        return addon.process(this._vad, sampleRate, buf, len);
    }
    isValidRateAndFrameLength(rate, frameLength) {
        return addon.valid_rate_and_frame_length(this._vad, rate, frameLength);
    }
}
exports.Vad = Vad;
