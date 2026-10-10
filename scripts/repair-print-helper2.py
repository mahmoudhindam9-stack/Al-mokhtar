from pathlib import Path
import re
p = Path('src/shared/utils/printAccountingDocument.ts')
s = p.read_text(encoding='utf-8')
replacement = '''const escapeHtml = (value: unknown) => {\n  const entities: Record<string, string> = {\n    "&": "&amp;",\n    "<": "&lt;",\n    ">": "&gt;",\n    "\\\"": "&quot;",\n  };\n  return String(value ?? "").replace(/[&<>\\\"]/g, (c) => entities[c] || c);\n};\n\nexport function printAccountingDocument'''
s, n = re.subn(r'const escapeHtml = \(value: unknown\) =>[\\s\\S]*?export function printAccountingDocument', replacement, s, count=1)
if n != 1:
    raise SystemExit('print helper escape function boundary not found')
p.write_text(s, encoding='utf-8')
print('print helper normalized')
