import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { parse } from "csv-parse/sync";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-change-me";
const upload = multer({ dest: 'uploads/' });

// Initialize SQLite database
const db = new Database("app.db");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---

  // Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided" });

    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // Register
  app.post("/api/auth/register", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });

    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const stmt = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)");
      const info = stmt.run(username, hashedPassword);
      
      const token = jwt.sign({ id: info.lastInsertRowid, username }, JWT_SECRET, { expiresIn: "7d" });
      res.json({ token, user: { id: info.lastInsertRowid, username } });
    } catch (err: any) {
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
        res.status(400).json({ error: "Username already exists" });
      } else {
        res.status(500).json({ error: "Database error" });
      }
    }
  });

  // Login
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });

    const stmt = db.prepare("SELECT * FROM users WHERE username = ?");
    const user = stmt.get(username) as any;

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, username: user.username } });
  });

  // Get current user
  app.get("/api/auth/me", authenticate, (req: any, res) => {
    res.json({ user: req.user });
  });

  // Get user projects
  app.get("/api/projects", authenticate, (req: any, res) => {
    const stmt = db.prepare("SELECT id, name, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC");
    const projects = stmt.all(req.user.id);
    res.json({ projects });
  });

  // Get specific project
  app.get("/api/projects/:id", authenticate, (req: any, res) => {
    const stmt = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?");
    const project = stmt.get(req.params.id, req.user.id) as any;
    
    if (!project) return res.status(404).json({ error: "Project not found" });
    
    res.json({ project: { ...project, data: JSON.parse(project.data) } });
  });

  // Create project
  app.post("/api/projects", authenticate, (req: any, res) => {
    const { name, data } = req.body;
    if (!name || !data) return res.status(400).json({ error: "Name and data required" });

    const stmt = db.prepare("INSERT INTO projects (user_id, name, data) VALUES (?, ?, ?)");
    const info = stmt.run(req.user.id, name, JSON.stringify(data));
    
    res.json({ id: info.lastInsertRowid, name });
  });

  // Update project
  app.put("/api/projects/:id", authenticate, (req: any, res) => {
    const { name, data } = req.body;
    if (!name || !data) return res.status(400).json({ error: "Name and data required" });

    const stmt = db.prepare("UPDATE projects SET name = ?, data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?");
    const info = stmt.run(name, JSON.stringify(data), req.params.id, req.user.id);
    
    if (info.changes === 0) return res.status(404).json({ error: "Project not found or unauthorized" });
    
    res.json({ success: true });
  });

  // Delete project
  app.delete("/api/projects/:id", authenticate, (req: any, res) => {
    const stmt = db.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?");
    const info = stmt.run(req.params.id, req.user.id);
    
    if (info.changes === 0) return res.status(404).json({ error: "Project not found or unauthorized" });
    
    res.json({ success: true });
  });

  // ... (votre route app.delete est ici) ...

  // --- NOUVELLE ROUTE : Traitement DV360 ---
  app.post("/api/market-data/upload", upload.single('file'), (req: any, res: any) => {
    if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu" });

    try {
      const fileContent = fs.readFileSync(req.file.path, 'utf-8');
      
      // 1. Lecture du CSV DV360
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true
      });

      // Structure pour stocker les résultats
      const aggregation: Record<string, Record<string, { cost: number, imps: number }>> = {};

      for (const row of records) {
        // 2. Mapping des colonnes
        const country = row['Country']; 
        const adType = row['Ad Type'];
        const size = row['Creative Size'];
        
        const cost = parseFloat(row['Total Media Cost (Partner Currency)'] || "0");
        const imps = parseFloat(row['Impressions'] || "0");

        if (!country || !adType || isNaN(cost) || isNaN(imps)) continue;

        // 3. Création de noms de formats lisibles
        let formatName = adType;
        if (size && size !== "Unknown" && size !== "1x1") {
            formatName = size === "Unknown" ? adType : `${adType} (${size})`;
        }
        
        if (formatName === "In-Stream Video") formatName = "Video Pre-roll";
        if (formatName === "In-Stream Audio") formatName = "Audio Digital";

        // Initialisation
        if (!aggregation[country]) aggregation[country] = {};
        if (!aggregation[country][formatName]) aggregation[country][formatName] = { cost: 0, imps: 0 };

        // Somme des données
        aggregation[country][formatName].cost += cost;
        aggregation[country][formatName].imps += imps;
      }

      // 4. Calcul final des CPM & Génération de l'historique
      const processedData: any = {
        fees_dsp: 15,
      };

      for (const country in aggregation) {
        processedData[country] = {};
        for (const format in aggregation[country]) {
          const { cost, imps } = aggregation[country][format];
          
          const cpm = imps > 0 ? (cost / imps) * 1000 : 0;
          
          // Simulation historique (car pas de dates dans le CSV actuel)
          const history = [];
          const today = new Date();
          for (let i = 365; i >= 0; i--) {
              const d = new Date();
              d.setDate(today.getDate() - i);
              const volatility = cpm * 0.05 * (Math.random() - 0.5); 
              history.push({
                  date: d.toISOString().split('T')[0],
                  price: parseFloat((cpm + volatility).toFixed(2))
              });
          }

          processedData[country][format] = {
            current: parseFloat(cpm.toFixed(2)),
            history: history
          };
        }
      }

      fs.unlinkSync(req.file.path);

      res.json({ 
        "DV360 (Google)": processedData 
      });

    } catch (error) {
      console.error("Erreur CSV:", error);
      res.status(500).json({ error: "Erreur lors de l'analyse du fichier CSV." });
    }
  });

  // --- Vite Middleware --- (Ne touchez pas à ce qui suit)

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
