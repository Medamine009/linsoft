import { Injectable } from '@angular/core';

export interface LatLng { lat: number; lng: number; }

/**
 * Géocodage léger : dictionnaire de villes courantes (Tunisie + monde) +
 * fallback déterministe pour les lieux inconnus (positionne près de Tunis avec un offset stable).
 */
@Injectable({ providedIn: 'root' })
export class GeoService {

  private cities: Record<string, LatLng> = {
    // Tunisie
    'tunis': { lat: 36.8065, lng: 10.1815 },
    'ariana': { lat: 36.8625, lng: 10.1956 },
    'sousse': { lat: 35.8254, lng: 10.6360 },
    'sfax': { lat: 34.7406, lng: 10.7603 },
    'monastir': { lat: 35.7780, lng: 10.8262 },
    'nabeul': { lat: 36.4513, lng: 10.7357 },
    'hammamet': { lat: 36.4000, lng: 10.6167 },
    'bizerte': { lat: 37.2744, lng: 9.8739 },
    'gabes': { lat: 33.8815, lng: 10.0982 },
    'kairouan': { lat: 35.6781, lng: 10.0963 },
    'gafsa': { lat: 34.4250, lng: 8.7842 },
    'tozeur': { lat: 33.9197, lng: 8.1335 },
    'djerba': { lat: 33.8076, lng: 10.8451 },
    // International
    'paris': { lat: 48.8566, lng: 2.3522 },
    'lyon': { lat: 45.7640, lng: 4.8357 },
    'marseille': { lat: 43.2965, lng: 5.3698 },
    'cannes': { lat: 43.5528, lng: 7.0174 },
    'nice': { lat: 43.7102, lng: 7.2620 },
    'londres': { lat: 51.5074, lng: -0.1278 },
    'london': { lat: 51.5074, lng: -0.1278 },
    'berlin': { lat: 52.5200, lng: 13.4050 },
    'madrid': { lat: 40.4168, lng: -3.7038 },
    'rome': { lat: 41.9028, lng: 12.4964 },
    'barcelone': { lat: 41.3851, lng: 2.1734 },
    'dubai': { lat: 25.2048, lng: 55.2708 },
    'casablanca': { lat: 33.5731, lng: -7.5898 },
    'alger': { lat: 36.7538, lng: 3.0588 }
  };

  private center: LatLng = { lat: 34.5, lng: 9.5 }; // Tunisie centre

  /** Résout les coords d'un événement : priorité aux lat/lng stockées, sinon géocode le lieu. */
  resolveEvent(ev: any): LatLng {
    if (ev && ev.latitude != null && ev.longitude != null) {
      return { lat: ev.latitude, lng: ev.longitude };
    }
    return this.resolve(ev?.location);
  }

  resolve(location: string | null | undefined): LatLng {
    if (!location) return this.fallback('unknown');
    const key = location.toLowerCase().trim();
    // Match exact
    if (this.cities[key]) return this.cities[key];
    // Match partiel (ex: "Palais des Congrès, Paris" -> contient "paris")
    for (const city of Object.keys(this.cities)) {
      if (key.includes(city)) return this.cities[city];
    }
    return this.fallback(key);
  }

  /** Position déterministe (stable) autour du centre Tunisie pour les lieux inconnus. */
  private fallback(seed: string): LatLng {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100000;
    const dLat = ((h % 200) / 100 - 1) * 1.5;       // ±1.5°
    const dLng = (((h >> 3) % 200) / 100 - 1) * 1.5;
    return { lat: this.center.lat + dLat, lng: this.center.lng + dLng };
  }

  defaultCenter(): LatLng { return this.center; }
}
