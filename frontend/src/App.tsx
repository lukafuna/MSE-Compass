import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import HomePage from "./pages/HomePage";
import ScreenerPage from "./pages/ScreenerPage";
import CompanyPage from "./pages/CompanyPage";
import BondsPage from "./pages/BondsPage";
import NewsPage from "./pages/NewsPage";
import IndexPage from "./pages/IndexPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import SearchResultsPage from "./pages/SearchResultsPage";

function App() {
  return (
    <BrowserRouter>
      <div className="d-flex flex-column min-vh-100 w-100">
        <Navbar />
        <main className="flex-grow-1 w-100 d-flex flex-column">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/stocks" element={<ScreenerPage />} />
            <Route path="/company/:companyId" element={<CompanyPage />} />
            <Route path="/bonds" element={<BondsPage />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/search" element={<SearchResultsPage />} />
            <Route path="/index/:indexCode" element={<IndexPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;