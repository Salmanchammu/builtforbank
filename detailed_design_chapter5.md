# 5. DETAILED DESIGN
# CHAPTER-5

## 5.1 Introduction
The detailed design phase elaborates on the system architecture by decomposing the application into modular functional segments. For "Smart Bank", this structure partitions routing, processing, and visualization models into respective domains belonging to the Admin, Staff, and Customer user groups. The interface designs, controller logic, and backend processing pipelines are meticulously categorized.

## 5.2 Applicable Documents
- Smart Bank Software Requirement Specification (SRS) - Chapter 2
- System Flow and Context Diagrams - Chapter 3
- Database Schema and Architecture - Chapter 4

## 5.3 Structure of the Software Package
The Smart Bank software operates utilizing a sophisticated web-app architecture (Flask backend with vanilla JS/HTML frontends).

### 5.3.1 Structure Chart for Admin
The Admin layer provides overarching system oversight, managing staff accounts, platform liquidity, and high-level infrastructural settings.

```mermaid
graph TD
    A[Admin Dashboard] --> A1[Staff Management]
    A --> A2[System Finance]
    A --> A3[Bank Locations]
    A --> A4[Audit Logs]
    A1 --> A1a[Add/Remove Staff]
    A1 --> A1b[Role Assignment]
    A2 --> A2a[Total Deposits]
    A2 --> A2b[Liquidity tracking]
    A3 --> A3a[Add Branch/ATM]
    A3 --> A3b[Photo Upload]
```

### 5.3.2 Structure Chart for Staff
The Staff layer is focused around task processing, KYC validations, account requests, and direct customer interactions via the support portal.

```mermaid
graph TD
    S[Staff Dashboard] --> S1[Account Operations]
    S --> S2[Service Desk]
    S --> S3[Agri Hub]
    S --> S4[Support Chat]
    S1 --> S1a[KYC Verification]
    S1 --> S1b[Account Requests]
    S2 --> S2a[Card Approvals]
    S2 --> S2b[Loan Processing]
    S3 --> S3a[Agri Loan Review]
    S3 --> S3b[Satellite analysis]
```

### 5.3.3 Structure Chart for Customer (User)
The Customer layer enables varied account operations tailored to the user profile (Retail, Corporate, Agriculture).

```mermaid
graph TD
    C[Customer Dashboard] --> C1[Financial Ops]
    C --> C2[Card Management]
    C --> C3[Savings Goals]
    C --> C4[Map Locator]
    C1 --> C1a[UPI Transfers]
    C1 --> C1b[NEFT/IMPS]
    C2 --> C2a[Virtual Cards]
    C2 --> C2b[Spend Limits]
    C3 --> C3a[Pockets]
    C3 --> C3b[Autosave]
```

## 5.4 Modular Decomposition of Components

```mermaid
graph TD
    SB[Smart Bank] --> AL[Admin Layer]
    SB --> SL[Staff Layer]
    SB --> CL[Customer Layer]
    
    AL --> AL1[Auth/Login]
    AL --> AL2[Staff Mgmt]
    AL --> AL3[Finance Hub]
    AL --> AL4[Map Admin]
    
    SL --> SL1[Shift Login]
    SL --> SL2[Task Queue]
    SL --> SL3[Agri Review]
    SL --> SL4[Support Hub]
    
    CL --> CL1[Register/Face ID]
    CL --> CL2[Wallet/Dash]
    CL --> CL3[Payments]
    CL --> CL4[3D Map]
```

### 5.4.1 Admin Layer
#### 5.4.1.1 Login & Central Auth
Secured biometric and password/PIN-based administrative access protocol granting elevated operational rights.

```mermaid
sequenceDiagram
    participant A as Admin
    participant S as System Auth
    participant DB as Database
    A->>S: Submit Credentials
    S->>S: Sanitize Input
    S->>DB: Query Admin Record
    DB-->>S: Return Hashed Password
    S->>S: Verify Hash (Werkzeug)
    ALT Success
        S-->>A: Token Issued
        S->>DB: Log Audit Event
    ELSE Failure
        S-->>A: 401 Unauthorized
    END
```
#### 5.4.1.2 Manage Staff & Workforce
Creation, deletion, and role assignment for bank staffing.
#### 5.4.1.3 Manage Customers
Overrides and direct suspension controls on customer profiles during fraudulent activity incidents.
#### 5.4.1.4 Manage General Ledger (System Finance)
Real-time tracking of total platform deposits, active loan liabilities, and liquid reserves.

