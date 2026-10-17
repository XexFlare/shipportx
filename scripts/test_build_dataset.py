"""Coordinate parsing tests. Run with: python -m unittest discover scripts"""
import unittest

from build_dataset import latlon_sign_conflict, parse_latlon


class ParseLatLonTest(unittest.TestCase):
    def test_decimal_with_hemisphere_letters(self):
        self.assertEqual(parse_latlon("-4.322°S, 15.307°E"), (-4.322, 15.307))
        self.assertEqual(parse_latlon("4.0475° S, 39.6350° E"), (-4.0475, 39.635))

    def test_degrees_minutes_seconds_are_converted_in_full(self):
        # Dakar was published as 14.0, -17.0 before minutes and seconds were read.
        self.assertEqual(
            parse_latlon('14°40\'50"N, 17°25\'40"W (≈14.681°N, -17.4275°W per independent cross-check)'),
            (14.680556, -17.427778),
        )
        self.assertEqual(parse_latlon('11°36\'19"N, 43°08\'21"E'), (11.605278, 43.139167))

    def test_bracketed_dms_note_after_decimal_is_ignored(self):
        self.assertEqual(parse_latlon("≈-12.95°, 40.47° (S 12°57', E 040°28')"), (-12.95, 40.47))
        self.assertEqual(parse_latlon('4.90000° N, 1.73333° W (04°54\'00"N 01°44\'00"W)'), (4.9, -1.73333))

    def test_unknown_value_gives_no_coordinates(self):
        self.assertEqual(parse_latlon("Not independently established in this research pass (Doraleh area)"), (None, None))

    def test_sign_that_contradicts_letter_is_reported(self):
        # Mombasa was written "-4.0475° N" and published north of the equator.
        self.assertTrue(latlon_sign_conflict("-4.0475° N, 39.6350° E"))
        self.assertTrue(latlon_sign_conflict("20.9°N, -17.05°E"))
        self.assertFalse(latlon_sign_conflict("-4.322°S, 15.307°E"))
        self.assertFalse(latlon_sign_conflict("20.9°N, 17.05°W"))


if __name__ == "__main__":
    unittest.main()
