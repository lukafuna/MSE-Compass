import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

function SearchBar() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form className="d-flex" onSubmit={handleSubmit}>
      <input
        type="search"
        className="form-control form-control-sm"
        placeholder="Company or news..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button type="submit" className="btn btn-sm btn-outline-light ms-2">
        Search
      </button>
    </form>
  );
}

export default SearchBar;
