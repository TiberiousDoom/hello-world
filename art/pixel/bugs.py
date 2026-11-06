# Pixel-art bugs for the pixel art test (D-182), the first step towards the pixel art of D-179.
# Each bug is modelled once in 3D, top-down, and drawn by one ray per pixel into its own palette, with a navy
# outline like the game's bugs. It is drawn at its size in a world of 16 art pixels per tile (a Brute is 22 px,
# a crawler 15), with thin legs and feelers widened as a pixel artist would, and pre-turned to 16 directions,
# so the game never rotates or smooths it.
#
#   python3 art/pixel/bugs.py src/art/pixel/enemies
#
# writes <bug>_walk.png: 16 rows (facing east, then turning clockwise a sixteenth of a turn each row) of 4 walk
# frames, each a square cell. Needs Python 3 with numpy and Pillow.
import math
import sys
import numpy as np
from PIL import Image

OUT = sys.argv[1]
INK = (15, 26, 46)

RAMPS = {
    'orange': [(58, 20, 8), (92, 36, 12), (134, 58, 18), (178, 86, 28), (216, 120, 46), (242, 162, 84), (252, 200, 140)],
    'brown': [(36, 18, 8), (62, 32, 14), (92, 50, 22), (122, 70, 32), (150, 92, 44)],
    'black': [(8, 10, 18), (16, 20, 32), (28, 34, 52), (44, 54, 80), (72, 86, 120), (120, 138, 180), (190, 204, 236)],
    'steel': [(34, 38, 50), (58, 64, 80), (88, 96, 116), (120, 128, 148)],
    'red': [(26, 4, 12), (42, 7, 17), (62, 10, 22), (86, 14, 28), (112, 20, 36), (140, 30, 44), (170, 46, 54), (204, 76, 70), (232, 116, 98)],
    'yellow': [(110, 70, 8), (164, 112, 14), (210, 156, 24), (240, 194, 48), (252, 222, 110), (255, 244, 190)],
    'wblack': [(10, 8, 6), (22, 18, 12), (38, 32, 22), (60, 52, 38), (90, 80, 60)],
    'dbrown': [(30, 18, 12), (50, 32, 20), (74, 50, 32), (100, 70, 46)],
    'blue': [(8, 12, 24), (14, 22, 40), (22, 34, 60), (32, 50, 84), (46, 70, 112), (70, 100, 150), (150, 180, 224), (236, 244, 255)],
    'navy': [(14, 20, 34), (26, 36, 56), (40, 54, 80), (58, 76, 106)],
    'slate': [(24, 30, 42), (40, 48, 64), (60, 70, 88), (86, 96, 116)],
    'wing': [(150, 172, 168), (180, 200, 196), (206, 222, 218), (232, 242, 240)],
}
EYES = {'yellow': ((250, 206, 60), (255, 246, 190)), 'orange': ((255, 150, 60), (255, 220, 160)),
        'amber': ((246, 160, 40), (255, 226, 140)), 'red': ((228, 50, 66), (255, 170, 170)),
        'cyan': ((120, 214, 255), (230, 250, 255))}


def unit(v):
    v = np.asarray(v, float)
    return v / np.linalg.norm(v)


def rot_to(axis):
    x = unit(axis)
    up = np.array([0, 0, 1.0]) if abs(x[2]) < 0.95 else np.array([0, 1.0, 0])
    y = unit(np.cross(up, x))
    return np.stack([x, y, np.cross(x, y)], 1)


class Part:
    def __init__(self, c, r, mat, R=None, pid=0, gloss=False, rib=False, eye=None, wing=False):
        self.c, self.r = np.asarray(c, float), np.asarray(r, float)
        self.R = np.eye(3) if R is None else R
        self.mat, self.pid, self.gloss, self.rib, self.eye, self.wing = mat, pid, gloss, rib, eye, wing


