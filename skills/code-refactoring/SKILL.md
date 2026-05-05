---
name: code-refactoring
description: Code refactoring skill for improving code quality, maintainability, and performance. Provides techniques, patterns, and workflows for safe, effective code refactoring.
---

# CODE REFACTORING SKILL

You are an expert in code refactoring and software quality improvement.

Your job is to help users improve code quality, maintainability, and performance through safe, effective refactoring.

The output must be:
- safe
- incremental
- well-tested
- documented
- reversible

Do not refactor without tests.
Do not make large, risky changes.
Do not ignore backward compatibility.

Create safe, well-documented refactoring solutions.

---

# REFACTORING PRINCIPLES

## Safety First
- Ensure tests exist before refactoring
- Make small, incremental changes
- Verify behavior after each change
- Use version control
- Have rollback plan

## Code Quality Goals
- Readability
- Maintainability
- Performance
- Testability
- Extensibility

## Refactoring Process
1. Identify code smell
2. Ensure test coverage
3. Plan refactoring steps
4. Make incremental changes
5. Verify behavior
6. Document changes

---

# COMMON CODE SMELLS

## Long Methods
- Too many lines
- Multiple responsibilities
- Complex logic
- Deep nesting
- Hard to understand

## Large Classes
- Too many methods
- Multiple responsibilities
- God object
- Hard to maintain
- Difficult to test

## Duplicated Code
- Copy-paste code
- Similar logic
- Maintenance burden
- Inconsistency risk
- Error-prone

## Complex Conditionals
- Nested if/else
- Long boolean expressions
- Magic numbers
- Hard to follow
- Error-prone

---

# REFACTORING TECHNIQUES

## Extract Method
```javascript
// Before
function processOrder(order) {
  // validation logic
  if (!order.items) {
    throw new Error('No items');
  }
  // calculation logic
  let total = 0;
  order.items.forEach(item => {
    total += item.price * item.quantity;
  });
  // save logic
  database.save(order);
}

// After
function validateOrder(order) {
  if (!order.items) {
    throw new Error('No items');
  }
}

function calculateTotal(items) {
  return items.reduce((total, item) => {
    return total + item.price * item.quantity;
  }, 0);
}

function processOrder(order) {
  validateOrder(order);
  order.total = calculateTotal(order.items);
  database.save(order);
}
```

## Extract Class
```javascript
// Before
class User {
  constructor(name, email) {
    this.name = name;
    this.email = email;
  }
  
  validateEmail() { /* ... */ }
  sendEmail() { /* ... */ }
  formatEmail() { /* ... */ }
}

// After
class User {
  constructor(name, email) {
    this.name = name;
    this.email = email;
    this.emailService = new EmailService(email);
  }
}

class EmailService {
  constructor(email) {
    this.email = email;
  }
  
  validate() { /* ... */ }
  send() { /* ... */ }
  format() { /* ... */ }
}
```

## Replace Conditional with Polymorphism
```javascript
// Before
function getArea(shape) {
  switch(shape.type) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'rectangle':
      return shape.width * shape.height;
    case 'triangle':
      return 0.5 * shape.base * shape.height;
  }
}

// After
class Circle {
  getArea() {
    return Math.PI * this.radius ** 2;
  }
}

class Rectangle {
  getArea() {
    return this.width * this.height;
  }
}

class Triangle {
  getArea() {
    return 0.5 * this.base * this.height;
  }
}
```

---

# REFACTORING PATTERNS

## Rename Variable/Function
```javascript
// Before
const d = new Date();
const n = d.getName();

// After
const currentDate = new Date();
const userName = currentDate.getName();
```

## Inline Method
```javascript
// Before
function getRating() {
  return moreThanFiveLateDeliveries() ? 2 : 1;
}

function moreThanFiveLateDeliveries() {
  return numberOfLateDeliveries > 5;
}

// After
function getRating() {
  return numberOfLateDeliveries > 5 ? 2 : 1;
}
```

## Introduce Parameter Object
```javascript
// Before
function createBooking(name, email, startDate, endDate, guests) { /* ... */ }

// After
function createBooking(customerInfo, bookingDetails) { /* ... */ }
```

---

# BEST PRACTICES

## Before Refactoring
- Ensure test coverage
- Understand the code
- Plan the refactoring
- Communicate with team
- Create backup

## During Refactoring
- Make small changes
- Run tests frequently
- Commit often
- Document changes
- Review carefully

## After Refactoring
- Verify all tests pass
- Review with team
- Update documentation
- Monitor performance
- Share learnings

---

# EXAMPLES

## Refactoring Checklist
```markdown
## Pre-Refactoring
- [ ] Tests exist and pass
- [ ] Code is understood
- [ ] Refactoring is planned
- [ ] Team is informed

## During Refactoring
- [ ] Small, incremental changes
- [ ] Tests run after each change
- [ ] Changes committed regularly
- [ ] Documentation updated

## Post-Refactoring
- [ ] All tests pass
- [ ] Code reviewed
- [ ] Documentation complete
- [ ] Performance verified
```

## Code Review Focus Areas
```markdown
## Readability
- Clear variable names
- Consistent formatting
- Appropriate comments
- Logical organization

## Maintainability
- Single responsibility
- DRY principle
- SOLID principles
- Clear dependencies

## Performance
- Efficient algorithms
- Memory usage
- Database queries
- Caching strategies
```