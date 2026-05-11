// Code editor — wraps Monaco via @monaco-editor/react with sensible defaults
// for the IDE-style code preview/edit experience.
//
// - Uses local Monaco bundle (no CDN) via the loader config below so the
//   app works offline in Electron.
// - Auto-picks language from file extension.
// - Auto-syncs theme to app theme (light/dark).
// - Read-only or editable based on prop.

import { useEffect, useRef } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import type { editor as MonacoEditorNS } from 'monaco-editor';
import * as monaco from 'monaco-editor';
import { useThemeContext } from '../../context/useThemeContext';
import type { ThemeMode } from '../../context/themeContext.shared';

// Point @monaco-editor/react at the local Monaco we bundled — no CDN fetch.
// This must be set ONCE per app lifetime.
loader.config({ monaco });

// ---------------------------------------------------------------------------
// JetBrains-flavored token rules — colors that make code "look" like IntelliJ
// regardless of light/dark mode. The chrome (background, gutter, line
// highlight) is filled in at runtime from the active app theme's CSS
// variables so the editor blends into whatever theme the user picked.
// ---------------------------------------------------------------------------

// Token rules for dark surfaces — JetBrains Darcula palette.
const JETBRAINS_DARK_RULES: MonacoEditorNS.ITokenThemeRule[] = [
  { token: '', foreground: 'A9B7C6' },
  { token: 'comment', foreground: '808080', fontStyle: 'italic' },
  { token: 'keyword', foreground: 'CC7832', fontStyle: 'bold' },
  { token: 'string', foreground: '6A8759' },
  { token: 'string.escape', foreground: 'CC7832' },
  { token: 'number', foreground: '6897BB' },
  { token: 'regexp', foreground: '6A8759' },
  { token: 'type', foreground: 'A9B7C6' },
  { token: 'type.identifier', foreground: 'FFC66D' },
  { token: 'class', foreground: 'A9B7C6' },
  { token: 'interface', foreground: 'A9B7C6' },
  { token: 'identifier', foreground: 'A9B7C6' },
  { token: 'identifier.function', foreground: 'FFC66D' },
  { token: 'variable', foreground: 'A9B7C6' },
  { token: 'variable.predefined', foreground: '9876AA', fontStyle: 'italic' },
  { token: 'variable.parameter', foreground: 'A9B7C6' },
  { token: 'constant', foreground: '9876AA' },
  { token: 'annotation', foreground: 'BBB529' },
  { token: 'attribute.name', foreground: 'BBB529' },
  { token: 'tag', foreground: 'E8BF6A' },
  { token: 'delimiter', foreground: 'A9B7C6' },
  { token: 'operator', foreground: 'A9B7C6' },
  { token: 'metatag', foreground: 'BBB529' },
];

// Token rules for light surfaces — IntelliJ IDEA Light palette.
const JETBRAINS_LIGHT_RULES: MonacoEditorNS.ITokenThemeRule[] = [
  { token: '', foreground: '000000' },
  { token: 'comment', foreground: '8C8C8C', fontStyle: 'italic' },
  { token: 'keyword', foreground: '0033B3', fontStyle: 'bold' },
  { token: 'string', foreground: '067D17' },
  { token: 'string.escape', foreground: '0033B3' },
  { token: 'number', foreground: '1750EB' },
  { token: 'regexp', foreground: '264EFF' },
  { token: 'type.identifier', foreground: '00627A' },
  { token: 'identifier.function', foreground: '00627A' },
  { token: 'variable.predefined', foreground: '871094', fontStyle: 'italic' },
  { token: 'constant', foreground: '871094' },
  { token: 'annotation', foreground: '9E880D' },
  { token: 'attribute.name', foreground: '9E880D' },
  { token: 'tag', foreground: '0033B3' },
];

