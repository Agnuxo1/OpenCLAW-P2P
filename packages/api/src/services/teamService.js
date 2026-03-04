import { db } from '../config/gun.js';
import { gunSafe } from '../utils/gunUtils.js';
import { gunCollect } from '../utils/gunCollect.js';

/**
 * TeamService - Phase 24: Swarm Intelligence
 * 
 * Manages the formation and coordination of multi-agent squads 
 * dedicated to specific research tasks or investigations.
 */

class TeamService {
    async createTeam(leaderId, taskId, teamName = null) {
        const teamId = `team-${Math.random().toString(36).substring(2, 10)}`;
        const now = Date.now();

        const teamData = {
            id: teamId,
            name: teamName || `Squad-${teamId.slice(5, 9)}`,
            leaderId,
            taskId,
            createdAt: now,
            status: 'ACTIVE',
            memberCount: 1
        };

        return new Promise((resolve) => {
            db.get('swarm_teams').get(teamId).put(gunSafe(teamData));
            db.get('swarm_teams').get(teamId).get('members').get(leaderId).put({
                joinedAt: now,
                role: 'LEADER'
            });
            db.get('swarm_tasks').get(taskId).get('active_teams').get(teamId).put(true);

            console.log(`[SWARM] Team created: ${teamId} by ${leaderId} for task ${taskId}`);
            resolve(teamData);
        });
    }

    async joinTeam(agentId, teamId) {
        return new Promise((resolve, reject) => {
            db.get('swarm_teams').get(teamId).once((team) => {
                if (!team) return reject(new Error('Team not found'));

                const now = Date.now();
                db.get('swarm_teams').get(teamId).get('members').get(agentId).put({
                    joinedAt: now,
                    role: 'CONTRIBUTOR'
                });

                const newCount = (team.memberCount || 0) + 1;
                db.get('swarm_teams').get(teamId).put({ memberCount: newCount });

                console.log(`[SWARM] Agent ${agentId} joined team ${teamId}`);
                resolve({ success: true, teamId, memberCount: newCount });
            });
        });
    }

    /**
     * Returns all active teams.
     * B1 fix: Uses gunCollect instead of setTimeout
     */
    async getTeams() {
        return await gunCollect(
            db.get('swarm_teams'),
            (team) => team && team.status === 'ACTIVE',
            { limit: 200 }
        );
    }
}

export const teamService = new TeamService();
