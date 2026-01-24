**Create comprehensive plan with the following structure:**

Feature description: $ARGUMENTS
# ParaThinker Coordinator

You need to solve a complex coding problem using the ParaThinker approach - spawning multiple independent reasoning paths to avoid tunnel vision.

## Implementation Protocol

1. **Spawn 8 Independent Agents**
   Create 8 @strategy-analyzer agents, each with a DIFFERENT strategy:

2. **Provide Context**
   Give each agent:
   - The exact same problem description
   - Their assigned strategy (explicitly state which one)
   - Instruction to work independently
   - A mandatory reminder that they must always leverage the available tools to perform an in-depth analysis of the codebase

3. **Collect Results**
   Wait for all 8 analyses, then:
   - Group solutions by similarity
   - Count votes for each solution approach
   - Weight by confidence scores

4. **Majority Decision**
   - Identify the solution proposed by the most agents
   - If tie, use highest average confidence
   - Implement the winning solution

5. **Implementation**
   Based on the majority solution:
   - Make the actual code changes
   - Test the solution
   - Document which strategy led to success

# Implementation 

Whats below here is a template for you to fill for the implementation agent:

## CRITICAL REQUIREMENTS FOR PLAN CREATION

**YOU MUST CREATE A PURELY FUNCTIONAL PLAN:**
- ❌ **NO CODE EXAMPLES** in the plan - only functional descriptions
- ✅ **FUNCTIONAL SPECIFICATIONS ONLY** - describe what needs to be done, not how
- ✅ **ALL REFERENCES AND LINKS** - include every relevant documentation, API reference, and resource
- ✅ **USE MCP SALEOR** - explicitly require using the MCP Saleor server in implementation steps to verify structure and data models or for local test just build and request docker
- ✅ **MANDATORY TESTING** - require explicit test validation steps with commands
- ✅ **RESOURCE LINKS** - provide URLs to official documentation, API references, and tutorials

