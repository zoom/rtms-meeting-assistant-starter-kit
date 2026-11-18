import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { sanitizeFileName } from './tool.js';

// argv-array execution: no shell, so no injection surface
const runFFmpeg = promisify(execFile);

// Asynchronous function to convert meeting media files
export async function convertMeetingMedia(streamId) {
  const safeStreamId = sanitizeFileName(streamId);

  const folderPath = path.join('recordings', safeStreamId);

  if (!fs.existsSync(folderPath)) {
    console.error(`❌ Meeting folder does not exist: ${folderPath}`);
    return;
  }

  const files = fs.readdirSync(folderPath);

  for (const file of files) {
    const fullPath = path.join(folderPath, file);

    if (file.endsWith('.raw')) {
      // Convert raw PCM to WAV
      const outputWav = fullPath.replace('.raw', '.wav');
      const args = ['-f', 's16le', '-ar', '16000', '-ac', '1', '-i', fullPath, '-y', outputWav];

      console.log(`🎵 Converting audio: ${file} -> ${path.basename(outputWav)}`);
      try {
        await runFFmpeg('ffmpeg', args);
      } catch (error) {
        console.error('❌ Error converting audio:', error.message);
      }
    }

    if (file.endsWith('.h264')) {
      // Convert H264 to MP4
      const outputMp4 = fullPath.replace('.h264', '.mp4');
      const args = ['-framerate', '25', '-i', fullPath, '-c:v', 'copy', '-y', outputMp4];

      console.log(`🎥 Converting video: ${file} -> ${path.basename(outputMp4)}`);
      try {
        await runFFmpeg('ffmpeg', args);
      } catch (error) {
        console.error('❌ Error converting video:', error.message);
      }
    }
  }

  console.log(`🎯 All media converted for stream ${streamId}`);
}
