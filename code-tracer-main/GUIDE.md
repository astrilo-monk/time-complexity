# Code Tracer — User Guide & Documentation

> A comprehensive guide to using Code Tracer, understanding its interface, leveraging AI features, setting it up locally, and deploying it.

---

## Table of Contents

- [What is Code Tracer?](#what-is-code-tracer)
- [Quick Start](#quick-start)
- [Interface Walkthrough](#interface-walkthrough)
  - [The 4-Quadrant Layout](#the-4-quadrant-layout)
  - [Header Controls](#header-controls)
- [How to Use Code Tracer](#how-to-use-code-tracer)
  - [Step 1 — Write or Paste Code](#step-1--write-or-paste-code)
  - [Step 2 — Select Language](#step-2--select-language)
  - [Step 3 — Run & Trace](#step-3--run--trace)
  - [Step 4 — Explore the Execution](#step-4--explore-the-execution)
  - [Step 5 — Toggle Beginner Mode](#step-5--toggle-beginner-mode)
- [Playback Controls](#playback-controls)
- [Understanding the Panels](#understanding-the-panels)
  - [Source Code Panel](#source-code-panel)
  - [Memory Panel](#memory-panel)
  - [Pointer Graph View](#pointer-graph-view)
  - [Explanation Panel](#explanation-panel)
  - [Bottom-Right Tabbed Panel](#bottom-right-tabbed-panel)
    - [Timeline Tab](#timeline-tab)
    - [Complexity Tab](#complexity-tab)
    - [AI Chat Tab](#ai-chat-tab)
- [AI Features](#ai-features)
  - [AI Code Explanation](#ai-code-explanation)
  - [Time Complexity Analysis](#time-complexity-analysis)
  - [AI Chat Tutor](#ai-chat-tutor)
  - [Trace Summarization](#trace-summarization)
- [Sample Programs](#sample-programs)
- [Local Development Setup](#local-development-setup)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Enabling AI Features](#enabling-ai-features)
  - [Enabling Docker Sandbox](#enabling-docker-sandbox)
- [Deployment Guide](#deployment-guide)
  - [Deploy Frontend to Vercel](#deploy-frontend-to-vercel)
  - [Deploy Backend to Render](#deploy-backend-to-render)
  - [Connecting Frontend ↔ Backend](#connecting-frontend--backend)
- [Environment Variables Reference](#environment-variables-reference)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## What is Code Tracer?

Code Tracer is a web-based tool that lets you visualize C and Java code execution in real time. Instead of reading through output logs or fighting with terminal debuggers, you paste your code, hit **Run & Trace**, and watch:

- **Which line** is about to execute
- **What every variable** holds at each step
- **The full call stack** as functions are called and return
- **Memory allocation** (stack and heap) as it happens
- **Pointer relationships** visualized as an interactive graph
- **Plain-English explanations** of each step (in Beginner Mode)
- **AI-powered insights** — complexity analysis, code explanations, and an interactive chat tutor

It's designed for students learning to program, developers debugging tricky logic, and anyone who wants to understand exactly what their code does at runtime.

---

## Quick Start

If Code Tracer is already deployed (e.g., on Vercel), just:

1. Open the app in your browser
2. Write or paste C or Java code in the editor
3. Click the **⚡ Run & Trace** button
4. Use the playback controls to step through your code
5. Click the **🧠 AI Explain** button for an AI-generated explanation
6. Switch to the **Complexity** or **AI Chat** tab for deeper analysis

That's it. No account needed, no installation required.

---

## Interface Walkthrough

### The 4-Quadrant Layout

Code Tracer uses a clean, four-panel grid layout on desktop:

```
┌──────────────────────────┬──────────────────────────┐
│                          │                          │
│    SOURCE CODE           │    MEMORY                │
│    (Monaco Editor)       │    (Stack + Heap + Graph) │
│                          │                          │
├──────────────────────────┼──────────────────────────┤
│                          │                          │
│    EXPLANATION           │    TIMELINE / COMPLEXITY  │
│    (Step Details + AI)   │    / AI CHAT  (Tabbed)   │
│                          │                          │
└──────────────────────────┴──────────────────────────┘
```

- **Top-left**: Your code editor with syntax highlighting and line-level execution tracking
- **Top-right**: Live memory visualization with Table/Graph toggle for pointer relationships
- **Bottom-left**: Step-by-step explanations (plus AI explanation banner when triggered)
- **Bottom-right**: Tabbed panel with three tabs — **Timeline**, **Complexity**, and **AI Chat**

On mobile/tablet, this collapses to a single-column scrollable layout.

### Header Controls

The header bar at the top contains:

| Control | What it does |
|---------|-------------|
| **⚡ Run & Trace** | Sends your code to the backend, compiles it, and traces its execution |
| **↺ Reset** | Jumps back to step 1 without re-running |
| **⏮ Step Back** | Go to the previous execution step |
| **▶ Play / ⏸ Pause** | Auto-play through all steps at the selected speed |
| **⏭ Step Forward** | Go to the next execution step |
| **Step Counter** | Shows `current / total` steps (e.g., `3/12`) |
| **Speed Selector** | Choose playback speed: Fast (300ms), Normal (700ms), or Slow (1200ms) |
| **🧠 AI Explain** | Trigger an AI-powered full-code explanation |
| **🎓 Beginner / Normal** | Toggle between technical and plain-English explanations |

---

## How to Use Code Tracer

### Step 1 — Write or Paste Code

The editor (top-left panel) comes pre-loaded with a sample C program. You can:

- **Edit the sample** directly
- **Paste your own code** (Ctrl+V / Cmd+V)
- **Write from scratch** — the editor supports full syntax highlighting for C and Java

The editor is powered by Monaco (the same engine as VS Code), so you get:
- Syntax highlighting
- Line numbers
- Auto-indentation
- Bracket matching

### Step 2 — Select Language

Use the **language dropdown** in the top-right corner of the editor panel to switch between:

- **C** — compiled with GCC, traced with GDB
- **Java** — compiled with javac, traced with JDB

When you switch languages, the editor automatically loads a sample program for that language and resets any previous trace data.

### Step 3 — Run & Trace

Click the **⚡ Run & Trace** button (the lightning bolt icon) in the header. The following happens:

1. Your code is sent to the backend API
2. The backend compiles it (GCC for C, javac for Java)
3. If compilation fails, you see a **red error banner** at the top showing the exact error with line numbers
4. If compilation succeeds, the debugger (GDB or JDB) traces through every breakpoint
5. The trace data (variables, stack frames, line numbers) is sent back to the frontend
6. The UI populates all four panels with the execution data
7. A **trace summary** is automatically built in the background for AI features

While tracing is in progress, you'll see a spinning indicator and the Run button becomes disabled.

### Step 4 — Explore the Execution

Once the trace completes, you can:

- **Click any step in the Timeline** (bottom-right) to jump directly to it
- **Use the playback controls** to step forward/backward or auto-play
- **Watch the active line** highlighted in the editor (amber highlight with left border)
- **See variables change** in the Memory panel (changed values are highlighted in amber)
- **Read explanations** in the Explanation panel
- **Switch to Graph view** in the Memory panel to see pointer relationships visually
- **Open the Complexity tab** to run an AI time-complexity analysis
- **Open the AI Chat tab** to ask questions about your code

### Step 5 — Toggle Beginner Mode

Click the **🎓 Beginner** button in the header to switch between:

- **Normal Mode**: Shows technical details — function name, line number, variable types, raw values
- **Beginner Mode**: Adds plain-English explanations like *"The computer is storing the number 5 in a box called x"*

---

## Playback Controls

The playback controls work like a video player for your code execution:

| Button | Icon | Action |
|--------|------|--------|
| Run & Trace | ⚡ | Compile and trace the code |
| Reset | ↺ | Go back to step 1 |
| Step Back | ⏮ | Go to the previous step |
| Play / Pause | ▶ / ⏸ | Auto-advance through steps |
| Step Forward | ⏭ | Go to the next step |
| AI Explain | 🧠 | Request an AI code explanation |

**Speed options:**
- **Fast** — 300ms per step (good for skimming)
- **Normal** — 700ms per step (good for following along)
- **Slow** — 1200ms per step (good for reading explanations)

---

## Understanding the Panels

### Source Code Panel

**Location**: Top-left

The code editor highlights the currently executing line with an amber background and left border. As you step through the trace, the editor automatically scrolls to keep the active line visible.

- The line highlighted is the line **about to execute** at the current step
- The file name is shown in the corner (`program.c` for C, `Main.java` for Java)
- The editor is **read-only** while a trace is in progress
- Full VS Code-quality editing experience with syntax highlighting

### Memory Panel

**Location**: Top-right

This panel has two view modes, toggled by the **Table** / **Graph** buttons in the panel header.

#### Table View (Default)

Shows two sections:

**Stack** — Local variables in the current function scope:
- Each variable shows its **name**, **type**, and **current value**
- Variables that **just changed** are highlighted with an amber border and glow animation
- **Pointer variables** (type `int*`, `int**`, etc.) have an amber background and show an arrow with the memory address they point to
- When a function is called, you'll see a green "Entered function() scope" indicator
- When returning from a function, you'll see a purple "Returned to function() scope" indicator

**Heap** — Dynamically allocated memory (C only):
- Shows the memory address, type, and fields of heap-allocated data
- Pointer fields that reference other heap objects are shown with amber highlighting

#### Pointer Graph View

When your code uses pointers, a **Graph** toggle button appears. Clicking it switches to an interactive graph powered by React Flow:

- Each variable is rendered as a **draggable node**, layered by pointer depth
- Pointer relationships are drawn as **directed edges** (smooth-step connections)
- **Aliases** are detected — if two pointers point to the same address, an alias badge appears
- **Changed values** glow amber on step transitions
- You can **zoom**, **pan**, and **drag nodes** to explore the relationships
- A legend at the top shows detected aliases (e.g., `p1, p2 → y`)

This is especially useful for understanding `int*`, `int**`, linked lists, and complex pointer chains.

### Explanation Panel

**Location**: Bottom-left

This panel provides context about the current execution step:

- **Function badge**: Shows which function you're in (e.g., `main()`, `add()`)
- **Line indicator**: Shows the line number being executed
- **Depth counter**: When inside nested function calls, shows the call depth
- **Code preview**: The exact source line about to execute
- **What Happens** (Beginner Mode) / **Changes** (Normal Mode): Description of what this step does
- **Variables**: All variables in the current scope, with changed ones highlighted in amber
- **Function call/return banners**: Green banner when entering a function, purple when returning
- **Recursive call detection**: Recursive calls are labeled explicitly

**AI Explanation Banner**: When you click the **🧠 AI Explain** button, a violet-bordered banner appears at the top of this panel with the AI's full-code analysis. It shows a loading spinner while the AI processes, then displays the explanation.

### Bottom-Right Tabbed Panel

**Location**: Bottom-right

This panel uses a browser-style tab bar with three tabs:

#### Timeline Tab

A scrollable list of every execution step. Each step shows:

- **Step number** in a circular badge (blue = current, gray = past/future)
- **Function name** and **line number**
- **Code preview** — the actual source line for that step
- **Call/return badges** — green "→ call" or purple "← return" indicators for function transitions

Click any step to jump directly to it. The timeline auto-scrolls to keep the current step visible.

#### Complexity Tab

AI-powered time and space complexity analysis. Click the **Analyze** button to trigger an analysis of your code. The results include:

- **Time + Space Big-O** — displayed prominently with a gradient highlight (e.g., `O(n)`, `O(n²)`)
- **Confidence Score** — color-coded badge (green ≥70%, amber ≥40%, red <40%)
- **Reasoning** — explanation of why the AI estimated each complexity
- **Dominant Operations / Allocations** — runtime operations and memory drivers
- **Optimization Ideas** — concrete suggestions for improving performance

> ⚠️ These are AI-inferred estimates based on observed execution patterns. Actual complexity may differ with different inputs.

#### AI Chat Tab

An interactive chat interface where you can ask questions about your code. The AI tutor sees:
- Your **source code**
- The **trace summary** (execution data)
- The **current step context** (line, function, variables)

Features:
- **Quick prompts**: Pre-built questions like "What does this code do?", "Explain the variables", "Why does this loop run?", "How can I optimize this?"
- **Free-form questions**: Type any question about the code, variables, loops, or concepts
- **Chat history**: The AI maintains context across messages (last 6 messages)
- **Typing indicator**: Animated dots while the AI is processing
- **Clear chat**: Trash icon to reset the conversation

---

## AI Features

Code Tracer includes AI features powered by **Groq** (using the **Llama 3.3 70B** model). These features require a `GROQ_API_KEY` to be set on the backend. Without it, all tracing features still work — only the AI features are disabled.

### AI Code Explanation

**How to use**: Click the **🧠** (brain) button in the playback controls.

The AI analyzes your entire code along with the trace data and produces a beginner-friendly explanation covering:
- What the code does overall
- How variables change as the program runs
- Loop and recursion behavior
- References to specific line numbers

The explanation appears as a violet banner at the top of the Explanation Panel.

### Time + Space Complexity Analysis

**How to use**: Switch to the **Complexity** tab in the bottom-right panel and click **Analyze**.

The AI examines your code and trace data to estimate:
- Big-O time complexity (e.g., `O(n)`, `O(n log n)`, `O(n²)`)
- Big-O space complexity (e.g., `O(1)`, `O(n)`)
- Confidence level (0–100%)
- Reasoning behind each estimate
- Which operations/allocations dominate
- Possible optimizations

### AI Chat Tutor

**How to use**: Switch to the **AI Chat** tab in the bottom-right panel.

Ask any question about your code. The AI has full context:
- The source code itself
- A compressed trace summary
- The current step's line, function, and variable values

Good questions to ask:
- "What does this code do?"
- "Why does variable x have this value at step 5?"
- "How can I make this faster?"
- "Explain what happens in the for loop"
- "What would happen if I changed the input?"

### Trace Summarization

When you run code successfully, the frontend automatically sends the trace steps to `/api/ai/summarize` in the background. This builds a compressed summary that all AI features use for context — keeping token usage efficient without losing important execution details.

---

## Sample Programs

Code Tracer comes with built-in sample programs for each language:

### C Sample

```c
#include <stdio.h>

int add(int a, int b) {
    int sum = a + b;
    return sum;
}

int multiply(int a, int b) {
    int product = a * b;
    return product;
}

int main() {
    int x = 5;
    int y = 3;
    
    int sum = add(x, y);
    int prod = multiply(x, y);
    int total = add(sum, prod);
    
    printf("Result: %d\n", total);
    return 0;
}
```

### Java Sample

```java
class Main {
    static int add(int a, int b) {
        int sum = a + b;
        return sum;
    }

    static int multiply(int a, int b) {
        int product = a * b;
        return product;
    }

    public static void main(String[] args) {
        int x = 5;
        int y = 3;

        int sum = add(x, y);
        int prod = multiply(x, y);
        int total = add(sum, prod);

        System.out.println("Result: " + total);
    }
}
```

### C Pointer Example (for Graph View)

```c
#include <stdio.h>

int main() {
    int x = 48;
    int y = 11;
    int *p1 = &y;
    int *p2 = &y;
    int **pp = &p1;
    printf("%d\n", **pp);
    return 0;
}
```

This example demonstrates the Pointer Graph view — switch to **Graph** in the Memory panel to see `p1` and `p2` pointing to `y`, `pp` pointing to `p1`, and the alias detection badge.

---

## Local Development Setup

### Prerequisites

| Tool | Required For | Installation |
|------|-------------|-------------|
| **Node.js ≥ 18** | Frontend | [nodejs.org](https://nodejs.org/) |
| **Yarn** or **npm** | Frontend | Comes with Node.js |
| **Python ≥ 3.10** | Backend | [python.org](https://www.python.org/) |
| **GCC + GDB** | C tracing | Linux: `sudo apt install gcc gdb` / Windows: [MSYS2](https://www.msys2.org/) / macOS: `brew install gcc gdb` |
| **JDK ≥ 11** | Java tracing | [adoptium.net](https://adoptium.net/) — ensure `javac` and `jdb` are on PATH |
| **Docker** | Sandbox mode (optional) | [docker.com](https://www.docker.com/) |
| **Groq API Key** | AI features (optional) | [console.groq.com](https://console.groq.com/) |

### Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv

# Windows:
.venv\Scripts\activate

# macOS / Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the development server
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

The backend starts at `http://localhost:8000`. Verify with:
```bash
curl http://localhost:8000/health
# → {"status": "ok"}
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
yarn install
# or: npm install

# Start the dev server
yarn start
# or: npm start
```

The frontend opens at `http://localhost:3000` and auto-connects to the backend at `http://localhost:8000`.

### Enabling AI Features

1. Get a free API key from [Groq Console](https://console.groq.com/)
2. Create or edit `backend/.env`:
   ```
   GROQ_API_KEY=gsk_your_key_here
   ```
3. Restart the backend server

The AI features (Chat, Complexity, Explain) will now be active. Without the key, tracing still works perfectly — only AI endpoints return a "not configured" message.

### Enabling Docker Sandbox

For production-grade isolation:

1. Build the sandbox image:
   ```bash
   cd backend/sandbox
   docker build -t code-tracer-sandbox .
   ```
2. Set in `backend/.env`:
   ```
   SANDBOX_ENABLED=true
   ```
3. Restart the backend

Without Docker, the backend uses local GCC/GDB and javac/jdb directly (functional for development, but not sandboxed).

---

## Deployment Guide

### Deploy Frontend to Vercel

1. Push your repo to GitHub
2. Go to [vercel.com](https://vercel.com/) → **New Project** → Import your repo
3. Set the **Root Directory** to `frontend`
4. Set the environment variable:
   - `REACT_APP_API_URL` = `https://your-backend-url.onrender.com/api`
5. Deploy

### Deploy Backend to Render

1. Go to [render.com](https://render.com/) → **New** → **Web Service**
2. Connect your GitHub repo
3. Set:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
4. Add environment variables:
   - `GROQ_API_KEY` = your Groq API key
   - `CORS_ORIGINS` = `https://your-app.vercel.app`
   - `SANDBOX_ENABLED` = `false` (Render doesn't support Docker-in-Docker on free tier)
5. Deploy

### Connecting Frontend ↔ Backend

After deploying both:

1. Copy your Render backend URL (e.g., `https://code-tracer-api.onrender.com`)
2. In Vercel, set `REACT_APP_API_URL` = `https://code-tracer-api.onrender.com/api`
3. In Render, set `CORS_ORIGINS` = `https://your-app.vercel.app`
4. Redeploy both services

The CORS middleware also auto-allows any `*.vercel.app` origin via regex matching.

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Default | Required | Description |
|---|---|---|---|
| `GROQ_API_KEY` | — | No | Groq API key — enables AI Chat, Complexity, and Explain features |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | No | Which Groq model to use for AI features |
| `SANDBOX_ENABLED` | `false` | No | Set to `true` to run code inside Docker containers |
| `SANDBOX_IMAGE` | `code-tracer-sandbox` | No | Docker image name for the sandbox |
| `CONTAINER_TIMEOUT` | `120` | No | Max seconds a sandbox container can run |
| `DOCKER_MEMORY` | `128m` | No | Memory limit per container |
| `DOCKER_CPUS` | `0.5` | No | CPU limit per container |
| `DOCKER_PIDS_LIMIT` | `50` | No | Max processes per container |
| `MAX_CONCURRENT` | `3` | No | Max simultaneous sandbox containers |
| `RATE_LIMIT` | `10` | No | Max API requests per IP per window |
| `RATE_WINDOW` | `60` | No | Rate limit window in seconds |
| `CORS_ORIGINS` | — | No | Comma-separated allowed CORS origins |
| `MONGO_URL` | — | No | MongoDB connection string (optional persistence) |
| `SECCOMP_PROFILE` | `sandbox/seccomp-profile.json` | No | Path to seccomp syscall whitelist |

### Frontend

| Variable | Default | Description |
|---|---|---|
| `REACT_APP_API_URL` | `http://127.0.0.1:8000/api` | Backend API base URL |

---

## API Reference

### `POST /api/run`

Compile and trace code.

**Request Body:**
```json
{
  "code": "int main() { return 0; }",
  "language": "c"
}
```

**Response:**
```json
{
  "steps": [
    {
      "step": 0,
      "line": 3,
      "func": "main",
      "variables": [{"name": "x", "value": "5", "type": "int"}],
      "stack_frames": [{"level": "0", "func": "main", "line": 3, "file": "program.c"}],
      "heap": [],
      "stdout": ""
    }
  ],
  "final_output": "Result: 23\n",
  "error": null,
  "compilation_error": null
}
```

### `POST /api/ai/chat`

Ask the AI tutor a question.

**Request Body:**
```json
{
  "code": "...",
  "language": "c",
  "trace_summary": {...},
  "question": "What does this code do?",
  "step_context": {"line": 5, "func": "main", "variables": [...]},
  "chat_history": [{"role": "user", "content": "..."}]
}
```

### `POST /api/ai/complexity`

Analyze time complexity.

**Request Body:**
```json
{
  "code": "...",
  "language": "c",
  "trace_summary": {...}
}
```

**Response:**
```json
{
  "estimated_complexity": "O(n)",
  "confidence": 0.85,
  "reasoning": "The function iterates through the array once...",
  "dominant_operations": ["Single for-loop iterating n times"],
  "possible_optimizations": ["Consider binary search if array is sorted"]
}
```

### `POST /api/ai/explain`

Get a full code explanation.

### `POST /api/ai/summarize`

Build a compressed trace summary for AI consumption.

### `GET /health`

Health check — returns `{"status": "ok"}`.

---

## Troubleshooting

### "Timeout 120000" error
The frontend couldn't reach the backend within 120 seconds. This typically happens when:
- The backend is still cold-starting (especially on Render's free tier — first request can take 30–60s)
- Your code is very complex or contains loops that execute more than ~150-250 steps, causing the tracer to exceed the timeout while generating the trace.
- **Fix**: If cold-starting, wait a few seconds and run again. If it's a complex trace, consider simplifying the inputs or iterations.

### Compilation errors show in a red banner
This means your code has syntax errors. The banner shows the exact GCC or javac error with line numbers. Fix the code and re-run.

### "AI service is not configured"
The `GROQ_API_KEY` environment variable is not set on the backend. Tracing still works — only AI features (Chat, Complexity, Explain) are disabled.

### "Server busy — X traces running"
The backend has hit its concurrency limit (`MAX_CONCURRENT`, default 3). Wait a few seconds and try again.

### "Docker is not available"
Sandbox mode is enabled (`SANDBOX_ENABLED=true`) but Docker is not installed or not running. Either install Docker or set `SANDBOX_ENABLED=false` in `backend/.env`.

### Java tracing produces no steps
- Ensure your code has `public static void main(String[] args)`
- The class name must match the file name (use `class Main` for simplicity)
- Avoid very complex control flow in the initial version

### GDB not found
- **Windows**: Install MSYS2 and add `C:\msys64\mingw64\bin` to PATH
- **macOS**: `brew install gdb` (may need code signing)
- **Linux**: `sudo apt install gdb`

### Variables show "?" values
GDB sometimes can't read optimized-out variables. The code is compiled with `-g -O0` to minimize this, but certain compiler-generated temporaries may still show `?`.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Test locally (both frontend and backend)
5. Commit with conventional commits (`git commit -m "feat: add my feature"`)
6. Push and open a Pull Request

### Code Style
- **Frontend**: React functional components with hooks, Tailwind CSS, Phosphor Icons
- **Backend**: Python with type hints, FastAPI async handlers, structured logging
- **State**: Zustand store (`traceStore.js`) for all shared state
