use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DockPosition {
    Top,
    Bottom,
    Left,
    Right,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DockSize {
    #[serde(rename = "s")]
    S,
    #[serde(rename = "m")]
    M,
    #[serde(rename = "l")]
    L,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DockMode {
    Pill,
    Full,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WorkArea {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DockRect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

fn cross_axis_thickness(size: DockSize) -> u32 {
    match size {
        DockSize::S => 48,
        DockSize::M => 56,
        DockSize::L => 64,
    }
}

fn pill_main_length(size: DockSize) -> u32 {
    match size {
        DockSize::S => 420,
        DockSize::M => 520,
        DockSize::L => 620,
    }
}

pub fn compute_dock_rect(
    work: WorkArea,
    position: DockPosition,
    size: DockSize,
    mode: DockMode,
) -> DockRect {
    let margin = 8_i32;
    let thickness = cross_axis_thickness(size);

    let (width, height) = match position {
        DockPosition::Top | DockPosition::Bottom => {
            let main = if mode == DockMode::Full {
                work.width
            } else {
                pill_main_length(size).min(work.width)
            };
            (main, thickness)
        }
        DockPosition::Left | DockPosition::Right => {
            let main = if mode == DockMode::Full {
                work.height
            } else {
                pill_main_length(size).min(work.height)
            };
            (thickness, main)
        }
    };

    let (x, y) = match position {
        DockPosition::Top => {
            let x = work.x + ((work.width as i32 - width as i32) / 2);
            (x, work.y + margin)
        }
        DockPosition::Bottom => {
            let x = work.x + ((work.width as i32 - width as i32) / 2);
            (x, work.y + work.height as i32 - height as i32 - margin)
        }
        DockPosition::Left => {
            let y = work.y + ((work.height as i32 - height as i32) / 2);
            (work.x + margin, y)
        }
        DockPosition::Right => {
            let y = work.y + ((work.height as i32 - height as i32) / 2);
            (work.x + work.width as i32 - width as i32 - margin, y)
        }
    };

    DockRect {
        x,
        y,
        width,
        height,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const WORK: WorkArea = WorkArea {
        x: 0,
        y: 0,
        width: 1920,
        height: 1040,
    };

    #[test]
    fn bottom_pill_centered() {
        let rect = compute_dock_rect(WORK, DockPosition::Bottom, DockSize::M, DockMode::Pill);
        assert_eq!(rect.height, 56);
        assert_eq!(rect.width, 520);
        assert_eq!(rect.y, WORK.height as i32 - 56 - 8);
        assert_eq!(rect.x, (1920 - 520) / 2);
    }

    #[test]
    fn top_full_width() {
        let rect = compute_dock_rect(WORK, DockPosition::Top, DockSize::S, DockMode::Full);
        assert_eq!(rect.width, 1920);
        assert_eq!(rect.y, 8);
    }

    #[test]
    fn left_pill_vertical() {
        let rect = compute_dock_rect(WORK, DockPosition::Left, DockSize::L, DockMode::Pill);
        assert_eq!(rect.width, 64);
        assert_eq!(rect.height, 620);
    }
}
