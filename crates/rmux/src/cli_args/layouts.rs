use clap::ValueEnum;
use rmux_proto::LayoutName;

#[derive(Clone, Copy, Debug, ValueEnum)]
pub(crate) enum LayoutValue {
    #[value(name = "main-vertical")]
    MainVertical,
    #[value(name = "main-horizontal")]
    MainHorizontal,
    #[value(name = "even-horizontal")]
    EvenHorizontal,
    #[value(name = "even-vertical")]
    EvenVertical,
    #[value(name = "tiled")]
    Tiled,
    #[value(name = "main-horizontal-mirrored")]
    MainHorizontalMirrored,
    #[value(name = "main-vertical-mirrored")]
    MainVerticalMirrored,
}

impl From<LayoutValue> for LayoutName {
    fn from(value: LayoutValue) -> Self {
        match value {
            LayoutValue::MainVertical => Self::MainVertical,
            LayoutValue::MainHorizontal => Self::MainHorizontal,
            LayoutValue::EvenHorizontal => Self::EvenHorizontal,
            LayoutValue::EvenVertical => Self::EvenVertical,
            LayoutValue::Tiled => Self::Tiled,
            LayoutValue::MainHorizontalMirrored => Self::MainHorizontalMirrored,
            LayoutValue::MainVerticalMirrored => Self::MainVerticalMirrored,
        }
    }
}
