/**
 * Location Repository: hierarchical Country -> State/Province -> City management.
 * Pre-seeds India (default) and major global territories, allows adding new states and cities
 * without duplicates, and persists custom locations and region filter selections.
 */

import { countryOptions, normalise, problemsWith, type RegionSelection } from './region-scope'

export const DEFAULT_COUNTRY = 'India'
export const DEFAULT_REGION: RegionSelection = { country: DEFAULT_COUNTRY }
export const DEFAULT_REGIONS: RegionSelection[] = [DEFAULT_REGION]
export const REGIONS_STORAGE_KEY = 'g2g.signals.regions.v1'
export const CUSTOM_LOCATIONS_STORAGE_KEY = 'g2g.locations.custom.v1'

export interface CustomLocationEntry {
  country: string
  state?: string
  city?: string
}

/** Pre-seeded hierarchical location data */
export const SEED_LOCATIONS: Record<string, Record<string, string[]>> = {
  India: {
    Gujarat: [
      'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar',
      'Bhavnagar', 'Jamnagar', 'Junagadh', 'Anand', 'Navsari',
      'Morbi', 'Bharuch', 'Vapi', 'Mehsana', 'Patan', 'Porbandar',
    ],
    Maharashtra: [
      'Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik',
      'Aurangabad', 'Solapur', 'Navi Mumbai', 'Kolhapur', 'Amravati', 'Nanded',
    ],
    Delhi: [
      'New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi', 'Central Delhi',
    ],
    Karnataka: [
      'Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru', 'Belagavi', 'Davanagere', 'Ballari', 'Kalaburagi',
    ],
    'Tamil Nadu': [
      'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Erode', 'Vellore',
    ],
    'Uttar Pradesh': [
      'Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Varanasi', 'Meerut', 'Prayagraj', 'Noida', 'Aligarh',
    ],
    Rajasthan: [
      'Jaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Ajmer', 'Udaipur', 'Bhilwara', 'Alwar', 'Sikar',
    ],
    Telangana: [
      'Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam',
    ],
    Kerala: [
      'Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Kollam', 'Thrissur', 'Kannur', 'Alappuzha',
    ],
    'West Bengal': [
      'Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Bardhaman',
    ],
    'Andhra Pradesh': [
      'Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Tirupati',
    ],
    'Madhya Pradesh': [
      'Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar',
    ],
    Punjab: [
      'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali',
    ],
    Haryana: [
      'Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Karnal', 'Hisar', 'Rohtak',
    ],
    Bihar: [
      'Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga', 'Purnia',
    ],
    Odisha: [
      'Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri',
    ],
    Assam: [
      'Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tinsukia',
    ],
    Goa: [
      'Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda',
    ],
    Chandigarh: ['Chandigarh'],
    Uttarakhand: [
      'Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rishikesh',
    ],
    'Himachal Pradesh': [
      'Shimla', 'Dharamshala', 'Solan', 'Mandi', 'Kullu',
    ],
    Jharkhand: [
      'Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar',
    ],
    Chhattisgarh: [
      'Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg',
    ],
    'Jammu and Kashmir': [
      'Srinagar', 'Jammu', 'Anantnag', 'Baramulla',
    ],
    'Dadra and Nagar Haveli and Daman and Diu': [
      'Daman', 'Diu', 'Silvassa',
    ],
    Puducherry: [
      'Puducherry', 'Karaikal', 'Mahe', 'Yanam',
    ],
    Sikkim: ['Gangtok', 'Namchi', 'Gyalshing'],
    Tripura: ['Agartala', 'Udaipur', 'Dharmanagar'],
    Meghalaya: ['Shillong', 'Tura', 'Jowai'],
    Manipur: ['Imphal', 'Churachandpur', 'Thoubal'],
    Nagaland: ['Kohima', 'Dimapur', 'Mokokchung'],
    Mizoram: ['Aizawl', 'Lunglei', 'Champhai'],
    'Arunachal Pradesh': ['Itanagar', 'Naharlagun', 'Pasighat'],
    Ladakh: ['Leh', 'Kargil'],
    'Andaman and Nicobar Islands': ['Port Blair'],
    Lakshadweep: ['Kavaratti'],
  },
  'United States': {
    California: ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento', 'Oakland'],
    'New York': ['New York', 'Buffalo', 'Rochester', 'Albany', 'Syracuse'],
    Texas: ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth', 'El Paso'],
    Washington: ['Seattle', 'Spokane', 'Tacoma', 'Bellevue', 'Olympia'],
    Illinois: ['Chicago', 'Aurora', 'Naperville', 'Rockford', 'Springfield'],
    Florida: ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Tallahassee'],
    Massachusetts: ['Boston', 'Cambridge', 'Worcester', 'Springfield'],
  },
  'United Kingdom': {
    England: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Liverpool', 'Bristol'],
    Scotland: ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee'],
    Wales: ['Cardiff', 'Swansea', 'Newport'],
    'Northern Ireland': ['Belfast', 'Derry'],
  },
  'United Arab Emirates': {
    Dubai: ['Dubai'],
    'Abu Dhabi': ['Abu Dhabi', 'Al Ain'],
    Sharjah: ['Sharjah'],
    Ajman: ['Ajman'],
  },
  Canada: {
    Ontario: ['Toronto', 'Ottawa', 'Mississauga', 'Hamilton'],
    'British Columbia': ['Vancouver', 'Victoria', 'Surrey', 'Burnaby'],
    Quebec: ['Montreal', 'Quebec City', 'Laval'],
    Alberta: ['Calgary', 'Edmonton'],
  },
  Australia: {
    'New South Wales': ['Sydney', 'Newcastle', 'Wollongong'],
    Victoria: ['Melbourne', 'Geelong', 'Ballarat'],
    Queensland: ['Brisbane', 'Gold Coast', 'Sunshine Coast'],
    'Western Australia': ['Perth', 'Bunbury'],
  },
  Germany: {
    Bavaria: ['Munich', 'Nuremberg', 'Augsburg'],
    Berlin: ['Berlin'],
    'North Rhine-Westphalia': ['Cologne', 'Dusseldorf', 'Dortmund'],
    Hesse: ['Frankfurt', 'Wiesbaden', 'Kassel'],
    'Baden-Wurttemberg': ['Stuttgart', 'Karlsruhe', 'Mannheim'],
  },
  Singapore: {
    'Central Region': ['Singapore'],
  },
}

