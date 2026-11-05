# The Broodmother: concept art for a planned Hardcore-only boss (D-178). The game doesn't load these files yet.
# A small crab-like body on ten legs, small pincers, and a long wedge-shaped skull raised on a neck behind it,
# with flat red spider eyes. She is built once in 3D and drawn by two cameras: a raised 3/4 view (96 px frames)
# and top-down for the game (128 px frames, facing right). Every part is an ellipsoid or a chain of spheres; each
# pixel is one ray, shaded into a fixed palette of slate, maroon-black and red, then inked on its shadow side.
#
#   python3 art/concepts/broodmother/broodmother.py art/concepts/broodmother
#
# writes broodmother_{top,side}_{idle_4f,run_8f}.png (strips) and one PNG per frame. Needs numpy and Pillow.
import math
import sys
import numpy as np
from PIL import Image

OUT = sys.argv[1]
SLATE = np.array([(8, 9, 16), (17, 20, 33), (28, 33, 52), (42, 50, 76), (62, 74, 104), (92, 106, 140)], float)
RED = np.array([(64, 6, 14), (122, 14, 28), (196, 30, 42), (255, 104, 100)], float)
INK = (5, 5, 10)


def unit(v):
    v = np.asarray(v, float)
    return v / np.linalg.norm(v)


def rot_to(axis):
    """A rotation whose local x points along axis."""
    x = unit(axis)
    up = np.array([0, 0, 1.0]) if abs(x[2]) < 0.95 else np.array([0, 1.0, 0])
    y = unit(np.cross(up, x))
    z = np.cross(x, y)
    return np.stack([x, y, z], 1)


class Part:
    def __init__(self, c, r, R=None, mat='slate', pid=0, key=0, tex=None):
        self.c, self.r = np.asarray(c, float), np.asarray(r, float)
        self.R = np.eye(3) if R is None else R
        self.mat, self.pid, self.key, self.tex = mat, pid, key, tex


def chain(parts, pts, r0, r1, mat='slate', pid=0, key=0, step=0.45):
    lens = [math.dist(a, b) for a, b in zip(pts, pts[1:])]
    total, run = sum(lens), 0.0
    for (a, b), L in zip(zip(pts, pts[1:]), lens):
        n = max(2, int(L / step))
        for i in range(n + 1):
            t = i / n
            p = np.array(a) + (np.array(b) - np.array(a)) * t
            r = r0 + (r1 - r0) * (run + L * t) / total
            parts.append(Part(p, (r, r, r), mat=mat, pid=pid, key=key * 1000 + int((run + L * t) * 1.3)))
        run += L


def ik(hip, ankle, l1, l2):
    """The knee of a two-bone leg, bent upward."""
    h = np.array(ankle[:2]) - np.array(hip[:2])
    dh = np.linalg.norm(h)
    h = h / dh
    dz = ankle[2] - hip[2]
    d = min(math.hypot(dh, dz), l1 + l2 - 0.01)
    a = math.atan2(dz, dh)
    b = math.acos(max(-1, min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))))
    k = a + b
    return (hip[0] + h[0] * l1 * math.cos(k), hip[1] + h[1] * l1 * math.cos(k), hip[2] + l1 * math.sin(k))



MODE = 'run'


