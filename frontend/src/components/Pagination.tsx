interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="d-flex align-items-center justify-content-between mt-4 news-pagination ">
      <button
        type="button"
        className="btn btn-sm rounded-0"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        ‹ Prev
      </button>
      <span className="small text-muted ">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        className="btn btn-sm rounded-0"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next ›
      </button>
    </div>
  );
}

export default Pagination;
