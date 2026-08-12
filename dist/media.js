import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_SHORTS_DIR, MAX_SHORT_DURATION_SECONDS } from "./constants.js";
function limitOutput(value, maxCharacters = 12_000) {
    return value.length > maxCharacters ? value.slice(-maxCharacters) : value;
}
function runCommand(command, args, timeoutMs = 15 * 60_000) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        const timeout = setTimeout(() => {
            child.kill("SIGTERM");
            reject(new Error(`${command} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk) => {
            stdout = limitOutput(stdout + chunk);
        });
        child.stderr.on("data", (chunk) => {
            stderr = limitOutput(stderr + chunk);
        });
        child.on("error", (error) => {
            clearTimeout(timeout);
            reject(error);
        });
        child.on("close", (code) => {
            clearTimeout(timeout);
            const result = { command, args, stdout, stderr };
            if (code === 0) {
                resolve(result);
                return;
            }
            reject(new Error(`${command} exited with code ${code}: ${stderr || stdout}`));
        });
    });
}
async function assertFileExists(filePath) {
    await stat(filePath);
}
async function prepareOutputFile(outputPath, overwrite) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    if (overwrite)
        return;
    try {
        await stat(outputPath);
        throw new Error(`Output file already exists: ${outputPath}. Use overwrite: true or choose a new path.`);
    }
    catch (error) {
        if (error.code === "ENOENT")
            return;
        throw error;
    }
}
function formatSeconds(value) {
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error("durationSeconds must be a positive number.");
    }
    return String(Math.round(value * 1000) / 1000);
}
function validateShortDuration(durationSeconds) {
    if (durationSeconds > MAX_SHORT_DURATION_SECONDS) {
        throw new Error(`durationSeconds must be ${MAX_SHORT_DURATION_SECONDS} seconds or less for short creation.`);
    }
}
function escapeFilterText(value) {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/:/g, "\\:")
        .replace(/'/g, "\\'")
        .replace(/%/g, "\\%")
        .replace(/\n/g, "\\n");
}
function escapeFilterPath(value) {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/:/g, "\\:")
        .replace(/'/g, "\\'");
}
function aspectFilter(aspect, fit) {
    if (aspect === "source")
        return null;
    const [width, height] = aspect === "square_1_1" ? [1080, 1080] : [1080, 1920];
    if (fit === "pad") {
        return `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`;
    }
    return `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
}
function textOverlayFilter(params) {
    const fontFile = params.fontFile ? `:fontfile='${escapeFilterPath(params.fontFile)}'` : "";
    const common = `${fontFile}:fontcolor=white:fontsize=h/20:borderw=4:bordercolor=black@0.75:x=(w-text_w)/2`;
    return [
        params.topText
            ? `drawtext=text='${escapeFilterText(params.topText)}'${common}:y=h*0.08`
            : null,
        params.bottomText
            ? `drawtext=text='${escapeFilterText(params.bottomText)}'${common}:y=h-text_h-h*0.09`
            : null,
    ].filter((value) => Boolean(value));
}
export function buildShortCreateArgs(params) {
    const durationSeconds = params.durationSeconds ?? 60;
    validateShortDuration(durationSeconds);
    const filters = [
        aspectFilter(params.aspect ?? "vertical_9_16", params.fit ?? "crop"),
        ...textOverlayFilter(params),
        params.captionFilePath ? `subtitles='${escapeFilterPath(params.captionFilePath)}'` : null,
    ].filter((value) => Boolean(value));
    return [
        "-hide_banner",
        params.overwrite ? "-y" : "-n",
        ...(params.startTime ? ["-ss", params.startTime] : []),
        "-i",
        params.inputPath,
        "-t",
        formatSeconds(durationSeconds),
        ...(filters.length ? ["-vf", filters.join(",")] : []),
        "-map",
        "0:v:0",
        "-c:v",
        "libx264",
        "-preset",
        params.preset ?? "veryfast",
        "-crf",
        String(params.crf ?? 23),
        "-pix_fmt",
        "yuv420p",
        ...(params.removeAudio ? ["-an"] : ["-map", "0:a?", "-c:a", "aac", "-b:a", "128k"]),
        "-movflags",
        "+faststart",
        params.outputPath,
    ];
}
export function buildThumbnailExtractArgs(params) {
    const width = params.width ?? 1280;
    const height = params.height ?? 720;
    return [
        "-hide_banner",
        params.overwrite ? "-y" : "-n",
        "-ss",
        params.time ?? "00:00:01",
        "-i",
        params.inputPath,
        "-frames:v",
        "1",
        "-vf",
        `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
        params.outputPath,
    ];
}
export async function probeVideo(filePath) {
    await assertFileExists(filePath);
    const result = await runCommand("ffprobe", [
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        filePath,
    ], 60_000);
    try {
        return JSON.parse(result.stdout);
    }
    catch {
        return {
            raw: result.stdout,
            stderr: result.stderr,
        };
    }
}
export async function createShortFromVideo(params) {
    await assertFileExists(params.inputPath);
    if (params.captionFilePath)
        await assertFileExists(params.captionFilePath);
    if (params.fontFile)
        await assertFileExists(params.fontFile);
    await prepareOutputFile(params.outputPath, params.overwrite);
    const args = buildShortCreateArgs(params);
    const result = await runCommand("ffmpeg", args);
    const output = await stat(params.outputPath);
    return {
        inputPath: params.inputPath,
        outputPath: params.outputPath,
        bytes: output.size,
        durationSeconds: params.durationSeconds ?? 60,
        aspect: params.aspect ?? "vertical_9_16",
        fit: params.fit ?? "crop",
        ffmpeg: {
            command: result.command,
            args: result.args,
            stderr: result.stderr,
        },
    };
}
export async function extractThumbnail(params) {
    await assertFileExists(params.inputPath);
    await prepareOutputFile(params.outputPath, params.overwrite);
    const args = buildThumbnailExtractArgs(params);
    const result = await runCommand("ffmpeg", args, 120_000);
    const output = await stat(params.outputPath);
    return {
        inputPath: params.inputPath,
        outputPath: params.outputPath,
        bytes: output.size,
        time: params.time ?? "00:00:01",
        ffmpeg: {
            command: result.command,
            args: result.args,
            stderr: result.stderr,
        },
    };
}
export function defaultShortOutputPath(inputPath) {
    const parsed = path.parse(inputPath);
    const suffix = randomBytes(4).toString("hex");
    return path.join(DEFAULT_SHORTS_DIR, `${parsed.name}-short-${suffix}.mp4`);
}
function safeFfmpegColor(value, fallback) {
    const color = value ?? fallback;
    if (!/^[A-Za-z0-9#@._-]+$/.test(color)) {
        throw new Error(`Unsafe ffmpeg color value: ${color}`);
    }
    return color;
}
export function buildThumbnailGenerateArgs(params) {
    const width = params.width ?? 1280;
    const height = params.height ?? 720;
    const backgroundColor = safeFfmpegColor(params.backgroundColor, "#111827");
    const fontFile = params.fontFile ? `:fontfile='${escapeFilterPath(params.fontFile)}'` : "";
    const filters = [
        params.inputPath
            ? `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`
            : null,
        "format=yuv420p",
        params.title
            ? `drawtext=text='${escapeFilterText(params.title)}'${fontFile}:fontcolor=white:fontsize=h/10:borderw=6:bordercolor=black@0.8:x=(w-text_w)/2:y=h*0.40-text_h`
            : null,
        params.subtitle
            ? `drawtext=text='${escapeFilterText(params.subtitle)}'${fontFile}:fontcolor=white:fontsize=h/24:borderw=3:bordercolor=black@0.65:x=(w-text_w)/2:y=h*0.55`
            : null,
        params.badge
            ? `drawtext=text='${escapeFilterText(params.badge)}'${fontFile}:fontcolor=black:fontsize=h/28:box=1:boxcolor=white@0.92:boxborderw=18:x=w-text_w-w*0.08:y=h*0.08`
            : null,
    ].filter((value) => Boolean(value));
    return [
        "-hide_banner",
        params.overwrite ? "-y" : "-n",
        ...(params.inputPath
            ? [
                ...(params.time ? ["-ss", params.time] : []),
                "-i",
                params.inputPath,
            ]
            : [
                "-f",
                "lavfi",
                "-i",
                `color=c=${backgroundColor}:s=${width}x${height}:d=1`,
            ]),
        "-frames:v",
        "1",
        "-vf",
        filters.join(","),
        params.outputPath,
    ];
}
export async function generateThumbnailCard(params) {
    if (params.inputPath)
        await assertFileExists(params.inputPath);
    if (params.fontFile)
        await assertFileExists(params.fontFile);
    await prepareOutputFile(params.outputPath, params.overwrite);
    const args = buildThumbnailGenerateArgs(params);
    const result = await runCommand("ffmpeg", args, 120_000);
    const output = await stat(params.outputPath);
    return {
        inputPath: params.inputPath ?? null,
        outputPath: params.outputPath,
        bytes: output.size,
        width: params.width ?? 1280,
        height: params.height ?? 720,
        ffmpeg: {
            command: result.command,
            args: result.args,
            stderr: result.stderr,
        },
    };
}
function generatedAudioFilter(style, durationSeconds) {
    const duration = formatSeconds(durationSeconds);
    if (style === "silence")
        return `anullsrc=channel_layout=stereo:sample_rate=44100:d=${duration}`;
    if (style === "white_noise")
        return `anoisesrc=color=white:duration=${duration}:amplitude=0.05`;
    if (style === "clean_tone")
        return `sine=frequency=440:duration=${duration}:sample_rate=44100`;
    if (style === "soft_pulse") {
        return `sine=frequency=176:duration=${duration}:sample_rate=44100,volume=0.20,tremolo=f=2:d=0.45`;
    }
    return `sine=frequency=196:duration=${duration}:sample_rate=44100,volume=0.18,aecho=0.8:0.9:700:0.25,afade=t=in:st=0:d=1,afade=t=out:st=${Math.max(0, durationSeconds - 1)}:d=1`;
}
export function buildGeneratedAudioArgs(params) {
    const style = params.style ?? "ambient_pad";
    const volume = params.volume ?? 0.35;
    const extension = path.extname(params.outputPath).toLowerCase();
    const codec = extension === ".mp3" ? "libmp3lame" : extension === ".wav" ? "pcm_s16le" : "aac";
    return [
        "-hide_banner",
        params.overwrite ? "-y" : "-n",
        "-f",
        "lavfi",
        "-i",
        generatedAudioFilter(style, params.durationSeconds),
        "-filter:a",
        `volume=${volume}`,
        "-c:a",
        codec,
        params.outputPath,
    ];
}
export async function generateFreeAudioBed(params) {
    await prepareOutputFile(params.outputPath, params.overwrite);
    const args = buildGeneratedAudioArgs(params);
    const result = await runCommand("ffmpeg", args, 120_000);
    const output = await stat(params.outputPath);
    return {
        outputPath: params.outputPath,
        bytes: output.size,
        durationSeconds: params.durationSeconds,
        style: params.style ?? "ambient_pad",
        license: "Generated locally from ffmpeg audio filters; no third-party copyrighted track is included.",
        ffmpeg: {
            command: result.command,
            args: result.args,
            stderr: result.stderr,
        },
    };
}
export function buildAudioMixArgs(params) {
    const mode = params.mode ?? "mix";
    const originalVolume = params.originalVolume ?? (mode === "duck" ? 0.25 : 1);
    const addedVolume = params.addedVolume ?? 1;
    const common = [
        "-hide_banner",
        params.overwrite ? "-y" : "-n",
        "-i",
        params.inputPath,
        "-i",
        params.audioPath,
        "-map",
        "0:v:0",
    ];
    if (mode === "replace") {
        return [
            ...common,
            "-map",
            "1:a:0",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-shortest",
            "-movflags",
            "+faststart",
            params.outputPath,
        ];
    }
    return [
        ...common,
        "-filter_complex",
        `[0:a]volume=${originalVolume}[base];[1:a]volume=${addedVolume}[add];[base][add]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
        "-map",
        "[aout]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        "-movflags",
        "+faststart",
        params.outputPath,
    ];
}
export async function addAudioToVideo(params) {
    await assertFileExists(params.inputPath);
    await assertFileExists(params.audioPath);
    await prepareOutputFile(params.outputPath, params.overwrite);
    const args = buildAudioMixArgs(params);
    const result = await runCommand("ffmpeg", args);
    const output = await stat(params.outputPath);
    return {
        inputPath: params.inputPath,
        audioPath: params.audioPath,
        outputPath: params.outputPath,
        mode: params.mode ?? "mix",
        bytes: output.size,
        ffmpeg: {
            command: result.command,
            args: result.args,
            stderr: result.stderr,
        },
    };
}
export function buildVoiceoverArgs(params) {
    return [
        "-w",
        params.outputPath,
        "-v",
        params.voice ?? "en",
        "-s",
        String(params.speedWpm ?? 165),
        "-p",
        String(params.pitch ?? 50),
        params.text,
    ];
}
export async function createVoiceover(params) {
    await prepareOutputFile(params.outputPath, params.overwrite);
    const result = await runCommand("espeak-ng", buildVoiceoverArgs(params), 120_000);
    const output = await stat(params.outputPath);
    return {
        outputPath: params.outputPath,
        bytes: output.size,
        voice: params.voice ?? "en",
        speedWpm: params.speedWpm ?? 165,
        pitch: params.pitch ?? 50,
        engine: "espeak-ng",
        note: "Install espeak-ng on the OpenClaw server to use this tool.",
        command: {
            command: result.command,
            args: result.args.slice(0, -1).concat("[text redacted from command echo]"),
            stderr: result.stderr,
        },
    };
}
