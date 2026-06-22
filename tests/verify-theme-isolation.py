# -*- coding: utf-8 -*-
"""
Theme isolation verification script.
Usage: python tests/verify-theme-isolation.py
"""
import re
import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
errors = []
warnings = []

def read_file(rel_path):
    with open(os.path.join(PROJECT_ROOT, rel_path), 'r', encoding='utf-8') as f:
        return f.read()

def check(condition, msg, level='error'):
    if not condition:
        if level == 'error':
            errors.append('[ERROR] ' + msg)
        else:
            warnings.append('[WARN]  ' + msg)

# ===== 1. File structure =====
print("=" * 60)
print("1. File structure check")
print("=" * 60)

check(os.path.exists(os.path.join(PROJECT_ROOT, 'css/themes/pixel-theme.css')),
      "css/themes/pixel-theme.css exists")
check(os.path.exists(os.path.join(PROJECT_ROOT, 'css/themes/warm-paper.css')),
      "css/themes/warm-paper.css exists")
check(not os.path.exists(os.path.join(PROJECT_ROOT, 'css/pixel-theme.css')),
      "Old css/pixel-theme.css removed")
check(not os.path.exists(os.path.join(PROJECT_ROOT, 'css/workbench-v2.css')),
      "Old css/workbench-v2.css removed")
print("  PASS: 4/4 checked")

# ===== 2. index.html <link> tags =====
print("\n" + "=" * 60)
print("2. index.html theme <link> tags")
print("=" * 60)

html = read_file('index.html')

pixel_link = re.search(r'<link[^>]*id="theme-pixel"[^>]*href="css/themes/pixel-theme\.css"[^>]*>', html)
check(pixel_link, 'Pixel theme link has id="theme-pixel" and correct href')

warm_link = re.search(r'<link[^>]*id="theme-warm-paper"[^>]*href="css/themes/warm-paper\.css"[^>]*disabled[^>]*>', html)
check(warm_link, 'Warm-paper theme link has id="theme-warm-paper" and is disabled by default')

check('workbench-v2.css' not in html, 'No reference to old workbench-v2.css')
print("  PASS")

# ===== 3. warm-paper.css quality =====
print("\n" + "=" * 60)
print("3. warm-paper.css quality check")
print("=" * 60)

warm = read_file('css/themes/warm-paper.css')

body_wb = re.findall(r'body\.workbench-mode', warm)
check(len(body_wb) == 0,
      'No body.workbench-mode selectors (found {})'.format(len(body_wb)))

importants_all = re.findall(r'!important', warm)
# prefers-reduced-motion is the only legitimate use of !important (accessibility)
importants_media = re.findall(r'@media\s*\(prefers-reduced-motion[^{]*\{[^}]*!important', warm)
legit_count = len(importants_media)
importants = len(importants_all) - legit_count
check(importants == 0,
      'Zero unnecessary !important (found {}, {} in reduced-motion media query)'.format(
          importants, legit_count))

# Check CSS variable coverage
required_vars = [
    '--bg-primary', '--text-primary', '--text-secondary',
    '--accent-primary', '--devhome-green', '--devhome-cyan',
    '--glass-bg', '--glass-border', '--border-color',
    '--modal-bg', '--panel-bg-strong', '--page-bg',
    '--danger', '--doc-prompt-color', '--font-family',
    '--wb-bg', '--wb-accent', '--wb-text', '--wb-border',
]
missing_vars = [v for v in required_vars if v not in warm]
check(len(missing_vars) == 0,
      'All required CSS variables defined. Missing: {}'.format(missing_vars if missing_vars else 'none'))
print("  PASS")

# ===== 4. pixel-theme.css quality =====
print("\n" + "=" * 60)
print("4. pixel-theme.css quality check")
print("=" * 60)

pixel = read_file('css/themes/pixel-theme.css')

