import path from "node:path";
export function inferMimeType(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    if (extension === ".jpg" || extension === ".jpeg")
        return "image/jpeg";
    if (extension === ".png")
        return "image/png";
    if (extension === ".webp")
        return "image/webp";
    if (extension === ".gif")
        return "image/gif";
    if (extension === ".mp4" || extension === ".m4v")
        return "video/mp4";
    if (extension === ".mov")
        return "video/quicktime";
    if (extension === ".webm")
        return "video/webm";
    if (extension === ".srt")
        return "application/x-subrip";
    if (extension === ".vtt")
        return "text/vtt";
    return "application/octet-stream";
}
