const LANGUAGE_COLORS: Record<string, string> = {
  Python: '#3572a5',
  TypeScript: '#3178c6',
  JavaScript: '#e8d44d',
  Rust: '#f08c3a',
  Go: '#00add8',
  'C++': '#f34b7d',
  C: '#8b8b9e',
  Java: '#b07219',
  TeX: '#3d6117',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
};

const FALLBACK_COLOR = '#8b8b9e';

export function languageColor(language: string): string {
  return LANGUAGE_COLORS[language] ?? FALLBACK_COLOR;
}
