#!/usr/bin/env python3
"""
Draws Banter's app icon and splash images and writes them to assets/images/.

The logo is "C3 Sunset", chosen on 2026-11-25: a bold B in a speech bubble that fades from
purple to pink, on the Midnight Plum background. To change it, edit the colours or the
drawing below and run:

    python3 scripts/brand-assets.py

Needs Google Chrome, which renders the drawings (the B is real text in Space Grotesk).
After running, rebuild the app (npm run ios) so the new images are used.
"""
import pathlib
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'images'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
FONT = (ROOT / 'node_modules/@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf').as_uri()

BACKGROUND = ('#241a35', '#120e1a')   # icon tile, top to bottom
BUBBLE = ('#b58cff', '#ff8fb1')       # top-left to bottom-right
LETTER = '#1a1030'
DOT = '#ffd3a8'
WORDMARK = '#f2ecfa'

# The mark is drawn in a 1024 box. Its ink covers this part of the box:
MARK_BOX = (200, 168, 664, 614)       # x, y, width, height


def mark(bubble_fill, letter_fill, dot_fill, cut_out_letter=False):
    x, y, w, h, rx = 212, 226, 600, 430, 150
    tail_y = y + h - rx * 0.55
    tail = f'M{x + rx * 0.75},{tail_y} L{x + rx * 0.35},{y + h + rx * 0.75} L{x + rx * 2.0},{y + h - 4}Z'
    letter = ('<text x="512" y="566" text-anchor="middle" font-size="380" '
              'style="font-family: SG; font-weight: 700" fill="{fill}">B</text>')
    defs = (f'<defs><linearGradient id="bubble" x1="0" y1="0" x2="1" y2="1">'
            f'<stop offset="0" stop-color="{BUBBLE[0]}"/><stop offset="1" stop-color="{BUBBLE[1]}"/></linearGradient>')
    body_attr = f'fill="{bubble_fill}"'
    if cut_out_letter:
        # For the one-colour Android icon: the B is a hole in the bubble.
        defs += ('<mask id="hole"><rect width="1024" height="1024" fill="white"/>'
                 + letter.format(fill='black') + '</mask>')
        body_attr += ' mask="url(#hole)"'
    defs += '</defs>'
    body = f'<g {body_attr}><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}"/><path d="{tail}"/></g>'
    return (defs + body + ('' if cut_out_letter else letter.format(fill=letter_fill))
            + f'<circle cx="806" cy="226" r="46" fill="{dot_fill}"/>')


def page(size, body, background='transparent'):
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: SG; src: url('{FONT}'); font-weight: 700; }}
html, body {{ margin: 0; width: {size}px; height: {size}px; background: {background}; overflow: hidden; }}
.stack {{ width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; }}
.word {{ font-family: SG; font-weight: 700; color: {WORDMARK}; line-height: 1; }}
</style></head><body>{body}</body></html>'''


def full_mark():
    return mark('url(#bubble)', LETTER, DOT)


def cropped(svg_inner, width):
    x, y, w, h = MARK_BOX
    return f'<svg viewBox="{x} {y} {w} {h}" width="{width}" height="{width * h / w:.0f}">{svg_inner}</svg>'


def render(name, size, html):
    with tempfile.TemporaryDirectory() as work:
        source = pathlib.Path(work) / 'page.html'
        source.write_text(html)
        target = OUT / name
        subprocess.run(
            [CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
             '--force-device-scale-factor=1', '--virtual-time-budget=3000', '--default-background-color=00000000',
             f'--window-size={size},{size}', f'--screenshot={target}', source.as_uri()],
            check=True, capture_output=True)
        print(f'wrote assets/images/{name} ({size}x{size})')


gradient = f'linear-gradient(180deg, {BACKGROUND[0]}, {BACKGROUND[1]})'

# iOS app icon: full square, no transparency. iOS rounds the corners itself.
icon = f'<svg viewBox="0 0 1024 1024" width="{{s}}" height="{{s}}">{full_mark()}</svg>'
render('icon.png', 1024, page(1024, icon.format(s=1024), gradient))
render('favicon.png', 196, page(196, icon.format(s=196), gradient))

# Splash for iOS: the mark with the name under it, on a transparent background.
# The background colour comes from app.json.
splash = (f'<div class="stack">{cropped(full_mark(), 520)}'
          f'<div class="word" style="font-size: 150px; margin-top: 4px">Banter</div></div>')
render('splash-icon.png', 800, page(800, splash))

# Splash for Android: Android 12 and later show the image inside a circle, which would
# cut the name off, so this one is the mark alone with room around it.
render('splash-icon-android.png', 800, page(800, f'<div class="stack">{cropped(full_mark(), 400)}</div>'))

# Android adaptive icon: the mark sits in the middle 60% so no launcher shape clips it.
render('android-icon-foreground.png', 1024, page(1024, f'<div class="stack">{cropped(full_mark(), 520)}</div>'))
render('android-icon-background.png', 1024, page(1024, '', gradient))
# One colour only, for Android's themed icons. The system recolours it.
render('android-icon-monochrome.png', 1024,
       page(1024, f'<div class="stack">{cropped(mark("#ffffff", None, "#ffffff", cut_out_letter=True), 520)}</div>'))
