"""Create small, orientation-correct demo assets without EXIF metadata."""
import sys
from pathlib import Path
from PIL import Image, ImageOps
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
from app.demo_photos import PHOTO_LISTINGS

def main():
    destination = ROOT / 'backend/fixtures/photos'
    destination.mkdir(parents=True, exist_ok=True)
    for listing_id, (filename, *_) in PHOTO_LISTINGS.items():
        with Image.open(ROOT / 'furniture-photos' / filename) as source:
            photo = ImageOps.exif_transpose(source).convert('RGB')
            photo.thumbnail((1600, 1600))
            photo.save(destination / f'{listing_id}.jpg', quality=85)
        print(listing_id)

if __name__ == '__main__': main()
