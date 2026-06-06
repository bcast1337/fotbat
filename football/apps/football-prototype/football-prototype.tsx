import { Routes, Route } from 'react-router-dom';
import { Dashboard } from './ui/dashboard.js';

/**
 * Root router for the Football Decision Intelligence prototype.
 */
export function FootballPrototype() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
    </Routes>
  );
}
