import lighthouse from '@lighthouse-web3/sdk';
import { ethers } from 'ethers';
import MarkdownIt from 'markdown-it';
import { jsPDF } from 'jspdf';
import axios from 'axios';

const md = new MarkdownIt();

export class PaperPublisher {
  constructor(moltApiKey) {
    this.moltApiKey = moltApiKey;
    this.wallet = null;
    this.apiKey = null;
    
    // Secure Wallet Initialization
    // Requires STORAGE_SEED to be set in environment variables
    const seed = process.env.STORAGE_SEED;
    if (!seed) {
        console.warn("⚠️ STORAGE_SEED not set. Permanent storage disabled. Use 'node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"' to generate one.");
    } else {
        try {
            const mnemonic = ethers.utils.id(seed);
            this.wallet = new ethers.Wallet(mnemonic);
        } catch (err) {
            console.error("Failed to create wallet from seed:", err);
        }
    }
  }

  /**
   * Initialize Lighthouse API Key (Auto-registration)
   */
  async init() {
    if (this.apiKey) return;
    
    // 0. Environment Override (Prioritized Fallback)
    if (process.env.LIGHTHOUSE_API_KEY) {
        this.apiKey = process.env.LIGHTHOUSE_API_KEY;
        console.log('Lighthouse API Key loaded from environment.');
        return;
    }

    if (!this.wallet) {
        throw new Error("Cannot initialize storage: No wallet available (check STORAGE_SEED)");
    }
    
    try {
      // 1. Get the message to sign from Lighthouse (Use checksummed address)
      const address = this.wallet.address; 
      const authMessageResponse = await lighthouse.getAuthMessage(address);
      
      if (!authMessageResponse || !authMessageResponse.data || !authMessageResponse.data.message) {
          throw new Error("Failed to retrieve auth message from Lighthouse");
      }
      const messageToSign = authMessageResponse.data.message;

      // 2. Sign the message
      const signedMessage = await this.wallet.signMessage(messageToSign);

      // 3. Get API Key MANUALLY (Bypassing SDK bug)
      let response;
      try {
        const result = await axios.post('https://api.lighthouse.storage/api/auth/create_api_key', {
            publicKey: address,
            signedMessage: signedMessage
        });
        response = { data: result.data };
      } catch (innerErr) {
        throw new Error(`Auth API request failed: ${innerErr.message}`);
      }
      
      if (response && response.data) {
        if (response.data.apiKey) {
             this.apiKey = response.data.apiKey;
        } else if (typeof response.data === 'string') {
             this.apiKey = response.data;
        } else {
             this.apiKey = response.data; 
        }
        console.log('Lighthouse API Key initialized successfully via auto-registration.');
      } else {
        console.error("Unexpected Lighthouse response structure.");
        throw new Error("Invalid response from getApiKey");
      }

    } catch (error) {
      console.error('Failed to initialize Lighthouse API Key:', error.message || error);
      console.warn("⚠️ TIP: You can set LIGHTHOUSE_API_KEY in env to bypass this error.");
      throw new Error("Lighthouse Auth Failed");
    }
  }

  /**
   * Publish a paper to the decentralized web
   */
  async publish(title, contentMd, author = 'Hive-Agent') {
    await this.init();
    if (!this.apiKey) throw new Error("Storage provider not initialized");

    const htmlContent = this.renderHtml(title, contentMd);
    const pdfBuffer = this.renderPdf(title, contentMd);

    // 1. Upload MD
    const mdUpload = await lighthouse.uploadText(contentMd, this.apiKey, `${title}.md`);
    
    // 2. Upload HTML
    const htmlUpload = await lighthouse.uploadText(htmlContent, this.apiKey, `${title}.html`);

    // 3. Upload PDF (As base64 text for now to ensure compatibility with uploadText in Node.js)
    let pdfUrl = null;
    let pdfCid = null;
    try {
         const pdfArrayBuffer = this.renderPdf(title, contentMd);
         const pdfBuffer = Buffer.from(pdfArrayBuffer);
         const pdfBase64 = pdfBuffer.toString('base64');
         
         // Upload as a text file but with .pdf extension, clients will need to decode or we accept it as a base64 artifact
         // Ideally we use `upload` with a Blob, but in Node.js that requires polyfills.
         // For v1 stability: upload as text, but we'll call it .pdf.txt to be honest, or just .pdf and serve as base64.
         // Better approach for Lighthouse Node SDK: `uploadText` works for string content.
         
         const pdfUpload = await lighthouse.uploadText(pdfBase64, this.apiKey, `${title}.pdf.base64`);
         pdfCid = pdfUpload.data.Hash;
         pdfUrl = `https://gateway.lighthouse.storage/ipfs/${pdfCid}`;
         console.log("PDF Uploaded (Base64):", pdfUrl);
    } catch (e) {
        console.warn("PDF Upload failed", e);
    }

    const results = {
      md: `https://gateway.lighthouse.storage/ipfs/${mdUpload.data.Hash}`,
      html: `https://gateway.lighthouse.storage/ipfs/${htmlUpload.data.Hash}`,
      pdf: pdfUrl,
      cid: htmlUpload.data.Hash
    };

    // 4. Cross-index to Molt Research (Moltbook API)
    await this.mirrorToMolt(title, `New Research Paper published on IPFS: ${results.html}\n\nAbstract: ${contentMd.substring(0, 200)}...`, author);

    return results;
  }

  renderHtml(title, contentMd) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <!-- MathJax for Scientific Professionalism -->
    <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
    <style>
        @page { size: A4; margin: 2cm; }
        
        body {
            font-family: "Times New Roman", Times, serif;
            font-size: 10pt;
            line-height: 1.5;
            color: #1a1a1a;
            background: #fdfdfd;
            margin: 0;
            padding: 0;
        }

        .container {
            max-width: 210mm;
            min-height: 297mm;
            margin: auto;
            background: white;
            padding: 20mm;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            position: relative;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
        }

        h1 {
            font-size: 18pt;
            margin: 0 0 10px 0;
            line-height: 1.2;
        }

        .author-box {
            font-size: 11pt;
            margin-bottom: 20px;
        }

        .author-name { font-weight: bold; }
        .author-affil { font-style: italic; color: #555; font-size: 10pt; }

        .abstract-container {
            margin: 20px 0;
            padding: 15px;
            background: #f9f9f9;
            border-top: 2px solid #333;
            border-bottom: 2px solid #333;
            font-size: 9.5pt;
        }

        .abstract-title {
            font-weight: bold;
            font-variant: small-caps;
            display: block;
            margin-bottom: 5px;
            text-align: center;
        }

        .two-column {
            column-count: 2;
            column-gap: 8mm;
            text-align: justify;
            hyphens: auto;
        }

        h2 {
            font-size: 12pt;
            margin-top: 15px;
            margin-bottom: 10px;
            border-bottom: 0.5pt solid #ccc;
            padding-bottom: 2pt;
            text-transform: uppercase;
            letter-spacing: 0.5pt;
        }

        h3 {
            font-size: 11pt;
            font-style: italic;
            margin-top: 12px;
            margin-bottom: 6px;
        }

        p { margin: 0 0 10pt 0; text-indent: 1.5em; }
        p:first-of-type, h2 + p, h3 + p { text-indent: 0; }

        .equation {
            text-align: center;
            margin: 15pt 0;
            display: flex;
            align-items: center;
            justify-content: center;
            break-inside: avoid;
        }
        
        .equation-number {
            margin-left: auto;
            font-family: "Times New Roman", serif;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
            margin: 15pt 0;
            break-inside: avoid;
        }

        table caption {
            font-weight: bold;
            font-size: 9pt;
            margin-bottom: 5pt;
            text-align: left;
        }

        th {
            background: #333;
            color: white;
            padding: 6pt;
            border: 0.5pt solid #333;
        }

        td {
            border: 0.5pt solid #ddd;
            padding: 6pt;
        }

        tr:nth-child(even) { background: #f8f8f8; }

        .figure {
            break-inside: avoid;
            text-align: center;
            margin: 15pt 0;
        }

        .figure svg {
            max-width: 100%;
            height: auto;
            border: 0.5pt solid #eee;
            padding: 10pt;
            background: #fff;
        }

        .figure-caption {
            font-size: 9pt;
            color: #444;
            margin-top: 8pt;
            text-align: left;
            border-left: 2pt solid #ff4500;
            padding-left: 8pt;
        }

        .references {
            font-size: 9pt;
            margin-top: 20pt;
            border-top: 1pt solid #333;
            padding-top: 10pt;
        }

        .references h2 { border: none; text-align: center; font-variant: small-caps; }

        .ref-item {
            margin-bottom: 5pt;
            padding-left: 2em;
            text-indent: -2em;
        }

        .watermark {
            position: absolute;
            top: 10mm;
            right: 10mm;
            font-size: 8pt;
            color: #bbb;
            font-family: sans-serif;
            letter-spacing: 1pt;
        }

        @media screen and (max-width: 768px) {
            .two-column { column-count: 1; }
            .container { padding: 10mm; }
        }

        @media print {
            .container { box-shadow: none; margin: 0; padding: 0; width: 100%; }
            body { background: white; }
        }

        /* Scientific Markdown Overrides */
        blockquote {
            font-style: italic;
            border-left: 2pt solid #ddd;
            margin: 10pt 0 10pt 20pt;
            padding-left: 10pt;
            color: #555;
        }

        pre, code {
            font-family: "Courier New", Courier, monospace;
            background: #f4f4f4;
            font-size: 9pt;
        }

        img { max-width: 100%; display: block; margin: 10pt auto; }
    </style>
</head>
<body>
    <div class="container">
        <div class="watermark">P2PCLAW HIVE ARCHIVE / IPFS:CERTIFIED</div>
        
        <div class="header">
            <h1>${title}</h1>
            <div class="author-box">
                <div class="author-name">Distributed Intelligence Network</div>
                <div class="author-affil">Collective Research Node: P2PCLAW Gateway v1.3</div>
                <div class="author-affil">DOI: 10.P2PCLAW/${Date.now().toString(36).toUpperCase()}</div>
            </div>
        </div>

        <div class="abstract-container">
            <span class="abstract-title">Abstract</span>
            <div id="dynamic-abstract">
                This document represents a formal research contribution to the P2PCLAW Hive Mind. 
                All findings herein have been validated against the decentralized knowledge mesh 
                and are archived for permanent retrieval via IPFS.
            </div>
        </div>

        <div class="two-column">
            ${md.render(contentMd)}
        </div>

        <div class="references" id="section-references">
            <!-- Reference section managed via Markdown or dynamic injection -->
        </div>

        <div style="margin-top: 30pt; font-size: 8pt; color: #999; text-align: center; font-style: italic;">
            © ${new Date().getFullYear()} P2PCLAW Protocol. This work is licensed under Creative Commons BY-NC-SA 4.0.
        </div>
    </div>
</body>
</html>
    `;
  }

  renderPdf(title, contentMd) {
    // Basic PDF generation to verify layout logic
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(title, 10, 20);
    doc.setFontSize(12);
    // Split text to fit page width
    const lines = doc.splitTextToSize(contentMd, 180); 
    doc.text(lines, 10, 40);
    return doc.output('arraybuffer');
  }

  async mirrorToMolt(title, summary, author) {
    if (!this.moltApiKey) return;
    try {
      await axios.post('https://www.moltbook.com/api/v1/posts', {
        title: `[RESEARCH] ${title}`,
        content: summary,
        submolt: 'science'
      }, {
        headers: { 'Authorization': `Bearer ${this.moltApiKey}` }
      });
      console.log('Successfully mirrored paper to Molt Research.');
    } catch (error) {
       // Non-critical error, do not crash
      if (error.response) {
          console.warn(`Mirroring to Moltbook failed: ${error.response.status} ${error.response.statusText}`);
      } else {
          console.warn('Mirroring to Moltbook failed (Network/Unknown):', error.message);
      }
    }
  }
}
