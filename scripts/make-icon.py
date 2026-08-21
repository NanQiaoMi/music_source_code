from PIL import Image
from pathlib import Path

source = Path("public/default-cover.png")
target = Path("public/app-icon.ico")
with Image.open(source) as image:
    image.convert("RGBA").save(target, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (256, 256)])
print(target)
