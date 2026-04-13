// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "BuyerCodex",
    platforms: [
        .iOS(.v17)
    ],
    products: [
        .library(name: "BuyerCodex", targets: ["BuyerCodex"])
    ],
    targets: [
        .target(
            name: "BuyerCodex",
            path: "Sources"
        ),
        .testTarget(
            name: "BuyerCodexTests",
            dependencies: ["BuyerCodex"],
            path: "Tests"
        )
    ]
)
