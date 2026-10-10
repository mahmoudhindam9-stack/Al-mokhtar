from pathlib import Path
p = Path('src/shared/utils/printAccountingDocument.ts')
s = p.read_text(encoding='utf-8')
old = '''const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>\\\\\\"]/g, (c) => ({\n  "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;",\n}[c]));'''
new = '''const escapeHtml = (value: unknown) => {\n  const entities: Record<string, string> = {\n    "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;",\n  };\n  return String(value ?? "").replace(/[&<>\"\\\\]/g, (c) => entities[c] || c);\n};'''
if old not in s:
    # Replace the whole function defensively if formatting differs.
    import re
    s, n = re.subn(r'const escapeHtml = \(value: unknown\) =>[\\s\\S]*?\n\nexport function printAccountingDocument', new + '\n\nexport function printAccountingDocument', s, count=1)
    if n != 1:
        raise SystemExit('escapeHtml function not found')
else:
    s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
print('print helper repaired')
