# Task 25.4: End-to-End Testing Verification

## Overview
This document provides a comprehensive manual testing checklist for all user workflows in the Realtime Collaborative Editor application.

## Test Environment
- **Client URL**: http://localhost:5173
- **Server URL**: http://localhost:3000
- **WebSocket URL**: ws://localhost:3001

## Prerequisites
- Server and client applications running
- Redis instance running
- PostgreSQL database initialized
- Multiple browsers available for testing

---

## 1. User Authentication Workflows

### 1.1 User Registration
- [ ] Navigate to registration page
- [ ] Fill in valid user details (name, email, password)
- [ ] Verify password strength indicator updates correctly
- [ ] Submit registration form
- [ ] Verify successful registration and redirect to documents page
- [ ] Verify error handling for:
  - [ ] Duplicate email
  - [ ] Weak password
  - [ ] Missing required fields
  - [ ] Invalid email format

### 1.2 User Login
- [ ] Navigate to login page
- [ ] Enter valid credentials
- [ ] Verify successful login and redirect to documents page
- [ ] Verify error handling for:
  - [ ] Invalid credentials
  - [ ] Missing fields
  - [ ] Network errors

### 1.3 Session Management
- [ ] Verify user remains logged in after page refresh
- [ ] Verify logout functionality
- [ ] Verify protected routes redirect to login when not authenticated
- [ ] Verify token expiration handling

---

## 2. Document Management Workflows

### 2.1 Document List View
- [ ] Verify documents load on page load
- [ ] Verify document cards display:
  - [ ] Document title
  - [ ] User role (Owner/Editor/Viewer)
  - [ ] Last modified date
  - [ ] Character count
- [ ] Test view mode toggle (Grid/List)
- [ ] Test infinite scroll loading
- [ ] Verify empty state when no documents exist

### 2.2 Create Document
- [ ] Click create document button
- [ ] Enter document title
- [ ] Submit form
- [ ] Verify document appears in list
- [ ] Verify redirect to editor
- [ ] Test error handling for:
  - [ ] Empty title
  - [ ] Network errors

### 2.3 Open Document
- [ ] Click on document card
- [ ] Verify redirect to editor
- [ ] Verify document content loads
- [ ] Verify connection status shows "Connected"

---

## 3. Collaborative Editing Workflows

### 3.1 Real-time Editing (Single User)
- [ ] Open document in editor
- [ ] Type content
- [ ] Verify content appears in editor
- [ ] Verify sync status updates
- [ ] Verify character count updates
- [ ] Verify content persists after page refresh

### 3.2 Real-time Editing (Multiple Users)
**Setup**: Open same document in two different browsers

- [ ] User 1: Type content
- [ ] User 2: Verify content appears in real-time
- [ ] User 2: Type content
- [ ] User 1: Verify content appears in real-time
- [ ] Verify no conflicts or data loss
- [ ] Verify CRDT convergence (both users see same content)

### 3.3 Cursor Presence
**Setup**: Two users in same document

- [ ] User 1: Move cursor
- [ ] User 2: Verify User 1's cursor position visible
- [ ] User 1: Select text
- [ ] User 2: Verify User 1's selection visible
- [ ] Verify cursor colors are distinct
- [ ] Verify cursor labels show user names

### 3.4 User Presence Indicators
**Setup**: Multiple users in same document

- [ ] Verify presence avatars appear for all users
- [ ] Verify user count is accurate
- [ ] Verify activity status updates:
  - [ ] "typing" when actively editing
  - [ ] "idle" after 30 seconds of inactivity
  - [ ] "away" after 5 minutes of inactivity
- [ ] Verify user disappears when they leave

---

## 4. Document Sharing Workflows

### 4.1 Share Document
- [ ] Open document settings/share dialog
- [ ] Enter email of user to share with
- [ ] Select permission level (Editor/Viewer)
- [ ] Submit share request
- [ ] Verify user added to shared users list
- [ ] Verify error handling for:
  - [ ] Invalid email
  - [ ] User not found
  - [ ] Already shared

