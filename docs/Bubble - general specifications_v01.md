# Bubble \- general specifications

Nx is the monorepo orchestration tool used to manage the entire project.  
The project uses multiple official Nx plugins to scaffold and manage different kinds of projects:

* @nrwl/nest  
* @nrwl/node  
* @nrwl/angular  
* @nrwl/jest  
* @nrwl/linter  
* @nrwl/workspace  
* @nrwl/cli  
* @nrwl/tao

# Organization

The project is organized as an Nx workspace with two main directories:

* apps/ — contains application-level entry points (runnable services)  
* libs/ — contains reusable logic and domain-specific libraries

Project-wide configuration is centralized at the root level:

* Build/test configurations: workspace.json, nx.json  
* Shared TypeScript configuration: tsconfig.base.json  
* Global test config: jest.config.js, etc.

# Application Projects

Each subfolder in apps/ represents a self-contained application (typically a microservice).  
Apps follow a consistent structure:

* src/app/ contains the NestJS module definitions and dependency setup.  
* Each app defines its own tsconfig.\*.json, jest.config.js, Dockerfile, and project.json.  
* Internal modules in each app are organized under app/

Each directory under apps/ represents a deployable application, typically a microservice or frontend, designed to encapsulate all the logic required to run a discrete, isolated part of the system.  
In this architecture, the apps/ packages are the boundary between implementation and deployment.  
They are not responsible for implementing business logic, but for:

* Assembling domain logic (from libs/)  
* Configuring frameworks (NestJS, MikroORM)  
* Wiring infrastructure (modules, providers, clients, etc.)  
* Bootstrapping the runtime  
* Managing external exposure (e.g., HTTP endpoints, message listeners)

## Composition over Implementation

Unlike libs/, which contain logic and implementation details, the apps/ layer does not:

* Define domain entities or interfaces  
* Write business logic or persistence logic  
* Contain validations or business rules  
* Instead, it composes and orchestrates:  
  * Domain modules (from libs/\<domain\>/\<subdomain\>/core)  
  * Integration modules (REST, gRPC, message queues)  
  * Third-party service clients (Stripe, Mailchimp, etc.)  
  * Platform-level services (file system, PDF generation, etc.)

This separation of concerns adheres to the hexagonal (ports and adapters) or onion architecture patterns.

Apps serve as the integration glue for:

* Domain logic (via libs/.../core)  
* Shared interfaces and contracts (via libs/.../common)  
* Application-level concerns (monitoring, scheduling, logging, etc.)  
* External APIs (REST endpoints, event listeners, consumers)

They may expose:

* REST APIs  
* CronJobs  
* Event listeners (via RabbitMQ, Kafka, etc.)  
* Scheduled background workers

But they should not define the underlying logic of those operations.

## Dependency Direction Rules

Apps depend on libs — never the other way around.  
This ensures that:

* libs/ remain decoupled and reusable  
* apps/ are the only place where cross-cutting concerns and service-specific wiring occurs

# Domain and Utility Libraries

The libs/ directory forms the domain layer of the system. It is the foundation upon which all application-level logic is built.  
If apps/ are the runnable surfaces, libs/ are the architectural and business core.  
Each library encapsulates a bounded context, following vertical slicing by domain — e.g., libs/transactions, libs/time-sheets/leave, libs/catalog.

Every folder in libs/ represents a domain or subdomain.  
Domains are nested hierarchically if needed:  
Domain libraries are not flat; they are scoped and isolated, allowing clear ownership and decoupling.

## Domain Layering in libs/

Each domain is layered into the following logical components:

1. common/ — Contracts and Types

The common/ layer holds the public shape of the domain. This includes:

* Domain entity interfaces (e.g., LeaveType, Transaction)  
* Manager/service interfaces (e.g., LeaveTypeManager)  
* Value types or enums (e.g., LeaveHoursSource)  
* Dependency injection tokens (TOKENS, SYMBOLS)  
* Constants used by both core and external systems

Characteristics:

* No framework-specific code  
* No decorators or class implementations  
* Purely declarative

Purpose:

* Acts as a contract boundary  
* Enables interface-first design  
* Encourages mocking and testing by depending only on abstractions

2. core/ — Implementation of Domain Logic