/** Reads custom user-added locations from localStorage safely */
export function loadCustomLocations(): CustomLocationEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CUSTOM_LOCATIONS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Saves custom locations to localStorage */
function persistCustomLocations(list: CustomLocationEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CUSTOM_LOCATIONS_STORAGE_KEY, JSON.stringify(list))
  } catch {
    // ignore quota/storage errors
  }
}

/**
 * Returns available countries:
 * - India is first and default
 * - Custom added countries merged
 * - All other countries alphabetically from browser locale
 */
export function getAvailableCountries(): { code: string; name: string }[] {
  const base = countryOptions()
  const custom = loadCustomLocations()
  const existingNames = new Set(base.map((c) => c.name.toLowerCase()))

  const additional: { code: string; name: string }[] = []
  for (const item of custom) {
    if (item.country && !existingNames.has(item.country.toLowerCase())) {
      existingNames.add(item.country.toLowerCase())
      additional.push({ code: item.country.slice(0, 2).toUpperCase(), name: item.country })
    }
  }

  const all = [...base, ...additional]
  const india = all.find((c) => c.name.toLowerCase() === 'india')
  const others = all.filter((c) => c.name.toLowerCase() !== 'india').sort((a, b) => a.name.localeCompare(b.name))

  return india ? [india, ...others] : others
}

/** Case-insensitive comparison helper */
const same = (a?: string, b?: string) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()

/**
 * Returns available states for a given country:
 * Combines seed states, custom added states, and ICP suggestions.
 */