### 4.2 Permission Levels
**Setup**: Share document with different permission levels

- [ ] **Viewer**: 
  - [ ] Verify can view document
  - [ ] Verify cannot edit document
  - [ ] Verify cannot share document
- [ ] **Editor**:
  - [ ] Verify can view document
  - [ ] Verify can edit document
  - [ ] Verify can share document
- [ ] **Owner**:
  - [ ] Verify can view document
  - [ ] Verify can edit document
  - [ ] Verify can share document
  - [ ] Verify can delete document
  - [ ] Verify can change document settings

### 4.3 Remove User Access
- [ ] Open share dialog
- [ ] Remove user from shared users list
- [ ] Verify user removed
- [ ] Verify removed user can no longer access document

---

## 5. Document History Workflows

### 5.1 View History
- [ ] Open document history panel
- [ ] Verify snapshots list loads
- [ ] Verify each snapshot shows:
  - [ ] Timestamp
  - [ ] Character count
  - [ ] Preview of content

### 5.2 Preview Version
- [ ] Click on a snapshot
- [ ] Verify preview modal opens
- [ ] Verify snapshot content displays
- [ ] Verify can close preview

### 5.3 Restore Version
- [ ] Open snapshot preview
- [ ] Click restore button
- [ ] Confirm restoration
- [ ] Verify document content reverts to snapshot
- [ ] Verify current users see updated content

---

## 6. Offline Support Workflows

### 6.1 Offline Detection
- [ ] Disconnect network
- [ ] Verify offline indicator appears
- [ ] Verify connection status shows "Disconnected"
- [ ] Reconnect network
- [ ] Verify offline indicator disappears
- [ ] Verify connection status shows "Connected"

### 6.2 Offline Editing
- [ ] Disconnect network
- [ ] Type content in editor
- [ ] Verify content appears locally
- [ ] Verify operations queued
- [ ] Reconnect network
- [ ] Verify queued operations sync to server
- [ ] Verify sync status updates

### 6.3 Conflict Resolution
**Setup**: Two users offline, editing same document

- [ ] User 1: Go offline, edit content
- [ ] User 2: Go offline, edit same content
- [ ] User 1: Reconnect
- [ ] User 2: Reconnect
- [ ] Verify CRDT resolves conflicts automatically
- [ ] Verify both users see merged content

---

## 7. Error Handling Workflows

### 7.1 Network Errors
- [ ] Simulate network failure during document load
- [ ] Verify error message displays
- [ ] Verify retry functionality works
- [ ] Simulate network failure during save
- [ ] Verify operations queue for retry

### 7.2 WebSocket Errors
- [ ] Stop WebSocket server
- [ ] Verify connection status shows "Disconnected"
- [ ] Verify error notification appears
- [ ] Restart WebSocket server
- [ ] Verify automatic reconnection
- [ ] Verify sync resumes

### 7.3 API Errors
- [ ] Test with invalid authentication token
- [ ] Verify redirect to login
- [ ] Test with expired token
- [ ] Verify token refresh or re-login prompt

---

## 8. Responsive Design Testing

### 8.1 Desktop (1920x1080)
- [ ] Verify all components render correctly
- [ ] Verify editor takes full viewport
- [ ] Verify presence indicators visible
- [ ] Verify document list grid layout

### 8.2 Tablet (768x1024)
- [ ] Verify responsive layout adjusts
- [ ] Verify touch interactions work
- [ ] Verify modals fit screen
- [ ] Verify document list adapts

### 8.3 Mobile (375x667)
- [ ] Verify mobile layout renders
- [ ] Verify touch targets are adequate (44px minimum)
- [ ] Verify editor is usable
- [ ] Verify navigation works
- [ ] Verify modals are scrollable
- [ ] Test landscape orientation

