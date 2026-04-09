# CHAPTER-2: SOFTWARE REQUIREMENT AND SPECIFICATION

## 2.1 INTRODUCTION

### 2.1.1 Purpose
The purpose of this document is to provide a detailed description of the software requirements for the "Smart Bank" platform. It outlines the functional and non-functional requirements, external interfaces, and design constraints to ensure a secure, biometric-enabled banking experience.

### 2.1.2 Scope
The scope of Smart Bank includes user authentication via face recognition, multi-account management, simulated fund transfers (UPI/NEFT), 3D branch mapping, and a specialized AI-driven Agriculture Hub. The system serves three primary roles: Users (Customers), Bank Staff, and Administrators.

### 2.1.3 Definitions, Acronyms and Abbreviations
*   **SRS**: Software Requirement Specification
*   **UPI**: Unified Payments Interface
*   **KYC**: Know Your Customer
*   **RTC**: Record of Rights, Tenancy and Crops (Agri-Land Proof)
*   **NEFT**: National Electronic Funds Transfer
*   **200 OK**: Standard HTTP success response

### 2.1.4 Reference
*   IEEE Std 830-1998 for SRS Documentation.
*   Smart Bank Chapter-1: Synopsis.
*   Face-api.js Technical Documentation.

### 2.1.5 Overview
This SRS covers the overall description of the banking product, specific requirements for user and hardware interfaces, and critical security and safety protocols for financial data management.

## 2.2 OVERALL DESCRIPTION

### 2.2.1 Product Perspective
"Smart Bank" is a standalone, web-based digital banking ecosystem. It operates on a client-server architecture where the frontend (HTML/CSS/JS) interacts with a Python Flask backend and a centralized SQLite relational database.

### 2.2.2 Product Features
*   **Biometric Login**: Face-Recognition based authentication for all roles.
*   **Agri-Hub**: Satellite-verified land approvals and specialized crop marketplace.
*   **3D Locator**: Precision navigation for ATMs and Branches using MapLibre GL.
*   **Finance Tools**: Savings Goals (Pockets), Fixed Deposits, and Statement Filtering.
*   **Admin Control**: Full-lifecycle management of user accounts and loan requests.

### 2.2.3 User Characteristics
*   **Customers**: General users needing account management and transfer capabilities.
*   **Bank Staff**: Specialized users managing KYC, loan approvals, and agri-hub records.
*   **Administrators**: Super-users managing system-wide audits and staff assignments.

### 2.2.4 General Constraints
*   **Browser Compatibility**: Optimized for Google Chrome due to WebGL and Camera requirements.
*   **Hardware Limitation**: Minimum 8GB RAM required for real-time facial recognition processing.
*   **Simulated Environment**: All financial transactions are simulated for educational/demonstration purposes.

### 2.2.5 Assumptions and Dependencies
*   Users are assumed to have a functioning webcam for Face Authentication.
*   The system depends on stable internet connectivity for Content Delivery Networks (CDN) like FontAwesome and Google Fonts.

## 2.3 SPECIFIC REQUIREMENTS

### 2.3.1 External Interface Requirements
The system interacts with standard web cameras for image capture and local storage for PDF statement persistence.

### 2.3.2 User Interface
A "Modern White" premium interface utilizing glassmorphism effects, responsive flexbox layouts, and a dedicated Dark/Light Mode toggle for multi-lighting environments.

### 2.3.3 Hardware Interface
Direct integration with the device’s camera via `navigator.mediaDevices.getUserMedia()` for biometric scanning and GPU acceleration for 3D Map rendering.

### 2.3.4 Software Interface
*   **Frontend**: JavaScript ES6+ / CSS3 / HTML5.
*   **Backend**: Python 3.8+ / Flask.
*   **Database**: SQLite3.
*   **Mapping**: MapLibre GL & Leaflet.js.

### 2.3.5 Communication Interface
All internal communication between client and server is handled via AJAX/Fetch API using JSON serialized data over secure HTTP (HTTPS).

### 2.3.6 Functional Requirements
*   **FR1**: System MUST recognize user faces within 2 seconds.
*   **FR2**: System MUST allow PDF statement filtering by month/6-months/year.
*   **FR3**: System MUST provide distinct dashboards based on user role login.

### 2.3.7 Performance Requirements
*   **Latency**: Backend responses should be under 500ms for account queries.
*   **Reliability**: Support up to 50 concurrent simulated accounts in a local environment.

### 2.3.8 Design Constraints
The system must maintain a unified design language (Modern White) across all sub-pages.

#### 2.3.8.1 System Attributes
*   **Availability**: 99.9% simulation uptime.
*   **Scalability**: Structured to allow migration to PostgreSQL for enterprise use.

## 2.4 OTHER REQUIREMENTS

### 2.4.1 Safety Requirements
*   Automatic session timeout after 15 minutes of inactivity.
*   Visual masking of sensitive account balances using the "Eye" toggle feature.

### 2.4.2 Security Requirements
*   **Biometric Integrity**: Face descriptors are encrypted and never stored as raw images.
*   **Transaction Guard**: 4-digit mobile passcodes required for sensitive mobile actions.
*   **Input Validation**: All forms are sanitized to prevent SQL Injection and Cross-Site Scripting (XSS).
