#!/usr/bin/env python3
"""Draw PackForge's liquid-glass app icon as PNG at the sizes a PWA needs.

Pure standard library: super-sampled rounded squircle, gradient fill, glossy
edge highlight and a white suitcase glyph.
"""
import os
import struct
import zlib

SS = 2  # supersampling factor


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    return (
        lerp(c1[0], c2[0], t),
        lerp(c1[1], c2[1], t),
        lerp(c1[2], c2[2], t),
    )


def rounded_alpha(x, y, x0, y0, x1, y1, r):
    """0..1 coverage for a point in an axis-aligned rounded rectangle."""
    if x < x0 - 0.5 or x > x1 + 0.5 or y < y0 - 0.5 or y > y1 + 0.5:
        return 0.0
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    dx = x - cx
    dy = y - cy
    dist = (dx * dx + dy * dy) ** 0.5
    return 1.0 if dist <= r else 0.0


def glyph_alpha(x, y, s):
    """White suitcase glyph coverage at pixel centre (x, y) for size s."""
    # handle: upper half of a ring
    hx, hy = 0.5 * s, 0.388 * s
    r = 0.088 * s
    t = 0.030 * s
    if y <= hy:
        d = ((x - hx) ** 2 + (y - hy) ** 2) ** 0.5
        if abs(d - r) <= t / 2:
            return 1.0

    # body
    if rounded_alpha(x, y, 0.255 * s, 0.405 * s, 0.745 * s, 0.795 * s, 0.062 * s) > 0:
        return 1.0
    return 0.0


def pixel(x, y, s, maskable):
    """Return RGBA for a sample point."""
    inset = 0.0 if maskable else 0.005 * s
    radius = 0.0 if maskable else 0.225 * s
    body = rounded_alpha(x, y, inset, inset, s - inset, s - inset, radius)
    if body <= 0:
        return (0, 0, 0, 0)

    nx, ny = x / s, y / s
    t = min(1.0, max(0.0, (nx * 0.55 + ny * 0.75)))
    color = mix((170, 156, 255), (52, 45, 186), t)

    # cyan glow bottom-left
    gx, gy = 0.16 * s, 0.90 * s
    d = (((x - gx) ** 2 + (y - gy) ** 2) ** 0.5) / (0.62 * s)
    glow = max(0.0, 1.0 - d) ** 2 * 0.55
    color = mix(color, (80, 210, 255), glow)

    # specular sweep top-left
    d = (((x - 0.24 * s) ** 2 + (y - 0.10 * s) ** 2) ** 0.5) / (0.55 * s)
    color = mix(color, (255, 255, 255), max(0.0, 1.0 - d) ** 2 * 0.28)

    # glossy rim
    edge = min(x - inset, y - inset, (s - inset) - x, (s - inset) - y)
    if not maskable and edge <= 0.014 * s:
        color = mix(color, (255, 255, 255), 0.42)

    # glassy inner top highlight
    if ny < 0.30:
        color = mix(color, (255, 255, 255), (1 - ny / 0.30) * 0.10)

    # suitcase
    scale = s * (0.74 if maskable else 0.88)
    offset = (s - scale) / 2
    ga = glyph_alpha(x - offset, y - offset, scale)
    if ga > 0:
        shade = mix((255, 255, 255), (222, 224, 255), min(1.0, ny / 0.8))
        color = mix(color, shade, ga)

    # latch accent
    if maskable:
        lx0, ly0, lx1, ly1 = 0.469 * s, 0.497 * s, 0.531 * s, 0.607 * s
    else:
        lx0 = offset + 0.469 * scale
        ly0 = offset + 0.497 * scale
        lx1 = offset + 0.531 * scale
        ly1 = offset + 0.607 * scale
    if rounded_alpha(x, y, lx0, ly0, lx1, ly1, 0.031 * s) > 0:
        color = (86, 78, 220)

    return (int(color[0]), int(color[1]), int(color[2]), int(255 * min(1.0, body)))


def render(size, maskable=False):
    big = size * SS
    pixels = []
    for y in range(size):
        for x in range(size):
            r = g = b = a = 0
            for sy in range(SS):
                for sx in range(SS):
                    px, py = x * SS + sx + 0.5, y * SS + sy + 0.5
                    cr, cg, cb, ca = pixel(px, py, big, maskable)
                    r += cr * ca
                    g += cg * ca
                    b += cb * ca
                    a += ca
            if a:
                pixels.append((r // a, g // a, b // a, a // (SS * SS)))
            else:
                pixels.append((0, 0, 0, 0))
    return pixels


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


def main():
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
    out = os.path.join(root, "icons")
    os.makedirs(out, exist_ok=True)
    targets = [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-maskable-512.png", 512, True),
        ("apple-touch-icon.png", 180, True),
        ("favicon-32.png", 32, False),
    ]
    for name, size, maskable in targets:
        write_png(os.path.join(out, name), size, size, render(size, maskable))
        print("wrote icons/" + name)


if __name__ == "__main__":
    main()
