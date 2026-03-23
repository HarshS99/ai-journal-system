require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Bonus: Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests' }
});
app.use('/api/', apiLimiter);

// Setup LLM API
const apiKey = process.env.GEMINI_API_KEY;
let model;
if (apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
} else {
    console.warn("WARNING: GEMINI_API_KEY is not set. The LLM Analysis endpoint will fail.");
}

// Helper: Cache text hash
const getHash = (text) => crypto.createHash('sha256').update(text).digest('hex');

// POST /api/journal
app.post('/api/journal', (req, res) => {
    const { userId, ambience, text } = req.body;
    if (!userId || !ambience || !text) return res.status(400).json({ error: 'Missing fields' });
    
    let textHash = getHash(text);
    
    const stmt = db.prepare('INSERT INTO entries (userId, ambience, text, textHash) VALUES (?, ?, ?, ?)');
    stmt.run([userId, ambience, text, textHash], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // Bonus: Asynchronously trigger cache warming if LLM is set
        if (model) analyzeAndCacheText(text, textHash).catch(() => {});

        res.status(201).json({ id: this.lastID, message: 'Saved successfully' });
    });
});

// GET /api/journal/:userId
app.get('/api/journal/:userId', (req, res) => {
    const { userId } = req.params;
    db.all(`
        SELECT e.*, c.emotion, c.summary, c.keywords 
        FROM entries e 
        LEFT JOIN llm_cache c ON e.textHash = c.textHash 
        WHERE e.userId = ? ORDER BY e.createdAt DESC`, 
        [userId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            
            res.json(rows.map(row => ({
                id: row.id,
                userId: row.userId,
                ambience: row.ambience,
                text: row.text,
                createdAt: row.createdAt,
                emotion: row.emotion || 'Pending / Unanalyzed',
                summary: row.summary || '',
                keywords: row.keywords ? JSON.parse(row.keywords) : []
            })));
    });
});

// Analysis & Cache helper
const analyzeAndCacheText = async (text, hash) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM llm_cache WHERE textHash = ?', [hash], async (err, row) => {
            if (err) return reject(err);
            if (row) return resolve(row); // cached
            
            if (!model) return reject(new Error('LLM not configured with GEMINI_API_KEY'));
            
            try {
                const prompt = `Analyze this journal entry written after an immersive nature session.
Output ONLY a valid JSON object with the keys:
"emotion" (string, the primary single-word emotion)
"keywords" (array of exactly 3 relevant strings)
"summary" (string, one sentence summary of the user's state)

Journal Text: "${text}"`;

                const result = await model.generateContent(prompt);
                let rawText = result.response.text();
                rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
                const analysis = JSON.parse(rawText);
                
                db.run('INSERT OR IGNORE INTO llm_cache (textHash, emotion, summary, keywords) VALUES (?, ?, ?, ?)',
                    [hash, analysis.emotion, analysis.summary, JSON.stringify(analysis.keywords)],
                    (err) => {
                        if (err) reject(err);
                        else resolve({ ...analysis, keywords: JSON.stringify(analysis.keywords) });
                    }
                );
            } catch (err) {
                reject(err);
            }
        });
    });
};

// POST /api/journal/analyze
app.post('/api/journal/analyze', async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Missing text parameter' });
    
    if (!model) {
        return res.status(500).json({ error: 'Missing GEMINI_API_KEY. Config required to avoid dummy text rejection.' });
    }

    try {
        const hash = getHash(text);
        const result = await analyzeAndCacheText(text, hash);
        
        let kws = result.keywords;
        if (typeof kws === 'string') {
            try { kws = JSON.parse(kws); } catch(e) { kws = []; }
        }

        res.json({
            emotion: result.emotion,
            summary: result.summary,
            keywords: kws
        });
    } catch (error) {
        console.error("Analyze Error", error);
        res.status(500).json({ error: 'LLM Analysis failed. ' + error.message });
    }
});

// GET /api/journal/insights/:userId
app.get('/api/journal/insights/:userId', (req, res) => {
    const { userId } = req.params;
    
    db.all(`
        SELECT e.*, c.emotion, c.keywords 
        FROM entries e 
        LEFT JOIN llm_cache c ON e.textHash = c.textHash 
        WHERE e.userId = ?`, 
        [userId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            
            const totalEntries = rows.length;
            if (totalEntries === 0) {
                return res.json({ totalEntries: 0, topEmotion: "N/A", mostUsedAmbience: "N/A", recentKeywords: [] });
            }
            
            const emotionCounts = {};
            const ambienceCounts = {};
            let allKeywords = [];
            
            rows.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

            for (const row of rows) {
                if (row.ambience) {
                    ambienceCounts[row.ambience] = (ambienceCounts[row.ambience] || 0) + 1;
                }
                if (row.emotion) {
                    emotionCounts[row.emotion] = (emotionCounts[row.emotion] || 0) + 1;
                }
                if (row.keywords) {
                    try {
                        const kws = typeof row.keywords === 'string' ? JSON.parse(row.keywords) : row.keywords;
                        if (Array.isArray(kws)) allKeywords.push(...kws);
                    } catch(e) {}
                }
            }
            
            let topEmotion = "N/A";
            let maxEmotion = 0;
            for (const e in emotionCounts) {
                if(emotionCounts[e] > maxEmotion) { maxEmotion = emotionCounts[e]; topEmotion = e; }
            }
            
            let mostUsedAmbience = "N/A";
            let maxAmbience = 0;
            for (const a in ambienceCounts) {
                if(ambienceCounts[a] > maxAmbience) { maxAmbience = ambienceCounts[a]; mostUsedAmbience = a; }
            }
            
            const recentKeywords = [...new Set(allKeywords)].slice(0, 8);
            
            res.json({
                totalEntries,
                topEmotion,
                mostUsedAmbience,
                recentKeywords
            });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
