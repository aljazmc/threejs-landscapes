"""ban() of inkscape-scripts/osm/bans.py: a place is a listed employer only
when its address and a distinctive word of the employer's registered name
both match. An address alone must never do, as several firms share
buildings. Needs only the standard library; the employers are made up."""

import sys
import unittest
from pathlib import Path

PACKAGE = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PACKAGE / "inkscape-scripts/osm"))

import bans  # noqa: E402 (after the path to the scripts)

STREET = {"addr:street": "Vzorčna ulica", "addr:housenumber": "5",
          "addr:postcode": "2250"}


def employer(name, until, street="Vzorčna ulica 5", post="2250 Ptuj"):
    return {"name": name, "address": bans.address(street, post),
            "until": until}


LIST = {"listed": "2026-11-01", "employers": [
    employer("Kovinarstvo Primerek d.o.o.", "2027-03-01"),
    employer("Primerek, gostinske storitve, d.o.o.", "2026-12-15",
             street="Drugi trg 1"),
    employer("Okrepčevalnica Zgledek, s.p.", "2027-01-10"),
]}


def place(**tags):
    return {**STREET, **tags}


class BanTest(unittest.TestCase):
    def test_address_and_name_word(self):
        self.assertEqual(bans.ban(place(name="Primerek"), LIST), "2027-03-01")

    def test_address_alone_is_not_enough(self):
        self.assertIsNone(bans.ban(place(name="Pekarna Kruhek"), LIST))
        self.assertIsNone(bans.ban(place(), LIST))

    def test_name_alone_is_not_enough(self):
        tags = place(name="Primerek")
        tags["addr:housenumber"] = "7"
        self.assertIsNone(bans.ban(tags, LIST))

    def test_generic_words_tell_nothing(self):
        # "okrepcevalnica" is a trade, Zgledek the name
        self.assertIsNone(bans.ban(place(name="Okrepčevalnica"), LIST))
        self.assertEqual(bans.ban(place(name="Bar Zgledek"), LIST),
                         "2027-01-10")

    def test_operator_and_email_count_without_marks(self):
        self.assertEqual(bans.ban(place(operator="ZGLEDEK"), LIST),
                         "2027-01-10")
        self.assertEqual(bans.ban(place(email="info@primerek.si"), LIST),
                         "2027-03-01")

    def test_street_without_marks(self):
        self.assertEqual(
            bans.ban(place(**{"addr:street": "Vzorcna  ulica"},
                           name="Primerek"), LIST),
            "2027-03-01")

    def test_latest_ban_of_matching_employers(self):
        both = place(name="Primerek Zgledek")
        self.assertEqual(bans.ban(both, LIST), "2027-03-01")

    def test_known_places_by_registered_name(self):
        element, name = next(iter(bans.KNOWN.items()))
        known = {"listed": LIST["listed"],
                 "employers": [employer(name, "2027-05-05", "Kjerkoli 9")]}
        self.assertEqual(bans.ban({}, known, element), "2027-05-05")

    def test_no_list(self):
        self.assertIsNone(bans.ban(place(name="Primerek"), None))


if __name__ == "__main__":
    unittest.main()
