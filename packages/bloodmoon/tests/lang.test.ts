import { Lang, NAMES } from "../src/game/lang";

describe("Lang", () => {
    afterEach(() => {
        Lang.current = 0;
    });

    test("offers English, German, Polish and Slovenian", () => {
        expect(NAMES).toEqual(["English", "Deutsch", "Polski", "Slovenščina"]);
    });

    test("looks a text up by its English wording", () => {
        expect(Lang.t("Play")).toBe("Play");
        Lang.current = 1;
        expect(Lang.t("Play")).toBe("Spielen");
        Lang.current = 3;
        expect(Lang.t("Play")).toBe("Igraj");
    });

    test("falls back to English for unknown texts", () => {
        Lang.current = 2;
        expect(Lang.t("No such text")).toBe("No such text");
    });

    test("fills in the arguments", () => {
        Lang.current = 1;
        expect(Lang.t("HEALTH {0}", [75])).toBe("LEBEN 75");
    });

    test("keeps the choice without storage", () => {
        Lang.choose(2);
        expect(Lang.current).toBe(2);
    });
});
