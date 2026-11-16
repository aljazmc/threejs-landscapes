"""The Employment Service of Slovenia's (ESS) list of employers banned from
employing foreigners (Seznam delodajalcev s prepovedjo zaposlovanja
tujcev), as fetch.py downloads it into bans.xlsx, and which places of the
map it names.

A place is taken to be a listed employer only when both agree: the
place's address in OpenStreetMap (post code, street and house number) is
the employer's, and a distinctive word of the employer's registered name
(not one of its trades, as "gostinske storitve", nor its legal form) is in
the place's name, operator or e-mail. A place at a listed address but
under another name, as one of several firms in one building, is not.
Places known to be a listed employer the data can't tell are in KNOWN.

    python3 bans.py <data directory>   lists the matches, to check them
"""
import datetime
import json
import os
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
import zipfile

SOURCE = ("Zavod RS za zaposlovanje (ESS): Seznam delodajalcev s prepovedjo "
          "zaposlovanja tujcev")
MAIN = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
# the words of the registered names that tell nothing of who it is
GENERIC = set("""
    in za ter na pri od do the and
    doo dd sp dno ko zoo
    podjetje druzba proizvodnjo proizvodnja proizvodno storitve storitev
    storitveno storitvene druge drugo ostale ostalo gostinske gostinska
    gostinstvo gostinski trgovina trgovsko trgovske trgovino uvoz izvoz
    gradbenistvo gradbena gradbeni dela inzeniring montaze montaza
    instalacije posrednistvo dejavnost dejavnosti sportna prevozi prevozni
    prevozniske avtoprevoznistvo restavracija kavarna bar okrepcevalnica
    gostilna pizzeria picerija stecaju likvidaciji ptuj ptuju maribor
    ljubljana celje
""".split())
# places of the map known to be a listed employer, though their tags don't
# say so (OpenStreetMap element: the employer's registered name in the
# list); the end of the ban still comes from the list, so it lapses with it
KNOWN = {
    # Footbar, Čučkova ulica 6A: the club's bar, the club listed at 7
    "node/11601429080": "Nogometni klub Drava Ptuj",
    # Kavarna Evropa Ptuj, Mestni trg 2: OSM doesn't name who runs it
    "node/10862087003": "B&S Sija, gostinske storitve, d.o.o.",
}


def plain(text):
    """Lower case, without the marks over letters (č is c)."""
    text = unicodedata.normalize("NFKD", text.casefold())
    return "".join(c for c in text if not unicodedata.combining(c))


def words(text):
    return set(re.findall(r"[a-z0-9]+", plain(text)))


def rows(path):
    """The rows of the first sheet of an xlsx file, as lists of text."""
    book = zipfile.ZipFile(path)
    shared = []
    if "xl/sharedStrings.xml" in book.namelist():
        for item in ET.fromstring(book.read("xl/sharedStrings.xml")):
            shared.append("".join(t.text or "" for t in item.iter(MAIN + "t")))
    sheet = ET.fromstring(book.read("xl/worksheets/sheet1.xml"))
    result = []
    for row in sheet.iter(MAIN + "row"):
        cells = {}
        for cell in row.iter(MAIN + "c"):
            column = 0
            for letter in re.match(r"[A-Z]+", cell.get("r")).group():
                column = column * 26 + ord(letter) - 64
            value = cell.find(MAIN + "v")
            if cell.get("t") == "s" and value is not None:
                text = shared[int(value.text)]
            elif cell.get("t") == "inlineStr":
                text = "".join(t.text or "" for t in cell.iter(MAIN + "t"))
            else:
                text = value.text if value is not None else ""
            cells[column - 1] = (text or "").strip()
        result.append([cells.get(k, "") for k in range(max(cells, default=-1)
                                                       + 1)])
    return result


def day(text):
    """A date of the list (d. m. yyyy or dd.mm.yyyy) as yyyy-mm-dd."""
    d, m, y = (int(part) for part in re.findall(r"\d+", text)[:3])
    return datetime.date(y, m, d).isoformat()


def address(street, post):
    """An address to compare: the post code, street and house number."""
    code = re.match(r"\s*(\d{4})", post or "")
    return (code.group(1) if code else "", re.sub(r"\s+", "", plain(street)))


def load(directory):
    """The date of the list and its employers, each with the latest end of
    its bans, or None without the list."""
    path = os.path.join(directory, "bans.xlsx")
    if not os.path.exists(path):
        return None
    table = rows(path)
    listed = next(day(r[0]) for r in table if r and re.search(r"\d{4}",
                                                               r[0]))
    employers = {}
    for row in table:
        if len(row) < 6 or not re.match(r"\d", row[0] or ""):
            continue
        number, name, street, post, _, until = row[:6]
        employer = employers.setdefault(number, {
            "name": name, "address": address(street, post), "until": ""})
        employer["until"] = max(employer["until"], day(until))
    return {"listed": listed, "employers": list(employers.values())}


def ban(tags, bans, element=None):
    """The latest end of the bans of the employer a place of the map is,
    as yyyy-mm-dd, or None; element is its OpenStreetMap type/id."""
    if not bans:
        return None
    if element in KNOWN:
        until = [e["until"] for e in bans["employers"]
                 if e["name"] == KNOWN[element]]
        return max(until, default=None)
    street = tags.get("addr:street") or tags.get("addr:place") or ""
    where = address(f"{street} {tags.get('addr:housenumber', '')}",
                    tags.get("addr:postcode", ""))
    if not where[0] or not street:
        return None
    said = " ".join(tags.get(key, "") for key in ("name", "operator",
                                                  "email"))
    known = words(said)
    blob = re.sub(r"[^a-z0-9]", "", plain(said))
    found = None
    for employer in bans["employers"]:
        if employer["address"] != where:
            continue
        distinct = words(employer["name"]) - GENERIC
        if any(w in known or (len(w) >= 5 and w in blob) for w in distinct
               if len(w) >= 3):
            found = max(found or "", employer["until"])
    return found


if __name__ == "__main__":
    directory = sys.argv[1]
    bans = load(directory)
    print("list of", bans["listed"], "-", len(bans["employers"]),
          "employers")
    with open(os.path.join(directory, "pois.json")) as file:
        for element in json.load(file)["elements"]:
            until = ban(element.get("tags", {}), bans,
                        f"{element['type']}/{element['id']}")
            if until:
                print(until, element["tags"].get("name"), "-",
                      element["tags"].get("addr:street"),
                      element["tags"].get("addr:housenumber"))
