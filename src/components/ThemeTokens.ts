export const ThemeTokens = {
  direction: "rtl",
  colors: {
    canvas: "#070B12",
    surface: "#101923",
    surfaceRaised: "#152231",
    surfaceElevated: "#1b2c3d",
    line: "#263545",
    lineStrong: "#34495c",
    text: "#F1F5F9",
    textMuted: "#94A3B8",
    textDim: "#64748B",
    cyan: "#00D9FF",
    cyanStrong: "#00B8D9",
    amber: "#FFB547",
    green: "#22C55E",
    warning: "#F59E0B",
    red: "#EF4444"
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
    fontFamily: "var(--font-primary)",
    technicalFamily: "var(--font-primary)",
    primary: "var(--font-primary)",
    technical: "var(--font-primary)",
    brand: {
      family: "var(--font-primary)",
      weight: 700,
      letterSpacing: "0.01em"
    },
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
    title: {
      size: "16px",
      weight: 600,
      lineHeight: 1.6
    },
    display: {
      size: "30px",
      weight: 700,
      lineHeight: 1.35
    },
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    },
    mono: {
      family: "var(--font-primary)",
      size: "10px",
      weight: 500,
      lineHeight: 1.5,
      letterSpacing: "0.04em"
    }
  },
  surfaces: {
    canvas: "#070B12",
    base: "#101923",
    elevated: "#152231",
    inset: "#0B121B",
    interactive: "#1B2C3D"
  },
  status: {
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
    info: "#00D9FF",
    neutral: "#64748B"
  },
  shadows: {
    panel: "0 8px 24px rgba(0, 0, 0, 0.18)",
    elevated: "0 16px 40px rgba(0, 0, 0, 0.28)",
    focus: "0 0 0 3px rgba(0, 217, 255, 0.18)"
  }
} as const;

export type ThemeTokenName = keyof typeof ThemeTokens.colors;