class Bug:
    """Collects parts; `thick` widens limbs and feelers when drawn small, as a pixel artist would."""

    def __init__(self, thick):
        self.P, self.thick = [], thick

    def add(self, *a, **k):
        self.P.append(Part(*a, **k))

    def chain(self, pts, r0, r1, mat, pid, limb=True):
        k = self.thick if limb else 1.0
        lens = [math.dist(a, b) for a, b in zip(pts, pts[1:])]
        total, run = sum(lens), 0.0
        for (a, b), L in zip(zip(pts, pts[1:]), lens):
            n = max(2, int(L / 0.4))
            for i in range(n + 1):
                t = i / n
                p = np.array(a) + (np.array(b) - np.array(a)) * t
                r = (r0 + (r1 - r0) * (run + L * t) / total) * k
                self.P.append(Part(p, (r, r, r), mat, pid=pid))
            run += L


def gait(phase, i, side):
    p = (phase + 0.5 * ((i + (side > 0)) % 2)) % 1
    if p < 0.55:
        return 1 - 2 * p / 0.55, 0.0
    q = (p - 0.55) / 0.45
    return -1 + 2 * q, math.sin(math.pi * q)


def legs(b, phase, hips, z, mat, r0, r1, stride, lift, pid0=50):
    """Two-segment legs: hip, knee raised, foot on the ground; `hips` = (hip, knee, foot) xy for one side."""
    for side in (-1, 1):
        for i, (h, k, f) in enumerate(hips):
            s, l = gait(phase, i, side)
            H = (h[0], side * h[1], z)
            K = (k[0] + s * stride * 0.5, side * k[1], z + 3 + l * lift * 0.5)
            F = (f[0] + s * stride, side * f[1], l * lift)
            b.chain([H, K, F], r0, r1, mat, pid0 + i * 2 + (side > 0))


def crawler(phase, thick):
    b = Bug(thick)
    z = 4 + 0.3 * math.cos(4 * math.pi * phase)
    wig = math.sin(2 * math.pi * phase)
    legs(b, phase, (((5, 3), (8, 9), (13, 15)), ((-2, 3.5), (-2, 10), (-1, 16)), ((-9, 3.5), (-12, 9), (-16, 14))), z, 'brown', 1.1, 0.45, 3.0, 2.0)
    for k, x in enumerate((-16, -11, -6, -1, 4)):
        y = 0.6 * wig * (x / 16)
        b.add((x, y, z), (3.2, 5.0 - (x < -12) * 0.8, 2.8), 'orange', pid=1, gloss=True, rib=bool(k % 2))
    b.add((9.5, 0, z), (3.4, 4.2, 2.6), 'orange', pid=2, gloss=True)
    for s in (-1, 1):
        b.add((11.6, s * 2.1, z + 1.6), (1.1, 1.1, 0.7), 'orange', pid=40 + (s > 0), eye='yellow')
        b.chain([(12, s * 2, z + 1), (17, s * 5.5 + wig * 0.5, z + 1.5), (21, s * 9 + wig, z + 1)], 0.5, 0.3, 'brown', 20 + (s > 0))
    return b.P


def runner(phase, thick):
    b = Bug(thick)
    z = 3
    for k, x in enumerate(np.linspace(-15, 7, 8)):
        sway = 1.0 * math.sin(2 * math.pi * phase + x * 0.25)
        s, l = gait(phase, k, -1)
        for side in (-1, 1):
            sg = s if side < 0 else -s
            b.chain([(x, sway + side * 2, z), (x + sg * 1.5, sway + side * 6, z + 1.5), (x - 1 + sg * 2.2, sway + side * 8.5, 0)], 0.6, 0.3, 'steel', 50 + k * 2 + (side > 0))
        b.add((x, sway, z), (2.2, 2.9, 2.0), 'black', pid=1, gloss=True, rib=bool(k % 2))
    sway = 1.0 * math.sin(2 * math.pi * phase + 2.5)
    b.add((10.2, sway, z), (2.6, 2.7, 2.0), 'black', pid=2, gloss=True)
    for s in (-1, 1):
        b.add((11.8, sway + s * 1.3, z + 1.3), (0.8, 0.8, 0.6), 'black', pid=40 + (s > 0), eye='orange')
        b.chain([(12, sway + s * 1.5, z), (16, sway + s * 4, z + 1), (19.5, sway + s * 6, z)], 0.4, 0.25, 'steel', 20 + (s > 0))
    b.chain([(-17, 0, z), (-21, -2.5, z - 0.5)], 0.4, 0.2, 'steel', 22)
    b.chain([(-17, 0, z), (-21, 2.5, z - 0.5)], 0.4, 0.2, 'steel', 23)
    return b.P


