export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-card">
      <div className="container py-6 text-center text-sm text-muted-foreground">
        © {year} AB Nutribev Corp. All rights reserved.
      </div>
    </footer>
  );
}
