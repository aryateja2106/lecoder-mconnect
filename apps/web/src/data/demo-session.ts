/**
 * Demo Session Data and Types
 *
 * Pre-recorded terminal output for MConnect demo mode.
 * Simulates a realistic Claude Code session with approval flow.
 *
 * MConnect v0.2.0
 */

// ============================================
// Type Definitions
// ============================================

/**
 * A single frame in the demo playback
 */
export interface DemoFrame {
  /** Milliseconds from session start */
  timestamp: number;
  /** Frame type */
  type: 'output' | 'input' | 'approval' | 'status' | 'agent_info';
  /** Terminal content or status message */
  content: string;
  /** Optional metadata for the frame */
  metadata?: {
    /** For approval frames - whether it was approved */
    approved?: boolean;
    /** Session ID for session_info messages */
    sessionId?: string;
    /** Agent ID for agent-specific output */
    agentId?: string;
    /** Read-only mode state */
    isReadOnly?: boolean;
    /** Approval command (for approval frames) */
    command?: string;
    /** Approval reason (for approval frames) */
    reason?: string;
  };
}

/**
 * A complete demo session with frames
 */
export interface DemoSession {
  /** Unique session identifier */
  id: string;
  /** Human-readable session name */
  name: string;
  /** Agent preset (single, multi, etc.) */
  preset: string;
  /** Type of agent being demonstrated */
  agentType: 'claude' | 'gemini' | 'shell';
  /** Total duration of the session in milliseconds */
  duration: number;
  /** Ordered list of frames to playback */
  frames: DemoFrame[];
}

/**
 * A complete demo scenario with multiple sessions
 */
export interface DemoScenario {
  /** All sessions in the demo */
  sessions: DemoSession[];
  /** ID of the session to display first */
  defaultSessionId: string;
}

// ============================================
// ANSI Color Helpers
// ============================================

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  // Foreground colors
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  // Background colors
  bgBlack: '\x1b[40m',
  bgGray: '\x1b[100m',
};

// ============================================
// Demo Session Data - Claude Code Session
// ============================================

/**
 * Main demo session: Claude Code creating a REST API
 *
 * Script:
 * - Scene 1 (0-5s): Agent start with mconnect banner
 * - Scene 2 (5-30s): Claude Code working - creating files
 * - Scene 3 (30-40s): Approval request for git push
 * - Scene 4 (40-50s): Approval resolution and git push output
 */
