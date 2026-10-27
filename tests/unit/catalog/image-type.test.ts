import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

import { detectImageType } from "~/modules/catalog/infrastructure/image-type";

const fixture = (name: string) =>
  new Uint8Array(readFileSync(`tests/fixtures/images/${name}`));
const text = (value: string) => new TextEncoder().encode(value);

test.each([
  ["pixel.jpg", "image/jpeg"],
  ["pixel.png", "image/png"],
  ["three-by-two.webp", "image/webp"],
])("detects %s as %s from its bytes", (name, type) => {
  expect(detectImageType(fixture(name))).toBe(type);
});

test.each([
  ["an HTML page", text("<!doctype html><html><script>alert(1)</script>")],
  ["an SVG", text('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
  ["a GIF", fixture("pixel.gif")],
  [
    "a RIFF file that is not WebP",
    text("RIFF\u0000\u0000\u0000\u0000WAVEfmt "),
  ],
  ["a truncated PNG signature", fixture("pixel.png").slice(0, 7)],
  ["empty bytes", new Uint8Array()],
])("refuses %s", (_name, bytes) => {
  expect(detectImageType(bytes)).toBeNull();
});
