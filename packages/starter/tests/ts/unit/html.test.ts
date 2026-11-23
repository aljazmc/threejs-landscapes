import { readFileSync } from "node:fs";
import { join } from "node:path";
import root from "../../../../../package.json";

const src = join(import.meta.dirname, "../../../src");
const read = (file: string) => readFileSync(join(src, file), "utf8");

describe("index.html", () => {
    test.each(["index.html", "prod/index.html"])(
        "%s has the root the scene renders into",
        (file) => {
            expect(read(file)).toContain('<div id="root"></div>');
        },
    );

    test.each(["react", "react-dom", "three"] as const)(
        "the production import map pins %s to the root resolution",
        (name) => {
            const pinned = read("prod/index.html").match(
                new RegExp(`esm\\.sh/${name}@([\\d.]+)`),
            );
            expect(pinned?.[1]).toBe(root.resolutions[name]);
        },
    );
});
