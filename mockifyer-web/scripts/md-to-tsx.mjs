#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourcePath = '/home/ubuntu/.cursor/projects/agent-repos-mockifyer/uploads/site-pages';
const targetBasePath = path.join(__dirname, '../frontend/src/pages');

function toPascalCase(str) {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function escapeJSX(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');
}

function processMarkdown(md) {
  const lines = md.split('\n');
  const result = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeLines = [];
  let inList = false;
  let listItems = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Handle code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        const code = codeLines.join('\n');
        const escapedCode = escapeJSX(code);
        result.push(`        <CodeBlock language="${codeBlockLang || 'text'}">`);
        result.push(`{\`${escapedCode}\`}`);
        result.push('        </CodeBlock>');
        inCodeBlock = false;
        codeLines = [];
        codeBlockLang = '';
      } else {
        // Start code block
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
      }
      continue;
    }
    
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }
    
    // Handle lists
    if (line.startsWith('- ')) {
      if (!inList) {
        inList = true;
        listItems = [];
      }
      const content = processInline(line.slice(2));
      listItems.push(`          <li>${content}</li>`);
      continue;
    } else if (inList) {
      // End of list
      result.push('        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">');
      result.push(...listItems);
      result.push('        </ul>');
      inList = false;
      listItems = [];
    }
    
    // Handle headings
    if (line.startsWith('## ')) {
      const text = line.slice(3);
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      result.push(`        <h2 className="text-2xl font-semibold mb-4 mt-8" id="${id}">${processInline(text)}</h2>`);
      continue;
    }
    if (line.startsWith('### ')) {
      const text = line.slice(4);
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      result.push(`        <h3 className="text-xl font-semibold mb-3 mt-6" id="${id}">${processInline(text)}</h3>`);
      continue;
    }
    if (line.startsWith('# ')) {
      // Skip h1 as it's in the header
      continue;
    }
    
    // Handle tables
    if (line.startsWith('|')) {
      // Collect table rows
      const tableRows = [line];
      while (i + 1 < lines.length && lines[i + 1].startsWith('|')) {
        tableRows.push(lines[++i]);
      }
      result.push(processTable(tableRows));
      continue;
    }
    
    // Handle empty lines
    if (line.trim() === '') {
      continue;
    }
    
    // Regular paragraphs
    const processed = processInline(line);
    result.push(`        <p className="mb-4 text-muted-foreground">${processed}</p>`);
  }
  
  // Close any open list
  if (inList) {
    result.push('        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">');
    result.push(...listItems);
    result.push('        </ul>');
  }
  
  return result.join('\n');
}

function processInline(text) {
  let result = text;
  
  // Escape curly braces
  result = result.replace(/{/g, '&#123;').replace(/}/g, '&#125;');
  
  // Process links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, href) => {
    if (href.startsWith('http')) {
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">${text}</a>`;
    }
    return `<Link to="${href}" className="text-primary hover:underline">${text}</Link>`;
  });
  
  // Process inline code
  result = result.replace(/`([^`]+)`/g, '<code className="text-sm bg-muted px-1.5 py-0.5 rounded">$1</code>');
  
  // Process bold
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Process italic
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  return result;
}

function processTable(rows) {
  const result = ['        <div className="overflow-x-auto my-6">'];
  result.push('          <table className="min-w-full border-collapse">');
  
  rows.forEach((row, idx) => {
    if (idx === 1 && row.match(/^\|[\s-:]+\|/)) {
      // Skip separator row
      return;
    }
    
    const cells = row.split('|').filter(c => c.trim()).map(c => c.trim());
    const isHeader = idx === 0;
    const tag = isHeader ? 'th' : 'td';
    const className = isHeader 
      ? 'border border-border px-4 py-2 text-left font-semibold bg-muted' 
      : 'border border-border px-4 py-2';
    
    result.push(`            <tr>`);
    cells.forEach(cell => {
      result.push(`              <${tag} className="${className}">${processInline(cell)}</${tag}>`);
    });
    result.push('            </tr>');
  });
  
  result.push('          </table>');
  result.push('        </div>');
  return result.join('\n');
}

async function generateComponent(filePath, type) {
  const content = await fs.readFile(filePath, 'utf-8');
  const { data: frontmatter, content: markdown } = matter(content);
  
  const filename = path.basename(filePath, '.md');
  const componentName = toPascalCase(filename);
  
  const jsxContent = processMarkdown(markdown);
  
  return `import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'

export default function ${componentName}() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-16 space-y-8">
      <header>
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-4xl font-bold mb-4">${frontmatter.h1 || frontmatter.title}</h1>
        ${frontmatter.meta_description ? `<p className="text-xl text-muted-foreground">${frontmatter.meta_description}</p>` : ''}
      </header>

      <div className="space-y-6">
${jsxContent}
      </div>
    </div>
  )
}
`;
}

async function processAll() {
  const types = ['guides', 'comparisons'];
  
  for (const type of types) {
    const sourceDir = path.join(sourcePath, type);
    const targetDir = path.join(targetBasePath, type);
    
    // Read all markdown files
    const files = (await fs.readdir(sourceDir)).filter(f => f.endsWith('.md'));
    
    for (const file of files) {
      const filePath = path.join(sourceDir, file);
      const component = await generateComponent(filePath, type);
      
      const filename = path.basename(file, '.md');
      const componentName = toPascalCase(filename);
      const outputPath = path.join(targetDir, `${componentName}.tsx`);
      
      await fs.writeFile(outputPath, component);
      console.log(`✓ Created ${type}/${componentName}.tsx`);
    }
  }
}

processAll().catch(console.error);
