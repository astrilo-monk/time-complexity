import com.sun.jdi.*;
import com.sun.jdi.connect.*;
import com.sun.jdi.event.*;
import com.sun.jdi.request.*;

import java.util.*;

public class JavaTracer {
    private static final int MAX_STEPS = 250;
    private int stepCount = 0;
    private final String targetClass;
    private final String sourceFile;

    public JavaTracer(String targetClass, String sourceFile) {
        this.targetClass = targetClass;
        this.sourceFile = sourceFile;
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("Usage: java JavaTracer <TargetClass> <SourceFile>");
            System.exit(1);
        }
        new JavaTracer(args[0], args[1]).run();
    }

    private void run() throws Exception {
        boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");
        String transport = isWindows ? "dt_shmem" : "dt_socket";
        String addressOpt = isWindows ? "" : ",address=127.0.0.1:0";

        ProcessBuilder pb = new ProcessBuilder("java", "-Xmx64m", "-Xms16m", "-XX:+UseSerialGC", "-agentlib:jdwp=transport=" + transport + ",server=y,suspend=y" + addressOpt, "-cp", System.getProperty("java.class.path"), targetClass);
        pb.redirectErrorStream(true);
        Process process = pb.start();

        java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(process.getInputStream()));
        String line;
        String address = null;
        long startTime = System.currentTimeMillis();
        int warningCount = 0;
        while ((line = reader.readLine()) != null) {
            // Timeout: don't hang forever if JVM never starts JDWP
            if (System.currentTimeMillis() - startTime > 15000) {
                throw new RuntimeException("Timed out waiting for JDWP to start (15s)");
            }
            if (line.startsWith("Listening for transport " + transport + " at address:")) {
                address = line.split(":")[1].trim();
                break;
            } else if (line.contains("Picked up _JAVA_OPTIONS") ||
                       line.contains("Picked up JAVA_TOOL_OPTIONS") ||
                       line.contains("WARNING") ||
                       line.contains("NOTE") ||
                       line.trim().isEmpty()) {
                // Known JVM warnings — safe to skip
                System.err.println("Target VM: " + line);
                warningCount++;
                if (warningCount > 50) {
                    throw new RuntimeException("Too many JVM warnings, aborting");
                }
            } else if (line.contains("Error:") || line.contains("Exception") ||
                       line.contains("FATAL") || line.contains("Could not")) {
                // Fatal JVM error — fail fast instead of hanging
                throw new RuntimeException("Target VM error: " + line);
            } else {
                // Unknown output — log but don't fail (could be locale-specific)
                System.err.println("Target VM: " + line);
                warningCount++;
                if (warningCount > 50) {
                    throw new RuntimeException("Too much unexpected JVM output, aborting");
                }
            }
        }
        if (address == null) throw new RuntimeException("Failed to find JDWP address");

        new Thread(() -> {
            try {
                String l;
                while ((l = reader.readLine()) != null) System.err.println(l);
            } catch(Exception e){}
        }).start();

        VirtualMachineManager vmm = Bootstrap.virtualMachineManager();
        AttachingConnector connector = null;
        for (AttachingConnector ac : vmm.attachingConnectors()) {
            if (transport.equals(ac.transport().name())) {
                connector = ac;
                break;
            }
        }
        Map<String, Connector.Argument> env = connector.defaultArguments();
        if (isWindows) {
            env.get("name").setValue(address);
        } else {
            env.get("hostname").setValue("127.0.0.1");
            env.get("port").setValue(address);
        }

        VirtualMachine vm = connector.attach(env);

        EventRequestManager erm = vm.eventRequestManager();
        ClassPrepareRequest classPrepareRequest = erm.createClassPrepareRequest();
        classPrepareRequest.addClassFilter(targetClass);
        classPrepareRequest.enable();

        EventQueue eventQueue = vm.eventQueue();
        boolean connected = true;

        while (connected && stepCount < MAX_STEPS) {
            EventSet eventSet = eventQueue.remove(10000);
            if (eventSet == null) continue; // timeout

            for (Event event : eventSet) {
                if (event instanceof VMDeathEvent || event instanceof VMDisconnectEvent) {
                    connected = false;
                } else if (event instanceof ClassPrepareEvent) {
                    ClassPrepareEvent cpe = (ClassPrepareEvent) event;
                    ReferenceType refType = cpe.referenceType();
                    
                    // Add step request
                    ThreadReference thread = cpe.thread();
                    StepRequest stepRequest = erm.createStepRequest(
                            thread, StepRequest.STEP_LINE, StepRequest.STEP_INTO);
                    stepRequest.addClassFilter(targetClass);
                    stepRequest.enable();
                } else if (event instanceof StepEvent) {
                    handleStepEvent((StepEvent) event);
                }
            }
            eventSet.resume();
        }
        
        try {
            vm.exit(0);
        } catch (Exception e) {
            System.err.println("VM exit error: " + e.getMessage());
        }
    }

    private void handleStepEvent(StepEvent event) {
        try {
            Location loc = event.location();
            if (!loc.sourceName().equals(sourceFile)) {
                return;
            }
            
            ThreadReference thread = event.thread();
            List<StackFrame> frames = thread.frames();
            if (frames.isEmpty()) return;
            
            StackFrame currentFrame = frames.get(0);
            int lineNumber = loc.lineNumber();
            String funcName = loc.method().name();

            // Build JSON String manually to avoid external dependencies
            StringBuilder sb = new StringBuilder();
            sb.append("{");
            sb.append("\"step\":").append(stepCount).append(",");
            sb.append("\"line\":").append(lineNumber).append(",");
            sb.append("\"func\":\"").append(escapeJson(funcName)).append("\",");
            
            // Variables
            sb.append("\"variables\":[");
            try {
                List<LocalVariable> visibleVars = currentFrame.visibleVariables();
                boolean firstVar = true;
                for (LocalVariable var : visibleVars) {
                    Value val = currentFrame.getValue(var);
                    if (!firstVar) sb.append(",");
                    sb.append("{");
                    sb.append("\"name\":\"").append(escapeJson(var.name())).append("\",");
                    String valStr = valueToString(val);
                    sb.append("\"value\":\"").append(escapeJson(valStr)).append("\",");
                    sb.append("\"type\":\"").append(escapeJson(inferType(val, valStr))).append("\"");
                    sb.append("}");
                    firstVar = false;
                }
            } catch (AbsentInformationException e) {
                // compiled without -g
            }
            sb.append("],");
            
            // Stack frames
            sb.append("\"stack_frames\":[");
            boolean firstFrame = true;
            int level = 0;
            for (StackFrame f : frames) {
                Location l = f.location();
                if (!firstFrame) sb.append(",");
                sb.append("{");
                sb.append("\"level\":\"").append(level++).append("\",");
                sb.append("\"func\":\"").append(escapeJson(l.method().name())).append("\",");
                sb.append("\"line\":").append(l.lineNumber()).append(",");
                String fName = "??";
                try { fName = l.sourceName(); } catch(Exception ignored) {}
                sb.append("\"file\":\"").append(escapeJson(fName)).append("\"");
                sb.append("}");
                firstFrame = false;
            }
            sb.append("]");
            
            sb.append("}");
            
            System.out.println(sb.toString());
            stepCount++;
            
        } catch (Exception e) {
            System.err.println("Frame error: " + e.getMessage());
        }
    }

    private String valueToString(Value val) {
        if (val == null) return "null";
        if (val instanceof StringReference) {
            return "\"" + ((StringReference) val).value() + "\"";
        }
        if (val instanceof ObjectReference) {
            ObjectReference ref = (ObjectReference) val;
            return "Object@" + ref.uniqueID();
        }
        return val.toString();
    }

    private String inferType(Value val, String valStr) {
        if (val == null) return "unknown";
        if (val instanceof PrimitiveValue) {
            return val.type().name();
        }
        if (val instanceof ObjectReference) {
            return "pointer"; // Frontend expects 'pointer' for references
        }
        return "auto";
    }

    private String escapeJson(String str) {
        if (str == null) return "";
        return str.replace("\\", "\\\\")
                  .replace("\"", "\\\"")
                  .replace("\b", "\\b")
                  .replace("\f", "\\f")
                  .replace("\n", "\\n")
                  .replace("\r", "\\r")
                  .replace("\t", "\\t");
    }
    
    private void redirectOutput(Process process) {
        new Thread(() -> {
            try (java.util.Scanner s = new java.util.Scanner(process.getInputStream())) {
                while (s.hasNextLine()) System.err.println(s.nextLine());
            }
        }).start();
        new Thread(() -> {
            try (java.util.Scanner s = new java.util.Scanner(process.getErrorStream())) {
                while (s.hasNextLine()) System.err.println(s.nextLine());
            }
        }).start();
    }
}
