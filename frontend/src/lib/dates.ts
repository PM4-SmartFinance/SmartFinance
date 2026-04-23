export const formatLocalDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const subDays = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() - n);
  return r;
};

export const subMonths = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setMonth(r.getMonth() - n);
  return r;
};
