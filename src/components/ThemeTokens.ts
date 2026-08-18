export const ThemeTokens = {
  direction: "rtl",
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
    footer: "30px",
    density: {
      compact: "4px",
      standard: "8px",
      comfortable: "16px",
      section: "24px"
    }
  },
  typography: {
    fontFamily: "var(--font-vazirmatn), Vazirmatn, Tahoma, Arial, sans-serif",
    heading: {
      size: "24px",
      weight: 700,
      lineHeight: 1.5,
      letterSpacing: "-0.01em"
    },
    body: {
      size: "13px",
      weight: 400,
      lineHeight: 1.75,
      letterSpacing: "0"
    },
    caption: {
      size: "10px",
      weight: 500,
      lineHeight: 1.5,
      letterSpacing: "0.01em"
    },
    mono: {
      family: "ui-monospace, SFMono-Regular, Consolas, monospace",
      size: "10px",
      weight: 500,
      lineHeight: 1.5,
      letterSpacing: "0.04em"
    }
  }
} as const;

export type ThemeTokenName = keyof typeof ThemeTokens.colors;
