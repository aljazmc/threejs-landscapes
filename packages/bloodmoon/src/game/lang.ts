/**
 * The game's texts in every language and the language chosen in the menu.
 * A text is looked up by its English wording.
 */

export const NAMES = ["English", "Deutsch", "Polski", "Slovenščina"];

/** Where the chosen language is kept, by its name. */
const STORAGE_KEY = "bloodmoon.language";

/** German, Polish and Slovenian, by the English text. */
const TEXTS: Record<string, [string, string, string]> = {
    Play: ["Spielen", "Graj", "Igraj"],
    Save: ["Speichern", "Zapisz", "Shrani"],
    Load: ["Laden", "Wczytaj", "Naloži"],
    Language: ["Sprache", "Język", "Jezik"],
    Back: ["Zurück", "Wstecz", "Nazaj"],
    "Game saved.": ["Spiel gespeichert.", "Gra zapisana.", "Igra shranjena."],
    "There is no game in progress to save.": [
        "Es läuft kein Spiel, das man speichern könnte.",
        "Nie ma rozpoczętej gry do zapisania.",
        "Ni igre v teku, ki bi jo lahko shranili.",
    ],
    "There is no saved game yet.": [
        "Es gibt noch keinen Spielstand.",
        "Nie ma jeszcze zapisanej gry.",
        "Shranjene igre še ni.",
    ],
    "Arrows + Enter or mouse to choose": [
        "Pfeiltasten + Enter oder Maus zum Auswählen",
        "Strzałki + Enter lub mysz, aby wybrać",
        "Puščice + Enter ali miška za izbiro",
    ],
    "Choose a language": [
        "Wähle eine Sprache",
        "Wybierz język",
        "Izberi jezik",
    ],
    "Paused. Play continues the hunt.": [
        "Pause. Spielen setzt die Jagd fort.",
        "Pauza. Graj wznawia polowanie.",
        "Premor. Igraj nadaljuje lov.",
    ],
    "Press Enter to return to the main menu": [
        "Enter drücken, um zum Hauptmenü zurückzukehren",
        "Naciśnij Enter, aby wrócić do menu głównego",
        "Pritisni Enter za vrnitev v glavni meni",
    ],
    "VICTORY!": ["SIEG!", "ZWYCIĘSTWO!", "ZMAGA!"],
    DEFEAT: ["NIEDERLAGE", "PORAŻKA", "PORAZ"],
    "WASD / arrows: move   Mouse: aim   Space / left click: fire   1: revolver   2: flamethrower   Esc: menu":
        [
            "WASD / Pfeiltasten: bewegen   Maus: zielen   Leertaste / Linksklick: feuern   1: Revolver   2: Flammenwerfer   Esc: Menü",
            "WASD / strzałki: ruch   Mysz: celowanie   Spacja / lewy przycisk: strzał   1: rewolwer   2: miotacz ognia   Esc: menu",
            "WASD / puščice: premik   Miška: merjenje   Preslednica / levi klik: strel   1: revolver   2: metalec ognja   Esc: meni",
        ],
    "1 REVOLVER": ["1 REVOLVER", "1 REWOLWER", "1 REVOLVER"],
    "2 FLAMER": ["2 BRENNER", "2 MIOTACZ", "2 METALEC"],
    "HEALTH {0}": ["LEBEN {0}", "ZDROWIE {0}", "ZDRAVJE {0}"],
    HEADSHOT: ["KOPFTREFFER", "STRZAŁ W GŁOWĘ", "ZADETEK V GLAVO"],
    "CREATURES {0}/{1}": [
        "KREATUREN {0}/{1}",
        "STWORY {0}/{1}",
        "BITJA {0}/{1}",
    ],
    CRYPT: ["GRUFT", "KRYPTA", "KRIPTA"],
    CORRIDOR: ["KORRIDOR", "KORYTARZ", "HODNIK"],
    BEDCHAMBER: ["SCHLAFGEMACH", "SYPIALNIA", "SPALNICA"],
    BALLROOM: ["BALLSAAL", "SALA BALOWA", "PLESNA DVORANA"],
    "THE MANOR IS CLEANSED": [
        "DAS ANWESEN IST GEREINIGT",
        "DWÓR OCZYSZCZONY",
        "DVOREC JE OČIŠČEN",
    ],
    FALLEN: ["GEFALLEN", "UPADEK", "PADEC"],
    "All ten creatures of the night are destroyed. Bloodmoon Manor is free.": [
        "Alle zehn Kreaturen der Nacht sind vernichtet. Bloodmoon Manor ist frei.",
        "Dziesięć stworów nocy zostało zniszczonych. Bloodmoon Manor jest wolny.",
        "Vseh deset nočnih bitij je uničenih. Bloodmoon Manor je svoboden.",
    ],
    "The creatures of the night have overwhelmed you.": [
        "Die Kreaturen der Nacht haben dich überwältigt.",
        "Stwory nocy cię pokonały.",
        "Nočna bitja so te premagala.",
    ],
    // touchscreens
    "Tap to choose": [
        "Zum Auswählen antippen",
        "Dotknij, aby wybrać",
        "Tapni za izbiro",
    ],
    "Tap to return to the main menu": [
        "Tippen, um zum Hauptmenü zurückzukehren",
        "Dotknij, aby wrócić do menu głównego",
        "Tapni za vrnitev v glavni meni",
    ],
    "Left thumb: move   Right thumb: aim   FIRE: shoot   Tap a weapon to choose it   II: menu":
        [
            "Linker Daumen: bewegen   Rechter Daumen: zielen   FEUER: schießen   Waffe antippen zum Wechseln   II: Menü",
            "Lewy kciuk: ruch   Prawy kciuk: celowanie   OGNIA: strzał   Dotknij broni, aby ją wybrać   II: menu",
            "Levi palec: premik   Desni palec: merjenje   OGENJ: strel   Tapni orožje za izbiro   II: meni",
        ],
    FIRE: ["FEUER", "OGNIA", "OGENJ"],
};

export const Lang = {
    current: 0,

    /** The text in the current language; {0}, {1}... are replaced by the args. */
    t(english: string, args?: unknown[]): string {
        const texts = TEXTS[english];
        let text =
            Lang.current === 0 || !texts
                ? english
                : (texts[Lang.current - 1] ?? english);
        if (args)
            args.forEach((arg, i) => {
                text = text.replaceAll(`{${i}}`, String(arg));
            });
        return text;
    },

    load(): void {
        try {
            const index = NAMES.indexOf(
                (localStorage.getItem(STORAGE_KEY) ?? "").trim(),
            );
            if (index >= 0) Lang.current = index;
        } catch {
            // storage blocked: English
        }
    },

    choose(index: number): void {
        Lang.current = index;
        try {
            localStorage.setItem(STORAGE_KEY, NAMES[index] ?? "English");
        } catch {
            // storage blocked: the choice lasts until the page is left
        }
    },
};
