// Adapted from: hisol-unified-mcp/src/systems/context-manager.ts @ v1.0
// Tech context extraction — pure algorithm, no external API calls

import type { TechContext } from './types';

const FRAMEWORK_PATTERNS: Record<string, string[]> = {
  react:     ['react', 'jsx', 'tsx', 'usestate', 'useeffect', 'hook', 'component'],
  vue:       ['vue', 'nuxt', '.vue', 'composition api', 'pinia', 'vuex'],
  angular:   ['angular', 'ngmodule', 'injectable', 'ngrx'],
  next:      ['next.js', 'nextjs', 'getserversideprops', 'getstaticprops', 'app router'],
  vite:      ['vite', 'vite.config'],
  express:   ['express', 'req.body', 'res.json', 'router'],
  nest:      ['nestjs', 'nest.js', '@controller', '@injectable', '@module'],
  fastapi:   ['fastapi', 'pydantic', 'uvicorn'],
  prisma:    ['prisma', 'prisma client', 'schema.prisma'],
  firebase:  ['firebase', 'firestore', 'firebase auth', 'onSnapshot'],
  supabase:  ['supabase', 'supabase client'],
  tailwind:  ['tailwind', 'tw-', 'className="'],
};

const LANGUAGE_PATTERNS: Record<string, string[]> = {
  TypeScript: ['typescript', '.ts', 'tsx', 'interface ', 'type ', ': string', ': number', ': boolean', 'generic', '<T>'],
  JavaScript: ['javascript', '.js', 'const ', 'let ', 'var ', 'function ', '=>'],
  Python:     ['python', '.py', 'def ', 'import ', 'pip ', 'class ', '    '],
  Rust:       ['rust', '.rs', 'fn ', 'mut ', 'impl ', 'struct ', 'cargo'],
  Go:         ['golang', '.go', 'func ', 'goroutine', 'go mod'],
  Java:       ['java', '.java', 'public class', 'spring boot', 'maven', 'gradle'],
  Swift:      ['swift', 'swiftui', '.swift', 'let ', 'var ', '@State'],
  Kotlin:     ['kotlin', '.kt', 'fun ', 'coroutine', 'jetpack'],
  CSS:        ['css', 'scss', 'sass', 'tailwind', 'styled-components', 'emotion'],
};

const TOOL_PATTERNS: Record<string, string[]> = {
  Docker:     ['docker', 'dockerfile', 'docker-compose', 'container'],
  Git:        ['git', 'github', 'gitlab', 'branch', 'commit', 'pr', 'pull request'],
  Webpack:    ['webpack', 'bundle', 'loader', 'plugin'],
  Jest:       ['jest', 'describe(', 'it(', 'expect(', 'beforeEach'],
  Vitest:     ['vitest', 'vi.mock', 'vi.fn'],
  ESLint:     ['eslint', '.eslintrc', 'lint'],
  Prettier:   ['prettier', '.prettierrc', 'format'],
};

export class ContextManager {
  private context: TechContext = {
    project_context: {
      frameworks: [],
      languages: [],
      tools: [],
      patterns: [],
    },
    session_tech_count: 0,
  };

  extractHints(text: string): void {
    const lower = text.toLowerCase();

    // Detect frameworks
    const newFrameworks = new Set(this.context.project_context.frameworks);
    for (const [fw, patterns] of Object.entries(FRAMEWORK_PATTERNS)) {
      if (patterns.some(p => lower.includes(p.toLowerCase()))) {
        newFrameworks.add(fw);
      }
    }
    this.context.project_context.frameworks = [...newFrameworks];

    // Detect languages
    const newLanguages = new Set(this.context.project_context.languages);
    for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
      const hits = patterns.filter(p => lower.includes(p.toLowerCase())).length;
      if (hits >= 2) { // Require at least 2 pattern hits to reduce false positives
        newLanguages.add(lang);
      }
    }
    this.context.project_context.languages = [...newLanguages];

    // Detect tools
    const newTools = new Set(this.context.project_context.tools);
    for (const [tool, patterns] of Object.entries(TOOL_PATTERNS)) {
      if (patterns.some(p => lower.includes(p.toLowerCase()))) {
        newTools.add(tool);
      }
    }
    this.context.project_context.tools = [...newTools];

    this.context.session_tech_count++;
  }

  getContext(): TechContext {
    return this.context;
  }

  reset(): void {
    this.context = {
      project_context: { frameworks: [], languages: [], tools: [], patterns: [] },
      session_tech_count: 0,
    };
  }
}
