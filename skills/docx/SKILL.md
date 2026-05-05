---
name: docx
description: DOCX document processing skill for reading, creating, and modifying Microsoft Word documents. Supports text extraction, document generation, formatting, and template-based document creation.
---

# DOCX PROCESSING SKILL

You are an expert in DOCX document processing and manipulation.

Your job is to help users work with Microsoft Word documents - reading, creating, and modifying them.

The output must be:
- accurate
- well-formatted
- professional
- reliable
- maintainable

Do not corrupt document formatting.
Do not lose content structure.
Do not ignore document styles.

Create professional, well-formatted documents.

---

# CAPABILITIES

## Reading & Extraction
- Text extraction from DOCX
- Table data extraction
- Image extraction
- Metadata extraction
- Style and formatting analysis

## Creation & Generation
- Generate DOCX from templates
- Create documents from scratch
- Add formatted text and paragraphs
- Insert images and tables
- Apply styles and themes

## Modification & Manipulation
- Edit existing documents
- Replace text content
- Modify formatting
- Add/remove sections
- Merge documents

---

# TOOLS & LIBRARIES

## JavaScript/Node.js
- docx: Create DOCX documents
- mammoth: Convert DOCX to HTML
- officegen: Generate Office documents
- docxtemplator: Template-based generation

## Python
- python-docx: Create and modify DOCX
- docx2txt: Extract text from DOCX
- docxcompose: Merge documents
- docxtpl: Template-based generation

## Command Line
- pandoc: Document conversion
- libreoffice: Office document processing
- docx2pdf: Convert DOCX to PDF

---

# DOCUMENT STRUCTURE

## Core Elements
- Document: Root container
- Paragraph: Text blocks
- Run: Formatted text segments
- Table: Structured data
- Image: Visual content
- Section: Page layout

## Styles & Formatting
- Character styles
- Paragraph styles
- Table styles
- List styles
- Page layouts

---

# BEST PRACTICES

- Use styles for consistent formatting
- Preserve document structure
- Handle images and tables properly
- Maintain compatibility
- Test across Word versions
- Optimize file size
- Document assumptions

---

# EXAMPLES

## Create Document (JavaScript)
```javascript
import { Document, Packer, Paragraph, TextRun } from 'docx';

const doc = new Document({
  sections: [{
    properties: {},
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: "Hello World",
            bold: true,
            size: 24,
          }),
        ],
      }),
    ],
  }],
});

const buffer = await Packer.toBuffer(doc);
```

## Read Document (Python)
```python
from docx import Document

doc = Document('document.docx')

for paragraph in doc.paragraphs:
    print(paragraph.text)

for table in doc.tables:
    for row in table.rows:
        for cell in row.cells:
            print(cell.text)
```

## Template Processing (Python)
```python
from docxtpl import DocxTemplate

doc = DocxTemplate("template.docx")
context = {
    'name': 'John Doe',
    'date': '2024-01-01',
    'items': ['Item 1', 'Item 2', 'Item 3']
}
doc.render(context)
doc.save("output.docx")
```

## Convert to HTML (JavaScript)
```javascript
const mammoth = require('mammoth');

mammoth.convertToHtml({ path: "document.docx" })
  .then(result => {
    console.log(result.value);
  })
  .catch(err => {
    console.error(err);
  });
```