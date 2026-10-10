import { createContext, useContext } from 'react';
export type MapCity = 'debrecen' | 'budapest';
export const CityViewContext = createContext<{ city: MapCity; setCity: (city: MapCity) => void }>({ city: 'debrecen', setCity: () => {} });
export const useCityView = () => useContext(CityViewContext);
