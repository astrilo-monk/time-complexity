<p align="center">
  <img src="https://img.shields.io/badge/C-00599C?style=for-the-badge&logo=c&logoColor=white" alt="C" />
  <img src="https://img.shields.io/badge/Java-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white" alt="Java" />
  <img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Groq_AI-F55036?style=for-the-badge&logo=ai&logoColor=white" alt="Groq AI" />
</p>

# Code Tracer

A browser-based visualization tool for C and Java code execution, providing step-by-step tracing of variables, memory allocations, call stacks, and AI-assisted analysis.

---

## Features

### Core Tracing
- **Step-through Execution**: Iterate through program execution sequentially. Supports adjustable playback speeds.
- **Memory Visualization**: Real-time inspection of stack variables and heap allocations. State mutations are highlighted during transitions.
- **Call Stack Tracing**: Visualization of function invocation, returns, and recursion depth, with distinct scope boundary indicators.
- **Pointer Graph**: Toggle between tabular representation and an interactive graph (React Flow) for evaluating pointer indirection, referencing, and aliasing.

### AI Integration (Groq + Llama 3.3 70B)
- **Code Explanation**: Automated analysis of program behavior, variable state transitions, and control flow semantics.
- **Complexity Analysis**: Inference of Big-O time and space complexity, including confidence scoring, dominant operations, and optimization strategies.
- **Interactive Tutor**: Context-aware chat interface utilizing source code, trace summaries, and active execution state.

### Execution Modes
- **Normal Mode**: Standard technical trace visualization.
- **Beginner Mode**: Plain-text translation of execution semantics for educational use.

### Interface
- **Responsive Layout**: A 4-quadrant grid interface for desktop environments, adapting to a single-column view for mobile devices.

---

## Architecture

```text
+--------------------------+--------------------------+
|                          |                          |
|  SOURCE CODE             |  MEMORY                  |
|  (Monaco Editor)         |  (Stack + Heap + Graph)  |
|                          |                          |
+--------------------------+--------------------------+
|                          |                          |
|  EXPLANATION             |  TIMELINE / COMPLEXITY   |
|  (Step Details + AI)     |  / AI CHAT (Tabbed)      |
|                          |                          |
+--------------------------+--------------------------+
                           | REST API
+--------------------------v--------------------------+
|  Backend (FastAPI)                                  |
|  +---------------+ +---------------+ +------------+ |
|  | /api/run      | | /api/ai/chat  | | /api/ai/   | |
|  | Compile+Trace | | AI Tutor      | | complexity | |
|  +---------------+ +---------------+ +------------+ |
|  | Docker Sandbox| | /api/ai/      | | /api/ai/   | |
|  | (Isolated)    | | explain       | | summarize  | |
|  +-------+-------+ +-------+-------+ +------------+ |
|          |                 |                        |
|  GCC/GDB (C)               |                        |
|  javac/jdb (Java)          Groq API                 |
+-----------------------------------------------------+
```

---

## Technology Stack

### Frontend
| Component | Technology |
|---|---|
| Core Framework | React 19 |
| Code Editor | Monaco Editor |
| State Management | Zustand |
| Styling | Tailwind CSS |
| Graph Visualization | React Flow (@xyflow/react) |
| UI Primitives | Radix UI |
| HTTP Client | Axios |

### Backend
| Component | Technology |
|---|---|
| API Framework | FastAPI |
| ASGI Server | Uvicorn |
| Debugger Interface | PyGDBMI |
| LLM Client | OpenAI SDK (Groq endpoint) |
| Isolation | Docker |
| C Toolchain | GCC, GDB |
| Java Toolchain | OpenJDK (javac, jdb) |

---

## Setup Instructions

### Prerequisites
- Node.js >= 18, Yarn or npm
- Python >= 3.10
- GCC and GDB (Linux/macOS/MSYS2)
- JDK >= 11 (javac and jdb on PATH)
- Docker (Required for sandbox execution)
- Groq API Key (Required for AI endpoints)

