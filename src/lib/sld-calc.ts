// Electrical sizing for the single-line diagram (SLD). Pure functions, no I/O.
import type { SystemSpec } from "@/lib/pvsyst-calc";

export const PANEL = { w: 720, voc: 48.5, vmp: 40, imp: 15.6, model: "Suntech STP720S-D66/Nsh+ Bifacial TOPCon" };
const RHO = 0.0175; // copper Ω·mm²/m
const COLD = 1.15; // Voc rise at low temperature
const BREAKERS = [16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800];
const CABLES: [number, number][] = [[4, 32], [6, 41], [10, 57], [16, 76], [25, 101], [35, 125], [50, 151], [70, 192], [95, 232], [120, 269], [150, 309], [185, 353], [240, 415]];

export const breaker = (amps: number) => BREAKERS.find((b) => b >= amps * 1.25) ?? 1000;
export const cable = (amps: number) => (CABLES.find(([, a]) => a >= amps * 1.25) ?? CABLES[CABLES.length - 1]!)[0];
export const dropDC = (len: number, amps: number, mm2: number, volts: number) => (2 * len * amps * RHO) / (mm2 * volts) * 100;
export const dropAC = (len: number, amps: number, mm2: number, three: boolean) =>
  three ? (Math.sqrt(3) * len * amps * RHO) / (mm2 * 400) * 100 : (2 * len * amps * RHO) / (mm2 * 230) * 100;

export function design(s: SystemSpec) {
  const three = s.three;
  const mppt = three ? { min: 200, max: 1000 } : { min: 120, max: 500 };
  const mpptInputs = s.kw <= 12 ? 2 : 4;
  const maxPer = Math.floor(mppt.max / (PANEL.voc * COLD));
  const panels = Math.max(1, s.panels);
  const strings = Math.ceil(panels / maxPer);
  const perString = Math.ceil(panels / strings);
  const voc = Math.floor(perString * PANEL.voc);
  const vmp = perString * PANEL.vmp;
  const kwp = (panels * PANEL.w) / 1000;
  const totalKw = s.kw * s.invCount;
  const batV = three ? 512 : 51.2;
  const batModule = three ? 16 : 5;
  const batCount = s.batKwh > 0 ? Math.max(1, Math.round(s.batKwh / batModule)) : 0;
  const batI = Math.round((totalKw * 1000) / batV);
  const acI = three ? (totalKw * 1000) / (Math.sqrt(3) * 400) : (totalKw * 1000) / 230;
  const acBreaker = breaker(acI);
  const batBreaker = breaker(batI / 1.25 > 0 ? batI / 1.25 : 1);
  const acMm2 = cable(acI), batMm2 = cable(batI);
  const strMm2 = 6;
  const drops = {
    string: dropDC(30, PANEL.imp, strMm2, vmp),
    dcIn: dropDC(5, PANEL.imp, strMm2, vmp),
    bat: dropDC(5, batI, batMm2, batV),
    w4: dropAC(5, acI, acMm2, three),
    w5: dropAC(15, acI, acMm2, three),
    eps: dropAC(10, acI, acMm2, three),
    w6: dropAC(20, acI, acMm2, three),
  };
  const mpptMap = Array.from({ length: mpptInputs }, (_, i) => {
    const ids: number[] = [];
    for (let k = i; k < strings; k += mpptInputs) ids.push(k + 1);
    return ids;
  });
  return {
    three, mppt, mpptInputs, strings, perString, panels, kwp, voc, vmp, vocOk: voc * COLD <= mppt.max && vmp >= mppt.min,
    totalKw, invCount: s.invCount, kw: s.kw, batV, batModule, batCount, batKwh: batCount * batModule, batI, batBreaker, batMm2,
    acI: Math.round(acI), acBreaker, acMm2, strMm2, drops, mpptMap, ct: acBreaker <= 100 ? 100 : acBreaker <= 200 ? 200 : 400,
  };
}
export type Design = ReturnType<typeof design>;
