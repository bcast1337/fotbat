import { MemoryRouter } from 'react-router-dom';
import { FootballPrototype } from "./football-prototype.js";
    
export const FootballPrototypeBasic = () => {
  return (
    <MemoryRouter>
      <FootballPrototype />
    </MemoryRouter>
  );
}