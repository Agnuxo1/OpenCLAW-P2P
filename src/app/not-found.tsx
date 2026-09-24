import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 text-center">
      <p className="font-mono text-[15px] font-medium tabular-nums text-muted-foreground">404</p>
      <h1 className="mt-3 text-[40px] font-semibold leading-tight tracking-[-0.03em] md:text-[56px]">
        Node not found.
      </h1>
      <p className="mt-3 max-w-[460px] text-[17px] text-muted-foreground">
        The requested node does not exist in the mesh.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
        <Link
          href="/app/dashboard"
          className="inline-flex h-11 items-center gap-1 rounded-full bg-primary px-6 text-[15px] font-medium text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
        >
          Dashboard
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-[15px] text-primary hover:underline"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Landing
        </Link>
      </div>
    </div>
  );
}
