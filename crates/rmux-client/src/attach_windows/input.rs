const ATTACH_INPUT_CHUNK_LIMIT: usize = 4096;
const BRACKETED_PASTE_START: &[u8] = b"\x1b[200~";
const BRACKETED_PASTE_END: &[u8] = b"\x1b[201~";

pub(super) fn attach_input_chunks(bytes: &[u8]) -> AttachInputChunks<'_> {
    AttachInputChunks { bytes, offset: 0 }
}

pub(super) struct AttachInputChunks<'a> {
    bytes: &'a [u8],
    offset: usize,
}

impl<'a> Iterator for AttachInputChunks<'a> {
    type Item = &'a [u8];

    fn next(&mut self) -> Option<Self::Item> {
        if self.offset >= self.bytes.len() {
            return None;
        }

        let start = self.offset;
        let ideal_end = start
            .saturating_add(ATTACH_INPUT_CHUNK_LIMIT)
            .min(self.bytes.len());
        let end = if ideal_end == self.bytes.len() {
            ideal_end
        } else {
            bounded_chunk_end(self.bytes, start, ideal_end)
        };
        self.offset = end;
        Some(&self.bytes[start..end])
    }
}

fn bounded_chunk_end(bytes: &[u8], start: usize, ideal_end: usize) -> usize {
    let end = avoid_utf8_split(bytes, start, ideal_end);
    let end = avoid_bracketed_paste_marker_split(bytes, start, end);
    if end > start {
        end
    } else {
        ideal_end
    }
}

fn avoid_utf8_split(bytes: &[u8], start: usize, mut end: usize) -> usize {
    while end > start
        && end < bytes.len()
        && bytes
            .get(end)
            .is_some_and(|byte| is_utf8_continuation(*byte))
    {
        end -= 1;
    }
    end
}

fn is_utf8_continuation(byte: u8) -> bool {
    byte & 0b1100_0000 == 0b1000_0000
}

fn avoid_bracketed_paste_marker_split(bytes: &[u8], start: usize, end: usize) -> usize {
    for marker in [BRACKETED_PASTE_START, BRACKETED_PASTE_END] {
        if let Some(adjusted) = marker_adjusted_end(bytes, start, end, marker) {
            return adjusted;
        }
    }
    end
}

fn marker_adjusted_end(bytes: &[u8], start: usize, end: usize, marker: &[u8]) -> Option<usize> {
    let search_start = end
        .saturating_sub(marker.len().saturating_sub(1))
        .max(start);
    for marker_start in search_start..end {
        let prefix = &bytes[marker_start..end];
        if !prefix.is_empty()
            && marker.starts_with(prefix)
            && marker_start + marker.len() <= bytes.len()
        {
            return Some(marker_start + marker.len());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::{
        attach_input_chunks, ATTACH_INPUT_CHUNK_LIMIT, BRACKETED_PASTE_END, BRACKETED_PASTE_START,
    };

    #[test]
    fn paste_chunks_preserve_bracketed_paste_markers() {
        let mut input = vec![b'a'; ATTACH_INPUT_CHUNK_LIMIT - 2];
        input.extend_from_slice(BRACKETED_PASTE_START);
        input.extend_from_slice(b"line one\r\nline two");
        input.extend_from_slice(BRACKETED_PASTE_END);

        let chunks = collect_chunks(&input);

        assert_eq!(chunks.concat(), input);
        assert_eq!(
            chunks[0].len(),
            ATTACH_INPUT_CHUNK_LIMIT - 2 + BRACKETED_PASTE_START.len()
        );
    }

    #[test]
    fn paste_chunks_do_not_split_utf8_scalars() {
        let mut input = vec![b'a'; ATTACH_INPUT_CHUNK_LIMIT - 1];
        input.extend_from_slice("東".as_bytes());
        input.extend_from_slice(" tail".as_bytes());

        let chunks = collect_chunks(&input);

        assert_eq!(chunks.concat(), input);
        assert_eq!(chunks[0].len(), ATTACH_INPUT_CHUNK_LIMIT - 1);
        assert!(std::str::from_utf8(&chunks[1]).is_ok());
    }

    #[test]
    fn paste_chunks_preserve_control_bytes() {
        let mut input = Vec::from([0x02, b'w', 0x03]);
        input.extend(vec![b'x'; ATTACH_INPUT_CHUNK_LIMIT + 32]);

        let chunks = collect_chunks(&input);

        assert_eq!(chunks.concat(), input);
        assert_eq!(&chunks[0][..3], &[0x02, b'w', 0x03]);
    }

    fn collect_chunks(input: &[u8]) -> Vec<Vec<u8>> {
        attach_input_chunks(input)
            .map(<[u8]>::to_vec)
            .collect::<Vec<_>>()
    }
}
