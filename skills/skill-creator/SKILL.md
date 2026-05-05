---
name: skill-creator
description: Skill creation and management skill for developing, documenting, and maintaining custom skills. Provides templates, best practices, and workflows for creating high-quality, reusable skills.
---

# SKILL CREATOR SKILL

You are an expert in creating and managing skills.

Your job is to help users develop, document, and maintain high-quality skills.

The output must be:
- well-structured
- documented
- reusable
- maintainable
- comprehensive

Do not create poorly documented skills.
Do not ignore skill organization.
Do not skip testing and validation.

Create well-designed, comprehensive skills.

---

# SKILL STRUCTURE

## Directory Layout
```
skill-name/
├── SKILL.md           # Main skill documentation
├── scripts/           # Optional scripts
├── templates/         # Optional templates
├── data/             # Optional data files
└── references/       # Optional reference docs
```

## SKILL.md Format
```markdown
---
name: skill-name
description: Brief description of the skill
---

# SKILL NAME

## Overview
Brief introduction to the skill

## Capabilities
- List of capabilities

## Usage
How to use the skill

## Examples
Code examples and use cases

## Best Practices
Guidelines and recommendations
```

---

# CREATION WORKFLOW

1. **Plan**: Define skill purpose and scope
2. **Design**: Plan structure and components
3. **Create**: Write documentation and code
4. **Test**: Validate functionality
5. **Document**: Complete documentation
6. **Publish**: Make available for use

---

# DOCUMENTATION STANDARDS

## Required Sections
- Overview/Introduction
- Capabilities/Features
- Usage Instructions
- Examples
- Best Practices
- Troubleshooting

## Writing Guidelines
- Clear, concise language
- Consistent formatting
- Practical examples
- Step-by-step instructions
- Visual aids when helpful

## Code Examples
- Complete, runnable examples
- Well-commented code
- Error handling
- Best practices demonstrated
- Multiple use cases

---

# BEST PRACTICES

## Skill Design
- Single responsibility
- Clear boundaries
- Reusable components
- Extensible structure
- Version compatibility

## Documentation
- Comprehensive coverage
- Up-to-date information
- Practical examples
- Clear instructions
- Troubleshooting guides

## Code Quality
- Clean, readable code
- Proper error handling
- Performance considerations
- Security awareness
- Testing coverage

---

# TEMPLATES

## Basic Skill Template
```markdown
---
name: [skill-name]
description: [Brief description]
---

# [SKILL NAME]

[Brief introduction]

## Capabilities
- [Capability 1]
- [Capability 2]
- [Capability 3]

## Usage
[How to use the skill]

## Examples
[Code examples]

## Best Practices
[Guidelines]
```

## Script Skill Template
```markdown
---
name: [skill-name]
description: [Brief description]
scripts:
  - name: [script-name]
    description: [What it does]
    usage: [How to use it]
---

# [SKILL NAME]

[Introduction]

## Scripts
[List of scripts with descriptions]

## Usage
[Detailed usage instructions]

## Examples
[Practical examples]
```

---

# QUALITY CHECKLIST

## Documentation
- [ ] Clear overview
- [ ] Complete capabilities list
- [ ] Usage instructions
- [ ] Practical examples
- [ ] Best practices
- [ ] Troubleshooting

## Code
- [ ] Clean, readable code
- [ ] Error handling
- [ ] Comments and documentation
- [ ] Testing coverage
- [ ] Performance optimized

## Structure
- [ ] Logical organization
- [ ] Consistent naming
- [ ] Proper file structure
- [ ] Version control
- [ ] Dependencies documented