def brute(phase, thick):
    b = Bug(thick)
    z = 6 + 0.35 * math.cos(4 * math.pi * phase)
    legs(b, phase, (((1, 4.5), (-3, 11), (-1, 15.5)), ((-8, 5.5), (-10, 11.5), (-15, 14.5))), z, 'red', 1.7, 0.5, 2.2, 2.5)
    for k, x in enumerate((-12.5, -9.5, -6.5, -3.5)):
        b.add((x, 0, z), (3.0, 6.6 - abs(x + 8) * 0.25, 4.8 - abs(x + 8) * 0.15), 'red', pid=1, gloss=True, rib=bool(k % 2))
    b.chain([(-15, 0, z), (-20, 0, z - 0.4)], 1.7, 0.2, 'red', 2, limb=False)
    b.add((2.5, 0, z + 2.2), (4.6, 5.0, 4.2), 'red', pid=3, gloss=True)
    b.add((7.2, 0, z + 1.8), (2.6, 2.9, 2.4), 'red', pid=4, gloss=True)
    for s in (-1, 1):
        b.add((9.0, s * 1.7, z + 2.6), (1.0, 1.0, 0.7), 'red', pid=40 + (s > 0), eye='amber')
        sw = 0.6 * math.sin(2 * math.pi * phase + (0 if s > 0 else math.pi))
        sh, el, wr = (4.5, s * 4.0, z + 3), (8.0 + sw, s * 8.5, z + 3.5), (12.5 + sw, s * 8.8, z + 3.5)
        b.chain([sh, el, wr], 1.9, 1.6, 'red', 8 + (s > 0))
        b.chain([wr, (15.5 + sw, s * 8.0, z + 3.4), (16.8 + sw, s * 5.6, z + 3.2), (15.6 + sw, s * 3.6, z + 3.0)], 2.0, 0.5, 'red', 10 + (s > 0))
    return b.P


def wasp(phase, thick):
    b = Bug(thick)
    z = 7 + 0.4 * math.sin(2 * math.pi * phase)
    flap = math.cos(2 * math.pi * phase)  # wings sweep forward and back
    for s in (-1, 1):  # legs tucked under, mostly hidden
        for x in (-1, 2, 5):
            b.chain([(x, s * 2, z - 1), (x - 2, s * 5, z - 3), (x - 4, s * 6, z - 4.5)], 0.6, 0.3, 'wblack', 60 + x + (s > 0))
    # striped abdomen: alternating bands, then a stinger
    for k, x in enumerate((-15, -12.5, -10, -7.5, -5)):
        w = 5.4 - abs(x + 9.5) * 0.45
        b.add((x, 0, z), (1.7, w, w * 0.8), 'yellow' if k % 2 == 0 else 'wblack', pid=1, gloss=True)
    b.chain([(-16.5, 0, z), (-20, 0, z - 0.5)], 1.0, 0.15, 'wblack', 2, limb=False)
    b.add((-3, 0, z), (1.4, 2.0, 1.8), 'wblack', pid=3)
    b.add((1.5, 0, z + 0.4), (3.6, 3.4, 3.0), 'yellow', pid=4, gloss=True)
    b.add((6.8, 0, z + 0.2), (2.6, 3.6, 2.6), 'dbrown', pid=5, gloss=True)
    for s in (-1, 1):
        b.add((7.4, s * 2.6, z + 0.8), (1.7, 1.2, 1.4), 'dbrown', pid=40 + (s > 0), eye='red')
        b.chain([(8.5, s * 1, z + 1.5), (13, s * 4.5, z + 2), (17, s * 7, z + 1.5)], 0.45, 0.3, 'wblack', 20 + (s > 0))
        # four see-through wings, from the thorax out and back
        for big, (length, width, back) in enumerate(((19, 3.8, 0.25), (13, 2.8, 0.6))):
            ang = math.radians(90 + 40 * back + 16 * flap)
            d = np.array([math.cos(ang), s * math.sin(ang), 0.12])
            root = np.array([1.5 - big * 1.5, s * 2.0, z + 3.2 + big * 0.3])
            b.add(root + d * length * 0.5, (length * 0.5, width, 0.5), 'wing', R=rot_to(d), pid=70 + big * 2 + (s > 0), wing=True)
    return b.P


