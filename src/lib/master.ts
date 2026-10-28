// Browser-only BASIC loudness processing. This is not professional mastering and is labelled as such in the UI.
import { encodeWav, normalizePeak } from "./wav";

export const BASIC_ENGINE = "browser-basic";
export const BASIC_ENGINE_LABEL = "Basic in-browser processing (low-cut, gentle compression, peak normalise to −1 dBFS)";

export async function basicMaster(sourceUrl: string): Promise<Blob> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error("Couldn't load the original audio.");
  const raw = await res.arrayBuffer();
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const decoded = await new Ctx().decodeAudioData(raw);
  const rate = 44100;
  const off = new OfflineAudioContext(2, Math.ceil(decoded.duration * rate), rate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  const hp = off.createBiquadFilter();
  hp.type = "highpass"; hp.frequency.value = 30;
  const comp = off.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 2.5; comp.attack.value = 0.01; comp.release.value = 0.25; comp.knee.value = 6;
  src.connect(hp).connect(comp).connect(off.destination);
  src.start();
  const out = await off.startRendering();
  const chans = [out.getChannelData(0).slice(), out.getChannelData(1).slice()];
  normalizePeak(chans, -1);
  return new Blob([encodeWav(chans, rate) as BlobPart], { type: "audio/wav" });
}
