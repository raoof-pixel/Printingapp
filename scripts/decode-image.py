#!/usr/bin/env python3
"""Decode an image transferred as base64 through a saved tool-result file. Usage: decode-image.py <result.txt> <outdir>"""
import sys, json, base64, re
src, outdir = sys.argv[1], sys.argv[2]
data = json.load(open(src))
text = data[0]['text'] if isinstance(data, list) else data
if isinstance(text, str) and text.startswith('"'):
    text = json.JSONDecoder().raw_decode(text)[0]  # trailing "(captured at origin ...)" note follows the JSON string
m = re.match(r'IMG:(\d+):(\d+)x(\d+):(\d+):([A-Za-z0-9+/=]+)', text)
if not m:
    print('NO IMAGE HEADER', text[:80]); sys.exit(1)
pid, w, h, size, b64 = m.groups()
raw = base64.b64decode(b64)
assert len(raw) == int(size), (len(raw), size)
assert raw[:2] == b'\xff\xd8', 'not a jpeg'
out = f'{outdir}/pexels-{pid}.jpg'
open(out, 'wb').write(raw)
print(f'{out} {w}x{h} {len(raw)//1024}KB')