// Normalize a CSS color string read from getComputedStyle into Monaco's
// expected #RRGGBB / #RRGGBBAA form. Monaco rejects `rgb(...)` or `hsl(...)`.
function toMonacoColor(input: string, fallback: string): string {
  const value = input.trim();
  if (!value) return fallback;
  if (value.startsWith('#')) {
    // Expand 3-digit / 4-digit shorthand to 6 / 8 digits.
    if (value.length === 4) {
      const r = value[1];
      const g = value[2];
      const b = value[3];
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    if (value.length === 5) {
      const r = value[1];
      const g = value[2];
      const b = value[3];
      const a = value[4];
      return `#${r}${r}${g}${g}${b}${b}${a}${a}`;
    }
    return value;
  }
  const rgbMatch = value.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map((p) => p.trim());
    const r = Math.max(0, Math.min(255, parseInt(parts[0] ?? '0', 10)));
    const g = Math.max(0, Math.min(255, parseInt(parts[1] ?? '0', 10)));
    const b = Math.max(0, Math.min(255, parseInt(parts[2] ?? '0', 10)));
    const hex = (n: number) => n.toString(16).padStart(2, '0');
    let out = `#${hex(r)}${hex(g)}${hex(b)}`;
    if (parts.length === 4) {
      const a = Math.max(0, Math.min(1, parseFloat(parts[3] ?? '1')));
      out += hex(Math.round(a * 255));
    }
    return out;
  }
  return fallback;
}

// Pick the chrome colors out of :root CSS variables — works regardless of
// which of the 13 app themes is active.
function readAppChromeColors() {
  const root = document.documentElement;
  const cs = window.getComputedStyle(root);
  const read = (varName: string, fallback: string) =>
    toMonacoColor(cs.getPropertyValue(varName), fallback);
  return {
    background: read('--color-surface', '#1e1e1e'),
    backgroundRaised: read('--color-surface-raised', '#252526'),
    foreground: read('--color-text', '#dddddd'),
    foregroundMuted: read('--color-text-muted', '#888888'),
    border: read('--color-border', '#333333'),
    borderStrong: read('--color-border-strong', '#444444'),
    surfaceHover: read('--color-surface-hover', '#2a2d2e'),
    surfaceSelected: read('--color-surface-selected', '#264f78'),
  };
}

// Decide whether the active app theme is dark-ish so we can pick the right
// token rule set. Looks at the background's luminance.
function isDarkSurface(hex: string): boolean {
  const s = hex.replace('#', '');
  if (s.length < 6) return true;
  const r = parseInt(s.substring(0, 2), 16);
  const g = parseInt(s.substring(2, 4), 16);
  const b = parseInt(s.substring(4, 6), 16);
  // Rec.709 luma — anything below ~0.45 we treat as dark.
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma < 0.45;
}

// Register / refresh the "app-themed" Monaco theme. Called once on import and
// then whenever the app theme changes (handled by the CodeEditor effect).
function defineAppThemedMonacoTheme() {
  const chrome = readAppChromeColors();
  const dark = isDarkSurface(chrome.background);
  monaco.editor.defineTheme('jetbrains-app-themed', {
    base: dark ? 'vs-dark' : 'vs',
    inherit: true,
    rules: dark ? JETBRAINS_DARK_RULES : JETBRAINS_LIGHT_RULES,
    colors: {
      'editor.background': chrome.background,
      'editor.foreground': chrome.foreground,
      'editor.lineHighlightBackground': chrome.surfaceHover,
      'editor.selectionBackground': chrome.surfaceSelected,
      'editorCursor.foreground': chrome.foreground,
      'editorLineNumber.foreground': chrome.foregroundMuted,
      'editorLineNumber.activeForeground': chrome.foreground,
      'editorGutter.background': chrome.background,
      'editorIndentGuide.background': chrome.border,
      'editorIndentGuide.activeBackground': chrome.borderStrong,
      'editorWhitespace.foreground': chrome.border,
      'minimap.background': chrome.background,
      'editorWidget.background': chrome.backgroundRaised,
      'editorWidget.border': chrome.border,
      'editorSuggestWidget.background': chrome.backgroundRaised,
      'editorSuggestWidget.border': chrome.border,
      'editorSuggestWidget.selectedBackground': chrome.surfaceSelected,
      'editorHoverWidget.background': chrome.backgroundRaised,
      'editorHoverWidget.border': chrome.border,
    },
  });
}