```markdown
# Feature: <feature-name>

The following plan should be complete, but its important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

<Detailed description of the feature, its purpose, and value to users>

## User Story

As a <type of user>
I want to <action/goal>
So that <benefit/value>

## Problem Statement

<Clearly define the specific problem or opportunity this feature addresses>

## Solution Statement

<Describe the proposed solution approach and how it solves the problem>

## Feature Metadata

**Feature Type**: [New Capability/Enhancement/Refactor/Bug Fix]
**Estimated Complexity**: [Low/Medium/High]
**Primary Systems Affected**: [List of main components/services]
**Dependencies**: [External libraries or services required]

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

<List files with line numbers and relevance>

- `path/to/file.py` (lines 15-45) - Why: Contains pattern for X that we'll mirror
- `path/to/model.py` (lines 100-120) - Why: Database model structure to follow
- `path/to/test.py` - Why: Test pattern example

### New Files to Create

- `path/to/new_service.py` - Service implementation for X functionality
- `path/to/new_model.py` - Data model for Y resource
- `tests/path/to/test_new_service.py` - Unit tests for new service

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- [Documentation Link 1](https://example.com/doc1#section)
  - Specific section: Authentication setup
  - Why: Required for implementing secure endpoints
- [Documentation Link 2](https://example.com/doc2#integration)
  - Specific section: Database integration
  - Why: Shows proper async database patterns

### Patterns to Follow

<Describe functional patterns and architectural approaches - NO CODE EXAMPLES>

**Naming Conventions:**
- Describe the naming pattern to follow
- Reference files where these patterns are consistently applied

**Error Handling:**
- Describe the error handling strategy
- Reference documentation or files demonstrating this pattern

**Logging Pattern:**
- Describe logging approach
- Reference logging configuration files

**Data Validation:**
- Describe validation approach
- Reference schema or validation pattern files

**Other Relevant Patterns:**
- Describe additional architectural patterns relevant to this feature
- Reference where these patterns are documented or implemented

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation

<Describe foundational work needed before main implementation>

**Tasks:**

- Set up base structures (schemas, types, interfaces)
- Configure necessary dependencies
- Create foundational utilities or helpers

### Phase 2: Core Implementation

<Describe the main implementation work>

**Tasks:**

- Implement core business logic
- Create service layer components
- Add API endpoints or interfaces
- Implement data models

### Phase 3: Integration

<Describe how feature integrates with existing functionality>

**Tasks:**

- Connect to existing routers/handlers
- Register new components
- Update configuration files
- Add middleware or interceptors if needed

### Phase 4: Testing & Validation

<Describe testing approach>

**Tasks:**

- Implement unit tests for each component
- Create integration tests for feature workflow
- Add edge case tests
- Validate against acceptance criteria

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### Task Format Guidelines

Use information-dense keywords for clarity:

- **CREATE**: New files or components
- **UPDATE**: Modify existing files
- **ADD**: Insert new functionality into existing code
- **REMOVE**: Delete deprecated code
- **REFACTOR**: Restructure without changing behavior
- **MIRROR**: Copy pattern from elsewhere in codebase

### {ACTION} {target_file}

- **IMPLEMENT**: {Functional description of what needs to be implemented - NO CODE}
- **PATTERN**: {Reference to existing pattern - file:line or documentation link}
- **DEPENDENCIES**: {Required libraries, services, or external resources with links}
- **MCP SALEOR for VERIFICATION**: {Specify what to verify using MCP Saleor server - e.g., "Verify Product schema structure", "Check available payment methods"} or for local test just build and request docker
- **GOTCHA**: {Known issues or constraints to avoid}
- **RESOURCES**: {Links to official documentation, API references, tutorials}
- **VALIDATE**: `{executable validation command - must include test execution}`
- **TEST_REQUIREMENT**: {Specific tests that must pass for this task}

<Continue with all tasks in dependency order...>

**REMINDER FOR EACH TASK:**
- NO code examples in task descriptions - only functional specifications
- Include ALL relevant documentation links and API references
- Explicitly state what to verify with MCP Saleor server or for local test just build and request docker
- Define test validation requirements
- Provide executable validation commands

---

## TESTING STRATEGY

**MANDATORY REQUIREMENT**: All implementation tasks MUST have corresponding tests that validate functionality.

<Define testing approach based on project's test framework and patterns discovered in Phase 2>

### Unit Tests

**Scope**: <Define what units need testing>
**Requirements**:
- Minimum coverage percentage required
- Testing framework to use (with documentation link)
- Fixtures and mocking approach (reference existing test files)
- **VALIDATION COMMAND**: `{command to run unit tests}`

**Test Categories Required**:
- Happy path scenarios
- Error handling and edge cases
- Input validation
- Business logic correctness

### Integration Tests

**Scope**: <Define integration points to test>
**Requirements**:
- End-to-end workflow validation
- External service integration (including Saleor API)
- **MCP SALEOR VALIDATION**: Verify integration with Saleor using MCP server queries or for local test just build and request docker
- Database transaction handling
- **VALIDATION COMMAND**: `{command to run integration tests}`

**Test Scenarios Required**:
- Complete user workflows
- Cross-service communication
- Data consistency across systems

### Edge Cases

**MANDATORY EDGE CASES TO TEST**:
<List specific edge cases that must be tested for this feature>

### Test Resources

**Testing Documentation Links**:
- Testing framework documentation: {URL}
- Project testing guidelines: {file path or URL}
- Saleor API testing guide: {URL}
- Mock data setup: {file path or URL}

---

## VALIDATION COMMANDS

**CRITICAL REQUIREMENT**: Execute EVERY validation command and ALL tests MUST PASS before considering the feature complete.

<Define validation commands based on project's tools discovered in Phase 2>

Execute every command to ensure zero regressions and 100% feature correctness.

### Level 1: Syntax & Style

**Required Commands**:
```
{Project-specific linting command}
{Project-specific formatting command}
{Type checking command if applicable}
```

**Expected Result**: Zero errors, zero warnings

### Level 2: Unit Tests

**Required Commands**:
```
{Command to run all unit tests}
{Command to run tests for specific feature}
{Command to generate coverage report}
```

**Expected Result**: 
- All unit tests pass
- Coverage meets minimum threshold (specify %)
- No test failures or skipped tests

### Level 3: Integration Tests

**Required Commands**:
```
{Command to run all integration tests}
{Command to run feature-specific integration tests}
```

**Expected Result**: 
- All integration tests pass
- End-to-end workflows validated
- External service integrations verified

### Level 4: MCP Saleor Validation

**MANDATORY REQUIREMENT**: Use MCP Saleor server to validate implementation or for local test just build and request docker

**Required Validations**:
- Verify data structures match Saleor schema
- Validate API queries return expected results
- Confirm webhook payloads match documentation
- Test authentication and authorization flows

**MCP Queries to Execute**:
<List specific MCP Saleor queries to run for validation> or for local test just build and request docker

### Level 5: Manual Validation

**Feature-specific manual testing steps**:
<Detailed step-by-step manual testing procedures>

**API Testing** (if applicable):
- Endpoint URLs to test
- Request/response validation
- Authentication flow testing

**UI Testing** (if applicable):
- User workflows to verify
- Visual validation points
- Browser/device testing requirements

### Level 6: Additional Validation

**Other validation tools or MCP servers** (if applicable):
<List any additional validation tools, CI/CD checks, or MCP servers to use> or for local test just build and request docker

---

## ACCEPTANCE CRITERIA

**MANDATORY REQUIREMENTS - ALL MUST BE MET**:

<List specific, measurable criteria that must be met for completion>

- [ ] Feature implements all specified functionality as described
- [ ] **ALL validation commands executed and pass with zero errors**
- [ ] **ALL unit tests pass** - coverage meets minimum requirements (specify %)
- [ ] **ALL integration tests pass** - end-to-end workflows verified
- [ ] **MCP Saleor validation completed** - all data structures and API interactions verified or for local test just build and request docker
- [ ] Code follows project conventions and patterns (reference pattern files)
- [ ] No regressions in existing functionality (existing tests still pass)
- [ ] **Test suite expanded** - new tests added for new functionality
- [ ] All resource links and documentation references validated and accessible
- [ ] Documentation is updated (if applicable)
- [ ] Performance meets requirements (if applicable - specify metrics)
- [ ] Security considerations addressed (if applicable - specify requirements)

---

## COMPLETION CHECKLIST

**MANDATORY - EVERY ITEM MUST BE CHECKED BEFORE COMPLETION**:

- [ ] All tasks completed in order
- [ ] **Each task validation command executed and passed immediately**
- [ ] **All unit tests written and passing** (no skipped tests)
- [ ] **All integration tests written and passing**
- [ ] **MCP Saleor validations completed successfully**
- [ ] All validation commands executed successfully (Level 1-6)
- [ ] Full test suite passes (unit + integration + existing tests)
- [ ] No linting or type checking errors
- [ ] Manual testing completed and documented
- [ ] All resource links verified and accessible
- [ ] Acceptance criteria all met
- [ ] Code reviewed for quality and maintainability
- [ ] **Test coverage report generated and meets requirements**

---

## EXTERNAL RESOURCES AND REFERENCES

**MANDATORY SECTION - Include ALL relevant resources**:

### Official Documentation
- Saleor API Documentation: {URL}
- Saleor GraphQL Playground: {URL}
- Framework/Library Documentation: {URLs}
- Authentication/Security Documentation: {URLs}

### API References
- Relevant API endpoints: {URLs}
- Schema definitions: {URLs}
- Webhook documentation: {URLs}

### Tutorials and Guides
- Related implementation guides: {URLs}
- Best practices documentation: {URLs}

### Internal Resources
- Project architecture documentation: {file paths}
- Design decisions log: {file paths}
- Existing similar implementations: {file paths}

### MCP Saleor Server Usage or for local test just build and request docker
- MCP server connection details or for local test just build and request docker
- Relevant queries for this feature
- Expected response structures (reference documentation)

## NOTES

<Additional context, design decisions, trade-offs - FUNCTIONAL DESCRIPTION ONLY, NO CODE>

**Important Reminders**:
- This plan contains ONLY functional specifications - NO code examples
- if need Implementation agent MUST use MCP Saleor server to verify all Saleor-related structures or for local test just build and request docker
- ALL tests must be written and passing before feature is considered complete
- ALL validation commands must execute successfully
- ALL resource links must be verified and accessible

<!-- EOF -->
```

## Output Format

**Filename**: `.agents/plans/{kebab-case-descriptive-name}.md`

- Replace `{kebab-case-descriptive-name}` with short, descriptive feature name
- Examples: `add-user-authentication.md`, `implement-search-api.md`, `refactor-database-layer.md`

**Directory**: Create `.agents/plans/` if it doesn't exist

## Report

After creating the Plan, provide:

- Summary of feature and approach
- Full path to created Plan file
- Complexity assessment
- Key implementation risks or considerations