### 8.4 Touch Interactions
- [ ] Test tap to select document
- [ ] Test tap to edit
- [ ] Test swipe gestures (if applicable)
- [ ] Test pinch to zoom (if applicable)
- [ ] Verify no hover-dependent functionality

---

## 9. Accessibility Testing

### 9.1 Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Verify focus indicators visible
- [ ] Verify logical tab order
- [ ] Test Enter/Space to activate buttons
- [ ] Test Escape to close modals
- [ ] Verify keyboard shortcuts work in editor

### 9.2 Screen Reader Testing
**Tool**: NVDA (Windows) or VoiceOver (Mac)

- [ ] Navigate document list with screen reader
- [ ] Verify document cards are announced correctly
- [ ] Navigate editor with screen reader
- [ ] Verify editor content is accessible
- [ ] Verify ARIA labels are present and correct
- [ ] Verify status updates are announced (aria-live)

### 9.3 Visual Accessibility
- [ ] Test with high contrast mode
- [ ] Verify color contrast ratios meet WCAG AA
- [ ] Test with reduced motion preference
- [ ] Verify animations respect prefers-reduced-motion
- [ ] Test with zoom at 200%
- [ ] Verify layout doesn't break

---

## 10. Browser Compatibility Testing

### 10.1 Chrome/Chromium
- [ ] Test all workflows
- [ ] Verify WebSocket connection
- [ ] Verify Monaco editor works
- [ ] Verify CRDT sync works

### 10.2 Firefox
- [ ] Test all workflows
- [ ] Verify WebSocket connection
- [ ] Verify Monaco editor works
- [ ] Verify CRDT sync works

### 10.3 Safari
- [ ] Test all workflows
- [ ] Verify WebSocket connection
- [ ] Verify Monaco editor works
- [ ] Verify CRDT sync works

### 10.4 Edge
- [ ] Test all workflows
- [ ] Verify WebSocket connection
- [ ] Verify Monaco editor works
- [ ] Verify CRDT sync works

---

## 11. Performance Testing

### 11.1 Load Time
- [ ] Measure initial page load time (< 3 seconds)
- [ ] Measure time to interactive (< 5 seconds)
- [ ] Measure document list load time
- [ ] Measure editor initialization time

### 11.2 Real-time Performance
- [ ] Test with 2 concurrent users
- [ ] Test with 5 concurrent users
- [ ] Test with 10 concurrent users
- [ ] Verify latency remains acceptable (< 100ms)
- [ ] Verify no lag in typing

### 11.3 Large Documents
- [ ] Test with 1,000 character document
- [ ] Test with 10,000 character document
- [ ] Test with 100,000 character document
- [ ] Verify editor remains responsive
- [ ] Verify sync performance acceptable

---

## 12. Edge Cases

### 12.1 Rapid Edits
- [ ] Type very quickly
- [ ] Verify all characters captured
- [ ] Verify no data loss
- [ ] Verify sync completes

### 12.2 Simultaneous Edits
**Setup**: Two users editing same location

- [ ] User 1 and User 2: Type at same position simultaneously
- [ ] Verify CRDT resolves correctly
- [ ] Verify no data loss
- [ ] Verify both users converge to same state

### 12.3 Connection Interruptions
- [ ] Disconnect during active editing
- [ ] Reconnect after 10 seconds
- [ ] Verify sync resumes
- [ ] Verify no data loss

### 12.4 Browser Refresh
- [ ] Edit document
- [ ] Refresh browser
- [ ] Verify content persists
- [ ] Verify connection re-establishes
- [ ] Verify presence updates

---

## Test Results Summary

### Passed Tests: _____ / _____
### Failed Tests: _____ / _____
### Blocked Tests: _____ / _____

## Issues Found

| Issue # | Description | Severity | Status |
|---------|-------------|----------|--------|
| 1       |             |          |        |
| 2       |             |          |        |
| 3       |             |          |        |

## Notes

_Add any additional observations or notes here_

---

## Sign-off

**Tester Name**: ___________________
**Date**: ___________________
**Signature**: ___________________
