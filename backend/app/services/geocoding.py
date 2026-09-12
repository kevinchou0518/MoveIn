"""Mapbox address search with coordinates kept behind human-readable labels."""
import httpx
from fastapi import HTTPException
from app.schemas import Location


class Geocoder:
    def __init__(self, token='', transport=None):
        self.token, self.transport = token, transport

    def search(self, query: str):
        if not self.token:
            raise HTTPException(503, 'Address search is unavailable. Choose a demo neighborhood or try later.')
        try:
            with httpx.Client(timeout=8, transport=self.transport) as client:
                response = client.get('https://api.mapbox.com/search/geocode/v6/forward', params={
                    'q': query, 'access_token': self.token, 'limit': 5, 'autocomplete': 'false',
                    'proximity': '-79.943,40.443', 'country': 'us', 'language': 'en',
                    # Locations are persisted in seller profiles and bundle/order snapshots.
                    'permanent': 'true',
                })
            response.raise_for_status()
            locations = []
            for feature in response.json()['features']:
                properties = feature['properties']
                label = properties.get('full_address') or ', '.join(filter(None, [properties.get('name'), properties.get('place_formatted')]))
                lng, lat = feature['geometry']['coordinates'][:2]
                if label:
                    locations.append(Location(lat=lat, lng=lng, label=label[:150]))
            return locations
        except (httpx.HTTPError, ValueError, KeyError, TypeError, IndexError):
            raise HTTPException(503, 'Address search is unavailable. Try again or choose a demo neighborhood.') from None