The core/ layer provides concrete implementations of the contracts declared in common/.  
It is structured under src/lib/ into the following subfolders:

* entities/	ORM-based entity classes (e.g., MikroORM @Entity() classes)  
* services/	Service or manager classes that encapsulate persistence and logic  
* \*.module.ts	NestJS module that registers entities, services, and providers

Conventions:

* Entity implementations follow the naming pattern: \<EntityName\>Impl  
* Manager implementations follow the pattern: MikroOrm\<EntityName\>Manager  
* All classes are decorated with @Injectable() or @Entity(), as needed  
* NestJS modules always register providers and export them for app-level use

## Microservice libraries

These libraries implement the messaging and transport layer for backend communication between services, without embedding business logic.

1. microservice-client/ — Message Producers (Outbound Integration)

Encapsulates the logic for publishing messages or making remote calls to other services.  
This can include:

* NATS or Redis-based message publishing  
* Request-response patterns (RPC-like behavior)  
* Outbound event dispatch  
* Injectable NestJS services used by apps/ to trigger events or remote calls  
* Message type declarations (optional, if not reused)

Characteristics

* Depends on NestJS transport (@nestjs/microservices)  
* Does not depend on core/  
* Uses only common/ for shared contracts  
* Always encapsulated in a NestJS module

2. microservice-server/ — Message Consumers (Inbound Handlers)

Encapsulates message handling logic: defines how the service receives and responds to events or remote calls.  
This can include:

* Subscriptions to message queues or topics  
* Event listeners  
* RPC handlers  
* Transport-specific decorators and logic

Characteristics

* Uses @nestjs/microservices decorators  
* Declares only infrastructure logic, not domain services  
* Registered in the app’s microservice configuration

## Other subdomains

Subdomains must serve a clearly distinct architectural concern  
Any additional subdomain must exist to isolate a technical or business responsibility that is not part of core domain logic (implemented in core/) or domain contracts (declared in common/).  
Typical valid purposes include:

* External communication (e.g., calling another service)  
* Message transport (producers/consumers)  
* Configuration of infrastructure components  
* Mappers or data translation between systems

They must not contain business logic or duplicate functionality from core/ or common/.

Additional subdomains may depend on common/ types, constants, or interfaces or on core/ implementations

All exposed functionality must be encapsulated in a NestJS module  
Each subdomain must include at least one \*.module.ts file  
That module must:

* Register all providers, clients, and adapters  
* Export any classes that will be used in apps or other modules

This guarantees that wiring happens only via NestJS dependency injection, never via raw imports

Subdomains must not:

* Re-implement or override any core/ service, manager, or entity  
* Declare new interfaces for core domain concepts

If multiple architectural concerns exist (e.g., HTTP client vs. message producer), they must be split:

* Into separate subdomains entirely  
* No subdomain should become a “catch-all” for miscellaneous logic.

## Frontend libraries

The frontend code is modularized under the libs/ directory using domain-based vertical slicing. Each domain (e.g. employees, time-sheets, partners, etc.) contains one or more frontend-oriented libraries that encapsulate components, modules, services, and contracts relevant to that domain.

Frontend libraries are:

* Isolated: No direct cross-imports between domain features unless explicitly allowed  
* Tree-shakable: Only modules and components explicitly imported in the app are bundled  
* Lazy-loadable: Designed to be routed via loadChildren() in Angular apps  
* Strictly typed: Use shared types from backend contracts (via libs/.../common)

They do not:

* Bootstrap applications  
* Register global providers  
* Handle routing globally

Those responsibilities live in apps/.

## Frontend library typologies

1. Frontend

Encapsulates UI components and feature-specific Angular modules. This is the primary type of frontend library representing a UI slice of a business domain.

Characteristics

