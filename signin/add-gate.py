# Puts the sign-in screen on every page of the build site except /signin/ and /link/.
# Run from the gh-pages root after each deploy: python3 signin/add-gate.py
import pathlib
TAG = '<script src="/signin/gate.js"></script>'
for p in sorted(pathlib.Path(".").rglob("*.html")):
    if p.parts[0] in ("signin", "link", ".git"):
        continue
    s = p.read_text(encoding="utf-8")
    if TAG in s:
        continue
    # Right after <head> or the charset tag, so it runs before anything on the page shows.
    low = s.lower()
    i = low.find("<head>")
    i = i + 6 if i >= 0 else (low.find(">", low.find("<meta charset")) + 1 if "<meta charset" in low else 0)
    p.write_text(s[:i] + TAG + s[i:], encoding="utf-8")
    print("gated:", p)
