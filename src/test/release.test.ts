import { describe, expect, it } from "vitest";
import { buildReleaseChecklist, canTransition, isReleaseReady, RIGHTS_ITEMS, isBeatCleared, validateBeatFile } from "@/lib/release";
import { validateMediaFile, MAX_FILES } from "@/lib/media";

const allRights = Object.fromEntries(RIGHTS_ITEMS.map((i) => [i.key, true]));
const fullRelease = {
  artist_name: "A", track_title: "T", release_date: "2026-12-01", language: "English",
  songwriters: "Me", ownership_declared: true,
};

describe("release checklist", () => {
  it("is ready only when everything including ownership is done", () => {
    const items = buildReleaseChecklist({ release: fullRelease, lyrics: "la", audioReady: true, masteredReady: true, coverPath: "c", rights: allRights });
    expect(isReleaseReady(items)).toBe(true);
    const noOwn = buildReleaseChecklist({ release: { ...fullRelease, ownership_declared: false }, lyrics: "la", audioReady: true, masteredReady: true, coverPath: "c", rights: allRights });
    expect(isReleaseReady(noOwn)).toBe(false);
  });
  it("requires audio", () => {
    const items = buildReleaseChecklist({ release: fullRelease, lyrics: "la", audioReady: false, coverPath: "c", rights: allRights });
    expect(isReleaseReady(items)).toBe(false);
  });
});

describe("mastering and beats", () => {
  it("unmastered audio is not release-ready", () => {
    const items = buildReleaseChecklist({ release: fullRelease, lyrics: "la", audioReady: true, masteredReady: false, coverPath: "c", rights: allRights });
    expect(isReleaseReady(items)).toBe(false);
  });
  it("uploaded beat needs a rights basis and confirmation", () => {
    expect(isBeatCleared({ kind: "unsure", confirmed: true })).toBe(false);
    expect(isBeatCleared({ kind: "license", confirmed: false })).toBe(false);
    expect(isBeatCleared({ kind: "license", confirmed: true })).toBe(true);
    const items = buildReleaseChecklist({ release: fullRelease, lyrics: "la", audioReady: true, masteredReady: true, coverPath: "c", rights: allRights, beatSource: "uploaded", beatRights: { kind: "unsure" } });
    expect(isReleaseReady(items)).toBe(false);
  });
  it("validates beat formats", () => {
    expect(validateBeatFile({ name: "b.wav", type: "audio/wav", size: 10 })).toBeNull();
    expect(validateBeatFile({ name: "b.flac", type: "audio/flac", size: 10 })).not.toBeNull();
  });
});

describe("distribution transitions", () => {
  it("cannot submit from draft or before ready", () => {
    expect(canTransition("draft", "submitted", true)).toBe(false);
    expect(canTransition("ready", "submitted", false)).toBe(false);
    expect(canTransition("ready", "submitted", true)).toBe(true);
  });
  it("live only after submitted", () => {
    expect(canTransition("ready", "live", true)).toBe(false);
    expect(canTransition("submitted", "live", true)).toBe(true);
  });
});

describe("media validation", () => {
  it("rejects oversize video and unknown types and too many files", () => {
    expect(validateMediaFile({ type: "video/mp4", size: 101 * 1024 * 1024, name: "v" }, 0).ok).toBe(false);
    expect(validateMediaFile({ type: "application/pdf", size: 10, name: "p" }, 0).ok).toBe(false);
    expect(validateMediaFile({ type: "image/png", size: 10, name: "p" }, MAX_FILES).ok).toBe(false);
    expect(validateMediaFile({ type: "image/png", size: 10, name: "p" }, 0).ok).toBe(true);
  });
});
