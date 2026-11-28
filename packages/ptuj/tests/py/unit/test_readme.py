"""The README gives the date of the list of bans that src/map/ptuj.json was
built from, so it is changed whenever the map is built from a newer list.
Needs only the standard library."""

import json
import unittest
from datetime import date
from pathlib import Path

PACKAGE = Path(__file__).resolve().parents[3]
# in English whatever the locale
MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]


class TestReadme(unittest.TestCase):
    def test_the_date_of_the_list_of_bans(self):
        plan = json.loads((PACKAGE / "src/map/ptuj.json").read_text("utf-8"))
        listed = date.fromisoformat(plan["bans"]["listed"])
        day = f"{listed.day} {MONTHS[listed.month - 1]} {listed.year}"
        readme = (PACKAGE / "README.md").read_text("utf-8")
        self.assertIn(f"uses the list of {day}.", readme,
                      "update the date of the list in README.md")


if __name__ == "__main__":
    unittest.main()
