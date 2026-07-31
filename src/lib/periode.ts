import { endOfDay, format, startOfDay, startOfMonth, subDays } from "date-fns";

export const PERIODE_PRESETS = ["jour", "7j", "30j", "mois", "perso"] as const;

export type PeriodePreset = (typeof PERIODE_PRESETS)[number];

export type Periode = {
  preset: PeriodePreset;
  debut: Date;
  fin: Date;
  /** Bornes au format yyyy-MM-dd, pour les <input type="date"> et les liens. */
  debutInput: string;
  finInput: string;
  label: string;
};

export const PERIODE_LABELS: Record<PeriodePreset, string> = {
  jour: "Aujourd'hui",
  "7j": "7 derniers jours",
  "30j": "30 derniers jours",
  mois: "Mois en cours",
  perso: "Période personnalisée",
};

function toInput(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function parseInput(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Résout la période demandée dans l'URL. Le mois en cours sert de défaut : c'est
 * la maille de travail naturelle de la comptabilité.
 */
export function resolvePeriode(params: {
  periode?: string;
  debut?: string;
  fin?: string;
}): Periode {
  const today = new Date();
  const asked = PERIODE_PRESETS.find((p) => p === params.periode);

  const customDebut = parseInput(params.debut);
  const customFin = parseInput(params.fin);
  // Des bornes explicites l'emportent : elles arrivent aussi depuis un lien partagé.
  const preset: PeriodePreset = customDebut || customFin ? "perso" : (asked ?? "mois");

  let debut: Date;
  let fin = endOfDay(today);

  switch (preset) {
    case "jour":
      debut = startOfDay(today);
      break;
    case "7j":
      debut = startOfDay(subDays(today, 6));
      break;
    case "30j":
      debut = startOfDay(subDays(today, 29));
      break;
    case "perso":
      debut = startOfDay(customDebut ?? subDays(today, 29));
      fin = endOfDay(customFin ?? today);
      break;
    case "mois":
    default:
      debut = startOfMonth(today);
      break;
  }

  if (debut > fin) [debut, fin] = [startOfDay(fin), endOfDay(debut)];

  return {
    preset,
    debut,
    fin,
    debutInput: toInput(debut),
    finInput: toInput(fin),
    label:
      preset === "perso"
        ? `${format(debut, "dd/MM/yyyy")} → ${format(fin, "dd/MM/yyyy")}`
        : PERIODE_LABELS[preset],
  };
}

/** Sérialise une période en query string, pour les liens entre pages comptables. */
export function periodeToQuery(periode: Periode) {
  const params = new URLSearchParams();
  if (periode.preset === "perso") {
    params.set("debut", periode.debutInput);
    params.set("fin", periode.finInput);
  } else if (periode.preset !== "mois") {
    params.set("periode", periode.preset);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
