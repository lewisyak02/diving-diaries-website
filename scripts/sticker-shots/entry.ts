// Entry for the headless product shot page. Bundled by shoot.mjs with esbuild
// and loaded from a file:// page in Playwright, so the shots come out of the
// exact renderer the site ships. There is no second implementation to drift.
import { createHoloViewer, type HoloOptions } from '../../src/lib/holo/viewer';

declare global {
  interface Window {
    setupSticker: (opts: HoloOptions & { pixelSize: number }) => Promise<boolean>;
    shootAt: (yawDeg: number, tiltDeg?: number) => string;
  }
}

let viewer: Awaited<ReturnType<typeof createHoloViewer>> = null;
let canvas: HTMLCanvasElement;

window.setupSticker = async (opts) => {
  canvas = document.getElementById('stage') as HTMLCanvasElement;
  canvas.style.width = opts.pixelSize + 'px';
  canvas.style.height = opts.pixelSize + 'px';
  viewer = await createHoloViewer(canvas, { ...opts, interactive: false });
  return viewer !== null;
};

window.shootAt = (yawDeg, tiltDeg = 0) => {
  if (!viewer) throw new Error('sticker not set up');
  viewer.setAngle(yawDeg, tiltDeg);
  return canvas.toDataURL('image/png');
};
