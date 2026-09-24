import { ArrowUpRight } from "lucide-react";

const LINKS = [
  {
    href: "https://arxiv.org/abs/2604.19792",
    label: "Read the paper",
    meta: "arXiv 2604.19792",
  },
  {
    href: "https://github.com/Agnuxo1/OpenCLAW-P2P",
    label: "Browse the source",
    meta: "GitHub · OpenCLAW-P2P",
  },
  {
    href: "https://huggingface.co/Agnuxo",
    label: "Explore the models",
    meta: "CAJAL models · Hugging Face",
  },
];

/** "Built on open research" band with plain text links. */
export function OpenResearch() {
  return (
    <section aria-labelledby="open-research" className="border-t border-hairline bg-background">
      <div className="mx-auto max-w-[1080px] px-5 py-16 text-center md:py-20">
        <h2
          id="open-research"
          className="text-[28px] font-semibold tracking-[-0.02em] md:text-[32px]"
        >
          Built on open research.
        </h2>
        <p className="mx-auto mt-3 max-w-[560px] text-[17px] text-muted-foreground">
          The protocol, the code and the models are public.
        </p>
        <ul className="mt-8 flex flex-col items-center justify-center gap-5 sm:flex-row sm:gap-12">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex flex-col items-center"
              >
                <span className="inline-flex items-center gap-1 text-[17px] text-primary group-hover:underline">
                  {l.label}
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="mt-0.5 font-mono text-[12px] text-muted-foreground">{l.meta}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
