# Prompt: drive History widget options from Widget_Picklist_Config

Copy everything below the line into a chat for any History widget in this Zoho org.

---

You are working on a Zoho CRM History widget (React, Zoho embedded widget SDK). Drive Type, Result, Regarding, and Duration from the existing CRM module `Widget_Picklist_Config`. Do not invent a new store (no org variables, JSON files, or Zoho Sheet).

## Goal
On widget load, after Zoho is initialized, fetch option records from Widget_Picklist_Config and use them for:
- Type dropdown (create/edit History dialog)
- Result dropdown (depends on selected Type)
- Regarding dropdown (depends on selected Type)
- Duration dropdown (minutes)
- Type filter on the History list, if this widget has one

Admins add/edit/hide options in CRM. No code change for new options.

## CRM module (already exists — do not recreate)
- **API name:** `Widget_Picklist_Config`
- **Internal / tab name:** `CustomModule15` (try this if `Widget_Picklist_Config` fails in the widget SDK)
- **Display:** WidgetPicklistConfigs
- One record = one dropdown value

Fields (API names):

| Field | API name | Use |
|---|---|---|
| Name | `Name` | Label in the dropdown (`Meeting`, `Meeting Held xx`, `60`) |
| Category | `Category` | `Type` \| `Result` \| `Regarding` \| `Duration` |
| Parent Type | `Parent_Type` | For Result and Regarding only. Must equal a Type record’s Name (e.g. `Meeting`) |
| Sort Order | `Sort_Order` | Display order, lower first |
| Active | `Active` | false hides the option |

Default Result for a Type = the Result with the **lowest Sort_Order** for that Parent_Type.

Duration: Category `Duration`, Name is minutes as text (`"10"`, `"20"`, … `"240"`), Parent_Type empty. Parse Name to a number for the Duration control.

Example: a Result record `Name = "Meeting Held xx"`, `Category = Result`, `Parent_Type = Meeting`, `Active = true` **must** appear in Result when Type is Meeting. If the dialog still only shows hard-coded `Meeting Held` / `Meeting Not Held`, the module is not being read.

## Critical pitfalls (this is why widgets fail to use the module)

1. **Do not fetch before Zoho init.** `window.ZOHO.CRM` is not ready on first React render. Wait for `ZOHO.embeddedApp.init()` / `PageLoad` (whatever this widget already uses, e.g. `initZoho === true` or `module && recordId`). Fetching too early fails, then looks like “hard-coded options”.
2. **Do not cache a failed/fallback load.** If CRM returns no records or throws, return hard-coded lists for that call but **do not** store them as the session cache. Otherwise a later successful fetch never runs.
3. **Only cache a successful CRM load** (`_source === "custom_module"`).
4. Widget JS SDK: prefer `ZOHO.CRM.API.getAllRecords({ Entity, per_page: 200, page })`. Also try `getRecords` if `getAllRecords` is missing. **Do not** pass `sort_by: Sort_Order` on SDK getRecords (often invalid; sort in JS instead).
5. If SDK fetch is empty, COQL via the existing widget connection (`ZOHO.CRM.CONNECTION.invoke`), same URL/parse pattern as History COQL in this org. Parse `details.statusMessage` (string or object) **and** `details.statusMessage` for `data[]`.
6. If `Widget_Picklist_Config` is rejected as INVALID_MODULE, retry Entity `CustomModule15`.
7. Normalize field values: Category/Name/Parent_Type may be a string **or** `{ display_value, actual_value }`. Treat Active as true for `true`, `"true"`, `1`, `"Yes"`.
8. Dedupe by Name within each Type / Result[parent] / Regarding[parent] / Duration group (old CSV imports may duplicate rows).
9. Keep History **save** field API names unchanged (History_Type, History_Result, Regarding, Duration, etc.). Only the option source changes.

## Fetch order
1. Wait until Zoho widget init is done.
2. Paginate SDK getAllRecords / getRecords on `Widget_Picklist_Config`, then `CustomModule15`.
3. If still empty, COQL:
   `select Name, Category, Parent_Type, Sort_Order, Active from Widget_Picklist_Config where Active = true order by Sort_Order asc LIMIT 0, 2000`
4. Filter Active, sort by Sort_Order in JS, group (see shape below).
5. If still empty, use this widget’s existing hard-coded lists (do not blank the dialog). Do not cache that fallback.

## Group into this shape
```
{
  types: string[],
  results: { [parentType]: string[] },
  resultMapping: { [type]: string },
  regarding: { [parentType]: string[] } | null,
  durations: number[],
  _source: "custom_module" | "fallback"
}
```

## UI wiring
- Fetch config once after init. Pass it into create/edit dialog (and the Type filter).
- Type options = `config.types` (module Sort_Order). List filter may also merge types already present on History rows.
- On Type change: Result = `resultMapping[type]` or `results[type][0]`; Regarding = `regarding[type][0]` if that type has regarding options.
- Result options = `results[selectedType]`.
- Regarding options = `regarding[selectedType]` if present; otherwise this widget’s current regarding fallback. On edit, keep the saved Regarding in the list if it is missing from config.
- Duration options = `durations` (numbers). Coerce saved duration so `"60"` matches option `60`.

## Do not
- Recreate the CRM module or fields.
- Store options in org variables, JSON files, or Zoho Sheet.
- Hard-code a new Type/Result map as the primary source.
- Cache fallback as success.
- Fetch picklist on first render before `embeddedApp.init()`.

## Done when
- Add History → Type is filled from Widget_Picklist_Config Type records.
- Changing Type changes Result (and Regarding where Parent_Type matches).
- A CRM Result named e.g. `Meeting Held xx` with Parent_Type `Meeting` appears under Type Meeting after widget reload.
- Duration list comes from Duration records.
- If CRM fetch fails, old hard-coded options still work.
- After CRM option changes, a full widget reload (not only React remount with a poisoned cache) shows the new values.
