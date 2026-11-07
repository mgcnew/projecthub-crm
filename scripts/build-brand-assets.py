#!/usr/bin/env python3
"""Gera os arquivos de marca (ícone, logo com nome, favicon e ícones do PWA) a partir de brand-src/.

Uso (precisa de Pillow com WebP):  python3 scripts/build-brand-assets.py

- Cada tamanho é renderizado direto da origem (LANCZOS em alfa pré-multiplicado, sem halo nas bordas),
  em múltiplos exatos do tamanho exibido (1x, 2x, 3x): nada é reduzido pelo navegador.
- Imagens pequenas da interface saem em WebP sem perdas; ícones do PWA e favicons em PNG.
"""
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'brand-src'
UI = ROOT / 'src' / 'assets' / 'brand'
PUBLIC = ROOT / 'public'
UI.mkdir(parents=True, exist_ok=True)
PUBLIC.mkdir(exist_ok=True)


def load(name: str) -> Image.Image:
    im = Image.open(SRC / name).convert('RGBA')
    return im.crop(im.getbbox())  # tira a margem transparente


def resize(im: Image.Image, width: int, height: int, sharpen: bool = False) -> Image.Image:
    # Pré-multiplicar o alfa evita o halo claro/escuro nas bordas semitransparentes.
    out = im.convert('RGBa').resize((width, height), Image.LANCZOS).convert('RGBA')
    if sharpen:
        out = out.filter(ImageFilter.UnsharpMask(radius=0.6, percent=35, threshold=0))
    return out


def fit(im: Image.Image, box: int) -> Image.Image:
    scale = box / max(im.size)
    return resize(im, max(1, round(im.width * scale)), max(1, round(im.height * scale)), sharpen=box <= 96)


def tile(im: Image.Image, size: int, fill: float, background) -> Image.Image:
    canvas = Image.new('RGBA', (size, size), background)
    logo = fit(im, round(size * fill))
    canvas.alpha_composite(logo, ((size - logo.width) // 2, (size - logo.height) // 2))
    return canvas


icon = load('voltier-icon.webp')
logo = load('voltier-logo.webp')

# Interface: ícone exibido a 32 px; logo com nome a 36 px (menu, login no celular) e 44 px (painel do login).
for mult in (1, 2, 3):
    fit(icon, 32 * mult).save(UI / f'voltier-icon-{32 * mult}.webp', 'WEBP', lossless=True, method=6)
for h in (36, 44):
    for mult in (1, 2, 3):
        height = h * mult
        resize(logo, round(logo.width * height / logo.height), height, sharpen=True).save(
            UI / f'voltier-logo-{height}.webp', 'WEBP', lossless=True, method=6
        )

# Favicons.
for s in (32, 64):
    tile(icon, s, 0.96, (0, 0, 0, 0)).save(UI / f'favicon-{s}.png', optimize=True)

# PWA: "any" com fundo transparente; "maskable" e iOS com fundo branco (o sistema recorta/arredonda).
for s in (192, 512):
    tile(icon, s, 0.90, (0, 0, 0, 0)).save(PUBLIC / f'icon-{s}.png', optimize=True)
tile(icon, 512, 0.68, (255, 255, 255, 255)).convert('RGB').save(PUBLIC / 'icon-maskable-512.png', optimize=True)
tile(icon, 180, 0.78, (255, 255, 255, 255)).convert('RGB').save(PUBLIC / 'apple-touch-icon.png', optimize=True)
print('ok')