export function getAvailableStates(country: string, suggestions: string[] = []): string[] {
  if (!country || !country.trim()) return []

  const trimmedCountry = country.trim()
  const out: string[] = []
  const seen = new Set<string>()

  // 1. Pre-seeded states
  const seedEntry = Object.entries(SEED_LOCATIONS).find(([k]) => same(k, trimmedCountry))
  if (seedEntry) {
    for (const stateName of Object.keys(seedEntry[1])) {
      const lower = stateName.toLowerCase()
      if (!seen.has(lower)) {
        seen.add(lower)
        out.push(stateName)
      }
    }
  }

  // 2. Custom user-added states
  const custom = loadCustomLocations()
  for (const item of custom) {
    if (same(item.country, trimmedCountry) && item.state) {
      const lower = item.state.toLowerCase()
      if (!seen.has(lower)) {
        seen.add(lower)
        out.push(item.state)
      }
    }
  }

  // 3. Suggestions (e.g. from product ICP)
  for (const s of suggestions) {
    if (s && s.trim()) {
      const lower = s.trim().toLowerCase()
      if (!seen.has(lower)) {
        seen.add(lower)
        out.push(s.trim())
      }
    }
  }

  return out.sort((a, b) => a.localeCompare(b))
}

/**
 * Returns available cities for a given country and state:
 * Combines seed cities and custom added cities.
 */
export function getAvailableCities(country: string, state: string): string[] {
  if (!country || !state || !country.trim() || !state.trim()) return []

  const trimmedCountry = country.trim()
  const trimmedState = state.trim()
  const out: string[] = []
  const seen = new Set<string>()

  // 1. Pre-seeded cities
  const seedCountry = Object.entries(SEED_LOCATIONS).find(([k]) => same(k, trimmedCountry))
  if (seedCountry) {
    const seedState = Object.entries(seedCountry[1]).find(([k]) => same(k, trimmedState))
    if (seedState) {
      for (const cityName of seedState[1]) {
        const lower = cityName.toLowerCase()
        if (!seen.has(lower)) {
          seen.add(lower)
          out.push(cityName)
        }
      }
    }
  }

  // 2. Custom user-added cities
  const custom = loadCustomLocations()
  for (const item of custom) {
    if (same(item.country, trimmedCountry) && same(item.state, trimmedState) && item.city) {
      const lower = item.city.toLowerCase()
      if (!seen.has(lower)) {
        seen.add(lower)
        out.push(item.city)
      }
    }
  }

  return out.sort((a, b) => a.localeCompare(b))
}

/**
 * Adds a new custom location (country, state, city) if not already existing.
 * Prevents duplicate entries (case-insensitive) and saves locally and optionally to backend.
 */
export function addCustomLocation(raw: CustomLocationEntry): { success: boolean; problems: string[] } {
  const problems = problemsWith(raw)
  if (problems.length > 0) {
    return { success: false, problems }
  }
  const norm = normalise(raw)

  const custom = loadCustomLocations()
  const key = [norm.country, norm.state ?? '', norm.city ?? ''].map((s) => s.toLowerCase()).join('|')

  const exists = custom.some((item) => {
    const itemKey = [item.country, item.state ?? '', item.city ?? ''].map((s) => s.toLowerCase()).join('|')
    return itemKey === key
  })

  if (!exists) {
    custom.push(norm)
    persistCustomLocations(custom)
  }

  return { success: true, problems: [] }
}

/** Reads the user's saved Region selection, defaulting to India for new users */
export function loadSavedRegions(): RegionSelection[] {
  if (typeof window === 'undefined') return DEFAULT_REGIONS
  try {
    const raw = localStorage.getItem(REGIONS_STORAGE_KEY)
    if (raw !== null) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
  } catch {
    // fallback
  }
  return DEFAULT_REGIONS
}

/** Persists the user's chosen regions to localStorage */
export function persistSavedRegions(list: RegionSelection[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(REGIONS_STORAGE_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}