const claudeCodeSession: DemoSession = {
  id: 'demo-session-claude-1',
  name: 'Claude Code - REST API',
  preset: 'single',
  agentType: 'claude',
  duration: 55000, // 55 seconds total
  frames: [
    // =====================================
    // Scene 1: Agent Start (0-5s)
    // =====================================
    {
      timestamp: 0,
      type: 'agent_info',
      content: '',
      metadata: {
        sessionId: 'demo-session-claude-1',
        agentId: 'claude-1',
        isReadOnly: true,
      },
    },
    {
      timestamp: 100,
      type: 'output',
      content: `${ANSI.brightCyan}${ANSI.bold}
  ╔═══════════════════════════════════════════════╗
  ║                                               ║
  ║   🐬 MConnect v0.1.7                          ║
  ║                                               ║
  ║   Control AI coding agents from anywhere      ║
  ║                                               ║
  ╚═══════════════════════════════════════════════╝
${ANSI.reset}
`,
    },
    {
      timestamp: 500,
      type: 'output',
      content: `${ANSI.gray}Starting session...${ANSI.reset}\n`,
    },
    {
      timestamp: 1000,
      type: 'output',
      content: `${ANSI.green}✓${ANSI.reset} Session initialized: ${ANSI.cyan}demo-session-claude-1${ANSI.reset}\n`,
    },
    {
      timestamp: 1500,
      type: 'output',
      content: `${ANSI.green}✓${ANSI.reset} Claude Code agent spawned\n`,
    },
    {
      timestamp: 2000,
      type: 'output',
      content: `${ANSI.green}✓${ANSI.reset} Guardrails: ${ANSI.yellow}standard${ANSI.reset} (approve destructive commands)\n`,
    },
    {
      timestamp: 2500,
      type: 'output',
      content: `${ANSI.green}✓${ANSI.reset} Mobile client connected from ${ANSI.magenta}iPhone${ANSI.reset}\n\n`,
    },
    {
      timestamp: 3000,
      type: 'output',
      content: `${ANSI.dim}────────────────────────────────────────────────${ANSI.reset}\n\n`,
    },

    // =====================================
    // Scene 2: Claude Code Working (5-30s)
    // =====================================
    {
      timestamp: 5000,
      type: 'output',
      content: `${ANSI.brightBlue}claude>${ANSI.reset} Create a simple REST API with Express\n\n`,
    },
    {
      timestamp: 6000,
      type: 'output',
      content: `${ANSI.gray}I'll create a REST API with Express. Let me set up the project structure...${ANSI.reset}\n\n`,
    },
    {
      timestamp: 7500,
      type: 'output',
      content: `${ANSI.yellow}📝 Creating:${ANSI.reset} ${ANSI.cyan}src/index.ts${ANSI.reset}\n`,
    },
    {
      timestamp: 8000,
      type: 'output',
      content: `${ANSI.dim}┌──────────────────────────────────────────────┐${ANSI.reset}\n`,
    },
    {
      timestamp: 8200,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset} ${ANSI.magenta}import${ANSI.reset} express ${ANSI.magenta}from${ANSI.reset} ${ANSI.green}'express'${ANSI.reset};           ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 8400,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset} ${ANSI.magenta}import${ANSI.reset} { userRoutes } ${ANSI.magenta}from${ANSI.reset} ${ANSI.green}'./routes'${ANSI.reset}; ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 8600,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset}                                              ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 8800,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset} ${ANSI.magenta}const${ANSI.reset} app = ${ANSI.cyan}express${ANSI.reset}();                   ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 9000,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset} ${ANSI.magenta}const${ANSI.reset} PORT = process.env.PORT || ${ANSI.yellow}3000${ANSI.reset}; ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 9200,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset}                                              ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 9400,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset} app.${ANSI.cyan}use${ANSI.reset}(express.${ANSI.cyan}json${ANSI.reset}());                 ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 9600,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset} app.${ANSI.cyan}use${ANSI.reset}(${ANSI.green}'/api/users'${ANSI.reset}, userRoutes);       ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 9800,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset}                                              ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 10000,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset} app.${ANSI.cyan}listen${ANSI.reset}(PORT, () => {                   ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 10200,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset}   console.${ANSI.cyan}log${ANSI.reset}(\`Server: \${PORT}\`);         ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 10400,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset} });                                          ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 10600,
      type: 'output',
      content: `${ANSI.dim}└──────────────────────────────────────────────┘${ANSI.reset}\n\n`,
    },
    {
      timestamp: 12000,
      type: 'output',
      content: `${ANSI.green}✓${ANSI.reset} Created ${ANSI.cyan}src/index.ts${ANSI.reset}\n\n`,
    },
    {
      timestamp: 13000,
      type: 'output',
      content: `${ANSI.yellow}📝 Creating:${ANSI.reset} ${ANSI.cyan}src/routes/users.ts${ANSI.reset}\n`,
    },
    {
      timestamp: 13500,
      type: 'output',
      content: `${ANSI.dim}┌──────────────────────────────────────────────┐${ANSI.reset}\n`,
    },
    {
      timestamp: 13700,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset} ${ANSI.magenta}import${ANSI.reset} { Router } ${ANSI.magenta}from${ANSI.reset} ${ANSI.green}'express'${ANSI.reset};        ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 13900,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset}                                              ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 14100,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset} ${ANSI.magenta}const${ANSI.reset} router = ${ANSI.cyan}Router${ANSI.reset}();                  ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 14300,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset}                                              ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 14500,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset} router.${ANSI.cyan}get${ANSI.reset}(${ANSI.green}'/'${ANSI.reset}, (req, res) => {          ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 14700,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset}   res.${ANSI.cyan}json${ANSI.reset}({ users: [] });               ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 14900,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset} });                                          ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 15100,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset}                                              ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 15300,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset} router.${ANSI.cyan}post${ANSI.reset}(${ANSI.green}'/'${ANSI.reset}, (req, res) => {         ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 15500,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset}   ${ANSI.magenta}const${ANSI.reset} { name, email } = req.body;      ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 15700,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset}   res.${ANSI.cyan}status${ANSI.reset}(${ANSI.yellow}201${ANSI.reset}).${ANSI.cyan}json${ANSI.reset}({ id: ${ANSI.yellow}1${ANSI.reset}, name });  ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 15900,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset} });                                          ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 16100,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset}                                              ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 16300,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset} ${ANSI.magenta}export${ANSI.reset} { router ${ANSI.magenta}as${ANSI.reset} userRoutes };        ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 16500,
      type: 'output',
      content: `${ANSI.dim}└──────────────────────────────────────────────┘${ANSI.reset}\n\n`,
    },
    {
      timestamp: 17500,
      type: 'output',
      content: `${ANSI.green}✓${ANSI.reset} Created ${ANSI.cyan}src/routes/users.ts${ANSI.reset}\n\n`,
    },
    {
      timestamp: 19000,
      type: 'output',
      content: `${ANSI.gray}Installing dependencies...${ANSI.reset}\n\n`,
    },
    {
      timestamp: 19500,
      type: 'output',
      content: `${ANSI.dim}$${ANSI.reset} npm install express @types/express typescript\n`,
    },
    {
      timestamp: 20500,
      type: 'output',
      content: `\nadded ${ANSI.green}58 packages${ANSI.reset} in 2.3s\n\n`,
    },
    {
      timestamp: 22000,
      type: 'output',
      content: `${ANSI.green}✓${ANSI.reset} Dependencies installed\n\n`,
    },
    {
      timestamp: 23000,
      type: 'output',
      content: `${ANSI.gray}Running TypeScript compiler...${ANSI.reset}\n`,
    },
    {
      timestamp: 24000,
      type: 'output',
      content: `${ANSI.dim}$${ANSI.reset} npx tsc\n`,
    },
    {
      timestamp: 25500,
      type: 'output',
      content: `${ANSI.green}✓${ANSI.reset} Build successful\n\n`,
    },
    {
      timestamp: 27000,
      type: 'output',
      content: `${ANSI.gray}Committing changes...${ANSI.reset}\n`,
    },
    {
      timestamp: 28000,
      type: 'output',
      content: `${ANSI.dim}$${ANSI.reset} git add .\n`,
    },
    {
      timestamp: 28500,
      type: 'output',
      content: `${ANSI.dim}$${ANSI.reset} git commit -m "feat: add REST API with Express"\n`,
    },
    {
      timestamp: 29500,
      type: 'output',
      content: `[main ${ANSI.yellow}a1b2c3d${ANSI.reset}] feat: add REST API with Express\n 3 files changed, 47 insertions(+)\n\n`,
    },

    // =====================================
    // Scene 3: Approval Request (30-40s)
    // =====================================
    {
      timestamp: 31000,
      type: 'output',
      content: `${ANSI.gray}Pushing to remote...${ANSI.reset}\n\n`,
    },
    {
      timestamp: 32000,
      type: 'output',
      content: `${ANSI.brightYellow}${ANSI.bold}
  ⚠️  APPROVAL REQUIRED
${ANSI.reset}`,
    },
    {
      timestamp: 32500,
      type: 'approval',
      content: '',
      metadata: {
        command: 'git push origin main',
        reason: 'Push to protected branch requires approval',
      },
    },
    {
      timestamp: 33000,
      type: 'output',
      content: `${ANSI.dim}────────────────────────────────────────────────${ANSI.reset}\n`,
    },
    {
      timestamp: 33500,
      type: 'output',
      content: `${ANSI.white}Command:${ANSI.reset}  ${ANSI.cyan}git push origin main${ANSI.reset}\n`,
    },
    {
      timestamp: 34000,
      type: 'output',
      content: `${ANSI.white}Reason:${ANSI.reset}   ${ANSI.yellow}Push to protected branch requires approval${ANSI.reset}\n`,
    },
    {
      timestamp: 34500,
      type: 'output',
      content: `${ANSI.dim}────────────────────────────────────────────────${ANSI.reset}\n\n`,
    },
    {
      timestamp: 35000,
      type: 'output',
      content: `${ANSI.gray}Waiting for mobile approval...${ANSI.reset}\n`,
    },

    // =====================================
    // Scene 4: Approval Resolution (40-50s)
    // =====================================
    {
      timestamp: 42000,
      type: 'status',
      content: 'approval_resolved',
      metadata: {
        approved: true,
        command: 'git push origin main',
      },
    },
    {
      timestamp: 42500,
      type: 'output',
      content: `\n${ANSI.green}✓${ANSI.reset} ${ANSI.brightGreen}Approved${ANSI.reset} by mobile user\n\n`,
    },
    {
      timestamp: 43000,
      type: 'output',
      content: `${ANSI.dim}$${ANSI.reset} git push origin main\n`,
    },
    {
      timestamp: 44000,
      type: 'output',
      content: `Enumerating objects: 15, done.\n`,
    },
    {
      timestamp: 44500,
      type: 'output',
      content: `Counting objects: 100% (15/15), done.\n`,
    },
    {
      timestamp: 45000,
      type: 'output',
      content: `Delta compression using up to 8 threads\n`,
    },
    {
      timestamp: 45500,
      type: 'output',
      content: `Compressing objects: 100% (10/10), done.\n`,
    },
    {
      timestamp: 46000,
      type: 'output',
      content: `Writing objects: 100% (10/10), 2.14 KiB | 2.14 MiB/s, done.\n`,
    },
    {
      timestamp: 46500,
      type: 'output',
      content: `Total 10 (delta 3), reused 0 (delta 0)\n`,
    },
    {
      timestamp: 47000,
      type: 'output',
      content: `To github.com:user/rest-api.git\n`,
    },
    {
      timestamp: 47500,
      type: 'output',
      content: `   ${ANSI.yellow}f4e5d6c${ANSI.reset}..${ANSI.green}a1b2c3d${ANSI.reset}  main -> main\n\n`,
    },
    {
      timestamp: 49000,
      type: 'output',
      content: `${ANSI.green}✓${ANSI.reset} ${ANSI.brightGreen}Successfully pushed to origin/main${ANSI.reset}\n\n`,
    },
    {
      timestamp: 50000,
      type: 'output',
      content: `${ANSI.gray}REST API created and deployed! The API is now live.${ANSI.reset}\n\n`,
    },
    {
      timestamp: 52000,
      type: 'output',
      content: `${ANSI.brightBlue}claude>${ANSI.reset} ${ANSI.dim}Ready for next task...${ANSI.reset}\n`,
    },
  ],
};

// ============================================
// Demo Session Data - Gemini CLI Session
// ============================================

/**
 * Secondary demo session: Gemini CLI for multi-agent demo
 */
const geminiCliSession: DemoSession = {
  id: 'demo-session-gemini-1',
  name: 'Gemini CLI - Database Setup',
  preset: 'single',
  agentType: 'gemini',
  duration: 30000,
  frames: [
    {
      timestamp: 0,
      type: 'agent_info',
      content: '',
      metadata: {
        sessionId: 'demo-session-gemini-1',
        agentId: 'gemini-1',
        isReadOnly: true,
      },
    },
    {
      timestamp: 100,
      type: 'output',
      content: `${ANSI.brightMagenta}${ANSI.bold}
  ╔═══════════════════════════════════════════════╗
  ║   🔮 Gemini CLI Session                       ║
  ╚═══════════════════════════════════════════════╝
${ANSI.reset}\n`,
    },
    {
      timestamp: 1000,
      type: 'output',
      content: `${ANSI.green}✓${ANSI.reset} Connected to MConnect\n`,
    },
    {
      timestamp: 2000,
      type: 'output',
      content: `${ANSI.brightMagenta}gemini>${ANSI.reset} Set up PostgreSQL database schema\n\n`,
    },
    {
      timestamp: 3000,
      type: 'output',
      content: `${ANSI.gray}Analyzing requirements...${ANSI.reset}\n`,
    },
    {
      timestamp: 5000,
      type: 'output',
      content: `${ANSI.yellow}📝 Creating:${ANSI.reset} ${ANSI.cyan}migrations/001_users.sql${ANSI.reset}\n`,
    },
    {
      timestamp: 6000,
      type: 'output',
      content: `${ANSI.dim}┌──────────────────────────────────────────────┐${ANSI.reset}\n`,
    },
    {
      timestamp: 6200,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset} ${ANSI.magenta}CREATE TABLE${ANSI.reset} users (                     ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 6400,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset}   id ${ANSI.cyan}SERIAL PRIMARY KEY${ANSI.reset},               ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 6600,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset}   email ${ANSI.cyan}VARCHAR(255) UNIQUE NOT NULL${ANSI.reset},  ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 6800,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset}   created_at ${ANSI.cyan}TIMESTAMP DEFAULT NOW()${ANSI.reset}    ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 7000,
      type: 'output',
      content: `${ANSI.dim}│${ANSI.reset} );                                           ${ANSI.dim}│${ANSI.reset}\n`,
    },
    {
      timestamp: 7200,
      type: 'output',
      content: `${ANSI.dim}└──────────────────────────────────────────────┘${ANSI.reset}\n\n`,
    },
    {
      timestamp: 8000,
      type: 'output',
      content: `${ANSI.green}✓${ANSI.reset} Migration file created\n\n`,
    },
    {
      timestamp: 10000,
      type: 'output',
      content: `${ANSI.brightMagenta}gemini>${ANSI.reset} ${ANSI.dim}Working on database setup...${ANSI.reset}\n`,
    },
  ],
};

// ============================================
// Demo Session Data - Shell Session
// ============================================

/**
 * Third demo session: Plain shell for variety
 */
const shellSession: DemoSession = {
  id: 'demo-session-shell-1',
  name: 'Shell - System Monitor',
  preset: 'single',
  agentType: 'shell',
  duration: 20000,
  frames: [
    {
      timestamp: 0,
      type: 'agent_info',
      content: '',
      metadata: {
        sessionId: 'demo-session-shell-1',
        agentId: 'shell-1',
        isReadOnly: true,
      },
    },
    {
      timestamp: 100,
      type: 'output',
      content: `${ANSI.brightGreen}${ANSI.bold}
  ╔═══════════════════════════════════════════════╗
  ║   🖥️  Shell Session                            ║
  ╚═══════════════════════════════════════════════╝
${ANSI.reset}\n`,
    },
    {
      timestamp: 1000,
      type: 'output',
      content: `${ANSI.green}$${ANSI.reset} htop\n\n`,
    },
    {
      timestamp: 2000,
      type: 'output',
      content: `${ANSI.cyan}CPU:${ANSI.reset} [${ANSI.green}||||||||${ANSI.reset}          ] 42%\n`,
    },
    {
      timestamp: 2500,
      type: 'output',
      content: `${ANSI.cyan}MEM:${ANSI.reset} [${ANSI.yellow}||||||||||||||${ANSI.reset}    ] 68%\n`,
    },
    {
      timestamp: 3000,
      type: 'output',
      content: `${ANSI.cyan}SWP:${ANSI.reset} [${ANSI.green}||${ANSI.reset}                ] 12%\n\n`,
    },
    {
      timestamp: 4000,
      type: 'output',
      content: `${ANSI.dim}  PID USER      PRI  NI  VIRT   RES   SHR S CPU% MEM%${ANSI.reset}\n`,
    },
    {
      timestamp: 4500,
      type: 'output',
      content: ` 1234 node       20   0  1.2G  256M   32M S  8.2  3.2 node index.js\n`,
    },
    {
      timestamp: 5000,
      type: 'output',
      content: ` 5678 postgres   20   0  512M  128M   16M S  2.1  1.6 postgres\n`,
    },
  ],
};

// ============================================
// Default Demo Scenario
// ============================================

/**
 * The default demo scenario for hackathon deployment
 */
export const defaultDemoScenario: DemoScenario = {
  sessions: [claudeCodeSession, geminiCliSession, shellSession],
  defaultSessionId: 'demo-session-claude-1',
};

/**
 * Get a demo session by ID
 */
export function getDemoSession(sessionId: string): DemoSession | undefined {
  return defaultDemoScenario.sessions.find((s) => s.id === sessionId);
}

/**
 * Get all demo sessions
 */
export function getAllDemoSessions(): DemoSession[] {
  return defaultDemoScenario.sessions;
}

/**
 * Get the default demo session
 */
export function getDefaultDemoSession(): DemoSession {
  return getDemoSession(defaultDemoScenario.defaultSessionId) ?? claudeCodeSession;
}
