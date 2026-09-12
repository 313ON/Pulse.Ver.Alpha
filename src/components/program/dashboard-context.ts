export type DashboardContext = { planYear: number; organizationalUnitId: string };
export const ALL_ORGANIZATIONAL_UNITS = "ALL";
export type DashboardContextOptions = { planYears: number[]; organizationalUnits: Array<{ id: string; name: string }> };
