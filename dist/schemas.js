import { Type } from "typebox";
export const CapabilitySchema = Type.Union([
    Type.Literal("readonly"),
    Type.Literal("upload"),
    Type.Literal("live_control"),
    Type.Literal("analytics"),
    Type.Literal("monetary_analytics"),
    Type.Literal("full_channel"),
]);
export const PrivacySchema = Type.Union([
    Type.Literal("private"),
    Type.Literal("unlisted"),
    Type.Literal("public"),
]);
export const BroadcastStatusSchema = Type.Union([
    Type.Literal("active"),
    Type.Literal("all"),
    Type.Literal("completed"),
    Type.Literal("upcoming"),
]);
export const TransitionSchema = Type.Union([
    Type.Literal("testing"),
    Type.Literal("live"),
    Type.Literal("complete"),
]);
export const RequestMethodSchema = Type.Union([
    Type.Literal("GET"),
    Type.Literal("POST"),
    Type.Literal("PUT"),
    Type.Literal("DELETE"),
]);
export const QuerySchema = Type.Optional(Type.Record(Type.String(), Type.Union([
    Type.String(),
    Type.Number(),
    Type.Boolean(),
])));
export const JsonObjectSchema = Type.Record(Type.String(), Type.Unknown());
export const OptionalJsonObjectSchema = Type.Optional(JsonObjectSchema);
export const LicenseSchema = Type.Union([
    Type.Literal("creativeCommon"),
    Type.Literal("youtube"),
]);
export const LiveStreamIngestionSchema = Type.Union([
    Type.Literal("dash"),
    Type.Literal("hls"),
    Type.Literal("rtmp"),
]);
export const CommentModerationStatusSchema = Type.Union([
    Type.Literal("heldForReview"),
    Type.Literal("published"),
    Type.Literal("rejected"),
]);
export const LiveChatBanTypeSchema = Type.Union([
    Type.Literal("temporary"),
    Type.Literal("permanent"),
]);
export const ShortAspectSchema = Type.Union([
    Type.Literal("source"),
    Type.Literal("vertical_9_16"),
    Type.Literal("square_1_1"),
]);
export const ShortFitSchema = Type.Union([
    Type.Literal("crop"),
    Type.Literal("pad"),
]);
export const AudioMixModeSchema = Type.Union([
    Type.Literal("replace"),
    Type.Literal("mix"),
    Type.Literal("duck"),
]);
export const GeneratedAudioStyleSchema = Type.Union([
    Type.Literal("ambient_pad"),
    Type.Literal("soft_pulse"),
    Type.Literal("clean_tone"),
    Type.Literal("white_noise"),
    Type.Literal("silence"),
]);
export const ContentFormatSchema = Type.Union([
    Type.Literal("short"),
    Type.Literal("long"),
    Type.Literal("live"),
    Type.Literal("community"),
    Type.Literal("clip"),
]);
export const ContentStatusSchema = Type.Union([
    Type.Literal("idea"),
    Type.Literal("script"),
    Type.Literal("recording"),
    Type.Literal("editing"),
    Type.Literal("review"),
    Type.Literal("ready"),
    Type.Literal("scheduled"),
    Type.Literal("published"),
    Type.Literal("archived"),
]);
export const AssetTypeSchema = Type.Union([
    Type.Literal("video"),
    Type.Literal("thumbnail"),
    Type.Literal("audio"),
    Type.Literal("voiceover"),
    Type.Literal("caption"),
    Type.Literal("script"),
    Type.Literal("export"),
    Type.Literal("other"),
]);
export const ApprovalResolutionSchema = Type.Union([
    Type.Literal("approved"),
    Type.Literal("rejected"),
    Type.Literal("cancelled"),
]);
