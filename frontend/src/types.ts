export type Category = string
export type Ranking = 'balanced' | 'lowest_cost' | 'best_condition' | 'fastest_trip'
export type BuyerRequest = { categories: string[]; budget: string | number; buyer_has_car: boolean; buyer_location: Location; radius_miles: number; ranking?: Ranking }
export type Location = { lat: number; lng: number; label?: string }
export type Seller = { id: string; name: string; location: Location; can_drive: boolean; vehicle_type: 'sedan' | 'suv' | 'truck' | null; vehicle_capacity: number }
export type Listing = { id: string; seller_id: string; title: string; category: Category; description: string; price: number; condition: 'like_new' | 'good' | 'fair'; condition_score: number; item_size: number; image_url: string; location: Location; available: boolean; available_date: string }
export type RouteStop = { kind: 'buyer' | 'seller'; seller_id: string | null; name: string; location: Location; listing_ids: string[] }
export type Route = { stops: RouteStop[]; geometry: [number, number][]; source: 'estimated' | 'mapbox'; geometry_source: 'schematic' | 'mapbox'; warning: string | null; distance_miles: number; duration_minutes: number }
export type Bundle = { id: string; request?: BuyerRequest; ranking?: Ranking; ranking_reason?: string; order_id?: string | null; total_difference?: number; replaced_listing_id?: string; listings: Listing[]; sellers: Seller[]; item_total: number; condition_score: number; seller_count: number; total_size: number; transportation_mode: 'buyer_pickup' | 'seller_delivery'; driver: Seller | null; delivery_fee: number; reward_breakdown?: { base: number; distance: number; additional_stops: number; stops_fee: number } | null; total: number; route: Route; distance_miles: number; duration_minutes: number; final_score: number; selection_score: number }
export type BundleResponse = { bundles: Bundle[]; message: string; diagnostics: { combination_checks: { examined: number; feasible_before_routing: number; rejected: Record<string, number> } | null; candidate_count: number; inventory_count: number; possible_combinations: number; candidate_bundles: number; candidate_bundle_limit: number; filtered_out: Record<string, number>; constraints: string[] } }
export type Order = { id: string; bundle_id: string; bundle: Bundle; status: string; created_at: string }
export const categoryNames: Record<Category, string> = { tv: 'TV', tv_stand: 'TV stand', desk: 'Desk', chair: 'Chair', sofa: 'Sofa', table: 'Table', lamp: 'Lamp', vacuum: 'Vacuum', fan: 'Fan' }
export const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n)

export type AnalysisResult = { proposed_category?: string | null; title: string | null; description: string | null; category: Category | null; condition: Listing['condition'] | null; condition_score: number | null; visible_issues: string[]; estimated_product: string | null; suggested_price_min: number | null; suggested_price_max: number | null; confidence: number }

export type BuyerDraft = { categories: string[] | null; budget: number | null; buyer_has_car: boolean | null; location_text: string | null; ranking: Ranking | null; explanations: string[] }
export const rankingNames: Record<Ranking,string> = { balanced:'Balanced', lowest_cost:'Lowest total cost', best_condition:'Best condition', fastest_trip:'Fastest trip' }
export type ResearchResult = { comparables: {title:string;url:string;price:number;currency:string;kind:string;condition:string|null}[]; researched_at:string;price_min:number|null;price_max:number|null;summary:string }
