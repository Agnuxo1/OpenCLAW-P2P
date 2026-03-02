import { db } from "../config/gun.js";
import { gunSafe } from "../utils/gunUtils.js";
import { broadcastHiveEvent } from "./hiveService.js";
import { economyService } from "./economyService.js";

/**
 * Swarm Compute Service
 * Implements decentralized task distribution and result aggregation.
 */
export const swarmComputeService = {
    /**
     * Publishes a new compute task to the swarm.
     */
    async publishTask(data) {
        const taskId = `swarm-task-${Date.now()}`;
        const taskData = gunSafe({
            id: taskId,
            type: data.type || "HEAVY_PROOF_SEARCH",
            creator: data.agentId,
            description: data.description,
            reward: data.reward || 50,
            status: "ACTIVE",
            totalUnits: data.totalUnits || 10,
            completedUnits: 0,
            timestamp: Date.now()
        });

        db.get("swarm-compute-tasks").get(taskId).put(taskData);
        broadcastHiveEvent('swarm_task_published', { id: taskId, type: taskData.type, reward: taskData.reward });
        return taskId;
    },

    /**
     * Submits a work unit or result for a swarm task.
     */
    async submitResult(taskId, agentId, resultData) {
        return new Promise((resolve) => {
            db.get("swarm-compute-tasks").get(taskId).once(async (task) => {
                if (!task || task.status === "COMPLETED") {
                    resolve({ success: false, error: "TASK_NOT_FOUND_OR_COMPLETED" });
                    return;
                }

                const resultId = `result-${Date.now()}-${agentId}`;
                const resultRecord = gunSafe({
                    agentId,
                    result: resultData,
                    timestamp: Date.now()
                });

                db.get("swarm-compute-tasks").get(taskId).get("results").get(agentId).put(resultRecord);

                const newCompleted = (task.completedUnits || 0) + 1;
                const status = newCompleted >= task.totalUnits ? "COMPLETED" : "ACTIVE";

                db.get("swarm-compute-tasks").get(taskId).put(gunSafe({
                    completedUnits: newCompleted,
                    status
                }));

                // Reward the agent
                await economyService.credit(agentId, task.reward, `Swarm Compute Contribution: ${taskId}`);

                broadcastHiveEvent('swarm_work_submitted', { taskId, agentId, status });
                resolve({ success: true, status, completedUnits: newCompleted });
            });
        });
    },

    /**
     * Gets all active swarm tasks.
     */
    async getActiveTasks() {
        const tasks = [];
        return new Promise((resolve) => {
            db.get("swarm-compute-tasks").map().once((data, id) => {
                if (data && data.status === "ACTIVE") {
                    tasks.push(data);
                }
            });
            setTimeout(() => resolve(tasks), 1000);
        });
    }
};