### Backend Configuration
```bash
cd backend
python -m venv .venv

# Windows: .venv\Scripts\activate
# Unix: source .venv/bin/activate

pip install -r requirements.txt

# Create .env file:
# GROQ_API_KEY=<key>
# SANDBOX_ENABLED=true

uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Configuration
```bash
cd frontend
yarn install
yarn start
```
The client initializes at `http://localhost:3000` and interfaces with the backend at `http://localhost:8000`.

---

## Security Model

When `SANDBOX_ENABLED=true`, code is compiled and traced within an ephemeral Docker container. Constraints applied:

| Vector | Constraint |
|---|---|
| Network | Disabled (`--network none`) |
| Memory | 128MB hard limit, no swap |
| CPU | 0.5 logical cores |
| Filesystem | Read-only rootfs, 32MB tmpfs scratch space |
| Capabilities | All dropped, `no-new-privileges` enforced |
| Process | Maximum 50 PIDs |
| Syscalls | Seccomp whitelisting (permits `SYS_PTRACE`) |

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/run` | POST | Submits code for compilation and trace generation |
| `/api/ai/chat` | POST | Context-aware LLM query |
| `/api/ai/complexity` | POST | Big-O analysis |
| `/api/ai/explain` | POST | Comprehensive code review |
| `/api/ai/summarize` | POST | Trace compression payload generator |
| `/health` | GET | Service heartbeat |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | - | Groq API authentication token |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | LLM model identifier |
| `SANDBOX_ENABLED` | `false` | Toggles Docker containerization |
| `SANDBOX_IMAGE` | `code-tracer-sandbox` | Target Docker image |
| `CONTAINER_TIMEOUT` | `120` | Maximum execution duration (seconds) |
| `MAX_CONCURRENT` | `3` | Maximum concurrent sandbox processes |
| `RATE_LIMIT` | `10` | Allowed requests per IP within the rate window |
| `RATE_WINDOW` | `60` | Rate limiting timeframe (seconds) |
| `CORS_ORIGINS` | - | Allowed CORS domains |

### Frontend
| Variable | Default | Description |
|---|---|---|
| `REACT_APP_API_URL` | `http://127.0.0.1:8000/api` | Backend service base URL |

---

## Project Structure

```text
code-tracer/
├── backend/
│   ├── server.py                  # FastAPI app (routes, sandbox, local tracing)
│   ├── requirements.txt           # Python dependencies
│   ├── Dockerfile                 # Production container
│   ├── .env                       # Environment configuration
│   ├── services/
│   │   └── ai/
│   │       ├── provider.py        # Groq client
│   │       ├── prompts.py         # System prompt templates
│   │       ├── chat.py            # Chat tutor logic
│   │       ├── complexity.py      # Time complexity analysis
│   │       ├── explain.py         # Code explanation
│   │       └── summary.py         # Trace summarization
│   └── sandbox/
│       ├── Dockerfile             # Hardened sandbox image
│       ├── trace_runner.py        # Trace orchestrator
│       └── seccomp-profile.json   # Syscall whitelist
├── frontend/
│   ├── src/
│   │   ├── App.js                 # Application shell (4-quadrant layout)
│   │   ├── components/            # UI Components (Editor, Chat, Graph, etc.)
│   │   ├── store/
│   │   │   └── traceStore.js      # Global state (Zustand)
│   │   └── lib/                   # Utilities (Diffing, Graph generation)
│   └── package.json
├── GUIDE.md                       # User documentation
└── README.md
```

---

## Current Limitations

- **Language Support**: Currently restricted to C and Java.
- **Execution Constraints**: Hard timeout enforced at ~120 seconds. Traces are capped at 250 operational steps to prevent buffer overflows during infinite loops or deep recursion.
- **Persistence**: Trace data is maintained exclusively in client-side memory and drops on session refresh.
- **AI Dependencies**: Operations requiring the `/api/ai/*` namespace will gracefully fail if `GROQ_API_KEY` is omitted. Tracing functionality remains fully operational.

---

## License

Available under the MIT License.
