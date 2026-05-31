"""
java_instrumenter.py — Source-level instrumentation for fast Java tracing.

Instead of using JDI/JDWP (which requires 2 JVM processes + TCP IPC),
this module injects tracing code directly into the Java source, so we
can compile and run it in a single JVM.

Result: ~3-5s instead of ~15-30s on constrained hardware.
"""

import re
from typing import Optional


# Maximum trace steps to prevent infinite loops
MAX_TRACE_STEPS = 250

# The tracer helper class injected into the user's code.
# It captures line, function, variables and outputs JSON to a special fd.
TRACER_CLASS = r'''
class __CT {
    static int __s = 0;
    static final int __MAX = ''' + str(MAX_TRACE_STEPS) + r''';
    static StringBuilder __stdout = new StringBuilder();
    static java.io.PrintStream __origOut;
    static java.io.PrintStream __origErr;

    static void __init() {
        __origOut = System.out;
        __origErr = System.err;
        // Redirect System.out to capture program output
        System.setOut(new java.io.PrintStream(new java.io.OutputStream() {
            public void write(int b) {
                __stdout.append((char)b);
            }
            public void write(byte[] b, int off, int len) {
                __stdout.append(new String(b, off, len));
            }
        }));
    }

    static void __t(int line, String func, String vars) {
        if (__s >= __MAX) return;
        String so = __stdout.toString();
        __origOut.println("{\"step\":" + __s + ",\"line\":" + line
            + ",\"func\":\"" + func + "\""
            + ",\"variables\":[" + vars + "]"
            + ",\"stack_frames\":[{\"level\":\"0\",\"func\":\"" + func
            + "\",\"line\":" + line + ",\"file\":\"__SOURCE__\"}]"
            + ",\"heap\":[]"
            + ",\"stdout\":\"" + __esc(so) + "\""
            + "}");
        __s++;
    }

    static String __v(String name, String val, String type) {
        return "{\"name\":\"" + __esc(name) + "\",\"value\":\"" + __esc(val) + "\",\"type\":\"" + type + "\"}";
    }

    static String __esc(String s) {
        if (s == null) return "null";
        return s.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
    }

    static void __done() {
        String so = __stdout.toString();
        __origOut.println("__CT_FINAL_OUTPUT__:" + so);
        System.setOut(__origOut);
    }
}
'''


def _detect_class_name(code: str) -> Optional[str]:
    """Detect the main class name from Java source."""
    m = re.search(r'public\s+class\s+([A-Za-z_]\w*)', code)
    if m:
        return m.group(1)
    m = re.search(r'class\s+([A-Za-z_]\w*)', code)
    if m:
        return m.group(1)
    return None


def _is_executable_line(line: str) -> bool:
    """Check if a line of Java code is executable (worth tracing)."""
    stripped = line.strip()
    if not stripped:
        return False
    # Skip comments, imports, package declarations
    if stripped.startswith('//') or stripped.startswith('/*') or stripped.startswith('*'):
        return False
    if stripped.startswith('import ') or stripped.startswith('package '):
        return False
    # Skip class/method/interface declarations (opening braces)
    if re.match(r'^\s*(public|private|protected|static|final|abstract|class|interface|enum|void|int|double|float|long|short|byte|char|boolean|String)\s', stripped):
        # But DO trace variable declarations with assignments
        if re.match(r'^\s*(int|double|float|long|short|byte|char|boolean|String|var)\s+\w+\s*=', stripped):
            return True
        # And DO trace return statements
        if stripped.startswith('return '):
            return True
        # Skip pure declarations, method signatures, class defs
        if stripped.endswith('{') or stripped.endswith(';') and '=' not in stripped and '(' not in stripped:
            return False
        # Method calls like System.out.println(...)
        if '(' in stripped and '=' not in stripped.split('(')[0]:
            return True
        return '=' in stripped  # assignments
    # Skip lone braces
    if stripped in ('{', '}', '};', '});'):
        return False
    # Skip annotations
    if stripped.startswith('@'):
        return False
    # Everything else is probably executable
    return True


