# -*- coding: utf-8 -*-
"""
Бюджетная ферма вертикальных AI-роликов (TikTok / Reels / Shorts).

Вход:  scenarios/*.json  — сценарий ролика (текст сцен + промпты картинок)
Выход: output/<имя>.mp4  — готовый вертикальный ролик 1080x1920, 30 fps

Всё бесплатное: edge-tts (озвучка), pollinations.ai (картинки),
ffmpeg из pip-пакета imageio-ffmpeg (сборка).

Запуск:
    python make_video.py scenarios/sample.json
    python make_video.py scenarios            # все сценарии из папки
"""

import asyncio
import json
import math
import re
import subprocess
import sys
import urllib.parse
from pathlib import Path

import edge_tts
import imageio_ffmpeg
import requests
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = Path(__file__).parent
WORK = ROOT / "work"
OUT = ROOT / "output"
W, H = 1080, 1920
FPS = 30

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\arialbd.ttf",
    r"C:\Windows\Fonts\seguisb.ttf",
    r"C:\Windows\Fonts\arial.ttf",
]


def find_font(size):
    for p in FONT_CANDIDATES:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default(size)


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg error:\n{r.stderr[-2000:]}")
    return r


def media_duration(path):
    r = subprocess.run([FFMPEG, "-i", str(path)], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", r.stderr)
    if not m:
        raise RuntimeError(f"Не смог определить длительность {path}")
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))


# ---------- озвучка (edge-tts, бесплатно) ----------

async def tts(text, voice, out_mp3, pitch="+0Hz"):
    last_err = None
    for attempt in range(5):
        try:
            await edge_tts.Communicate(text, voice, rate="+8%", pitch=pitch).save(str(out_mp3))
            return
        except Exception as e:
            last_err = e
            await asyncio.sleep(2 * (attempt + 1))
    raise last_err


# ---------- картинки (pollinations.ai, бесплатно; фолбэк — градиент) ----------

def fallback_image(path, seed_text):
    img = Image.new("RGB", (W, H))
    px = img.load()
    hue = (hash(seed_text) % 60) - 30
    for y in range(H):
        k = y / H
        px_row = (int(18 + 10 * k), int(14 + 8 * k), int(24 + 20 * k + hue % 12))
        for x in range(W):
            px[x, y] = px_row
    img.save(path)


def fetch_image(prompt, path):
    url = ("https://image.pollinations.ai/prompt/"
           + urllib.parse.quote(prompt + ", vertical 9:16, cinematic, high detail")
           + f"?width={W}&height={H}&nologo=true")
    import time
    for attempt in range(4):
        try:
            r = requests.get(url, timeout=120)
            r.raise_for_status()
            path.write_bytes(r.content)
            img = Image.open(path)
            img = img.convert("RGB").resize((W, H))
            img.save(path)
            return
        except Exception as e:
            print(f"    ! попытка {attempt + 1}: картинка не скачалась ({e})")
            time.sleep(10 * (attempt + 1))
    print("    ! сдаюсь, ставлю фон-заглушку")
    fallback_image(path, prompt)


# ---------- субтитры (PNG через Pillow — без проблем с кириллицей) ----------

def wrap_text(text, font, max_width, draw):
    words, lines, cur = text.split(), [], ""
    for w_ in words:
        probe = (cur + " " + w_).strip()
        if draw.textlength(probe, font=font) <= max_width:
            cur = probe
        else:
            if cur:
                lines.append(cur)
            cur = w_
    if cur:
        lines.append(cur)
    return lines


def subtitle_png(text, path):
    font = find_font(72)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    lines = wrap_text(text, font, W - 160, d)
    line_h = 88
    total_h = line_h * len(lines)
    y0 = H - 420 - total_h
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ds = ImageDraw.Draw(shadow)
    for i, line in enumerate(lines):
        x = (W - d.textlength(line, font=font)) / 2
        y = y0 + i * line_h
        ds.text((x, y), line, font=font, fill=(0, 0, 0, 230))
    shadow = shadow.filter(ImageFilter.GaussianBlur(8))
    img.alpha_composite(shadow)
    for i, line in enumerate(lines):
        x = (W - d.textlength(line, font=font)) / 2
        y = y0 + i * line_h
        d.text((x, y), line, font=font, fill=(255, 255, 255, 255),
               stroke_width=4, stroke_fill=(0, 0, 0, 255))
    img.save(path)


