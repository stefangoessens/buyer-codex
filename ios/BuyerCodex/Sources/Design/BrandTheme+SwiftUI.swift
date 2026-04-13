import SwiftUI

extension Font {
    static func brand(_ style: BrandTextStyle) -> Font {
        .system(size: style.size, weight: style.weight)
    }
}

extension View {
    func brandShadow(_ token: BrandShadowToken) -> some View {
        token.layers.reduce(AnyView(self)) { partial, layer in
            AnyView(
                partial.shadow(
                    color: layer.color.opacity(layer.opacity),
                    radius: layer.radius,
                    x: layer.x,
                    y: layer.y
                )
            )
        }
    }
}
