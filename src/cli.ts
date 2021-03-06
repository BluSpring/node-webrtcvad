#!/usr/bin/env node
import {WaveVad} from "./WaveVad";
import fs from 'fs';
import path from 'path';

/*
argv[2]: file path [must]
argv[3]: aggressiveness ( 0|1|2|3|4 ) [must]
argv[4]: frame length ( 10 | 20 | 30 ) [option]
argv[5]: padding length (default = 300) [option]
argv[6]: inbound rate (default = 0.9) [option]
argv[7]: outbound rate (default = 0.1) [option]
*/

if (!process.argv[2]) {
    console.log();
    console.log('usage: node-webrtcvad <your-wave-file-path>');
    console.log();
} else {
    if (!fs.existsSync(process.argv[2])) {
        console.log();
        console.error('file: ' + process.argv[2] + ' not exist.');
        console.log();
    } else {
        const agg = process.argv[3] ? parseInt(process.argv[3]) : 3;
        const waveVad = new WaveVad(agg);
        const frameLen = process.argv[4] ? parseInt(process.argv[4]) : 30;
        const paddingLen = process.argv[5] ? parseInt(process.argv[5]) : 300;
        const ib = process.argv[6] ? parseFloat(process.argv[6]) : 0.9;
        const ob = process.argv[7] ? parseFloat(process.argv[7]) : 0.1;
        const li = process.argv[8] ? parseFloat(process.argv[8]) : 200;
        const mi = process.argv[9] ? parseFloat(process.argv[9]) : 500;
        waveVad.getSegmentsFromFile(process.argv[2], frameLen, paddingLen, ib, ob, li, mi).then((segments: any) => {
            console.log();
            console.log('processing file: ' + process.argv[2]);
            const ext = path.extname(process.argv[2]);
            const filename = process.argv[2].substring(0, process.argv[2].length - ext.length) + `-${agg}-${frameLen}-${paddingLen}-${ib * 100}-${ob * 100}.txt`;
            const content = JSON.stringify(segments);
            console.log('writing result to ' + filename);
            fs.writeFileSync(filename, content);
            console.log('done.');
            console.log();
        });
    }
}