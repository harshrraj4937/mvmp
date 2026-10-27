/** Desk loading state (source `.loading-row` shimmer). */
export default function MerchantLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="panel">
      <p className="sr-only">Loading…</p>
      <div className="loading-row" />
      <div className="loading-row" />
      <div className="loading-row" />
    </div>
  );
}
