# node-webrtcvad

A nodejs interface to the WebRTC Voice Activity Detector(VAD).

A [VAD](https://en.wikipedia.org/wiki/Voice_activity_detection)
classifies a piece of audio data as being voiced or unvoiced. It can
be useful for telephony and speech recognition.

The VAD that Google developed for the [WebRTC](https://webrtc.org/)
project is reportedly one of the best available, being fast, modern
and free.

## 0. Install

    npm install node-webrtcvad

## 1. Import

    import {WaveVad} from 'node-webrtcvad';

## 2. Set aggressiveness mode while create the instance.

   between 0 and 4.
   0 is the least aggressive about filtering out non-speech, 4 is the most aggressive. (added in 0.1.0)

    const vad = new WaveVad(3);

## 3. Get the result.

    const segments = await vad.getSegmentsFromFile("leak-test.wav", 30, 300);

output should be like this (changed in 0.1.3)

    {
        frames: [1,0,0,0,1,1,1...],
        windows: [
            { start: 510, end: 4260 },
            { start: 4290, end: 7860 }
            ...
        ]
        segments: [
            { start: 510, end: 4260 },
            { start: 4290, end: 7860 }
            ...
        ]
    }
each number in array "frames" represent 0: not speech, 1: speech.

each {start, end} in array "windows" represent the speech windows after triggerIn and triggerOut applied.

each {start, end} in array "segments" represent the segments which after leadin and minInterval applied.

## 4. CLI supported

You can install with -g to have a command to save vsd result to a text file

    npm install -g node-webrtcvad

    node-webrtcvad <wav-file.wav> <aggresiveness>

and the result of vad (a string of json) will be saved as a text file.