* Located in paths like: libs/\<domain\>/\<feature\>/frontend/  
* Defines its own \*.[module.ts](http://module.ts)  
* May include:  
  * Components  
  * Services (for interaction with backend APIs)  
2. Frontend Shared

Provides shared UI components or logic that is reused across multiple feature libraries or pages.

Characteristics

* Located at: libs/\<domain\>/\<feature\>/frontend-shared/  
* Display utilities  
* Used as dependency in other frontend libraries to avoid duplication

3. Frontend Components

Offers atomic, reusable UI components that follow design-system rules but are not tied to business logic.

Characteristics

* Typically rendered in many contexts (cards, tables, widgets)  
* Encapsulate no feature logic or state  
* May be themed, styled, or slotted for flexibility

## Relationship Between Frontend and Backend

Although frontend and backend are in the same monorepo, they are:

- Loosely coupled via shared common/ libraries (from libs/)  
- Connected via Angular HTTP clients, often defined in frontend-specific services  
- Bound to backend DTOs and interfaces, which are imported from shared domain contracts

## File Naming and Structure

File and folder names are kebab-case.  
File names always match the name of the primary exported structure.  
Class names use UpperCamelCase.  
Interfaces are not prefixed (e.g., no I), but are placed in separate common/ packages.  
Constant identifiers (e.g., tokens) are named in FULL\_UPPERCASE.

## NestJS Module Design

Every core/ library defines a \*-core.module.ts NestJS module.  
This module:

* Registers MikroORM entities  
* Declares and exports service providers  
* Imports dependencies from other modules if needed  
* The module file resides directly under src/lib/.

## Implementation Rules

Implementations (core/) must depend on interfaces defined in common/, not vice versa.  
Entities implement the corresponding interfaces from common/.  
Services and managers extend standardized base classes (implied by naming conventions).  
No logic is duplicated across domains; contracts define the shape, and core provides implementation.

## Dependency Direction Rules

Each domain’s core/ layer:

* Implements only the interfaces defined in its own common/ layer  
* Exposes its capabilities via the \*.module.ts file  
* Never depends on another domain’s core/  
* May consume other domain common/ layers if explicitly needed

# Deployability and Isolation

Each app is independently deployable and includes a Dockerfile.  
Microservice boundaries align with app folders; integration is done at the app level, not within domain libs.  
Each app bundles only the domains it needs via explicit imports.

# Features

## Users

This feature handles user registration, authentication, account data, roles, and profile access. It includes both a backend microservice and a frontend module, developed in a modular, testable, and reusable way.

### Required Libraries

Each feature domain is split into sub-libraries under libs/users/service/:

* common/ \- Shared contracts (interfaces, types)  
* core/ \- Backend logic (entity, manager, controller)  
* frontend/ \- Angular module (edit, list, form)  
* frontend-shared/ \- Services, tokens, factories  
* frontend-components/ \- UI widgets (dropdowns, avatars)  
* microservice-client/ \- Messaging adapter for other backends  
* microservice-server/ \- Listener/controllers for this backend

### Domain Entity: User

The core entity of the feature is the User. This entity represents the identity of a person who interacts with the system. It includes typical fields:

* A unique identifier (UUID)  
* Email address  
* Display name  
* Active/inactive status  
* Role within the system (e.g., admin, manager, user)  
* Creation and update timestamps  
* Password Hash (never exposed)

This entity is defined as an interface in the common package and implemented by an ORM class in the core package.

### Role Enumeration

To support role-based logic, a UserRole enumeration is defined. This enumeration describes the available roles a user can have, such as:

* Admin  
* Manager  
* Standard user

These roles are used across both frontend and backend for access control, display logic, and validation.

### User Status

Typical values:

* Active  
* Inactive

### Manager Interface

Each primary entity, including User, is associated with a Manager interface. This defines the operations available for the entity, such as finding, saving, deleting, and searching. These operations are standard.

### Search Context

A SearchContext interface is defined to allow searching or filtering users. This describes which fields can be used for querying:

* Name (partial match)  
* Email  
* Role  
* Status

This context is passed to both backend and frontend list/search functions and is interpreted declaratively.

### CRUD Event Integration

User-related operations may emit or respond to events such as:

* User created  
* User updated  
* User deleted

These events are triggered from the backend and consumed either internally or by other services using microservice server/client layers.

### Authentication

A controller in the *core* library exposes a *POST /auth/login* endpoint with payload: { username: string; password: string }  
An authenticator looks up the user by email and a password hasher to verify the password.  
On success, it returns:

* The basic user profile  
* JWT auth token

#### Passwords

Passwords are never stored in plain text — use bcrypt or Argon2.  
The auth controller does not expose password hash.

### Frontend

On the frontend, services such as the UserManager are registered via dependency injection tokens. These tokens abstract the implementation and allow components and routes to work with the manager interface regardless of transport.

1. Feature Module: *users/service/frontend*

This is the central frontend entry point for all user-related pages. It defines the Angular module, routing configuration, and page components.

Pages:

* User List Page – Displays all users with filtering and bulk actions  
* User Edit Page – Edit form for existing users  
* User Add Page – Form to create a new user (reuses edit form)  
* User View – Read-only profile preview

Routing is defined in routes/ and is using Angular route resolvers.  
Routes include:

* /users \- list  
* /users/:id \- edit  
* /users/new \- create

Forms:

* Uses a reusable reactive form component (user-form) for both creation and editing  
* Pre-populated using route resolver data for edit

### List Users

* Table view with columns: name, email, role, status  
* Search and filtering by name, role, or active flag  
* Optional bulk actions (e.g., enable/disable)  
* Pagination and server-side sorting  
* Actions per row: edit, deactivate/reactivate, delete

## Add New User

* Navigated via /users/new  
* Displays user-form with empty model  
* On submit, calls save() on manager  
* Redirects to list or edit screen upon success

### Edit Existing User

* Navigated via /users/:id  
* Loads user via route resolver  
* Displays user-form pre-filled with model  
* Allows updating name, role, email, status  
* Save updates the user and shows confirmation

### Change Status (Activate/Deactivate)

* Toggled from the list or inside edit  
* Uses a flag like active: true/false  
* Triggers a confirmation dialog  
* Save triggers update via manager

### Delete User

* Action from list or detail view  
* Confirmation modal  
* Uses manager’s delete() method  
* Automatically refreshes list

### Authentication

* User visits */login*  
* A *login-form* component captures credentials and calls an authenticator which uses REST to call the backend endpoint.  
* On success:  
  * The auth token is saved in the session storage  
  * The auth token will be used in all subsequent requests  
  * Redirects to dashboard  
* Required fields are going to be validated in real time  
* An invalid credentials error will be displayed when such an error is received from the backend  
* The auth token will be checked for expiry periodically and the user will be logged if necessary

2. Shared Logic: *users/service/frontend-shared*

Provides injectable services, reactive state, and configuration tokens for the feature module.

Includes:

* A REST-backed implementation of the UserManager interface  
* In-memory user storage for caching session state  
* Listener that reacts to auth events to clear/reset state  
* Factory and token setup for dependency injection  
* This layer ensures that the feature module is fully decoupled from transport concerns.

The UserManager interface is fulfilled by a service that uses Angular HttpClient to communicate with the backend via REST.  
All operations (find, save, delete, search) go through this service.

3. UI Components: *users/service/frontend-components*

Provides reusable, presentation-focused UI elements that are used inside pages and forms.

Components include:

* User Select Dropdown – single or multi-select dropdown for users  
* Role Tag – displays role with styling  
* Status Chip – shows active/inactive state

These components are stateless and bind only to inputs and outputs. They rely on style encapsulation and may extend a design system.

## Partners

The partners feature represents organizations, customers, or external entities that interact with the system. Each Partner has a name and a description and is implemented as a full-stack modular domain with a frontend module, backend logic, and optional integration points.

### Required Libraries

Each feature domain is split into sub-libraries under *libs/partners/service/*:  
*common/* \- Shared contracts (interfaces, types)  
*core/* \- Backend logic (entity, manager, controller)  
*frontend/* \- Angular module (edit, list, form)  
*frontend-shared/* \- Services, tokens, factories  
*frontend-components/* \- UI widgets (dropdowns, avatars)  
*microservice-client/* \- Messaging adapter for other backends  
*microservice-server/* \- Listener/controllers for this backend

### Domain Entity: Partner

Defines the domain model and manager interface shared across backend and frontend.

* A unique identifier (UUID)  
* Name  
* Optional description

This entity is defined as an interface in the common package and implemented by an ORM class in the core package.

### Manager Interface

Each primary entity, including Partner, is associated with a Manager interface. This defines the operations available for the entity, such as finding, saving, deleting, and searching. These operations are standard.

### Search Context

A *SearchContext* interface is defined to allow searching or filtering partners. This describes which fields can be used for querying:  
Name (partial match)  
Description

This context is passed to both backend and frontend list/search functions and is interpreted declaratively.

### CRUD Event Integration

Partner-related operations may emit or respond to events such as:

* Partner created  
* Partner updated  
* Partner deleted

These events are triggered from the backend and consumed either internally or by other services using microservice server/client layers.

### Frontend

On the frontend, services such as the PartnerManager are registered via dependency injection tokens. These tokens abstract the implementation and allow components and routes to work with the manager interface regardless of transport.

1. Feature Module: *users/partners/frontend*

This is the main Angular module responsible for displaying all partner-related pages and routes in the app.

Pages:

* List: Displays a table/grid of all partners, with the ability to filter by name and perform row-level actions (edit or delete). It supports pagination and sorting.  
* Edit: Displays a form for editing an existing partner. The form is populated using data fetched via a route resolver.  
* Add: Reuses the same form component as the edit page but starts with an empty model. It is accessed via a separate route and saves a new partner.

Routes are defined declaratively and lazy-loaded by the main app.

Routes:

* /partners \- list  
* /partners/:id \- edit  
* /partners/new \- create

Each route uses a resolver to fetch required data (where applicable) before activating the route.

#### Form

A dedicated form component is used for both creating and editing partners.  
The form captures:

* Partner name  
* Partner description

The form component does not know whether it is in create or edit mode — it operates purely based on the bound model.

### List Partners

Displays partners in a table with columns:

* Name  
* Description (optional truncation)

Includes:

* Filtering by name  
* Pagination  
* Sort controls (e.g., alphabetically)  
* Row-level actions:  
  * Edit  
  * Delete

### Add New Partner

Triggered via a button on the list view

* Navigates to the add route  
* Form is displayed with empty model  
* Fields are validated (e.g., name is required)

### Edit Partner

* Accessed via route (e.g., from the list or direct link)  
* Model is resolved before the page loads  
* Form is populated with existing values  
* Allows full editing of name and description

### Delete Partner

* Available from the list view  
* Requires confirmation

2. UI Components: *partners/service/frontend-shared*

Provides reusable services and injectable tokens that allow the frontend feature module to remain transport-agnostic and testable.

* Provides a REST-based implementation of the PartnerManager interface  
* Exposes dependency injection tokens for use in routed components and resolvers  
* Manages partner-related frontend state if needed (e.g., in-memory caching)

3. Feature Module: *partners/service/frontend-components*

Offers reusable, presentation-focused UI elements for use in forms and views.

* Partner Dropdown (Single Select) \- Allows choosing one partner in relation to other entities (e.g., in forms elsewhere)

These components are designed to be used outside of the partners module.

### Data Flow and Service interaction

The form and list components interact only with the PartnerManager interface, never with the raw REST service directly.  
The actual implementation (REST-based or otherwise) is injected using Angular dependency injection tokens defined in the shared layer.  
All CRUD actions (search, save, delete) are performed through this service layer.  
List and edit routes use resolvers to load required partner models before rendering the page.  
No state is kept globally unless explicitly required; all forms are stateless by default.

## Interviews

The interviews feature is implemented as a standard backend domain centered around the Interview entity, which embeds a collection of InterviewQuestions.

### Required Libraries

Each feature domain is split into sub-libraries under libs/partners/service/:  
common/ \- Shared contracts (interfaces, types)  
core/ \- Backend logic (entity, manager, controller)  
frontend/ \- Angular module (edit, list, form)  
frontend-shared/ \- Services, tokens, factories  
frontend-components/ \- UI widgets (dropdowns, avatars)  
microservice-client/ \- Messaging adapter for other backends  
microservice-server/ \- Listener/controllers for this backend

### Domain Entity: Interview

Represents a planned evaluation session. Contains:

* A unique identifier  
* Name  
* Scheduled date  
* Associated partner (as a reference to the Partner entity)  
* A collection of InterviewQuestion objects  
* Themes  
* Topics

This is a primary entity: it has its own manager and controller.  
Themes and topics are not exclusive, and interviews do not own these records \- they reference global theme/topic catalogs.

### Domain entity: Theme

Contains: 

* A unique identifier  
* name   
* description (optional)

Exposed via reference in the interview model.

### Domain Entity: Topic

Contains:

* A unique identifier  
* name  
* description (optional)

### Secondary Entity: InterviewQuestion

Represents a single question attached to an interview. Contains:

* Question text (required)  
* Optional description  
* A rank field (used for ordering)

This is a secondary embedded entity: it does not have its own manager or lifecycle. It is always managed through the Interview entity.

### Manager Interface

Each primary entity, including Interview, is associated with a Manager interface. This defines the operations available for the entity, such as finding, saving, deleting, and searching. These operations are standard.

### Search Context

A *SearchContext* interface is defined to allow searching or filtering interviews. This describes which fields can be used for querying:

* Name (partial match)  
* Description  
* Partner

This context is passed to both backend and frontend list/search functions and is interpreted declaratively.

### CRUD Event Integration

Interview-related operations may emit or respond to events such as:

* Interview created  
* Interview updated  
* Interview deleted

These events are triggered from the backend and consumed either internally or by other services using microservice server/client layers.

### Frontend

The interviews feature is built as a self-contained Angular domain module that allows managing interviews and their associated questions. It supports creating, editing, viewing, and listing interviews, and handles nested form state for managing multiple questions per interview.

1. Feature Module: *interviews/service/frontend*

This is the routed, top-level Angular module for all UI operations related to interviews. It manages form logic, display views, and navigation.

Pages:

* Interview List Page \- Displays all interviews in a tabular format. Supports filters (e.g., by partner, date). Provides actions to create, view, and edit interviews.  
* Interview Edit Page \- Used for editing an existing interview. Includes the ability to modify basic metadata (scheduled date, partner) and reorder or edit the associated interview questions.  
* Interview Add Page \- Uses the same form as the edit page, initialized with an empty interview model. Allows adding multiple questions dynamically.

Routes:

* /interviews \-  list  
* /interviews/new \- add  
* /interviews/:id \- edit

Each route uses a resolver to prefetch the interview model.  
Questions are part of the nested interview object and not routed separately.

#### Form

The form handles both primitive fields (scheduled date, partner) and nested collections (interview questions).  
A partner is selected via a dropdown (using the shared partner component).  
Questions can be:

* Added dynamically  
* Removed individually  
* Reordered (drag-and-drop)

All form changes are bound to a single reactive form group structure.

### List Interviews

Tabular view with:

* Name  
* Scheduled date  
* Partner name  
* Number of questions  
* Themes  
* Topics

Includes:

* Filters (e.g., by partner or upcoming/past, theme, topics)  
* Pagination and sorting (by date)

Row actions:

* Edit  
* View  
* Delete

### Add New Interview

Navigates to */interviews/new*

Displays:

* Scheduled date picker  
* Partner selector  
* Section for managing multiple questions  
* Select Themes (tag input)  
* Select Topics (tag input)  
* Allows adding as many questions as needed:  
  * Question text  
  * Optional description

On save:

* Saves any new themes or topics through the ThemeManager or TopicManager  
* The entire interview (with questions) is submitted via the InterviewManager  
* Redirects to list

Themes and topics may be created on the fly as they are added to various interviews.

### Edit Interview

Accessed via */interviews/:id*  
Interview is loaded via resolver  
All fields, including associated questions, are pre-populated  
Questions can be edited in place, reordered, or removed  
Adding new questions is also supported.

### Delete Interview

Deletion may be supported from the list page  
Requires confirmation  
Removes the entire interview and all related questions  
Triggers a refresh of the list view

2. Shared Logic: *interviews/service/frontend-shared*

Provides injected services and abstraction over REST-based communication.  
Offers a DI-bound implementation of InterviewManager  
Handles all CRUD operations using Angular HttpClient

3. UI Components: *interviews/service/frontend-components*

Supplies reusable UI elements for question editing and interview-related selection.

* InterviewQuestionEditor \- Inline component for creating or editing a single question. Contains:  
  * Text input (required)  
  * Optional description textarea  
  * Rank input (drag handle)  
* InterviewQuestionList \- Displays all questions for an interview in editable format with reorder/delete buttons  
* InterviewSummaryCard \- Read-only preview of an interview (date, partner, question count)

### Data Flow and Manager Interaction

Components interact exclusively with the InterviewManager interface  
All nested question data is handled as part of the interview model — no separate API for questions  
Resolvers fetch the full interview object before routing to edit form  
All validation, save, and delete logic flows through the manager implementation provided in frontend-shared

