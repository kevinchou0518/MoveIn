export type Category = 'tv' | 'tv_stand' | 'desk' | 'chair' | 'sofa' | 'table'
export type Location = { lat: number; lng: number; label?: string }
export type Seller = { id: string; name: string; location: Location; can_drive: boolean; vehicle_type: 'sedan' | 'suv' | 'truck' | null; vehicle_capacity: number }
export type Listing = { id: string; seller_id: string; title: string; category: Category; description: string; price: number; condition: 'like_new' | 'good' | 'fair'; condition_score: number; item_size: number; image_url: string; location: Location; available: boolean; available_date: string }
export type RouteStop = { kind: 'buyer' | 'seller'; seller_id: string | null; name: string; location: Location; listing_ids: string[] }
export type Route = { stops: RouteStop[]; geometry: [number, number][]; source: 'estimated' | 'mapbox'; geometry_source: 'schematic' | 'mapbox'; warning: string | null; distance_miles: number; duration_minutes: number }
export type Bundle = { id: string; listings: Listing[]; sellers: Seller[]; item_total: number; condition_score: number; seller_count: number; total_size: number; transportation_mode: 'buyer_pickup' | 'seller_delivery'; driver: Seller | null; delivery_fee: number; total: number; route: Route; distance_miles: number; duration_minutes: number; final_score: number; selection_score: number }
export type BundleResponse = { bundles: Bundle[]; message: string; diagnostics: { combination_checks: { examined: number; feasible_before_routing: number; rejected: Record<string, number> } | null; candidate_count: number; inventory_count: number; possible_combinations: number; candidate_bundles: number; candidate_bundle_limit: number; filtered_out: Record<string, number>; constraints: string[] } }
export type Order = { id: string; bundle_id: string; bundle: Bundle; status: string; created_at: string }
export const categoryNames: Record<Category, string> = { tv: 'TV', tv_stand: 'TV stand', desk: 'Desk', chair: 'Chair', sofa: 'Sofa', table: 'Table' }
export const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n)
