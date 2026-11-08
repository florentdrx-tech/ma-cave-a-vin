import { NavLink, Route, Routes, Link, useLocation } from 'react-router-dom';
import { ThermoProvider } from './thermoContext';
import Home from './pages/Home';
import Wines from './pages/Wines';
import WineForm from './pages/WineForm';
import WineDetail from './pages/WineDetail';
import Racks from './pages/Racks';
import Journal from './pages/Journal';
import Temperature from './pages/Temperature';
import Settings from './pages/Settings';

const NAV = [
  { to: '/', label: 'Accueil', icon: '🏠' },
  { to: '/vins', label: 'Vins', icon: '🍷' },
  { to: '/casiers', label: 'Casiers', icon: '🗄️' },
  { to: '/journal', label: 'Journal', icon: '📝' },
  { to: '/temperature', label: 'Temp.', icon: '🌡️' },
];

export default function App() {
  const { pathname } = useLocation();
  const showFab = !pathname.startsWith('/vin/') && pathname !== '/reglages';
  return (
    <ThermoProvider>
      <header className="topbar">
        <Link to="/" className="brand">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={28} height={28} />
          Ma Cave
        </Link>
        <Link to="/reglages" className="icon-btn" aria-label="Réglages et sauvegarde">⚙️</Link>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/vins" element={<Wines />} />
          <Route path="/vin/nouveau" element={<WineForm />} />
          <Route path="/vin/:id" element={<WineDetail />} />
          <Route path="/vin/:id/modifier" element={<WineForm />} />
          <Route path="/casiers" element={<Racks />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/temperature" element={<Temperature />} />
          <Route path="/reglages" element={<Settings />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      {showFab && (
        <Link to="/vin/nouveau" className="fab" aria-label="Ajouter un vin">＋</Link>
      )}
      <nav className="tabbar">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className="tab">
            <span aria-hidden>{n.icon}</span>
            <small>{n.label}</small>
          </NavLink>
        ))}
      </nav>
    </ThermoProvider>
  );
}
