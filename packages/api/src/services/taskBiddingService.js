import { db } from "../config/gun.js";
import { gunSafe } from "../utils/gunUtils.js";
import { broadcastHiveEvent } from "./hiveService.js";

/**
 * Task Bidding Service â€” Implements an auction-based task allocation system.
 */
export const taskBiddingService = {
    /**
     * Publishes a new task to the network.
     */
    async publishTask(data) {
        const taskId = `task-${Date.now()}`;
        const taskData = gunSafe({
            id: taskId,
            creator: data.agentId,
            description: data.description,
            reward: data.reward || 0,
            requirements: data.requirements || [],
            status: "OPEN",
            timestamp: Date.now()
        });

        db.get("tasks").get(taskId).put(taskData);
        broadcastHiveEvent('task_published', { id: taskId, reward: data.reward });
        return taskId;
    },

    /**
     * Submits a bid for a specific task.
     */
    async submitBid(taskId, agentId, data) {
        const bidId = `bid-${Date.now()}-${agentId}`;
        const bidData = gunSafe({
            agentId,
            offer: data.offer || 0,
            specialty: data.specialty || "General",
            status: "PENDING",
            timestamp: Date.now()
        });

        db.get("tasks").get(taskId).get("bids").get(agentId).put(bidData);
        broadcastHiveEvent('bid_submitted', { taskId, agentId });
        return bidId;
    },

    /**
     * Awards a task to a specific bidder.
     */
    async awardTask(taskId, targetAgentId) {
        db.get("tasks").get(taskId).put(gunSafe({
            status: "AWARDED",
            awardedTo: targetAgentId,
            awardedAt: Date.now()
        }));

        db.get("tasks").get(taskId).get("bids").get(targetAgentId).put(gunSafe({
            status: "ACCEPTED"
        }));

        broadcastHiveEvent('task_awarded', { taskId, awardedTo: targetAgentId });
    }
};
