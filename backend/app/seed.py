from datetime import date
from app.schemas import Seller, Listing
from app.demo_photos import PHOTO_LISTINGS, photo_fields


def seed_data():
    # Public demo pickup addresses; verified sources in docs/DEMO_ADDRESSES.md.
    specs = [
        ('maya', 'Maya Chen', 40.450869, -79.934052, '5436 Walnut Street, Pittsburgh, PA 15232', False, None),
        ('jordan', 'Jordan Brooks', 40.438380, -79.922719, '5801 Forbes Avenue, Pittsburgh, PA 15217', True, 'truck'),
        ('alex', 'Alex Rivera', 40.453861, -79.949188, '4724 Baum Boulevard, Pittsburgh, PA 15213', True, 'suv'),
        ('sam', 'Sam Patel', 40.443708, -79.949132, '4400 Forbes Avenue, Pittsburgh, PA 15213', False, None),
        ('riley', 'Riley Morgan', 40.467594, -79.959103, '279 Fisk Street, Pittsburgh, PA 15201', True, 'truck'),
        ('jamie', 'Jamie Park', 40.460895, -79.926516, '130 South Whitfield Street, Pittsburgh, PA 15206', True, 'sedan'),
        ('distant', 'Taylor Reed', 40.455255, -79.899206, '7101 Hamilton Avenue, Pittsburgh, PA 15208', True, 'truck'),
    ]
    sellers = [Seller(id=sid, name=name, location={'lat':lat, 'lng':lng, 'label':label}, can_drive=drive, vehicle_type=vehicle)
               for sid,name,lat,lng,label,drive,vehicle in specs]
    by_id = {s.id:s for s in sellers}
    rows = [
        ('tv-01', 'maya', 'Samsung 40” LED TV', 'tv', 75, 8.7, 2),
        ('tv-02', 'maya', 'TCL 43” smart TV', 'tv', 90, 9.0, 2),
        ('tv-03', 'jamie', 'LG 32” compact TV', 'tv', 55, 7.5, 1),
        ('tv-04', 'jamie', 'Vizio 50” 4K TV', 'tv', 160, 8.1, 3),
        ('tv-05', 'jamie', 'Insignia 32” TV', 'tv', 45, 7.4, 1),
        ('stand-01', 'maya', 'Oak media console', 'tv_stand', 45, 8.8, 2),
        ('stand-02', 'jordan', 'Walnut TV stand', 'tv_stand', 50, 9.1, 2),
        ('stand-03', 'alex', 'Low-profile media unit', 'tv_stand', 35, 8.0, 2),
        ('stand-04', 'riley', 'Vintage pine console', 'tv_stand', 40, 8.5, 2),
        ('desk-01', 'sam', 'Birch writing desk', 'desk', 60, 8.9, 3),
        ('desk-02', 'jordan', 'Solid wood study desk', 'desk', 65, 9.0, 3),
        ('desk-03', 'sam', 'Compact white desk', 'desk', 45, 8.0, 2),
        ('desk-04', 'sam', 'Maple work desk', 'desk', 55, 8.6, 3),
        ('chair-01', 'alex', 'Ergonomic task chair', 'chair', 35, 8.8, 2),
        ('chair-02', 'riley', 'Mesh office chair', 'chair', 30, 8.5, 2),
        ('chair-03', 'sam', 'Upholstered desk chair', 'chair', 25, 8.0, 2),
        ('chair-04', 'riley', 'Adjustable swivel chair', 'chair', 40, 9.0, 2),
        ('chair-05', 'sam', 'Simple oak chair', 'chair', 20, 7.7, 1),
        ('sofa-01', 'riley', 'Two-seat linen sofa', 'sofa', 130, 8.4, 3),
        ('table-01', 'jordan', 'Round dining table', 'table', 55, 8.5, 3),
        ('lamp-01', 'jordan', 'Two-shade floor lamp', 'lamp', 20, 8.0, 2),
        ('vacuum-01', 'alex', 'Shark stick vacuum', 'vacuum', 40, 8.0, 1),
        ('fan-01', 'riley', 'Honeywell compact fan', 'fan', 15, 8.0, 1),
        ('tv-sold', 'sam', 'Already sold TV', 'tv', 10, 9.5, 1),
        ('desk-future', 'maya', 'Not yet available desk', 'desk', 15, 9.5, 2),
        ('tv-premium', 'jordan', 'Premium OLED television', 'tv', 650, 9.8, 3),
        ('chair-far', 'distant', 'Compact accent chair', 'chair', 5, 9.8, 1),
    ]
    listings = [Listing(id=lid, seller_id=sid, title=title, category=category, price=price,
                        description='Fictional demo listing. Clean, sturdy, and ready for a new home. Pickup at '+by_id[sid].location.label+'.',
                        condition='like_new' if condition>=9 else 'good', condition_score=condition,
                        item_size=size, image_url=f'/images/{category}.svg', location=by_id[sid].location,
                        available=lid!='tv-sold', available_date=date(2099,1,1) if lid=='desk-future' else date(2020,1,1))
                for lid,sid,title,category,price,condition,size in rows]
    listings = [i.model_copy(update=photo_fields(i.id)) if i.id in PHOTO_LISTINGS else i for i in listings]
    return sellers, listings
