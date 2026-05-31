# rmux-proto

Detached IPC protocol DTOs, framing, and wire-safe errors for the
[RMUX](https://github.com/helvesec/rmux) terminal multiplexer.

Defines the local wire protocol RMUX clients use to talk to the daemon.
All DTOs are platform-neutral, bincode-encoded, and framed by a single
envelope:

```
magic byte      0x52
wire version    varint (LEB128)
payload length  little-endian u32
payload         bincode v1 DTO
```

The crate ships the `V1_FRAME_LEDGER` so consumers can inspect which wire
revisions they support; breaking changes bump the varint and add a new
entry rather than mutating the existing frame.

## Surface

- `RMUX_FRAME_MAGIC = 0x52`, `RMUX_WIRE_VERSION = 1`, `V1_FRAME_LEDGER`.
- `encode_frame`, `decode_frame`, `FrameDecoder`.
- Request, response, attach, control, capability DTOs.
- `PaneId`, `SessionId`, `SessionName`, `WindowId` identity types.
- `RmuxError` — wire-safe error type.

`rmux-proto` is the source of truth for the RMUX wire format. Anything
that needs to encode or decode RMUX frames depends on it directly.

## License

Dual-licensed under [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE).
