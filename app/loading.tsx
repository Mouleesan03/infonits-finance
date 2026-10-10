export default function Loading() {
  return (
    <main className="workspace-loader" role="status">
      <div className="workspace-loader-mark">
        <img src="/infonits-logo.png" alt="" width={136} height={34} />
        <span><i /><i /><i /></span>
      </div>
      <strong>Opening Infonits Finance</strong>
      <p>Preparing your workspace…</p>
      <div className="workspace-loader-line"><i /></div>
    </main>
  );
}
