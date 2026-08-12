import { describe, expect, it } from "vitest";
import {
  buildAudioMixArgs,
  buildGeneratedAudioArgs,
  buildShortCreateArgs,
  buildThumbnailExtractArgs,
  buildThumbnailGenerateArgs,
  buildVoiceoverArgs,
} from "../src/index.js";

describe("media helpers", () => {
  it("builds short creation ffmpeg args with explicit video mapping", () => {
    const args = buildShortCreateArgs({
      inputPath: "/tmp/source.mp4",
      outputPath: "/tmp/short.mp4",
      startTime: "00:00:05",
      durationSeconds: 30,
      topText: "Launch: now",
      fit: "pad",
    });

    expect(args).toContain("-vf");
    expect(args).toContain("0:v:0");
    expect(args.join(" ")).toContain("scale=1080:1920");
    expect(args.join(" ")).toContain("drawtext");
    expect(args.join(" ")).toContain("Launch\\: now");
  });

  it("rejects overlong short creation durations", () => {
    expect(() => buildShortCreateArgs({
      inputPath: "/tmp/source.mp4",
      outputPath: "/tmp/short.mp4",
      durationSeconds: 181,
    })).toThrow("180 seconds or less");
  });

  it("builds thumbnail extraction args", () => {
    const args = buildThumbnailExtractArgs({
      inputPath: "/tmp/source.mp4",
      outputPath: "/tmp/thumb.jpg",
      time: "00:00:10",
    });

    expect(args).toContain("-frames:v");
    expect(args).toContain("1");
    expect(args).toContain("/tmp/thumb.jpg");
  });

  it("builds generated thumbnail card args with escaped text", () => {
    const args = buildThumbnailGenerateArgs({
      outputPath: "/tmp/card.jpg",
      title: "Watch: now",
      subtitle: "New episode",
      badge: "PUBLIC",
      backgroundColor: "#111827",
    });

    expect(args).toContain("-f");
    expect(args.join(" ")).toContain("color=c=#111827");
    expect(args.join(" ")).toContain("Watch\\: now");
    expect(args).toContain("/tmp/card.jpg");
  });

  it("rejects unsafe generated thumbnail colors", () => {
    expect(() => buildThumbnailGenerateArgs({
      outputPath: "/tmp/card.jpg",
      backgroundColor: "red;rm",
    })).toThrow("Unsafe");
  });

  it("builds synthetic audio bed args", () => {
    const args = buildGeneratedAudioArgs({
      outputPath: "/tmp/bed.wav",
      durationSeconds: 12,
      style: "ambient_pad",
    });

    expect(args).toContain("-f");
    expect(args.join(" ")).toContain("lavfi");
    expect(args).toContain("pcm_s16le");
  });

  it("builds audio replacement args", () => {
    const args = buildAudioMixArgs({
      inputPath: "/tmp/in.mp4",
      audioPath: "/tmp/voice.wav",
      outputPath: "/tmp/out.mp4",
      mode: "replace",
    });

    expect(args).toContain("1:a:0");
    expect(args).toContain("-shortest");
    expect(args).toContain("/tmp/out.mp4");
  });

  it("builds voiceover args without shell composition", () => {
    const args = buildVoiceoverArgs({
      text: "Hello Kai",
      outputPath: "/tmp/voice.wav",
      voice: "en-us",
    });

    expect(args).toEqual(expect.arrayContaining(["-w", "/tmp/voice.wav", "-v", "en-us"]));
    expect(args.at(-1)).toBe("Hello Kai");
  });
});
