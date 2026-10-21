//! Engine code with no Tauri or OS dependency: the event bus, the rule engine,
//! templates and the iCal reader. Everything here is unit-testable in isolation.

pub mod bus;
pub mod ical;
pub mod rules;
pub mod template;
