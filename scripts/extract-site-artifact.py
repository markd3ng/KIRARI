#!/usr/bin/env python3

"""Safely extract GitHub Actions artifact ZIPs into a new directory."""

from __future__ import annotations

import os
import shutil
import stat
import sys
import unicodedata
import zipfile
from pathlib import Path, PurePosixPath


MAX_ENTRIES = 100_000
MAX_FILE_BYTES = 1_073_741_824
MAX_TOTAL_BYTES = 2_147_483_648
MAX_PATH_BYTES = 4_096
MAX_PATH_DEPTH = 64
MAX_COMPRESSION_RATIO = 1_000


class ArchiveRejected(Exception):
    pass


def fail(message: str) -> None:
    raise ArchiveRejected(message)


def normalized_name(info: zipfile.ZipInfo) -> tuple[str, bool]:
    raw_name = info.filename
    if not raw_name or "\x00" in raw_name or "\\" in raw_name:
        fail("unsafe path")

    is_directory = info.is_dir()
    name = raw_name[:-1] if is_directory else raw_name
    if not name or name.startswith("/") or name.startswith("//"):
        fail("unsafe path")
    if unicodedata.normalize("NFC", name) != name:
        fail("non-normalized path")
    if len(name.encode("utf-8")) > MAX_PATH_BYTES:
        fail("path limit exceeded")

    path = PurePosixPath(name)
    parts = name.split("/")
    if path.is_absolute() or len(parts) > MAX_PATH_DEPTH:
        fail("unsafe path")
    if any(part in ("", ".", "..") for part in parts):
        fail("unsafe path")
    if any(":" in part for part in parts):
        fail("unsafe path")
    if path.as_posix() != name:
        fail("unsafe path")

    mode = stat.S_IFMT(info.external_attr >> 16)
    expected_mode = stat.S_IFDIR if is_directory else stat.S_IFREG
    if mode not in (0, expected_mode):
        fail("unsupported file type")
    if info.flag_bits & 0x1:
        fail("encrypted entries are unsupported")
    if info.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
        fail("unsupported compression method")
    if info.file_size < 0 or info.file_size > MAX_FILE_BYTES:
        fail("file size limit exceeded")
    if info.compress_size < 0:
        fail("invalid compressed size")
    if info.file_size and info.file_size > max(1, info.compress_size) * MAX_COMPRESSION_RATIO:
        fail("compression ratio limit exceeded")

    return name, is_directory


def safe_extract(archive_path: Path, destination: Path) -> int:
    if destination.exists() or destination.is_symlink():
        fail("destination must not already exist")
    destination.parent.mkdir(parents=True, exist_ok=True)
    root = destination.parent.resolve(strict=True) / destination.name
    destination.mkdir(mode=0o700)
    extracted = 0
    total_bytes = 0
    # Track explicit entries and implicit parents so file/directory conflicts
    # are rejected regardless of the order in which ZIP members appear.
    paths: dict[str, str] = {}
    explicit_entries: set[str] = set()

    try:
        with zipfile.ZipFile(archive_path) as package:
            entries = package.infolist()
            if len(entries) > MAX_ENTRIES:
                fail("entry count limit exceeded")

            for info in entries:
                name, is_directory = normalized_name(info)
                kind = "directory" if is_directory else "file"
                previous = paths.get(name)
                if previous and previous != kind:
                    fail("file/directory path conflict")
                if name in explicit_entries:
                    fail("duplicate path")
                explicit_entries.add(name)

                parts = name.split("/")
                for index in range(1, len(parts)):
                    parent_name = "/".join(parts[:index])
                    parent_entry = paths.get(parent_name)
                    if parent_entry == "file":
                        fail("file/directory path conflict")
                    paths.setdefault(parent_name, "directory")
                if not is_directory and any(
                    existing.startswith(name + "/") for existing in paths
                ):
                    fail("file/directory path conflict")
                paths[name] = kind

                if is_directory and (info.file_size != 0 or info.compress_size != 0):
                    fail("directory entries must be empty")

                target = root.joinpath(*parts)
                # `root` is new and contains only paths created below. ZIP
                # names have already been normalized to safe POSIX segments.
                if is_directory:
                    target.mkdir(mode=0o755, parents=True, exist_ok=True)
                    continue

                total_bytes += info.file_size
                if total_bytes > MAX_TOTAL_BYTES:
                    fail("archive size limit exceeded")
                target.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
                file_flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
                file_flags |= getattr(os, "O_NOFOLLOW", 0)
                descriptor = os.open(target, file_flags, 0o644)
                try:
                    with os.fdopen(descriptor, "wb") as output, package.open(info) as source:
                        shutil.copyfileobj(source, output, length=1024 * 1024)
                except Exception:
                    try:
                        os.close(descriptor)
                    except OSError:
                        pass
                    raise
                extracted += 1

        return extracted
    except Exception:
        shutil.rmtree(destination, ignore_errors=True)
        if isinstance(sys.exc_info()[1], ArchiveRejected):
            raise
        fail("invalid or unreadable ZIP archive")


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: extract-site-artifact.py <artifact.zip> <new-directory>", file=sys.stderr)
        return 2
    try:
        count = safe_extract(Path(sys.argv[1]), Path(sys.argv[2]))
    except ArchiveRejected as error:
        # Messages are static descriptions and never include attacker-supplied
        # member names, metadata, or remote response bodies.
        print(f"[site-artifact-extract] ERROR {error}", file=sys.stderr)
        return 1
    except (OSError, zipfile.BadZipFile, RuntimeError, EOFError):
        print("[site-artifact-extract] ERROR invalid or unreadable ZIP archive", file=sys.stderr)
        return 1
    print(f"[site-artifact-extract] extracted {count} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
