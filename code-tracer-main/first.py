from fastapi import FastAPI, APIRouter
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import json
import tempfile
import subprocess
import asyncio
import shutil
import re
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
from pygdbmi.gdbcontroller import GdbController

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB is optional — only connect if MONGO_URL is set
mongo_url = os.environ.get('MONGO_URL', '')
if mongo_url:
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'ctrace')]
else:
    client = None
    db = None

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- API Endpoints ---
MAX_STEPS = 250

class RunCodeRequest(BaseModel):
    code: str

    # Supported values: "c" (default) and "java"
    language: str = "c"


def compile_c_code(code: str, tmpdir: str):
    src_path = os.path.join(tmpdir, "program.c")
    exe_name = "program.exe" if os.name == "nt" else "program"
    bin_path = os.path.join(tmpdir, exe_name)
    with open(src_path, "w") as f:
        f.write(code)
    result = subprocess.run(
        ["gcc", "-g", "-O0", "-o", bin_path, src_path],
        capture_output=True, text=True, timeout=15
    )
    if result.returncode != 0:
        return None, result.stderr
    return {"language": "c", "bin_path": bin_path, "source_file": "program.c"}, None


def detect_java_main_class(code: str) -> Optional[str]:
    """Best-effort detection of the class that defines main()."""
    class_pattern = re.compile(r"(?:public\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)\b")
    main_pattern = re.compile(r"public\s+static\s+void\s+main\s*\(")

    classes = []
    for match in class_pattern.finditer(code):
        class_name = match.group(1)
        open_brace = code.find("{", match.end())
        if open_brace == -1:
            continue

        # Match braces to keep the search inside this class body.
        depth = 0
        close_brace = None
        for idx in range(open_brace, len(code)):
            ch = code[idx]
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    close_brace = idx
                    break

        if close_brace is None:
            continue

        body = code[open_brace + 1:close_brace]
        classes.append((class_name, body, match.group(0)))

    for class_name, body, _decl in classes:
        if main_pattern.search(body):
            return class_name

    for class_name, _body, decl in classes:
        if decl.strip().startswith("public class"):
            return class_name

    if classes:
        return classes[0][0]

    return None


def compile_java_code(code: str, tmpdir: str):
    if not re.search(r"public\s+static\s+void\s+main\s*\(", code):
        return None, "Java tracing currently requires a main method: public static void main(String[] args)"

    main_class = detect_java_main_class(code)
    if not main_class:
        return None, "Could not detect a Java class name. Define a class like: class Main { ... }"

    src_name = f"{main_class}.java"
    src_path = os.path.join(tmpdir, src_name)
    with open(src_path, "w") as f:
        f.write(code)

    javac_path = shutil.which("javac")
    if not javac_path:
        return None, "javac not found. Install a JDK and ensure javac is on PATH."

    result = subprocess.run(
        [javac_path, "-g", src_path],
        capture_output=True,
        text=True,
        timeout=15,
    )
    if result.returncode != 0:
        return None, result.stderr or result.stdout

    return {
        "language": "java",
        "main_class": main_class,
        "source_file": src_name,
        "classpath": tmpdir,
    }, None


def compile_code(code: str, tmpdir: str, language: str):
    lang = (language or "c").strip().lower()
    if lang == "java":
        return compile_java_code(code, tmpdir)
    if lang != "c":
        return None, f"Unsupported language: {language}. Supported languages are: c, java"
    return compile_c_code(code, tmpdir)


def resolve_gdb_executable() -> Optional[str]:
    """Resolve a usable GDB executable path across platforms.

    Priority:
    1) GDB_PATH env var
    2) PATH lookup
    3) common Windows install paths
    """
    gdb_from_env = os.environ.get("GDB_PATH", "").strip()
    if gdb_from_env and os.path.exists(gdb_from_env):
        return gdb_from_env

    for candidate in ("gdb", "gdb.exe"):
        resolved = shutil.which(candidate)
        if resolved:
            return resolved

    if os.name == "nt":
        common_windows_paths = [
            r"C:\msys64\ucrt64\bin\gdb.exe",
            r"C:\msys64\mingw64\bin\gdb.exe",
            r"C:\mingw64\bin\gdb.exe",
        ]
        for candidate in common_windows_paths:
            if os.path.exists(candidate):
                return candidate

    return None


def infer_type(value):
    if not value:
        return "unknown"
    if value.startswith("0x"):
        return "pointer"
    if value.startswith("{"):
        return "struct"
    if value.startswith('"') or value.startswith("'"):
        return "char"
    try:
        int(value)
        return "int"
    except ValueError:
        pass
    try:
        float(value)
        return "float"
    except ValueError:
        pass
    return "auto"


