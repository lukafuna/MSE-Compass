import { Link } from "react-router-dom";

function Footer() {
  return (
    <footer className="bg-black text-light pt-5 pb-4">
      <div className="container">
        <div className="row">
          <div className="col-md-4 mb-4 mb-md-0">
            <h5 className="mb-3">MSE Compass</h5>
            <p className="text-light small">
              Tracking prices, technical indicators, and news across the
              Macedonian Stock Exchange and global markets.
            </p>
          </div>

          <div className="col-6 col-md-2 mb-4 mb-md-0">
            <h6 className="text-uppercase small text-light mb-3">Markets</h6>
            <ul className="list-unstyled">
              <li className="mb-2"><Link className="footer-link" to="/">Home</Link></li>
              <li className="mb-2"><Link className="footer-link" to="/stocks">Stocks</Link></li>
              <li className="mb-2"><Link className="footer-link" to="/bonds">Bonds</Link></li>
            </ul>
          </div>

          <div className="col-6 col-md-2 mb-4 mb-md-0">
            <h6 className="text-uppercase small text-light mb-3">Resources</h6>
            <ul className="list-unstyled">
              <li className="mb-2"><Link className="footer-link" to="/news">News</Link></li>
              <li className="mb-2">
                <a
                  className="footer-link"
                  href="https://www.mse.mk"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  MSE Official Site
                </a>
              </li>
            </ul>
          </div>

          <div className="col-6 col-md-2 mb-4 mb-md-0">
            <h6 className="text-uppercase small text-light mb-3">Contact</h6>
            <ul className="list-unstyled">
              <li className="mb-2">
                <a className="footer-link" href="mailto:compassmse@gmail.com">compassmse@gmail.com</a>
              </li>
              <li className="mb-2">
                <a className="footer-link" href="tel:+38921234567">+389 2 123 4567</a>
              </li>
            </ul>
          </div>

          <div className="col-6 col-md-2">
            <h6 className="text-uppercase small text-light mb-3">Legal</h6>
            <p className="text-light small">
              Data shown is for informational purposes only, not investment advice.
            </p>
            <p className="text-light small mb-0">
              &copy; {new Date().getFullYear()} MSE Compass
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;