def beetle(phase, thick):
    b = Bug(thick)
    z = 5 + 0.3 * math.cos(4 * math.pi * phase)
    legs(b, phase, (((8, 4), (11, 9), (15, 13)), ((3, 5), (2, 11), (2, 16)), ((-4, 5), (-8, 11), (-13, 14))), z, 'navy', 1.2, 0.45, 2.4, 2.0)
    for s in (-1, 1):  # the split shell: two glossy wing cases with pits
        b.add((-2.5, s * 4.7, z + 1.5), (9.8, 5.8, 6.4), 'blue', pid=1 + (s > 0), gloss=True)
    b.add((9, 0, z + 1), (3.4, 5.6, 3.4), 'slate', pid=3, gloss=True)
    b.add((13.3, 0, z + 0.5), (2.2, 3.0, 2.0), 'slate', pid=4, gloss=True)
    for s in (-1, 1):
        b.add((14.6, s * 1.7, z + 1.4), (0.85, 0.85, 0.6), 'slate', pid=40 + (s > 0), eye='cyan')
        b.chain([(15, s * 2, z), (18, s * 4.5, z + 1), (20, s * 5, z)], 0.6, 0.35, 'navy', 20 + (s > 0))
        b.chain([(15.5, s * 1.2, z - 0.5), (17.5, s * 1.5, z - 0.5), (18.2, s * 0.4, z - 0.6)], 0.7, 0.3, 'slate', 30 + (s > 0))
    return b.P


BUGS = {'crawler': (crawler, 15), 'runner': (runner, 11), 'brute': (brute, 22), 'wasp': (wasp, 16), 'beetle': (beetle, 22)}


def turn(parts, yaw):
    """Turns a bug to face `yaw` (radians, counter-clockwise seen from above)."""
    c, sn = math.cos(yaw), math.sin(yaw)
    Rz = np.array([[c, -sn, 0], [sn, c, 0], [0, 0, 1.0]])
    for q in parts:
        q.c, q.R = Rz @ q.c, Rz @ q.R
    return parts


