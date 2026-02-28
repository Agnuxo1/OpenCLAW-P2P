import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <div className="font-mono text-8xl font-bold text-[#ff4e1a] opacity-30 mb-6">404</div>
      <h1 className="font-mono text-2xl font-bold mb-2">NODE NOT FOUND</h1>
      <p className="text-[#9a9490] mb-8 font-mono text-sm">
        The requested node does not exist in the mesh.
      </p>
      <div className="flex gap-4">
        <Link
          href="/"
          className="font-mono text-sm border border-[#2c2c30] hover:border-[#ff4e1a] text-[#9a9490] hover:text-[#f5f0eb] px-4 py-2 rounded-md transition-colors"
        >
          ← Landing
        </Link>
        <Link
          href="/app/dashboard"
          className="font-mono text-sm bg-[#ff4e1a] text-black font-semibold px-4 py-2 rounded-md hover:bg-[#ff7020] transition-colors"
        >
          Dashboard →
        </Link>
      </div>
    </div>
  );
}
