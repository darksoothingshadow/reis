---
description: Protocol for verifying logic and assumptions against IS Mendelu
---

# Verification Protocol

When implementing complex logic that interacts with IS Mendelu (or any external system with undocumented or variable structure), follow these principles:

1.  **Extended Console Debugging**:
    -   Always add detailed `console.debug` or `console.log` statements in the implementation to trace execution flow, variable states, and parsing logic.
    -   This allows for immediate validation of logic during manual testing and helps identify edge cases that might not be apparent from the UI alone.

2.  **Script-Based Verification**:
    -   Do not rely solely on assumptions about the HTML structure or URL patterns.
    -   Create a dedicated script in `reference/reis-watchdog/scripts/` (e.g., `inspect-feature.js`) using Playwright or similar tools.
    -   Use this script to log in and scrape the actual live data structure.
    -   **Execute** this script to verify your assumptions *before* and *after* implementation to ensure robustness.

## Example Workflow

1.  **Draft Logic**: Write the initial implementation.
2.  **Add Logs**: Insert `console.log` to track key variables (e.g., `console.log('Parsing row:', rowText)`).
3.  **Create Watchdog Script**: Write `reference/reis-watchdog/scripts/verify-my-feature.js` to fetch the relevant page and dump the HTML or specific elements.
4.  **Run Script**: `node reference/reis-watchdog/scripts/verify-my-feature.js`
5.  **Refine**: Adjust implementation based on script output and console logs.
