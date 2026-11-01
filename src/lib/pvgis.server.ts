// Monthly weather for a site, tilt and panel direction from PVGIS (EU JRC, free, no key).
import type { SiteData, Direction } from "@/lib/pvsyst-calc";
import { aspectsOf } from "@/lib/pvsyst-calc";

const API = "https://re.jrc.ec.europa.eu/api/v5_3";

async function j(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`PVGIS ${res.status}: ${await res.text()}`);
  return res.json() as Promise<any>;
}

export async function fetchSite(o: { name: string; lat: number; lon: number; tilt: number | null; dir: Direction }): Promise<SiteData> {
  const q = `lat=${o.lat}&lon=${o.lon}&outputformat=json`;
  const aspects = aspectsOf(o.dir);
  const planes = await Promise.all(aspects.map((a) =>
    j(`${API}/PVcalc?${q}&peakpower=1&loss=14&aspect=${a}&${o.tilt == null ? "optimalinclination=1" : `angle=${o.tilt}`}`)));
  const mr = await j(`${API}/MRcalc?${q}&horirrad=1&avtemp=1&d2g=1`);
  const months = Array.from({ length: 12 }, (_, i) => (mr.outputs.monthly as any[]).filter((m) => m.month === i + 1));
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const globHor = months.map((m) => avg(m.map((x) => x["H(h)_m"])));
  const kd = months.map((m) => avg(m.map((x) => x.Kd)));
  const globInc = Array.from({ length: 12 }, (_, i) => avg(planes.map((p) => p.outputs.monthly.fixed[i]["H(i)_m"])));
  const tilt = o.tilt ?? planes[0].inputs.mounting_system.fixed.slope.value;
  return {
    name: o.name, lat: o.lat, lon: o.lon, alt: Math.round(planes[0].inputs.location.elevation), tilt, dir: o.dir,
    globHor, diffHor: globHor.map((g, i) => g * kd[i]!), tAmb: months.map((m) => avg(m.map((x) => x.T2m))), globInc,
    source: "PVGIS-SARAH3 / ERA5",
  };
}
