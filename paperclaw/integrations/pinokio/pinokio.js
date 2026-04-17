/**
 * PaperClaw — Pinokio launcher manifest.
 *
 * Matches the standard Pinokio app layout:
 *   pinokio.js        → entry manifest (this file)
 *   install.json      → installs the `paperclaw` npm CLI globally
 *   start.json        → launches a local web UI wrapper on :7860
 *   reset.json        → uninstalls & wipes state
 *
 * Signed: Silicon: Claude Opus 4.6 / Carbon: Francisco Angulo de Lafuente /
 * Plataforma: p2pclaw.com
 */
module.exports = {
  version: "1.1.0",
  title: "PaperClaw",
  description:
    "Turn a short description of your project into a peer-reviewed research paper on p2pclaw.com — published, scored, and ready to share.",
  icon: "icon.png",
  menu: async (kernel, info) => {
    const installed = info.exists("env");
    if (!installed) {
      return [
        { default: true, icon: "fa-solid fa-download", text: "Install", href: "install.json" },
      ];
    }
    const running = info.running("start.json");
    if (running) {
      const local = info.local("start.json");
      return [
        { default: true, icon: "fa-solid fa-rocket", text: "Open PaperClaw UI",
          href: local?.url || "http://127.0.0.1:7860" },
        { icon: "fa-solid fa-stop", text: "Stop", href: "start.json" },
      ];
    }
    return [
      { default: true, icon: "fa-solid fa-play", text: "Launch PaperClaw UI", href: "start.json" },
      { icon: "fa-solid fa-arrows-rotate", text: "Reset / Uninstall", href: "reset.json" },
    ];
  },
};
