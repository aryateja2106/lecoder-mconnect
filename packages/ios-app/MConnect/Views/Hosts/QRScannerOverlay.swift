import SwiftUI

/// SwiftUI overlay drawn on top of the camera preview.
///
/// Shows corner brackets in the primary accent color, a dim background,
/// a top bar with "Scan QR" title and close button, and a bottom hint.
/// On successful scan, brackets fade to green and a checkmark appears for 200 ms.
struct QRScannerOverlay: View {
    /// Set to true when a QR code has been successfully decoded.
    let scanSucceeded: Bool
    let onClose: () -> Void
    let onManualEntry: () -> Void

    var body: some View {
        GeometryReader { geo in
            let boxSize = min(geo.size.width, geo.size.height) * 0.65
            ZStack {
                // Dim background with cutout
                dimBackground(boxSize: boxSize)

                // Corner brackets
                CornerBrackets(size: boxSize, succeeded: scanSucceeded)

                // Checkmark on success
                if scanSucceeded {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 56))
                        .foregroundStyle(.green)
                        .transition(.scale.combined(with: .opacity))
                }

                // Top bar
                VStack {
                    topBar
                    Spacer()
                    bottomHint
                }
            }
        }
    }

    // MARK: - Subviews

    private var topBar: some View {
        HStack {
            Spacer()
            Text("Scan QR")
                .font(.headline)
                .foregroundStyle(.white)
            Spacer()
            Button(action: onClose) {
                Image(systemName: "xmark.circle.fill")
                    .font(.title2)
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(.white)
            }
            .padding(.trailing, 16)
        }
        .padding(.top, 16)
    }

    private var bottomHint: some View {
        VStack(spacing: 8) {
            Text("Hold steady · code shown in `mconnect start` output")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.85))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Button("Enter token manually", action: onManualEntry)
                .font(.caption)
                .foregroundStyle(.white.opacity(0.7))
        }
        .padding(.bottom, 40)
    }

    private func dimBackground(boxSize: CGFloat) -> some View {
        Color.black.opacity(0.55)
            .ignoresSafeArea()
            .mask(
                Rectangle()
                    .ignoresSafeArea()
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .frame(width: boxSize, height: boxSize)
                            .blendMode(.destinationOut)
                    )
                    .compositingGroup()
            )
    }
}

// MARK: - Corner brackets

private struct CornerBrackets: View {
    let size: CGFloat
    let succeeded: Bool

    private var bracketColor: Color { succeeded ? .green : .accentColor }
    private let thickness: CGFloat = 4
    private let armLength: CGFloat = 28
    private let cornerRadius: CGFloat = 6

    var body: some View {
        ZStack {
            // Top-left
            bracket(rotation: 0)
            // Top-right
            bracket(rotation: 90)
            // Bottom-right
            bracket(rotation: 180)
            // Bottom-left
            bracket(rotation: 270)
        }
        .frame(width: size, height: size)
        .animation(.easeInOut(duration: 0.2), value: succeeded)
    }

    private func bracket(rotation: Double) -> some View {
        BracketShape(armLength: armLength, thickness: thickness, cornerRadius: cornerRadius)
            .fill(bracketColor)
            .rotationEffect(.degrees(rotation))
    }
}

private struct BracketShape: Shape {
    let armLength: CGFloat
    let thickness: CGFloat
    let cornerRadius: CGFloat

    func path(in rect: CGRect) -> Path {
        // Top-left corner bracket: two arms meeting at top-left
        var p = Path()
        let r = cornerRadius
        // Horizontal arm: top edge left to right
        p.move(to: CGPoint(x: rect.minX + armLength, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.minX + r, y: rect.minY))
        p.addArc(
            center: CGPoint(x: rect.minX + r, y: rect.minY + r),
            radius: r,
            startAngle: .degrees(-90),
            endAngle: .degrees(180),
            clockwise: true
        )
        p.addLine(to: CGPoint(x: rect.minX, y: rect.minY + armLength))
        // Thicken by stroking
        return p.strokedPath(.init(lineWidth: thickness, lineCap: .round))
    }
}
