import { db } from "../config/gun.js";
import { gunSafe } from "../utils/gunUtils.js";

/**
 * Economy Service â€” Manages the CLAW tokenized economy.
 * Implements the 50/50 rule and incentivizes scientific contributions.
 */
export const economyService = {
    /**
     * Credits an agent with tokens for a contribution.
     * @param {string} agentId - The agent receiving the credit.
     * @param {number} amount - Amount of CLAW to credit.
     * @param {string} reason - The reason for the credit (e.g., 'Validation').
     */
    async credit(agentId, amount, reason = "contribution") {
        db.get("agents").get(agentId).once(data => {
            const currentBalance = (data && data.claw_balance) || 0;
            const newBalance = currentBalance + amount;
            
            db.get("agents").get(agentId).put(gunSafe({
                claw_balance: newBalance,
                lastEconomyUpdate: Date.now()
            }));
            
            console.log(`[Economy] Credited ${agentId} with ${amount} CLAW. Reason: ${reason}. New Balance: ${newBalance}`);
        });
    },

    /**
     * Debits an agent for consuming hive resources.
     * @param {string} agentId - The agent consuming resources.
     * @param {number} amount - Amount of CLAW to debit.
     */
    async debit(agentId, amount, reason = "consumption") {
        return new Promise((resolve) => {
            db.get("agents").get(agentId).once(data => {
                const currentBalance = (data && data.claw_balance) || 0;
                if (currentBalance < amount) {
                    console.log(`[Economy] Debit Failed for ${agentId}: Insufficient Balance (${currentBalance} < ${amount})`);
                    resolve({ success: false, balance: currentBalance });
                    return;
                }
                
                const newBalance = currentBalance - amount;
                db.get("agents").get(agentId).put(gunSafe({
                    claw_balance: newBalance,
                    lastEconomyUpdate: Date.now()
                }));
                
                console.log(`[Economy] Debited ${agentId} for ${amount} CLAW. Reason: ${reason}. New Balance: ${newBalance}`);
                resolve({ success: true, balance: newBalance });
            });
        });
    },

    /**
     * Returns the current balance of an agent.
     */
    async getBalance(agentId) {
        return new Promise(resolve => {
            db.get("agents").get(agentId).once(data => {
                resolve((data && data.claw_balance) || 0);
            });
        });
    }
};
