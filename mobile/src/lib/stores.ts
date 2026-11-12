// Bundled data: McDonald's locations (for the live readout and map) and the
// State Extremes / Top 100 spots (used by demo mode; the real app reads spots from the server).
// Regenerate with: python3 pipeline/fff_data.py app-data
import { StoreIndex } from './geo';

type StoreFile = { source: string; count: number; points: [number, number][] };
export type BundledSpot = {
  kind: 'state' | 'top100';
  state: string;
  state_name: string;
  rank: number | null;
  lat: number;
  lon: number;
  miles: number;
  land: string | null;
  nearest: string | null;
};

let index: StoreIndex | null = null;

export function storeIndex(): StoreIndex {
  if (!index) {
    const file = require('../../assets/data/stores.json') as StoreFile;
    index = new StoreIndex(file.points);
  }
  return index;
}

export function bundledSpots(): BundledSpot[] {
  return require('../../assets/data/spots.json') as BundledSpot[];
}
