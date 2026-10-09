import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import BuildCircleRoundedIcon from "@mui/icons-material/BuildCircleRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import { useAppTheme } from "../../context/ThemeContext";

const drawerWidth = 280;

const menu = [
  {
    text: "Dashboard",
    path: "/",
    icon: <DashboardRoundedIcon />,
  },
  {
    text: "Sensor Recommendations",
    path: "/recommendations",
    icon: <InsightsRoundedIcon />,
  },
  {
    text: "Budget Planning",
    path: "/budget-planning",
    icon: <AccountBalanceWalletRoundedIcon />,
  },
  {
    text: "Sensor Health",
    path: "/sensor-health",
    icon: <BuildCircleRoundedIcon />,
  },
  {
    text: "Maintenance Schedule",
    path: "/maintenance-schedule",
    icon: <CalendarMonthRoundedIcon />,
  },
];

export default function Sidebar() {
  const location = useLocation();
  const { tokens, isMidnight } = useAppTheme();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        display: {
          xs: "none",
          md: "block",
        },
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
          top: 76,
          height: "calc(100vh - 76px)",
          borderRight: `1px solid ${tokens.sidebarBorder}`,
          background: tokens.sidebarBg,
          transition: "background 0.3s ease, border-color 0.3s ease",
        },
      }}
    >
      <Box
        sx={{
          px: 2,
          pt: 3,
          pb: 2,
        }}
      >
        <Typography
          variant="overline"
          sx={{
            color: tokens.textMuted,
            fontWeight: 600,
            letterSpacing: "0.12em",
          }}
        >
          Navigation
        </Typography>
      </Box>

      <List
        sx={{
          px: 1.5,
          py: 0,
        }}
      >
        {menu.map((item) => {
          const selected = location.pathname === item.path;

          return (
            <ListItemButton
              key={item.text}
              component={Link}
              to={item.path}
              selected={selected}
              sx={{
                position: "relative",
                minHeight: 46,
                mb: 0.75,
                px: 1.5,
                borderRadius: 2.5,
                color: selected ? tokens.sidebarActiveColor : tokens.sidebarTextColor,
                transition:
                  "background-color 160ms ease, color 160ms ease, transform 160ms ease",
                "&:hover": {
                  backgroundColor: tokens.sidebarHoverBg,
                  color: tokens.primary,
                  transform: "none",
                },
                "&.Mui-selected": {
                  backgroundColor: tokens.sidebarActiveBg,
                  color: selected ? (isMidnight ? "#0b1329" : tokens.sidebarActiveColor) : tokens.sidebarTextColor,
                  fontWeight: 600,
                  "&:hover": {
                    backgroundColor: tokens.sidebarActiveBg,
                  },
                },
                "&.Mui-selected::before": {
                  content: '""',
                  position: "absolute",
                  left: 0,
                  top: 10,
                  bottom: 10,
                  width: 4,
                  borderRadius: "0 6px 6px 0",
                  backgroundColor: tokens.sidebarActiveIndicator,
                  boxShadow: "none",
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 42,
                  color: selected
                    ? tokens.accent
                    : "inherit",
                }}
              >
                {item.icon}
              </ListItemIcon>

              <ListItemText
                primary={item.text}
                slotProps={{
                  primary: {
                    sx: {
                      fontWeight: selected ? 600 : 500,
                      fontSize: "0.875rem",
                    },
                  },
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

    </Drawer>
  );
}