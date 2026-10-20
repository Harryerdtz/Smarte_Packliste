#!/usr/bin/env python3
"""Draw PackForge's pixel suitcase icon as PNG at the sizes a PWA needs."""
import os
import struct
import zlib

BG = (18, 16, 31, 255)
OUTLINE = (11, 10, 19, 255)
BODY = (255, 209, 102, 255)
HIGHLIGHT = (255, 230, 163, 255)
CLASP = (141, 255, 164, 255)
HANDLE = (107, 99, 150, 255)
COLORS = {'.': BG, 'O': OUTLINE, 'B': BODY, 'H': HIGHLIGHT, 'C': CLASP, 'K': HANDLE}

ART = [
    "................",
    ".....KKKK.......",
    "....K....K......",
    "....K....K......",
    "..OOOOOOOOOOOO..",
    "..OBBBBBBBBBBO..",
    "..OBBBBBBBBBBO..",
    "..OBHHHHHHHHBO..",
    "..OBBBBBBBBBBO..",
    "..OBBBBCCBBBBO..",
    "..OBBBBCCBBBBO..",
    "..OBBBBBBBBBBO..",
    "..OBBBBBBBBBBO..",
    "..OOOOOOOOOOOO..",
    "................",
    "................",
]


def write_png(path, width, height, pixels):
    raw = b"".join(
        b"\x00" + b"".join(bytes(pixels[y * width + x]) for x in range(width))
        for y in range(height)
    )
    chunks = []

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    chunks.append(chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)))
    chunks.append(chunk(b"IDAT", zlib.compress(raw, 9)))
    chunks.append(chunk(b"IEND", b""))
    with open(path, "wb") as fh:
        fh.write(b"\x89PNG\r\n\x1a\n" + b"".join(chunks))


def render(size, margin):
    grid = 16 + margin * 2
    cell = size // grid
    pixels = [BG] * (size * size)
    offset = (size - cell * grid) // 2
    for row, line in enumerate(ART):
        for col, char in enumerate(line):
            color = COLORS[char]
            x0 = offset + (col + margin) * cell
            y0 = offset + (row + margin) * cell
            for y in range(y0, min(y0 + cell, size)):
                for x in range(x0, min(x0 + cell, size)):
                    pixels[y * size + x] = color
    return pixels


def main():
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
    out = os.path.join(root, "icons")
    os.makedirs(out, exist_ok=True)
    targets = [
        ("icon-192.png", 192, 0),
        ("icon-512.png", 512, 0),
        ("icon-maskable-512.png", 512, 2),
        ("apple-touch-icon.png", 180, 1),
        ("favicon-32.png", 32, 0),
    ]
    for name, size, margin in targets:
        write_png(os.path.join(out, name), size, size, render(size, margin))
        print("wrote icons/" + name)


if __name__ == "__main__":
    main()
