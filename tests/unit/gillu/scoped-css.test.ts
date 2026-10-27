import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

/** Top-level blocks of a stylesheet, each starting at its prelude. */
function topLevelBlocks(css: string): string[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        blocks.push(source.slice(start, index + 1).trim());
        start = index + 1;
      }
    }
  }
  return blocks.filter(Boolean);
}

test.each([
  ["src/css/gillu-site.css", ".gillu-site"],
  ["src/css/gillu-desk.css", ".gillu-desk"],
])("%s is fully scoped", (file, scope) => {
  const css = readFileSync(file, "utf8");
  expect(css).toContain(`@scope (${scope})`);
  expect(css).not.toMatch(/@font-face/);
  expect(css).not.toMatch(/(^|[}\s,]):root\b/);
  expect(css).not.toMatch(/(^|[}\s,;{])body\s*[{.,:]/);
  expect(css).not.toMatch(/url\(\.\/assets/);
  const unscoped = topLevelBlocks(css).filter(
    (block) =>
      !/^@scope\b|^@keyframes\b|^html:has\(/.test(block) &&
      !/^@media[^{]*\{\s*@scope\b/.test(block),
  );
  expect(unscoped).toEqual([]);
});

test("desk css has no demo-only rules", () => {
  expect(readFileSync("src/css/gillu-desk.css", "utf8")).not.toMatch(
    /\.(demo-badge|simulator|journey)/,
  );
});
