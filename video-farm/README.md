# Video Farm — бюджетная ферма AI-роликов

Конвейер вертикальных роликов (TikTok / Reels / Shorts) с нулевой себестоимостью:
сценарий → озвучка → AI-картинки → кен-бёрнс → субтитры → готовый mp4 1080×1920.

## Стек (всё бесплатно)

| Шаг | Инструмент | Цена |
|---|---|---|
| Сценарии | Claude Code («сгенерируй 10 сценариев в scenarios/») | 0 ₽ |
| Озвучка | edge-tts (голоса Microsoft, Dmitry/Svetlana) | 0 ₽ |
| Картинки | pollinations.ai (без ключа и регистрации) | 0 ₽ |
| Сборка | ffmpeg из pip-пакета imageio-ffmpeg | 0 ₽ |

## Запуск

```
pip install edge-tts imageio-ffmpeg requests pillow
python make_video.py scenarios/sample.json   # один ролик
python make_video.py scenarios               # все сценарии пачкой
```

Готовые ролики падают в `output/`, промежуточные файлы — в `work/`.

## Формат сценария

```json
{
  "voice": "ru-RU-DmitryNeural",
  "scenes": [
    { "text": "Текст, который озвучится и станет субтитрами.",
      "image_prompt": "prompt for background image, english, cinematic" }
  ]
}
```

3–5 сцен ≈ ролик 15–30 секунд. Голоса: `ru-RU-DmitryNeural`, `ru-RU-SvetlanaNeural`.

## Музыка (опционально)

Положи любой `*.mp3` в папку `music/` — первый файл подмешается фоном на −18 дБ.
Бесплатная музыка без страйков: библиотека YouTube Audio Library, Pixabay Music.

## Публикация

V1 — руками (10 минут в день, TikTok + Reels + Shorts с одного файла).
Когда пойдут просмотры — подключаем автопостинг: self-hosted Postiz (бесплатно)
или официальные API TikTok/Instagram.

## Платные апгрейды (когда захочется качества)

- ElevenLabs (~$5/мес) — живой голос вместо edge-tts.
- Kling / Hailuo (~$10/мес) — 2–3 настоящих видео-кадра на ролик вместо кен-бёрнса.
