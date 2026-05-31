use crate::handles::session::unexpected_response;
use crate::{Pane, Result, TerminalSizeSpec};
use rmux_proto::{
    PaneInputRequest, PaneResizeRequest, Request, ResizePaneAdjustment, ResizePaneRequest,
    Response, SendKeysExtRequest, SendKeysRequest, CAPABILITY_SDK_PANE_BY_ID,
};

use super::info::fetch_live_details_or_default;

pub(super) async fn send_text(pane: &Pane, text: &str) -> Result<()> {
    let response = if pane.stable_id.is_some() {
        crate::capabilities::require(pane.transport(), &[CAPABILITY_SDK_PANE_BY_ID]).await?;
        pane.transport()
            .request(Request::PaneInput(PaneInputRequest {
                target: pane.proto_target_ref(),
                keys: vec![text.to_owned()],
                literal: true,
            }))
            .await?
    } else {
        pane.transport()
            .request(Request::SendKeysExt(SendKeysExtRequest {
                target: Some(pane.target().into()),
                keys: vec![text.to_owned()],
                expand_formats: false,
                hex: false,
                literal: true,
                dispatch_key_table: false,
                copy_mode_command: false,
                forward_mouse_event: false,
                reset_terminal: false,
                repeat_count: None,
            }))
            .await?
    };

    match response {
        Response::SendKeys(_) => Ok(()),
        response => Err(unexpected_response("send-keys", response)),
    }
}

pub(super) async fn send_key(pane: &Pane, key: String) -> Result<()> {
    let response = if pane.stable_id.is_some() {
        crate::capabilities::require(pane.transport(), &[CAPABILITY_SDK_PANE_BY_ID]).await?;
        pane.transport()
            .request(Request::PaneInput(PaneInputRequest {
                target: pane.proto_target_ref(),
                keys: vec![key],
                literal: false,
            }))
            .await?
    } else {
        pane.transport()
            .request(Request::SendKeys(SendKeysRequest {
                target: pane.target().into(),
                keys: vec![key],
            }))
            .await?
    };

    match response {
        Response::SendKeys(_) => Ok(()),
        response => Err(unexpected_response("send-keys", response)),
    }
}

pub(super) async fn resize_to_size(pane: &Pane, requested: TerminalSizeSpec) -> Result<()> {
    let current = live_pane_size(pane).await?;
    let mut sent_non_noop_adjustment = false;

    if current.cols != requested.cols {
        request_resize_pane(
            pane,
            ResizePaneAdjustment::AbsoluteWidth {
                columns: requested.cols,
            },
        )
        .await?;
        sent_non_noop_adjustment = true;
    }

    if current.rows != requested.rows {
        request_resize_pane(
            pane,
            ResizePaneAdjustment::AbsoluteHeight {
                rows: requested.rows,
            },
        )
        .await?;
        sent_non_noop_adjustment = true;
    }

    if !sent_non_noop_adjustment {
        request_resize_pane(pane, ResizePaneAdjustment::NoOp).await?;
    }

    Ok(())
}

async fn live_pane_size(pane: &Pane) -> Result<TerminalSizeSpec> {
    if pane.stable_id.is_some() {
        let snapshot = pane.snapshot().await?;
        return Ok(TerminalSizeSpec::new(snapshot.cols, snapshot.rows));
    }

    let details = fetch_live_details_or_default(pane.transport(), pane.target()).await?;
    Ok(TerminalSizeSpec::new(details.cols, details.rows))
}

async fn request_resize_pane(pane: &Pane, adjustment: ResizePaneAdjustment) -> Result<()> {
    let response = if pane.stable_id.is_some() {
        crate::capabilities::require(pane.transport(), &[CAPABILITY_SDK_PANE_BY_ID]).await?;
        pane.transport()
            .request(Request::PaneResize(PaneResizeRequest {
                target: pane.proto_target_ref(),
                adjustment,
            }))
            .await?
    } else {
        pane.transport()
            .request(Request::ResizePane(ResizePaneRequest {
                target: pane.target().into(),
                adjustment,
            }))
            .await?
    };

    match response {
        Response::ResizePane(_) => Ok(()),
        response => Err(unexpected_response("resize-pane", response)),
    }
}
