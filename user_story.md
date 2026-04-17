# Bromcom Test Builder - User Stories & Application Guide

## 📋 Application Overview

**Bromcom Test Builder** is a desktop application that helps QA engineers and test managers create, organize, and manage automated test cases for projects tracked in Microsoft Azure DevOps. It provides an intuitive interface for building parameterized test steps, managing test suites, and maintaining consistent test case documentation.

**Key Role:** Bridge between test planning (Azure DevOps) and test automation, enabling teams to define test scenarios with flexible, reusable test steps.

---

## 👥 Primary Users

1. **QA Engineers / Test Automation Specialists**
   - Create and edit test cases with multi-step scenarios
   - Define test parameters and variable substitution
   - Execute test cases step-by-step with dynamic locators
   - Document test procedures in a structured format

2. **Test Managers / QA Leads**
   - Organize test cases into suites within Azure DevOps
   - Review and approve test case templates
   - Monitor test plan structure and coverage
   - Generate test documentation and reports

3. **Developers (Secondary Users)**
   - Review test case steps for technical feasibility
   - Verify locator accuracy against application UI
   - Understand test scenarios during code review

---

## 🎯 Core User Stories

### Story 1: Connect to Azure DevOps Project
**As a** QA engineer  
**I want to** connect the Test Builder to my Azure DevOps project  
**So that** I can access existing test plans, suites, and cases for management

**Acceptance Criteria:**
- User can enter Organization URL, Project name, and Personal Access Token (PAT)
- Connection is validated before saving
- Settings are stored locally and persist across sessions
- User can edit connection details in Workspace Settings
- Clear error messages if connection fails

**User Flow:**
1. Launch application → Workspace Settings page
2. Enter Organization URL (e.g., `https://dev.azure.com/myorg`)
3. Enter Project name
4. Generate and paste Personal Access Token from Azure DevOps
5. Click "Connect" → validation occurs
6. Success message → application loads test plans

**Related Components:**
- `WorkspaceSettings.tsx` - Settings modal for credentials
- `services/azure-devops.ts` - API integration

---

### Story 2: Browse Test Plans & Suites
**As a** QA engineer  
**I want to** view all test plans in my Azure DevOps project and navigate their suite hierarchy  
**So that** I can locate the correct test suite for adding or editing test cases

**Acceptance Criteria:**
- Landing page displays all active test plans in a responsive grid
- Each plan shows: Name, ID, Status (Active/Inactive), Suite count
- Click on a plan → opens suite tree navigation
- Suite tree shows hierarchical structure (parent suites → child suites)
- Can expand/collapse suite nodes
- Visual indicators for suite depth/nesting
- Search functionality to find plans and suites

**User Flow:**
1. Application loads → Landing page shows Test Plans grid
2. Cards display: Plan name, ID, Status badge (green=Active, orange=Inactive)
3. User clicks a plan card → Suite Tree view opens
4. Tree shows root suites and nested structure
5. User expands suites to find target suite
6. Click suite → Test Case list loads

**UI Components:**
- `Landing.tsx` - Plan cards and overview
- `PlansList.tsx` - Grid layout for plans
- `PlanCard.tsx` - Individual plan card with metadata
- `SuiteTree*.tsx` - Hierarchical suite navigation

---

### Story 3: Create a Test Case
**As a** QA engineer  
**I want to** create a new test case within a selected suite  
**So that** I can define test scenarios and procedures in the system

**Acceptance Criteria:**
- User can create a new test case from the suite view
- Can set: Case name, description, case type (manual/automated)
- Can add multiple test steps with sequential ordering
- Steps can be edited, deleted, or reordered
- Validation prevents saving incomplete cases (required fields)
- Success message confirms case creation in Azure DevOps
- Case appears immediately in the suite list

**User Flow:**
1. In Suite view → Click "Add Test Case" or "New Case" button
2. Modal/form opens with case details
3. Enter case name and description
4. Add first step → Step form appears
5. Define step title, action, and expected result
6. Click "Add Step" → new step form appears
7. Repeat for multiple steps
8. Click "Save Case" → validates and saves to Azure DevOps
9. Case appears in suite test case list

**Related Components:**
- `TestCaseDetail.tsx` - Case editor
- `StepsEditor.tsx` - Step management interface
- `StepForm.tsx` - Individual step editor
- `StepsList.tsx` - List of steps in case

---

