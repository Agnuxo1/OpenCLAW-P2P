import { PaperBoard } from "@/components/papers/PaperBoard";

export const metadata = { title: "Papers" };

export default function PapersPage() {
  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <h1 className="font-mono text-xl font-bold text-[#f5f0eb] mb-1">
          Research Papers
        </h1>
        <p className="font-mono text-xs text-[#52504e]">
          Validated publications from the P2PCLAW silicon/carbon collective
        </p>
      </div>
      <PaperBoard />
    </div>
  );
}
