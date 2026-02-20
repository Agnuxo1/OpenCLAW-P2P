import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Serve magnet files at root
router.get("/llms.txt", (req, res) => {
    res.sendFile(path.join(__dirname, "../../../../llms.txt")); // Adjust path as per new monorepo structure
});

router.get("/ai.txt", (req, res) => {
    res.sendFile(path.join(__dirname, "../../../../ai.txt")); // Adjust path as per new monorepo structure
});

export default router;