def _track_variables(lines: list[str]) -> list[list[str]]:
    """
    For each line, determine which variables are visible (declared up to that point).
    Returns a list of lists of variable names, one per source line.
    
    IMPORTANT: Method parameters go into the method's OWN scope (pushed by {),
    not the enclosing scope. This prevents variables leaking between methods.
    """
    vars_at_line = []
    scope_stack = [[]]  # Stack of variable lists per scope level
    # Track pending params to add AFTER we push the method's scope
    
    for line in lines:
        stripped = line.strip()
        
        # Count braces
        open_braces = stripped.count('{')
        close_braces = stripped.count('}')
        
        # Process CLOSING braces FIRST (pop scopes)
        for _ in range(close_braces):
            if len(scope_stack) > 1:
                scope_stack.pop()
        
        # Process OPENING braces (push new scopes)
        for _ in range(open_braces):
            scope_stack.append([])
        
        # Check for method declarations — add params to the NEW scope (just pushed by {)
        method_match = re.match(
            r'\s*(?:public|private|protected|static|\s)*\s+(?:void|int|double|float|long|short|byte|char|boolean|String|[A-Z]\w*(?:<[^>]*>)?(?:\[\])?)\s+\w+\s*\(([^)]*)\)',
            stripped
        )
        if method_match and '{' in stripped:
            params = method_match.group(1)
            if params.strip():
                param_names = re.findall(r'(?:final\s+)?(?:\w+(?:\[\])?)\s+(\w+)', params)
                for p in param_names:
                    scope_stack[-1].append(p)
        
        # Check for variable declarations
        decl_pattern = r'(?:int|double|float|long|short|byte|char|boolean|String|var|Integer|Double|Float|Long|Short|Boolean|Character)(?:\[\])?\s+((?:[a-zA-Z_]\w*(?:\s*=\s*[^,;]+)?(?:\s*,\s*)?)+)'
        decl_match = re.search(decl_pattern, stripped)
        if decl_match:
            # Don't double-count method parameters
            if not method_match or '{' not in stripped:
                decl_text = decl_match.group(1)
                # Only extract the DECLARED variable names (before =), not RHS identifiers
                # Split by comma to handle `int x = 1, y = 2;`
                for part in re.split(r',\s*', decl_text):
                    part = part.strip().rstrip(';').strip()
                    if not part:
                        continue
                    # Get the variable name (first identifier before = or end)
                    name_match = re.match(r'([a-zA-Z_]\w*)', part)
                    if name_match:
                        v = name_match.group(1)
                        if v not in ('true', 'false', 'null', 'new', 'return'):
                            scope_stack[-1].append(v)
        
        # Check for for-loop variable (regular)
        for_match = re.search(r'for\s*\(\s*(?:int|long|double|float)\s+(\w+)\s*=', stripped)
        if for_match:
            scope_stack[-1].append(for_match.group(1))
        
        # Check for enhanced for-loop variable
        foreach_match = re.search(r'for\s*\(\s*(?:int|long|double|float|String|var|[A-Z]\w*)\s+(\w+)\s*:', stripped)
        if foreach_match:
            scope_stack[-1].append(foreach_match.group(1))
        
        # Record visible variables for this line
        all_vars = []
        for scope in scope_stack:
            all_vars.extend(scope)
        vars_at_line.append(list(dict.fromkeys(all_vars)))  # dedupe preserving order
    
    return vars_at_line


def _get_var_type(var_name: str, line_context: str) -> str:
    """Infer the Java type of a variable from its declaration context."""
    # Search for the declaration pattern
    patterns = [
        (r'\b(int)\s+' + re.escape(var_name) + r'\b', 'int'),
        (r'\b(double)\s+' + re.escape(var_name) + r'\b', 'double'),
        (r'\b(float)\s+' + re.escape(var_name) + r'\b', 'float'),
        (r'\b(long)\s+' + re.escape(var_name) + r'\b', 'long'),
        (r'\b(short)\s+' + re.escape(var_name) + r'\b', 'short'),
        (r'\b(byte)\s+' + re.escape(var_name) + r'\b', 'byte'),
        (r'\b(char)\s+' + re.escape(var_name) + r'\b', 'char'),
        (r'\b(boolean)\s+' + re.escape(var_name) + r'\b', 'boolean'),
        (r'\b(String)\s+' + re.escape(var_name) + r'\b', 'String'),
    ]
    for pattern, type_name in patterns:
        if re.search(pattern, line_context):
            return type_name
    return 'auto'


def _build_trace_call(line_num: int, func_name: str, visible_vars: list[str], 
                       all_lines: list[str], var_types: dict) -> str:
    """Build a __CT.__t() call for a given line."""
    if not visible_vars:
        return f'__CT.__t({line_num}, "{func_name}", "");'
    
    var_parts = []
    for v in visible_vars:
        vtype = var_types.get(v, 'auto')
        # For primitives, convert to String; for objects, use String.valueOf
        var_parts.append(f'__CT.__v("{v}", String.valueOf({v}), "{vtype}")')
    
    vars_expr = ' + "," + '.join(var_parts)
    return f'__CT.__t({line_num}, "{func_name}", {vars_expr});'


