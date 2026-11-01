export type Stage = "new" | "quote" | "sld" | "cod" | "buy" | "human";

export const STAGES: Record<Stage, string> = {
  new: "مهتم جديد",
  quote: "عرض سعر",
  sld: "يحتاج مخطط",
  cod: "الدفع عند الاستلام",
  buy: "جاهز للشراء",
  human: "يحتاج موظف",
};