### Story 4: Edit Test Case Steps with Parameters
**As a** QA engineer  
**I want to** define test steps with parameters and dynamic locators  
**So that** I can create reusable test scenarios that work across different data sets

**Acceptance Criteria:**
- Each step has: Title, Action, Expected Result fields
- Can set element locators (XPath, ID, CSS selector)
- Support for dynamic locators with parameter substitution (e.g., `{username}`)
- Can mark locator as "dynamic" for runtime replacement
- Parameter suggestions/autocomplete based on defined parameters
- Locator validation (e.g., XPath syntax check)
- Test data replacement key field for parameterized execution
- Visual feedback for invalid locators

**User Flow:**
1. In case editor → Define first step
2. Enter step title: "Login to application"
3. Enter action: "Click login button with ID {loginButtonId}"
4. Set element category: XPath
5. Enter XPath: `//button[@id="btnLogin"]`
6. Mark as dynamic: YES → enables parameter substitution
7. Set replacement key: "loginButtonId"
8. Enter expected result: "User logged in successfully"
9. Save step → next step form appears

**Parameters Example:**
```
Step 1: "Navigate to {baseUrl}"
  - Parameter: baseUrl = "https://app.example.com"
  
Step 2: "Enter username {username}"
  - Parameter: username = "testuser@example.com"
  
Step 3: "Click button with ID {buttonId}"
  - Parameter: buttonId = "btn-submit"
  - Dynamic: YES
  - Replacement Key: "buttonId"
```

**Related Components:**
- `StepFieldRenderer.tsx` - Renders individual step fields
- `StepsEditor.tsx` - Manages step collection and parameters
- `DynamicLocator.tsx` - Dynamic locator toggle and validation

---

### Story 5: Manage Test Case Parameters
**As a** QA engineer  
**I want to** define test parameters that can be reused across multiple steps  
**So that** I can create flexible test cases that work with different data sets

**Acceptance Criteria:**
- Can add parameters with name and default value
- Parameter names must be unique and follow naming conventions
- Can reference parameters in step actions using `{paramName}` syntax
- Parameter validation (no special characters, alphanumeric + underscore)
- Can edit or delete parameters
- Visual indicators showing where parameters are used
- Prevents deletion of parameters currently in use

**User Flow:**
1. In case editor → Parameters section
2. Click "Add Parameter"
3. Enter parameter name: "username"
4. Enter default value: "testuser@example.com"
5. Click "Add" → parameter appears in list
6. In step action, type `{username}` → parameter is auto-substituted
7. Edit step → see highlighted `{username}` reference
8. Delete parameter → warning if used in steps

**Related Components:**
- `ParameterManager.tsx` (hypothetical) - Parameter list management
- `StepsEditor.tsx` - Parameter integration with steps

---

### Story 6: Search Help Documentation
**As a** QA engineer  
**I want to** quickly find answers in the help documentation  
**So that** I can learn how to use features without leaving the application

**Acceptance Criteria:**
- Help Guide accessible from app header or menu
- Search box visible at top of help guide (always in view)
- Type keyword → highlights all matches in yellow
- Yellow highlights → inactive matches
- Orange highlight → currently active/selected match
- Navigation buttons (Previous/Next) to cycle through matches
- Match counter shows position (e.g., "3 / 12")
- Enter key → next match with auto-scroll
- Shift+Enter key → previous match
- Escape key → close help guide
- Auto-scrolls to make matches visible
- Works like browser Ctrl+F functionality

**User Flow:**
1. Click Help icon in header → Help Guide opens
2. See search box at top with placeholder "Search help..."
3. Type "locator" → all mentions highlighted in yellow
4. First match auto-scrolls into view, turns orange
5. Shows "1 / 7" (1st of 7 matches)
6. Press Enter → jumps to next match (turns orange)
7. Shows "2 / 7" and scrolls to show it
8. Continue pressing Enter until "7 / 7"
9. Press Enter again → wraps back to "1 / 7"
10. Click a yellow highlight → jumps directly to that match
11. Press Escape → closes help guide

**Related Components:**
- `HelpGuide.tsx` - Main help guide component
- `help-guide.css` - Styling and scroll behavior
- Help content files (markdown or static)

---

### Story 7: Responsive Access on Different Devices
**As a** QA engineer  
**I want to** use the Test Builder on desktop, tablet, and mobile devices  
**So that** I can manage test cases from anywhere in the office or field

