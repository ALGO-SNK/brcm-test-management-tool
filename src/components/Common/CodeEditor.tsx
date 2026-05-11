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

// Point @monaco-editor/react at the local Monaco we bundled — no CDN fetch.
// This must be set ONCE per app lifetime.
loader.config({ monaco });

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
function detectLanguage(filePath: string | null | undefined): string {
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

export interface CodeEditorProps {
  /** Full path of the file (used for language detection only). */
  filePath?: string | null;
  /** File content to display. */
  value: string;
  /** Read-only mode (default true — explicit Edit toggle in parent enables write). */
  readOnly?: boolean;
  /** Called on each keystroke when editable. */
  onChange?: (value: string) => void;
  /** Theme: 'dark' or 'light'. Defaults to dark to match the app. */
  theme?: 'dark' | 'light';
  /** Word wrap toggle. */
  wordWrap?: boolean;
  /** Called when editor mounts — useful for attaching keybindings. */
  onMount?: (editor: MonacoEditorNS.IStandaloneCodeEditor) => void;
}

export function CodeEditor({
  filePath,
  value,
  readOnly = true,
  onChange,
  theme = 'dark',
  wordWrap = false,
  onMount,
}: CodeEditorProps) {
  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const language = detectLanguage(filePath);
  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'vs';

  // Keep readOnly in sync if the prop changes after mount
  useEffect(() => {
    const editor = editorRef.current;
    if (editor) {
      editor.updateOptions({ readOnly });
    }
  }, [readOnly]);

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
        onMount?.(editor);
      }}
      options={{
        readOnly,
        domReadOnly: readOnly,
        fontSize: 12.5,
        fontFamily: "'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
        lineNumbers: 'on',
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
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
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