// Define once on module load; the editor instance re-defines whenever the
// app theme changes so the colors stay in sync.
defineAppThemedMonacoTheme();

// Set up Web Workers so syntax tokenizing runs off the main thread.
// Vite's `?worker` import returns a Worker constructor.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite worker import has no TS types by default
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

// Tell Monaco which worker class to spawn for each language.
// `self.MonacoEnvironment` is the documented hook.
(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    switch (label) {
      case 'json':
        return new JsonWorker();
      case 'css':
      case 'scss':
      case 'less':
        return new CssWorker();
      case 'html':
      case 'handlebars':
      case 'razor':
        return new HtmlWorker();
      case 'typescript':
      case 'javascript':
        return new TsWorker();
      default:
        return new EditorWorker();
    }
  },
};

// Map file extension → Monaco language id. Monaco has C# built-in.
export function detectLanguage(filePath: string | null | undefined): string {
  if (!filePath) return 'plaintext';
  const lower = filePath.toLowerCase();
  const ext = lower.includes('.') ? lower.split('.').pop() ?? '' : '';
  const map: Record<string, string> = {
    cs: 'csharp',
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    scss: 'scss',
    html: 'html',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    sql: 'sql',
    py: 'python',
    java: 'java',
    sh: 'shell',
    bat: 'bat',
    ps1: 'powershell',
    config: 'xml',
    csproj: 'xml',
    runsettings: 'xml',
  };
  return map[ext] || 'plaintext';
}

// Map every app ThemeMode to a Monaco built-in theme.
// Monaco only ships vs / vs-dark / hc-black / hc-light, so we bucket the
// 13 app themes into the closest match.
// All non-high-contrast themes use the dynamic "app-themed" theme; only the
// high-contrast app theme falls back to Monaco's built-in hc theme for
// accessibility reasons.
function appThemeToMonacoTheme(mode: ThemeMode): string {
  if (mode === 'high-contrast') return 'hc-black';
  return 'jetbrains-app-themed';
}

export interface CodeEditorProps {
  /** Full path of the file (used for language detection only). */
  filePath?: string | null;
  /** File content to display. */
  value: string;
  /** Read-only mode (default true — explicit Edit toggle in parent enables write). */
  readOnly?: boolean;
  /** Called on each keystroke when editable. */
  onChange?: (value: string) => void;
  /** Optional override; otherwise follows the app theme via ThemeContext. */
  theme?: 'dark' | 'light';
  /** Word wrap toggle. */
  wordWrap?: boolean;
  /** Called when editor mounts — useful for attaching keybindings. */
  onMount?: (editor: MonacoEditorNS.IStandaloneCodeEditor) => void;
  /** Called whenever the cursor moves. Use for status-bar position display. */
  onCursorChange?: (pos: { line: number; column: number }) => void;
  /** Breakpoint line numbers (1-based) for the current file — rendered as gutter dots. */
  breakpoints?: number[];
  /** Called when the user toggles a breakpoint by clicking the glyph margin. */
  onToggleBreakpoint?: (line: number) => void;
  /** Line that the debugger is currently paused on (1-based). Rendered as a yellow execution pointer. */
  executionLine?: number | null;
}

