// Browser-only: compose a square 3000x3000 JPG cover from an image + editable title/artist text.
export type CoverText = { title?: string; artist?: string; showText?: boolean };

export const COVER_SIZE = 3000;

export async function composeCover(source: Blob, text: CoverText): Promise<Blob> {
  const bmp = await createImageBitmap(source);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = COVER_SIZE;
  const ctx = canvas.getContext("2d")!;
  const side = Math.min(bmp.width, bmp.height);
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, COVER_SIZE, COVER_SIZE);
  if (text.showText !== false && (text.title || text.artist)) {
    const g = ctx.createLinearGradient(0, COVER_SIZE * 0.55, 0, COVER_SIZE);
    g.addColorStop(0, "rgba(10,12,24,0)");
    g.addColorStop(1, "rgba(10,12,24,0.85)");
    ctx.fillStyle = g;
    ctx.fillRect(0, COVER_SIZE * 0.55, COVER_SIZE, COVER_SIZE * 0.45);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff7e6";
    if (text.title) {
      ctx.font = `600 ${fit(ctx, text.title, 220)}px Fraunces, Georgia, serif`;
      ctx.fillText(text.title, COVER_SIZE / 2, COVER_SIZE * 0.86);
    }
    if (text.artist) {
      ctx.fillStyle = "#e8c27a";
      ctx.font = `500 120px Manrope, system-ui, sans-serif`;
      ctx.fillText(text.artist, COVER_SIZE / 2, COVER_SIZE * 0.93);
    }
  }
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't render cover"))), "image/jpeg", 0.92));
}

function fit(ctx: CanvasRenderingContext2D, s: string, max: number) {
  let size = max;
  ctx.font = `600 ${size}px Fraunces, Georgia, serif`;
  while (size > 80 && ctx.measureText(s).width > COVER_SIZE * 0.86) {
    size -= 10;
    ctx.font = `600 ${size}px Fraunces, Georgia, serif`;
  }
  return size;
}