def render(parts, size, scale, ink_step):
    """Top-down: x right, y up on screen; each pixel takes the highest part under it."""
    ys, xs = np.mgrid[0:size, 0:size]
    wx = (xs + 0.5 - size / 2) * scale
    wy = (size / 2 - ys - 0.5) * scale
    light = unit((-0.45, 0.55, 0.75))
    half = unit(light + np.array([0, 0, 1.0]))
    layers = {}
    for wing in (False, True):
        top = np.full((size, size), -np.inf)
        shade = np.zeros((size, size))
        mat = np.full((size, size), '', dtype=object)
        eye = np.full((size, size), '', dtype=object)
        pid = np.full((size, size), -1)
        for p in parts:
            if p.wing != wing:
                continue
            rr = p.r.max() / scale + 1
            cx, cy = p.c[0] / scale + size / 2, size / 2 - p.c[1] / scale
            x0, x1, y0, y1 = max(0, int(cx - rr)), min(size, int(cx + rr) + 2), max(0, int(cy - rr)), min(size, int(cy + rr) + 2)
            if x0 >= x1 or y0 >= y1:
                continue
            O = np.stack([wx[y0:y1, x0:x1], wy[y0:y1, x0:x1], np.full((y1 - y0, x1 - x0), 100.0)], -1)
            o = (O - p.c) @ p.R / p.r
            dl = (np.array([0, 0, -1.0]) @ p.R) / p.r
            A, B, C = dl @ dl, 2 * o @ dl, (o * o).sum(-1) - 1
            disc = B * B - 4 * A * C
            hit = disc >= 0
            t = (-B - np.sqrt(np.where(hit, disc, 0))) / (2 * A)
            zz = 100 - t
            win = hit & (zz > top[y0:y1, x0:x1])
            if not win.any():
                continue
            lp = o + t[..., None] * dl
            n = (lp / p.r) @ p.R.T
            n /= np.linalg.norm(n, axis=-1, keepdims=True)
            lam = np.clip(n @ light, 0, 1)
            s = 0.06 + 0.74 * lam
            if p.gloss:
                s = s + 0.5 * np.clip(n @ half, 0, 1) ** 30
            if p.rib:
                s = s * 0.72
            sl = (slice(y0, y1), slice(x0, x1))
            top[sl] = np.where(win, zz, top[sl])
            shade[sl] = np.where(win, s, shade[sl])
            mat[sl] = np.where(win, p.mat, mat[sl])
            eye[sl] = np.where(win, p.eye or '', eye[sl])
            if p.eye:
                eye[sl] = np.where(win & (lam > 0.86), p.eye + '+', eye[sl])
            pid[sl] = np.where(win, p.pid, pid[sl])
        layers[wing] = (top, shade, mat, eye, pid)

    def paint(top, shade, mat, eye, pid, ink_col):
        img = np.zeros((size, size, 4), np.uint8)
        filled = mat != ''
        for y in range(size):
            for x in range(size):
                if not filled[y, x]:
                    continue
                if eye[y, x]:
                    e = eye[y, x]
                    img[y, x, :3] = EYES[e.rstrip('+')][1 if e.endswith('+') else 0]
                else:
                    ramp = RAMPS[mat[y, x]]
                    img[y, x, :3] = ramp[min(len(ramp) - 1, max(0, int(shade[y, x] * len(ramp))))]
                img[y, x, 3] = 255
        ink = np.zeros_like(filled)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            nf = np.roll(np.roll(filled, dy, 0), dx, 1)
            nt = np.roll(np.roll(top, dy, 0), dx, 1)
            npid = np.roll(np.roll(pid, dy, 0), dx, 1)
            ink |= ~filled & nf
            with np.errstate(invalid='ignore'):
                ink |= filled & nf & (nt - top > ink_step) & (npid != pid)
        img[ink] = (*ink_col, 255)
        # eyes get a dark socket so each reads on its own
        eyes = eye != ''
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            ne = np.roll(np.roll(eyes, dy, 0), dx, 1)
            img[filled & ~eyes & ne] = (*INK, 255)
        return img

    body = Image.fromarray(paint(*layers[False], INK), 'RGBA')
    if any(p.wing for p in parts):
        w = paint(*layers[True], (70, 90, 92))
        w[..., 3] = (w[..., 3] * 0.62).astype(np.uint8)
        body.alpha_composite(Image.fromarray(w, 'RGBA'))
    return body


DIRS = 16


if __name__ == '__main__':
    for name in ('crawler', 'brute', 'wasp', 'beetle'):
        fn, small = BUGS[name]
        cell = int(math.ceil(small * 1.42 / 2) * 2)  # room for a diagonal
        scale = 0.7 * 64 / small
        thick = 1.0 + 0.35 * (22 / small) ** 0.8
        sheet = Image.new('RGBA', (cell * 4, cell * DIRS))
        for d in range(DIRS):
            for i in range(4):
                # Screen y points down, so turning clockwise on screen is a negative turn here.
                f = render(turn(fn(i / 4, thick), -2 * math.pi * d / DIRS), cell, scale, 9.0)
                sheet.paste(f, (i * cell, d * cell))
        sheet.save(f'{OUT}/{name}_walk.png', optimize=True)
        print(name, cell)
