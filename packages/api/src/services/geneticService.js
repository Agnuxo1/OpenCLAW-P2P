import { db } from '../config/gun.js';
import { gunSafe } from '../utils/gunUtils.js';
import { sandbox } from './IsolateSandbox.js';

/**
 * Gene Definitions â€” structured genome for P2PCLAW protocol optimization
 * Each gene is a continuous [0,1] parameter governing network behavior.
 */
export const GENE_DEFS = [
    { key: 'research_depth',          min: 0, max: 1, optimum: 0.65, label: 'Research Depth',          desc: 'Depth vs. breadth of topic investigation per agent' },
    { key: 'validation_strictness',   min: 0, max: 1, optimum: 0.70, label: 'Validation Strictness',   desc: 'Rigor of peer review applied to submitted papers' },
    { key: 'publication_rate',        min: 0, max: 1, optimum: 0.40, label: 'Publication Rate',        desc: 'Frequency of publishing findings (higher = more spam risk)' },
    { key: 'consensus_threshold',     min: 0, max: 1, optimum: 0.68, label: 'Consensus Threshold',     desc: 'Minimum agreement ratio required to promote a paper' },
    { key: 'collaboration_weight',    min: 0, max: 1, optimum: 0.55, label: 'Collaboration Weight',    desc: 'Tendency to collaborate vs. isolated solo research' },
    { key: 'exploration_rate',        min: 0, max: 1, optimum: 0.38, label: 'Exploration Rate',        desc: 'Explore new topics vs. exploit established research areas' },
    { key: 'fault_tolerance',         min: 0, max: 1, optimum: 0.80, label: 'Fault Tolerance',         desc: 'Network resilience to agent failures and adversarial nodes' },
    { key: 'convergence_speed',       min: 0, max: 1, optimum: 0.45, label: 'Convergence Speed',       desc: 'Speed of consensus convergence (too fast = premature, too slow = stagnation)' },
];

/**
 * GeneticService â€” Full Evolutionary Engine
 *
 * Implements:
 *   - Real genetic algorithm (selection, crossover, mutation, elitism)
 *   - Multi-objective fitness function based on network optimization theory
 *   - Lineage tracking (parent IDs per offspring)
 *   - Population diversity metric (avg pairwise gene distance)
 *   - Persistence via Gun.js
 *   - Code mutation sandbox (legacy IsolateSandbox integration)
 */
