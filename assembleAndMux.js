import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const runFFmpegCommand = promisify(exec);

// Utility function to sanitize file names
function sanitizeFileName(name) {
    return name.replace(/[<>:"/\\|?*=\s]/g, '_');
}

// Generate silent audio buffer for given duration in ms
function generateSilentAudioFrame(durationMs) {
    const samples = Math.floor(16000 * durationMs / 1000);
    return Buffer.alloc(samples * 2, 0); // 16-bit PCM, mono
}

export async function assembleAndMux(meetingUuid) {
    const safeMeetingUuid = sanitizeFileName(meetingUuid);
    const folderPath = path.join('recordings', safeMeetingUuid);

    if (!fs.existsSync(folderPath)) {
        console.error(`❌ Meeting folder does not exist: ${folderPath}`);
        return;
    }

    const audioDir = path.join(folderPath, 'raw', 'audio');
    const videoDir = path.join(folderPath, 'raw', 'video');

    if (!fs.existsSync(audioDir) || !fs.existsSync(videoDir)) {
        console.error(`❌ Raw audio or video directories missing in ${folderPath}`);
        return;
    }

    // Collect audio files
    const audioFilesTmp = fs.readdirSync(audioDir)
        .map(file => {
            if (!file.endsWith('.raw')) return null;
            const fileName = file.replace('.raw', '');
            const parts = fileName.split('_');
            const timestamp = Number(parts[parts.length - 1]);
            const filePath = path.join(audioDir, file);
            return { timestamp, filePath };
        })
        .filter(Boolean);

    // Collect video files
    const videoFilesTmp = fs.readdirSync(videoDir)
        .map(file => {
            if (!file.endsWith('.h264')) return null;
            const fileName = file.replace('.h264', '');
            const parts = fileName.split('_');
            const timestamp = Number(parts[parts.length - 1]);
            const filePath = path.join(videoDir, file);
            return { timestamp, filePath };
        })
        .filter(Boolean);

    // Find earliest timestamp
    const allTs = [...audioFilesTmp, ...videoFilesTmp].map(f => f.timestamp);
    if (allTs.length === 0) {
        console.error('No files to assemble');
        return;
    }
    const minTs = Math.min(...allTs);

    // Normalize timestamps and sort
    const audioFiles = audioFilesTmp.map(f => ({ ...f, timestamp: f.timestamp - minTs })).sort((a, b) => a.timestamp - b.timestamp);
    const videoFiles = videoFilesTmp.map(f => ({ ...f, timestamp: f.timestamp - minTs })).sort((a, b) => a.timestamp - b.timestamp);

    // Assemble audio
    const assembledDir = path.join(folderPath, 'assembled');
    if (!fs.existsSync(assembledDir)) fs.mkdirSync(assembledDir);
    const assembledAudioPath = path.join(assembledDir, 'assembled_audio.raw');
    const audioStream = fs.createWriteStream(assembledAudioPath);
    let lastTsAudio = null;

    for (const item of audioFiles) {
        if (lastTsAudio !== null && item.timestamp - lastTsAudio > 100) {
            const timeDiff = item.timestamp - lastTsAudio;
            const silent = generateSilentAudioFrame(timeDiff);
            audioStream.write(silent);
        }
        const buffer = fs.readFileSync(item.filePath);
        audioStream.write(buffer);
        lastTsAudio = item.timestamp;
    }
    audioStream.end();

    // Assemble video (prepend SPS/PPS, insert black frames for gaps)
    const assembledVideoPath = path.join(assembledDir, 'assembled_video.h264');
    const videoStream = fs.createWriteStream(assembledVideoPath);
    const spsHeader = fs.readFileSync('sps_pps_keyframe.h264');
    videoStream.write(spsHeader);
    const blackFrame = fs.readFileSync('black_frame.h264');
    let lastTsVideo = null;

    for (const item of videoFiles) {
        if (lastTsVideo !== null && item.timestamp - lastTsVideo > 500) {
            const timeDiff = item.timestamp - lastTsVideo;
            const numBlacks = Math.floor(timeDiff / 40);
            for (let i = 0; i < numBlacks; i++) {
                videoStream.write(blackFrame);
            }
        }
        const buffer = fs.readFileSync(item.filePath);
        videoStream.write(buffer);
        lastTsVideo = item.timestamp;
    }
    videoStream.end();

    // Wait for writers to finish (simple flush)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Calculate trim offsets to cut to fit (make both start at the same time)
    const audioMinTs = audioFilesTmp.length > 0 ? Math.min(...audioFilesTmp.map(f => f.timestamp)) : Infinity;
    const videoMinTs = videoFilesTmp.length > 0 ? Math.min(...videoFilesTmp.map(f => f.timestamp)) : Infinity;
    const trimAudioOffset = videoMinTs > audioMinTs ? (videoMinTs - audioMinTs) : 0; // in ms
    const trimVideoOffset = audioMinTs > videoMinTs ? (audioMinTs - videoMinTs) : 0;

    // Convert to intermediate formats
    const convertedAudioPath = path.join(assembledDir, 'assembled_audio.wav');
    const convertedVideoPath = path.join(assembledDir, 'assembled_video.mp4');
    const finalOutputPath = path.join(folderPath, 'final_output_new.mkv');

    console.log(`🔄 Converting assembled_audio.raw to WAV`);
    try {
      await runFFmpegCommand(`ffmpeg -f s16le -ar 16000 -ac 1 -i "${assembledAudioPath}" "${convertedAudioPath}"`);
    } catch (error) {
      console.error('❌ Error converting audio:', error.message);
    }

    console.log(`🔄 Converting assembled_video.h264 to MP4`);
    try {
      await runFFmpegCommand(`ffmpeg -framerate 25 -i "${assembledVideoPath}" -r 25 -c:v copy -avoid_negative_ts make_zero "${convertedVideoPath}"`);
    } catch (error) {
      console.error('❌ Error converting video:', error.message);
    }

    // Calculate offset for microadjustment to sync (delay later stream, don't truncate)
    const offsetSecAudio = trimVideoOffset / 1000;
    const offsetSecVideo = trimAudioOffset / 1000;
    let muxCommand = `ffmpeg`;
    if (offsetSecAudio > 0) {
        muxCommand += ` -itsoffset ${offsetSecAudio.toFixed(3)}`;
    }
    muxCommand += ` -i "${convertedAudioPath}"`;
    if (offsetSecVideo > 0) {
        muxCommand += ` -itsoffset ${offsetSecVideo.toFixed(3)}`;
    }
    muxCommand += ` -i "${convertedVideoPath}" -c copy "${finalOutputPath}"`;

    console.log(`🎥 Muxing to final_output.mkv with sync offsets: audio ${offsetSecAudio}s, video ${offsetSecVideo}s`);
    try {
      await runFFmpegCommand(muxCommand);
    } catch (error) {
      console.error('❌ Error muxing:', error.message);
    }

    console.log(`✅ Assembly and muxing complete: ${finalOutputPath}`);
}
