function toPascalToken(token: string): string {
  if (!token) return '';
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

export function buildAutomatedMethodName(testTitle: string, testId: number): string {
  const sanitized = testTitle
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map(toPascalToken)
    .join('');

  const baseName = sanitized || 'AutomatedTest';
  const prefixed = /^[A-Za-z_]/.test(baseName) ? baseName : `Test${baseName}`;
  return `TC${testId}_${prefixed}`;
}

export function buildAutomatedMethodCode(methodName: string): string {
  return `[Test]\npublic void ${methodName}() => CommonUtility.CallCommonTestCase(TestCaseList);\n`;
}

export function buildAutomatedTestFullName(className: string, methodName: string): string {
  return `BromCom.Tests.TestCases.${className}.${methodName}`;
}

export function parseAutomatedTestFullName(fullName: string): { className: string; methodName: string } | null {
  const trimmed = fullName.trim();
  if (!trimmed) return null;

  const parts = trimmed.split('.').filter(Boolean);
  if (parts.length < 2) return null;

  const methodName = parts[parts.length - 1];
  const className = parts[parts.length - 2];
  if (!className || !methodName) return null;

  return { className, methodName };
}

export function getClassNameFromFilePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const fileName = normalized.split('/').pop() ?? '';
  return fileName.replace(/\.cs$/i, '');
}

export function ensureMethodDoesNotExist(fileContent: string, methodName: string): void {
  const escapedMethodName = methodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const methodPattern = new RegExp(`\\bpublic\\s+void\\s+${escapedMethodName}\\s*\\(`);
  if (methodPattern.test(fileContent)) {
    throw new Error('A test method with this name already exists in the selected class file.');
  }
}

export function insertAutomatedTestMethod(fileContent: string, methodCode: string): string {
  const lineEnding = fileContent.includes('\r\n') ? '\r\n' : '\n';
  const normalizedContent = fileContent.replace(/\r\n/g, '\n');
  const normalizedMethod = methodCode.replace(/\r\n/g, '\n').trim();
  const classMatch = /class\s+\w+[^{]*\{/.exec(normalizedContent);

  if (!classMatch || typeof classMatch.index !== 'number') {
    throw new Error('Could not find a class definition in the selected file.');
  }

  const classOpenBraceIndex = normalizedContent.indexOf('{', classMatch.index);
  if (classOpenBraceIndex === -1) {
    throw new Error('Could not find the class body in the selected file.');
  }

  let depth = 0;
  let classCloseBraceIndex = -1;

  for (let index = classOpenBraceIndex; index < normalizedContent.length; index += 1) {
    const char = normalizedContent[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        classCloseBraceIndex = index;
        break;
      }
    }
  }

  if (classCloseBraceIndex === -1) {
    throw new Error('Could not determine where to insert the new automated test method.');
  }

  const classLineStart = normalizedContent.lastIndexOf('\n', classMatch.index);
  const classLine = normalizedContent.slice(classLineStart + 1, classOpenBraceIndex);
  const classIndent = (classLine.match(/^\s*/) ?? [''])[0];

  const classBody = normalizedContent.slice(classOpenBraceIndex + 1, classCloseBraceIndex);
  const classBodyLines = classBody.split('\n');
  const memberIndentCandidates = classBodyLines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed === '{' || trimmed === '}') {
        return null;
      }
      const leading = (line.match(/^\s*/) ?? [''])[0];
      return leading.length > classIndent.length ? leading : null;
    })
    .filter((indent): indent is string => typeof indent === 'string');
  const memberIndent = memberIndentCandidates.length > 0
    ? memberIndentCandidates.reduce((smallest, indent) => (
      indent.length < smallest.length ? indent : smallest
    ))
    : `${classIndent}    `;
  const methodLines = normalizedMethod.split('\n');
  const nonEmptyMethodLines = methodLines.filter((line) => line.trim().length > 0);
  const commonLeadingIndent = nonEmptyMethodLines.reduce((smallest, line) => {
    const leading = (line.match(/^\s*/) ?? [''])[0].length;
    return smallest === null ? leading : Math.min(smallest, leading);
  }, null as number | null) ?? 0;

  const formattedMethod = methodLines
    .map((line) => {
      if (line.trim().length === 0) {
        return '';
      }
      return `${memberIndent}${line.slice(commonLeadingIndent)}`;
    })
    .join('\n')
    .trimEnd();

  const closeLineStart = normalizedContent.lastIndexOf('\n', classCloseBraceIndex - 1) + 1;
  const closeIndent = normalizedContent.slice(closeLineStart, classCloseBraceIndex);
  const beforeClose = normalizedContent.slice(0, closeLineStart).replace(/\s*$/, '');
  const afterClose = normalizedContent.slice(classCloseBraceIndex);
  const nextContent = `${beforeClose}\n\n${formattedMethod}\n${closeIndent}${afterClose}`.replace(/\n/g, lineEnding);
  return nextContent;
}
