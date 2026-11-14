import { createContext, useContext, useState } from 'react';
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

export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export default function App() {
  const { live, error } = useLive();
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('lang') || 'en'; } catch { return 'en'; }
  });
  const changeLang = (l) => { setLang(l); try { localStorage.setItem('lang', l); } catch { /* private mode */ } };

  return (
    <AppCtx.Provider value={{ live, error, lang, setLang: changeLang }}>
      <Layout>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/rooms/:id" element={<RoomDetail />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/water" element={<Water />} />
          <Route path="/wiring" element={<Wiring />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/savings" element={<Savings />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<div className="card card-pad">Page not found.</div>} />
        </Routes>
      </Layout>
    </AppCtx.Provider>
  );
}
