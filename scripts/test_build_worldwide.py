"""Worldwide merge tests. Run with: python -m unittest discover scripts"""
import unittest

from build_worldwide import merge


def sp(port_id, name, lat, lon, unlocode=None, **extra):
    rec = {"port_id": port_id, "official_name": name, "country": "Kenya", "country_code": port_id[:2],
           "latitude": lat, "longitude": lon, "unlocode": unlocode, "research_status": "VERIFIED",
           "port_type_primary": "major_commercial", "max_draft_m": None, "channel_depth_m": None}
    rec.update(extra)
    return rec


def wpi(number, name, cc, lat, lon, unlocode=None, **extra):
    port = {"portNumber": number, "portName": name, "countryCode": cc, "countryName": cc,
            "ycoord": lat, "xcoord": lon, "unloCode": unlocode, "harborSize": "M", "harborType": "CN"}
    port.update(extra)
    return port


class MergeTest(unittest.TestCase):
    def test_shipportx_wins_on_unlocode_match(self):
        records, matches, _ = merge(
            [sp("KE-mombasa", "Port of Mombasa", -4.0475, 39.635, "KEMBA", max_draft_m="15 m")],
            [wpi(47100, "Mombasa", "KE", -4.067, 39.667, "KE MBA", maxVesselDraft="11")],
        )
        self.assertEqual([r["id"] for r in records], ["KE-mombasa"])
        self.assertEqual(records[0]["max_draft_m"], 15.0)
        self.assertEqual(records[0]["wpi_port_numbers"], [47100])
        self.assertEqual(matches[0]["method"], "unlocode")

    def test_rest_of_world_comes_from_wpi_with_source(self):
        records, _, _ = merge([], [wpi(48430, "Abadan", "IR", 30.33, 48.28, "IR ABD", chDepth="9")])
        self.assertEqual(records[0]["id"], "WPI-48430")
        self.assertEqual((records[0]["source"], records[0]["scope"]), ("wpi", "world"))
        self.assertEqual(records[0]["unlocode"], "IRABD")
        self.assertTrue(records[0]["ocean_going"])

    def test_non_african_wpi_ports_are_never_merged_into_shipportx(self):
        records, matches, _ = merge([sp("KE-x", "X", 1.0, 1.0, "IRABD")], [wpi(1, "Abadan", "IR", 1.0, 1.0, "IR ABD")])
        self.assertEqual(len(records), 2)
        self.assertEqual(matches, [])

    def test_nearby_terminal_with_a_different_name_stays_separate(self):
        records, matches, _ = merge(
            [sp("SN-dakar", "Port Autonome de Dakar", 14.68, -17.43)],
            [wpi(1, "M Bao Oil Terminal", "SN", 14.72, -17.41)],
        )
        self.assertEqual(matches, [])
        self.assertEqual({r["id"] for r in records}, {"SN-dakar", "WPI-1"})
        self.assertEqual(records[1]["scope"], "africa")

    def test_similar_name_matches_within_radius(self):
        _, matches, _ = merge([sp("LY-misrata", "Port of Misrata", 32.37, 15.21)], [wpi(1, "Misratah", "LY", 32.38, 15.23)])
        self.assertEqual(matches[0]["method"], "proximity_and_name")

    def test_wpi_values_become_research_leads_not_data(self):
        records, _, leads = merge(
            [sp("CD-matadi", "Port of Matadi", None, None, "CDMAT")],
            [wpi(46530, "Matadi", "CD", -5.82, 13.45, "CD MAT", maxVesselDraft="8")],
        )
        self.assertIsNone(records[0]["latitude"])
        self.assertEqual(leads[0]["wpi_values"]["max_draft_m"], 8.0)
        self.assertIn("coordinates", leads[0]["wpi_values"])

    def test_lake_ports_are_not_ocean_going(self):
        records, _, _ = merge([sp("MW-monkey-bay", "Monkey Bay", -14.08, 34.92, port_type_primary="lake_port")], [])
        self.assertFalse(records[0]["ocean_going"])


if __name__ == "__main__":
    unittest.main()
