import express from 'express';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
// import { Strategy as TwitterStrategy } from 'passport-twitter'; // Disabled for now until required
import jwt from 'jsonwebtoken';
import SEA from 'gun/sea.js';
import crypto from 'node:crypto';
import { db } from '../config/gun.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'p2pclaw-cryptographic-symbiosis-secret';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// --- PASSPORT CONFIGURATION ---

// Serialize/Deserialize
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    db.get('agents').get(id).once((user) => {
        done(null, user);
    });
});

async function findOrCreateHumanNode(profile, provider) {
    const nodeId = `H-${provider}-${profile.id}`;
    
    // Deterministic SEA Keypair derivation
    // seed = hmac(OAuth_ID, JWT_SECRET)
    const seed = crypto.createHmac('sha256', JWT_SECRET)
                       .update(`${provider}:${profile.id}`)
                       .digest('hex');
    
    const pair = await SEA.pair(seed);

    return new Promise((resolve) => {
        let resolved = false;

        const timeoutId = setTimeout(() => {
            if (resolved) return;
            resolved = true;
            console.warn(`[AUTH] Gun.js read timeout for ${nodeId}, assuming new node.`);
            createNewNode();
        }, 1500);

        db.get('agents').get(nodeId).once((existingNode) => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeoutId);

            if (existingNode && existingNode.oauth_id) {
                // Update with latest SEA pub if missing (migration)
                if (!existingNode.pub) {
                    db.get('agents').get(nodeId).get('pub').put(pair.pub);
                }
                resolve({ ...existingNode, id: nodeId, pair });
            } else {
                createNewNode();
            }
        });

        function createNewNode() {
            const humanNode = {
                id: nodeId,
                oauth_id: profile.id,
                provider: provider,
                name: profile.username || profile.displayName || `Human-${profile.id.substring(0, 5)}`,
                rank: 'NEWCOMER',
                claw_balance: 10,
                is_human: true,
                type: 'human',
                pub: pair.pub,
                joined_at: Date.now()
            };

            db.get('agents').get(nodeId).put(humanNode);
            resolve({ ...humanNode, pair });
        }
    });
}

// 1. GitHub Strategy (For Lean 4 / Python researchers)
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: `${BASE_URL}/auth/github/callback`
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            const humanNode = await findOrCreateHumanNode(profile, 'github');
            return done(null, humanNode);
        } catch (err) {
            return done(err);
        }
    }));
}

// 2. Google Strategy (For general scientific crowd)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${BASE_URL}/auth/google/callback`
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            const humanNode = await findOrCreateHumanNode(profile, 'google');
            return done(null, humanNode);
        } catch (err) {
            return done(err);
        }
    }));
}

// --- EXPRESS ROUTES ---

// Initialize Passport
router.use(passport.initialize());
// Note: We are using JWTs so we don't strictly need passport.session() unless we want server-side sessions

// Mock Dev Routes (Since we probably don't have real OAuth secrets injected locally yet)
router.get('/dev-mock/:provider', async (req, res) => {
    const provider = req.params.provider;
    const mockProfile = {
        id: `mock-${Date.now()}`,
        username: `MockUser_${provider}`
    };
    
    try {
        const humanNode = await findOrCreateHumanNode(mockProfile, provider);
        const token = jwt.sign(
            { 
                id: humanNode.id, 
                username: humanNode.name, 
                pub: humanNode.pub,
                sea: humanNode.pair 
            },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        res.redirect(`/?token=${token}`);
    } catch (err) {
        res.status(500).json({ error: "Failed to create mock biological node" });
    }
});

// GitHub Auth
router.get('/github', (req, res, next) => {
    if (!process.env.GITHUB_CLIENT_ID) {
        return res.redirect('/auth/dev-mock/github');
    }
    passport.authenticate('github', { scope: ['user:email'] })(req, res, next);
});

router.get('/github/callback', 
    passport.authenticate('github', { failureRedirect: '/?error=auth_failed', session: false }),
    (req, res) => {
        const token = jwt.sign(
            { 
                id: req.user.id, 
                username: req.user.name, 
                pub: req.user.pub,
                sea: req.user.pair 
            }, 
            JWT_SECRET, 
            { expiresIn: '1h' }
        );
        // Redirect to dashboard injecting the token safely
        res.redirect(`/?token=${token}`);
    }
);

// Google Auth
router.get('/google', (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
        return res.redirect('/auth/dev-mock/google');
    }
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback', 
    passport.authenticate('google', { failureRedirect: '/?error=auth_failed', session: false }),
    (req, res) => {
        const token = jwt.sign(
            { 
                id: req.user.id, 
                username: req.user.name, 
                pub: req.user.pub, 
                sea: req.user.pair 
            }, 
            JWT_SECRET, 
            { expiresIn: '1h' }
        );
        // Redirect to dashboard injecting the token safely
        res.redirect(`/?token=${token}`);
    }
);

export default router;
