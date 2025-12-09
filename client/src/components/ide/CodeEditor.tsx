import { useState, useCallback, useRef } from "react";
import { X, Circle, Save, FileCode, FileJson, FileText, File, FileType } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface OpenFile {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  isDirty: boolean;
}

interface CodeEditorProps {
  openFiles: OpenFile[];
  activeFileId: string | null;
  onFileChange: (fileId: string, content: string) => void;
  onFileSave: (fileId: string) => void;
  onFileClose: (fileId: string) => void;
  onTabSelect: (fileId: string) => void;
}

export const getLanguageFromExtension = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    mts: 'typescript',
    cts: 'typescript',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    json: 'json',
    jsonc: 'json',
    md: 'markdown',
    mdx: 'markdown',
    py: 'python',
    pyw: 'python',
    pyi: 'python',
    rb: 'ruby',
    erb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    kts: 'kotlin',
    swift: 'swift',
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    hpp: 'cpp',
    hxx: 'cpp',
    cs: 'csharp',
    php: 'php',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    fish: 'bash',
    ps1: 'powershell',
    psm1: 'powershell',
    yml: 'yaml',
    yaml: 'yaml',
    toml: 'toml',
    ini: 'ini',
    cfg: 'ini',
    conf: 'ini',
    xml: 'xml',
    svg: 'xml',
    vue: 'vue',
    svelte: 'svelte',
    lua: 'lua',
    r: 'r',
    dart: 'dart',
    ex: 'elixir',
    exs: 'elixir',
    erl: 'erlang',
    hrl: 'erlang',
    hs: 'haskell',
    lhs: 'haskell',
    scala: 'scala',
    clj: 'clojure',
    cljs: 'clojure',
    groovy: 'groovy',
    gradle: 'groovy',
    pl: 'perl',
    pm: 'perl',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    mk: 'makefile',
    graphql: 'graphql',
    gql: 'graphql',
    prisma: 'prisma',
    env: 'env',
    gitignore: 'gitignore',
    dockerignore: 'gitignore',
    prettierrc: 'json',
    eslintrc: 'json',
    babelrc: 'json',
    lock: 'lock',
    txt: 'plaintext',
    log: 'log',
  };
  
  const lowerFilename = filename.toLowerCase();
  if (lowerFilename === 'dockerfile' || lowerFilename.startsWith('dockerfile.')) return 'dockerfile';
  if (lowerFilename === 'makefile' || lowerFilename === 'gnumakefile') return 'makefile';
  if (lowerFilename.startsWith('.env')) return 'env';
  if (lowerFilename === '.gitignore' || lowerFilename === '.dockerignore') return 'gitignore';
  
  return langMap[ext] || 'plaintext';
};

export const getLanguageDisplayName = (language: string): string => {
  const displayNames: Record<string, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    python: 'Python',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    sass: 'Sass',
    less: 'Less',
    json: 'JSON',
    markdown: 'Markdown',
    ruby: 'Ruby',
    go: 'Go',
    rust: 'Rust',
    java: 'Java',
    kotlin: 'Kotlin',
    swift: 'Swift',
    c: 'C',
    cpp: 'C++',
    csharp: 'C#',
    php: 'PHP',
    sql: 'SQL',
    bash: 'Bash',
    powershell: 'PowerShell',
    yaml: 'YAML',
    toml: 'TOML',
    ini: 'INI',
    xml: 'XML',
    vue: 'Vue',
    svelte: 'Svelte',
    lua: 'Lua',
    r: 'R',
    dart: 'Dart',
    elixir: 'Elixir',
    erlang: 'Erlang',
    haskell: 'Haskell',
    scala: 'Scala',
    clojure: 'Clojure',
    groovy: 'Groovy',
    perl: 'Perl',
    dockerfile: 'Dockerfile',
    makefile: 'Makefile',
    graphql: 'GraphQL',
    prisma: 'Prisma',
    env: 'Environment',
    gitignore: 'Git Ignore',
    lock: 'Lock File',
    log: 'Log',
    plaintext: 'Plain Text',
  };
  return displayNames[language] || language.charAt(0).toUpperCase() + language.slice(1);
};

