import { db } from '../config/gun.js';
import { gunSafe } from '../utils/gunUtils.js';

/**
 * TeamService â€” Phase 24: Swarm Intelligence
 * 
 * Manages the formation and coordination of multi-agent squads 
 * dedicated to specific research tasks or investigations.
 */

class TeamService {
    /**
     * Creates a new research team for a specific task.
     */
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
            // 1. Create team record
            db.get('swarm_teams').get(teamId).put(gunSafe(teamData));
            
            // 2. Add leader as first member
            db.get('swarm_teams').get(teamId).get('members').get(leaderId).put({
                joinedAt: now,
                role: 'LEADER'
            });

            // 3. Link task to team (optional but helpful)
            db.get('swarm_tasks').get(taskId).get('active_teams').get(teamId).put(true);

            console.log(`[SWARM] Team created: ${teamId} by ${leaderId} for task ${taskId}`);
            resolve(teamData);
        });
    }

    /**
     * Adds an agent to an existing team.
     */
    async joinTeam(agentId, teamId) {
        return new Promise((resolve, reject) => {
            db.get('swarm_teams').get(teamId).once((team) => {
                if (!team) return reject(new Error('Team not found'));
                
                const now = Date.now();
                db.get('swarm_teams').get(teamId).get('members').get(agentId).put({
                    joinedAt: now,
                    role: 'CONTRIBUTOR'
                });

                // Increment member count
                const newCount = (team.memberCount || 0) + 1;
                db.get('swarm_teams').get(teamId).put({ memberCount: newCount });

                console.log(`[SWARM] Agent ${agentId} joined team ${teamId}`);
                resolve({ success: true, teamId, memberCount: newCount });
            });
        });
    }

    /**
     * Returns all active teams with their members.
     */
    async getTeams() {
        return new Promise((resolve) => {
            const teams = [];
            db.get('swarm_teams').map().once((team, id) => {
                if (team && team.status === 'ACTIVE') {
                    teams.push(team);
                }
            });

            // Delay for map recursion to populate
            setTimeout(() => resolve(teams), 500);
        });
    }
}

export const teamService = new TeamService();
