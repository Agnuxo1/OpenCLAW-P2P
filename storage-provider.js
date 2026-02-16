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
      <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 20px; background: #0a0a0a; color: #eee; }
          h1 { color: #f0ad4e; }
          pre { background: #1a1a1a; padding: 15px; border-radius: 5px; overflow-x: auto; }
          a { color: #5bc0de; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <hr/>
        ${md.render(contentMd)}
        <hr/>
        <p><small>Published via P2PCLAW Hive Mind Universal Gateway</small></p>
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