def run_gdb_trace(bin_path: str, code: str):
    """Breakpoint-based tracing — fast even for recursive code."""
    steps = []
    stdout_buffer = ""
    source_lines = code.split('\n')

    gdb_path = resolve_gdb_executable()
    if not gdb_path:
        return [], (
            "Failed to start GDB: executable could not be resolved. "
            "Install GDB and ensure it is on PATH, or set GDB_PATH in backend/.env."
        )

    try:
        gdbmi = GdbController(command=[gdb_path, "--nx", "--quiet", "--interpreter=mi3", bin_path])
    except Exception:
        try:
            gdbmi = GdbController(command=[gdb_path, "--nx", "--quiet", "--interpreter=mi2", bin_path])
        except Exception as e:
            return [], f"Failed to start GDB: {str(e)}"

    def is_exit(responses):
        for r in responses:
            msg = r.get("message", "")
            if r.get("type") == "notify" and "exited" in msg:
                return True
            if r.get("type") == "result" and msg == "error":
                return True
            p = r.get("payload", {})
            if isinstance(p, dict) and p.get("reason", "").startswith("exited"):
                return True
        return False

    def grab_stdout(responses):
        return "".join(
            r.get("payload", "") for r in responses
            if r.get("type") == "target" and r.get("message") == "target-stream-output"
        )

    def frame_info():
        try:
            for r in gdbmi.write("-stack-info-frame", timeout_sec=2):
                if r.get("type") == "result" and r.get("message") == "done":
                    f = r.get("payload", {}).get("frame", {})
                    return int(f.get("line", 0)), f.get("func", "??"), f.get("file", "")
        except Exception:
            pass
        return 0, "??", ""

    def full_stack():
        frames = []
        try:
            for r in gdbmi.write("-stack-list-frames", timeout_sec=2):
                if r.get("type") == "result" and r.get("message") == "done":
                    for fr in r.get("payload", {}).get("stack", []):
                        fd = fr.get("frame", fr) if isinstance(fr, dict) else fr
                        frames.append({
                            "level": fd.get("level", "0"),
                            "func": fd.get("func", "??"),
                            "line": int(fd.get("line", 0)),
                            "file": fd.get("file", ""),
                        })
        except Exception:
            pass
        return frames

    def local_vars():
        variables = []
        try:
            for r in gdbmi.write("-stack-list-variables --all-values", timeout_sec=2):
                if r.get("type") == "result" and r.get("message") == "done":
                    for v in r.get("payload", {}).get("variables", []):
                        nm = v.get("name", "")
                        val = v.get("value", "")
                        variables.append({
                            "name": nm, "value": val,
                            "type": "pointer" if (val and val.startswith("0x")) else infer_type(val),
                        })
        except Exception:
            pass
        return variables

    try:
        # Set breakpoints on every non-trivial source line
        for i, line_text in enumerate(source_lines, 1):
            stripped = line_text.strip()
            if stripped and not stripped.startswith('//') and not stripped.startswith('#') and stripped not in ('{', '}', '};', ''):
                try:
                    gdbmi.write(f"-break-insert program.c:{i}", timeout_sec=1)
                except Exception:
                    pass

        # Run program — stops at first breakpoint
        resps = gdbmi.write("-exec-run", timeout_sec=5)
        if is_exit(resps):
            return steps, None

        MAX_STEP_TIME = 0  # track total time
        import time
        start_time = time.time()

        for step_num in range(MAX_STEPS):
            # Hard time limit
            if time.time() - start_time > 115:
                break

            line, func, file = frame_info()
            if line == 0:
                break

            # Skip non-user files
            if file and "program.c" not in file:
                resps = gdbmi.write("-exec-continue", timeout_sec=3)
                stdout_buffer += grab_stdout(resps)
                if is_exit(resps):
                    break
                continue

            # Get stack (fast) and variables
            stack = full_stack()
            variables = local_vars()

            heap = []
            for v in variables:
                if v["type"] == "pointer" and v["value"] not in ("0x0", ""):
                    heap.append({
                        "address": v["value"], "type": "allocated",
                        "var_name": v["name"],
                        "fields": [{"name": v["name"], "value": v["value"], "type": "pointer"}],
                        "pointer_to": None,
                    })

            steps.append({
                "step": len(steps),
                "line": line,
                "func": func,
                "variables": variables,
                "stack_frames": stack,
                "heap": heap,
                "stdout": stdout_buffer,
            })

            # Continue to next breakpoint
            resps = gdbmi.write("-exec-continue", timeout_sec=3)
            stdout_buffer += grab_stdout(resps)
            if is_exit(resps):
                break

        return steps, None
    except Exception as e:
        logger.error(f"GDB trace error: {str(e)}")
        return steps, str(e)
    finally:
        try:
            gdbmi.exit()
        except Exception:
            pass


