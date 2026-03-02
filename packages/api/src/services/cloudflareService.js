import fetch from "node-fetch";

/**
 * CloudflareService
 * Manages Web3 decentralized routing by updating IPFS DNSLink TXT records.
 * Requires CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN in .env
 */
class CloudflareService {
    get zoneId() { return process.env.CLOUDFLARE_ZONE_ID?.trim(); }
    get apiToken() { return process.env.CLOUDFLARE_API_TOKEN?.trim(); }
    get baseUrl() { return `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/dns_records`; }

    get headers() {
        return {
            "Authorization": `Bearer ${this.apiToken}`,
            "Content-Type": "application/json"
        };
    }

    /**
     * Updates the _dnslink TXT record for a given subdomain to point to a new IPFS CID.
     * @param {string} subdomain e.g., 'app.p2pclaw.com'
     * @param {string} cid e.g., 'QmHash...'
     * @returns {Promise<boolean>} success
     */
    async updateDnsLink(subdomain, cid) {
        if (!this.zoneId || !this.apiToken) {
            console.warn(`[CLOUDFLARE] Missing credentials. Cannot update DNSLink for ${subdomain}`);
            return false;
        }

        const recordName = `_dnslink.${subdomain}`;
        const newContent = `dnslink=/ipfs/${cid}`;

        try {
            // 1. Find existing record ID
            const searchRes = await fetch(`${this.baseUrl}?type=TXT&name=${recordName}`, { headers: this.headers });
            const searchData = await searchRes.json();

            if (!searchData.success) {
                console.error(`[CLOUDFLARE] Failed to fetch DNS records:`, searchData.errors);
                return false;
            }

            const record = searchData.result[0];

            if (record) {
                // 2a. Update existing record
                const updateRes = await fetch(`${this.baseUrl}/${record.id}`, {
                    method: 'PUT',
                    headers: this.headers,
                    body: JSON.stringify({
                        type: 'TXT',
                        name: recordName,
                        content: newContent,
                        ttl: 1 // Automatic TTL
                    })
                });
                const updateData = await updateRes.json();
                if (updateData.success) {
                    console.log(`[CLOUDFLARE] Successfully updated ${recordName} -> ${newContent}`);
                    return true;
                } else {
                    console.error(`[CLOUDFLARE] Update failed:`, updateData.errors);
                    return false;
                }
            } else {
                // 2b. Create new record if it doesn't exist
                const createRes = await fetch(this.baseUrl, {
                    method: 'POST',
                    headers: this.headers,
                    body: JSON.stringify({
                        type: 'TXT',
                        name: recordName,
                        content: newContent,
                        ttl: 1
                    })
                });
                const createData = await createRes.json();
                if (createData.success) {
                    console.log(`[CLOUDFLARE] Successfully created ${recordName} -> ${newContent}`);
                    return true;
                } else {
                    console.error(`[CLOUDFLARE] Creation failed:`, createData.errors);
                    return false;
                }
            }

        } catch (error) {
            console.error(`[CLOUDFLARE] Network error updating DNSLink for ${subdomain}:`, error.message);
            return false;
        }
    }

    /**
     * Ensures the CNAME record pointing to the IPFS gateway exists for the Web3 gateway.
     * WARNING: With Cloudflare's new Web3 Gateway system (which prevents Error 1014/1000), 
     * the user MUST configure the Domain from the Cloudflare Web3 Dashboard. 
     * If we forcefully write a CNAME to ipfs.cloudflare.com, it will trigger Error 1014 (Cross-User Banned).
     * Therefore, this function is now a NO-OP. We only manage the _dnslink TXT record via updateDnsLink.
     */
    async ensureCname(subdomain) {
        console.log(`[CLOUDFLARE] SKIPPING CNAME override for ${subdomain} to prevent Error 1014/1000. Assuming Cloudflare Web3 Dashboard configuration is intact.`);
        return true;
    }
}

export const cloudflareService = new CloudflareService();
