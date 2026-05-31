pub(crate) fn local_hostname() -> Option<String> {
    #[cfg(windows)]
    {
        hostname_from_sources([
            rmux_os::host::local_hostname(),
            std::env::var("COMPUTERNAME").ok(),
            std::env::var("HOSTNAME").ok(),
        ])
    }

    #[cfg(not(windows))]
    {
        hostname_from_sources([
            rmux_os::host::local_hostname(),
            std::env::var("HOSTNAME").ok(),
            std::fs::read_to_string("/etc/hostname").ok(),
        ])
    }
}

fn hostname_from_sources<const N: usize>(sources: [Option<String>; N]) -> Option<String> {
    sources
        .into_iter()
        .flatten()
        .map(|value| value.trim().to_owned())
        .find(|value| !value.is_empty())
}

#[cfg(test)]
mod tests {
    use super::hostname_from_sources;

    #[test]
    fn hostname_prefers_first_source() {
        assert_eq!(
            hostname_from_sources([
                Some(" native-host ".to_owned()),
                Some("env-host".to_owned()),
                Some("etc-host".to_owned()),
            ]),
            Some("native-host".to_owned())
        );
    }

    #[test]
    fn hostname_uses_next_source_when_first_is_missing() {
        assert_eq!(
            hostname_from_sources([None, Some(" WIN-HOST ".to_owned()), None]),
            Some("WIN-HOST".to_owned())
        );
    }

    #[test]
    fn hostname_falls_back_to_later_sources() {
        assert_eq!(
            hostname_from_sources([None, None, Some(" etc-host\n".to_owned())]),
            Some("etc-host".to_owned())
        );
    }

    #[test]
    fn hostname_ignores_empty_sources() {
        assert_eq!(
            hostname_from_sources([Some(" ".to_owned()), Some("\t".to_owned()), None]),
            None
        );
    }
}
