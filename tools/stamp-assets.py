#!/usr/bin/env python3
"""Stamp cache-busting versions into index.html: vision.js?v=<hash>, pivots.js?v=<hash>.
The hash is taken from each file's content, so browsers re-download a file only when it changed.
Run after editing vision.js or pivots.js (staging's deploy runs it too). Use --check to fail if stale."""
import hashlib, re, sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)) + '/..')
html = open('index.html', encoding='utf-8').read()
out = html
for f in ('vision.js', 'pivots.js'):
    h = hashlib.sha256(open(f, 'rb').read()).hexdigest()[:10]
    pat = r'(src="' + re.escape(f) + r'\?v=)[^"]*(")'
    if not re.search(pat, out):
        sys.exit('stamp-assets: no <script src="%s?v=..."> in index.html' % f)
    out = re.sub(pat, r'\g<1>' + h + r'\g<2>', out)
if '--check' in sys.argv:
    if out != html:
        sys.exit('stamp-assets: index.html versions are STALE - run python3 tools/stamp-assets.py')
    print('stamp-assets: versions up to date')
else:
    open('index.html', 'w', encoding='utf-8').write(out)
    print('stamp-assets: ' + ', '.join(re.findall(r'src="((?:vision|pivots)\.js\?v=[^"]*)"', out)))
