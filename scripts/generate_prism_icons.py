from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ICONS_DIR = ROOT / "src-tauri" / "icons"
MASTER_SIZE = 1024


def draw_icon(size: int = MASTER_SIZE) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    tile_radius = int(size * 0.25)
    draw.rounded_rectangle(
        (0, 0, size - 1, size - 1),
        radius=tile_radius,
        fill=(0, 0, 0, 255),
    )

    prism = [
        (int(size * 0.31), int(size * 0.25)),
        (int(size * 0.60), int(size * 0.50)),
        (int(size * 0.31), int(size * 0.75)),
    ]
    draw.polygon(prism, fill=(255, 255, 255, 255))

    beam_width = max(10, int(size * 0.05))
    draw.line(
        [
            (int(size * 0.60), int(size * 0.50)),
            (int(size * 0.80), int(size * 0.41)),
        ],
        fill=(86, 86, 86, 255),
        width=beam_width,
    )
    draw.line(
        [
            (int(size * 0.60), int(size * 0.50)),
            (int(size * 0.80), int(size * 0.59)),
        ],
        fill=(228, 228, 228, 255),
        width=beam_width,
    )

    return image


def save_outputs(master: Image.Image) -> None:
    ICONS_DIR.mkdir(parents=True, exist_ok=True)

    master_512 = master.resize((512, 512), Image.Resampling.LANCZOS)
    master_512.save(ICONS_DIR / "icon-512.png")

    sizes = {
        "128x128.png": 128,
        "32x32.png": 32,
    }
    for name, px in sizes.items():
        master.resize((px, px), Image.Resampling.LANCZOS).save(ICONS_DIR / name)

    master_512.save(
        ICONS_DIR / "icon.ico",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )


def main() -> None:
    master = draw_icon()
    save_outputs(master)
    print(f"Generated icons in {ICONS_DIR}")


if __name__ == "__main__":
    main()
