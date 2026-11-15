import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './lib/api';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { useLive } from './lib/useLive';
import Overview from './pages/Overview';
import Rooms from './pages/Rooms';
import RoomDetail from './pages/RoomDetail';
import Alerts from './pages/Alerts';
import Water from './pages/Water';
import Wiring from './pages/Wiring';
import Forecast from './pages/Forecast';
import Savings from './pages/Savings';
import Simulator from './pages/Simulator';
import Settings from './pages/Settings';
import Hvac from './pages/Hvac';
import Camera from './pages/Camera';
import RealBuildings from './pages/RealBuildings';
import RealBuilding from './pages/RealBuilding';
import Models from './pages/Models';
import Plans from './pages/Plans';
import Setup from './pages/Setup';

export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export default function App() {
  const { live, error } = useLive();
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('lang') || 'en'; } catch { return 'en'; }
  });
  // building layout (floors, rooms, tariff) comes from config/campus.json through the API,
  // so a new block is a config change, not a code change
  const [building, setBuilding] = useState(null);
  useEffect(() => { api.building().then(setBuilding).catch(() => {}); }, []);
  const changeLang = (l) => { setLang(l); try { localStorage.setItem('lang', l); } catch { /* private mode */ } };

  return (
    <AppCtx.Provider value={{ live, error, lang, setLang: changeLang, building }}>
      <Layout>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/rooms/:id" element={<RoomDetail />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/camera" element={<Camera />} />
          <Route path="/hvac" element={<Hvac />} />
          <Route path="/water" element={<Water />} />
          <Route path="/wiring" element={<Wiring />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/savings" element={<Savings />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/real" element={<RealBuildings />} />
          <Route path="/real/:id" element={<RealBuilding />} />
          <Route path="/models" element={<Models />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="*" element={<div className="card card-pad">Page not found.</div>} />
        </Routes>
      </Layout>
    </AppCtx.Provider>
  );
}
