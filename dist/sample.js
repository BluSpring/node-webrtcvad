"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const waveVad = new index_1.WaveVad(3);
// frameLen: the tiny unit that will detect by WebRTC (cpp).
// paddingLen: the unit time span that will be put together then apply some algorithm (such as >90% = in, <10% = out)
waveVad.getSegmentsFromFile("leak-test.wav", 30, 300, 0.9, 0.1).then((segments) => {
    console.log(segments);
});
// output should be
// [ { start: 510, end: 4260 }, { start: 4290, end: 7860 } ]
