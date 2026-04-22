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
        fill=(5, 5, 5, 255),
    )

    arrow = [
        (size * 0.3828125, size * 0.265625),
        (size * 0.6796875, size * 0.5),
        (size * 0.3828125, size * 0.734375),
    ]
    arrow_width = max(12, int(size * 0.0625))
    draw.polygon(arrow, fill=(255, 255, 255, 255))
    draw.line(arrow + [arrow[0]], fill=(255, 255, 255, 255), width=arrow_width, joint="curve")

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
