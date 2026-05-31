import React from 'react';

const SeoContent = () => {
  return (
    <div className="bg-zinc-950 border-t border-zinc-800/60 py-16 px-6 sm:px-12 lg:px-24 text-zinc-300 font-plex">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Section 1: Introduction (Rich in Primary Keywords) */}
        <section aria-labelledby="about-heading" className="space-y-4">
          <h2 id="about-heading" className="text-2xl sm:text-3xl font-cabinet font-bold text-zinc-100">
            About Code Tracer: The Ultimate Code Visualizer
          </h2>
          <p className="leading-relaxed">
            Code Tracer is a state-of-the-art interactive code visualizer and AI tutor designed for developers and students. By supporting multiple programming languages including C, Java, and Python, our tool allows you to execute code step-by-step, inspect memory allocation (stack and heap), track variable mutations, and analyze algorithmic complexity in real time.
          </p>
          <p className="leading-relaxed">
            Whether you are debugging a complex pointer issue in C, understanding object-oriented references in Java, or optimizing algorithmic loops in Python, Code Tracer provides a visual timeline of your program's execution to accelerate learning and development.
          </p>
        </section>

        {/* Section 2: Core Features (Secondary Keywords) */}
        <section aria-labelledby="features-heading" className="space-y-4">
          <h2 id="features-heading" className="text-xl sm:text-2xl font-cabinet font-bold text-zinc-100">
            Key Features of Our Interactive Code Tutor
          </h2>
          <ul className="grid sm:grid-cols-2 gap-4 mt-4 list-disc pl-5">
            <li>
              <strong className="text-zinc-200">Step-by-Step Execution:</strong> Pause, rewind, and advance through your code execution line by line.
            </li>
            <li>
              <strong className="text-zinc-200">Live Memory Visualization:</strong> See variables, arrays, and complex data structures rendered as visual blocks.
            </li>
            <li>
              <strong className="text-zinc-200">Big-O Complexity Analysis:</strong> Automatically calculate and graph time and space complexity.
            </li>
            <li>
              <strong className="text-zinc-200">AI Code Explanations:</strong> Our integrated AI tutor breaks down complex algorithms into simple English.
            </li>
          </ul>
        </section>

        {/* Section 3: Frequently Asked Questions (FAQ for Rich Snippets) */}
        <section aria-labelledby="faq-heading" className="space-y-6">
          <h2 id="faq-heading" className="text-xl sm:text-2xl font-cabinet font-bold text-zinc-100">
            Frequently Asked Questions (FAQ)
          </h2>
          
          <div className="space-y-4">
            <article className="bg-zinc-900/50 p-5 rounded-lg border border-zinc-800/50">
              <h3 className="font-bold text-zinc-100 mb-2">What programming languages does Code Tracer support?</h3>
              <p>Currently, Code Tracer supports full execution and memory visualization for C, Java, and Python. We plan to add support for JavaScript, C++, and Go in the near future.</p>
            </article>
            
            <article className="bg-zinc-900/50 p-5 rounded-lg border border-zinc-800/50">
              <h3 className="font-bold text-zinc-100 mb-2">How does the memory visualizer work?</h3>
              <p>The memory visualizer parses the runtime state of your program at each step. It separates memory into Stack (local variables, function calls) and Heap (dynamic allocations like malloc or object instantiations), rendering them as interactive blocks so you can see exactly how pointers and references behave.</p>
            </article>
            
            <article className="bg-zinc-900/50 p-5 rounded-lg border border-zinc-800/50">
              <h3 className="font-bold text-zinc-100 mb-2">Is Code Tracer free to use?</h3>
              <p>Yes, the core visualization features, step-by-step debugger, and complexity analyzer are completely free for students, educators, and developers looking to improve their algorithmic understanding.</p>
            </article>

            <article className="bg-zinc-900/50 p-5 rounded-lg border border-zinc-800/50">
              <h3 className="font-bold text-zinc-100 mb-2">Can I trace code with infinite loops or complex recursion?</h3>
              <p>Code Tracer employs a bounded execution limit to prevent server timeouts. If an infinite loop is detected, the execution will pause and notify you. Recursion is fully supported and visually represented in the call stack.</p>
            </article>
          </div>
        </section>

      </div>
    </div>
  );
};

export default SeoContent;
