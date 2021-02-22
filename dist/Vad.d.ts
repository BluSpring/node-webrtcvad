export declare class Vad {
    private readonly _vad;
    constructor(mode: number);
    setMode(mode: number): void;
    isSpeech(buf: Array<number>, sampleRate: number, length?: number): any;
    isValidRateAndFrameLength(rate: number, frameLength: number): any;
}
