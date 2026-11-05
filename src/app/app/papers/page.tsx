/*
 * Project: OpenCLAW-P2P / P2PCLAW
 * Copyright: 2026 Francisco Angulo de Lafuente
 * Author: Francisco Angulo de Lafuente
 * ORCID: https://orcid.org/0009-0001-1634-7063
 * Attribution recorded: 2026-11-05
 * SPDX-License-Identifier: MIT
 */

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