export function CodeEditor({
  filePath,
  value,
  readOnly = true,
  onChange,
  theme,
  wordWrap = false,
  onMount,
  onCursorChange,
  breakpoints,
  onToggleBreakpoint,
  executionLine,
}: CodeEditorProps) {
  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const decorationIdsRef = useRef<string[]>([]);
  const executionDecorationIdsRef = useRef<string[]>([]);
  // Keep latest toggle callback in a ref so the once-attached mouse handler always uses fresh state.
  const onToggleBreakpointRef = useRef(onToggleBreakpoint);
  useEffect(() => { onToggleBreakpointRef.current = onToggleBreakpoint; }, [onToggleBreakpoint]);
  const language = detectLanguage(filePath);
  // Resolve theme: explicit prop wins, else follow the app's ThemeContext.
  const { mode: appThemeMode } = useThemeContext();
  const monacoTheme = theme
    ? theme === 'dark' ? 'vs-dark' : 'vs'
    : appThemeToMonacoTheme(appThemeMode);

  // Keep readOnly in sync if the prop changes after mount
  useEffect(() => {
    const editor = editorRef.current;
    if (editor) {
      editor.updateOptions({ readOnly });
    }
  }, [readOnly]);

  // Whenever the app theme changes, re-read the CSS variables and re-define
  // the Monaco theme so the editor background / gutter / line highlight
  // match the rest of the app. Monaco repaints automatically when the
  // theme is re-defined under the same name.
  useEffect(() => {
    // CSS variables on :root are updated synchronously by the ThemeContext;
    // schedule one microtask later so we read the post-change values.
    const id = requestAnimationFrame(() => {
      defineAppThemedMonacoTheme();
    });
    return () => cancelAnimationFrame(id);
  }, [appThemeMode]);

  // Sync breakpoint decorations (red dot in the glyph margin) whenever the
  // breakpoint set or the active model changes. Stable across file switches
  // because we re-apply on filePath / value changes too.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;
    const newDecorations: MonacoEditorNS.IModelDeltaDecoration[] = (breakpoints ?? []).map((line) => ({
      range: new monaco.Range(line, 1, line, 1),
      options: {
        isWholeLine: false,
        glyphMarginClassName: 'monaco-bp-glyph',
        glyphMarginHoverMessage: { value: 'Breakpoint (click to remove)' },
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
      },
    }));
    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, newDecorations);
  }, [breakpoints, filePath, value]);

  // Sync execution-pointer decoration (yellow arrow + line highlight) when paused.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;
    const decos: MonacoEditorNS.IModelDeltaDecoration[] =
      executionLine && executionLine > 0
        ? [
            {
              range: new monaco.Range(executionLine, 1, executionLine, 1),
              options: {
                isWholeLine: true,
                glyphMarginClassName: 'monaco-exec-glyph',
                className: 'monaco-exec-line',
                glyphMarginHoverMessage: { value: 'Execution paused here' },
                stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
              },
            },
          ]
        : [];
    executionDecorationIdsRef.current = editor.deltaDecorations(
      executionDecorationIdsRef.current,
      decos,
    );
  }, [executionLine, filePath, value]);

  return (
    <Editor
      height="100%"
      width="100%"
      path={filePath ?? undefined}
      language={language}
      theme={monacoTheme}
      value={value}
      onChange={(next) => onChange?.(next ?? '')}
      onMount={(editor) => {
        editorRef.current = editor;
        // Emit cursor position changes for the parent's status bar.
        if (onCursorChange) {
          const pos = editor.getPosition();
          if (pos) onCursorChange({ line: pos.lineNumber, column: pos.column });
          editor.onDidChangeCursorPosition((e) => {
            onCursorChange({ line: e.position.lineNumber, column: e.position.column });
          });
        }
        // Click on the glyph margin → toggle breakpoint on that line.
        editor.onMouseDown((e) => {
          // 2 = GUTTER_GLYPH_MARGIN in MouseTargetType
          if (e.target.type === 2 && e.target.position) {
            const cb = onToggleBreakpointRef.current;
            if (cb) cb(e.target.position.lineNumber);
          }
        });
        onMount?.(editor);
      }}
      options={{
        readOnly,
        domReadOnly: readOnly,
        fontSize: 12.5,
        fontFamily: "'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
        lineNumbers: 'on',
        glyphMargin: true,
        minimap: { enabled: true, scale: 1, renderCharacters: false },
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        wordWrap: wordWrap ? 'on' : 'off',
        wrappingIndent: 'indent',
        renderLineHighlight: 'all',
        roundedSelection: false,
        automaticLayout: true,
        tabSize: 4,
        insertSpaces: true,
        scrollbar: {
          // Match the app's global scrollbar width (10px) — sliders styled in CSS.
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
          verticalSliderSize: 10,
          horizontalSliderSize: 10,
          useShadows: false,
          alwaysConsumeMouseWheel: false,
        },
        guides: { indentation: true, bracketPairs: true },
        bracketPairColorization: { enabled: true },
        renderWhitespace: 'selection',
        contextmenu: true,
        fixedOverflowWidgets: true,
      }}
    />
  );
}
