import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import HomePage from "./pages/HomePage";

// The homepage is the landing page for most visits, so it stays in the main
// bundle. Every other page is split into its own chunk so the first load
// only downloads what it renders.
const pageImports = {
  screener: () => import("./pages/ScreenerPage"),
  company: () => import("./pages/CompanyPage"),
  bonds: () => import("./pages/BondsPage"),
  news: () => import("./pages/NewsPage"),
  index: () => import("./pages/IndexPage"),
  about: () => import("./pages/AboutPage"),
  contact: () => import("./pages/ContactPage"),
  search: () => import("./pages/SearchResultsPage"),
};

const ScreenerPage = lazy(pageImports.screener);
const CompanyPage = lazy(pageImports.company);
const BondsPage = lazy(pageImports.bonds);
const NewsPage = lazy(pageImports.news);
const IndexPage = lazy(pageImports.index);
const AboutPage = lazy(pageImports.about);
const ContactPage = lazy(pageImports.contact);
const SearchResultsPage = lazy(pageImports.search);

/** Once the current page has loaded, fetch the other page chunks in the
 *  background so later navigation doesn't wait on the network. */
function usePrefetchPages() {
  useEffect(() => {
    const prefetch = () => Object.values(pageImports).forEach((load) => load().catch(() => {}));
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(prefetch, 2000);
    return () => clearTimeout(id);
  }, []);
}

function App() {
  usePrefetchPages();

  return (
    <BrowserRouter>
      <div className="d-flex flex-column min-vh-100 w-100">
        <Navbar />
        <main className="flex-grow-1 w-100 d-flex flex-column">
          <Suspense fallback={<div className="flex-grow-1 bg-body-secondary" />}>
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
          </Suspense>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