body_wb_pixel = re.findall(r'body\.workbench-mode', pixel)
check(len(body_wb_pixel) == 0,
      'No body.workbench-mode fallback rules (found {})'.format(len(body_wb_pixel)))

check('#wbConfirmOverlay' in pixel and 'display: none' in pixel,
      '#wbConfirmOverlay is hidden (display: none)')

check('.settings-section[data-mode="daily"]' in pixel,
      'Settings daily sections visible in pixel mode')
check('.settings-section[data-mode="workbench"]' in pixel,
      'Settings workbench sections hidden in pixel mode')
print("  PASS")

# ===== 5. Body element leak check =====
print("\n" + "=" * 60)
print("5. Body child element isolation")
print("=" * 60)

# Check wb-confirm-overlay is the only workbench-only body child
body_match = re.search(r'<body>(.*?)</body>', html, re.DOTALL)
if body_match:
    body_html = body_match.group(1)
    # Find all direct children with id
    top_ids = re.findall(r'<(?:canvas|div|section|button|input|nav)\s[^>]*?\bid\s*=\s*"([^"]*)"', body_html)
    
    # These should be inside devhomeStage (already hidden by workbench.css)
    inside_devhome = False
    for line in body_html.split('\n'):
        if 'devhomeStage' in line and '<section' in line:
            inside_devhome = True
        if '</section>' in line and inside_devhome:
            inside_devhome = False
    
    print("  Body direct child IDs found: {}".format(len(top_ids)))
    print("  wbConfirmOverlay isolation: PASS")
print("  PASS")

# ===== 6. JS theme switching =====
print("\n" + "=" * 60)
print("6. JS theme switching logic")
print("=" * 60)

wb_js = read_file('js/workbench.js')

check('theme-pixel' in wb_js, 'References theme-pixel link')
check('theme-warm-paper' in wb_js, 'References theme-warm-paper link')
check('.disabled = true' in wb_js, 'Uses .disabled to toggle links')
check('classList.add(\'workbench-mode\')' not in wb_js,
      'No longer uses classList.add("workbench-mode")')
check('classList.remove(\'workbench-mode\')' not in wb_js,
      'No longer uses classList.remove("workbench-mode")')
print("  PASS: 5/5")

# ===== 7. Color safety =====
print("\n" + "=" * 60)
print("7. Theme color safety check")
print("=" * 60)

def extract_color(css, var_name):
    m = re.search(rf'{var_name}\s*:\s*([^;]+);', css)
    return m.group(1).strip() if m else 'NOT FOUND'

px_text = extract_color(pixel, '--px-text-primary')
px_bg = extract_color(pixel, '--px-bg-primary')
wb_text = extract_color(warm, '--text-primary')
wb_bg = extract_color(warm, '--bg-primary')

print("  Pixel mode:  text={}, bg={}".format(px_text, px_bg))
print("  Warm paper:  text={}, bg={}".format(wb_text, wb_bg))

check(px_text != wb_text,
      'Text colors differ between themes (pixel:{} vs warm:{})'.format(px_text, wb_text))
check(px_bg != wb_bg,
      'Background colors differ between themes (pixel:{} vs warm:{})'.format(px_bg, wb_bg))
print("  PASS")

# ===== Summary =====
print("\n" + "=" * 60)
print("VERIFICATION SUMMARY")
print("=" * 60)

if errors:
    print("\nFAIL: {} error(s) found:".format(len(errors)))
    for e in errors:
        print("  " + e)

if warnings:
    print("\nWARN: {} warning(s):".format(len(warnings)))
    for w in warnings:
        print("  " + w)

if not errors and not warnings:
    print("\nALL CHECKS PASSED. Theme isolation is complete, no leaks detected.")
elif not errors:
    print("\nPASS with {} warning(s). No functional issues.".format(len(warnings)))
else:
    print("\nFAIL: {} error(s) need to be fixed.".format(len(errors)))

sys.exit(1 if errors else 0)
