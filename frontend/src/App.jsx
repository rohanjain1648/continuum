import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import Studio from "./pages/Studio.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/studio" element={<Studio />} />
    </Routes>
  );
}