const getFileIconColor = (language: string): string => {
  const colors: Record<string, string> = {
    javascript: 'text-yellow-400',
    typescript: 'text-blue-400',
    python: 'text-green-400',
    html: 'text-orange-400',
    css: 'text-blue-300',
    scss: 'text-pink-400',
    json: 'text-yellow-300',
    markdown: 'text-gray-400',
    ruby: 'text-red-400',
    go: 'text-cyan-400',
    rust: 'text-orange-500',
    java: 'text-red-500',
    kotlin: 'text-purple-400',
    swift: 'text-orange-400',
    c: 'text-blue-500',
    cpp: 'text-blue-600',
    csharp: 'text-purple-500',
    php: 'text-indigo-400',
    sql: 'text-yellow-500',
    bash: 'text-green-500',
    yaml: 'text-red-300',
    dockerfile: 'text-blue-400',
    vue: 'text-green-400',
    svelte: 'text-orange-500',
  };
  return colors[language] || 'text-muted-foreground';
};

const syntaxHighlight = (code: string, language: string): string => {
  let highlighted = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (['javascript', 'typescript'].includes(language)) {
    const keywords = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|extends|implements|interface|type|enum|namespace|module|import|export|from|default|async|await|try|catch|finally|throw|new|this|super|typeof|instanceof|void|null|undefined|true|false|static|public|private|protected|readonly|abstract|get|set|of|in|yield|delete)\b/g;
    highlighted = highlighted.replace(keywords, '<span class="text-purple-400">$1</span>');
    
    highlighted = highlighted.replace(/(\/\/.*$)/gm, '<span class="text-muted-foreground italic">$1</span>');
    highlighted = highlighted.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="text-muted-foreground italic">$1</span>');
    
    highlighted = highlighted.replace(/("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|`[^`\\]*(?:\\.[^`\\]*)*`)/g, '<span class="text-green-400">$1</span>');
    
    highlighted = highlighted.replace(/\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/gi, '<span class="text-orange-400">$1</span>');
    
    highlighted = highlighted.replace(/\b([A-Z][a-zA-Z0-9_]*)\b/g, '<span class="text-yellow-300">$1</span>');
    
    highlighted = highlighted.replace(/\b(\w+)(?=\s*\()/g, '<span class="text-blue-300">$1</span>');
    
    highlighted = highlighted.replace(/(@\w+)/g, '<span class="text-yellow-400">$1</span>');
  } else if (language === 'html' || language === 'xml') {
    highlighted = highlighted.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="text-muted-foreground italic">$1</span>');
    highlighted = highlighted.replace(/(&lt;\/?)([\w:-]+)/g, '$1<span class="text-red-400">$2</span>');
    highlighted = highlighted.replace(/\s([\w:-]+)(?==)/g, ' <span class="text-yellow-300">$1</span>');
    highlighted = highlighted.replace(/=("[^"]*"|'[^']*')/g, '=<span class="text-green-400">$1</span>');
  } else if (language === 'css' || language === 'scss' || language === 'less') {
    highlighted = highlighted.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="text-muted-foreground italic">$1</span>');
    highlighted = highlighted.replace(/(\/\/.*$)/gm, '<span class="text-muted-foreground italic">$1</span>');
    highlighted = highlighted.replace(/(\.[\w-]+|#[\w-]+)/g, '<span class="text-yellow-300">$1</span>');
    highlighted = highlighted.replace(/([\w-]+)(?=\s*:)/g, '<span class="text-blue-300">$1</span>');
    highlighted = highlighted.replace(/:\s*([^;{}]+)/g, ': <span class="text-orange-400">$1</span>');
    highlighted = highlighted.replace(/(@[\w-]+)/g, '<span class="text-purple-400">$1</span>');
  } else if (language === 'python') {
    const keywords = /\b(def|class|if|elif|else|for|while|return|import|from|as|try|except|finally|raise|with|lambda|pass|break|continue|yield|global|nonlocal|assert|del|None|True|False|and|or|not|in|is|async|await|match|case)\b/g;
    highlighted = highlighted.replace(keywords, '<span class="text-purple-400">$1</span>');
    highlighted = highlighted.replace(/(#.*$)/gm, '<span class="text-muted-foreground italic">$1</span>');
    highlighted = highlighted.replace(/("""[\s\S]*?"""|\'\'\'[\s\S]*?\'\'\')/g, '<span class="text-green-400 italic">$1</span>');
    highlighted = highlighted.replace(/("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')/g, '<span class="text-green-400">$1</span>');
    highlighted = highlighted.replace(/\b(\d+\.?\d*(?:e[+-]?\d+)?j?)\b/gi, '<span class="text-orange-400">$1</span>');
    highlighted = highlighted.replace(/\b(\w+)(?=\s*\()/g, '<span class="text-blue-300">$1</span>');
    highlighted = highlighted.replace(/(@\w+)/g, '<span class="text-yellow-400">$1</span>');
    const builtins = /\b(print|len|range|str|int|float|list|dict|set|tuple|bool|type|input|open|file|abs|max|min|sum|sorted|reversed|enumerate|zip|map|filter|any|all|isinstance|hasattr|getattr|setattr|super|object|staticmethod|classmethod|property)\b/g;
    highlighted = highlighted.replace(builtins, '<span class="text-cyan-400">$1</span>');
  } else if (language === 'json') {
    highlighted = highlighted.replace(/("(?:[^"\\]|\\.)*")\s*:/g, '<span class="text-blue-300">$1</span>:');
    highlighted = highlighted.replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span class="text-green-400">$1</span>');
    highlighted = highlighted.replace(/:\s*(-?\d+\.?\d*(?:e[+-]?\d+)?)/gi, ': <span class="text-orange-400">$1</span>');
    highlighted = highlighted.replace(/:\s*(true|false|null)\b/g, ': <span class="text-purple-400">$1</span>');
  } else if (language === 'yaml') {
    highlighted = highlighted.replace(/(#.*$)/gm, '<span class="text-muted-foreground italic">$1</span>');
    highlighted = highlighted.replace(/^(\s*[\w-]+):/gm, '<span class="text-blue-300">$1</span>:');
    highlighted = highlighted.replace(/:\s*("[^"]*"|'[^']*')/g, ': <span class="text-green-400">$1</span>');
    highlighted = highlighted.replace(/:\s*(true|false|null|~)\b/gi, ': <span class="text-purple-400">$1</span>');
    highlighted = highlighted.replace(/:\s*(-?\d+\.?\d*)\b/g, ': <span class="text-orange-400">$1</span>');
  } else if (language === 'bash') {
    const keywords = /\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|local|export|source|alias|unalias|exit|break|continue|in)\b/g;
    highlighted = highlighted.replace(keywords, '<span class="text-purple-400">$1</span>');
    highlighted = highlighted.replace(/(#.*$)/gm, '<span class="text-muted-foreground italic">$1</span>');
    highlighted = highlighted.replace(/("[^"]*"|'[^']*')/g, '<span class="text-green-400">$1</span>');
    highlighted = highlighted.replace(/(\$[\w{}]+|\$\([^)]*\))/g, '<span class="text-cyan-400">$1</span>');
  } else if (language === 'go') {
    const keywords = /\b(package|import|func|return|var|const|type|struct|interface|map|chan|go|defer|if|else|for|range|switch|case|default|break|continue|fallthrough|select|nil|true|false|iota)\b/g;
    highlighted = highlighted.replace(keywords, '<span class="text-purple-400">$1</span>');
    highlighted = highlighted.replace(/(\/\/.*$)/gm, '<span class="text-muted-foreground italic">$1</span>');
    highlighted = highlighted.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="text-muted-foreground italic">$1</span>');
    highlighted = highlighted.replace(/("[^"]*"|`[^`]*`)/g, '<span class="text-green-400">$1</span>');
    highlighted = highlighted.replace(/\b(\d+\.?\d*)\b/g, '<span class="text-orange-400">$1</span>');
    highlighted = highlighted.replace(/\b(\w+)(?=\s*\()/g, '<span class="text-blue-300">$1</span>');
  } else if (language === 'rust') {
    const keywords = /\b(fn|let|mut|const|static|struct|enum|impl|trait|type|pub|mod|use|crate|self|super|as|where|for|loop|while|if|else|match|return|break|continue|move|ref|async|await|dyn|unsafe|extern|true|false|Some|None|Ok|Err)\b/g;
    highlighted = highlighted.replace(keywords, '<span class="text-purple-400">$1</span>');
    highlighted = highlighted.replace(/(\/\/.*$)/gm, '<span class="text-muted-foreground italic">$1</span>');
    highlighted = highlighted.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="text-muted-foreground italic">$1</span>');
    highlighted = highlighted.replace(/("[^"]*")/g, '<span class="text-green-400">$1</span>');
    highlighted = highlighted.replace(/\b(\d+\.?\d*(?:f32|f64|i8|i16|i32|i64|i128|u8|u16|u32|u64|u128|isize|usize)?)\b/g, '<span class="text-orange-400">$1</span>');
    highlighted = highlighted.replace(/(#\[[\s\S]*?\])/g, '<span class="text-yellow-400">$1</span>');
  } else if (language === 'sql') {
    const keywords = /\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|LIKE|BETWEEN|IS|NULL|AS|ON|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|GROUP|BY|HAVING|ORDER|ASC|DESC|LIMIT|OFFSET|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|VIEW|DROP|ALTER|ADD|COLUMN|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|CHECK|DEFAULT|CASCADE|TRUNCATE|UNION|ALL|DISTINCT|EXISTS|CASE|WHEN|THEN|ELSE|END|COUNT|SUM|AVG|MIN|MAX)\b/gi;
    highlighted = highlighted.replace(keywords, '<span class="text-purple-400">$1</span>');
    highlighted = highlighted.replace(/(--.*$)/gm, '<span class="text-muted-foreground italic">$1</span>');
    highlighted = highlighted.replace(/('[^']*')/g, '<span class="text-green-400">$1</span>');
    highlighted = highlighted.replace(/\b(\d+\.?\d*)\b/g, '<span class="text-orange-400">$1</span>');
  } else if (language === 'ruby') {
    const keywords = /\b(def|end|class|module|if|elsif|else|unless|case|when|while|until|for|do|begin|rescue|ensure|raise|return|yield|next|break|redo|retry|self|super|nil|true|false|and|or|not|in|require|require_relative|include|extend|attr_reader|attr_writer|attr_accessor|private|protected|public|alias|lambda|proc)\b/g;
    highlighted = highlighted.replace(keywords, '<span class="text-purple-400">$1</span>');
    highlighted = highlighted.replace(/(#.*$)/gm, '<span class="text-muted-foreground italic">$1</span>');
    highlighted = highlighted.replace(/("[^"]*"|'[^']*')/g, '<span class="text-green-400">$1</span>');
    highlighted = highlighted.replace(/(:\w+)/g, '<span class="text-cyan-400">$1</span>');
    highlighted = highlighted.replace(/(@\w+)/g, '<span class="text-yellow-400">$1</span>');
  } else if (language === 'java' || language === 'kotlin') {
    const keywords = /\b(class|interface|enum|extends|implements|public|private|protected|static|final|abstract|synchronized|volatile|transient|native|strictfp|void|boolean|byte|char|short|int|long|float|double|if|else|for|while|do|switch|case|default|break|continue|return|throw|throws|try|catch|finally|new|this|super|instanceof|null|true|false|package|import|var|val|fun|when|object|companion|data|sealed|open|override|lateinit|by|lazy|suspend|inline|crossinline|noinline|reified|internal|out|in)\b/g;
    highlighted = highlighted.replace(keywords, '<span class="text-purple-400">$1</span>');
    highlighted = highlighted.replace(/(\/\/.*$)/gm, '<span class="text-muted-foreground italic">$1</span>');
    highlighted = highlighted.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="text-muted-foreground italic">$1</span>');
    highlighted = highlighted.replace(/("[^"]*")/g, '<span class="text-green-400">$1</span>');
    highlighted = highlighted.replace(/\b(\d+\.?\d*[fFdDlL]?)\b/g, '<span class="text-orange-400">$1</span>');
    highlighted = highlighted.replace(/(@\w+)/g, '<span class="text-yellow-400">$1</span>');
  } else if (language === 'php') {
    const keywords = /\b(function|class|interface|trait|extends|implements|public|private|protected|static|final|abstract|const|var|if|else|elseif|for|foreach|while|do|switch|case|default|break|continue|return|throw|try|catch|finally|new|clone|instanceof|echo|print|die|exit|include|include_once|require|require_once|namespace|use|as|null|true|false|self|parent|this|array|callable|iterable|void|bool|int|float|string|object|mixed)\b/g;
    highlighted = highlighted.replace(keywords, '<span class="text-purple-400">$1</span>');
    highlighted = highlighted.replace(/(\/\/.*$|#.*$)/gm, '<span class="text-muted-foreground italic">$1</span>');
    highlighted = highlighted.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="text-muted-foreground italic">$1</span>');
    highlighted = highlighted.replace(/("[^"]*"|'[^']*')/g, '<span class="text-green-400">$1</span>');
    highlighted = highlighted.replace(/(\$\w+)/g, '<span class="text-cyan-400">$1</span>');
  } else if (language === 'markdown') {
    highlighted = highlighted.replace(/^(#{1,6}\s.*)$/gm, '<span class="text-blue-400 font-bold">$1</span>');
    highlighted = highlighted.replace(/(\*\*[^*]+\*\*|__[^_]+__)/g, '<span class="font-bold">$1</span>');
    highlighted = highlighted.replace(/(\*[^*]+\*|_[^_]+_)/g, '<span class="italic">$1</span>');
    highlighted = highlighted.replace(/(`[^`]+`)/g, '<span class="text-green-400 bg-muted/50 px-1 rounded">$1</span>');
    highlighted = highlighted.replace(/(\[[^\]]+\]\([^)]+\))/g, '<span class="text-cyan-400">$1</span>');
    highlighted = highlighted.replace(/^(\s*[-*+]\s)/gm, '<span class="text-purple-400">$1</span>');
    highlighted = highlighted.replace(/^(\s*\d+\.\s)/gm, '<span class="text-purple-400">$1</span>');
  } else if (language === 'dockerfile') {
    const keywords = /^(FROM|RUN|CMD|LABEL|EXPOSE|ENV|ADD|COPY|ENTRYPOINT|VOLUME|USER|WORKDIR|ARG|ONBUILD|STOPSIGNAL|HEALTHCHECK|SHELL|MAINTAINER)\b/gm;
    highlighted = highlighted.replace(keywords, '<span class="text-purple-400">$1</span>');
    highlighted = highlighted.replace(/(#.*$)/gm, '<span class="text-muted-foreground italic">$1</span>');
    highlighted = highlighted.replace(/("[^"]*"|'[^']*')/g, '<span class="text-green-400">$1</span>');
  } else if (language === 'env' || language === 'gitignore') {
    highlighted = highlighted.replace(/(#.*$)/gm, '<span class="text-muted-foreground italic">$1</span>');
    if (language === 'env') {
      highlighted = highlighted.replace(/^(\w+)=/gm, '<span class="text-blue-300">$1</span>=');
      highlighted = highlighted.replace(/=(.*)$/gm, '=<span class="text-green-400">$1</span>');
    }
  }

  return highlighted;
};

const FileIcon = ({ language, className = "w-4 h-4" }: { language: string; className?: string }) => {
  const colorClass = getFileIconColor(language);
  
  if (['javascript', 'typescript', 'python', 'ruby', 'go', 'rust', 'java', 'kotlin', 'php', 'c', 'cpp', 'csharp'].includes(language)) {
    return <FileCode className={`${className} ${colorClass}`} />;
  }
  if (language === 'json') {
    return <FileJson className={`${className} ${colorClass}`} />;
  }
  if (['markdown', 'plaintext', 'log'].includes(language)) {
    return <FileText className={`${className} ${colorClass}`} />;
  }
  if (['html', 'xml', 'css', 'scss', 'vue', 'svelte'].includes(language)) {
    return <FileType className={`${className} ${colorClass}`} />;
  }
  return <File className={`${className} ${colorClass}`} />;
};

export default function CodeEditor({
  openFiles,
  activeFileId,
  onFileChange,
  onFileSave,
  onFileClose,
  onTabSelect,
}: CodeEditorProps) {
  const activeFile = openFiles.find((f) => f.id === activeFileId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (activeFileId) {
        onFileSave(activeFileId);
      }
    }
    
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (textarea && activeFile) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent = activeFile.content.substring(0, start) + '  ' + activeFile.content.substring(end);
        onFileChange(activeFile.id, newContent);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
      }
    }

    if (e.key === 'Enter') {
      const textarea = textareaRef.current;
      if (textarea && activeFile) {
        e.preventDefault();
        const start = textarea.selectionStart;
        const textBefore = activeFile.content.substring(0, start);
        const currentLine = textBefore.split('\n').pop() || '';
        const indent = currentLine.match(/^\s*/)?.[0] || '';
        const newContent = activeFile.content.substring(0, start) + '\n' + indent + activeFile.content.substring(textarea.selectionEnd);
        onFileChange(activeFile.id, newContent);
        setTimeout(() => {
          const newPos = start + 1 + indent.length;
          textarea.selectionStart = textarea.selectionEnd = newPos;
          updateCursorPosition();
        }, 0);
      }
    }
  }, [activeFileId, activeFile, onFileSave, onFileChange]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (activeFile) {
      onFileChange(activeFile.id, e.target.value);
    }
  };

  const updateCursorPosition = () => {
    const textarea = textareaRef.current;
    if (textarea && activeFile) {
      const text = activeFile.content.substring(0, textarea.selectionStart);
      const lines = text.split('\n');
      setCursorPosition({
        line: lines.length,
        column: (lines[lines.length - 1]?.length || 0) + 1
      });
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    if (preRef.current) {
      preRef.current.scrollTop = textarea.scrollTop;
      preRef.current.scrollLeft = textarea.scrollLeft;
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textarea.scrollTop;
    }
  };

  const lines = activeFile?.content.split('\n') || [];
  const language = activeFile ? getLanguageFromExtension(activeFile.name) : 'plaintext';

  if (openFiles.length === 0) {
    return (
      <div className="flex flex-col h-full bg-card">
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <FileCode className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-sm">Select a file to start editing</p>
            <p className="text-xs mt-2 text-muted-foreground/70">or create a new file from the explorer</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="flex items-center border-b border-border bg-background/50 overflow-x-auto scrollbar-thin">
        {openFiles.map((file) => {
          const fileLang = getLanguageFromExtension(file.name);
          return (
            <div
              key={file.id}
              className={`flex items-center gap-2 px-3 py-2 border-r border-border cursor-pointer group min-w-0 ${
                file.id === activeFileId
                  ? "bg-card border-b-2 border-b-primary"
                  : "hover-elevate"
              }`}
              onClick={() => onTabSelect(file.id)}
              data-testid={`tab-${file.id}`}
            >
              <FileIcon language={fileLang} className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-sm truncate max-w-32">{file.name}</span>
              {file.isDirty && (
                <Circle className="w-2 h-2 fill-primary text-primary flex-shrink-0" />
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-4 w-4 opacity-0 group-hover:opacity-100 flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onFileClose(file.id);
                }}
                data-testid={`close-tab-${file.id}`}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          );
        })}
      </div>

      {activeFile && (
        <div className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground border-b border-border bg-background/30">
          <span className="truncate">{activeFile.path}</span>
          <span className="ml-auto flex items-center gap-2 flex-shrink-0">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0" data-testid="language-badge">
              {getLanguageDisplayName(language)}
            </Badge>
            <span>
              Ln {cursorPosition.line}, Col {cursorPosition.column}
            </span>
          </span>
          {activeFile.isDirty && (
            <Button
              size="sm"
              variant="ghost"
              className="h-5 px-2 text-xs flex-shrink-0"
              onClick={() => onFileSave(activeFile.id)}
              data-testid="button-save-file"
            >
              <Save className="w-3 h-3 mr-1" />
              Save
            </Button>
          )}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div 
          ref={lineNumbersRef}
          className="w-12 flex-shrink-0 bg-background/30 text-right pr-3 py-2 select-none border-r border-border overflow-hidden"
        >
          {lines.map((_, i) => (
            <div
              key={i}
              className={`text-xs leading-6 font-mono ${
                cursorPosition.line === i + 1
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
          ))}
        </div>

        <div className="flex-1 relative overflow-hidden">
          <pre
            ref={preRef}
            className="absolute inset-0 p-2 font-mono text-sm leading-6 whitespace-pre overflow-auto pointer-events-none"
            dangerouslySetInnerHTML={{
              __html: syntaxHighlight(activeFile?.content || '', language)
            }}
            aria-hidden="true"
          />
          <textarea
            ref={textareaRef}
            value={activeFile?.content || ''}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onSelect={updateCursorPosition}
            onClick={updateCursorPosition}
            onScroll={handleScroll}
            className="absolute inset-0 w-full h-full p-2 font-mono text-sm leading-6 bg-transparent text-transparent caret-foreground resize-none outline-none overflow-auto"
            spellCheck={false}
            data-testid="code-textarea"
          />
        </div>
      </div>
    </div>
  );
}
