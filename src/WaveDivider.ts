import {WaveVad, VadResult} from './index';
import WaveFile from 'wavefile';

export class WaveDivider{

    /**
     * divide wav file into multi parts, by setting of options
     * @param {Buffer} audio wave (.wav) file buffer
     * @param {VADOptions} options options
     * @return {Promise<BufferResult[]>} result
     */
    public static async divideBuffer(audio: Buffer, options: VADOptions): Promise<BufferResult[]> {
        let vadResult: VadResult;
        const waveVad = new WaveVad(options.aggressiveness);
        switch (options.mode) {
            case VADMode.MIN_LENGTH_NO_TRIM:
                vadResult = await waveVad.getSplitFromBuffer(audio, options.frameLen, options.windowLen, options.triggerOut, options.leadIn, options.minInterval, options.minLen);
                break;
            case VADMode.MIN_LENGTH_TRIM:
                vadResult = await waveVad.getSegmentsFromBuffer(audio, options.frameLen, options.windowLen, options.triggerIn, options.triggerOut, options.leadIn, options.minInterval);
                break;
            case VADMode.EQUAL_PARTS:
                // fall through
            default:
                vadResult = await waveVad.getEqualPartsFromBuffer(audio, options.frameLen, options.windowLen, options.triggerOut, options.minInterval, options.parts);
                break;
        }
        let audioSegments = WaveDivider.groupSpans(vadResult.segments, options.minLen);
        return await WaveDivider.splitBySpanGroups(audio, audioSegments);
    }

    private static groupSpans(segments: TimeSpan[], minLength: number): TimeSpan[][] {
        const groups: TimeSpan[][] = [];
        let length = 0;
        for (let i = 0; i < segments.length; i++) {
            if (groups.length === 0 || length >= minLength) {
                groups.push([segments[i]]);
                length = segments[i].end - segments[i].start;
            } else {
                groups[groups.length - 1].push(segments[i]);
                length += segments[i].end - segments[i].start;
            }
        }
        return groups.map(grp => WaveDivider.mergeConnectedSpans(grp));
    }

    private static mergeConnectedSpans(spans: TimeSpan[]): TimeSpan[] {
        for (let index = spans.length - 1; index > 0; index--) {
            if (spans[index].start === spans[index - 1].end) {
                spans[index - 1].end = spans[index].end;
                spans.splice(index, 1);
            }
        }
        return spans;
    }

    private static async splitBySpanGroups(buffer: Buffer, segmentInfo: TimeSpan[][]): Promise<BufferResult[]> {
        let wav = new WaveFile(buffer);
        // assuming as mono and linear PCM wav
        // @ts-ignore
        if (wav.fmt.numChannels > 1 || wav.fmt.audioFormat !== 1) {
            throw 'not a linear PCM mono wav'
        }
        // @ts-ignore
        const sampleLength = wav.fmt.bitsPerSample / 8;
        // @ts-ignore
        const loopCnt = wav.data.chunkSize / sampleLength;
        // {span: <input-span-info>, buf: <buffer-of-new-wav-segment>}

        const allBuffer: {[key: string]: BufferSpan} = {};
        for (let i = 0; i < segmentInfo.length; i++) {
            for (let j = 0; j < segmentInfo[i].length; j++) {
                const key = segmentInfo[i][j].start + '_' + segmentInfo[i][j].end;
                allBuffer[key] = allBuffer[key] || {
                    start: segmentInfo[i][j].start,
                    end: segmentInfo[i][j].end,
                    buf: []
                };
            }
        }
        // const t0 = new Date();
        const indexOfBuf = Object.values(allBuffer);
        indexOfBuf.sort((a, b) => a.start - b.start);
        let current = 0;
        let currentSpan = indexOfBuf[current];
        for (let i = 0; i < loopCnt; i++) {
            // sample rate / 1000 and then get the ms
            // @ts-ignore
            const time = i / (wav.fmt.sampleRate / 1000);
            if (time >= currentSpan.start) {
                if (time < currentSpan.end) {
                    currentSpan.buf.push(wav.getSample(i));
                } else if (current < indexOfBuf.length - 1) {
                    current++;
                    currentSpan = indexOfBuf[current];
                    if (time >= currentSpan.start) {
                        currentSpan.buf.push(wav.getSample(i));
                    }
                }
            }
        }
        // console.log('find span cost: ' + (new Date() - t0));
        const concatBuffer: BufferSpan[] = [];
        for (let m = 0; m < segmentInfo.length; m++) {
            let buf: Array<number> = [];
            for (let n = 0; n < segmentInfo[m].length; n++) {
                const payload = indexOfBuf.find((item) => {
                    return item.start === segmentInfo[m][n].start
                        && item.end === segmentInfo[m][n].end;
                }) || {buf : []};
                buf = buf.concat(payload.buf);
            }
            concatBuffer.push({
                start: segmentInfo[m][0].start,
                end: segmentInfo[m][segmentInfo[m].length - 1].end,
                buf: buf
            });
        }
        const output: BufferResult[] = [];
        for (let i = 0; i < concatBuffer.length; i++) {
            await new Promise((resolve) => {
                const segment = new WaveFile();
                // @ts-ignore
                segment.fromScratch(1, wav.fmt.sampleRate, wav.bitDepth, concatBuffer[i].buf);
                output.push({
                    start: concatBuffer[i].start,
                    end: concatBuffer[i].end,
                    buffer: Buffer.from(segment.toBuffer())
                });
                resolve('text in here is useless but required cuz thanks typescript');
            });
        }
        return output;
    }
}

export interface VADOptions {
    aggressiveness : number
    frameLen : number
    windowLen : number
    triggerIn : number
    triggerOut : number
    leadIn : number
    minInterval : number
    mode : VADMode
    parts: number
    minLen : number
}

export enum VADMode {
    MIN_LENGTH_TRIM = 'MIN_LENGTH_TRIM',
    MIN_LENGTH_NO_TRIM = 'MIN_LENGTH_NO_TRIM',
    EQUAL_PARTS = 'EQUAL_PARTS',
}

interface TimeSpan {
    start: number
    end: number
}

interface BufferSpan {
    start: number
    end: number
    buf: Array<number>
}

interface BufferResult {
    start: number
    end: number
    buffer: Buffer
}
