import { describe, expect, it } from "vitest";
import { encodeWav, normalizePeak } from "@/lib/wav";
import { moveItem } from "@/lib/playlists";

describe("release WAV export", () => {
  it("writes a 16-bit stereo WAV header with the right size", () => {
    const wav = encodeWav([new Float32Array(10), new Float32Array(10)], 44100);
    const v = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF");
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getUint16(34, true)).toBe(16);
    expect(wav.length).toBe(44 + 10 * 2 * 2);
  });
  it("normalises peaks to -1 dBFS", () => {
    const ch = new Float32Array([0.25, -0.5]);
    normalizePeak([ch], -1);
    expect(Math.abs(ch[1]!)).toBeCloseTo(0.891, 2);
  });
});

describe("playlist reorder", () => {
  it("moves a song down one place", () => expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]));
  it("ignores moves past the end", () => expect(moveItem(["a", "b"], 1, 2)).toEqual(["a", "b"]));
});
