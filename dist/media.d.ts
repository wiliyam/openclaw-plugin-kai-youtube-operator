import type { AudioMixMode, GeneratedAudioStyle, JsonObject, ShortAspect, ShortFit } from "./types.js";
export declare function buildShortCreateArgs(params: {
    inputPath: string;
    outputPath: string;
    startTime?: string;
    durationSeconds?: number;
    aspect?: ShortAspect;
    fit?: ShortFit;
    topText?: string;
    bottomText?: string;
    fontFile?: string;
    captionFilePath?: string;
    crf?: number;
    preset?: string;
    overwrite?: boolean;
    removeAudio?: boolean;
}): string[];
export declare function buildThumbnailExtractArgs(params: {
    inputPath: string;
    outputPath: string;
    time?: string;
    width?: number;
    height?: number;
    overwrite?: boolean;
}): string[];
export declare function probeVideo(filePath: string): Promise<JsonObject>;
export declare function createShortFromVideo(params: {
    inputPath: string;
    outputPath: string;
    startTime?: string;
    durationSeconds?: number;
    aspect?: ShortAspect;
    fit?: ShortFit;
    topText?: string;
    bottomText?: string;
    fontFile?: string;
    captionFilePath?: string;
    crf?: number;
    preset?: string;
    overwrite?: boolean;
    removeAudio?: boolean;
}): Promise<{
    inputPath: string;
    outputPath: string;
    bytes: number;
    durationSeconds: number;
    aspect: ShortAspect;
    fit: ShortFit;
    ffmpeg: {
        command: string;
        args: string[];
        stderr: string;
    };
}>;
export declare function extractThumbnail(params: {
    inputPath: string;
    outputPath: string;
    time?: string;
    width?: number;
    height?: number;
    overwrite?: boolean;
}): Promise<{
    inputPath: string;
    outputPath: string;
    bytes: number;
    time: string;
    ffmpeg: {
        command: string;
        args: string[];
        stderr: string;
    };
}>;
export declare function defaultShortOutputPath(inputPath: string): string;
export declare function buildThumbnailGenerateArgs(params: {
    outputPath: string;
    inputPath?: string;
    time?: string;
    width?: number;
    height?: number;
    title?: string;
    subtitle?: string;
    badge?: string;
    backgroundColor?: string;
    fontFile?: string;
    overwrite?: boolean;
}): string[];
export declare function generateThumbnailCard(params: {
    outputPath: string;
    inputPath?: string;
    time?: string;
    width?: number;
    height?: number;
    title?: string;
    subtitle?: string;
    badge?: string;
    backgroundColor?: string;
    fontFile?: string;
    overwrite?: boolean;
}): Promise<{
    inputPath: string | null;
    outputPath: string;
    bytes: number;
    width: number;
    height: number;
    ffmpeg: {
        command: string;
        args: string[];
        stderr: string;
    };
}>;
export declare function buildGeneratedAudioArgs(params: {
    outputPath: string;
    durationSeconds: number;
    style?: GeneratedAudioStyle;
    volume?: number;
    overwrite?: boolean;
}): string[];
export declare function generateFreeAudioBed(params: {
    outputPath: string;
    durationSeconds: number;
    style?: GeneratedAudioStyle;
    volume?: number;
    overwrite?: boolean;
}): Promise<{
    outputPath: string;
    bytes: number;
    durationSeconds: number;
    style: GeneratedAudioStyle;
    license: string;
    ffmpeg: {
        command: string;
        args: string[];
        stderr: string;
    };
}>;
export declare function buildAudioMixArgs(params: {
    inputPath: string;
    audioPath: string;
    outputPath: string;
    mode?: AudioMixMode;
    originalVolume?: number;
    addedVolume?: number;
    overwrite?: boolean;
}): string[];
export declare function addAudioToVideo(params: {
    inputPath: string;
    audioPath: string;
    outputPath: string;
    mode?: AudioMixMode;
    originalVolume?: number;
    addedVolume?: number;
    overwrite?: boolean;
}): Promise<{
    inputPath: string;
    audioPath: string;
    outputPath: string;
    mode: AudioMixMode;
    bytes: number;
    ffmpeg: {
        command: string;
        args: string[];
        stderr: string;
    };
}>;
export declare function buildVoiceoverArgs(params: {
    text: string;
    outputPath: string;
    voice?: string;
    speedWpm?: number;
    pitch?: number;
}): string[];
export declare function createVoiceover(params: {
    text: string;
    outputPath: string;
    voice?: string;
    speedWpm?: number;
    pitch?: number;
    overwrite?: boolean;
}): Promise<{
    outputPath: string;
    bytes: number;
    voice: string;
    speedWpm: number;
    pitch: number;
    engine: string;
    note: string;
    command: {
        command: string;
        args: string[];
        stderr: string;
    };
}>;
