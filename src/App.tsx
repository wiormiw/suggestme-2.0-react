import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import LoginPage from "@/pages/login";
import FoodFeed from "@/pages/food-feed";
import ProtectedRoute from "@/components/protected-route"; // Import the guard

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" />
      
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<FoodFeed />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}