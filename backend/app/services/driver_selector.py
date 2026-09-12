from app.schemas import Listing, Seller


def eligible_drivers(items: list[Listing], sellers: dict[str, Seller]) -> list[Seller]:
    size = sum(i.item_size for i in items)
    return [sellers[sid] for sid in sorted({i.seller_id for i in items})
            if sellers[sid].can_drive and sellers[sid].vehicle_capacity >= size]
