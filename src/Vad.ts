const addon = require('../build/Release/nodewebrtcvad');

export class Vad{
    private readonly _vad: any;
    constructor(mode: number) {
        this._vad = addon.create();
        addon.init(this._vad);
        addon.set_mode(this._vad, mode);
    }

    public setMode(mode: number) {
        addon.set_mode(this._vad, mode);
    }

    public isSpeech(buf: Array<number>, sampleRate: number, length: number = 0) {
        const len = length || (buf.length / 2);
        if (len * 2 > buf.length) {
            throw `buffer hs ${buf.length} frames, but length argument was ${len}`;
        }
        return addon.process(this._vad, sampleRate, buf, len);
    }

    public isValidRateAndFrameLength(rate: number, frameLength:number) {
        return addon.valid_rate_and_frame_length(this._vad, rate, frameLength);
    }
}