def split_chunks(text, max_words=5):
    words = text.split()
    return [" ".join(words[i:i + max_words]) for i in range(0, len(words), max_words)]


# ---------- сборка сцены: картинка + кен-бёрнс + озвучка + субтитры ----------

def build_scene(idx, scene, voice, tmp):
    text = scene["text"]
    mp3 = tmp / f"s{idx}.mp3"
    img = tmp / f"s{idx}.jpg"
    out = tmp / f"s{idx}.mp4"

    asyncio.run(tts(text, scene.get("voice", voice), mp3,
                    scene.get("pitch", "+0Hz")))
    dur = media_duration(mp3) + 0.35
    fetch_image(scene.get("image_prompt", text), img)

    frames = int(dur * FPS)
    zoom_in = idx % 2 == 0
    if zoom_in:
        zexpr = f"1+0.12*on/{frames}"
    else:
        zexpr = f"1.12-0.12*on/{frames}"
    vf = (f"scale={W * 2}:{H * 2},"
          f"zoompan=z='{zexpr}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2'"
          f":d={frames}:s={W}x{H}:fps={FPS}")

    # субтитры кусками по ~5 слов, тайминг пропорционально длине куска
    chunks = split_chunks(text)
    weights = [len(c) for c in chunks]
    total = sum(weights)
    overlays, inputs, t = [], [], 0.0
    for ci, chunk in enumerate(chunks):
        png = tmp / f"s{idx}_c{ci}.png"
        subtitle_png(chunk, png)
        inputs += ["-i", str(png)]
        t_end = t + dur * weights[ci] / total
        prev = "[v0]" if ci == 0 else f"[v{ci}]"
        overlays.append(f"{prev}[{ci + 1}:v]overlay=0:0:enable='between(t,{t:.2f},{t_end:.2f})'[v{ci + 1}]")
        t = t_end

    fc = f"[0:v]{vf}[v0];" + ";".join(overlays)
    last = f"[v{len(chunks)}]"
    run([FFMPEG, "-y", "-loop", "1", "-t", f"{dur:.2f}", "-i", str(img)]
        + inputs
        + ["-i", str(mp3),
           "-filter_complex", fc,
           "-map", last, "-map", f"{len(chunks) + 1}:a",
           "-c:v", "libx264", "-preset", "fast", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "160k", "-shortest", str(out)])
    return out


# ---------- ролик целиком ----------

def build_video(scenario_path):
    data = json.loads(Path(scenario_path).read_text(encoding="utf-8"))
    name = Path(scenario_path).stem
    voice = data.get("voice", "ru-RU-DmitryNeural")
    tmp = WORK / name
    tmp.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(exist_ok=True)

    print(f"== {name}: {len(data['scenes'])} сцен, голос {voice}")
    parts = []
    for i, scene in enumerate(data["scenes"]):
        print(f"  сцена {i + 1}/{len(data['scenes'])}: {scene['text'][:50]}...")
        parts.append(build_scene(i, scene, voice, tmp))

    concat = tmp / "concat.txt"
    concat.write_text("".join(f"file '{p.resolve().as_posix()}'\n" for p in parts),
                      encoding="utf-8")
    final = OUT / f"{name}.mp4"

    music = sorted((ROOT / "music").glob("*.mp3")) if (ROOT / "music").exists() else []
    if music:
        run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(concat),
             "-stream_loop", "-1", "-i", str(music[0]),
             "-filter_complex",
             "[1:a]volume=0.12[m];[0:a][m]amix=inputs=2:duration=first[a]",
             "-map", "0:v", "-map", "[a]",
             "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", str(final)])
    else:
        run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(concat),
             "-c", "copy", str(final)])

    print(f"== готово: {final}  ({media_duration(final):.1f} c)")
    return final


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "scenarios"
    files = sorted(target.glob("*.json")) if target.is_dir() else [target]
    if not files:
        sys.exit("Нет сценариев. Положи .json в scenarios/ (см. sample.json)")
    for f in files:
        build_video(f)
