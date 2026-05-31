# rmux-server

> **Private API.** Implementation detail of [`rmux`](https://crates.io/crates/rmux).
> Semver is not guaranteed inside `0.x` — versions may break at any point.
> If you want a stable Rust API, depend on [`rmux-sdk`](https://crates.io/crates/rmux-sdk) instead.

Tokio daemon and request dispatcher for the
[RMUX](https://github.com/helvesec/rmux) terminal multiplexer. Owns the
runtime that holds sessions, windows, panes, and PTYs in memory, and that
serves the local IPC protocol. Published to crates.io because the `rmux`
binary depends on it; not intended as a stable consumer surface.

## License

Dual-licensed under [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE).
