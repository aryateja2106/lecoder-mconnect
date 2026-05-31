use std::time::{Duration, SystemTime, UNIX_EPOCH};

use chrono::{DateTime, Local, Timelike};

pub(crate) const CLOCK_MODE_NAME: &str = "clock-mode";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct ClockModeState {
    generation: u64,
}

impl ClockModeState {
    pub(crate) const fn new(generation: u64) -> Self {
        Self { generation }
    }

    pub(crate) const fn generation(self) -> u64 {
        self.generation
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ClockStyle {
    Twelve,
    TwentyFour,
    TwelveWithSeconds,
    TwentyFourWithSeconds,
}

impl ClockStyle {
    fn parse(value: Option<&str>) -> Self {
        match value {
            Some("12") => Self::Twelve,
            Some("12-with-seconds") => Self::TwelveWithSeconds,
            Some("24-with-seconds") => Self::TwentyFourWithSeconds,
            _ => Self::TwentyFour,
        }
    }

    const fn format_string(self) -> &'static str {
        match self {
            Self::Twelve => "%l:%M ",
            Self::TwentyFour => "%H:%M",
            Self::TwelveWithSeconds => "%l:%M:%S ",
            Self::TwentyFourWithSeconds => "%H:%M:%S",
        }
    }

    const fn includes_meridiem(self) -> bool {
        matches!(self, Self::Twelve | Self::TwelveWithSeconds)
    }
}

pub(crate) fn format_clock_time(now: DateTime<Local>, style: Option<&str>) -> String {
    let style = ClockStyle::parse(style);
    let mut formatted = now.format(style.format_string()).to_string();
    if style.includes_meridiem() {
        formatted.push_str(if now.hour() >= 12 { "PM" } else { "AM" });
    }
    formatted
}

pub(crate) fn next_clock_tick_delay() -> Duration {
    let delay = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    let micros = 1_000_000_u64.saturating_sub(u64::from(delay / 1_000));
    Duration::from_micros(micros.max(1))
}

#[cfg(test)]
mod tests {
    use super::{format_clock_time, next_clock_tick_delay};
    use chrono::{Local, TimeZone};
    use std::time::Duration;

    #[test]
    fn twelve_hour_clock_keeps_tmux_space_padded_hour() {
        let time = Local
            .with_ymd_and_hms(2026, 4, 15, 1, 2, 3)
            .single()
            .expect("valid local time");

        assert_eq!(format_clock_time(time, Some("12")), " 1:02 AM");
        assert_eq!(
            format_clock_time(time, Some("12-with-seconds")),
            " 1:02:03 AM"
        );
    }

    #[test]
    fn twenty_four_hour_clock_matches_tmux_patterns() {
        let time = Local
            .with_ymd_and_hms(2026, 4, 15, 13, 2, 3)
            .single()
            .expect("valid local time");

        assert_eq!(format_clock_time(time, Some("24")), "13:02");
        assert_eq!(format_clock_time(time, Some("24-with-seconds")), "13:02:03");
    }

    #[test]
    fn default_style_matches_tmux_default_num_one() {
        let time = Local
            .with_ymd_and_hms(2026, 4, 15, 13, 2, 3)
            .single()
            .expect("valid local time");

        assert_eq!(format_clock_time(time, None), "13:02");
    }

    #[test]
    fn next_tick_delay_stays_within_one_second() {
        let delay = next_clock_tick_delay();

        assert!(delay > Duration::ZERO);
        assert!(delay <= Duration::from_secs(1));
    }
}