**Acceptance Criteria:**
- Desktop (> 900px): Full layout with sidebar navigation and content
- Tablet (600-900px): Adaptive layout, sidebar may stack or collapse
- Mobile (< 600px): Single column, touch-friendly buttons (40x40px minimum)
- All functionality remains accessible on mobile
- Form inputs are large enough for touch typing
- Navigation is intuitive on small screens
- No horizontal scrolling unless needed
- Performance is optimized for lower bandwidth

**Responsive Breakpoints:**
- Mobile: 320px - 599px
- Tablet: 600px - 900px
- Desktop: 901px+

**Related Components:**
- All components have `@media` queries
- `WorkspaceSettings.tsx` - Responsive form layout
- `TestCaseDetail.tsx` - Mobile-friendly step editor
- `SuiteTree.tsx` - Responsive tree navigation

---

### Story 8: Accessibility & Keyboard Navigation
**As a** user with accessibility needs  
**I want to** navigate the application using keyboard alone  
**So that** I can use the tool efficiently without a mouse

**Acceptance Criteria:**
- All interactive elements are keyboard accessible (Tab navigation)
- Focus states are clearly visible (2px outline, min 4.5:1 contrast)
- Tab order follows logical flow (left→right, top→bottom)
- Buttons have minimum 40x44px touch targets
- Form labels associated with inputs (ARIA labels)
- Color not sole indicator of information (badges have text + color)
- Keyboard shortcuts documented (Ctrl+F for search, Escape to close)
- Screen reader friendly (semantic HTML, proper heading hierarchy)
- Links have descriptive text (not just "click here")

**Keyboard Shortcuts:**
- `Ctrl+F` - Open search/find functionality
- `Tab` - Navigate to next interactive element
- `Shift+Tab` - Navigate to previous interactive element
- `Enter` - Activate button or submit form
- `Escape` - Close modal, dialog, or help guide
- `Space` - Toggle checkbox or activate button
- `Arrow Keys` - Navigate tree structure (suite expansion)

**Related Accessibility Standards:**
- WCAG 2.1 Level AA compliance
- Focus management for modal dialogs
- ARIA attributes for complex components

---

## 🛠️ Core Features

### Feature 1: Test Plan Management
- View all test plans from Azure DevOps
- Filter by status (Active/Inactive)
- Quick overview: Plan ID, Suite count, Last modified
- Open/close plan details
- Direct link to Azure DevOps for plan management

### Feature 2: Suite Hierarchy Navigation
- Expandable/collapsible tree view
- Visual depth indication
- Suite metadata: ID, test case count
- Quick actions: Add suite, Add test case, Edit, Delete
- Drag-and-drop reordering (optional enhancement)

### Feature 3: Test Case Editor
- Full CRUD operations (Create, Read, Update, Delete)
- Rich text fields for descriptions
- Step-by-step test procedure definition
- Inline editing with auto-save capability
- Validation and error feedback
- Undo/redo functionality (optional)

### Feature 4: Parameterized Test Steps
- Define parameters (name, type, default value)
- Reference parameters in step actions
- Auto-substitution in test execution
- Parameter validation and scoping
- Reusable test data sets

### Feature 5: Dynamic Locator Support
- Multiple locator strategies (XPath, CSS, ID, Class, etc.)
- Locator validation and syntax checking
- Dynamic locator flag for runtime substitution
- Test data replacement key mapping
- Locator suggestions based on element inspection

### Feature 6: Built-in Help Documentation
- Comprehensive user guide
- Searchable knowledge base
- Topic-based organization
- Code examples and screenshots
- Quick reference cards
- Keyboard shortcuts guide

### Feature 7: Settings & Configuration
- Azure DevOps connection management
- PAT (Personal Access Token) storage
- Theme selection (Light/Dark modes)
- Auto-save preferences
- Workspace configuration
- Cached data management

---

## 🎨 UI/UX Principles

### Design System
- **Colors:** Dark-first theme with light mode support
- **Typography:** Clear hierarchy with system fonts
- **Spacing:** 8px baseline grid for consistency
- **Components:** Reusable Material-UI components
- **Icons:** SVG icons for clarity and scalability

### Accessibility Focus
- Minimum 4.5:1 color contrast (WCAG AA)
- Touch targets: 40x44px minimum
- Focus states: 2px outline with visible color
- Clear visual hierarchy
- Semantic HTML structure
- ARIA attributes for complex components

