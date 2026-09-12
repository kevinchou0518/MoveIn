"""Reviewed mappings for user-supplied photos; all listing details remain fictional."""
PHOTO_LISTINGS = {
    'chair-05': ('IMG_0258.jpeg', 'Simple oak chair', 'Black metal dining chair', 'Black padded seat with a visible tear at the front corner and tape on the seat.'),
    'vacuum-01': ('IMG_0259.jpeg', None, 'Shark stick vacuum', 'Upright stick vacuum with floor head. Operation and accessories are unverified.'),
    'tv-01': ('IMG_0260.jpeg', 'Samsung 40” LED TV', 'Element Roku television', 'Television only; media stand and nearby table are not included. Screen size and operation are unverified.'),
    'lamp-01': ('IMG_0261.jpeg', None, 'Two-shade floor lamp', 'Black floor lamp with two white shades. Electrical operation is unverified.'),
    'chair-03': ('IMG_0262.jpeg', 'Upholstered desk chair', 'Cream folding saucer chair', 'Cream upholstered round chair with a folding metal frame.'),
    'sofa-01': ('IMG_0263.jpeg', 'Two-seat linen sofa', 'Gray upholstered sofa', 'Gray upholstered sofa with dark legs. Dimensions and any sleeper mechanism are unverified.'),
    'chair-04': ('IMG_5963.JPG', 'Adjustable swivel chair', 'Light mesh swivel chair', 'Pale mesh office chair with armrests, casters, and visible marks on the seat.'),
    'fan-01': ('IMG_5964.JPG', None, 'Honeywell compact fan', 'Black compact floor or tabletop fan. Electrical operation is unverified.'),
}

def photo_fields(listing_id):
    _, _, title, description = PHOTO_LISTINGS[listing_id]
    return {'title': title, 'description': 'Fictional demo listing using a supplied representative photo. '+description+' Price, condition score, size units and seller are demo values; inspect before purchase.', 'image_url': f'/uploads/demo/{listing_id}.jpg'}


def install_demo_photos(uploads):
    """Materialize committed seed assets in the same storage used by uploads."""
    from pathlib import Path
    import shutil
    source = Path(__file__).resolve().parents[1] / 'fixtures/photos'
    destination = Path(uploads) / 'demo'
    destination.mkdir(parents=True, exist_ok=True)
    for listing_id in PHOTO_LISTINGS:
        shutil.copyfile(source / f'{listing_id}.jpg', destination / f'{listing_id}.jpg')
