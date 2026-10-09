import {
  AppBar,
  Avatar,
  Box,
  CssBaseline,
  IconButton,
  Toolbar,
  Tooltip,
} from "@mui/material";
import ParkIcon from "@mui/icons-material/Park";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import { Outlet } from "react-router-dom";

import Sidebar from "../components/layout/Sidebar";
import GreenMindCopilot from "../components/copilot/GreenMindCopilot";
import BrandLogo from "../components/common/BrandLogo";
import { useAppTheme } from "../context/ThemeContext";

const DRAWER_WIDTH = 280;

export default function MainLayout() {
  const { tokens, toggleTheme, isMidnight } = useAppTheme();

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        background: tokens.appBg,
        transition: "background 0.3s ease",
      }}
    >
      <CssBaseline />

      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          height: 76,
          justifyContent: "center",
          backgroundColor: tokens.headerBg,
          color: tokens.headerText,
          borderBottom: `1px solid ${tokens.headerBorder}`,
          backdropFilter: tokens.headerBackdropBlur,
          WebkitBackdropFilter: tokens.headerBackdropBlur,
          transition: "background-color 0.3s ease, border-color 0.3s ease",
        }}
      >
        <Toolbar
          sx={{
            minHeight: "76px !important",
            px: {
              xs: 2,
              sm: 3,
            },
          }}
        >
          <Box
            sx={{
              width: {
                xs: "auto",
                md: DRAWER_WIDTH - 24,
              },
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              flexShrink: 0,
            }}
          >
            <Avatar
              sx={{
                width: 44,
                height: 44,
                background: tokens.brandAvatarBg,
                boxShadow: "none",
                border: isMidnight
                  ? "1px solid rgba(0, 220, 130, 0.3)"
                  : "none",
              }}
            >
              <ParkIcon sx={{ color: isMidnight ? "#79b998" : "#ffffff" }} />
            </Avatar>

            <BrandLogo variant="header" showTagline={true} />
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            {/* Quick 1-Click Theme Switcher for Instant Reversion */}
            <Tooltip
              title={
                isMidnight
                  ? "Switch to Classic Teal Theme"
                  : "Switch to Midnight Emerald Theme"
              }
            >
              <IconButton
                onClick={toggleTheme}
                size="small"
                sx={{
                  color: isMidnight ? "#94a3b8" : "#0f766e",
                  backgroundColor: isMidnight
                    ? "rgba(255, 255, 255, 0.06)"
                    : "rgba(15, 118, 110, 0.08)",
                  border: isMidnight
                    ? "1px solid rgba(255, 255, 255, 0.12)"
                    : "1px solid rgba(15, 118, 110, 0.16)",
                  p: 0.9,
                  "&:hover": {
                    backgroundColor: isMidnight
                      ? "rgba(255, 255, 255, 0.12)"
                      : "rgba(15, 118, 110, 0.14)",
                    color: isMidnight ? "#79b998" : "#0f766e",
                  },
                }}
              >
                <PaletteRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>

          </Box>
        </Toolbar>
      </AppBar>

      <Sidebar />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          minHeight: "100vh",
          pt: "76px",
          ml: {
            xs: 0,
            md: 0,
          },
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 1600,
            mx: "auto",
            px: {
              xs: 2,
              sm: 3,
              lg: 4,
            },
            py: {
              xs: 3,
              sm: 4,
            },
          }}
        >
          <Outlet />
        </Box>
      </Box>

      {/* Persistent AI Decision-Support Copilot */}
      <GreenMindCopilot />
    </Box>
  );
}