### Minimalist Philosophy
- Remove visual clutter
- Focus on essential information
- Generous whitespace
- Clear call-to-action buttons
- Progressive disclosure (hide secondary info)
- No unnecessary animations

---

## 🔐 Security & Data Handling

### Azure DevOps Integration
- PAT (Personal Access Token) authentication
- Secure token storage (encrypted in Electron)
- HTTPS communication with Azure DevOps
- No hardcoded credentials
- Session expiration handling

### Data Privacy
- Test data stored locally (no cloud sync by default)
- User can manage cached data
- Option to clear sensitive information
- No telemetry or usage tracking (unless opted in)
- Workspace isolation (separate workspaces per project)

---

## 📱 Platform Support

### Desktop Application (Primary)
- **Technology:** Electron + React
- **Supported OS:** Windows, macOS, Linux
- **Hardware:** 2GB RAM, 500MB storage minimum
- **Network:** Requires Azure DevOps connectivity
- **Browser Rendering:** Chromium engine (Electron)

### Browser Compatibility (Web Version - Optional)
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Responsive design for all screen sizes

---

## 🚀 Getting Started Workflow

### First-Time User Flow
1. **Install** → Launch application
2. **Workspace Setup** → Enter Azure DevOps credentials
3. **Connection Test** → Verify project access
4. **Select Plan** → Choose test plan from grid
5. **Explore Suites** → Browse suite hierarchy
6. **View Cases** → See existing test cases
7. **Create Case** → Add first test case
8. **Define Steps** → Create test procedure
9. **Save & Sync** → Push to Azure DevOps
10. **Review** → Verify in Azure DevOps

### Regular User Workflow
1. **Open app** → Last workspace loads
2. **Select suite** → From suite tree
3. **Create/Edit case** → Update test case
4. **Save** → Auto-synced to Azure DevOps
5. **Help** → Search help guide if needed
6. **Close** → State preserved for next session

---

## 📊 Data Model

### Test Plan
```
{
  id: string              // Azure DevOps ID
  name: string           // Plan name
  state: "Active" | "Inactive"
  rootSuiteId: string    // ID of root suite
  area: string           // Project area
  iteration: string      // Sprint/iteration
  metadata: {...}        // Additional fields
}
```

### Test Suite
```
{
  id: string            // Azure DevOps ID
  name: string          // Suite name
  parentSuiteId?: string// Parent suite (null if root)
  suiteType: "Static" | "Query" | "Requirement"
  testCaseCount: number // Number of test cases
  children: Suite[]     // Child suites
}
```

### Test Case
```
{
  id: string            // Azure DevOps ID
  title: string         // Case title
  description: string   // Full description
  caseType: "Manual" | "Automated"
  steps: TestStep[]     // Ordered steps
  parameters: Parameter[] // Test parameters
  tags: string[]        // Categories/tags
}
```

### Test Step
```
{
  id: string            // Unique step ID
  title: string         // Step description
  action: string        // Action to perform
  expectedResult: string// Expected outcome
  locator?: {
    strategy: "XPath" | "CSS" | "ID" | "Class"
    value: string       // Locator expression
    isDynamic: boolean  // Dynamic replacement flag
    replacementKey?: string // Parameter for replacement
  }
  order: number         // Step sequence
}
```

### Parameter
```
{
  name: string         // Parameter name (e.g., "username")
  type: "String" | "Number" | "Boolean" | "Array"
  defaultValue: any    // Default value for parameter
  description?: string // Parameter documentation
  scope: "Local" | "Global" // Scope of parameter
}
```

---

## 🔄 Integration Points

### Azure DevOps API
- **Endpoint:** `https://dev.azure.com/{organization}/{project}/_apis`
- **Authentication:** Personal Access Token (Bearer token)
- **Resources:**
  - Plans: `/testplan/plans`
  - Suites: `/testplan/suites`
  - Cases: `/testplan/cases`
  - Results: `/test/runs`

### Electron APIs
- **File Storage:** User's Documents or AppData
- **Window Management:** Multi-window support
- **Dialogs:** Save/Open file dialogs
- **System Integration:** Native menus, clipboard access

---

## 📝 Common User Tasks

### Task 1: Set Up New Workspace
1. Go to Settings (gear icon)
2. Enter Organization URL: `https://dev.azure.com/mycompany`
3. Enter Project name: `MyProject`
4. Paste Personal Access Token
5. Click "Connect"
6. See test plans load

