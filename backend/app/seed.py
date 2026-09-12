from datetime import date
from app.schemas import Seller, Listing


def seed_data():
    specs = [
        ('maya', 'Maya Chen', 40.4512, -79.9321, 'Shadyside', False, None),
        ('jordan', 'Jordan Brooks', 40.4318, -79.9222, 'Squirrel Hill', True, 'truck'),
        ('alex', 'Alex Rivera', 40.4601, -79.9514, 'Bloomfield', True, 'suv'),
        ('sam', 'Sam Patel', 40.4438, -79.9581, 'Oakland', False, None),
        ('riley', 'Riley Morgan', 40.4691, -79.9612, 'Lawrenceville', True, 'truck'),
        ('jamie', 'Jamie Park', 40.4482, -79.9405, 'Shadyside', True, 'sedan'),
        ('distant', 'Taylor Reed', 41.50, -80.1, 'Outside demo area', True, 'truck'),
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
        ('tv-sold', 'sam', 'Already sold TV', 'tv', 10, 9.5, 1),
        ('desk-future', 'maya', 'Not yet available desk', 'desk', 15, 9.5, 2),
        ('tv-premium', 'jordan', 'Premium OLED television', 'tv', 650, 9.8, 3),
        ('chair-far', 'distant', 'Out-of-area chair', 'chair', 5, 9.8, 1),
    ]
    listings = [Listing(id=lid, seller_id=sid, title=title, category=category, price=price,
                        description='Fictional demo listing. Clean, sturdy, and ready for a new home. Pickup in '+by_id[sid].location.label+'.',
                        condition='like_new' if condition>=9 else 'good', condition_score=condition,
                        item_size=size, image_url=f'/images/{category}.svg', location=by_id[sid].location,
                        available=lid!='tv-sold', available_date=date(2099,1,1) if lid=='desk-future' else date(2020,1,1))
                for lid,sid,title,category,price,condition,size in rows]
    return sellers, listings
