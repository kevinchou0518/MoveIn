from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Model(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False, str_strip_whitespace=True)


Category = Annotated[str, Field(min_length=1, max_length=80, pattern=r'^[a-z0-9_]+$')]
Ranking = Literal['balanced', 'lowest_cost', 'best_condition', 'fastest_trip']

class Location(Model):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    label: str = Field(default='', max_length=150)


VEHICLE_CAPACITIES = {'sedan': 4, 'suv': 7, 'truck': 12}
Vehicle = Literal['sedan', 'suv', 'truck']
Money = Annotated[Decimal, Field(ge=0, le=100000, max_digits=8, decimal_places=2)]


class SellerCreate(Model):
    name: str = Field(min_length=1, max_length=80)
    location: Location
    can_drive: bool = False
    vehicle_type: Vehicle | None = None

    @model_validator(mode='after')
    def validate_vehicle(self):
        if self.can_drive and not self.vehicle_type:
            raise ValueError('Choose a vehicle type when offering delivery.')
        if not self.can_drive:
            self.vehicle_type = None
        return self


class Seller(SellerCreate):
    id: str
    owner_id: str | None = None
    revision: int = 0

    @property
    def vehicle_capacity(self) -> int:
        return VEHICLE_CAPACITIES.get(self.vehicle_type, 0)

    def public(self) -> dict:
        return {**self.model_dump(mode='json', exclude={'owner_id'}), 'vehicle_capacity': self.vehicle_capacity}


class ListingCreate(Model):
    seller_id: str
    title: str = Field(min_length=1, max_length=120)
    category: Category
    description: str = Field(default='', max_length=2000)
    price: Money
    condition: Literal['like_new', 'good', 'fair'] = 'good'
    condition_score: float = Field(default=8, ge=0, le=10)
    item_size: int = Field(default=2, ge=1, le=3, strict=True)
    image_url: str = Field(default='', max_length=500)
    available_date: date = Field(default_factory=lambda: utcnow().date())

    @field_validator('category', mode='before')
    @classmethod
    def normalize_category(cls, value):
        return 'chair' if value == 'office_chair' else value

    @field_validator('image_url')
    @classmethod
    def safe_image(cls, value):
        if value and not value.startswith(('/uploads/', '/images/', 'https://')):
            raise ValueError('Image must be an uploaded image or an HTTPS URL.')
        return value


class Listing(ListingCreate):
    id: str
    location: Location
    available: bool = True
    status: Literal['available', 'reserved', 'sold', 'withdrawn'] | None = None
    reserved_order_id: str | None = None
    revision: int = 0

    @property
    def price_cents(self) -> int:
        return int(self.price * 100)

    def public(self) -> dict:
        return {**self.model_dump(mode='json', exclude={'reserved_order_id'}),
                'status': self.status or ('available' if self.available else 'sold'), 'price': float(self.price)}


class BundleRequest(Model):
    categories: list[Category] = Field(min_length=1, max_length=6)
    budget: Money = Field(gt=0)
    buyer_has_car: bool
    buyer_location: Location
    ranking: Ranking = 'balanced'
    radius_miles: float = Field(default=25, gt=0, le=100)

    @field_validator('categories', mode='before')
    @classmethod
    def normalize_categories(cls, values):
        if isinstance(values, list):
            return ['chair' if v == 'office_chair' else v for v in values]
        return values

    @field_validator('categories')
    @classmethod
    def unique_categories(cls, values):
        if len(values) != len(set(values)):
            raise ValueError('Select each category only once.')
        return values
