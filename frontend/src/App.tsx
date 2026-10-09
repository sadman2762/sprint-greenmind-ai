import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SimulationProvider } from "./context/SimulationContext";
import { ThemeCustomProvider } from "./context/ThemeContext";
import MainLayout from "./layouts/MainLayout";
import Recommendations from "./pages/Recommendations";

export default function App() {
  return <ThemeCustomProvider><SimulationProvider><BrowserRouter><Routes>
    <Route element={<MainLayout />}>
      <Route path="/" element={<Recommendations />} />
      <Route path="/recommendations" element={<Recommendations />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes></BrowserRouter></SimulationProvider></ThemeCustomProvider>;
}
