//! Demonstrates `Pane::snapshot()` and reading `visible_text()`.

#[path = "sdk_demo_helpers/mod.rs"]
mod sdk_demo_helpers;

#[tokio::main]
async fn main() -> rmux_sdk::Result<()> {
    let (_rmux, session) = sdk_demo_helpers::demo_session("snap").await?;
    sdk_demo_helpers::paint_uname(&session).await?;

    // example:start
    let pane = session.pane(0, 0);
    let snap = pane.snapshot().await?;
    println!("visible text:\n{}", snap.visible_text());
    // example:end

    sdk_demo_helpers::cleanup(session).await
}
