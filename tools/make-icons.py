"""Generate PWA icons (pure Python, no dependencies). Run: python3 tools/make-icons.py"""
import os, struct, zlib

SPRITE = [
    '..HHHHHHHHHH..',
    '..OOOOOOOOOO..',
    '..OOOKOOOOKO..',
    '..OOOKOOOOKO..',
    '..OOOOOOOOOO..',
    'OOOOOOOOOOOOOO',
    'OOOOOOOOOOOOOO',
    '..OOOOOOOOOO..',
    '..OOOOOOOOOO..',
    '..DDDDDDDDDD..',
    '..D.D....D.D..',
    '..D.D....D.D..',
]
PAL = {'O': (0xD9, 0x77, 0x57), 'D': (0xB0, 0x55, 0x3A), 'H': (0xF2, 0xA5, 0x85), 'K': (0x14, 0x14, 0x14)}
BG = (0x2a, 0x1e, 0x44)


def png(path, size, fill):
    sw, sh = len(SPRITE[0]), len(SPRITE)
    cell = int(size * fill / sw)
    ox, oy = (size - sw * cell) // 2, (size - sh * cell) // 2 + cell // 2
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            c = BG
            sx, sy = (x - ox) // cell, (y - oy) // cell
            if 0 <= x - ox and 0 <= y - oy and sx < sw and sy < sh:
                c = PAL.get(SPRITE[sy][sx], BG)
            row += bytes(c)
        rows.append(bytes(row))
    raw = b''.join(rows)

    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)

    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
    data += chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(data)


out = os.path.join(os.path.dirname(__file__), '..', 'icons')
os.makedirs(out, exist_ok=True)
png(os.path.join(out, 'icon-192.png'), 192, 0.75)
png(os.path.join(out, 'icon-512.png'), 512, 0.75)
png(os.path.join(out, 'icon-maskable-512.png'), 512, 0.55)
png(os.path.join(out, 'apple-touch-icon.png'), 180, 0.75)
print('icons written')
