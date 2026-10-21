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

pub fn cross_axis_thickness(size: DockSize) -> u32 {
    match size {
        DockSize::S => 52,
        DockSize::M => 60,
        DockSize::L => 70,
    }
}

fn pill_main_length(size: DockSize) -> u32 {
    match size {
        DockSize::S => 420,
        DockSize::M => 520,
        DockSize::L => 620,
    }
}

const MIN_PILL_LENGTH: u32 = 160;
/// Gap between the dock and the screen edge, in logical pixels.
pub const DOCK_MARGIN: i32 = 8;

/// `content_length` is what the dock's widgets need along the main axis; pills hug it.
pub fn compute_dock_rect(
    work: WorkArea,
    position: DockPosition,
    size: DockSize,
    mode: DockMode,
    content_length: Option<u32>,
) -> DockRect {
    let margin = DOCK_MARGIN;
    let thickness = cross_axis_thickness(size);
    let pill = |available: u32| {
        let wanted = content_length.unwrap_or_else(|| pill_main_length(size));
        let max = available
            .saturating_sub(2 * margin as u32)
            .max(MIN_PILL_LENGTH);
        wanted.clamp(MIN_PILL_LENGTH, max)
    };

    let (width, height) = match position {
        DockPosition::Top | DockPosition::Bottom => {
            let main = if mode == DockMode::Full {
                work.width
            } else {
                pill(work.width)
            };
            (main, thickness)
        }
        DockPosition::Left | DockPosition::Right => {
            let main = if mode == DockMode::Full {
                work.height
            } else {
                pill(work.height)
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
        let rect = compute_dock_rect(
            WORK,
            DockPosition::Bottom,
            DockSize::M,
            DockMode::Pill,
            None,
        );
        assert_eq!(rect.height, 60);
        assert_eq!(rect.width, 520);
        assert_eq!(rect.y, WORK.height as i32 - 60 - 8);
        assert_eq!(rect.x, (1920 - 520) / 2);
    }

    #[test]
    fn pill_hugs_content_within_bounds() {
        let fit = compute_dock_rect(
            WORK,
            DockPosition::Bottom,
            DockSize::M,
            DockMode::Pill,
            Some(840),
        );
        assert_eq!(fit.width, 840);
        assert_eq!(fit.x, (1920 - 840) / 2);
        let tiny = compute_dock_rect(
            WORK,
            DockPosition::Bottom,
            DockSize::M,
            DockMode::Pill,
            Some(10),
        );
        assert_eq!(tiny.width, MIN_PILL_LENGTH);
        let huge = compute_dock_rect(
            WORK,
            DockPosition::Bottom,
            DockSize::M,
            DockMode::Pill,
            Some(5000),
        );
        assert_eq!(huge.width, 1920 - 16);
    }

    #[test]
    fn top_full_width() {
        let rect = compute_dock_rect(
            WORK,
            DockPosition::Top,
            DockSize::S,
            DockMode::Full,
            Some(300),
        );
        assert_eq!(rect.width, 1920);
        assert_eq!(rect.y, 8);
    }

    #[test]
    fn left_pill_vertical() {
        let rect = compute_dock_rect(WORK, DockPosition::Left, DockSize::L, DockMode::Pill, None);
        assert_eq!(rect.width, 70);
        assert_eq!(rect.height, 620);
    }
}
