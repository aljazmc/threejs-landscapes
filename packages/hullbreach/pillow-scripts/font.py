"""Write src/res/<theme>-font.fnt and .png: the Pixel Operator pixel font
(12 px, an XML .fnt with its .png atlas beside it) with the Polish and
Slovenian letters it lacks, composed from the letters and accents it has.
German needs nothing new.

usage: python3 pillow-scripts/font.py <font.fnt> <theme>
"""

import os
import sys
import xml.etree.ElementTree as ET

from PIL import Image

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CELL = 24  # glyphs are composed in cells this size, the cursor at (4, 0)


def load(fnt):
    tree = ET.parse(fnt)
    atlas = Image.open(os.path.splitext(fnt)[0] + ".png").convert("RGBA")
    glyphs = {}
    for char in tree.getroot().iter("Char"):
        x, y, w, h = map(int, char.get("rect").split())
        dx, dy = map(int, char.get("offset").split())
        cell = Image.new("RGBA", (CELL, CELL))
        if w and h:
            cell.paste(atlas.crop((x, y, x + w, y + h)), (4 + dx, dy))
        glyphs[char.get("code")] = (cell, int(char.get("width")))
    return tree, atlas, glyphs


def ink_box(cell):
    return cell.getchannel("A").getbbox()


def difference(accented, base):
    """The accent: pixels of the accented letter that the base lacks."""
    a, b = accented.getchannel("A"), base.getchannel("A")
    out = Image.new("RGBA", (CELL, CELL))
    for y in range(CELL):
        for x in range(CELL):
            if a.getpixel((x, y)) and not b.getpixel((x, y)):
                out.putpixel((x, y), accented.getpixel((x, y)))
    return out


def centered(accent, over, model):
    """Shift the accent from above the model letter to above another one."""
    target, source = ink_box(over), ink_box(model)
    shift = ((target[0] + target[2]) - (source[0] + source[2])) // 2
    out = Image.new("RGBA", (CELL, CELL))
    out.paste(accent, (shift, 0))
    return out


def compose(*layers):
    out = Image.new("RGBA", (CELL, CELL))
    for layer in layers:
        out.alpha_composite(layer)
    return out


def flipped(image):
    """Upside down within its own ink box (a circumflex becomes a caron)."""
    box = ink_box(image)
    out = Image.new("RGBA", (CELL, CELL))
    out.paste(image.crop(box).transpose(Image.FLIP_TOP_BOTTOM), box[:2])
    return out


def single_dot(diaeresis):
    """The left dot of a diaeresis, moved to the middle."""
    box = ink_box(diaeresis)
    dot = diaeresis.crop(box)
    column = 0
    while column < dot.width and dot.getchannel("A").getpixel((column, 0)):
        column += 1
    out = Image.new("RGBA", (CELL, CELL))
    out.paste(dot.crop((0, 0, column, dot.height)),
              ((box[0] + box[2] - column) // 2, box[1]))
    return out


def ogonek(cedilla, base):
    """A cedilla mirrored and hung under the right end of the letter."""
    box, own = ink_box(base), ink_box(cedilla)
    mark = cedilla.crop(own).transpose(Image.FLIP_LEFT_RIGHT)
    out = Image.new("RGBA", (CELL, CELL))
    out.paste(mark, (box[2] - mark.width, box[3] - 1))
    return out


def stroke(base):
    """Ł and ł: a short slash across the stem, at mid-height."""
    box = ink_box(base)
    alpha = base.getchannel("A")
    stem = next(x for x in range(box[0], box[2]) if alpha.getpixel((x, box[1])))
    middle = (box[1] + box[3]) // 2 + (1 if box[3] - box[1] > 8 else 0)
    out = base.copy()
    for dx, dy in ((-1, 1), (1, -1), (2, -2)):
        out.putpixel((stem + dx, middle + dy), (255, 255, 255, 255))
    return out


def extend(fnt, theme):
    tree, atlas, glyphs = load(fnt)
    cell = {code: image for code, (image, _) in glyphs.items()}
    acute = {case: difference(cell[a], cell[b]) for case, a, b in
             (("lower", "á", "a"), ("upper", "Á", "A"))}
    caron = {case: flipped(difference(cell[a], cell[b])) for case, a, b in
             (("lower", "â", "a"), ("upper", "Â", "A"))}
    dot = {case: single_dot(difference(cell[a], cell[b])) for case, a, b in
           (("lower", "ä", "a"), ("upper", "Ä", "A"))}
    model = {"lower": cell["a"], "upper": cell["A"]}
    cedilla = difference(cell["ç"], cell["c"])

    new = {}
    for letters, marks in (("ćńśź", acute), ("čšž", caron), ("ż", dot)):
        for letter in letters + letters.upper():
            base = letter.translate(str.maketrans("ćńśźčšžżĆŃŚŹČŠŽŻ", "cnszcszzCNSZCSZZ"))
            case = "lower" if letter.islower() else "upper"
            new[letter] = (compose(cell[base], centered(marks[case], cell[base], model[case])),
                           glyphs[base][1])
    for letter, base in (("ą", "a"), ("ę", "e"), ("Ą", "A"), ("Ę", "E")):
        new[letter] = (compose(cell[base], ogonek(cedilla, cell[base])), glyphs[base][1])
    for letter, base in (("ł", "l"), ("Ł", "L")):
        new[letter] = (stroke(cell[base]), glyphs[base][1] + (1 if base == "l" else 0))

    # pack the new letters under the old ones, in a taller atlas
    top = max(int(c.get("rect").split()[1]) + int(c.get("rect").split()[3])
              for c in tree.getroot().iter("Char")) + 2
    sheet = Image.new("RGBA", (atlas.width, top + 2 * 16 + 4))
    sheet.paste(atlas, (0, 0))
    x, y = 1, top
    font = tree.getroot()
    for code, (image, width) in sorted(new.items()):
        box = ink_box(image)
        w, h = box[2] - box[0], box[3] - box[1]
        if x + w + 1 > sheet.width:
            x, y = 1, y + 16
        sheet.paste(image.crop(box), (x, y))
        ET.SubElement(font, "Char", width=str(width),
                      offset=f"{box[0] - 4} {box[1]}", rect=f"{x} {y} {w} {h}",
                      code=code)
        x += w + 2

    output = os.path.join(root_dir, "src", "res", theme + "-font")
    sheet.save(output + ".png")
    ET.indent(tree, " ")
    tree.write(output + ".fnt", encoding="utf-8", xml_declaration=True)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__.strip().splitlines()[-1])
    extend(sys.argv[1], sys.argv[2])
