import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import {
  createTheme,
  ThemeProvider as MuiThemeProvider,
} from "@mui/material/styles";
import {
  midnightTheme,
  THEMES,
  type ThemeMode,
  type ThemeTokens,
} from "../theme/themeTokens";

interface ThemeContextType {
  mode: ThemeMode;
  tokens: ThemeTokens;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isMidnight: boolean;
}

const STORAGE_KEY = "greenmind_theme_mode";

const ThemeContext = createContext<ThemeContextType>({
  mode: "midnight",
  tokens: midnightTheme,
  setThemeMode: () => {},
  toggleTheme: () => {},
  isMidnight: true,
});

export function ThemeCustomProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "classic" || saved === "midnight") {
        return saved;
      }
    } catch {
      // fallback
    }
    return "midnight"; // Default to midnight theme requested by user
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, [mode]);

  const tokens = useMemo(() => THEMES[mode] || midnightTheme, [mode]);

  const muiTheme = useMemo(() => {
    const isMid = false; // The planning workspace uses one consistent light palette.

    return createTheme({
      palette: {
        mode: "light", // Keep most parts white as requested!
        primary: {
          main: isMid ? "#0b1329" : "#176650",
          dark: isMid ? "#070c1a" : "#042f2e",
          light: isMid ? "#1e293b" : "#14b8a6",
          contrastText: "#ffffff",
        },
        secondary: {
          main: isMid ? "#82b99b" : "#38785b",
          dark: isMid ? "#6ca788" : "#2d634b",
          light: isMid ? "#b6d8c5" : "#8ebba4",
          contrastText: isMid ? "#0b1329" : "#ffffff",
        },
        background: {
          default: isMid ? "#f6f7f9" : "#f4f6f3",
          paper: "#ffffff",
        },
        text: {
          primary: isMid ? "#0f172a" : "#202b27",
          secondary: isMid ? "#475569" : "#69766f",
        },
        divider: isMid ? "rgba(15, 23, 42, 0.08)" : "rgba(15, 118, 110, 0.12)",
      },
      typography: {
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
        h4: {
          fontSize: "1.8rem",
          fontWeight: 600,
          letterSpacing: "-0.035em",
          lineHeight: 1.3,
        },
        h5: {
          fontSize: "1.25rem",
          fontWeight: 600,
          letterSpacing: "-0.02em",
        },
        h6: {
          fontWeight: 600,
          fontSize: "1.05rem",
        },
        subtitle1: {
          fontWeight: 600,
        },
        body1: {
          fontSize: "0.875rem",
          lineHeight: 1.6,
        },
        body2: {
          fontSize: "0.8125rem",
          lineHeight: 1.6,
        },
        button: {
          textTransform: "none",
          fontWeight: 600,
        },
      },
      shape: {
        borderRadius: 12,
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: { WebkitFontSmoothing: "antialiased" },
            "button, a, input, select, textarea": {
              "&:focus-visible": { outline: "2px solid #568c72", outlineOffset: 3 },
            },
            "@media (prefers-reduced-motion: reduce)": {
              "*, *::before, *::after": {
                animationDuration: "0.01ms !important",
                transitionDuration: "0.01ms !important",
              },
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              borderRadius: 10,
              backgroundImage: "none",
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              borderRadius: 10,
              minHeight: 38,
              transition: "background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
              boxShadow: "none",
              "&:hover": {
                boxShadow: "none",
              },
            },
          },
        },
        MuiChip: {
          styleOverrides: {
            root: {
              borderRadius: 7,
              fontWeight: 500,
            },
          },
        },
        MuiToggleButtonGroup: { styleOverrides: { root: { padding: 3, backgroundColor: "#f0f3ee", borderRadius: 12, gap: 3 }, grouped: { border: "0 !important", borderRadius: "9px !important", textTransform: "none", "&.Mui-selected": { backgroundColor: "#fff", color: "#176650", boxShadow: "0 1px 5px #243c3012" }, "&.Mui-selected:hover": { backgroundColor: "#fff" } } } },
        MuiTableCell: {
          styleOverrides: {
            root: { borderColor: "#e5e9e7" },
            head: { backgroundColor: "#f7f9f8", color: "#526059", fontWeight: 600 },
          },
        },
        MuiDialog: {
          styleOverrides: {
            paper: { boxShadow: "0 16px 48px rgba(15, 23, 42, 0.16)" },
          },
        },
      },
    });
  }, []);

  function toggleTheme() {
    setMode((prev) => (prev === "midnight" ? "classic" : "midnight"));
  }

  return (
    <ThemeContext.Provider
      value={{
        mode,
        tokens,
        setThemeMode: setMode,
        toggleTheme,
        isMidnight: mode === "midnight",
      }}
    >
      <MuiThemeProvider theme={muiTheme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within ThemeCustomProvider");
  }
  return context;
}
