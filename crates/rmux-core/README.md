# rmux-core

> **Private API.** Implementation detail of [`rmux`](https://crates.io/crates/rmux).
> Semver is not guaranteed inside `0.x` — versions may break at any point.
> If you want a stable Rust API, depend on [`rmux-sdk`](https://crates.io/crates/rmux-sdk) instead.

Core in-memory session, pane, layout, format, hook, and buffer model used
by the [RMUX](https://github.com/helvesec/rmux) daemon. Published to
crates.io because the `rmux` binary depends on it; not intended as a
stable consumer surface.

## License

Dual-licensed under [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE).
