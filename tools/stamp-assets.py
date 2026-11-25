#!/usr/bin/env python3
"""Stamp cache-busting versions: shipments_v2.js?v=<hash> into vision.js, then vision.js?v=<hash>, pivots.js?v=<hash> into index.html.
The hash is taken from each file's content, so browsers re-download a file only when it changed.
Run after editing vision.js or pivots.js (staging's deploy runs it too). Use --check to fail if stale."""
import hashlib, re, sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)) + '/..')
# shipments_v2.js is loaded on demand from vision.js, so its hash goes into vision.js first
# (which then changes vision.js's own hash below).
vjs = open('vision.js', encoding='utf-8').read()
sh = hashlib.sha256(open('shipments_v2.js', 'rb').read()).hexdigest()[:10]
vpat = r"(shipments_v2\.js\?v=)[^'\"]*"
if not re.search(vpat, vjs):
    sys.exit('stamp-assets: no shipments_v2.js?v= in vision.js')
vout = re.sub(vpat, r'\g<1>' + sh, vjs)
if vout != vjs:
    if '--check' in sys.argv:
        sys.exit('stamp-assets: vision.js shipments_v2.js version is STALE - run python3 tools/stamp-assets.py')
    open('vision.js', 'w', encoding='utf-8').write(vout)
html = open('index.html', encoding='utf-8').read()
out = html
for f in ('vision.js', 'pivots.js'):
    h = hashlib.sha256(open(f, 'rb').read()).hexdigest()[:10]
    pat = r'(src="' + re.escape(f) + r'\?v=)[^"]*(")'
    if not re.search(pat, out):
        sys.exit('stamp-assets: no <script src="%s?v=..."> in index.html' % f)
    out = re.sub(pat, r'\g<1>' + h + r'\g<2>', out)
# Optional managed-lists files: stamped only when the file exists AND index.html has its <script src="...?v="> tag.
stamped = []
for f in ('shipments_lists.js', 'shipments_lists_config.js', 'shipments_lists_queue.js', 'shipments_pt_suggest.js', 'shipments_ref_options.js', 'viewas.js'):
    pat = r'(src="' + re.escape(f) + r'\?v=)[^"]*(")'
    if not os.path.isfile(f) or not re.search(pat, out):
        continue
    h = hashlib.sha256(open(f, 'rb').read()).hexdigest()[:10]
    out = re.sub(pat, r'\g<1>' + h + r'\g<2>', out)
    stamped.append(f)
if '--check' in sys.argv:
    if out != html:
        sys.exit('stamp-assets: index.html versions are STALE - run python3 tools/stamp-assets.py')
    print('stamp-assets: versions up to date')
else:
    open('index.html', 'w', encoding='utf-8').write(out)
    names = ['vision.js', 'pivots.js'] + stamped
    print('stamp-assets: shipments_v2.js?v=' + sh + ', ' + ', '.join(m for n in names for m in re.findall(r'src="(' + re.escape(n) + r'\?v=[^"]*)"', out)))
