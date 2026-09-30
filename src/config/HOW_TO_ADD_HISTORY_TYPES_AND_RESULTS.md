# How to add History Types and Results

History Type, Result, Regarding, and Duration lists come from the CRM module **WidgetPicklistConfigs** (`Widget_Picklist_Config`).

You do not need a code change. Add or edit records, then reload the History widget.

---

## Open the module

1. In Zoho CRM, open **WidgetPicklistConfigs** (or search for that module).
2. Click **Create**.

Each dropdown value is **one record**.

---

## Add a new Type

Example: add **Site Visit**.

| Field | What to enter |
|---|---|
| **Name** | `Site Visit` |
| **Category** | `Type` |
| **Parent Type** | leave empty |
| **Sort Order** | a number (lower appears first). Use `180` or higher if you are appending to the list |
| **Active** | checked |

Save.

The Type dropdown uses **Name** exactly as typed.

### How Sort Order works

Sort Order is a numeric priority, not a numbered position in the dropdown.
Lower numbers appear first, including `0`. For example, the seed data gives
Other order `5` and Meeting order `10`, so Fruit with order `9` appears between
them. It does not mean Fruit is the ninth option. Use unique priorities within
each list when you need an exact order; equal priorities retain the CRM response
order. Blank or invalid priorities appear after all numbered options.

The same rule applies to Type, Duration, and the Result/Regarding options for
each Parent Type. Contact History still hides Matter-only types while preserving
the configured order of its visible options. Reload the widget after saving
configuration changes.

---

## Add Results for that Type

Create one record per Result. **Parent Type must match the Type Name exactly** (`Site Visit`, not `Site visit`).

**Result 1 (default)** — lowest Sort Order is selected automatically when the Type is chosen:

| Field | Value |
|---|---|
| **Name** | `Site Visit Completed` |
| **Category** | `Result` |
| **Parent Type** | `Site Visit` |
| **Sort Order** | `10` |
| **Active** | checked |

**Result 2**

| Field | Value |
|---|---|
| **Name** | `Site Visit Not Completed` |
| **Category** | `Result` |
| **Parent Type** | `Site Visit` |
| **Sort Order** | `20` |
| **Active** | checked |

Add as many Result records as you need (`30`, `40`, …).

---

## Add Results to an existing Type

Example: extra result for **Meeting**.

| Field | Value |
|---|---|
| **Name** | `Meeting Held xx` |
| **Category** | `Result` |
| **Parent Type** | `Meeting` |
| **Sort Order** | `15` (or any order you want) |
| **Active** | checked |

---

## Optional: Regarding for a Type

Same pattern as Result, with Category **Regarding**.

| Field | Example |
|---|---|
| **Name** | `Hourly Consult $220` |
| **Category** | `Regarding` |
| **Parent Type** | `Meeting` |
| **Sort Order** | `10` |
| **Active** | checked |

Only some Types need Regarding. If a Type has no Regarding records, the widget uses its built-in regarding list for that Type.

---

## Optional: Duration

Duration is not tied to a Type.

| Field | Example |
|---|---|
| **Name** | `90` (minutes, digits only) |
| **Category** | `Duration` |
| **Parent Type** | leave empty |
| **Sort Order** | `90` |
| **Active** | checked |

---

## After you save

Reload the History widget (or the contact). Options are cached for the session, so a full reload is required.

Then:

1. Click **Create**.
2. Choose the new Type.
3. Confirm Result shows the new values.

---

## Hide or rename

| Action | How |
|---|---|
| Hide an option | Uncheck **Active** (prefer this over delete so old History rows still make sense) |
| Rename | Edit **Name**. For a Type, also update **Parent Type** on every Result and Regarding that pointed at the old name |
| Change order | Change **Sort Order** (lower = first) |
| Change default Result | Give that Result the lowest Sort Order for that Parent Type |

---

## Checklist if it does not appear

- Category is exactly `Type` or `Result` (or `Regarding` / `Duration`).
- Parent Type on Result/Regarding matches the Type Name **exactly**, including spaces and capitals.
- **Active** is checked.
- You reloaded the widget after saving.
- You are looking at the History **Create** dialog, not an old record that already has a saved Result.

---

## Quick example set

To add Type **Site Visit** with two results, create **three** records:

1. Type: Name `Site Visit`, Category `Type`, Sort Order `180`, Active on.
2. Result: Name `Site Visit Completed`, Category `Result`, Parent Type `Site Visit`, Sort Order `10`, Active on.
3. Result: Name `Site Visit Not Completed`, Category `Result`, Parent Type `Site Visit`, Sort Order `20`, Active on.