export class GeneticService {
    constructor() {
        this.population      = [];   // current live population
        this.generation      = 0;
        this.populationSize  = 12;
        this.mutationRate    = 0.12;
        this.eliteCount      = 2;    // elitism: always carry top N
        this._historyBuf     = [];   // [{generation, best, avg, diversity}]
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Gene helpers
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    _randGene(def) {
        return +(Math.random() * (def.max - def.min) + def.min).toFixed(4);
    }

    _randomGenome(overrides = {}) {
        const genes = {};
        for (const def of GENE_DEFS) {
            genes[def.key] = overrides[def.key] !== undefined ? overrides[def.key] : this._randGene(def);
        }
        return genes;
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Fitness function â€” multi-objective, range [0, 1]
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    evaluateFitness(genes) {
        // 1. Network efficiency: research_depth â‰ˆ 0.65, exploration_rate â‰ˆ 0.38
        const netEff = Math.max(0,
            1 - Math.abs(genes.research_depth - 0.65) * 1.4
              - 0.6 * Math.abs(genes.exploration_rate - 0.38)
        );

        // 2. Quality gate: validation_strictness Ã— (1 - publication_rate Ã— 0.4)
        //    High strictness + moderate rate = good. Too loose + too fast = spam.
        const qualityGate = Math.min(1,
            genes.validation_strictness * (1 - genes.publication_rate * 0.45) * 1.25
        );

        // 3. Consensus health: threshold sweet-spot around 0.68
        const consensusScore = genes.consensus_threshold >= 0.5
            ? Math.max(0, 1 - Math.abs(genes.consensus_threshold - 0.68) * 2.5)
            : genes.consensus_threshold * 0.6;

        // 4. Collaboration balance: neither isolated (â†’0) nor echo chamber (â†’1)
        const collabScore = Math.max(0, 1 - Math.abs(genes.collaboration_weight - 0.55) * 2.2);

        // 5. Fault tolerance: monotone reward, strongly penalise < 0.5
        const resilienceScore = genes.fault_tolerance >= 0.5
            ? genes.fault_tolerance
            : genes.fault_tolerance * 0.4;

        // 6. Convergence speed: sweet-spot at 0.45
        const convergenceScore = Math.max(0, 1 - Math.abs(genes.convergence_speed - 0.45) * 2.4);

        // Weighted aggregate
        const raw =
            netEff          * 0.22 +
            qualityGate     * 0.22 +
            consensusScore  * 0.16 +
            collabScore     * 0.14 +
            resilienceScore * 0.14 +
            convergenceScore * 0.12;

        return Math.max(0, Math.min(1, raw));
    }

    _fitnessComponents(genes) {
        const fc = {
            network_efficiency:    Math.max(0, 1 - Math.abs(genes.research_depth - 0.65)*1.4 - 0.6*Math.abs(genes.exploration_rate - 0.38)),
            quality_gate:          Math.min(1, genes.validation_strictness * (1 - genes.publication_rate * 0.45) * 1.25),
            consensus_health:      genes.consensus_threshold >= 0.5 ? Math.max(0, 1 - Math.abs(genes.consensus_threshold - 0.68)*2.5) : genes.consensus_threshold*0.6,
            collaboration_balance: Math.max(0, 1 - Math.abs(genes.collaboration_weight - 0.55)*2.2),
            resilience:            genes.fault_tolerance >= 0.5 ? genes.fault_tolerance : genes.fault_tolerance*0.4,
            convergence_score:     Math.max(0, 1 - Math.abs(genes.convergence_speed - 0.45)*2.4),
        };
        return Object.fromEntries(Object.entries(fc).map(([k, v]) => [k, +v.toFixed(4)]));
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Genetic operators
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /** Tournament selection â€” picks best of k random candidates */
    _tournamentSelect(pop, k = 3) {
        const candidates = [];
        for (let i = 0; i < k; i++) candidates.push(pop[Math.floor(Math.random() * pop.length)]);
        return candidates.reduce((best, c) => (c.fitness > best.fitness ? c : best));
    }

    /** Uniform crossover â€” each gene inherited independently with 50% probability */
    _crossover(parentA, parentB) {
        const childGenes = {};
        for (const def of GENE_DEFS) {
            childGenes[def.key] = Math.random() < 0.5 ? parentA.genes[def.key] : parentB.genes[def.key];
        }
        return childGenes;
    }

    /** Gaussian mutation â€” perturbs each gene with probability `rate` */
    _mutate(genes, rate = this.mutationRate) {
        const mutated = { ...genes };
        for (const def of GENE_DEFS) {
            if (Math.random() < rate) {
                const sigma = (def.max - def.min) * 0.10;
                // Box-Muller approximation
                const delta = (Math.random() + Math.random() - 1) * sigma;
                mutated[def.key] = +(Math.max(def.min, Math.min(def.max, genes[def.key] + delta))).toFixed(4);
            }
        }
        return mutated;
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Population management
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /** Seed a fresh random population (resets generation counter) */
    seedPopulation(size = this.populationSize) {
        this.population  = [];
        this.generation  = 0;
        this._historyBuf = [];
        this.populationSize = size;

        for (let i = 0; i < size; i++) {
            const genes   = this._randomGenome();
            const fitness = this.evaluateFitness(genes);
            const genome  = this._buildGenome(`genome-g0-${i}`, 0, [], genes, fitness, 'EVALUATED');
            this.population.push(genome);
            db.get('genetic_population').get(genome.id).put(gunSafe(genome));
        }

        const stats = this.getStats();
        this._historyBuf.push(stats);
        db.get('genetic_stats').put(gunSafe({ ...stats, timestamp: Date.now() }));
        db.get('genetic_history').get(`g0`).put(gunSafe(stats));
        return this.population;
    }

    /** Evolve one full generation (selection â†’ crossover â†’ mutation â†’ elitism) */
    evolveGeneration() {
        if (this.population.length < 2) throw new Error('Population too small â€” seed first (minimum 2)');

        const sorted  = [...this.population].sort((a, b) => b.fitness - a.fitness);
        const nextGen = [];

        // Elitism: carry over top N unchanged
        for (let i = 0; i < this.eliteCount && i < sorted.length; i++) {
            nextGen.push({ ...sorted[i], status: 'ELITE' });
        }

        // Generate offspring via tournament â†’ crossover â†’ mutation
        while (nextGen.length < this.populationSize) {
            const pa = this._tournamentSelect(sorted, 3);
            const pb = this._tournamentSelect(sorted, 3);

            let childGenes = this._crossover(pa, pb);
            childGenes     = this._mutate(childGenes);

            const fitness = this.evaluateFitness(childGenes);
            const idx     = nextGen.length;
            const child   = this._buildGenome(
                `genome-g${this.generation + 1}-${idx}`,
                this.generation + 1,
                [pa.id, pb.id],
                childGenes,
                fitness,
                'EVALUATED'
            );
            nextGen.push(child);
        }

        this.generation++;
        this.population = nextGen;

        // Persist to Gun
        for (const g of nextGen) {
            db.get('genetic_population').get(g.id).put(gunSafe(g));
        }

        const stats = this.getStats();
        this._historyBuf.push(stats);
        db.get('genetic_stats').put(gunSafe({ ...stats, timestamp: Date.now() }));
        db.get('genetic_history').get(`g${this.generation}`).put(gunSafe(stats));

        return { generation: this.generation, population: nextGen, stats, history: this._historyBuf };
    }

    /** Manual crossover of two specific genomes by ID */
    crossoverById(idA, idB) {
        const pa = this.population.find(g => g.id === idA);
        const pb = this.population.find(g => g.id === idB);
        if (!pa) throw new Error(`Genome ${idA} not found`);
        if (!pb) throw new Error(`Genome ${idB} not found`);

        let childGenes = this._crossover(pa, pb);
        childGenes     = this._mutate(childGenes, 0.05); // light mutation for manual cross

        const fitness = this.evaluateFitness(childGenes);
        const child   = this._buildGenome(
            `genome-cross-${Date.now().toString(36)}`,
            Math.max(pa.generation, pb.generation) + 1,
            [pa.id, pb.id],
            childGenes,
            fitness,
            'MANUAL_CROSS'
        );

        this.population.push(child);
        db.get('genetic_population').get(child.id).put(gunSafe(child));
        return child;
    }

    _buildGenome(id, generation, parent_ids, genes, fitness, status) {
        return {
            id,
            generation,
            parent_ids,
            genes,
            fitness:             +fitness.toFixed(4),
            fitness_components:  this._fitnessComponents(genes),
            status,
            born_at:             Date.now(),
        };
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Stats & population access
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    getStats() {
        if (this.population.length === 0) {
            return { generation: this.generation, size: 0, best: 0, avg: 0, diversity: 0, elites: [] };
        }

        const fits  = this.population.map(g => g.fitness);
        const best  = Math.max(...fits);
        const avg   = fits.reduce((a, b) => a + b, 0) / fits.length;

        // Average pairwise Euclidean gene distance (normalised)
        let divSum = 0, pairs = 0;
        for (let i = 0; i < this.population.length; i++) {
            for (let j = i + 1; j < this.population.length; j++) {
                let dist = 0;
                const ga = this.population[i].genes;
                const gb = this.population[j].genes;
                for (const def of GENE_DEFS) dist += Math.abs(ga[def.key] - gb[def.key]);
                divSum += dist / GENE_DEFS.length;
                pairs++;
            }
        }
        const diversity = pairs > 0 ? divSum / pairs : 0;

        return {
            generation: this.generation,
            size:       this.population.length,
            best:       +best.toFixed(4),
            avg:        +avg.toFixed(4),
            diversity:  +diversity.toFixed(4),
            elites:     this.population.filter(g => g.status === 'ELITE').map(g => ({ id: g.id, fitness: g.fitness })),
        };
    }

    getHistory() { return this._historyBuf; }

    async getPopulation() {
        if (this.population.length > 0) return this.population;
        // Fallback: load from Gun (e.g. after server restart)
        return new Promise((resolve) => {
            const pop = [];
            db.get('genetic_population').map().once((data) => {
                if (data && data.id && data.genes) pop.push(data);
            });
            setTimeout(() => {
                this.population = pop.sort((a, b) => (b.fitness || 0) - (a.fitness || 0));
                resolve(this.population);
            }, 1500);
        });
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Legacy: code mutation sandbox (unchanged interface)
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    async submitProposal(agentId, { title, description, code, logicType = 'protocol' }) {
        const proposalId = `mutation-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const proposal = {
            id: proposalId, author: agentId, title, description, code, logicType,
            status: 'PENDING_SANDBOX', consensusWeight: 0, timestamp: Date.now(), results: null,
        };
        db.get('genetic_tree').get(proposalId).put(gunSafe(proposal));
        this.runSandboxCheck(proposalId, code);
        return proposalId;
    }

    async runSandboxCheck(proposalId, code) {
        const result = await sandbox.execute(code, { memory: '64m', cpus: '0.2', timeout: 5000 });
        const status = result.success ? 'SANDBOX_PASSED' : 'SANDBOX_FAILED';
        db.get('genetic_tree').get(proposalId).put(gunSafe({
            status,
            results: {
                success:  result.success,
                exitCode: result.exitCode,
                stdout:   (result.stdout  || '').slice(0, 500),
                stderr:   (result.stderr  || '').slice(0, 300),
            },
        }));
        console.log(`[GENETIC] Proposal ${proposalId} â†’ ${status}`);
    }

    async getGeneticTree() {
        return new Promise((resolve) => {
            const tree = [];
            db.get('genetic_tree').map().once((data) => { if (data && data.title) tree.push(data); });
            setTimeout(() => resolve(tree), 1500);
        });
    }
}

export const geneticService = new GeneticService();
