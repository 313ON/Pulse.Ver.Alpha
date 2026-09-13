# PULSE Figma ↔ Code mapping

The Figma integration surface is not available in the current execution environment. This mapping is the implementation contract for the first connected Figma file; it intentionally mirrors the production React architecture rather than inventing a separate concept.

## Foundations

| Figma variable | Code token |
|---|---|
| `color.surface.canvas` | `--surface-canvas` |
| `color.surface.base` | `--surface-base` |
| `color.surface.elevated` | `--surface-elevated` |
| `color.text.primary` | `--text-primary` |
| `color.text.muted` | `--text-muted` |
| `color.action.primary` | `--primary` |
| `color.status.success` | `--status-success` |
| `color.status.warning` | `--status-warning` |
| `color.status.danger` | `--status-danger` |
| `space.1..space.8` | `--space-1..--space-8` |
| `radius.sm/md/lg` | `--radius-sm/md/lg` |

## Component mapping

`StatusBadge`, `ProgressBar`, `StatCard`, `SurfaceState`, and `DomainSummaryCard` map to Figma components with the same names and variant properties. `CommandSidebar`, `CommandHeader`, `DashboardController`, `StrategicCommandCenter`, and `ProgramTree` map to product patterns and screens.

## Required Figma pages

Foundations; Components; Shell; Dashboard; Program hierarchy; Actions and KPI; Empty/loading/error states; Responsive examples. Persian RTL is the primary direction, with mixed technical identifiers represented as isolated LTR text runs.
