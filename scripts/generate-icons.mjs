import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = path.join(root, "public", "icons", "app-icon.svg");
const iconDirectory = path.join(root, "public", "icons");
await mkdir(iconDirectory, { recursive: true });

async function renderIcon(size, filename) {
  await sharp(source)
    .resize(size, size)
    .png({ compressionLevel: 9, palette: true })
    .toFile(path.join(iconDirectory, filename));
}

await Promise.all([
  renderIcon(192, "icon-192.png"),
  renderIcon(512, "icon-512.png"),
  renderIcon(180, "../apple-touch-icon.png"),
  sharp(source)
    .resize(384, 384)
    .extend({ top: 64, bottom: 64, left: 64, right: 64, background: "#090507" })
    .png({ compressionLevel: 9, palette: true })
    .toFile(path.join(iconDirectory, "icon-maskable-512.png")),
  copyFile(source, path.join(root, "public", "favicon.svg"))
]);

process.stdout.write("Ícones PWA gerados em 180, 192 e 512 pixels.\n");
