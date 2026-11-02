/**
 * The game's texts in every language and the language chosen in the menu.
 * A text is looked up by its English wording.
 */

export const NAMES = ["English", "Deutsch", "Polski", "Slovenščina"];

/** Where the chosen language is kept, by its name. */
const STORAGE_KEY = "moonshadow.language";

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
    "Paused. Play continues the fight.": [
        "Pause. Spielen setzt den Kampf fort.",
        "Pauza. Graj wznawia walkę.",
        "Premor. Igraj nadaljuje boj.",
    ],
    "Press Enter to return to the main menu": [
        "Enter drücken, um zum Hauptmenü zurückzukehren",
        "Naciśnij Enter, aby wrócić do menu głównego",
        "Pritisni Enter za vrnitev v glavni meni",
    ],
    "VICTORY!": ["SIEG!", "ZWYCIĘSTWO!", "ZMAGA!"],
    DEFEAT: ["NIEDERLAGE", "PORAŻKA", "PORAZ"],
    "WASD / arrows: move   Mouse: aim   Space / left click: strike, shoot   1: sword   2: bow   Esc: menu":
        [
            "WASD / Pfeiltasten: bewegen   Maus: zielen   Leertaste / Linksklick: zuschlagen, schießen   1: Schwert   2: Bogen   Esc: Menü",
            "WASD / strzałki: ruch   Mysz: celowanie   Spacja / lewy przycisk: cios, strzał   1: miecz   2: łuk   Esc: menu",
            "WASD / puščice: premik   Miška: merjenje   Preslednica / levi klik: udarec, strel   1: meč   2: lok   Esc: meni",
        ],
    "HEALTH {0}": ["LEBEN {0}", "ZDROWIE {0}", "ZDRAVJE {0}"],
    HEADSHOT: ["KOPFTREFFER", "STRZAŁ W GŁOWĘ", "ZADETEK V GLAVO"],
    "MONSTERS {0}/{1}": [
        "MONSTER {0}/{1}",
        "POTWORY {0}/{1}",
        "POŠASTI {0}/{1}",
    ],
    "1 SWORD": ["1 SCHWERT", "1 MIECZ", "1 MEČ"],
    "2 BOW": ["2 BOGEN", "2 ŁUK", "2 LOK"],
    "GROVE HALL": ["HAINHALLE", "SALA GAJU", "DVORANA GAJA"],
    GALLERY: ["GALERIE", "GALERIA", "GALERIJA"],
    "GUEST CHAMBER": ["GÄSTEKAMMER", "KOMNATA GOŚCINNA", "SOBA ZA GOSTE"],
    "THRONE HALL": ["THRONSAAL", "SALA TRONOWA", "PRESTOLNA DVORANA"],
    "THE KEEP IS FREE": [
        "DIE FESTUNG IST FREI",
        "TWIERDZA WOLNA",
        "TRDNJAVA JE SVOBODNA",
    ],
    FALLEN: ["GEFALLEN", "UPADEK", "PADEC"],
    "All ten monsters lie slain. Moonshadow Keep is elven again.": [
        "Alle zehn Monster liegen erschlagen. Moonshadow Keep ist wieder elfisch.",
        "Dziesięć potworów leży martwych. Moonshadow Keep znów należy do elfów.",
        "Vseh deset pošasti leži pobitih. Moonshadow Keep je spet vilinski.",
    ],
    "The monsters have overwhelmed you.": [
        "Die Monster haben dich überwältigt.",
        "Potwory cię pokonały.",
        "Pošasti so te premagale.",
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
    "Left thumb: move   Right thumb: aim   ATTACK: strike, shoot   Tap a weapon to choose it   II: menu":
        [
            "Linker Daumen: bewegen   Rechter Daumen: zielen   ANGRIFF: zuschlagen, schießen   Waffe antippen zum Wechseln   II: Menü",
            "Lewy kciuk: ruch   Prawy kciuk: celowanie   ATAK: cios, strzał   Dotknij broni, aby ją wybrać   II: menu",
            "Levi palec: premik   Desni palec: merjenje   NAPAD: udarec, strel   Tapni orožje za izbiro   II: meni",
        ],
    ATTACK: ["ANGRIFF", "ATAK", "NAPAD"],
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
