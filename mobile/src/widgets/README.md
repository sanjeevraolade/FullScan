# Widgets

Dynamic form widgets — server-driven UI primitives rendered by the Dynamic Form Engine.

Widgets are the atomic building blocks of configurable forms. Each widget self-registers with the Widget Registry and renders based on configuration metadata.

## Structure

| Widget           | Purpose                                    |
|------------------|--------------------------------------------|
| `attachment/`    | File/photo attachment capture widget       |
| `autocomplete/`  | Autocomplete text input widget             |
| `barcode/`       | Barcode scanner widget                     |
| `base/`          | Base widget class/interface                |
| `camera/`        | Camera capture widget                      |
| `card/`          | Display card widget                        |
| `checkbox/`      | Checkbox selection widget                  |
| `container/`     | Container/group widget                     |
| `date/`          | Date picker widget                         |
| `datetime/`      | Date-time picker widget                    |
| `divider/`       | Visual divider/separator widget            |
| `dropdown/`      | Dropdown/select widget                     |
| `factory/`       | Widget factory for dynamic instantiation   |
| `image/`         | Image display widget                       |
| `list/`          | List/repeater widget                       |
| `location/`      | GPS location capture widget                |
| `map/`           | Map display widget                         |
| `qr/`            | QR code scanner widget                     |
| `radio/`         | Radio button selection widget              |
| `section/`       | Section header/grouping widget             |
| `signature/`     | Signature capture widget                   |
| `switch/`        | Toggle switch widget                       |
| `text/`          | Text input widget                          |
| `textarea/`      | Multi-line text input widget               |
| `timeline/`      | Timeline display widget                    |

## Rules

- New widgets register themselves with the Widget Registry (Open/Closed Principle).
- Never implement widget-specific switch statements.
- All widgets are configuration-driven.
- Widgets do not own business state — state belongs to Runtime Context.
- Widgets must support validation through the Validation Engine.
