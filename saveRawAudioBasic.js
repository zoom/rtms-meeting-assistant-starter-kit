import fs from 'fs';
import path from 'path';

// Utility function to sanitize file names
function sanitizeFileName(name) {
    if (name === null || name === undefined) return 'unknown';
    return String(name).replace(/[<>:"/\\|?*=\s]/g, '_');
}

export function saveRawAudio(chunk, meetingUuid, user_id, timestamp) {
    const safeMeetingUuid = sanitizeFileName(meetingUuid);
    const dir = path.join('recordings', safeMeetingUuid, 'raw', 'audio');

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const safeUserId = sanitizeFileName(user_id);
    const fileName = `audio_${safeUserId}_${timestamp}.raw`;
    const filePath = path.join(dir, fileName);

    fs.writeFileSync(filePath, chunk);
}
