import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEO = ({ 
  title = "Code Tracer | Interactive C, Java & Python Code Visualizer", 
  description = "Code Tracer is an advanced visualizer and AI tutor for C, Java, and Python. Step through code, inspect memory, and understand execution complexity.", 
  canonical = "https://codetracer.com/",
  ogImage = "https://codetracer.com/og-image.png"
}) => {
  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={canonical} />
      <meta property="twitter:title" content={title} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={ogImage} />

      {/* FAQ Schema for Rich Snippets */}
      <script type="application/ld+json">
        {`
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [{
              "@type": "Question",
              "name": "What programming languages does Code Tracer support?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Currently, Code Tracer supports full execution and memory visualization for C, Java, and Python. We plan to add support for JavaScript, C++, and Go in the near future."
              }
            }, {
              "@type": "Question",
              "name": "How does the memory visualizer work?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "The memory visualizer parses the runtime state of your program at each step. It separates memory into Stack (local variables, function calls) and Heap (dynamic allocations like malloc or object instantiations), rendering them as interactive blocks so you can see exactly how pointers and references behave."
              }
            }, {
              "@type": "Question",
              "name": "Is Code Tracer free to use?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Yes, the core visualization features, step-by-step debugger, and complexity analyzer are completely free for students, educators, and developers looking to improve their algorithmic understanding."
              }
            }, {
              "@type": "Question",
              "name": "Can I trace code with infinite loops or complex recursion?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Code Tracer employs a bounded execution limit to prevent server timeouts. If an infinite loop is detected, the execution will pause and notify you. Recursion is fully supported and visually represented in the call stack."
              }
            }]
          }
        `}
      </script>
    </Helmet>
  );
};

export default SEO;
