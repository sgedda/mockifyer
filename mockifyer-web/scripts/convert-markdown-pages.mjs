#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourcePath = '/home/ubuntu/.cursor/projects/agent-repos-mockifyer/uploads/site-pages';
const targetBasePath = path.join(__dirname, '../frontend/src/pages');

// Simple markdown to JSX converter
function convertMarkdownToJSX(markdown) {
  let jsx = markdown;
  
  // Convert headings
  jsx = jsx.replace(/^### (.*?)$/gm, '<h3 className="text-xl font-semibold mb-3 mt-6">$1</h3>');
  jsx = jsx.replace(/^## (.*?)$/gm, '<h2 className="text-2xl font-semibold mb-4 mt-8" id="$1">$1</h2>');
  jsx = jsx.replace(/^# (.*?)$/gm, ''); // Remove h1 since it's in the header
  
  // Convert code blocks
  jsx = jsx.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const escapedCode = code
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$')
      .replace(/{/g, '\\{')
      .replace(/}/g, '\\}');
    return `<CodeBlock language="${lang || 'text'}">\n\`${escapedCode}\`\n</CodeBlock>`;
  });
  
  // Convert inline code
  jsx = jsx.replace(/`([^`]+)`/g, '<code className="text-sm bg-muted px-1.5 py-0.5 rounded">$1</code>');
  
  // Convert bold
  jsx = jsx.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Convert links
  jsx = jsx.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, href) => {
    if (href.startsWith('http')) {
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">${text}</a>`;
    }
    return `<Link to="${href}" className="text-primary hover:underline">${text}</Link>`;
  });
  
  // Convert unordered lists
  jsx = jsx.replace(/^- (.*?)$/gm, '<li className="ml-4">$1</li>');
  jsx = jsx.replace(/(<li className="ml-4">.*?<\/li>\n)+/gs, (match) => {
    return `<ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">\n${match}</ul>\n`;
  });
  
  // Convert paragraphs
  jsx = jsx.replace(/^(?!<[hl]|<Code|<ul|<li)(.+)$/gm, '<p className="mb-4 text-muted-foreground">$1</p>');
  
  return jsx;
}

function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, content };
  
  const frontmatterText = match[1];
  const body = match[2];
  
  const frontmatter = {};
  frontmatterText.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      frontmatter[key] = value;
    }
  });
  
  return { frontmatter, content: body };
}

function generateComponent(markdown, filename, type) {
  const { frontmatter, content } = extractFrontmatter(markdown);
  const componentName = filename.replace(/-./g, (match) => match[1].toUpperCase()).replace(/^./, (match) => match.toUpperCase());
  
  const jsx = convertMarkdownToJSX(content);
  
  const template = `import { Link } from 'react-router-dom'
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

      <div className="prose prose-slate dark:prose-invert max-w-none">
        ${jsx}
      </div>
    </div>
  )
}
`;
  
  return template;
}

function processFiles() {
  const types = ['guides', 'comparisons'];
  
  types.forEach(type => {
    const sourceDir = path.join(sourcePath, type);
    const targetDir = path.join(targetBasePath, type);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.md'));
    
    files.forEach(file => {
      const markdown = fs.readFileSync(path.join(sourceDir, file), 'utf-8');
      const filename = path.basename(file, '.md');
      const component = generateComponent(markdown, filename, type);
      
      const outputFile = path.join(targetDir, `${filename.replace(/-./g, (m) => m[1].toUpperCase()).replace(/^./, (m) => m.toUpperCase())}.tsx`);
      fs.writeFileSync(outputFile, component);
      console.log(`✓ Created ${path.relative(targetBasePath, outputFile)}`);
    });
  });
}

processFiles();
