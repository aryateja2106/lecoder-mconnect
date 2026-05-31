use rmux_core::{text_width, truncate_to_width, Utf8Config};

use crate::renderer::RenderedPrompt;

#[cfg_attr(not(test), allow(dead_code))]
pub(super) fn rendered_prompt_input(
    prompt: &RenderedPrompt,
    width: usize,
    utf8: &Utf8Config,
) -> (String, String) {
    let prompt_text = truncate_to_width(&prompt.prompt, width, utf8);
    let prompt_width = text_width(&prompt_text, utf8);
    let available = width.saturating_sub(prompt_width);
    if available == 0 {
        return (prompt_text, String::new());
    }

    let mut visible = prompt.input.clone();
    while text_width(&visible, utf8) > available {
        let Some((index, _)) = visible.char_indices().nth(1) else {
            break;
        };
        visible.drain(..index);
    }
    (prompt_text, truncate_to_width(&visible, available, utf8))
}

#[cfg(test)]
mod tests {
    use rmux_core::Utf8Config;

    use super::*;

    #[test]
    fn prompt_render_input_scrolls_tail_into_view() {
        let utf8 = Utf8Config::default();
        let prompt = RenderedPrompt {
            prompt: "search ".to_owned(),
            input: "0123456789".to_owned(),
            cursor: 10,
            command_prompt: true,
        };
        let (left, right) = rendered_prompt_input(&prompt, 12, &utf8);
        assert_eq!(left, "search ");
        assert_eq!(right, "56789");
    }

    #[test]
    fn prompt_render_zero_width() {
        let utf8 = Utf8Config::default();
        let prompt = RenderedPrompt {
            prompt: "p".to_owned(),
            input: "i".to_owned(),
            cursor: 1,
            command_prompt: true,
        };
        let (left, right) = rendered_prompt_input(&prompt, 0, &utf8);
        assert_eq!(left, "");
        assert_eq!(right, "");
    }

    #[test]
    fn rendered_prompt_width_matches_prompt_plus_input() {
        let utf8 = Utf8Config::default();
        let prompt = RenderedPrompt {
            prompt: "cmd: ".to_owned(),
            input: "hello".to_owned(),
            cursor: 5,
            command_prompt: true,
        };
        let (left, right) = rendered_prompt_input(&prompt, 10, &utf8);
        assert_eq!(left, "cmd: ");
        assert_eq!(right, "hello");
    }
}