def spider(phase):
    P = []
    run = MODE == 'run'
    # idle: one slow breath per loop; run: two quick bounces per stride, crouched a little lower
    bob = 1.0 * math.cos(4 * math.pi * phase) if run else 0.8 * math.cos(2 * math.pi * phase)
    zb = (13 if run else 14) + bob
    sway = math.sin(2 * math.pi * phase)
    nod = 0.07 * math.cos(4 * math.pi * phase) if run else 0.06 * math.cos(2 * math.pi * phase)
    # a small, flat crab shell
    P.append(Part((1, 0, zb), (9, 11, 4.2), pid=1, tex='speck'))
    P.append(Part((-1, 0, zb + 2.6), (6.5, 8, 2.6), pid=1, tex='speck'))
    # the head sits on the back of the shell: a long, smooth, ribbed skull sweeping up and back
    neck = np.array([-7.0, 0, zb + 20])
    axis = unit((-0.95, (0.07 if run else 0.05) * sway, 0.36 + nod))  # tilted well back, centred between the hind legs
    R = rot_to(axis)
    # a wedge: narrow where it meets the neck, widening toward a broad, rounded back edge
    for k in range(8):
        t = k / 7
        w, h = 6.4 + 3.0 * t, 4.9 + 1.0 * t  # a gentle taper: the front stays as wide as the face
        tex = 'podrib' if k in (1, 3) else 'pod'
        P.append(Part(neck + axis * (2 + 13 * t), (4.6, w, h), R, pid=3, tex=tex))
    P.append(Part(neck + axis * 17, (7.0, 9.6, 6.0), R, pid=3, tex='pod'))  # the broad, domed back of the skull
    chain(P, [(-2, 0, zb + 3), (-4.5, 0, zb + 10), (-6.5, 0, zb + 16)], 2.4, 1.7, pid=2, key=2)  # a neck stalk lifts the head clear
    # the face: a narrower snout pointing forward and down, spider eyes on top, a toothed jaw under it
    fwd = unit((1, 0.0, -0.15))
    Rf = rot_to(fwd)
    face = neck + fwd * 6.5 + np.array([0, 0, 0.5])
    P.append(Part(face, (7.5, 5, 4.6), Rf, pid=4, tex='face'))
    jaw = face + fwd * 2.5 + np.array([0, 0, -3.2 - 0.6 * max(0, sway)])
    P.append(Part(jaw, (4.6, 3.4, 1.8), Rf, pid=5, tex='face'))
    for k in range(4):
        for s in (-1, 1):
            P.append(Part(jaw + fwd * (3.4 - k * 1.3) + np.array([0, s * (1.2 + k * 0.5), 1.5]), (0.5, 0.45, 0.8),
                          mat='tooth', pid=6))
    # spider eyes: flat, set into the head rather than bulging; a big front pair, smaller ones behind,
    # and a short line of tiny ones running up each side of the skull
    top = face + np.array([0, 0, 3.0])
    for k, (f, y, z, r) in enumerate(((6.0, 1.6, -0.1, 1.4), (5.1, 4.2, -0.5, 0.9), (3.0, 2.2, 0.9, 0.75),
                                      (2.0, 4.6, 0.3, 0.6))):
        for s in (-1, 1):
            P.append(Part(top + fwd * f + np.array([0, s * y, z]), (r, r, r * 0.4), mat='eye',
                          pid=40 + k * 2 + (s > 0)))
    for j, t in enumerate((0.0, 0.14, 0.28, 0.42)):
        w, h = 6.4 + 3.0 * t, 4.9 + 1.0 * t
        r = 0.95 - 0.12 * j
        for s in (-1, 1):
            pos = neck + axis * (2 + 13 * t) + R @ np.array([0, s * 0.96 * w, 0.25 * h])
            P.append(Part(pos, (r, r * 0.4, r), R, mat='eye', pid=90 + j * 2 + (s > 0)))
    # small pincers tucked in front
    for s in (-1, 1):
        a0 = (8, s * 5, zb - 1)
        el = (12, s * 8, zb - 4)
        hand = (14.5, s * 5.5, zb - 7)
        chain(P, [a0, el, hand], 1.25, 0.95, pid=8 + (s > 0), key=30 + (s > 0))
        P.append(Part(hand, (1.9, 1.2, 1.2), pid=10 + (s > 0), tex='speck'))
        snip = 0.4 + 0.3 * max(0, math.sin(2 * math.pi * phase + s))
        for f in (-1, 1):
            tip = np.array(hand) + np.array([3.2, -s * 1.6 * f * snip - s * 0.8, -0.6 + f * 0.9])
            chain(P, [hand, tuple(tip)], 0.7, 0.25, pid=12 + (s > 0), key=34 + (s > 0))
    # crab legs: five a side, arching high and landing on points
    hips = ((34, 32), (60, 33), (86, 33), (112, 33), (140, 33))
    for side in (-1, 1):
        for i, (ang, reach) in enumerate(hips):
            p = (phase + 0.5 * ((i + (side > 0)) % 2)) % 1
            if not run:  # feet planted; the knees flex as the body breathes
                slide, lift = 0.0, 0.0
            elif p < 0.5:
                slide, lift = 6.5 - 13 * p / 0.5, 0.0
            else:
                q = (p - 0.5) / 0.5
                slide, lift = -6.5 + 13 * q, 8.5 * math.sin(math.pi * q)
            a = math.radians(ang)
            out = np.array([math.cos(a), side * math.sin(a), 0])
            hip = np.array([1 + math.cos(a) * 6.5, side * math.sin(a) * 9.5, zb])
            foot = hip + out * reach + np.array([slide, 0, 0])
            foot[2] = lift
            ankle = foot - out * 1.0 + np.array([0, 0, 11])
            knee = np.array(ik(tuple(hip), tuple(ankle), 20, 19))
            leg = 50 + i + (side > 0) * 5
            chain(P, [tuple(hip), tuple(knee)], 2.9, 1.8, pid=leg, key=leg)
            chain(P, [tuple(knee), tuple(ankle)], 1.75, 0.95, pid=leg + 10, key=leg + 10)
            chain(P, [tuple(ankle), tuple(foot)], 0.95, 0.2, pid=leg + 20, key=leg + 20)
    return P


