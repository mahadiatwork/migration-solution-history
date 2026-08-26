# Widget Picklist Config — CRM setup

The `Widget_Picklist_Config` module and fields are already created in the Migration Solutions CRM.

## What exists

| Item | Value |
|---|---|
| Module API name | `Widget_Picklist_Config` |
| Module ID | `76775000017790957` |
| Name | `Name` (the dropdown label) |
| Category | picklist: Type, Result, Regarding, Duration |
| Parent Type | `Parent_Type` |
| Sort Order | `Sort_Order` |
| Active | `Active` |

All profiles can access the module so the History widget can read options. Hide the tab from non-admins:

Setup > Modules and Fields > WidgetPicklistConfigs > uncheck **Show on tab menu** for Standard / MS Staff / etc.

## Import seed data

1. Setup > Data Administration > Import
2. Module: **WidgetPicklistConfigs**
3. File: [`widgetPicklistConfig.seed.csv`](widgetPicklistConfig.seed.csv)
4. Map: Name, Category, Parent_Type, Sort_Order, Active
5. Find and update: skip (first import)

Default Result for a Type is the Result with the **lowest Sort Order** for that Parent Type.

## Optional layout rule

On create/edit:

- Category is Result or Regarding → show Parent Type and make it required
- Category is Type or Duration → hide Parent Type

## How to change options later

- Add a Type: new record, Category `Type`, then Result records with Parent Type set
- Add a Result: Category `Result`, Parent Type = the Type name
- Rename: edit Name
- Hide: set Active = false (prefer this over delete)

Reload the History widget (or reopen the contact) after changes. Config is cached for the session.
