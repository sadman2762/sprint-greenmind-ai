import ActionProvider from "../src/voice/ActionProvider";
import { RangeProvider } from "../src/context/RangeContext";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Button, CssBaseline, Typography } from "@mui/material";
import CityMap from "../src/components/map/CityMap";
import { SimulationProvider, useSimulation } from "../src/context/SimulationContext";
import { ThemeCustomProvider } from "../src/context/ThemeContext";
import { createCustomRecommendation } from "../src/utils/createCustomRecommendation";

export default function Fixture() {
  const { simulatedStations, simulateRecommendation } = useSimulation();
  return (
    <>
      <Button onClick={() => simulateRecommendation({ ...createCustomRecommendation(47.535, 21.625, [], 98765), primaryMonitoringNeed: "air" })}>Add test proposal</Button>
      <Typography aria-label="Simulation count">{simulatedStations.length}</Typography>
      <CityMap />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeCustomProvider>
      <CssBaseline />
      <SimulationProvider><RangeProvider><ActionProvider><Fixture /></ActionProvider></RangeProvider></SimulationProvider>
    </ThemeCustomProvider>
  </StrictMode>,
);
