import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="page-loading">
      <h1>Page not found</h1>
      <p>This page or record is unavailable.</p>
      <Link className="button button-primary" href="/">
        Back to dashboard
      </Link>
    </main>
  );
}