def run_jdb_trace(classpath: str, main_class: str, source_file: str):
    """Best-effort Java tracing using jdb command scripting."""
    jdb_path = shutil.which("jdb")
    if not jdb_path:
        return [], "jdb not found. Install a JDK and ensure jdb is on PATH."

    source_lines = []
    try:
        source_path = Path(classpath) / source_file
        source_lines = source_path.read_text(encoding="utf-8").splitlines()
    except Exception:
        source_lines = []

    breakpoint_lines = []
    for line_number, line_text in enumerate(source_lines, 1):
        stripped = line_text.strip()
        if not stripped:
            continue
        if stripped.startswith("//") or stripped.startswith("/*") or stripped.startswith("*"):
            continue
        if stripped in {"{", "}", "};"}:
            continue
        if stripped.startswith("import ") or stripped.startswith("package "):
            continue
        if any(keyword in stripped for keyword in (" class ", " interface ", " enum ")):
            continue
        is_executable = (
            stripped.endswith(";")
            or stripped.startswith("if ")
            or stripped.startswith("if(")
            or stripped.startswith("for ")
            or stripped.startswith("for(")
            or stripped.startswith("while ")
            or stripped.startswith("while(")
            or stripped.startswith("switch ")
            or stripped.startswith("switch(")
            or stripped.startswith("do")
            or stripped.startswith("return ")
            or stripped.startswith("throw ")
        )
        if not is_executable:
            continue
        breakpoint_lines.append(line_number)

    commands = []
    for line_number in breakpoint_lines:
        commands.append(f"stop at {main_class}:{line_number}")
    commands.append("stop in " + main_class + ".main")
    commands.append("run")

    for _ in range(MAX_STEPS):
        commands.extend(["threads", "thread 1", "where", "locals", "cont"])
    commands.append("quit")

    try:
        proc = subprocess.run(
            [jdb_path, "-sourcepath", classpath, "-classpath", classpath, main_class],
            input="\n".join(commands) + "\n",
            capture_output=True,
            text=True,
            timeout=22,
        )
    except subprocess.TimeoutExpired:
        return [], "Java trace timed out."
    except Exception as e:
        return [], f"Failed to run jdb: {str(e)}"

    output = (proc.stdout or "") + "\n" + (proc.stderr or "")
    if "NoClassDefFoundError" in output or "ClassNotFoundException" in output:
        return [], "Java class loading failed. Ensure the class name matches the file name."

    breakpoint_re = re.compile(r'"thread=main",\s+([^,]+),\s+line=(\d+)')
    frame_re = re.compile(r'\[(\d+)\]\s+([A-Za-z0-9_.$<>]+)\.([A-Za-z0-9_<>$]+)\s+\(([^:()]+):(\d+)\)')
    local_value_re = re.compile(r'^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$')

    steps = []
    chunks = output.split('Breakpoint hit:')
    for chunk in chunks[1:]:
        if len(steps) >= MAX_STEPS:
            break

        chunk_lines = [line for line in chunk.splitlines() if line.strip()]
        if not chunk_lines:
            continue

        current_line = None
        header_line = chunk_lines[0]
        header_match = breakpoint_re.search(header_line)
        if header_match:
            current_line = int(header_match.group(2))
        else:
            for line in chunk_lines[:4]:
                header_match = breakpoint_re.search(line)
                if header_match:
                    current_line = int(header_match.group(2))
                    break

        stack_frames = []
        for chunk_line in chunk_lines:
            frame_match = frame_re.search(chunk_line.strip())
            if frame_match:
                stack_frames.append({
                    "level": frame_match.group(1),
                    "func": f"{frame_match.group(2)}.{frame_match.group(3)}",
                    "file": frame_match.group(4),
                    "line": int(frame_match.group(5)),
                })

        if not stack_frames:
            continue

        if current_line is None:
            current_line = stack_frames[0]["line"]

        variables = []
        for chunk_line in chunk_lines:
            local_match = local_value_re.match(chunk_line.strip())
            if not local_match:
                continue
            name = local_match.group(1)
            if name in ("Method arguments", "Local variables"):
                continue
            value = local_match.group(2)
            variables.append({
                "name": name,
                "value": value,
                "type": infer_type(value),
            })

        steps.append({
            "step": len(steps),
            "line": current_line,
            "func": stack_frames[0]["func"],
            "variables": variables,
            "stack_frames": stack_frames,
            "heap": [],
            "stdout": "",
        })

    if not steps:
        return [], "No Java steps collected. Try code with simpler control flow and a standard main method."

    return steps, None


