import tempfile
import unittest
from pathlib import Path

from smoothradio import MetadataDB


class MetadataDBTests(unittest.TestCase):
    def test_creates_parent_directory_and_database_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "nested" / "cache" / "metadata.db"
            self.assertFalse(db_path.parent.exists())

            db = MetadataDB(db_path)

            self.assertTrue(db_path.parent.exists())
            self.assertEqual(db.count(), 0)
            self.assertTrue(db_path.exists())

    def test_set_and_get_bucket_with_path_normalization(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = MetadataDB(Path(tmp) / "metadata.db")
            relative_path = Path(tmp) / "subdir" / ".." / "file.txt"

            db.set_bucket(relative_path, "docs")

            expected_key = str(relative_path.expanduser().resolve())
            self.assertEqual(db.get_bucket(relative_path), "docs")
            self.assertEqual(db.get_bucket(expected_key), "docs")
            self.assertEqual(db.all_buckets(), {expected_key: "docs"})

    def test_persists_across_instances(self):
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "metadata.db"
            db1 = MetadataDB(db_path)
            db1.set_bucket("one.txt", "alpha")

            db2 = MetadataDB(db_path)
            self.assertEqual(db2.get_bucket("one.txt"), "alpha")
            self.assertEqual(db2.count(), 1)

    def test_set_bucket_upserts_existing_entry(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = MetadataDB(Path(tmp) / "metadata.db")

            db.set_bucket("dup.txt", "first")
            db.set_bucket("dup.txt", "second")

            self.assertEqual(db.count(), 1)
            self.assertEqual(db.get_bucket("dup.txt"), "second")

    def test_set_bucket_rejects_empty_bucket_name(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = MetadataDB(Path(tmp) / "metadata.db")

            with self.assertRaises(ValueError):
                db.set_bucket("file.txt", "")

            with self.assertRaises(ValueError):
                db.set_bucket("file.txt", None)  # type: ignore[arg-type]

    def test_set_many_inserts_and_updates(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = MetadataDB(Path(tmp) / "metadata.db")

            db.set_many(
                [
                    ("a.txt", "alpha"),
                    ("b.txt", "beta"),
                    ("a.txt", "gamma"),
                ]
            )

            self.assertEqual(db.count(), 2)
            self.assertEqual(db.get_bucket("a.txt"), "gamma")
            self.assertEqual(db.get_bucket("b.txt"), "beta")

    def test_set_many_ignores_entries_with_empty_bucket_name(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = MetadataDB(Path(tmp) / "metadata.db")

            db.set_many(
                [
                    ("a.txt", "alpha"),
                    ("b.txt", ""),
                    ("c.txt", None),  # type: ignore[list-item]
                ]
            )

            self.assertEqual(db.count(), 1)
            self.assertEqual(db.get_bucket("a.txt"), "alpha")
            self.assertIsNone(db.get_bucket("b.txt"))
            self.assertIsNone(db.get_bucket("c.txt"))

    def test_set_many_with_only_empty_values_is_noop(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = MetadataDB(Path(tmp) / "metadata.db")
            db.set_bucket("seed.txt", "seed")

            db.set_many([("drop.txt", ""), ("none.txt", None)])  # type: ignore[list-item]

            self.assertEqual(db.count(), 1)
            self.assertEqual(db.get_bucket("seed.txt"), "seed")
            self.assertIsNone(db.get_bucket("drop.txt"))

    def test_all_buckets_returns_normalized_absolute_keys(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = MetadataDB(Path(tmp) / "metadata.db")
            db.set_many([("alpha.txt", "a"), ("beta.txt", "b")])

            expected = {
                str(Path("alpha.txt").resolve()): "a",
                str(Path("beta.txt").resolve()): "b",
            }
            self.assertEqual(db.all_buckets(), expected)

    def test_delete_returns_true_only_when_row_is_deleted(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = MetadataDB(Path(tmp) / "metadata.db")
            db.set_bucket("existing.txt", "x")

            self.assertTrue(db.delete("existing.txt"))
            self.assertFalse(db.delete("existing.txt"))
            self.assertIsNone(db.get_bucket("existing.txt"))

    def test_list_by_bucket_is_sorted(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = MetadataDB(Path(tmp) / "metadata.db")
            db.set_many(
                [
                    ("z.txt", "bucket"),
                    ("a.txt", "bucket"),
                    ("m.txt", "other"),
                ]
            )

            expected = sorted(
                [
                    str(Path("z.txt").resolve()),
                    str(Path("a.txt").resolve()),
                ]
            )
            self.assertEqual(db.list_by_bucket("bucket"), expected)
            self.assertEqual(db.list_by_bucket("missing"), [])

    def test_clear_removes_all_rows(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = MetadataDB(Path(tmp) / "metadata.db")
            db.set_many([("a.txt", "x"), ("b.txt", "y")])
            self.assertEqual(db.count(), 2)

            db.clear()

            self.assertEqual(db.count(), 0)
            self.assertEqual(db.all_buckets(), {})


if __name__ == "__main__":
    unittest.main()
