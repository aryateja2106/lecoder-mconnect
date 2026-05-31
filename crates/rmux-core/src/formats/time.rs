use chrono::{DateTime, Datelike, Local, LocalResult, TimeZone};

pub(super) fn format_time_string(
    value: &str,
    pretty: bool,
    format: Option<&str>,
) -> Option<String> {
    let epoch = value.trim().parse::<i64>().ok()?;
    if epoch <= 0 {
        return None;
    }
    let date_time = local_datetime(epoch)?;

    if pretty {
        return Some(format_pretty_time(date_time));
    }

    Some(match format {
        Some(format) => date_time.format(format).to_string(),
        None => date_time.format("%a %b %e %H:%M:%S %Y").to_string(),
    })
}

fn format_pretty_time(time: DateTime<Local>) -> String {
    let now = Local::now();
    let age = now.timestamp().saturating_sub(time.timestamp());

    if age < 24 * 60 * 60 {
        return time.format("%H:%M").to_string();
    }

    if (time.year() == now.year() && time.month() == now.month()) || age < 28 * 24 * 60 * 60 {
        return time.format("%a%d").to_string();
    }

    let same_or_previous_year = (time.year() == now.year() && time.month() < now.month())
        || (time.year() == now.year() - 1 && time.month() > now.month());
    if same_or_previous_year {
        return time.format("%d%b").to_string();
    }

    time.format("%b%y").to_string()
}

fn local_datetime(epoch: i64) -> Option<DateTime<Local>> {
    match Local.timestamp_opt(epoch, 0) {
        LocalResult::Single(date_time) => Some(date_time),
        LocalResult::Ambiguous(date_time, _) => Some(date_time),
        LocalResult::None => None,
    }
}

pub(super) fn expand_time_tokens(template: &str) -> String {
    Local::now().format(template).to_string()
}