```mermaid
graph LR
    DB[(Finance Tables)] --> P[Finance Logic]
    P --> UI[Admin UI]
    UI -->|Refresh| P
    P -->|Calculate| R[Reserve Ratio]
    R --> UI
```
#### 5.4.1.5 Manage Branch & ATM Locations (Map)
Administrative interface mapping utilizing MapLibre 3D, allowing admins to add or deactivate physical bank branch/ATM locations and attach geospatial images.
#### 5.4.1.6 Audit Logs
Viewable systemic trails logging transaction overrides, login attempts, and policy modifications.

### 5.4.2 Staff Layer
#### 5.4.2.1 Secure Login
Enforced login tracking shift times and operational access.
#### 5.4.2.2 My Task Desk (Queue Processing)
Approval workflow pipelines for new account creation requests, managing pending KYC (Know Your Customer) verifications, and validating document uploads.

```mermaid
sequenceDiagram
    participant S as Staff
    participant Q as Task Queue
    participant DB as Database
    S->>Q: Fetch Pending Tasks
    Q->>DB: GET pending_requests
    DB-->>Q: List of KYC/Account apps
    Q-->>S: Render Task List
    S->>Q: Review Application (ID/Face)
    S->>Q: Approve/Reject
    Q->>DB: UPDATE request_status
    Q->>DB: Send Notification to User
```
#### 5.4.2.3 Manage Card Approvals
Issuance workflows for new virtual debit/credit cards linked to customer accounts.
#### 5.4.2.4 Manage Agriculture Loans
A dedicated processing system for assessing farmer profiles, evaluating land yield metrics, and approving agriculture credit subsidies.

```mermaid
graph TD
    U[Farmer App] -->|Submit RTC| AH[Agri Hub]
    AH -->|API Call| SAT[Satellite Analytics API]
    SAT -->|Health Score| AH
    AH -->|Consolidated Data| S[Staff Review]
    S -->|Approve| AH
    AH -->|Credit Funds| DB[(Agri Repo)]
```
#### 5.4.2.5 Manage Customer Support
Handling live chat tickets, email escalations, and issuing localized user notifications for critical alerts.

### 5.4.3 Customer (User) Layer
#### 5.4.3.1 User Registration & Login
Fast, highly compliant onboarding systems utilizing biometric Face ID and document verification pathways.

```mermaid
sequenceDiagram
    participant U as User
    participant FB as face-api.js
    participant API as Backend API
    U->>FB: Open Camera
    FB->>FB: Detect Landmarks
    FB->>API: Send Match Request (Descriptor)
    API->>API: Euclidean Comparison
    ALT Distance < 0.6
        API-->>U: Success/Dashboard
    ELSE Bad Match
        API-->>U: Error/Retry
    END
```
#### 5.4.3.2 Financial Dashboard
The core interface reflecting dynamic balances (with privacy eye toggles), recent transactions, and segmented transaction history analytics.
#### 5.4.3.3 Funds Transfer (NEFT/UPI)
Enabling secure peer-to-peer or peer-to-business liquidity transfers including beneficiary lifecycle management.
#### 5.4.3.4 Physical/Virtual Cards
Interface to review connected cards, request new tier upgrades, and perform emergency block/unblock actions.
#### 5.4.3.5 Savings Goals (Pockets)
Tool allowing users to lock designated funds into target-oriented savings vaults, with progress visualizers.
#### 5.4.3.6 Location Finder Map
A fully interactive, MapLibre-powered 3D spatial map enabling customers to navigate to the nearest Branches and ATMs uploaded by the bank staff.

```mermaid
sequenceDiagram
    participant U as User
    participant M as 3D Map (MapLibre)
    participant API as Backend
    U->>M: Open Locator
    M->>API: GET /locations
    API-->>M: JSON (Lat/Lng, Photo_URL)
    M->>U: Render Markers
    U->>M: Click Marker
    M->>M: Display Popup (with Photo)
```
