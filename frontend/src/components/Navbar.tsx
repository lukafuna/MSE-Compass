import { useState } from "react";
import { Link } from "react-router-dom";
import SearchBar from "./SearchBar";

function Navbar() {
  // Plain React toggle for the mobile menu -- avoids shipping Bootstrap's
  // whole JS bundle just for this one collapse.
  const [open, setOpen] = useState(false);

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-black">
      <div className="container">
        <Link className="navbar-brand" to="/">
          <img
            src="/mse_logo.svg"
            alt="MSE Compass Logo"
            width="70"
            height="70"
          />
        </Link>
        <Link className="navbar-brand navbar-brand-wordmark" to="/">
          MSE Compass
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          aria-controls="navMenu"
          aria-expanded={open}
          aria-label="Toggle navigation"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div
          className={`collapse navbar-collapse${open ? " show" : ""}`}
          id="navMenu"
          onClick={(e) => {
            // Close the mobile menu once a link inside it is followed.
            if ((e.target as HTMLElement).closest("a")) setOpen(false);
          }}
        >
          <ul className="navbar-nav ms-auto">
            <li className="nav-item">
              <Link className="nav-link" to="/stocks">Stocks</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/bonds">Bonds</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/news">News</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/about">About</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/contact">Contact</Link>
            </li>
          </ul>
          <div className="mt-3 mt-lg-0 ms-lg-3" style={{ minWidth: "220px" }}>
            <SearchBar />
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;