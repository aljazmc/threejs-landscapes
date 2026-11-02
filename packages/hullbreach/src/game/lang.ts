/**
 * The game's texts in every language and the language chosen in the menu.
 * A text is looked up by its English wording.
 */

export const NAMES = ["English", "Deutsch", "Polski", "Slovenščina"];

/** Where the chosen language is kept, by its name. */
const STORAGE_KEY = "hullbreach.language";

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
    "Press Enter to return to the main menu": [
        "Enter drücken, um zum Hauptmenü zurückzukehren",
        "Naciśnij Enter, aby wrócić do menu głównego",
        "Pritisni Enter za vrnitev v glavni meni",
    ],
    "VICTORY!": ["SIEG!", "ZWYCIĘSTWO!", "ZMAGA!"],
    DEFEAT: ["NIEDERLAGE", "PORAŻKA", "PORAZ"],
    "Paused. Play continues the mission.": [
        "Pause. Spielen setzt die Mission fort.",
        "Pauza. Graj wznawia misję.",
        "Premor. Igraj nadaljuje misijo.",
    ],
    "WASD / arrows: move   Mouse: aim   Space / left click: fire   1: laser gun   2: grenade launcher   Esc: menu":
        [
            "WASD / Pfeiltasten: bewegen   Maus: zielen   Leertaste / Linksklick: feuern   1: Laserwaffe   2: Granatwerfer   Esc: Menü",
            "WASD / strzałki: ruch   Mysz: celowanie   Spacja / lewy przycisk: strzał   1: działko laserowe   2: granatnik   Esc: menu",
            "WASD / puščice: premik   Miška: merjenje   Preslednica / levi klik: strel   1: laserska puška   2: metalec granat   Esc: meni",
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
    "HEALTH {0}": ["LEBEN {0}", "ZDROWIE {0}", "ZDRAVJE {0}"],
    "HOSTILES {0}/{1}": [
        "FEINDE {0}/{1}",
        "WROGOWIE {0}/{1}",
        "SOVRAŽNIKI {0}/{1}",
    ],
    "1 LASER": ["1 LASER", "1 LASER", "1 LASER"],
    "2 LAUNCHER": ["2 WERFER", "2 GRANATY", "2 GRANATE"],
    "ENGINE ROOM": ["MASCHINENRAUM", "MASZYNOWNIA", "STROJNICA"],
    "PERSONNEL DECK": ["PERSONALDECK", "POKŁAD ZAŁOGI", "PALUBA OSEBJA"],
    "CREW CABIN": ["CREWKABINE", "KAJUTA ZAŁOGI", "KABINA POSADKE"],
    "CONTROL ROOM": ["KONTROLLRAUM", "STERÓWKA", "KONTROLNA SOBA"],
    "SHIP CLEARED": [
        "SCHIFF GESÄUBERT",
        "STATEK OCZYSZCZONY",
        "LADJA OČIŠČENA",
    ],
    "KILLED IN ACTION": [
        "IM EINSATZ GEFALLEN",
        "ŚMIERĆ W AKCJI",
        "SMRT V AKCIJI",
    ],
    "All ten alien boarders are dead. The ship is yours again.": [
        "Alle zehn außerirdischen Enterer sind tot. Das Schiff gehört wieder dir.",
        "Wszyscy obcy abordażyści nie żyją. Statek znów należy do ciebie.",
        "Vseh deset vesoljskih zavojevalcev je mrtvih. Ladja je spet tvoja.",
    ],
    "The aliens' claws got the better of you.": [
        "Die Klauen der Aliens waren stärker.",
        "Szpony obcych okazały się silniejsze.",
        "Kremplji vesoljcev so bili močnejši.",
    ],
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
