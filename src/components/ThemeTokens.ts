export const ThemeTokens = {
  colors: {
    canvas: "#080d12",
    surface: "#0d151d",
    surfaceRaised: "#111d27",
    surfaceElevated: "#162632",
    line: "#21333f",
    lineStrong: "#2d4654",
    text: "#e5eef2",
    textMuted: "#8da3ad",
    textDim: "#5f7782",
    cyan: "#39d0c1",
    cyanStrong: "#18a99e",
    amber: "#e9ae45",
    red: "#ef6b73",
    green: "#54c98d"
  },
  spacing: {
    sidebar: "248px",
    header: "64px",
    footer: "30px"
  }
} as const;

export type ThemeTokenName = keyof typeof ThemeTokens.colors;
