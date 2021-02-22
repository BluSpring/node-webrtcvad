"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const events_1 = require("events");
const AGGRESSIVENESS = 3;
class VadSession {
    constructor() {
        if (!VadSession._vad) {
            VadSession._vad = new index_1.Vad(AGGRESSIVENESS);
        }
    }
    static create(identity) {
        return new events_1.EventEmitter();
    }
}
exports.VadSession = VadSession;
