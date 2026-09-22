"""Build and verify the local Mac transfer archive from this checkout."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "diario-lavoro-web-mac-2026-09-22.zip"
FIXED_TIME = (2026, 9, 22, 0, 0, 0)


def sources():
    files = [ROOT / name for name in ("index.html", "styles.css", "sw.js", "README.md", "CONTEXT.md")]
    patterns = (
        "src/*.js",
        "diagnostics/*.html",
        "diagnostics/*.js",
        "docs/**/*.md",
        ".scratch/diario-di-lavoro/**/*.md",
        "test/*.js",
        "test/fixtures/*.wav",
        "scripts/*.ps1",
        "scripts/package-mac.py",
    )
    for pattern in patterns:
        files.extend(path for path in ROOT.glob(pattern) if path.is_file())
    if not all(path.is_file() for path in files):
        raise FileNotFoundError("A required transfer file is missing")
    return sorted(set(files), key=lambda path: path.relative_to(ROOT).as_posix())


def main():
    files = sources()
    with ZipFile(ARCHIVE, "w", ZIP_DEFLATED, compresslevel=9, allowZip64=True) as archive:
        for path in files:
            name = path.relative_to(ROOT).as_posix()
            entry = ZipInfo(name, FIXED_TIME)
            entry.compress_type = ZIP_DEFLATED
            archive.writestr(entry, path.read_bytes(), compress_type=ZIP_DEFLATED, compresslevel=9)
    with ZipFile(ARCHIVE) as archive:
        names = archive.namelist()
        if archive.testzip() or names != [path.relative_to(ROOT).as_posix() for path in files]:
            raise RuntimeError("Transfer archive failed integrity or manifest verification")
        for path in files:
            name = path.relative_to(ROOT).as_posix()
            if archive.read(name) != path.read_bytes():
                raise RuntimeError(f"Transfer archive differs from checkout: {name}")
    print(f"Verified {len(files)} files in {ARCHIVE.name}")


if __name__ == "__main__":
    main()
