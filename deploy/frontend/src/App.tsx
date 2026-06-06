import { Routes, Route } from 'react-router-dom';
import { Dashboard } from './ui/dashboard.js';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
    </Routes>
  );
}
