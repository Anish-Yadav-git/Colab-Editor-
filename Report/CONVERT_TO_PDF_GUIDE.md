# How to Convert PROJECT_REPORT.md to PDF

## Quick Methods

### Method 1: Using Pandoc (Recommended)

**Install Pandoc:**
- Mac: `brew install pandoc`
- Windows: Download from https://pandoc.org/installing.html
- Linux: `sudo apt-get install pandoc`

**Convert to PDF:**
```bash
pandoc PROJECT_REPORT.md -o PROJECT_REPORT.pdf \
  --toc \
  --number-sections \
  --pdf-engine=xelatex \
  -V geometry:margin=1in \
  -V fontsize=12pt \
  -V documentclass=report
```

**For better formatting:**
```bash
pandoc PROJECT_REPORT.md -o PROJECT_REPORT.pdf \
  --toc \
  --toc-depth=3 \
  --number-sections \
  --pdf-engine=xelatex \
  -V geometry:margin=1in \
  -V fontsize=11pt \
  -V documentclass=report \
  -V linkcolor=blue \
  -V urlcolor=blue \
  --highlight-style=tango
```

### Method 2: Using VS Code Extension

1. Install "Markdown PDF" extension in VS Code
2. Open PROJECT_REPORT.md
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
4. Type "Markdown PDF: Export (pdf)"
5. Select the option and wait for conversion

### Method 3: Using Online Converter

1. Go to https://www.markdowntopdf.com/
2. Upload PROJECT_REPORT.md
3. Click "Convert"
4. Download the PDF

### Method 4: Using Typora (If you have it)

1. Open PROJECT_REPORT.md in Typora
2. Go to File → Export → PDF
3. Choose location and save

## Customizing the PDF

### Adding a Custom Title Page

Create a file `title.tex`:
```latex
\begin{titlepage}
\centering
\vspace*{2cm}
{\Huge\bfseries Real-Time Collaborative Document Editor\par}
\vspace{0.5cm}
{\Large A CRDT-Based Web Application\par}
\vspace{2cm}
{\Large\itshape Your Name\par}
\vspace{1cm}
{\large Your Institution\par}
\vspace{1cm}
{\large January 2025\par}
\vfill
{\large Academic Project Report\par}
\end{titlepage}
```

Then convert with:
```bash
pandoc PROJECT_REPORT.md -o PROJECT_REPORT.pdf \
  --include-before-body=title.tex \
  --toc \
  --number-sections \
  --pdf-engine=xelatex
```

### Adjusting Margins and Font

```bash
pandoc PROJECT_REPORT.md -o PROJECT_REPORT.pdf \
  --toc \
  --number-sections \
  --pdf-engine=xelatex \
  -V geometry:top=1in \
  -V geometry:bottom=1in \
  -V geometry:left=1.25in \
  -V geometry:right=1.25in \
  -V fontsize=12pt \
  -V mainfont="Times New Roman"
```

### Adding Page Numbers

```bash
pandoc PROJECT_REPORT.md -o PROJECT_REPORT.pdf \
  --toc \
  --number-sections \
  --pdf-engine=xelatex \
  -V geometry:margin=1in \
  -V pagestyle=plain
```

## Converting to DOCX (Microsoft Word)

```bash
pandoc PROJECT_REPORT.md -o PROJECT_REPORT.docx \
  --toc \
  --number-sections \
  --reference-doc=custom-reference.docx
```

You can then open in Word and adjust formatting as needed.

## Troubleshooting

### "pandoc: command not found"
- Install Pandoc first (see installation instructions above)

### "xelatex not found"
- Install LaTeX distribution:
  - Mac: `brew install --cask mactex`
  - Windows: Install MiKTeX from https://miktex.org/
  - Linux: `sudo apt-get install texlive-xetex`

### PDF looks wrong
- Try different PDF engines: `--pdf-engine=pdflatex` or `--pdf-engine=lualatex`
- Adjust margins and font size
- Check if special characters are causing issues

### Tables not rendering properly
- Pandoc handles most Markdown tables well
- For complex tables, consider converting to HTML first, then to PDF

## Tips for Best Results

1. **Preview First**: Convert to HTML first to check formatting
   ```bash
   pandoc PROJECT_REPORT.md -o PROJECT_REPORT.html --standalone
   ```

2. **Use Consistent Formatting**: The report already uses consistent Markdown formatting

3. **Check Page Breaks**: Add `\newpage` in Markdown where you want page breaks

4. **Adjust for Your Institution**: Some institutions have specific formatting requirements

5. **Include Metadata**: Add YAML front matter for better PDF metadata:
   ```yaml
   ---
   title: "Real-Time Collaborative Document Editor"
   author: "Your Name"
   date: "January 2025"
   ---
   ```

## Example: Complete Conversion Command

```bash
# Full-featured PDF conversion
pandoc PROJECT_REPORT.md -o PROJECT_REPORT.pdf \
  --toc \
  --toc-depth=3 \
  --number-sections \
  --pdf-engine=xelatex \
  -V geometry:top=1in \
  -V geometry:bottom=1in \
  -V geometry:left=1.25in \
  -V geometry:right=1.25in \
  -V fontsize=11pt \
  -V documentclass=report \
  -V linkcolor=blue \
  -V urlcolor=blue \
  -V toccolor=black \
  --highlight-style=tango \
  --metadata title="Real-Time Collaborative Document Editor" \
  --metadata author="Your Name" \
  --metadata date="January 2025"
```

This will create a professional-looking PDF with:
- Table of contents
- Numbered sections
- Proper margins
- Clickable links
- Syntax highlighting for code
- Professional formatting

## Need Help?

If you encounter issues:
1. Check Pandoc documentation: https://pandoc.org/MANUAL.html
2. Try simpler conversion first, then add options
3. Verify all required software is installed
4. Check for special characters that might cause issues

---

**Note**: The report is already well-formatted in Markdown, so most converters should produce good results with default settings.
