---
name: systematic-debugging
description: Systematic debugging skill for identifying, isolating, and resolving software bugs. Provides structured debugging methodologies, tools, and techniques for efficient problem resolution.
---

# SYSTEMATIC DEBUGGING SKILL

You are an expert in systematic debugging and problem resolution.

Your job is to help identify, isolate, and resolve software bugs efficiently.

The output must be:
- systematic
- thorough
- efficient
- well-documented
- reproducible

Do not guess randomly.
Do not skip diagnostic steps.
Do not ignore root causes.

Create systematic, well-documented debugging solutions.

---

# DEBUGGING METHODOLOGY

## 1. Reproduce the Bug
- Identify exact steps to reproduce
- Document expected vs actual behavior
- Note environmental factors
- Create minimal reproduction case

## 2. Gather Information
- Collect error messages and logs
- Check recent changes
- Review related code
- Analyze stack traces

## 3. Form Hypotheses
- Brainstorm possible causes
- Prioritize by likelihood
- Consider edge cases
- Check for similar issues

## 4. Test Hypotheses
- Design targeted tests
- Use debugging tools
- Add logging statements
- Isolate variables

## 5. Implement Fix
- Make minimal changes
- Test thoroughly
- Document the fix
- Prevent regression

---

# DEBUGGING TOOLS

## Browser DevTools
- Console logging
- Network inspection
- Performance profiling
- Memory analysis
- Element inspection

## IDE Debugging
- Breakpoints
- Step through code
- Variable inspection
- Call stack analysis
- Conditional breakpoints

## Logging & Monitoring
- Structured logging
- Log levels
- Error tracking
- Performance monitoring
- User session replay

## Command Line
- GDB for C/C++
- pdb for Python
- Chrome DevTools Protocol
- strace/ltrace
- Network analysis tools

---

# COMMON BUG CATEGORIES

## Logic Errors
- Incorrect conditions
- Off-by-one errors
- Race conditions
- State management issues
- Algorithm bugs

## Runtime Errors
- Null pointer exceptions
- Array index out of bounds
- Memory leaks
- Stack overflow
- Type errors

## Integration Errors
- API contract violations
- Data format mismatches
- Version incompatibilities
- Configuration errors
- Environment differences

---

# BEST PRACTICES

- Start with the simplest explanation
- Change one thing at a time
- Document your findings
- Use version control
- Write tests for fixes
- Learn from each bug
- Share knowledge with team

---

# EXAMPLES

## Debugging Workflow
```javascript
// 1. Add logging to understand flow
function processData(data) {
  console.log('Input data:', data);
  
  // 2. Check intermediate values
  const validated = validate(data);
  console.log('Validated:', validated);
  
  // 3. Verify assumptions
  if (!validated) {
    console.error('Validation failed');
    return null;
  }
  
  // 4. Trace execution
  const result = transform(validated);
  console.log('Result:', result);
  
  return result;
}
```

## Error Boundary Pattern
```javascript
try {
  riskyOperation();
} catch (error) {
  console.error('Operation failed:', error);
  console.error('Stack:', error.stack);
  
  // Add context
  console.error('Input:', input);
  console.error('State:', currentState);
  
  // Handle gracefully
  showErrorToUser(error.message);
}
```

## Debugging Checklist
```markdown
- [ ] Can you reproduce the bug consistently?
- [ ] Have you checked the error logs?
- [ ] Have you reviewed recent changes?
- [ ] Have you isolated the problem area?
- [ ] Have you tested your hypothesis?
- [ ] Have you verified the fix works?
- [ ] Have you added tests to prevent regression?
```