def h32(*a):
    v = 2166136261
    for x in a:
        v = ((v ^ (int(x) & 0xFFFFFFFF)) * 16777619) & 0xFFFFFFFF
    return v / 0xFFFFFFFF


def render(phase, size, scale, az, el, center, seed=None):
    c = np.array([math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)])
    d = -c
    up = np.array([0, 0, 1.0]) if el < math.radians(89) else np.array([0, 1.0, 0])
    v = unit(up - up.dot(d) * d)
    u = np.cross(d, v)
    light = unit(-0.55 * u + 0.7 * v + 0.6 * c)
    ys, xs = np.mgrid[0:size, 0:size]
    sx = (xs + 0.5 - size / 2) * scale + center[0]
    sy = (size / 2 - ys - 0.5) * scale + center[1]
    O = sx[..., None] * u + sy[..., None] * v - 200 * d
    depth = np.full((size, size), np.inf)
    shade = np.zeros((size, size))
    mat = np.zeros((size, size), int)  # 0 none, 1 slate, 2 red, 3 eye, 4 eye glint
    pid = np.full((size, size), -1)
    spk = np.ones((size, size))
    dens = np.ones((size, size))
    for p in spider(phase):
        rmax = p.r.max()
        cu, cv = (p.c.dot(u) - center[0]) / scale + size / 2, size / 2 - (p.c.dot(v) - center[1]) / scale
        rr = rmax / scale + 1
        x0, x1 = max(0, int(cu - rr)), min(size, int(cu + rr) + 2)
        y0, y1 = max(0, int(cv - rr)), min(size, int(cv + rr) + 2)
        if x0 >= x1 or y0 >= y1:
            continue
        o = (O[y0:y1, x0:x1] - p.c) @ p.R / p.r
        dl = (d @ p.R) / p.r
        A = dl.dot(dl)
        B = 2 * o @ dl
        C = (o * o).sum(-1) - 1
        disc = B * B - 4 * A * C
        hit = disc >= 0
        if not hit.any():
            continue
        t = (-B - np.sqrt(np.where(hit, disc, 0))) / (2 * A)
        win = hit & (t < depth[y0:y1, x0:x1])
        if not win.any():
            continue
        lp = o + t[..., None] * dl  # point on the unit sphere, local
        n = (lp / p.r) @ p.R.T
        n /= np.linalg.norm(n, axis=-1, keepdims=True)
        lam = np.clip(n @ light, 0, 1)
        rim = np.clip(1 - (n @ c), 0, 1) ** 3 * 0.18
        s = 0.08 + 0.92 * lam ** 1.15 + rim
        if p.tex in ('pod', 'podrib'):
            hv = unit(light + c)
            s = s + 0.15 * np.clip(n @ np.array([0, 0, 1.0]), 0, 1) + 0.6 * np.clip(n @ hv, 0, 1) ** 24  # glossy
            if p.tex == 'podrib':  # every other band darker: the skull's ribbing
                s = s * 0.62
        m = {'slate': 1, 'red': 2, 'eye': 3, 'tooth': 5}[p.mat]
        mm = np.full(t.shape, m)
        if p.tex == 'abdomen':
            phi = np.arctan2(lp[..., 1], lp[..., 2])
            wav = phi * 3.2 + 0.5 * np.sin(lp[..., 0] * 7) + 0.25 * np.sin(lp[..., 0] * 17 + phi * 5)
            vein = (np.abs(np.sin(wav)) < 0.11) & (np.abs(lp[..., 0]) < 0.82)
            mm = np.where(vein, 2, mm)
            s = np.where(vein, s * 0.75, s)
        if p.tex in ('abdomen', 'speck') or p.key:
            gx = np.floor(lp[..., 0] * 5.5) + p.key * 7
            gy = np.floor(lp[..., 1] * 5.5)
            gz = np.floor(lp[..., 2] * 5.5)
            rnd = np.vectorize(h32)(gx, gy, gz)
            mm = np.where((mm == 1) & (rnd < 0.035), 2, mm)
            s = np.where((mm == 1) & (rnd > 0.9), s - 0.12, s)
        if p.mat == 'eye':
            mm = np.where(lam > 0.88, 6, 3)  # a bright glint on each bead
        sl = (slice(y0, y1), slice(x0, x1))
        depth[sl] = np.where(win, t, depth[sl])
        shade[sl] = np.where(win, s, shade[sl])
        mat[sl] = np.where(win, mm, mat[sl])
        pid[sl] = np.where(win, p.pid, pid[sl])
        dens[sl] = np.where(win, {'pod': 0.25, 'podrib': 0.25, 'face': 0.5}.get(p.tex, 1.0), dens[sl])
        g = np.floor(lp * 7)
        spk[sl] = np.where(win, np.vectorize(h32)(g[..., 0] + p.key * 13 + p.pid * 101, g[..., 1], g[..., 2]), spk[sl])
    # colours taken from the reference: warm maroon-black in shadow, cool slate in light
    RAMP = np.array([(12, 11, 11), (22, 13, 18), (29, 22, 27), (35, 35, 39), (40, 45, 54), (41, 50, 75),
                     (46, 59, 73), (56, 68, 80), (64, 74, 91), (82, 94, 107)], float)
    img = np.zeros((size, size, 4), np.uint8)
    filled = mat > 0
    si = np.clip((shade * 0.78 * len(RAMP)).astype(int), 0, len(RAMP) - 1)  # darker overall
    rgb = RAMP[si]
    r = np.vectorize(h32)(xs, ys, np.full_like(xs, seed)) if seed is not None else spk
    maroon = np.array([(52, 22, 27), (72, 21, 28), (84, 30, 33), (115, 45, 55)], float)
    mi = np.clip((shade * 4).astype(int), 0, 3)
    body = mat == 1
    rgb = np.where((body & (r < 0.075 * dens))[..., None], maroon[mi], rgb)
    rgb = np.where((body & (r >= 0.075 * dens) & (r < 0.085 * dens))[..., None], (171, 36, 17), rgb)
    rgb = np.where((body & (r >= 0.11) & (r < 0.125) & (shade > 0.7))[..., None], (169, 86, 93), rgb)
    rgb = np.where((body & (r >= 0.14) & (r < 0.148) & (shade > 0.85))[..., None], (168, 137, 138), rgb)
    rgb = np.where((body & (r > 0.9))[..., None], RAMP[np.clip(si - 2, 0, 9)], rgb)
    rgb = np.where((mat == 2)[..., None], maroon[mi], rgb)
    rgb = np.where((mat == 3)[..., None], (171, 36, 17), rgb)
    rgb = np.where((mat == 5)[..., None], (168, 137, 138), rgb)
    rgb = np.where((mat == 6)[..., None], (255, 170, 160), rgb)
    img[..., :3] = rgb.astype(np.uint8)
    img[filled, 3] = 255
    ink = np.zeros_like(filled)
    np.seterr(invalid='ignore')
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        nf = np.roll(np.roll(filled, dy, 0), dx, 1)
        nd = np.roll(np.roll(depth, dy, 0), dx, 1)
        npid = np.roll(np.roll(pid, dy, 0), dx, 1)
        if (dy, dx) in ((1, 0), (0, 1)):  # outline only on the shadow side, as the reference does
            ink |= ~filled & nf & (np.roll(np.roll(shade, dy, 0), dx, 1) < 0.5)
        ink |= filled & nf & (depth - nd > 3) & (npid != pid)
    img[ink & ~filled] = (0, 0, 0, 255)
    img[ink & filled] = (12, 11, 11, 255)
    # dark sockets: ring every eye, and split eyes that touch, so each reads as its own bead
    eye = (mat == 3) | (mat == 6)
    sock = np.zeros_like(eye)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        ne = np.roll(np.roll(eye, dy, 0), dx, 1)
        npid = np.roll(np.roll(pid, dy, 0), dx, 1)
        nd = np.roll(np.roll(depth, dy, 0), dx, 1)
        sock |= filled & ~eye & ne
        sock |= eye & ne & (npid != pid) & (depth > nd)
    img[sock] = (8, 5, 8, 255)
    return Image.fromarray(img, 'RGBA')



views = {
    'side': dict(size=96, scale=1.0, az=math.radians(6), el=math.radians(50), center=(1, 12)),
    'top': dict(size=128, scale=0.7, az=0.0, el=math.radians(90), center=(0, 0)),
}
import os

os.makedirs(f'{OUT}/frames', exist_ok=True)
for name, kw in views.items():
    n = kw['size']
    for mode, count in (('idle', 4), ('run', 8)):
        MODE = mode
        frames = [render(i / count, **kw) for i in range(count)]
        strip = Image.new('RGBA', (n * count, n))
        for i, f in enumerate(frames):
            f.save(f'{OUT}/frames/{name}_{mode}_f{i}.png')
            strip.paste(f, (n * i, 0))
        strip.save(f'{OUT}/broodmother_{name}_{mode}_{count}f.png')
        print(name, mode, max(f.getbbox()[3] for f in frames), min(f.getbbox()[1] for f in frames))
print('ok')
