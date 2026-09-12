"""Mapbox address search with coordinates kept behind human-readable labels."""
import httpx
from fastapi import HTTPException
from app.schemas import Location


class Geocoder:
    def __init__(self, token='', transport=None):
        self.token, self.transport = token, transport

    def search(self, query: str):
        return [location for location, _ in self._matches(query)]

    def resolve(self, text: str):
        """Best coordinates for free text plus the provider's own label for that match.

        Buyers often name a building or landmark the map does not know ("Kenmawr, Shady Avenue").
        When the provider only matches the surrounding street or area, the label keeps the buyer's
        wording in front of the matched area; an exact address or same-name match uses the map label.
        """
        matches = self._matches(text)
        if not matches:
            return None, None
        location, properties = matches[0]
        area = properties.get('place_formatted') or ''
        exact = properties.get('feature_type') == 'address' or (properties.get('name') or '').strip().lower() == text.strip().lower()
        matched = location.label
        if not exact and area:
            location = Location(lat=location.lat, lng=location.lng, label=f'{text.strip()}, {area}'[:150])
        return location, matched

    def _matches(self, query: str):
        if not self.token:
            raise HTTPException(503, 'Address search is unavailable. Try again later.')
        try:
            with httpx.Client(timeout=8, transport=self.transport) as client:
                response = client.get('https://api.mapbox.com/search/geocode/v6/forward', params={
                    'q': query, 'access_token': self.token, 'limit': 5, 'autocomplete': 'false',
                    'proximity': '-79.943,40.443', 'country': 'us', 'language': 'en',
                    # Locations are persisted in seller profiles and bundle/order snapshots.
                    'permanent': 'true',
                })
            response.raise_for_status()
            matches = []
            for feature in response.json()['features']:
                properties = feature['properties']
                label = properties.get('full_address') or ', '.join(filter(None, [properties.get('name'), properties.get('place_formatted')]))
                lng, lat = feature['geometry']['coordinates'][:2]
                if label:
                    matches.append((Location(lat=lat, lng=lng, label=label[:150]), properties))
            return matches
        except (httpx.HTTPError, ValueError, KeyError, TypeError, IndexError):
            raise HTTPException(503, 'Address search is unavailable. Try again later.') from None
