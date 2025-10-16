import fs from 'fs';
import path from 'path';

// Utility function to sanitize file names
function sanitizeFileName(name) {
    if (name === null || name === undefined) return 'default-view';
    return String(name).replace(/[<>:"/\\|?*=\s]/g, '_');
}

export function saveRawVideo(buffer, userName, meetingUuid, timestamp) {
    const safeUserName = sanitizeFileName(userName);
    const safeMeetingUuid = sanitizeFileName(meetingUuid);
    const dir = path.join('recordings', safeMeetingUuid, 'raw', 'video');

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const fileName = `video_${safeUserName}_${timestamp}.h264`;
    const filePath = path.join(dir, fileName);

    fs.writeFileSync(filePath, buffer);
}