### Task 2: Create a Login Test Case
1. Select test plan → Suite
2. Click "New Test Case"
3. Name: "User Login with Valid Credentials"
4. Add Step 1:
   - Title: "Navigate to login page"
   - Action: "Open browser to {baseUrl}/login"
   - XPath: `//input[@id="username"]`
5. Add Step 2:
   - Title: "Enter username"
   - Action: "Type {username} in username field"
   - Dynamic: YES, Replacement Key: "username"
6. Add Step 3:
   - Title: "Click login button"
   - XPath: `//button[@type="submit"]`
   - Expected: "User dashboard visible"
7. Save Case
8. See case appear in suite

### Task 3: Search Help for "Locator Types"
1. Click Help (? icon) in header
2. Type "locator" in search
3. See 5 matches highlighted
4. Press Enter to cycle through
5. Read about XPath, CSS, ID locator types
6. Press Escape to close

### Task 4: Edit Test Parameters
1. Open test case editor
2. Scroll to Parameters section
3. See defined parameters: `baseUrl`, `username`, `password`
4. Click Edit on "username"
5. Change default value
6. Click Save
7. See updated in steps referencing it

---

## 🐛 Troubleshooting Common Issues

### Issue: "Connection Failed"
**Cause:** Invalid credentials or network issue  
**Solution:** 
1. Verify Organization URL format
2. Check Personal Access Token expiration
3. Confirm project exists
4. Check internet connection
5. Generate new PAT if token is expired

### Issue: "Test Cases Won't Save"
**Cause:** Network disconnection or Azure DevOps API error  
**Solution:**
1. Check internet connection
2. Verify Azure DevOps is accessible
3. Check token hasn't expired
4. Review test case for validation errors
5. Try again or contact admin

### Issue: "Help Guide Won't Search"
**Cause:** Browser cache or JavaScript error  
**Solution:**
1. Clear app cache in Settings
2. Restart application
3. Check browser console for errors
4. Try search with different keywords

### Issue: "Slow Performance When Many Cases"
**Cause:** Large test suite with hundreds of cases  
**Solution:**
1. Filter by suite to reduce load
2. Close unused tabs/windows
3. Restart application
4. Check available system RAM

---

## 📈 Roadmap & Future Enhancements

### Phase 2: Execution & Reporting
- Test execution engine with step-by-step guidance
- Result recording and pass/fail validation
- Screenshot capture for failed steps
- Test result summaries and reports
- Trend analysis and metrics

### Phase 3: Collaboration
- Real-time multi-user editing
- Comments and annotations
- Review workflows
- Version history and rollback
- Team workspaces

### Phase 4: Advanced Automation
- Drag-and-drop UI for building steps
- AI-powered locator suggestions
- Self-healing locators
- Test data generation
- API testing support

### Phase 5: Analytics & Intelligence
- Test coverage analysis
- Risk assessment
- Predictive failure detection
- Performance bottleneck identification
- Dashboard with KPIs

---

## 📞 Support & Feedback

### Getting Help
- **In-app Help:** Press `?` or visit Help menu
- **Documentation:** User guides and API docs
- **Community:** Discussion forums and Slack channel
- **Support Email:** support@bromcom.com
- **Issue Tracker:** GitHub Issues

### Providing Feedback
- **Feature Requests:** Feature request form in app
- **Bug Reports:** Report via Help menu or email
- **Surveys:** Periodic user satisfaction surveys
- **Beta Testing:** Sign up for early access programs

---

## ✅ Quality Assurance

### Testing Coverage
- Unit tests: Component logic and utilities
- Integration tests: Azure DevOps API interactions
- E2E tests: Full user workflows
- Accessibility tests: WCAG compliance validation
- Performance tests: Load and stress testing

### Continuous Integration
- Automated tests on every commit
- Code review process for PRs
- Build verification before release
- Staging environment testing
- Beta user feedback before general release

---

## 📄 License & Terms

**Bromcom Test Builder** is developed and maintained by Bromcom Technologies.

- **License:** Commercial (per-seat or enterprise licensing)
- **Terms of Service:** Available on company website
- **Privacy Policy:** GDPR compliant, no data tracking
- **Support Agreement:** Included with license

---

**Last Updated:** April 2026  
**Version:** 1.0.0  
**Status:** Production Ready