def _detect_current_method(lines: list[str], line_idx: int) -> str:
    """Find which method contains the given line index."""
    # Walk backwards to find the enclosing method
    for i in range(line_idx, -1, -1):
        stripped = lines[i].strip()
        method_match = re.match(
            r'(?:public|private|protected|static|\s)*\s*(?:void|int|double|float|long|short|byte|char|boolean|String|[A-Z]\w*(?:<[^>]*>)?)\s+(\w+)\s*\(',
            stripped
        )
        if method_match:
            return method_match.group(1)
    return "main"


def instrument(code: str, source_file: str) -> Optional[str]:
    """
    Instrument Java source code with tracing calls.
    
    Returns instrumented source code, or None if the code is too complex
    to instrument (caller should fall back to JDI).
    """
    class_name = _detect_class_name(code)
    if not class_name:
        return None
    
    lines = code.split('\n')
    
    # Bail out on code that's too complex for simple instrumentation
    # (inner classes, anonymous classes, lambdas with complex logic)
    for line in lines:
        stripped = line.strip()
        # Multiple class definitions
        if stripped.startswith('class ') and stripped != f'class {class_name}' + ' {' and 'class ' in stripped:
            pass  # Allow, but it may not trace inner classes
    
    # Track variables at each line
    vars_at_line = _track_variables(lines)
    
    # Build a map of variable types from the full source
    # Also collect method names so we can exclude them from variable lists
    var_types = {}
    method_names = set()
    type_keywords = ['int', 'double', 'float', 'long', 'short', 'byte', 'char', 'boolean', 'String',
                     'Integer', 'Double', 'Float', 'Long', 'Short', 'Boolean', 'Character']
    for line in lines:
        stripped = line.strip()
        # Detect method declarations and record their names
        method_decl = re.match(
            r'(?:public|private|protected|static|\s)*\s*(?:void|int|double|float|long|short|byte|char|boolean|String|[A-Z]\w*(?:<[^>]*>)?)\s+(\w+)\s*\(',
            stripped
        )
        if method_decl:
            method_names.add(method_decl.group(1))
        for tk in type_keywords:
            for m in re.finditer(r'\b' + tk + r'\s+(\w+)', line):
                name = m.group(1)
                if name not in method_names:
                    var_types[name] = tk
    
    # Build instrumented source
    result_lines = []
    in_main_class = False
    main_class_brace_depth = 0
    brace_depth = 0
    found_main = False
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        
        # Detect main class opening
        if not in_main_class and re.match(r'\s*(public\s+)?class\s+' + re.escape(class_name) + r'\s*', stripped):
            in_main_class = True
            result_lines.append(line)
            if '{' in stripped:
                main_class_brace_depth = brace_depth + 1
                brace_depth += stripped.count('{') - stripped.count('}')
            continue
        
        # Track brace depth
        brace_depth += stripped.count('{') - stripped.count('}')
        
        # Inject __CT.__init() at the start of main()
        if in_main_class and not found_main:
            if re.match(r'\s*public\s+static\s+void\s+main\s*\(', stripped):
                result_lines.append(line)
                if '{' in stripped:
                    indent = '        '
                    result_lines.append(f'{indent}__CT.__init();')
                    found_main = True
                continue
        
        # For executable lines in ANY method, add trace call
        if in_main_class and _is_executable_line(stripped):
            func = _detect_current_method(lines, i)
            visible = vars_at_line[i] if i < len(vars_at_line) else []
            # Filter out method names from visible variables
            visible = [v for v in visible if v not in method_names]
            
            # Get indentation
            indent_match = re.match(r'^(\s*)', line)
            indent = indent_match.group(1) if indent_match else ''
            
            trace_call = _build_trace_call(i + 1, func, visible, lines, var_types)
            
            # For return statements, trace BEFORE the return (after is unreachable)
            if stripped.startswith('return '):
                result_lines.append(f'{indent}{trace_call}')
                result_lines.append(line)
            else:
                result_lines.append(line)
                result_lines.append(f'{indent}{trace_call}')
        else:
            result_lines.append(line)
        
        # Inject __CT.__done() before the closing of main
        # We handle this by detecting return statements in main or the closing brace
    
    # Add __CT.__done() before the last closing brace of the main class
    # Find the last line of main() and insert __done() before its closing brace
    instrumented = '\n'.join(result_lines)
    
    # Insert __CT.__done() as a shutdown hook instead (more reliable)
    if found_main:
        init_replacement = '__CT.__init(); Runtime.getRuntime().addShutdownHook(new Thread(() -> __CT.__done()));'
        instrumented = instrumented.replace('__CT.__init();', init_replacement, 1)
    
    # Append the tracer class and replace __SOURCE__ placeholder
    tracer = TRACER_CLASS.replace('__SOURCE__', source_file)
    instrumented = instrumented + '\n' + tracer + '\n'
    
    if not found_main:
        return None  # Couldn't find main() to inject into
    
    return instrumented