def quick_heap_read(gdbmi, var_name, address, depth=0, visited=None):
    """Quickly read a heap node — limited depth."""
    if visited is None:
        visited = set()
    if depth > 3 or address in visited or address == "0x0":
        return []
    visited.add(address)

    items = []
    try:
        tag = f"h{var_name.replace('->', '_').replace('*', '')}_{depth}"
        resp = gdbmi.write(f"-var-create {tag} * *{var_name}", timeout_sec=2)

        node_type = ""
        num_children = 0
        for r in resp:
            if r.get("type") == "result" and r.get("message") == "done":
                p = r.get("payload", {})
                node_type = p.get("type", "")
                num_children = int(p.get("numchild", "0"))

        node = {"address": address, "type": node_type, "var_name": var_name, "fields": [], "pointer_to": None}

        if num_children > 0:
            ch_resp = gdbmi.write(f"-var-list-children {tag}", timeout_sec=2)
            for cr in ch_resp:
                if cr.get("type") == "result" and cr.get("message") == "done":
                    for child in cr.get("payload", {}).get("children", []):
                        cd = child.get("child", child) if isinstance(child, dict) else child
                        fname = cd.get("exp", "")
                        fval = cd.get("value", "")
                        ftype = cd.get("type", "")
                        node["fields"].append({"name": fname, "value": fval, "type": ftype})
                        if "*" in ftype and fval.startswith("0x") and fval != "0x0":
                            node["pointer_to"] = fval
                            sub = quick_heap_read(gdbmi, f"{var_name}->{fname}", fval, depth + 1, visited)
                            items.extend(sub)

        items.insert(0, node)
        gdbmi.write(f"-var-delete {tag}", timeout_sec=1)
    except Exception:
        pass

    return items


# --- API Endpoints ---

@api_router.get("/")
async def root():
    return {"message": "C Trace API is running"}

@api_router.post("/run")
async def run_code(request: RunCodeRequest):
    """Compile and trace C or Java code."""
    code = request.code.strip()
    language = (request.language or "c").strip().lower()
    logger.info(f"Run request received ({len(code)} chars, language={language})")
    if not code:
        return {"error": "No code provided", "steps": [], "compilation_error": None}

    with tempfile.TemporaryDirectory() as tmpdir:
        artifact, compile_error = compile_code(code, tmpdir, language)
        if compile_error:
            logger.info(f"Compilation failed: {compile_error[:200]}")
            return {"error": None, "steps": [], "compilation_error": compile_error}

        loop = asyncio.get_event_loop()
        try:
            if language == "java":
                steps, trace_error = await asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        run_jdb_trace,
                        artifact["classpath"],
                        artifact["main_class"],
                        artifact["source_file"],
                    ),
                    timeout=120,
                )
            else:
                steps, trace_error = await asyncio.wait_for(
                    loop.run_in_executor(None, run_gdb_trace, artifact["bin_path"], code),
                    timeout=120,
                )
        except asyncio.TimeoutError:
            # Kill any lingering GDB processes (Windows-compatible)
            if os.name == 'nt':
                subprocess.run(["taskkill", "/F", "/IM", "gdb.exe"], capture_output=True)
                subprocess.run(["taskkill", "/F", "/IM", "jdb.exe"], capture_output=True)
                subprocess.run(["taskkill", "/F", "/IM", "java.exe"], capture_output=True)
            else:
                subprocess.run(["pkill", "-f", "gdb.*program"], capture_output=True)
                subprocess.run(["pkill", "-f", "jdb"], capture_output=True)
                subprocess.run(["pkill", "-f", "java"], capture_output=True)
            return {"error": "Trace timed out (code may be too complex or recursive). Partial results shown.", "steps": [], "compilation_error": None}
        except Exception as e:
            logger.error(f"Unexpected trace error: {type(e).__name__}: {e}")
            return {"error": str(e), "steps": [], "compilation_error": None}

        logger.info(f"Trace complete: {len(steps)} steps, error={trace_error}")
        return {"error": trace_error, "steps": steps, "compilation_error": None}


# Include router
app.include_router(api_router)

# CORS — allow Vercel frontend + localhost for dev
_cors_env = os.environ.get('CORS_ORIGINS', '').strip()
_cors_origins = [o.strip(


    
) for o in _cors_env.split(',') if o.strip()] if _cors_env else []
_cors_origins += [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    if client:
        client.close()